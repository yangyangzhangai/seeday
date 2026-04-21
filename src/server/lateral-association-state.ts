// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/seeday_lateral_association_spec_v1.1 (1).docx

import { createClient } from '@supabase/supabase-js';
import type { CharacterId, LateralAssociationState } from './lateral-association-sampler.js';
import { getSupabaseServiceRoleKey, getSupabaseUrl } from './supabase-request-auth.js';

const stateMap = new Map<string, LateralAssociationState>();
const USER_METADATA_KEY = 'lateral_association_state_v1';

function buildKey(userId: string, characterId: CharacterId): string {
  return `lateral:${userId}:${characterId}`;
}

function createDefaultState(todayDate: string): LateralAssociationState {
  return {
    lastAssociationType: null,
    lastToneTagHistory: [],
    dailyTriggered: [],
    dailyDate: todayDate,
  };
}

function cloneState(state: LateralAssociationState): LateralAssociationState {
  return {
    lastAssociationType: state.lastAssociationType,
    lastToneTagHistory: [...state.lastToneTagHistory],
    dailyTriggered: [...state.dailyTriggered],
    dailyDate: state.dailyDate,
  };
}

function sanitizeState(raw: unknown, todayDate: string): LateralAssociationState {
  if (!raw || typeof raw !== 'object') {
    return createDefaultState(todayDate);
  }

  const record = raw as Record<string, unknown>;
  const lastAssociationType = typeof record.lastAssociationType === 'string'
    ? (record.lastAssociationType as LateralAssociationState['lastAssociationType'])
    : null;
  const lastToneTagHistory = Array.isArray(record.lastToneTagHistory)
    ? record.lastToneTagHistory.filter((item): item is string => typeof item === 'string').slice(-3)
    : [];
  const dailyTriggered = Array.isArray(record.dailyTriggered)
    ? record.dailyTriggered.filter((item): item is LateralAssociationState['dailyTriggered'][number] => typeof item === 'string')
    : [];
  const dailyDate = typeof record.dailyDate === 'string' ? record.dailyDate : todayDate;

  if (dailyDate !== todayDate) {
    return {
      lastAssociationType,
      lastToneTagHistory,
      dailyTriggered: [],
      dailyDate: todayDate,
    };
  }

  return {
    lastAssociationType,
    lastToneTagHistory,
    dailyTriggered,
    dailyDate,
  };
}

function getAdminClient() {
  const serviceRoleKey = getSupabaseServiceRoleKey();
  if (!serviceRoleKey) return null;
  const url = getSupabaseUrl();
  return createClient(url, serviceRoleKey);
}

function readCache(params: { userId: string; characterId: CharacterId; todayDate: string }): LateralAssociationState {
  const key = buildKey(params.userId, params.characterId);
  const cached = stateMap.get(key);
  if (!cached) {
    return createDefaultState(params.todayDate);
  }

  if (cached.dailyDate !== params.todayDate) {
    return {
      ...cached,
      dailyDate: params.todayDate,
      dailyTriggered: [],
    };
  }

  return cloneState(cached);
}

export async function getLateralAssociationState(params: {
  userId: string;
  characterId: CharacterId;
  todayDate: string;
}): Promise<LateralAssociationState> {
  if (!params.userId || params.userId === '__anonymous__') {
    return readCache(params);
  }

  const admin = getAdminClient();
  if (!admin) {
    return readCache(params);
  }

  try {
    const { data, error } = await admin.auth.admin.getUserById(params.userId);
    if (error || !data?.user) {
      return readCache(params);
    }

    const metadata = (data.user.user_metadata || {}) as Record<string, unknown>;
    const root = (metadata[USER_METADATA_KEY] || {}) as Record<string, unknown>;
    const state = sanitizeState(root[params.characterId], params.todayDate);
    stateMap.set(buildKey(params.userId, params.characterId), cloneState(state));
    return state;
  } catch {
    return readCache(params);
  }
}

export async function saveLateralAssociationState(params: {
  userId: string;
  characterId: CharacterId;
  state: LateralAssociationState;
}): Promise<void> {
  stateMap.set(buildKey(params.userId, params.characterId), cloneState(params.state));

  if (!params.userId || params.userId === '__anonymous__') {
    return;
  }

  const admin = getAdminClient();
  if (!admin) {
    return;
  }

  try {
    const { data, error } = await admin.auth.admin.getUserById(params.userId);
    if (error || !data?.user) {
      return;
    }

    const metadata = (data.user.user_metadata || {}) as Record<string, unknown>;
    const root = (metadata[USER_METADATA_KEY] || {}) as Record<string, unknown>;
    const nextRoot = {
      ...root,
      [params.characterId]: cloneState(params.state),
    };

    await admin.auth.admin.updateUserById(params.userId, {
      user_metadata: {
        ...metadata,
        [USER_METADATA_KEY]: nextRoot,
      },
    });
  } catch {
    return;
  }
}
