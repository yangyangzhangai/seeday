import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_ORIGIN = 'https://oxsbukofipeoikirkyyy.supabase.co';

// Hop-by-hop headers must not be forwarded
const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailers', 'transfer-encoding', 'upgrade',
]);

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
