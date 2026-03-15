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
  timeSource?: 'exact' | 'period' | 'missing';
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

const MAGIC_PEN_PROMPT_ZH = `你是一个时间记录助手的文本解析器。
你需要拆分输入文本，并输出严格 JSON，不要输出任何解释。

输出结构:
{
  "segments": [
    {
      "text": "核心内容",
      "sourceText": "原始片段",
      "kind": "activity 或 mood 或 todo_add 或 activity_backfill",
      "confidence": "high 或 medium 或 low",
      "timeRelation": "realtime 或 future 或 past 或 unknown，可选",
      "durationMinutes": "时长分钟数，可选",
      "startTime": "HH:mm，可选",
      "endTime": "HH:mm，可选",
      "timeSource": "exact 或 period 或 missing，可选",
      "periodLabel": "时段词，可选"
    }
  ],
  "unparsed": ["无法分类片段"]
}

规则:
1) kind 允许 activity、mood、todo_add、activity_backfill：
   - activity: 当前进行中的动作表达
   - mood: 心情表达
   - todo_add: 未来要做事项
   - activity_backfill: 今天已发生活动
2) 必须尽量完整拆分并覆盖所有可识别片段：
   - 同一句可能同时包含 activity、mood、todo_add、activity_backfill
   - 若能识别就输出到 segments，不要因为句子复杂而整体丢到 unparsed
   - 只有确实无法判断的片段才放 unparsed
3) 对 activity_backfill 尽量提取时间:
    - exact: 精确时间或区间
    - period: 仅标注时段语义（如上午/中午/下午/晚上），不要死板固定到唯一时间点
    - 若句子出现"半小时/1小时/90分钟"等时长信息，请优先填 durationMinutes
    - "8-9点"、"8点到9点"、"八九点"这类表达应按区间处理（startTime/endTime），不要把前半段留在 text
    - missing: 无法提取时间
4) text 必须是自然动作短语（可直接给人读）。
5) 每个 segment 必须判断 timeRelation:
   - realtime: 当前/刚发生/正在发生
   - future: 未来计划、提醒、将要发生
   - past: 明确过去且非今天实时（如昨天）
   - unknown: 无法判断
6) confidence 标注规则：
   - high: 语义清晰且证据强（例如“我在吃饭”“感觉很开心”“明天要开会”“我上午学习了”）
   - medium: 基本可判定但表达略模糊
   - low: 证据弱或歧义明显
7) 不确定就放 unparsed，不要强行归类。
8) 结合当前本地时间进行判断：
   - 当前本地时间：{{currentLocalDateTime}}（时区偏移分钟 {{timezoneOffsetMinutes}}）
   - 今天日期 {{todayDateStr}}，当前小时 {{currentHour}}
9) 未来义务表达优先判定为 todo_add：
   - 包含“要/需要/记得/提醒/待会/稍后/今晚要/晚上要”等未来或义务语气时，即使出现“晚上/下午”时段词，也应优先判定为 todo_add。
10) 活动补录(activity_backfill)只用于“今天已发生”的动作，不要把明显未来计划误判为补录。`;

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
  const timeSource = record.timeSource === 'exact' || record.timeSource === 'period' || record.timeSource === 'missing'
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
        temperature: 0.3,
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
