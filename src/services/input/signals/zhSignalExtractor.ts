import type { MoodKey } from '../../../lib/moodOptions';
import {
  ZH_ACTIVITY_OBJECTS,
  ZH_ACTIVITY_ONGOING_PATTERNS,
  ZH_ACTIVITY_SINGLE_VERB_PATTERNS,
  ZH_ACTIVITY_STRONG_PHRASES,
  ZH_ACTIVITY_VERBS,
  ZH_CONTEXT_ACTIVITY_KEYWORDS,
  ZH_FINISHING_PHRASES,
  ZH_FUTURE_OR_PLAN_PATTERNS,
  ZH_MOOD_KEYWORDS,
  ZH_MOOD_PATTERNS,
  ZH_MOOD_WORDS,
  ZH_NEGATED_OR_NOT_OCCURRED_PATTERNS,
  ZH_NEW_ACTIVITY_SWITCHES,
  ZH_PLACE_NOUNS,
  ZH_STANDALONE_ACTIVITY_NOUNS,
  ZH_STRONG_COMPLETION_PATTERNS,
  ZH_WEAK_COMPLETION_WORDS,
} from '../liveInputRules.zh';

function includesAny(input: string, words: string[]): boolean {
  return words.some((word) => input.includes(word));
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const ZH_SHORT_MOOD_TIME_ANCHOR = /(今天|明天|后天|待会|等下|一会|晚点|上午|中午|下午|晚上|刚刚|刚才|昨天|前天|下周|本周|这周|下个月|本月|\d{1,2}(?:[:：]\d{1,2}|点(?:\d{1,2}分?)?))/;

function getCompactSemanticLength(input: string): number {
  return input
    .replace(/\s+/g, '')
    .replace(/[，,。.!?！？；;、:：'"“”‘’`~\-]/g, '')
    .length;
}

function hasActivitySignal(input: string): boolean {
  const objectPattern = ZH_ACTIVITY_OBJECTS.map(escapeRegExp).join('|');
  const singleCharVerbPattern = ZH_ACTIVITY_VERBS
    .filter((verb) => verb.length === 1)
    .map(escapeRegExp)
    .join('|');

  const hasObjectVerbPair = includesAny(input, ZH_ACTIVITY_OBJECTS)
    && (
      ZH_ACTIVITY_VERBS.some((verb) => verb.length >= 2 && input.includes(verb))
      || new RegExp(`(${singleCharVerbPattern}).{0,2}(${objectPattern})`).test(input)
    );

  if (includesAny(input, ZH_ACTIVITY_STRONG_PHRASES)) return true;
  if (hasObjectVerbPair) return true;
  if (ZH_ACTIVITY_SINGLE_VERB_PATTERNS.some((pattern) => pattern.test(input))) return true;
  if (ZH_ACTIVITY_VERBS.some((verb) => verb.length >= 2 && input.includes(verb))) return true;

  // 短名词兜底：≤4字的纯名词输入（如"漫画"、"游戏"）隐含用户正在做该活动
  const compactLen = getCompactSemanticLength(input);
  if (compactLen >= 2 && compactLen <= 4) {
    const bare = input.replace(/[了中]$/, '');
    if (ZH_STANDALONE_ACTIVITY_NOUNS.some((noun) => bare === noun)) return true;
  }

  return false;
}

function hasMoodSignal(input: string): boolean {
  if (includesAny(input, ZH_MOOD_WORDS)) return true;
  return ZH_MOOD_PATTERNS.some((pattern) => pattern.test(input));
}

function detectFutureOrPlanned(input: string): boolean {
  return ZH_FUTURE_OR_PLAN_PATTERNS.some((pattern) => pattern.test(input));
}

function detectNegatedOrNotOccurred(input: string): boolean {
  return ZH_NEGATED_OR_NOT_OCCURRED_PATTERNS.some((pattern) => pattern.test(input));
}

function hasOngoingSignal(input: string): boolean {
  const hasOngoingShell = ZH_ACTIVITY_ONGOING_PATTERNS.some((pattern) => pattern.test(input));
  if (!hasOngoingShell) return false;
  return includesAny(input, ZH_ACTIVITY_OBJECTS)
    || ZH_ACTIVITY_VERBS.some((verb) => verb.length >= 2 && input.includes(verb));
}

function hasStrongCompletionSignal(input: string): boolean {
  const hasCompletionShell =
    includesAny(input, ZH_FINISHING_PHRASES)
    || ZH_STRONG_COMPLETION_PATTERNS.some((pattern) => pattern.test(input));

  if (!hasCompletionShell) {
    return false;
  }

  if (/^(搞定了?|完成了?|结束了?)$/.test(input)) {
    return true;
  }

  if (/(开完|写完|做完|吃完|忙完|通完|打完|改完).*/.test(input)) {
    return true;
  }

  return includesAny(input, ZH_ACTIVITY_OBJECTS)
    || ZH_ACTIVITY_VERBS.some((verb) => verb.length >= 2 && input.includes(verb))
    || ZH_ACTIVITY_SINGLE_VERB_PATTERNS.some((pattern) => pattern.test(input));
}

function hasWeakCompletionSignal(input: string): boolean {
  return includesAny(input, ZH_WEAK_COMPLETION_WORDS);
}

function detectGoToPlaceActivity(input: string): { matched: boolean; strengthened: boolean } {
  const hasPlace = includesAny(input, ZH_PLACE_NOUNS);
  if (!hasPlace) {
    return { matched: false, strengthened: false };
  }

  const hasGoVerb = /(去|到|回|来|逛逛|逛|跑去|赶去|直奔)/.test(input);
  if (!hasGoVerb) {
    return { matched: false, strengthened: false };
  }

  const hasPlaceGoStructure = new RegExp(
    `(去|到|回|来|逛逛|逛|跑去|赶去|直奔).{0,3}(${ZH_PLACE_NOUNS.map(escapeRegExp).join('|')})`,
  ).test(input);

  if (!hasPlaceGoStructure) {
    return { matched: false, strengthened: false };
  }

  return {
    matched: true,
    strengthened: /(刚|已经|了|回来)/.test(input),
  };
}

function shouldForceShortPureMood(input: string): boolean {
  if (getCompactSemanticLength(input) >= 6) {
    return false;
  }
  if (!hasMoodSignal(input)) {
    return false;
  }
  if (hasActivitySignal(input)) {
    return false;
  }
  if (detectFutureOrPlanned(input) || detectNegatedOrNotOccurred(input)) {
    return false;
  }
  if (ZH_SHORT_MOOD_TIME_ANCHOR.test(input)) {
    return false;
  }
  return true;
}

export function containsZhNewActivitySignal(input: string): boolean {
  if (includesAny(input, ['去洗澡', '去吃饭', '开始学习', '去运动', '去散步', '去健身房'])) {
    return true;
  }

  if (includesAny(input, ZH_NEW_ACTIVITY_SWITCHES) && includesAny(input, ZH_ACTIVITY_VERBS)) {
    return true;
  }

  return false;
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

export function hasZhContextKeywordOverlap(text: string, contextText: string): boolean {
  const currentTokens = extractActivityKeywords(text);
  if (currentTokens.length === 0) {
    return false;
  }
  const contextTokens = new Set(extractActivityKeywords(contextText));
  return currentTokens.some((token) => contextTokens.has(token));
}

export function resolveZhMoodKey(input: string): MoodKey | undefined {
  for (const rule of ZH_MOOD_KEYWORDS) {
    if (rule.pattern.test(input)) {
      return rule.mood;
    }
  }
  return undefined;
}

export interface ZhSignals {
  hasFutureOrPlanned: boolean;
  hasNegatedOrNotOccurred: boolean;
  hasShortPureMood: boolean;
  hasOngoing: boolean;
  hasStrongCompletion: boolean;
  goToPlaceDetection: { matched: boolean; strengthened: boolean };
  hasActivity: boolean;
  hasDirectMood: boolean;
  hasWeakCompletion: boolean;
  hasMood: boolean;
}

export function extractZhSignals(text: string): ZhSignals {
  const hasFutureOrPlanned = detectFutureOrPlanned(text);
  const hasNegatedOrNotOccurred = detectNegatedOrNotOccurred(text);
  const hasOngoing = hasOngoingSignal(text);
  const hasStrongCompletion = hasStrongCompletionSignal(text);
  const goToPlaceDetection = detectGoToPlaceActivity(text);
  const hasActivity = hasActivitySignal(text);
  const hasDirectMood = hasMoodSignal(text);
  const hasWeakCompletion = hasWeakCompletionSignal(text);

  return {
    hasFutureOrPlanned,
    hasNegatedOrNotOccurred,
    hasShortPureMood: shouldForceShortPureMood(text),
    hasOngoing,
    hasStrongCompletion,
    goToPlaceDetection,
    hasActivity,
    hasDirectMood,
    hasWeakCompletion,
    hasMood: hasDirectMood || hasWeakCompletion,
  };
}
