// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/seeday_doc1_低叙事密度判定规范.docx

export type NarrativeEventType = 'natural_event' | 'character_mention' | 'derived_event';

export type TriggerBlockedReason =
  | 'first_entry'
  | 'not_low_density'
  | 'daily_total_limit'
  | 'event_type_limit'
  | 'probability_miss'
  | 'no_available_type'
  | 'event_library_empty';

export interface TodayNarrativeEntry {
  score: number;
  ts: number;
  eventKey: string;
}

export interface NarrativeEventKeyHit {
  key: string;
  ts: number;
}

export interface TodayNarrativeCache {
  date: string;
  entryCount: number;
  todayRichness: number;
  triggerCount: {
    total: number;
    naturalEvent: number;
    characterMention: number;
    derivedEvent: number;
  };
  entries: TodayNarrativeEntry[];
  recentEventKeys: NarrativeEventKeyHit[];
}

export interface NarrativeDimensionScores {
  freshness: number;
  density: number;
  emotion: number;
  vocab: number;
}

export interface NarrativeScoreResult {
  eventKey: string;
  recentEventCount7d: number;
  currentScore: number;
  dimensions: NarrativeDimensionScores;
}

export interface NarrativeTriggerDecision {
  shouldTrigger: boolean;
  adjustedThreshold: number;
  triggerProbability: number;
  blockedReason?: TriggerBlockedReason;
  selectedEventType?: NarrativeEventType;
}

export interface NarrativeTriggeredEvent {
  eventId: string;
  eventType: NarrativeEventType;
  instruction: string;
}
