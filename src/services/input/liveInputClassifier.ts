// DOC-DEPS: LLM.md -> docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md -> src/features/chat/README.md
import {
  ZH_ACTIVITY_OBJECTS,
  ZH_ACTIVITY_STRONG_PHRASES,
  ZH_ACTIVITY_VERBS,
  ZH_EVALUATION_WORDS,
  ZH_FINISHING_PHRASES,
  ZH_LAST_ACTIVITY_REFERENCES,
  ZH_MOOD_KEYWORDS,
  ZH_MOOD_PATTERNS,
  ZH_MOOD_WORDS,
  ZH_NEW_ACTIVITY_SWITCHES,
  ZH_PUNCT_ONLY,
  ZH_TRAILING_PARTICLES,
} from './liveInputRules.zh';
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

function hasActivitySignal(input: string): boolean {
  if (includesAny(input, ZH_ACTIVITY_STRONG_PHRASES)) return true;
  if (includesAny(input, ZH_ACTIVITY_OBJECTS) && includesAny(input, ZH_ACTIVITY_VERBS)) return true;
  return includesAny(input, ZH_ACTIVITY_VERBS);
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
  if (includesAny(input, ['去洗澡', '去吃饭', '开始学习', '去运动', '去散步'])) {
    return true;
  }

  if (includesAny(input, ZH_NEW_ACTIVITY_SWITCHES) && includesAny(input, ZH_ACTIVITY_VERBS)) {
    return true;
  }

  return false;
}

function getConfidence(diff: number): LiveInputConfidence {
  if (diff >= 3) return 'high';
  if (diff >= 1) return 'medium';
  return 'low';
}

export function classifyLiveInput(content: string, context: LiveInputContext): LiveInputClassification {
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
  const hasActivity = hasActivitySignal(text);
  const hasMood = hasMoodSignal(text);

  if (hasActivity) {
    scores.activity += 3;
    reasons.push('matched_activity_signal');
  }

  if (hasMood) {
    scores.mood += 2;
    reasons.push('matched_mood_signal');
  }

  if (text.length <= 3 && !hasActivity) {
    scores.mood += 1;
    reasons.push('short_ambiguous_bias_to_mood');
  }

  const recent = context.recentActivity;
  if (recent) {
    const referencesLastActivity =
      includesAny(text, ZH_LAST_ACTIVITY_REFERENCES) ||
      includesAny(text, ZH_FINISHING_PHRASES) ||
      text.includes(recent.content);
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

  if (hasActivity && hasMood) {
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
  return {
    kind: 'mood',
    internalKind: 'standalone_mood',
    confidence: getConfidence(scores.mood - scores.activity),
    scores,
    reasons,
    containsMoodSignal: hasMood,
  };
}
