// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/api/README.md
/**
 * 前端 API Client - 调用 Vercel Serverless Functions
 * 
 * 所有 AI 请求都通过服务端中转，API Key 不会暴露在前端
 */

import { normalizeAiCompanionMode, type AiCompanionMode } from '../lib/aiCompanion';
import { getSupabaseSession } from '../lib/supabase-utils';
import { useAuthStore } from '../store/useAuthStore';
import type { UserProfileV2 } from '../types/userProfile';
import type {
  UserAnalyticsDashboardResponse,
  UserAnalyticsLookupResponse,
} from '../types/userAnalytics';
import type { ProfileSettingsTelemetryDashboardResponse } from '../types/profileSettingsTelemetry';
import type {
  PlantAssetTelemetryRequest,
  PlantAssetTelemetryResponse,
  PlantGenerateRequest,
  PlantGenerateResponse,
  PlantHistoryResponse,
} from '../types/plant';
import type {
  LiveInputTelemetryDashboardResponse,
  LiveInputTelemetryIngestRequest,
  LiveInputTelemetryIngestResponse,
} from '../services/input/liveInputTelemetryApi';
import type {
  AnnotationRequest,
  AnnotationResponse,
} from '../types/annotation';

const configuredApiBase = String(import.meta.env.VITE_API_BASE ?? '')
  .trim()
  .replace(/\/+$/, '');
const API_BASE = configuredApiBase || '/api';

interface ApiErrorShape {
  code?: string;
  error?: string;
  message?: string;
  details?: unknown;
}

export type ApiErrorCode =
  | 'membership_required'
  | 'unauthorized'
  | 'network_error'
  | 'server_error'
  | 'unknown';

interface ApiClientErrorOptions {
  code: ApiErrorCode;
  status?: number;
  details?: unknown;
  path?: string;
  requestId?: string;
  traceId?: string;
}

export class ApiClientError extends Error {
  readonly code: ApiErrorCode;

  readonly status?: number;

  readonly details?: unknown;

  readonly path?: string;

  readonly requestId?: string;

  readonly traceId?: string;

  constructor(message: string, options: ApiClientErrorOptions) {
    super(message);
    this.name = 'ApiClientError';
    this.code = options.code;
    this.status = options.status;
    this.details = options.details;
    this.path = options.path;
    this.requestId = options.requestId;
    this.traceId = options.traceId;
  }
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}

export function isMembershipRequiredError(error: unknown): boolean {
  return isApiClientError(error)
    ? error.code === 'membership_required'
    : (error instanceof Error && error.message.trim().toLowerCase() === 'membership_required');
}

type ApiLang = 'zh' | 'en' | 'it';
type SubscriptionAction = 'activate' | 'restore' | 'cancel';
type SubscriptionSource = 'iap' | 'stripe';
type SubscriptionPlanType = 'monthly' | 'annual';

let apiRequestSeq = 0;

function createApiRequestId(path: string): string {
  apiRequestSeq += 1;
  const normalized = path.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'api';
  return `${normalized}-${Date.now().toString(36)}-${apiRequestSeq}`;
}

function previewApiText(value: unknown, maxLength: number = 160): string {
  if (typeof value !== 'string') return '[non-string]';
  const compact = value.replace(/\s+/g, ' ').trim();
  if (!compact) return '[empty]';
  if (compact.length <= maxLength) return compact;
  const head = compact.slice(0, Math.floor(maxLength / 2));
  const tail = compact.slice(-Math.floor(maxLength / 2));
  return `${head} ... ${tail}`;
}

function logApiDebug(_step: string, _payload: Record<string, unknown>): void {}

function inferApiErrorCode(status: number | undefined, rawCode: unknown, rawMessage: string): ApiErrorCode {
  const normalizedCode = typeof rawCode === 'string' ? rawCode.trim().toLowerCase() : '';
  const normalizedMessage = rawMessage.trim().toLowerCase();

  if (normalizedCode === 'membership_required' || normalizedMessage === 'membership_required') {
    return 'membership_required';
  }
  if (status === 401 || normalizedCode === 'unauthorized' || normalizedMessage === 'unauthorized') {
    return 'unauthorized';
  }
  if (status !== undefined && status >= 500) {
    return 'server_error';
  }
  return 'unknown';
}

function buildApiClientError(params: {
  path: string;
  requestId: string;
  message: string;
  status?: number;
  details?: unknown;
  code?: unknown;
  traceId?: string;
}): ApiClientError {
  return new ApiClientError(params.message, {
    code: inferApiErrorCode(params.status, params.code, params.message),
    status: params.status,
    details: params.details,
    path: params.path,
    requestId: params.requestId,
    traceId: params.traceId,
  });
}

function createUnauthorizedApiError(path: string): ApiClientError {
  const requestId = createApiRequestId(path);
  return buildApiClientError({
    path,
    requestId,
    message: 'Unauthorized',
    status: 401,
    code: 'unauthorized',
  });
}

async function postJson<TReq, TRes>(path: string, body: TReq, init?: RequestInit): Promise<TRes> {
  const requestId = createApiRequestId(path);
  const startedAt = Date.now();
  logApiDebug('request.start', {
    requestId,
    path,
  });

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...(init ?? {}),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new ApiClientError('Network error', {
      code: 'network_error',
      path,
      requestId,
      details: error,
    });
  }

  const elapsedMs = Date.now() - startedAt;
  const responseText = await response.text();
  const traceId = response.headers.get('X-Magic-Pen-Trace-Id') || undefined;

  let parsedBody: unknown = undefined;
  if (responseText.trim()) {
    try {
      parsedBody = JSON.parse(responseText);
    } catch {
      parsedBody = undefined;
    }
  }

  if (!response.ok) {
    const error = (parsedBody || { error: 'Unknown error' }) as ApiErrorShape;
    const message = error.error || error.message || `HTTP ${response.status}`;
    logApiDebug('request.error', {
      requestId,
      path,
      status: response.status,
      elapsedMs,
      traceId,
      error: message,
      responsePreview: previewApiText(responseText),
    });
    throw buildApiClientError({
      path,
      requestId,
      status: response.status,
      details: error.details,
      code: error.code,
      message,
      traceId,
    });
  }

  logApiDebug('request.success', {
    requestId,
    path,
    status: response.status,
    elapsedMs,
    traceId,
    hasBody: parsedBody !== undefined,
  });

  if (parsedBody === undefined) {
    throw buildApiClientError({
      path,
      requestId,
      status: response.status,
      message: `Invalid JSON response from ${path}`,
      traceId,
    });
  }

  return parsedBody as TRes;
}

async function getJson<TRes>(path: string, init?: RequestInit): Promise<TRes> {
  const requestId = createApiRequestId(path);
  const startedAt = Date.now();
  logApiDebug('request.start', {
    requestId,
    path,
  });

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: 'GET',
      ...(init ?? {}),
    });
  } catch (error) {
    throw new ApiClientError('Network error', {
      code: 'network_error',
      path,
      requestId,
      details: error,
    });
  }

  const elapsedMs = Date.now() - startedAt;
  const responseText = await response.text();

  let parsedBody: unknown = undefined;
  if (responseText.trim()) {
    try {
      parsedBody = JSON.parse(responseText);
    } catch {
      parsedBody = undefined;
    }
  }

  if (!response.ok) {
    const error = (parsedBody || { error: 'Unknown error' }) as ApiErrorShape;
    const message = error.error || error.message || `HTTP ${response.status}`;
    logApiDebug('request.error', {
      requestId,
      path,
      status: response.status,
      elapsedMs,
      error: message,
      responsePreview: previewApiText(responseText),
    });
    throw buildApiClientError({
      path,
      requestId,
      status: response.status,
      details: error.details,
      code: error.code,
      message,
    });
  }

  if (parsedBody === undefined) {
    throw buildApiClientError({
      path,
      requestId,
      status: response.status,
      message: `Invalid JSON response from ${path}`,
    });
  }

  return parsedBody as TRes;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const session = await getSupabaseSession();
  if (!session?.access_token) {
    return {};
  }
  return {
    Authorization: `Bearer ${session.access_token}`,
  };
}

interface SubscriptionRequest {
  action: SubscriptionAction;
  source: SubscriptionSource;
  planType?: SubscriptionPlanType;
  transactionId?: string;
  productId?: string;
  originalTransactionId?: string;
}

interface SubscriptionResponse {
  success: boolean;
  plan: 'free' | 'plus';
  isPlus: boolean;
  expiresAt: string | null;
  verificationEnvironment?: 'production' | 'sandbox' | 'unknown';
}

interface StripeCheckoutResponse {
  success: boolean;
  checkoutUrl: string;
}

export async function callSubscriptionAPI(request: SubscriptionRequest): Promise<SubscriptionResponse> {
  const headers = await getAuthHeaders();
  if (!headers.Authorization) {
    throw createUnauthorizedApiError('/subscription');
  }
  return postJson<SubscriptionRequest, SubscriptionResponse>('/subscription', request, { headers });
}

export async function callStripeCheckoutAPI(planType: SubscriptionPlanType): Promise<StripeCheckoutResponse> {
  const headers = await getAuthHeaders();
  if (!headers.Authorization) {
    throw createUnauthorizedApiError('/subscription');
  }
  return postJson<
  {
    action: 'stripe_checkout';
    source: 'stripe';
    planType: SubscriptionPlanType;
    returnPath: '/upgrade';
  },
  StripeCheckoutResponse
  >('/subscription', {
    action: 'stripe_checkout',
    source: 'stripe',
    planType,
    returnPath: '/upgrade',
  }, { headers });
}

interface ActivateTrialResponse {
  success: boolean;
  alreadyUsed: boolean;
}

export interface ExtractProfileRequestMessage {
  id: string;
  content: string;
  timestamp: number;
  duration?: number;
  activityType?: string;
  isMood?: boolean;
}

interface ExtractProfileRequest {
  recentMessages: ExtractProfileRequestMessage[];
  lang?: 'zh' | 'en' | 'it';
}

interface ExtractProfileResponse {
  success: boolean;
  profile?: Partial<UserProfileV2>;
  skipped?: boolean;
  reason?: string;
}

export async function callActivateTrialAPI(): Promise<ActivateTrialResponse> {
  const headers = await getAuthHeaders();
  if (!headers.Authorization) {
    throw createUnauthorizedApiError('/subscription');
  }
  return postJson<{ action: 'activate_trial' }, ActivateTrialResponse>(
    '/subscription',
    { action: 'activate_trial' },
    { headers },
  );
}

export async function callStripeFinalizeAPI(sessionId: string): Promise<SubscriptionResponse> {
  const headers = await getAuthHeaders();
  if (!headers.Authorization) {
    throw createUnauthorizedApiError('/subscription');
  }
  return postJson<
  {
    action: 'stripe_finalize';
    source: 'stripe';
    sessionId: string;
  },
  SubscriptionResponse
  >('/subscription', {
    action: 'stripe_finalize',
    source: 'stripe',
    sessionId,
  }, { headers });
}

export async function callExtractProfileAPI(request: ExtractProfileRequest): Promise<ExtractProfileResponse> {
  const headers = await getAuthHeaders();
  return postJson<ExtractProfileRequest, ExtractProfileResponse>('/extract-profile', request, { headers });
}

/**
 * 调用 Annotation API
 */
export async function callAnnotationAPI(request: AnnotationRequest): Promise<AnnotationResponse> {
  const { aiMode, aiModeEnabled } = useAuthStore.getState().preferences;
  const resolvedAiMode = request.aiMode ?? (aiModeEnabled ? normalizeAiCompanionMode(aiMode) : undefined);
  const debugPrompts = request.debugPrompts ?? import.meta.env.DEV;
  logApiDebug('annotation.request', {
    eventType: request.eventType,
    aiModeEnabled,
    requestedAiMode: request.aiMode,
    resolvedAiMode: resolvedAiMode ?? 'off',
    debugPrompts,
  });

  const response = await postJson<AnnotationRequest, AnnotationResponse>('/annotation', {
    ...request,
    aiMode: resolvedAiMode,
    debugPrompts,
  });

  logApiDebug('annotation.response', {
    eventType: request.eventType,
    source: response.source ?? 'unknown',
    debugAiMode: response.debugAiMode ?? resolvedAiMode ?? 'fallback',
  });

  return response;
}

// ── 日记生成三步流程 API ────────────────────────────────────────────────────────

interface ClassifyRequest {
  rawInput: string;
  lang?: 'zh' | 'en' | 'it';
  habits?: Array<{ id: string; name: string }>;
  goals?: Array<{ id: string; name: string }>;
}

interface ClassifyMatchedBottle {
  type: 'habit' | 'goal';
  id: string;
  stars: number;
}

type ClassifyKind = 'activity' | 'mood';

type ClassifyActivityType =
  | 'study'
  | 'work'
  | 'social'
  | 'life'
  | 'entertainment'
  | 'health';

type ClassifyMoodType =
  | 'happy'
  | 'calm'
  | 'focused'
  | 'satisfied'
  | 'tired'
  | 'anxious'
  | 'bored'
  | 'down';

interface ClassifyResponse {
  success: boolean;
  data: {
    kind: ClassifyKind;
    activity_type: ClassifyActivityType;
    mood_type: ClassifyMoodType | null;
    matched_bottle?: ClassifyMatchedBottle | null;
    confidence: number;
  };
}

interface DiaryRequest {
  mode?: 'full' | 'teaser';
  structuredData: string;
  rawInput?: string;
  date?: string;
  historyContext?: string;
  lang?: 'zh' | 'en' | 'it';
  userName?: string;
  aiMode?: AiCompanionMode;
}

interface DiaryResponse {
  success: boolean;
  content: string;
}

/**
 * 步骤1: 调用分类器 API - 将用户原始输入分类为结构化数据
 */
export async function callClassifierAPI(request: ClassifyRequest): Promise<ClassifyResponse> {
  const headers = await getAuthHeaders();
  return postJson<ClassifyRequest, ClassifyResponse>('/classify', request, { headers });
}

/**
 * 步骤3: 调用日记 API - 生成 AI 日记
 */
export async function callDiaryAPI(request: DiaryRequest): Promise<DiaryResponse> {
  return postJson<DiaryRequest, DiaryResponse>('/diary', {
    ...request,
    aiMode: request.aiMode ?? getCurrentAiMode(),
  });
}

interface MagicPenParseRequest {
  rawText: string;
  lang?: ApiLang;
  todayDateStr: string;
  currentHour: number;
  currentLocalDateTime?: string;
  timezoneOffsetMinutes?: number;
}

interface MagicPenParseSegment {
  text: string;
  sourceText: string;
  kind: 'activity' | 'mood' | 'todo_add' | 'activity_backfill';
  confidence: 'high' | 'medium' | 'low';
  timeRelation?: 'realtime' | 'future' | 'past' | 'unknown';
  durationMinutes?: number;
  startTime?: string;
  endTime?: string;
  timeSource?: 'exact' | 'period' | 'inferred' | 'missing';
  periodLabel?: string;
}

interface MagicPenParseResponse {
  success: boolean;
  data: {
    segments: MagicPenParseSegment[];
    unparsed: string[];
  };
  traceId?: string;
  parseStrategy?: 'direct_json' | 'wrapped_object' | 'fallback_failed';
  providerUsed?: 'zhipu' | 'qwen_flash_fallback' | 'none';
  fallbackFrom?: 'timeout' | 'http_error' | 'empty_content' | 'invalid_payload' | 'parse_failed' | 'exception' | 'qwen';
  failureCategory?: 'model_output_invalid' | 'provider_call_failed' | 'unknown';
  attempts?: Array<{
    provider: 'zhipu' | 'qwen_flash_fallback';
    reason: 'timeout' | 'http_error' | 'empty_content' | 'invalid_payload' | 'parse_failed' | 'exception';
    status?: number;
    elapsedMs: number;
  }>;
}

export async function callMagicPenParseAPI(
  request: MagicPenParseRequest,
): Promise<MagicPenParseResponse> {
  return postJson<MagicPenParseRequest, MagicPenParseResponse>('/magic-pen-parse', request);
}

export async function callPlantGenerateAPI(request: PlantGenerateRequest): Promise<PlantGenerateResponse> {
  const headers = await getAuthHeaders();
  return postJson<PlantGenerateRequest, PlantGenerateResponse>('/plant-generate', request, { headers });
}

export async function callPlantHistoryAPI(startDate: string, endDate: string): Promise<PlantHistoryResponse> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams({ startDate, endDate });
  return getJson<PlantHistoryResponse>(`/plant-history?${params.toString()}`, { headers });
}

export async function callPlantAssetTelemetryAPI(
  request: PlantAssetTelemetryRequest,
): Promise<PlantAssetTelemetryResponse> {
  const headers = await getAuthHeaders();
  if (!headers.Authorization) {
    return { success: false, skipped: true };
  }
  return postJson<PlantAssetTelemetryRequest, PlantAssetTelemetryResponse>('/live-input-telemetry', request, { headers });
}

export async function callLiveInputTelemetryIngestAPI(
  request: LiveInputTelemetryIngestRequest,
): Promise<LiveInputTelemetryIngestResponse> {
  const headers = await getAuthHeaders();
  if (!headers.Authorization) {
    return { success: false, skipped: true };
  }

  return postJson<LiveInputTelemetryIngestRequest, LiveInputTelemetryIngestResponse>(
    '/live-input-telemetry',
    request,
    { headers },
  );
}

export async function callLiveInputTelemetryDashboardAPI(
  days = 7,
): Promise<LiveInputTelemetryDashboardResponse> {
  const headers = await getAuthHeaders();
  if (!headers.Authorization) {
    throw createUnauthorizedApiError('/live-input-telemetry');
  }

  const params = new URLSearchParams({ days: String(days) });
  return getJson<LiveInputTelemetryDashboardResponse>(`/live-input-telemetry?${params.toString()}`, { headers });
}

interface ShortInsightRequest {
  kind: 'activity' | 'mood' | 'todo' | 'habit';
  summary: string;
  lang?: 'zh' | 'en' | 'it';
  aiMode?: AiCompanionMode;
}

interface ShortInsightResponse {
  insight: string;
}

/**
 * 调用 Short Insight API - 生成 ≤20 字的活动或心情分析
 */
export async function callShortInsightAPI(request: ShortInsightRequest): Promise<string> {
  const { aiModeEnabled } = useAuthStore.getState().preferences;
  if (!aiModeEnabled && !request.aiMode) {
    return '';
  }

  try {
    const data = await postJson<ShortInsightRequest & { action: string }, ShortInsightResponse>('/diary', {
      ...request,
      action: 'insight',
      aiMode: request.aiMode ?? getCurrentAiMode(),
    });
    return data.insight || '';
  } catch {
    return '';
  }
}

function getCurrentAiMode(): AiCompanionMode | undefined {
  const { aiMode, aiModeEnabled } = useAuthStore.getState().preferences;
  if (!aiModeEnabled) {
    return undefined;
  }
  return normalizeAiCompanionMode(aiMode);
}

// ── User Analytics API ────────────────────────────────────────────────────────

export async function callUserAnalyticsDashboardAPI(days = 7): Promise<UserAnalyticsDashboardResponse> {
  const headers = await getAuthHeaders();
  if (!headers.Authorization) throw createUnauthorizedApiError('/live-input-telemetry');
  const params = new URLSearchParams({ module: 'user_analytics', days: String(days) });
  return getJson<UserAnalyticsDashboardResponse>(`/live-input-telemetry?${params.toString()}`, { headers });
}

export async function callUserAnalyticsLookupAPI(query: string): Promise<UserAnalyticsLookupResponse> {
  const headers = await getAuthHeaders();
  if (!headers.Authorization) throw createUnauthorizedApiError('/live-input-telemetry');
  const params = new URLSearchParams({ module: 'user_analytics', type: 'user_lookup', query });
  return getJson<UserAnalyticsLookupResponse>(`/live-input-telemetry?${params.toString()}`, { headers });
}

export async function callProfileSettingsTelemetryDashboardAPI(days = 7): Promise<ProfileSettingsTelemetryDashboardResponse> {
  const headers = await getAuthHeaders();
  if (!headers.Authorization) throw createUnauthorizedApiError('/live-input-telemetry');
  const params = new URLSearchParams({ module: 'profile_settings', days: String(days) });
  return getJson<ProfileSettingsTelemetryDashboardResponse>(`/live-input-telemetry?${params.toString()}`, { headers });
}

// ── Delete Account API ────────────────────────────────────────────────────────

export async function callDeleteAccountAPI(): Promise<void> {
  const headers = await getAuthHeaders();
  if (!headers.Authorization) throw createUnauthorizedApiError('/delete-account');
  await postJson<Record<string, never>, { ok: boolean }>('/delete-account', {}, { headers });
}

// ── Todo Decompose API ────────────────────────────────────────────────────────

export interface DecomposeStep {
  title: string;
  durationMinutes: number;
}

interface TodoDecomposeRequest {
  title: string;
  lang?: 'zh' | 'en' | 'it';
}

interface TodoDecomposeResponse {
  success: boolean;
  steps: DecomposeStep[];
  parseStatus?: 'ok' | 'parse_failed';
  model?: string;
  provider?: 'gemini' | 'dashscope';
}

export interface TodoDecomposeResult {
  steps: DecomposeStep[];
  parseStatus: 'ok' | 'parse_failed';
  model: string;
  provider: 'gemini' | 'dashscope';
}

/**
 * 调用 Todo 拆解 API - AI 将待办拆成 3-6 个子步骤
 */
export async function callTodoDecomposeAPI(title: string, lang: 'zh' | 'en' | 'it' = 'zh'): Promise<TodoDecomposeResult> {
  const headers = await getAuthHeaders();
  if (!headers.Authorization) {
    throw createUnauthorizedApiError('/todo-decompose');
  }
  const data = await postJson<TodoDecomposeRequest, TodoDecomposeResponse>('/todo-decompose', { title, lang }, { headers });
  return {
    steps: data.steps ?? [],
    parseStatus: data.parseStatus === 'parse_failed' ? 'parse_failed' : 'ok',
    model: (data.model || 'unknown').trim() || 'unknown',
    provider: data.provider === 'dashscope' ? 'dashscope' : 'gemini',
  };
}
