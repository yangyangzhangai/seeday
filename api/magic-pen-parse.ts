// DOC-DEPS: LLM.md -> docs/MAGIC_PEN_CAPTURE_SPEC.md -> docs/PROJECT_MAP.md -> api/README.md
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError, requireMethod } from '../src/server/http.js';
import { MAGIC_PEN_PROMPT_EN, MAGIC_PEN_PROMPT_IT, MAGIC_PEN_PROMPT_ZH } from '../src/server/magic-pen-prompts.js';

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

function isProviderFailure(result: ProviderCallResult): result is ProviderCallFailure {
  return result.ok === false;
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

    const fallbackApiKey = process.env.QWEN_API_KEY;
    const fallbackModel = (process.env.MAGIC_PEN_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL).trim() || DEFAULT_FALLBACK_MODEL;
    const fallbackApiUrl = `${normalizeBaseUrl(process.env.DASHSCOPE_BASE_URL)}/chat/completions`;
    const fallbackTimeoutMs = getTimeoutMs(process.env.MAGIC_PEN_FALLBACK_TIMEOUT_MS, FALLBACK_TIMEOUT_MS);

    if (fallbackApiKey) {
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
        });

        res.status(200).json({
          success: true,
          data: fallbackResult.parsed.data,
          raw: fallbackResult.raw,
          traceId,
          parseStrategy: fallbackResult.parsed.strategy,
          providerUsed: fallbackResult.provider,
        });
        return;
      }

      if (isProviderFailure(fallbackResult)) {
        providerAttempts.push(fallbackResult);
        logMagicPen(traceId, 'provider.failure', {
          provider: fallbackResult.provider,
          reason: fallbackResult.reason,
          status: fallbackResult.status,
          elapsedMs: fallbackResult.elapsedMs,
          details: fallbackResult.details,
        });
      }
    }

    if (apiKey) {
      const primaryTimeoutMs = getTimeoutMs(process.env.MAGIC_PEN_PRIMARY_TIMEOUT_MS, PRIMARY_TIMEOUT_MS);
      const primaryResult = await callProvider(
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
          fallbackFrom: 'qwen',
        });

        res.status(200).json({
          success: true,
          data: primaryResult.parsed.data,
          raw: primaryResult.raw,
          traceId,
          parseStrategy: primaryResult.parsed.strategy,
          providerUsed: primaryResult.provider,
          fallbackFrom: 'qwen',
        });
        return;
      }

      if (isProviderFailure(primaryResult)) {
        providerAttempts.push(primaryResult);
        logMagicPen(traceId, 'provider.failure', {
          provider: primaryResult.provider,
          reason: primaryResult.reason,
          status: primaryResult.status,
          elapsedMs: primaryResult.elapsedMs,
          details: primaryResult.details,
        });
      }
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
