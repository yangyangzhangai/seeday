// DOC-DEPS: LLM.md -> docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md -> src/features/chat/README.md
import type { InternalLiveInputKind, LiveInputClassification } from './types';

type ReclassifyKey = `${'activity' | 'mood'}->${'activity' | 'mood'}`;

export interface LiveInputTelemetrySnapshot {
  autoRecognizedTotal: number;
  classificationByInternalKind: Record<InternalLiveInputKind, number>;
  correctionByPath: Record<ReclassifyKey, number>;
  topReasons: Array<{ reason: string; count: number }>;
}

interface LiveInputTelemetryState {
  autoRecognizedTotal: number;
  classificationByInternalKind: Record<InternalLiveInputKind, number>;
  correctionByPath: Record<ReclassifyKey, number>;
  reasonCounts: Record<string, number>;
}

const INITIAL_STATE: LiveInputTelemetryState = {
  autoRecognizedTotal: 0,
  classificationByInternalKind: {
    new_activity: 0,
    activity_with_mood: 0,
    standalone_mood: 0,
    mood_about_last_activity: 0,
  },
  correctionByPath: {
    'activity->activity': 0,
    'activity->mood': 0,
    'mood->activity': 0,
    'mood->mood': 0,
  },
  reasonCounts: {},
};

let state: LiveInputTelemetryState = {
  ...INITIAL_STATE,
  classificationByInternalKind: { ...INITIAL_STATE.classificationByInternalKind },
  correctionByPath: { ...INITIAL_STATE.correctionByPath },
  reasonCounts: {},
};

export function recordLiveInputClassification(classification: LiveInputClassification): void {
  state.autoRecognizedTotal += 1;
  state.classificationByInternalKind[classification.internalKind] += 1;
  for (const reason of classification.reasons) {
    state.reasonCounts[reason] = (state.reasonCounts[reason] ?? 0) + 1;
  }
}

export function recordLiveInputCorrection(fromKind: 'activity' | 'mood', toKind: 'activity' | 'mood'): void {
  const key: ReclassifyKey = `${fromKind}->${toKind}`;
  state.correctionByPath[key] += 1;
}

export function getLiveInputTelemetrySnapshot(topReasonLimit = 10): LiveInputTelemetrySnapshot {
  const topReasons = Object.entries(state.reasonCounts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, topReasonLimit)
    .map(([reason, count]) => ({ reason, count }));

  return {
    autoRecognizedTotal: state.autoRecognizedTotal,
    classificationByInternalKind: { ...state.classificationByInternalKind },
    correctionByPath: { ...state.correctionByPath },
    topReasons,
  };
}

export function resetLiveInputTelemetry(): void {
  state = {
    ...INITIAL_STATE,
    classificationByInternalKind: { ...INITIAL_STATE.classificationByInternalKind },
    correctionByPath: { ...INITIAL_STATE.correctionByPath },
    reasonCounts: {},
  };
}
