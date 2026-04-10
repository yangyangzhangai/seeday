// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/store/README.md
import type { AiCompanionMode } from '../aiCompanion';

export type CharacterStateTiming = 'instant' | 'delay-1' | 'delay-2';
export type CharacterStateDecayType = 'high' | 'mid' | 'none';
export type BehaviorCategory = 'emotion' | 'body' | 'diet' | 'environment' | 'habit';
export type TeaSubtype = 'herbal' | 'fermented' | 'leaf' | 'light';

export interface BehaviorHitEvent {
  behaviorId: string;
  date: string;
  timestamp: number;
}

export interface DelayedEvent {
  behaviorId: string;
  dueDate: string;
  expiresAt: string;
  sourceDate: string;
}

export interface ActiveEffect {
  behaviorId: string;
  score: number;
  updatedAt: number;
  expiresAt: number;
  halfLifeHours: number;
}

export interface CharacterStateTracker {
  history: BehaviorHitEvent[];
  delayedQueue: DelayedEvent[];
  activeEffects: ActiveEffect[];
}

export interface CharacterStateBuildInput {
  text: string;
  durationMinutes?: number;
  aiMode: AiCompanionMode;
  now: Date;
  tracker: CharacterStateTracker;
}

export interface CharacterStateBuildOutput {
  text: string;
  meta: {
    matchedBehaviorIds: string[];
    injectedBehaviorIds: string[];
    usedTrendIds: string[];
    usedLiteIds: string[];
    selectedStates: Array<{
      behaviorId: string;
      level: 'instant' | 'trend' | 'lite';
      score: number;
    }>;
    suppressedBehaviorIds: string[];
    activeEffects: Array<{
      behaviorId: string;
      score: number;
      remainingHours: number;
    }>;
  };
  tracker: CharacterStateTracker;
}

export const CHARACTER_STATE_MAX_INJECT = 2;
export const DURATION_SEDENTARY_MINUTES = 120;

export const CATEGORY_PRIORITY: Record<BehaviorCategory, number> = {
  emotion: 500,
  body: 400,
  diet: 300,
  environment: 200,
  habit: 100,
};

export function createEmptyCharacterStateTracker(): CharacterStateTracker {
  return {
    history: [],
    delayedQueue: [],
    activeEffects: [],
  };
}
