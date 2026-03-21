// DOC-DEPS: LLM.md -> docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md -> src/features/chat/README.md
import {
  ZH_EVALUATION_WORDS,
  ZH_LAST_ACTIVITY_REFERENCES,
  ZH_PUNCT_ONLY,
  ZH_TRAILING_PARTICLES,
} from './liveInputRules.zh';
import {
  EN_LAST_ACTIVITY_REFERENCES,
} from './liveInputRules.en';
import {
  IT_LAST_ACTIVITY_REFERENCES,
} from './liveInputRules.it';
import {
  extractLatinSignals,
  hasLatinContextKeywordOverlap,
} from './signals/latinSignalExtractor';
import {
  buildReasonsFromEvidence,
  buildScoresFromEvidence,
  resolveFinalClassification,
} from './resolver/liveInputResolver';
import {
  containsZhNewActivitySignal,
  extractZhSignals,
  hasZhContextKeywordOverlap,
  resolveZhMoodKey,
} from './signals/zhSignalExtractor';
import type {
  LiveEvidence,
  LiveInputClassification,
  LiveInputContext,
  NormalizedLiveInput,
} from './types';

function normalizeLiveInput(rawContent: string): NormalizedLiveInput {
  const trimmed = rawContent.trim().replace(/\s+/g, ' ');
  if (!trimmed || ZH_PUNCT_ONLY.test(trimmed)) {
    return {
      rawContent,
      normalizedContent: '',
      isMeaningful: false,
    };
  }

  const normalizedContent = trimmed
    .replace(/[，、]/g, ',')
    .replace(/[。！？；：]/g, '.')
    .replace(ZH_TRAILING_PARTICLES, '');

  return {
    rawContent,
    normalizedContent,
    isMeaningful: normalizedContent.length > 0,
  };
}

function includesAny(input: string, words: string[]): boolean {
  return words.some((word) => input.includes(word));
}

function hasCjk(input: string): boolean {
  return /[\u3400-\u9fff]/.test(input);
}

function hasLatin(input: string): boolean {
  return /[A-Za-z\u00C0-\u017F]/.test(input);
}

function getRelatedOngoingActivityId(context: LiveInputContext): string | undefined {
  return context.recentActivity && context.recentActivity.isOngoing
    ? context.recentActivity.id
    : undefined;
}

function makeEvidence(
  source: LiveEvidence['source'],
  reasonCode: string,
  tokens: string[],
  strength: LiveEvidence['strength'],
  polarity?: LiveEvidence['polarity'],
): LiveEvidence {
  return {
    source,
    strength,
    polarity,
    tokens,
    reasonCode,
  };
}

function classifyLatinInput(content: string, context: LiveInputContext): LiveInputClassification {
  const normalized = normalizeLiveInput(content);
  const evidence: LiveEvidence[] = [];
  const baseScores = { activity: 0, mood: 0 };

  if (!normalized.isMeaningful) {
    return {
      kind: 'mood',
      internalKind: 'standalone_mood',
      confidence: 'low',
      scores: baseScores,
      reasons: ['empty_or_punct_only_default_to_mood'],
      evidence,
    };
  }

  const text = normalized.normalizedContent.toLowerCase();
  const signals = extractLatinSignals(text);
  const { lang } = signals;
  const references = lang === 'it' ? IT_LAST_ACTIVITY_REFERENCES : EN_LAST_ACTIVITY_REFERENCES;

  if (signals.hasFuturePlan) {
    evidence.push(makeEvidence('future', 'matched_non_activity_signal', [text], 'strong', 'planned'));
    const scores = buildScoresFromEvidence(evidence);
    return {
      kind: 'mood',
      internalKind: 'standalone_mood',
      confidence: 'high',
      scores,
      reasons: buildReasonsFromEvidence(evidence),
      evidence,
      containsMoodSignal: true,
      relatedActivityId: getRelatedOngoingActivityId(context),
    };
  }

  if (signals.hasNegatedOrNotOccurred) {
    evidence.push(makeEvidence('negation', 'matched_negated_or_not_occurred_signal', [text], 'strong', 'negative'));
    const scores = buildScoresFromEvidence(evidence);
    return {
      kind: 'mood',
      internalKind: 'standalone_mood',
      confidence: 'high',
      scores,
      reasons: buildReasonsFromEvidence(evidence),
      evidence,
      containsMoodSignal: true,
      relatedActivityId: getRelatedOngoingActivityId(context),
    };
  }

  const { hasActivity, hasMood, hasStrongCompletion } = signals;

  if (hasActivity) {
    evidence.push(makeEvidence('lexicon', 'matched_activity_signal', [text], 'strong', 'positive'));
  }
  if (hasStrongCompletion) {
    evidence.push(makeEvidence('completion', 'matched_strong_completion_signal', [text], 'medium', 'positive'));
  }
  if (hasMood) {
    evidence.push(makeEvidence('mood', 'matched_mood_signal', [text], 'medium', 'positive'));
  }

  const scores = buildScoresFromEvidence(evidence);
  const reasons = buildReasonsFromEvidence(evidence);

  if (context.recentActivity) {
    const referencesLast =
      hasStrongCompletion
      || includesAny(text, references)
      || hasLatinContextKeywordOverlap(text, context.recentActivity.content);
    if (referencesLast && hasMood && scores.activity <= scores.mood + 1) {
      const contextEvidence = [
        ...evidence,
        makeEvidence('mood', 'context_bias_to_last_activity', [context.recentActivity.id], 'strong', 'positive'),
      ];
      const contextScores = buildScoresFromEvidence(contextEvidence);
      return {
        kind: 'mood',
        internalKind: 'mood_about_last_activity',
        confidence: 'high',
        scores: contextScores,
        reasons: buildReasonsFromEvidence(contextEvidence),
        evidence: contextEvidence,
        containsMoodSignal: true,
        relatedActivityId: context.recentActivity.id,
      };
    }
  }

  return resolveFinalClassification({
    content,
    evidence,
    scores,
    reasons,
    hasActivityEvidence: hasActivity,
    hasMood,
    relatedActivityId: getRelatedOngoingActivityId(context),
  });
}

export function classifyLiveInput(content: string, context: LiveInputContext): LiveInputClassification {
  if (!hasCjk(content) && hasLatin(content)) {
    return classifyLatinInput(content, context);
  }

  const normalized = normalizeLiveInput(content);
  const evidence: LiveEvidence[] = [];
  const baseScores = { activity: 0, mood: 0 };

  if (!normalized.isMeaningful) {
    return {
      kind: 'mood',
      internalKind: 'standalone_mood',
      confidence: 'low',
      scores: baseScores,
      reasons: ['empty_or_punct_only_default_to_mood'],
      evidence,
    };
  }

  const text = normalized.normalizedContent;
  const zhSignals = extractZhSignals(text);

  if (zhSignals.hasFutureOrPlanned) {
    evidence.push(makeEvidence('future', 'matched_future_or_planned_signal', [text], 'strong', 'planned'));
    const scores = buildScoresFromEvidence(evidence);
    const relatedActivityId =
      context.recentActivity && context.recentActivity.isOngoing
        ? context.recentActivity.id
        : undefined;
    return {
      kind: 'mood',
      internalKind: 'standalone_mood',
      confidence: 'high',
      scores,
      reasons: buildReasonsFromEvidence(evidence),
      evidence,
      containsMoodSignal: true,
      relatedActivityId,
    };
  }

  if (zhSignals.hasNegatedOrNotOccurred) {
    evidence.push(makeEvidence('negation', 'matched_negated_or_not_occurred_signal', [text], 'strong', 'negative'));
    const scores = buildScoresFromEvidence(evidence);
    const relatedActivityId =
      context.recentActivity && context.recentActivity.isOngoing
        ? context.recentActivity.id
        : undefined;
    return {
      kind: 'mood',
      internalKind: 'standalone_mood',
      confidence: 'high',
      scores,
      reasons: buildReasonsFromEvidence(evidence),
      evidence,
      containsMoodSignal: true,
      relatedActivityId,
    };
  }

  if (zhSignals.hasShortPureMood) {
    evidence.push(makeEvidence('mood', 'short_pure_mood_override', [text], 'strong', 'positive'));
    const scores = buildScoresFromEvidence(evidence);
    return {
      kind: 'mood',
      internalKind: 'standalone_mood',
      confidence: 'high',
      scores,
      reasons: buildReasonsFromEvidence(evidence),
      evidence,
      containsMoodSignal: true,
      relatedActivityId: getRelatedOngoingActivityId(context),
    };
  }

  const { hasOngoing, hasStrongCompletion, goToPlaceDetection } = zhSignals;
  const hasGoToPlace = goToPlaceDetection.matched;
  const hasActivity = zhSignals.hasActivity;
  const hasDirectMood = zhSignals.hasDirectMood;
  const hasWeakCompletion = zhSignals.hasWeakCompletion;
  const hasActivityEvidence = hasOngoing || hasStrongCompletion || hasGoToPlace || hasActivity;

  if (hasOngoing) {
    evidence.push(makeEvidence('ongoing', 'matched_ongoing_signal', [text], 'medium', 'positive'));
  }

  if (hasStrongCompletion) {
    evidence.push(makeEvidence('completion', 'matched_strong_completion_signal', [text], 'medium', 'positive'));
  }

  if (hasGoToPlace) {
    evidence.push(makeEvidence('goto_place', 'matched_go_to_place_signal', [text], 'strong', 'positive'));
    if (goToPlaceDetection.strengthened) {
      evidence.push(makeEvidence('goto_place', 'matched_go_to_place_happened_shell', [text], 'weak', 'positive'));
    }
  }

  if (hasWeakCompletion) {
    evidence.push(makeEvidence('mood', 'matched_weak_completion_signal', [text], 'medium', 'positive'));
  }

  if (hasActivity) {
    evidence.push(makeEvidence('lexicon', 'matched_activity_signal', [text], 'strong', 'positive'));
  }

  if (hasDirectMood) {
    evidence.push(makeEvidence('mood', 'matched_mood_signal', [text], 'medium', 'positive'));
  }

  const scores = buildScoresFromEvidence(evidence);
  const reasons = buildReasonsFromEvidence(evidence);

  const hasMood = zhSignals.hasMood;

  const recent = context.recentActivity;
  if (recent) {
    const referencesLastActivity = includesAny(text, ZH_LAST_ACTIVITY_REFERENCES) || hasZhContextKeywordOverlap(text, recent.content);
    const hasEvaluation = includesAny(text, ZH_EVALUATION_WORDS) || hasMood;
    const hasStrongNewActivity = containsZhNewActivitySignal(text);

    if (referencesLastActivity && hasEvaluation && !hasStrongNewActivity) {
      const contextEvidence = [
        ...evidence,
        makeEvidence('mood', 'context_bias_to_last_activity', [recent.id], 'strong', 'positive'),
      ];
      const contextScores = buildScoresFromEvidence(contextEvidence);
      return {
        kind: 'mood',
        internalKind: 'mood_about_last_activity',
        confidence: 'high',
        scores: contextScores,
        reasons: buildReasonsFromEvidence(contextEvidence),
        evidence: contextEvidence,
        containsMoodSignal: hasMood,
        relatedActivityId: recent.id,
      };
    }
  }

  return resolveFinalClassification({
    content,
    evidence,
    scores,
    reasons,
    hasActivityEvidence,
    hasMood,
    relatedActivityId: getRelatedOngoingActivityId(context),
    extractedMood: resolveZhMoodKey(text),
  });
}
