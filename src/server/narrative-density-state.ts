// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/seeday_doc1_低叙事密度判定规范.docx

import { createClient } from '@supabase/supabase-js';
import {
  NARRATIVE_CACHE_KEY,
  NARRATIVE_EVENT_LOOKBACK_MS,
} from './narrative-density-constants.js';
import type {
  NarrativeEventKeyHit,
  TodayNarrativeCache,
} from './narrative-density-types.js';
import { getSupabaseServiceRoleKey, getSupabaseUrl } from './supabase-request-auth.js';

const stateMap = new Map<string, TodayNarrativeCache>();

function createDefaultCache(todayDate: string): TodayNarrativeCache {
  return {
    date: todayDate,
    entryCount: 0,
    todayRichness: 0,
    triggerCount: { total: 0, naturalEvent: 0, characterMention: 0, derivedEvent: 0 },
    entries: [],
    recentEventKeys: [],
  };
}

function buildKey(userId: string, characterId: string): string {
  return `narrative:${userId}:${characterId}`;
}

function normalizeRecentEventKeys(raw: unknown, nowMs: number): NarrativeEventKeyHit[] {
  if (!Array.isArray(raw)) return [];
  const minTs = nowMs - NARRATIVE_EVENT_LOOKBACK_MS;
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const r = item as Record<string, unknown>;
      if (typeof r.key !== 'string' || typeof r.ts !== 'number') return null;
      return { key: r.key, ts: r.ts };
    })
    .filter((item): item is NarrativeEventKeyHit => Boolean(item) && item.ts >= minTs);
}

function sanitizeCache(raw: unknown, todayDate: string, nowMs: number): TodayNarrativeCache {
  if (!raw || typeof raw !== 'object') return createDefaultCache(todayDate);
  const r = raw as Record<string, unknown>;
  const date = typeof r.date === 'string' ? r.date : todayDate;
  if (date !== todayDate) return createDefaultCache(todayDate);
  return {
    date,
    entryCount: typeof r.entryCount === 'number' ? r.entryCount : 0,
    todayRichness: typeof r.todayRichness === 'number' ? r.todayRichness : 0,
    triggerCount: {
      total: Number((r.triggerCount as any)?.total || 0),
      naturalEvent: Number((r.triggerCount as any)?.naturalEvent || 0),
      characterMention: Number((r.triggerCount as any)?.characterMention || 0),
      derivedEvent: Number((r.triggerCount as any)?.derivedEvent || 0),
    },
    entries: Array.isArray(r.entries)
      ? r.entries.filter((e): e is TodayNarrativeCache['entries'][number] => (
        Boolean(e)
        && typeof (e as any).score === 'number'
        && typeof (e as any).ts === 'number'
        && typeof (e as any).eventKey === 'string'
      )).slice(-300)
      : [],
    recentEventKeys: normalizeRecentEventKeys(r.recentEventKeys, nowMs),
  };
}

function getAdminClient() {
  const serviceRoleKey = getSupabaseServiceRoleKey();
  if (!serviceRoleKey) return null;
  return createClient(getSupabaseUrl(), serviceRoleKey);
}

function readCacheFallback(userId: string, characterId: string, todayDate: string): TodayNarrativeCache {
  const key = buildKey(userId, characterId);
  const cached = stateMap.get(key);
  if (!cached) return createDefaultCache(todayDate);
  if (cached.date !== todayDate) return createDefaultCache(todayDate);
  return { ...cached };
}

export async function getTodayNarrativeCache(params: {
  userId: string;
  characterId: string;
  todayDate: string;
  nowMs: number;
}): Promise<TodayNarrativeCache> {
  if (!params.userId || params.userId === '__anonymous__') {
    return readCacheFallback(params.userId, params.characterId, params.todayDate);
  }
  const admin = getAdminClient();
  if (!admin) return readCacheFallback(params.userId, params.characterId, params.todayDate);

  try {
    const { data } = await admin.auth.admin.getUserById(params.userId);
    const metadata = (data?.user?.user_metadata || {}) as Record<string, unknown>;
    const root = (metadata[NARRATIVE_CACHE_KEY] || {}) as Record<string, unknown>;
    const cache = sanitizeCache(root[params.characterId], params.todayDate, params.nowMs);
    stateMap.set(buildKey(params.userId, params.characterId), cache);
    return cache;
  } catch {
    return readCacheFallback(params.userId, params.characterId, params.todayDate);
  }
}

export async function saveTodayNarrativeCache(params: {
  userId: string;
  characterId: string;
  cache: TodayNarrativeCache;
}): Promise<void> {
  stateMap.set(buildKey(params.userId, params.characterId), { ...params.cache });
  if (!params.userId || params.userId === '__anonymous__') return;
  const admin = getAdminClient();
  if (!admin) return;

  try {
    const { data } = await admin.auth.admin.getUserById(params.userId);
    const metadata = (data?.user?.user_metadata || {}) as Record<string, unknown>;
    const root = (metadata[NARRATIVE_CACHE_KEY] || {}) as Record<string, unknown>;
    await admin.auth.admin.updateUserById(params.userId, {
      user_metadata: {
        ...metadata,
        [NARRATIVE_CACHE_KEY]: {
          ...root,
          [params.characterId]: params.cache,
        },
      },
    });
  } catch {
    return;
  }
}
