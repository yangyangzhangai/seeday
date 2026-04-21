// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> api/README.md
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError, requireMethod } from '../src/server/http.js';
import {
  extractUserProfileFromMessages,
  type ExtractProfileMessage,
} from '../src/server/extract-profile-service.js';
import { requireSupabaseRequestAuth } from '../src/server/supabase-request-auth.js';

function normalizeLang(raw: unknown): 'zh' | 'en' | 'it' {
  if (raw === 'zh' || raw === 'it') return raw;
  return 'en';
}

function normalizeMessages(raw: unknown): ExtractProfileMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .filter((item) => typeof item.content === 'string' && item.content.trim().length > 0)
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : `msg-${Date.now()}`,
      content: String(item.content),
      timestamp: Number(item.timestamp) || Date.now(),
      duration: typeof item.duration === 'number' ? item.duration : undefined,
      activityType: typeof item.activityType === 'string' ? item.activityType : undefined,
      isMood: item.isMood === true,
    }))
    .slice(-120);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res, ['POST']);
  if (handlePreflight(req, res)) return;
  if (!requireMethod(req, res, 'POST')) return;

  if (!(await requireSupabaseRequestAuth(req, res))) return;

  const recentMessages = normalizeMessages(req.body?.recentMessages);
  const lang = normalizeLang(req.body?.lang);
  if (recentMessages.length === 0) {
    res.status(200).json({
      success: true,
      skipped: true,
      reason: 'No valid recentMessages',
      profile: { lastExtractedAt: new Date().toISOString() },
    });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    jsonError(res, 500, 'Server configuration error: Missing OPENAI_API_KEY');
    return;
  }

  try {
    const profile = await extractUserProfileFromMessages({
      messages: recentMessages,
      apiKey,
      model: process.env.PROFILE_EXTRACT_MODEL,
      lang,
    });

    res.status(200).json({
      success: true,
      profile,
    });
  } catch (error) {
    jsonError(
      res,
      500,
      'Profile extraction failed',
      undefined,
      error instanceof Error ? error.message : 'Unknown error',
    );
  }
}
