import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_ORIGIN = 'https://oxsbukofipeoikirkyyy.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
  || process.env.VITE_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94c2J1a29maXBlb2lraXJreXl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNzMwNTYsImV4cCI6MjA4NTg0OTA1Nn0.IqVYxwU7r45Mj4kSuJlrI3gFw2rfjr-K48lwJbFq5oQ';

// Hop-by-hop headers must not be forwarded
const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailers', 'transfer-encoding', 'upgrade',
]);

function setCorsHeaders(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', typeof origin === 'string' ? origin : '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'authorization, apikey, content-type, x-client-info, x-supabase-api-version, x-requested-with',
  );
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');
}

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  // Reconstruct Supabase path
  const segments = Array.isArray(req.query.path)
    ? req.query.path
    : req.query.path ? [req.query.path] : [];

  const forwardPath = segments.join('/');

  // Preserve query string (strip the catch-all 'path' param Vercel injects)
  const rawQuery = req.url?.split('?')[1] ?? '';
  const params = new URLSearchParams(rawQuery);
  params.delete('path');
  const queryStr = params.toString();

  const targetUrl = `${SUPABASE_ORIGIN}/${forwardPath}${queryStr ? `?${queryStr}` : ''}`;

  // Build forwarded headers
  const forwardHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (HOP_BY_HOP.has(key.toLowerCase())) continue;
    forwardHeaders[key] = Array.isArray(value) ? value.join(', ') : (value ?? '');
  }
  forwardHeaders['host'] = 'oxsbukofipeoikirkyyy.supabase.co';
  forwardHeaders['apikey'] = forwardHeaders['apikey'] || SUPABASE_ANON_KEY;
  forwardHeaders['authorization'] = forwardHeaders['authorization'] || `Bearer ${SUPABASE_ANON_KEY}`;

  // Read raw body for non-GET requests
  let body: Buffer | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method ?? 'GET',
      headers: forwardHeaders,
      body: body?.length ? body : undefined,
    });

    // Forward status + headers
    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      if (!HOP_BY_HOP.has(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    const data = await upstream.arrayBuffer();
    res.end(Buffer.from(data));
  } catch (err) {
    res.status(502).json({ error: 'proxy_error', message: (err as Error).message });
  }
}
