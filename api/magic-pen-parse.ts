// DOC-DEPS: LLM.md -> docs/MAGIC_PEN_CAPTURE_SPEC.md -> docs/PROJECT_MAP.md -> api/README.md
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError, requireMethod } from './http.js';

type MagicPenKind = 'activity' | 'mood' | 'todo_add' | 'activity_backfill';
type MagicPenConfidence = 'high' | 'medium' | 'low';
type MagicPenLang = 'zh' | 'en' | 'it';

interface MagicPenAISegment {
  text: string;
  sourceText: string;
  kind: MagicPenKind;
  confidence: MagicPenConfidence;
  timeRelation?: 'realtime' | 'future' | 'past' | 'unknown';
  durationMinutes?: number;
  startTime?: string;
  endTime?: string;
  timeSource?: 'exact' | 'period' | 'inferred' | 'missing';
  periodLabel?: string;
}

interface MagicPenAIResult {
  segments: MagicPenAISegment[];
  unparsed: string[];
}

const STRICT_TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const AI_PARSE_FAILURE_TEXT = '（AI 解析失败，请手动录入）';

type MagicPenParseStrategy = 'direct_json' | 'wrapped_object' | 'fallback_failed';
type MagicPenProvider = 'zhipu' | 'qwen_flash_fallback';

type ProviderFailureReason =
  | 'timeout'
  | 'http_error'
  | 'empty_content'
  | 'invalid_payload'
  | 'parse_failed'
  | 'exception';

interface ParsedMagicPenAIResponse {
  data: MagicPenAIResult;
  strategy: MagicPenParseStrategy;
}

interface ProviderCallSuccess {
  ok: true;
  provider: MagicPenProvider;
  elapsedMs: number;
  status: number;
  raw: string;
  parsed: ParsedMagicPenAIResponse;
}

interface ProviderCallFailure {
  ok: false;
  provider: MagicPenProvider;
  elapsedMs: number;
  reason: ProviderFailureReason;
  status?: number;
  statusText?: string;
  details?: string;
}

type ProviderCallResult = ProviderCallSuccess | ProviderCallFailure;

const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const DEFAULT_DASHSCOPE_BASE_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
const DEFAULT_FALLBACK_MODEL = 'qwen-flash';
const PRIMARY_TIMEOUT_MS = 12000;
const FALLBACK_TIMEOUT_MS = 12000;

function shouldDebugMagicPen(): boolean {
  return process.env.MAGIC_PEN_DEBUG === '1' || process.env.NODE_ENV !== 'production';
}

function createTraceId(): string {
  const now = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 8);
  return `mp-${now}-${rnd}`;
}

function previewText(input: unknown, maxLength: number = 120): string {
  if (typeof input !== 'string') {
    return '[non-string]';
  }
  const compact = input.replace(/\s+/g, ' ').trim();
  if (!compact) return '[empty]';
  if (compact.length <= maxLength) return compact;
  const head = compact.slice(0, Math.floor(maxLength / 2));
  const tail = compact.slice(-Math.floor(maxLength / 2));
  return `${head} ... ${tail}`;
}

function logMagicPen(traceId: string, step: string, payload?: Record<string, unknown>): void {
  if (!shouldDebugMagicPen()) return;
  if (payload) {
    console.log(`[magic-pen-parse][${traceId}] ${step}`, payload);
    return;
  }
  console.log(`[magic-pen-parse][${traceId}] ${step}`);
}

function getTimeoutMs(value: string | undefined, fallbackMs: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallbackMs;
  return Math.min(60000, Math.max(1000, Math.round(parsed)));
}

function normalizeBaseUrl(baseUrl: string | undefined): string {
  const value = (baseUrl || DEFAULT_DASHSCOPE_BASE_URL).trim();
  return value.replace(/\/+$/, '');
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || /abort/i.test(error.message));
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function buildProviderFailure(
  provider: MagicPenProvider,
  elapsedMs: number,
  reason: ProviderFailureReason,
  extras?: Omit<ProviderCallFailure, 'ok' | 'provider' | 'elapsedMs' | 'reason'>,
): ProviderCallFailure {
  return {
    ok: false,
    provider,
    elapsedMs,
    reason,
    ...extras,
  };
}

function normalizeModelTime(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const raw = value.trim();
  if (!raw) return undefined;

  if (STRICT_TIME_RE.test(raw)) {
    return raw;
  }

  const relaxed = raw.match(/^([01]?\d|2[0-3])[:：]([0-5]\d)$/);
  if (!relaxed) return undefined;
  const hour = Number(relaxed[1]);
  const minute = Number(relaxed[2]);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

const MAGIC_PEN_PROMPT_ZH = `你是小时，一个非常了解中国人日常说话习惯的时间记录助手。

你的任务是：理解用户随口说的一句话，帮他们把"自己做了什么、现在在做什么、要做什么、心情怎么样"提取出来，整理成结构化 JSON 记录。

用户说话很随意，经常省略主语、混用时态、一句话里夹好几件事。你要像聊天的朋友一样先"听懂"，再输出 JSON。不要因为信息不完整就放弃推断——有合理猜测就给，并标注置信度。

当前上下文：
- 本地时间：{{currentLocalDateTime}}（时区偏移 {{timezoneOffsetMinutes}} 分钟）
- 今天日期：{{todayDateStr}}
- 当前小时：{{currentHour}}

---

输出格式（只输出 JSON，不加任何解释）：
{
  "segments": [
    {
      "text": "核心内容（动词短语，不加主语）",
      "sourceText": "对应原文片段，不改写",
      "kind": "activity | mood | todo_add | activity_backfill",
      "confidence": "high | medium | low",
      "timeRelation": "realtime | future | past | unknown",
      "startTime": "HH:mm（可选）",
      "endTime": "HH:mm（可选）",
      "durationMinutes": "整数（可选，只在用户明确说了时长时填）",
      "timeSource": "exact | period | inferred | missing",
      "periodLabel": "时段词原文，如‘早上’‘刚刚’（可选）"
    }
  ],
  "unparsed": ["实在无法稳定分类的片段"]
}

---

kind 含义：
- activity：正在进行的事（"在做"、"正在"、无时间词时默认当下）
- mood：情绪/感受表达（"好累"、"烦死了"、"开心"）
- todo_add：未来要做的（"要去"、"打算"、"明天"、"待会"）
- activity_backfill：今天已完成的（"刚刚"、"x点做了"、"早上"、"上午"）

时间推断规则：
- 明确时刻（“9点半”/ "九点半" / "10:00"）→ 转成 HH:mm，timeSource: "exact"
- 只要片段里出现明确时刻（如“八点”“九点半”“10:00”），优先使用 exact，不要改成 period
- 只有时段词（"早上" / "下午"）→ 保留 periodLabel，timeSource: "period"，不强行猜具体时刻
- 说"刚" / "刚刚" → startTime 往当前时间前推 15~30 分钟，timeSource: "inferred"
- endTime 没说的，根据活动类型合理估算（起床≈30min，吃饭≈30min，开会≈60min，通勤≈30min）
- 没有任何时间信息 → 不填时间字段，timeSource: "missing"

混合句处理：
- 一条 segment 只放一种意图，不能把情绪和待办混在同一条里
- 像“最近太累了有点难过但是决定从明天开始每天跑步”应拆成 mood + mood + todo_add，其中 todo text 只保留“每天跑步”
- 同一条输入最多只保留一个 realtime activity；如果还有其他活动片段，默认判为 activity_backfill
- 只有用户明确并行表达（如“我在吃饭和下棋”“一边吃饭一边看剧”）时，才允许并行活动
- 若同句里已识别当前活动，且另一个活动带有比当前时刻更早的明确时间（如“九点出门”），该活动应判为 activity_backfill

---

学习案例：

案例 1
输入：我在上课，早上八点就起床了，但是十点才出门
输出：
{
  "segments": [
    {"text":"上课","sourceText":"我在上课","kind":"activity","confidence":"high","timeRelation":"realtime","timeSource":"missing"},
    {"text":"起床","sourceText":"早上八点就起床了","kind":"activity_backfill","confidence":"high","timeRelation":"past","startTime":"08:00","endTime":"08:30","timeSource":"exact"},
    {"text":"出门","sourceText":"十点才出门","kind":"activity_backfill","confidence":"high","timeRelation":"past","startTime":"10:00","endTime":"10:20","timeSource":"exact"}
  ],
  "unparsed": []
}

案例 2
输入：九点半起床
输出：
{
  "segments": [
    {"text":"起床","sourceText":"九点半起床","kind":"activity_backfill","confidence":"high","timeRelation":"past","startTime":"09:30","endTime":"10:00","timeSource":"exact"}
  ],
  "unparsed": []
}

案例 3
输入：我在上课然后十点半要出门
输出：
{
  "segments": [
    {"text":"上课","sourceText":"我在上课","kind":"activity","confidence":"high","timeRelation":"realtime","timeSource":"missing"},
    {"text":"出门","sourceText":"十点半要出门","kind":"todo_add","confidence":"high","timeRelation":"future","startTime":"10:30","timeSource":"exact"}
  ],
  "unparsed": []
}

案例 4
输入：累死了刚开完会 下午还有两个
输出：
{
  "segments": [
    {"text":"累","sourceText":"累死了","kind":"mood","confidence":"high","timeRelation":"realtime","timeSource":"missing"},
    {"text":"开会","sourceText":"刚开完会","kind":"activity_backfill","confidence":"high","timeRelation":"past","timeSource":"inferred"},
    {"text":"开会","sourceText":"下午还有两个","kind":"todo_add","confidence":"medium","timeRelation":"future","periodLabel":"下午","timeSource":"period"}
  ],
  "unparsed": []
}

案例 5
输入：醒了但是还没起，困死了
输出：
{
  "segments": [
    {"text":"醒了","sourceText":"醒了","kind":"activity","confidence":"medium","timeRelation":"realtime","timeSource":"missing"},
    {"text":"困","sourceText":"困死了","kind":"mood","confidence":"high","timeRelation":"realtime","timeSource":"missing"}
  ],
  "unparsed": ["但是还没起"]
}

案例 6
输入：最近太累了有点难过但是决定从明天开始每天跑步
输出：
{
  "segments": [
    {"text":"累","sourceText":"最近太累了","kind":"mood","confidence":"high","timeRelation":"realtime","timeSource":"missing"},
    {"text":"难过","sourceText":"有点难过","kind":"mood","confidence":"high","timeRelation":"realtime","timeSource":"missing"},
    {"text":"每天跑步","sourceText":"但是决定从明天开始每天跑步","kind":"todo_add","confidence":"high","timeRelation":"future","timeSource":"missing"}
  ],
  "unparsed": []
}

案例 7
输入：八点起床最近太累了有点难过但是决定开始每天都跑步
输出：
{
  "segments": [
    {"text":"起床","sourceText":"八点起床","kind":"activity_backfill","confidence":"high","timeRelation":"past","startTime":"08:00","endTime":"08:30","timeSource":"exact"},
    {"text":"太累","sourceText":"最近太累了","kind":"mood","confidence":"high","timeRelation":"realtime","timeSource":"missing"},
    {"text":"难过","sourceText":"有点难过","kind":"mood","confidence":"high","timeRelation":"realtime","timeSource":"missing"},
    {"text":"每天跑步","sourceText":"但是决定开始每天都跑步","kind":"todo_add","confidence":"high","timeRelation":"future","timeSource":"missing"}
  ],
  "unparsed": []
}`;

const MAGIC_PEN_PROMPT_EN = `You are a text parser for a time-tracking assistant.
Split the input into segments and output strict JSON only. Do not output explanations.

Output schema:
{
  "segments": [
    {
      "text": "core content",
      "sourceText": "original segment",
      "kind": "activity or mood or todo_add or activity_backfill",
      "confidence": "high or medium or low",
      "timeRelation": "realtime or future or past or unknown, optional",
      "durationMinutes": "duration in minutes, optional",
      "startTime": "HH:mm, optional",
      "endTime": "HH:mm, optional",
      "timeSource": "exact or period or missing, optional",
      "periodLabel": "period token, optional"
    }
  ],
  "unparsed": ["segments that cannot be classified"]
}

Rules:
1) kind can be activity, mood, todo_add, activity_backfill:
   - activity: ongoing/current action
   - mood: emotion state
   - todo_add: future task
   - activity_backfill: activity already happened today
2) Split and classify as completely as possible:
   - one sentence may contain all four kinds at once
   - keep recognizable pieces in segments, do not dump them to unparsed only because the sentence is mixed/complex
   - use unparsed only for truly unclassifiable parts
3) For activity_backfill, extract time when possible:
    - exact: exact time or range
    - period: keep period intent (morning/noon/afternoon/evening) instead of forcing one fixed clock window
    - if duration is explicit (e.g. half hour / 1 hour / 90 minutes), provide durationMinutes when possible
    - expressions like "8-9" or "8 to 9" should become a range via startTime/endTime, not leftover text
    - missing: no reliable time
4) text must be a natural action phrase that can be read directly by users.
5) Every segment should set timeRelation:
   - realtime: current/just happened/ongoing
   - future: plan/reminder/will happen
   - past: explicit past and not current-day realtime
   - unknown: cannot tell
6) confidence guidance:
   - high: clear intent with strong cues (for example "I am eating", "I feel happy", "I need to meet tomorrow", "I studied this morning")
   - medium: mostly clear but partially ambiguous
   - low: weak evidence or unclear intent
7) If uncertain, put it in unparsed instead of forced classification.
8) Use current local time for temporal judgement:
   - current local datetime: {{currentLocalDateTime}} (timezone offset minutes {{timezoneOffsetMinutes}})
   - today is {{todayDateStr}}, current hour is {{currentHour}}
9) Future/obligation wording should prefer todo_add:
   - if segment includes wording like need to / should / remember to / later / tonight I need to, classify as todo_add even when period words (e.g. evening) appear.
10) activity_backfill is only for actions that have already happened today; do not map clear future plans to backfill.`;

const MAGIC_PEN_PROMPT_IT = `Sei un parser di testo per un assistente di tracciamento del tempo.
Dividi l'input in segmenti e restituisci solo JSON rigoroso. Non aggiungere spiegazioni.

Schema di output:
{
  "segments": [
    {
      "text": "contenuto principale",
      "sourceText": "segmento originale",
      "kind": "activity o mood o todo_add o activity_backfill",
      "confidence": "high o medium o low",
      "timeRelation": "realtime o future o past o unknown, opzionale",
      "durationMinutes": "durata in minuti, opzionale",
      "startTime": "HH:mm, opzionale",
      "endTime": "HH:mm, opzionale",
      "timeSource": "exact o period o missing, opzionale",
      "periodLabel": "etichetta fascia oraria, opzionale"
    }
  ],
  "unparsed": ["segmenti non classificabili"]
}

Regole:
1) kind puo essere activity, mood, todo_add, activity_backfill:
   - activity: azione in corso/adesso
   - mood: stato emotivo
   - todo_add: attivita futura
   - activity_backfill: attivita gia svolta oggi
2) Suddividi e classifica in modo completo quando possibile:
   - una frase puo contenere contemporaneamente tutti e quattro i tipi
   - i segmenti riconoscibili devono andare in segments, non in unparsed solo perche la frase e mista/complessa
   - usa unparsed solo per parti davvero non classificabili
3) Per activity_backfill estrai il tempo quando possibile:
   - exact: orario preciso o intervallo
   - period: mantieni la semantica della fascia (mattina/mezzogiorno/pomeriggio/sera) senza forzare una finestra fissa
   - se la durata e esplicita (es. mezz'ora / 1 ora / 90 minuti), valorizza durationMinutes quando possibile
   - missing: tempo non affidabile
4) text deve essere una frase d'azione naturale, leggibile direttamente dall'utente.
5) Ogni segmento dovrebbe impostare timeRelation:
   - realtime: in corso/appena successo
   - future: piano/promemoria/futuro
   - past: passato esplicito non realtime
   - unknown: non determinabile
6) guida confidence:
   - high: intenzione chiara con segnali forti (es. "sto mangiando", "mi sento felice", "domani devo fare una riunione", "ho studiato stamattina")
   - medium: abbastanza chiaro ma con ambiguita parziale
   - low: segnali deboli o intenzione non chiara
7) Se incerto, inserisci in unparsed senza forzare la classificazione.
8) Usa l'ora locale corrente per i giudizi temporali:
   - data/ora locale corrente: {{currentLocalDateTime}} (offset fuso minuti {{timezoneOffsetMinutes}})
   - oggi e {{todayDateStr}}, ora corrente {{currentHour}}
9) Le espressioni future/di obbligo devono preferire todo_add:
   - con forme come devo / bisogna / ricordati / tra poco / stasera devo, classifica come todo_add anche se compaiono parole di fascia oraria.
10) activity_backfill va usato solo per azioni gia avvenute oggi; non mappare piani futuri evidenti come backfill.`;

function toSupportedLang(value: unknown): MagicPenLang {
  if (value === 'en' || value === 'it' || value === 'zh') return value;
  return 'zh';
}

function getMagicPenPrompt(lang: MagicPenLang): string {
  if (lang === 'en') return MAGIC_PEN_PROMPT_EN;
  if (lang === 'it') return MAGIC_PEN_PROMPT_IT;
  return MAGIC_PEN_PROMPT_ZH;
}

function isKind(value: unknown): value is MagicPenKind {
  return value === 'activity' || value === 'mood' || value === 'todo_add' || value === 'activity_backfill';
}

function isConfidence(value: unknown): value is MagicPenConfidence {
  return value === 'high' || value === 'medium' || value === 'low';
}

function isTimeRelation(value: unknown): value is NonNullable<MagicPenAISegment['timeRelation']> {
  return value === 'realtime' || value === 'future' || value === 'past' || value === 'unknown';
}

function sanitizeSegment(segment: unknown): MagicPenAISegment | null {
  if (!segment || typeof segment !== 'object') return null;
  const record = segment as Record<string, unknown>;
  const kind = record.kind;
  if (!isKind(kind)) return null;

  const text = typeof record.text === 'string' ? record.text.trim() : '';
  const sourceText = typeof record.sourceText === 'string' ? record.sourceText.trim() : text;
  if (!text && !sourceText) return null;

  const confidence = isConfidence(record.confidence) ? record.confidence : 'low';
  const timeRelation = isTimeRelation(record.timeRelation) ? record.timeRelation : undefined;
  const durationMinutes = Number.isFinite(record.durationMinutes)
    ? Math.max(1, Math.min(720, Math.round(Number(record.durationMinutes))))
    : undefined;

  const startTime = normalizeModelTime(record.startTime);
  const endTime = normalizeModelTime(record.endTime);
  const timeSource = record.timeSource === 'exact'
    || record.timeSource === 'period'
    || record.timeSource === 'inferred'
    || record.timeSource === 'missing'
    ? record.timeSource
    : undefined;
  const periodLabel = typeof record.periodLabel === 'string' ? record.periodLabel : undefined;

  return {
    text: text || sourceText,
    sourceText: sourceText || text,
    kind,
    confidence,
    timeRelation,
    durationMinutes,
    startTime,
    endTime,
    timeSource,
    periodLabel,
  };
}

function normalizeAIResult(input: unknown): MagicPenAIResult {
  if (!input || typeof input !== 'object') {
    return { segments: [], unparsed: [AI_PARSE_FAILURE_TEXT] };
  }
  const payload = input as Record<string, unknown>;
  const segments = Array.isArray(payload.segments)
    ? payload.segments.map(sanitizeSegment).filter((item): item is MagicPenAISegment => !!item)
    : [];
  const unparsed = Array.isArray(payload.unparsed)
    ? payload.unparsed.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
    : [];
  return { segments, unparsed };
}

function parseMagicPenAIResponse(raw: string): ParsedMagicPenAIResponse {
  try {
    return {
      data: normalizeAIResult(JSON.parse(raw.trim())),
      strategy: 'direct_json',
    };
  } catch {
    // noop
  }

  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return {
        data: normalizeAIResult(JSON.parse(match[0])),
        strategy: 'wrapped_object',
      };
    } catch {
      // noop
    }
  }

  return {
    data: { segments: [], unparsed: [AI_PARSE_FAILURE_TEXT] },
    strategy: 'fallback_failed',
  };
}

async function callProvider(
  provider: MagicPenProvider,
  apiUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  rawText: string,
  timeoutMs: number,
): Promise<ProviderCallResult> {
  const startedAt = Date.now();

  try {
    const response = await fetchWithTimeout(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: rawText },
        ],
        temperature: 0.2,
        max_tokens: 1024,
        stream: false,
      }),
    }, timeoutMs);

    const elapsedMs = Date.now() - startedAt;

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      return buildProviderFailure(provider, elapsedMs, 'http_error', {
        status: response.status,
        statusText: response.statusText,
        details: previewText(details, 220),
      });
    }

    const payload = await response.json().catch(() => null);
    if (!payload || typeof payload !== 'object') {
      return buildProviderFailure(provider, elapsedMs, 'invalid_payload');
    }

    const raw = typeof (payload as any)?.choices?.[0]?.message?.content === 'string'
      ? (payload as any).choices[0].message.content
      : '';

    if (!raw.trim()) {
      return buildProviderFailure(provider, elapsedMs, 'empty_content', {
        status: response.status,
      });
    }

    const parsed = parseMagicPenAIResponse(raw);
    if (parsed.strategy === 'fallback_failed') {
      return buildProviderFailure(provider, elapsedMs, 'parse_failed', {
        status: response.status,
        details: previewText(raw, 220),
      });
    }

    return {
      ok: true,
      provider,
      elapsedMs,
      status: response.status,
      raw,
      parsed,
    };
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    if (isAbortError(error)) {
      return buildProviderFailure(provider, elapsedMs, 'timeout');
    }
    return buildProviderFailure(provider, elapsedMs, 'exception', {
      details: error instanceof Error ? error.message : 'unknown error',
    });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res, ['POST']);
  if (handlePreflight(req, res)) return;
  if (!requireMethod(req, res, 'POST')) return;

  const traceId = createTraceId();
  res.setHeader('X-Magic-Pen-Trace-Id', traceId);

  const {
    rawText,
    lang,
    todayDateStr,
    currentHour,
    currentLocalDateTime,
    timezoneOffsetMinutes,
  } = req.body ?? {};

  if (!rawText || typeof rawText !== 'string') {
    logMagicPen(traceId, 'request.invalid_raw_text', { rawTextType: typeof rawText });
    jsonError(res, 400, 'Missing or invalid rawText');
    return;
  }
  if (!todayDateStr || typeof todayDateStr !== 'string') {
    logMagicPen(traceId, 'request.invalid_today_date', { todayDateStrType: typeof todayDateStr });
    jsonError(res, 400, 'Missing or invalid todayDateStr');
    return;
  }
  if (!Number.isInteger(currentHour) || currentHour < 0 || currentHour > 23) {
    logMagicPen(traceId, 'request.invalid_current_hour', { currentHour });
    jsonError(res, 400, 'Missing or invalid currentHour');
    return;
  }

  if (currentLocalDateTime !== undefined && typeof currentLocalDateTime !== 'string') {
    logMagicPen(traceId, 'request.invalid_local_datetime', { currentLocalDateTimeType: typeof currentLocalDateTime });
    jsonError(res, 400, 'Invalid currentLocalDateTime');
    return;
  }

  if (timezoneOffsetMinutes !== undefined && !Number.isFinite(timezoneOffsetMinutes)) {
    logMagicPen(traceId, 'request.invalid_timezone_offset', { timezoneOffsetMinutes });
    jsonError(res, 400, 'Invalid timezoneOffsetMinutes');
    return;
  }

  logMagicPen(traceId, 'request.received', {
    lang: toSupportedLang(lang),
    rawTextLength: rawText.length,
    rawTextPreview: previewText(rawText),
    todayDateStr,
    currentHour,
    hasCurrentLocalDateTime: Boolean(currentLocalDateTime),
    timezoneOffsetMinutes: typeof timezoneOffsetMinutes === 'number' ? timezoneOffsetMinutes : 0,
  });

  const apiKey = process.env.ZHIPU_API_KEY;
  const fallbackApiKey = process.env.QWEN_API_KEY;
  if (!apiKey && !fallbackApiKey) {
    logMagicPen(traceId, 'request.missing_api_keys');
    jsonError(res, 500, 'Server configuration error: Missing API key');
    return;
  }

  const prompt = getMagicPenPrompt(toSupportedLang(lang))
    .replace('{{todayDateStr}}', todayDateStr)
    .replace('{{currentHour}}', String(currentHour))
    .replace('{{currentLocalDateTime}}', currentLocalDateTime || `${todayDateStr} ${String(currentHour).padStart(2, '0')}:00`)
    .replace('{{timezoneOffsetMinutes}}', String(
      typeof timezoneOffsetMinutes === 'number' && Number.isFinite(timezoneOffsetMinutes)
        ? timezoneOffsetMinutes
        : 0,
    ));

  try {
    const providerAttempts: ProviderCallFailure[] = [];

    let primaryResult: ProviderCallResult | null = null;
    if (apiKey) {
      const primaryTimeoutMs = getTimeoutMs(process.env.MAGIC_PEN_PRIMARY_TIMEOUT_MS, PRIMARY_TIMEOUT_MS);
      primaryResult = await callProvider(
        'zhipu',
        ZHIPU_API_URL,
        apiKey,
        'glm-4.7-flash',
        prompt,
        rawText,
        primaryTimeoutMs,
      );

      if (primaryResult.ok) {
        logMagicPen(traceId, 'provider.success', {
          provider: primaryResult.provider,
          status: primaryResult.status,
          elapsedMs: primaryResult.elapsedMs,
          parseStrategy: primaryResult.parsed.strategy,
          rawLength: primaryResult.raw.length,
          rawPreview: previewText(primaryResult.raw, 220),
          segmentCount: primaryResult.parsed.data.segments.length,
          unparsedCount: primaryResult.parsed.data.unparsed.length,
        });

        res.status(200).json({
          success: true,
          data: primaryResult.parsed.data,
          raw: primaryResult.raw,
          traceId,
          parseStrategy: primaryResult.parsed.strategy,
          providerUsed: primaryResult.provider,
        });
        return;
      }

      providerAttempts.push(primaryResult);
      logMagicPen(traceId, 'provider.failure', {
        provider: primaryResult.provider,
        reason: primaryResult.reason,
        status: primaryResult.status,
        elapsedMs: primaryResult.elapsedMs,
        details: primaryResult.details,
      });
    }

    if (fallbackApiKey) {
      const fallbackModel = (process.env.MAGIC_PEN_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL).trim() || DEFAULT_FALLBACK_MODEL;
      const fallbackApiUrl = `${normalizeBaseUrl(process.env.DASHSCOPE_BASE_URL)}/chat/completions`;
      const fallbackTimeoutMs = getTimeoutMs(process.env.MAGIC_PEN_FALLBACK_TIMEOUT_MS, FALLBACK_TIMEOUT_MS);
      const fallbackResult = await callProvider(
        'qwen_flash_fallback',
        fallbackApiUrl,
        fallbackApiKey,
        fallbackModel,
        prompt,
        rawText,
        fallbackTimeoutMs,
      );

      if (fallbackResult.ok) {
        logMagicPen(traceId, 'provider.success', {
          provider: fallbackResult.provider,
          status: fallbackResult.status,
          elapsedMs: fallbackResult.elapsedMs,
          parseStrategy: fallbackResult.parsed.strategy,
          rawLength: fallbackResult.raw.length,
          rawPreview: previewText(fallbackResult.raw, 220),
          segmentCount: fallbackResult.parsed.data.segments.length,
          unparsedCount: fallbackResult.parsed.data.unparsed.length,
          fallbackFrom: primaryResult && !primaryResult.ok ? primaryResult.reason : undefined,
          fallbackModel,
        });

        res.status(200).json({
          success: true,
          data: fallbackResult.parsed.data,
          raw: fallbackResult.raw,
          traceId,
          parseStrategy: fallbackResult.parsed.strategy,
          providerUsed: fallbackResult.provider,
          fallbackFrom: primaryResult && !primaryResult.ok ? primaryResult.reason : undefined,
        });
        return;
      }

      providerAttempts.push(fallbackResult);
      logMagicPen(traceId, 'provider.failure', {
        provider: fallbackResult.provider,
        reason: fallbackResult.reason,
        status: fallbackResult.status,
        elapsedMs: fallbackResult.elapsedMs,
        details: fallbackResult.details,
      });
    }

    logMagicPen(traceId, 'provider.exhausted', {
      attempts: providerAttempts.map((item) => ({
        provider: item.provider,
        reason: item.reason,
        status: item.status,
        elapsedMs: item.elapsedMs,
      })),
    });

    res.status(200).json({
      success: true,
      data: { segments: [], unparsed: [AI_PARSE_FAILURE_TEXT] },
      raw: '',
      traceId,
      parseStrategy: 'fallback_failed',
      providerUsed: 'none',
      attempts: providerAttempts.map((item) => ({
        provider: item.provider,
        reason: item.reason,
        status: item.status,
        elapsedMs: item.elapsedMs,
      })),
    });
  } catch (error) {
    logMagicPen(traceId, 'request.exception', {
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    jsonError(res, 500, 'Internal server error', undefined, error instanceof Error ? error.message : 'Unknown error');
  }
}
