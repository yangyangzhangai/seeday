// DOC-DEPS: LLM.md -> docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md -> src/features/chat/README.md
import {
  ZH_ACTIVITY_VERBS,
  ZH_EVALUATION_WORDS,
  ZH_LAST_ACTIVITY_REFERENCES,
  ZH_PUNCT_ONLY,
  ZH_TRAILING_PARTICLES,
} from './liveInputRules.zh';
import {
  EN_LAST_ACTIVITY_REFERENCES,
  EN_SHORT_ACTIVITY_SHELL_PATTERNS,
  EN_SHORT_REPLY_PATTERNS,
} from './liveInputRules.en';
import {
  IT_LAST_ACTIVITY_REFERENCES,
  IT_SHORT_ACTIVITY_SHELL_PATTERNS,
  IT_SHORT_REPLY_PATTERNS,
} from './liveInputRules.it';
import {
  containsAnyLatinSignal,
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

function getLatinTokenCount(input: string): number {
  return input
    .toLowerCase()
    .split(/[^a-z\u00c0-\u017f]+/i)
    .filter(Boolean)
    .length;
}

function getCompactSemanticLength(input: string): number {
  return input
    .replace(/\s+/g, '')
    .replace(/[，,。.!?！？；;、:：'"“”‘’`~\-]/g, '')
    .length;
}

function hasSchedulingOrReminderSignals(input: string): boolean {
  return /(今天|明天|后天|昨[天日]|上午|早上|中午|下午|晚上|今早|刚刚|刚才|待会|等会|等下|一会|稍后|晚点|下周|本周|这周|下个月|本月|\d{1,2}(?::|：)\d{1,2}|\d{1,2}点(?:半|一刻|三刻|\d{1,2}分?)?|[零一二两俩三四五六七八九十]{1,3}点(?:半|一刻|三刻|[零一二三四五六七八九十]{1,2}分?)?|分钟|半小时|小时|记得|提醒|别忘了|还要|需要|打算|计划|要.+了)/.test(input);
}

function isShortReplyLikeText(input: string): boolean {
  return /^(ok|okay|好的?|收到|嗯+|啊+|哦+|哈+|哈哈+|行|可以|知道了|明白了|是的|不是|好嘞)$/.test(input.trim().toLowerCase());
}

// 移动/方向动词：只用于短句壳检测，不放 verbs 以免 verb+object 误判（如 "去吧" → 去+吧）
const ZH_SHORT_SHELL_MOVEMENT_VERBS = '去上下关回到进出';

function hasShortActionShell(input: string): boolean {
  const trimmed = input.trim();
  if (trimmed.length < 2 || trimmed.length > 6) return false;
  const firstChar = trimmed[0];
  return ZH_ACTIVITY_VERBS.some((v) => v.length === 1 && v === firstChar)
    || ZH_SHORT_SHELL_MOVEMENT_VERBS.includes(firstChar);
}

function isShortLatinReplyLikeText(input: string, lang: 'en' | 'it'): boolean {
  const patterns = lang === 'it' ? IT_SHORT_REPLY_PATTERNS : EN_SHORT_REPLY_PATTERNS;
  return patterns.some((pattern) => pattern.test(input.trim()));
}

function hasShortLatinActivityShell(input: string, lang: 'en' | 'it'): boolean {
  const patterns = lang === 'it' ? IT_SHORT_ACTIVITY_SHELL_PATTERNS : EN_SHORT_ACTIVITY_SHELL_PATTERNS;
  return patterns.some((pattern) => pattern.test(input.trim()));
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

  if (signals.hasFuturePlan && !(lang === 'en' && signals.hasActivityPattern) && !signals.hasStrongCompletion) {
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

  const { hasActivity, hasActivityPattern, hasMood, hasStrongCompletion } = signals;
  const moodDominantWithoutActivityStructure = signals.hasMoodPattern && !hasActivityPattern && !hasStrongCompletion;
  const hasActivityEvidence = hasActivityPattern || hasStrongCompletion || (hasActivity && !moodDominantWithoutActivityStructure);

  if (hasActivityEvidence) {
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
      || containsAnyLatinSignal(text, references)
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

  const tokenCount = getLatinTokenCount(text);
  if (
    !hasActivity
    && !hasMood
    && !signals.hasFuturePlan
    && !signals.hasNegatedOrNotOccurred
    && tokenCount > 0
    && tokenCount <= 2
    && !isShortLatinReplyLikeText(text, lang)
    && hasShortLatinActivityShell(text, lang)
  ) {
    const fallbackEvidence = [
      ...evidence,
      makeEvidence('lexicon', 'short_non_mood_default_to_activity_latin', [text], 'medium', 'positive'),
    ];
    const fallbackScores = buildScoresFromEvidence(fallbackEvidence);
    return {
      kind: 'activity',
      internalKind: 'new_activity',
      confidence: 'medium',
      scores: fallbackScores,
      reasons: buildReasonsFromEvidence(fallbackEvidence),
      evidence: fallbackEvidence,
      containsMoodSignal: false,
    };
  }

  return resolveFinalClassification({
    content,
    evidence,
    scores,
    reasons,
    hasActivityEvidence,
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

  const compactLength = getCompactSemanticLength(text);
  if (
    !hasMood
    && !zhSignals.hasFutureOrPlanned
    && !zhSignals.hasNegatedOrNotOccurred
    && compactLength > 0
    && compactLength < 4
    && !hasSchedulingOrReminderSignals(text)
    && !isShortReplyLikeText(text)
    && hasShortActionShell(text)
  ) {
    const fallbackEvidence = [
      ...evidence,
      makeEvidence('lexicon', 'short_non_mood_default_to_activity', [text], 'medium', 'positive'),
    ];
    const fallbackScores = buildScoresFromEvidence(fallbackEvidence);
    return {
      kind: 'activity',
      internalKind: 'new_activity',
      confidence: 'medium',
      scores: fallbackScores,
      reasons: buildReasonsFromEvidence(fallbackEvidence),
      evidence: fallbackEvidence,
      containsMoodSignal: false,
    };
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
