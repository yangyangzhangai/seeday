// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md
import type { VercelRequest, VercelResponse } from '@vercel/node';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export function applyCors(res: VercelResponse, methods: HttpMethod[] = ['POST']): void {
  const allowMethods = [...methods, 'OPTIONS'].join(', ');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', allowMethods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export function handlePreflight(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method !== 'OPTIONS') {
    return false;
  }

  res.status(200).end();
  return true;
}

export function requireMethod(req: VercelRequest, res: VercelResponse, method: HttpMethod): boolean {
  if (req.method === method) {
    return true;
  }

  jsonError(res, 405, 'Method not allowed');
  return false;
}

export function jsonError(
  res: VercelResponse,
  statusCode: number,
  error: string,
  details?: unknown,
  message?: string,
): void {
  const payload: Record<string, unknown> = { error };

  if (details !== undefined) payload.details = details;
  if (message !== undefined) payload.message = message;

  res.status(statusCode).json(payload);
}
