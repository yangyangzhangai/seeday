// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/timeshine_doc1_低叙事密度判定规范.docx

import type { NarrativeEventType } from './narrative-density-types.js';

export const NARRATIVE_DENSITY_WEIGHTS = {
  freshness: 0.3,
  density: 0.3,
  emotion: 0.25,
  vocab: 0.15,
} as const;

export const NARRATIVE_THRESHOLD_BASE = 0.4;
export const NARRATIVE_THRESHOLD_RICHNESS_FACTOR = 0.15;
export const NARRATIVE_TRIGGER_PROBABILITY_MIN = 0.015;
export const NARRATIVE_TRIGGER_PROBABILITY_SPAN = 0.16;
export const NARRATIVE_TRIGGER_PROBABILITY_MAX = 0.24;
export const NARRATIVE_TRIGGER_PROBABILITY_GAMMA = 2;
export const NARRATIVE_TRIGGER_RICHNESS_PENALTY = 0.08;
export const NARRATIVE_EVENT_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

export const NARRATIVE_DAILY_LIMIT = {
  total: 3,
  naturalEvent: 1,
  characterMention: 1,
  derivedEvent: 1,
} as const;

export const NARRATIVE_EVENT_WEIGHTS: Record<NarrativeEventType, number> = {
  natural_event: 0.6,
  character_mention: 0.4,
  derived_event: 0,
};

export const NARRATIVE_CACHE_KEY = 'today_narrative_cache_v1';
