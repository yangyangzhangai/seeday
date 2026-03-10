// DOC-DEPS: LLM.md -> docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md -> src/features/chat/README.md
import {
  ZH_ACTIVITY_OBJECTS,
  ZH_ACTIVITY_ONGOING_PATTERNS,
  ZH_ACTIVITY_SINGLE_VERB_PATTERNS,
  ZH_ACTIVITY_STRONG_PHRASES,
  ZH_ACTIVITY_VERBS,
  ZH_CONTEXT_ACTIVITY_KEYWORDS,
  ZH_EVALUATION_WORDS,
  ZH_FINISHING_PHRASES,
  ZH_LAST_ACTIVITY_REFERENCES,
  ZH_MOOD_KEYWORDS,
  ZH_MOOD_PATTERNS,
  ZH_MOOD_WORDS,
  ZH_NEW_ACTIVITY_SWITCHES,
  ZH_NON_ACTIVITY_PATTERNS,
  ZH_PUNCT_ONLY,
  ZH_STRONG_COMPLETION_PATTERNS,
  ZH_TRAILING_PARTICLES,
  ZH_WEAK_COMPLETION_WORDS,
} from './liveInputRules.zh';
import {
  EN_ACTIVITY_PATTERNS,
  EN_ACTIVITY_VERBS,
  EN_FUTURE_OR_PLAN_PATTERNS,
  EN_LAST_ACTIVITY_REFERENCES,
  EN_MOOD_PATTERNS,
  EN_MOOD_WORDS,
  EN_STRONG_COMPLETION_PATTERNS,
} from './liveInputRules.en';
import {
  IT_ACTIVITY_PATTERNS,
  IT_ACTIVITY_VERBS,
  IT_FUTURE_OR_PLAN_PATTERNS,
  IT_LAST_ACTIVITY_REFERENCES,
  IT_MOOD_PATTERNS,
  IT_MOOD_WORDS,
  IT_STRONG_COMPLETION_PATTERNS,
} from './liveInputRules.it';
import type {
  LiveInputClassification,
  LiveInputConfidence,
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

function detectLatinLanguage(input: string): 'en' | 'it' {
  const lowered = input.toLowerCase();
  if (includesAny(lowered, [
    'sono',
    'sto ',
    'stanco',
    'felice',
    'riunione',
    'domani',
    'appena',
    'palestra',
    'lezione',
    'lavoro',
    'chiamata',
    'mi sento',
    'quella',
    'sollievo',
  ])) {
    return 'it';
  }
  return 'en';
}

function extractLatinKeywords(input: string): string[] {
  const tokens = input
    .toLowerCase()
    .split(/[^a-z\u00c0-\u017f]+/i)
    .filter((token) => token.length >= 4);
  return Array.from(new Set(tokens));
}

function hasLatinContextKeywordOverlap(text: string, contextText: string): boolean {
  const textTokens = extractLatinKeywords(text);
  if (textTokens.length === 0) {
    return false;
  }
  const contextTokens = new Set(extractLatinKeywords(contextText));
  return textTokens.some((token) => contextTokens.has(token));
}

function getRelatedOngoingActivityId(context: LiveInputContext): string | undefined {
  return context.recentActivity && context.recentActivity.isOngoing
    ? context.recentActivity.id
    : undefined;
}

function classifyLatinInput(content: string, context: LiveInputContext): LiveInputClassification {
  const normalized = normalizeLiveInput(content);
  const reasons: string[] = [];
  const scores = { activity: 0, mood: 0 };

  if (!normalized.isMeaningful) {
    return {
      kind: 'mood',
      internalKind: 'standalone_mood',
      confidence: 'low',
      scores,
      reasons: ['empty_or_punct_only_default_to_mood'],
    };
  }

  const text = normalized.normalizedContent.toLowerCase();
  const lang = detectLatinLanguage(text);
  const activityVerbs = lang === 'it' ? IT_ACTIVITY_VERBS : EN_ACTIVITY_VERBS;
  const moodWords = lang === 'it' ? IT_MOOD_WORDS : EN_MOOD_WORDS;
  const moodPatterns = lang === 'it' ? IT_MOOD_PATTERNS : EN_MOOD_PATTERNS;
  const activityPatterns = lang === 'it' ? IT_ACTIVITY_PATTERNS : EN_ACTIVITY_PATTERNS;
  const completionPatterns = lang === 'it' ? IT_STRONG_COMPLETION_PATTERNS : EN_STRONG_COMPLETION_PATTERNS;
  const futurePatterns = lang === 'it' ? IT_FUTURE_OR_PLAN_PATTERNS : EN_FUTURE_OR_PLAN_PATTERNS;
  const references = lang === 'it' ? IT_LAST_ACTIVITY_REFERENCES : EN_LAST_ACTIVITY_REFERENCES;

  const hasFuturePlan = futurePatterns.some((pattern) => pattern.test(text));
  if (hasFuturePlan) {
    scores.mood += 3;
    reasons.push('matched_non_activity_signal');
    return {
      kind: 'mood',
      internalKind: 'standalone_mood',
      confidence: 'high',
      scores,
      reasons,
      containsMoodSignal: true,
      relatedActivityId: getRelatedOngoingActivityId(context),
    };
  }

  const hasActivity = includesAny(text, activityVerbs) || activityPatterns.some((pattern) => pattern.test(text));
  const hasMood = includesAny(text, moodWords) || moodPatterns.some((pattern) => pattern.test(text));
  const hasStrongCompletion = completionPatterns.some((pattern) => pattern.test(text));

  if (hasActivity) {
    scores.activity += 3;
    reasons.push('matched_activity_signal');
  }
  if (hasStrongCompletion) {
    scores.activity += 2;
    reasons.push('matched_strong_completion_signal');
  }
  if (hasMood) {
    scores.mood += 2;
    reasons.push('matched_mood_signal');
  }

  if (context.recentActivity) {
    const referencesLast =
      hasStrongCompletion
      || includesAny(text, references)
      || hasLatinContextKeywordOverlap(text, context.recentActivity.content);
    if (referencesLast && hasMood && scores.activity <= scores.mood + 1) {
      return {
        kind: 'mood',
        internalKind: 'mood_about_last_activity',
        confidence: 'high',
        scores,
        reasons: [...reasons, 'context_bias_to_last_activity'],
        containsMoodSignal: true,
        relatedActivityId: context.recentActivity.id,
      };
    }
  }

  if (hasActivity && hasMood) {
    return {
      kind: 'activity',
      internalKind: 'activity_with_mood',
      confidence: 'high',
      scores,
      reasons: [...reasons, 'activity_with_mood_detected'],
      containsMoodSignal: true,
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
      containsMoodSignal: false,
    };
  }

  return {
    kind: 'mood',
    internalKind: 'standalone_mood',
    confidence: getConfidence(scores.mood - scores.activity),
    scores,
    reasons: reasons.length > 0 ? reasons : ['ambiguous_default_to_mood'],
    containsMoodSignal: hasMood,
    relatedActivityId: getRelatedOngoingActivityId(context),
  };
}

function hasActivitySignal(input: string): boolean {
  if (includesAny(input, ZH_ACTIVITY_STRONG_PHRASES)) return true;
  if (includesAny(input, ZH_ACTIVITY_OBJECTS) && includesAny(input, ZH_ACTIVITY_VERBS)) return true;
  if (ZH_ACTIVITY_SINGLE_VERB_PATTERNS.some((pattern) => pattern.test(input))) return true;
  return includesAny(input, ZH_ACTIVITY_VERBS);
}

function hasOngoingSignal(input: string): boolean {
  return ZH_ACTIVITY_ONGOING_PATTERNS.some((pattern) => pattern.test(input));
}

function hasStrongCompletionSignal(input: string): boolean {
  return includesAny(input, ZH_FINISHING_PHRASES) || ZH_STRONG_COMPLETION_PATTERNS.some((pattern) => pattern.test(input));
}

function hasWeakCompletionSignal(input: string): boolean {
  return includesAny(input, ZH_WEAK_COMPLETION_WORDS);
}

function hasMoodSignal(input: string): boolean {
  if (includesAny(input, ZH_MOOD_WORDS)) return true;
  return ZH_MOOD_PATTERNS.some((pattern) => pattern.test(input));
}

function getMoodKey(input: string): LiveInputClassification['extractedMood'] {
  for (const rule of ZH_MOOD_KEYWORDS) {
    if (rule.pattern.test(input)) {
      return rule.mood;
    }
  }
  return undefined;
}

function containsNewActivitySignal(input: string): boolean {
  if (includesAny(input, ['去洗澡', '去吃饭', '开始学习', '去运动', '去散步', '去健身房'])) {
    return true;
  }

  if (includesAny(input, ZH_NEW_ACTIVITY_SWITCHES) && includesAny(input, ZH_ACTIVITY_VERBS)) {
    return true;
  }

  return false;
}

function hasNonActivitySignal(input: string): boolean {
  return ZH_NON_ACTIVITY_PATTERNS.some((pattern) => pattern.test(input));
}

function extractActivityKeywords(input: string): string[] {
  const seen = new Set<string>();
  for (const token of ZH_CONTEXT_ACTIVITY_KEYWORDS) {
    if (input.includes(token)) {
      seen.add(token);
    }
  }
  return Array.from(seen);
}

function hasContextKeywordOverlap(text: string, contextText: string): boolean {
  const currentTokens = extractActivityKeywords(text);
  if (currentTokens.length === 0) {
    return false;
  }
  const contextTokens = new Set(extractActivityKeywords(contextText));
  return currentTokens.some((token) => contextTokens.has(token));
}

function getConfidence(diff: number): LiveInputConfidence {
  if (diff >= 3) return 'high';
  if (diff >= 1) return 'medium';
  return 'low';
}

export function classifyLiveInput(content: string, context: LiveInputContext): LiveInputClassification {
  if (!hasCjk(content) && hasLatin(content)) {
    return classifyLatinInput(content, context);
  }

  const normalized = normalizeLiveInput(content);
  const reasons: string[] = [];
  const scores = {
    activity: 0,
    mood: 0,
  };

  if (!normalized.isMeaningful) {
    return {
      kind: 'mood',
      internalKind: 'standalone_mood',
      confidence: 'low',
      scores,
      reasons: ['empty_or_punct_only_default_to_mood'],
    };
  }

  const text = normalized.normalizedContent;
  const hasNonActivity = hasNonActivitySignal(text);

  if (hasNonActivity) {
    scores.mood += 3;
    reasons.push('matched_non_activity_signal');
    const relatedActivityId =
      context.recentActivity && context.recentActivity.isOngoing
        ? context.recentActivity.id
        : undefined;
    return {
      kind: 'mood',
      internalKind: 'standalone_mood',
      confidence: 'high',
      scores,
      reasons,
      containsMoodSignal: true,
      relatedActivityId,
    };
  }

  const hasActivity = hasActivitySignal(text);
  const hasDirectMood = hasMoodSignal(text);
  const hasOngoing = hasOngoingSignal(text);
  const hasStrongCompletion = hasStrongCompletionSignal(text);
  const hasWeakCompletion = hasWeakCompletionSignal(text);
  const hasActivityEvidence = hasActivity || hasOngoing || hasStrongCompletion;

  if (hasOngoing) {
    scores.activity += 2;
    reasons.push('matched_ongoing_signal');
  }

  if (hasStrongCompletion) {
    scores.activity += 2;
    reasons.push('matched_strong_completion_signal');
  }

  if (hasWeakCompletion) {
    scores.mood += 1;
    reasons.push('matched_weak_completion_signal');
  }

  if (hasActivity) {
    scores.activity += 3;
    reasons.push('matched_activity_signal');
  }

  if (hasDirectMood) {
    scores.mood += 2;
    reasons.push('matched_mood_signal');
  }

  const hasMood = hasDirectMood || hasWeakCompletion;

  if (text.length <= 3 && !hasActivityEvidence) {
    scores.mood += 1;
    reasons.push('short_ambiguous_bias_to_mood');
  }

  const recent = context.recentActivity;
  if (recent) {
    const referencesLastActivity = includesAny(text, ZH_LAST_ACTIVITY_REFERENCES) || hasContextKeywordOverlap(text, recent.content);
    const hasEvaluation = includesAny(text, ZH_EVALUATION_WORDS) || hasMood;
    const hasStrongNewActivity = containsNewActivitySignal(text);

    if (referencesLastActivity && hasEvaluation && !hasStrongNewActivity) {
      scores.mood += 3;
      reasons.push('context_bias_to_last_activity');
      return {
        kind: 'mood',
        internalKind: 'mood_about_last_activity',
        confidence: 'high',
        scores,
        reasons,
        containsMoodSignal: hasMood,
        relatedActivityId: recent.id,
      };
    }
  }

  if (hasActivityEvidence && hasMood) {
    reasons.push('activity_with_mood_detected');
    const extractedMood = getMoodKey(text);
    return {
      kind: 'activity',
      internalKind: 'activity_with_mood',
      confidence: 'high',
      scores,
      reasons,
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
      containsMoodSignal: false,
    };
  }

  reasons.push('ambiguous_default_to_mood');
  const relatedActivityId = getRelatedOngoingActivityId(context);
  return {
    kind: 'mood',
    internalKind: 'standalone_mood',
    confidence: getConfidence(scores.mood - scores.activity),
    scores,
    reasons,
    containsMoodSignal: hasMood,
    relatedActivityId,
  };
}
