import type {
  LiveEvidence,
  LiveInputClassification,
  LiveInputConfidence,
  LiveInputScore,
} from '../types';

function scoreEvidence(evidence: LiveEvidence): LiveInputScore {
  switch (evidence.source) {
    case 'future':
    case 'negation':
      return { activity: 0, mood: 3 };
    case 'ongoing':
      return { activity: 2, mood: 0 };
    case 'completion':
      return { activity: 2, mood: 0 };
    case 'goto_place':
      return evidence.reasonCode === 'matched_go_to_place_happened_shell'
        ? { activity: 1, mood: 0 }
        : { activity: 3, mood: 0 };
    case 'lexicon':
      return { activity: 3, mood: 0 };
    case 'mood':
      if (evidence.reasonCode === 'context_bias_to_last_activity') {
        return { activity: 0, mood: 3 };
      }
      if (evidence.reasonCode === 'matched_weak_completion_signal') {
        return { activity: 0, mood: 2 };
      }
      return { activity: 0, mood: 2 };
    default:
      return { activity: 0, mood: 0 };
  }
}

export function buildScoresFromEvidence(evidence: LiveEvidence[]): LiveInputScore {
  return evidence.reduce(
    (acc, item) => {
      const delta = scoreEvidence(item);
      return {
        activity: acc.activity + delta.activity,
        mood: acc.mood + delta.mood,
      };
    },
    { activity: 0, mood: 0 },
  );
}

export function buildReasonsFromEvidence(evidence: LiveEvidence[]): string[] {
  return evidence.map((item) => item.reasonCode);
}

function getConfidence(diff: number): LiveInputConfidence {
  if (diff >= 3) return 'high';
  if (diff >= 1) return 'medium';
  return 'low';
}

export function resolveFinalClassification(params: {
  content: string;
  evidence: LiveEvidence[];
  scores: LiveInputScore;
  reasons: string[];
  hasActivityEvidence: boolean;
  hasMood: boolean;
  relatedActivityId?: string;
  extractedMood?: LiveInputClassification['extractedMood'];
}): LiveInputClassification {
  const {
    content,
    evidence,
    scores,
    reasons,
    hasActivityEvidence,
    hasMood,
    relatedActivityId,
    extractedMood,
  } = params;

  if (hasActivityEvidence && hasMood) {
    return {
      kind: 'activity',
      internalKind: 'activity_with_mood',
      confidence: 'high',
      scores,
      reasons: [...reasons, 'activity_with_mood_detected'],
      evidence,
      containsMoodSignal: true,
      extractedMood,
      moodNote: content,
    };
  }

  if (scores.activity > scores.mood) {
    return {
      kind: 'activity',
      internalKind: 'new_activity',
      confidence: getConfidence(scores.activity - scores.mood),
      scores,
      reasons,
      evidence,
      containsMoodSignal: false,
    };
  }

  return {
    kind: 'mood',
    internalKind: 'standalone_mood',
    confidence: getConfidence(scores.mood - scores.activity),
    scores,
    reasons: reasons.length > 0 ? reasons : ['ambiguous_default_to_mood'],
    evidence,
    containsMoodSignal: hasMood,
    relatedActivityId,
  };
}
