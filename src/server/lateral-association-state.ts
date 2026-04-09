// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/timeshine_lateral_association_spec_v1.1 (1).docx

import type { CharacterId, LateralAssociationState } from './lateral-association-sampler.js';

const stateMap = new Map<string, LateralAssociationState>();

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

export function getLateralAssociationState(params: {
  userId: string;
  characterId: CharacterId;
  todayDate: string;
}): LateralAssociationState {
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

export function saveLateralAssociationState(params: {
  userId: string;
  characterId: CharacterId;
  state: LateralAssociationState;
}): void {
  const key = buildKey(params.userId, params.characterId);
  stateMap.set(key, cloneState(params.state));
}
