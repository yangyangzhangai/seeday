type DiagnosticLevel = 'debug' | 'info' | 'warn' | 'error';

export type DiagnosticCategory =
  | 'network'
  | 'timeout'
  | 'bad_request'
  | 'unauthorized'
  | 'rls_or_permission'
  | 'table_or_schema'
  | 'server'
  | 'conflict'
  | 'invalid_json'
  | 'unknown';

export interface DiagnosticSummary {
  category: DiagnosticCategory;
  message: string;
  name?: string;
  code?: string | number;
  status?: number;
  requestId?: string;
  traceId?: string;
  path?: string;
  elapsedMs?: number;
  hint: string;
}

const SECRET_KEY_PATTERN = /(access[_-]?token|refresh[_-]?token|provider[_-]?token|id[_-]?token|authorization|apikey|api[_-]?key|password|secret|jwt)/i;

let diagnosticSeq = 0;

function redactString(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [redacted]')
    .replace(/eyJ[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+/g, '[jwt-redacted]')
    .replace(/([?&](?:apikey|access_token|refresh_token|token|key)=)[^&]+/gi, '$1[redacted]');
}

export function sanitizeDiagnosticValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') return redactString(value);
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      stack: value.stack ? redactString(value.stack).split('\n').slice(0, 8).join('\n') : undefined,
      ...(typeof (value as any).status === 'number' ? { status: (value as any).status } : {}),
      ...(typeof (value as any).code === 'string' || typeof (value as any).code === 'number'
        ? { code: (value as any).code }
        : {}),
    };
  }
  if (seen.has(value)) return '[circular]';
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDiagnosticValue(item, seen));
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
      key,
      SECRET_KEY_PATTERN.test(key) ? '[redacted]' : sanitizeDiagnosticValue(entryValue, seen),
    ]),
  );
}

export function createDiagnosticId(prefix: string): string {
  diagnosticSeq += 1;
  const normalized = prefix.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'diagnostic';
  return `${normalized}-${Date.now().toString(36)}-${diagnosticSeq}`;
}

export function getAppRuntimeContext(): Record<string, unknown> {
  if (typeof window === 'undefined') {
    return { runtime: 'server' };
  }
  const capacitor = (window as any).Capacitor;
  return {
    runtime: 'browser',
    href: redactString(window.location.href),
    online: typeof navigator !== 'undefined' ? navigator.onLine : undefined,
    visibilityState: typeof document !== 'undefined' ? document.visibilityState : undefined,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    capacitorPlatform: typeof capacitor?.getPlatform === 'function' ? capacitor.getPlatform() : undefined,
    isNative: typeof capacitor?.isNativePlatform === 'function' ? capacitor.isNativePlatform() : undefined,
  };
}

export function logDiagnostic(
  level: DiagnosticLevel,
  event: string,
  payload: Record<string, unknown> = {},
): void {
  const safePayload = sanitizeDiagnosticValue({
    event,
    at: new Date().toISOString(),
    ...payload,
  });
  const method = level === 'debug' ? console.debug : level === 'info' ? console.info : level === 'warn' ? console.warn : console.error;
  method(`[diagnostic] ${event}`, safePayload);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const message = record.message ?? record.error ?? record.details;
    if (typeof message === 'string') return message;
  }
  return String(error ?? 'Unknown error');
}

function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const record = error as Record<string, unknown>;
  const raw = record.status ?? record.statusCode;
  return typeof raw === 'number' ? raw : undefined;
}

function getErrorCode(error: unknown): string | number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const raw = (error as Record<string, unknown>).code;
  return typeof raw === 'string' || typeof raw === 'number' ? raw : undefined;
}

export function classifyDiagnosticError(params: {
  message?: string;
  status?: number;
  code?: string | number;
}): { category: DiagnosticCategory; hint: string } {
  const message = (params.message ?? '').toLowerCase();
  const code = String(params.code ?? '').toLowerCase();
  const status = params.status;

  if (message.includes('timeout') || code.includes('timeout')) {
    return { category: 'timeout', hint: '请求超时，优先检查网络、Supabase 区域延迟、客户端是否被系统挂起。' };
  }
  if (message.includes('failed to fetch') || message.includes('networkerror') || message.includes('network error') || message.includes('load failed')) {
    return { category: 'network', hint: '网络层没有拿到有效响应，优先检查手机网络、TLS/DNS、App WebView 网络权限和接口域名。' };
  }
  if (message.includes('row-level security') || message.includes('rls') || message.includes('permission denied') || status === 403) {
    return { category: 'rls_or_permission', hint: '很可能是 Supabase RLS/权限策略拒绝，检查 user_id 条件、JWT 用户、表策略和 anon/service role。' };
  }
  if (message.includes('relation') || message.includes('does not exist') || message.includes('schema cache') || message.includes('column') || code === '42p01' || code === '42703') {
    return { category: 'table_or_schema', hint: '很可能是表/字段不存在或 schema cache 未刷新，检查 Supabase 表结构、迁移脚本和部署环境是否连到同一个项目。' };
  }
  if (status === 400 || message.includes('bad request')) {
    return { category: 'bad_request', hint: '请求参数或请求体不符合接口预期，检查 payload、必填字段、时间格式和服务端校验。' };
  }
  if (status === 401 || message.includes('unauthorized') || message.includes('jwt') || message.includes('token')) {
    return { category: 'unauthorized', hint: '认证状态无效或 token 过期，检查登录 session、刷新 token 和 Authorization header。' };
  }
  if (status === 409 || message.includes('duplicate key') || code === '23505') {
    return { category: 'conflict', hint: '写入冲突或唯一键冲突，检查 upsert onConflict、主键和重复数据。' };
  }
  if (typeof status === 'number' && status >= 500) {
    return { category: 'server', hint: '服务端或 Supabase 内部错误，查看 Vercel/Supabase 后台同一时间段日志。' };
  }
  if (message.includes('json')) {
    return { category: 'invalid_json', hint: '响应不是有效 JSON，检查接口是否返回了 HTML、空响应或被网关拦截。' };
  }
  return { category: 'unknown', hint: '错误类型暂不能自动判断，请用 requestId、HTTP 状态和原始信息继续定位。' };
}

export function summarizeDiagnosticError(
  error: unknown,
  extra: Partial<DiagnosticSummary> = {},
): DiagnosticSummary {
  const message = extra.message ?? getErrorMessage(error);
  const status = extra.status ?? getErrorStatus(error);
  const code = extra.code ?? getErrorCode(error);
  const classified = classifyDiagnosticError({ message, status, code });
  const name = error instanceof Error ? error.name : undefined;
  return {
    category: extra.category ?? classified.category,
    message: redactString(message),
    name,
    code,
    status,
    requestId: extra.requestId,
    traceId: extra.traceId,
    path: extra.path,
    elapsedMs: extra.elapsedMs,
    hint: extra.hint ?? classified.hint,
  };
}

export function formatUserFacingDiagnostic(context: string, error: unknown, extra: Partial<DiagnosticSummary> = {}): string {
  const summary = summarizeDiagnosticError(error, extra);
  const parts = [
    `${context}失败：${summary.hint}`,
    `错误类型：${summary.category}`,
    summary.status !== undefined ? `HTTP：${summary.status}` : null,
    summary.code !== undefined ? `code：${summary.code}` : null,
    summary.path ? `环节：${summary.path}` : null,
    summary.elapsedMs !== undefined ? `耗时：${summary.elapsedMs}ms` : null,
    summary.requestId ? `requestId：${summary.requestId}` : null,
    summary.traceId ? `traceId：${summary.traceId}` : null,
    `原始信息：${summary.message}`,
  ].filter(Boolean);
  return parts.join('；');
}

function previewText(value: string, maxLength = 500): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength)}...`;
}

function getRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function getRequestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof input === 'object' && 'method' in input && typeof input.method === 'string') {
    return input.method.toUpperCase();
  }
  return 'GET';
}

export function createInstrumentedFetch(source: string): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const requestId = createDiagnosticId(source);
    const startedAt = Date.now();
    const rawUrl = getRequestUrl(input);
    const method = getRequestMethod(input, init);
    const url = redactString(rawUrl);

    logDiagnostic('debug', 'request.start', {
      requestId,
      source,
      method,
      url,
      context: getAppRuntimeContext(),
    });

    try {
      const response = await fetch(input, init);
      const elapsedMs = Date.now() - startedAt;
      const responsePayload: Record<string, unknown> = {
        requestId,
        source,
        method,
        url,
        status: response.status,
        ok: response.ok,
        elapsedMs,
      };

      if (!response.ok) {
        try {
          const text = await response.clone().text();
          responsePayload.responsePreview = previewText(text);
        } catch {
          responsePayload.responsePreview = '[unavailable]';
        }
        const summary = summarizeDiagnosticError(responsePayload.responsePreview, {
          status: response.status,
          requestId,
          path: url,
          elapsedMs,
        });
        logDiagnostic('warn', 'request.error', { ...responsePayload, summary });
      } else {
        logDiagnostic('info', 'request.success', responsePayload);
      }

      return response;
    } catch (error) {
      const elapsedMs = Date.now() - startedAt;
      const summary = summarizeDiagnosticError(error, {
        requestId,
        path: url,
        elapsedMs,
      });
      logDiagnostic('error', 'request.network_error', {
        requestId,
        source,
        method,
        url,
        elapsedMs,
        summary,
        error,
        context: getAppRuntimeContext(),
      });
      throw error;
    }
  };
}
