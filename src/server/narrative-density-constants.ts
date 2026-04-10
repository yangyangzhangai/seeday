// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/timeshine_doc1_低叙事密度判定规范.docx

import type { NarrativeEventType } from './narrative-density-types.js';

export const NARRATIVE_DENSITY_WEIGHTS = {
  freshness: 0.4,
  density: 0.25,
  emotion: 0.2,
  vocab: 0.15,
} as const;

export const NARRATIVE_THRESHOLD_BASE = 0.4;
export const NARRATIVE_THRESHOLD_RICHNESS_FACTOR = 0.15;
export const NARRATIVE_TRIGGER_PROBABILITY = 0.15;
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
