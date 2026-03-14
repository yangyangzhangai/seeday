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
  ZH_NEGATED_OR_NOT_OCCURRED_PATTERNS,
  ZH_MOOD_KEYWORDS,
  ZH_MOOD_PATTERNS,
  ZH_MOOD_WORDS,
  ZH_NEW_ACTIVITY_SWITCHES,
  ZH_PLACE_NOUNS,
  ZH_FUTURE_OR_PLAN_PATTERNS,
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
  LiveEvidence,
  LiveInputClassification,
  LiveInputConfidence,
  LiveInputContext,
  LiveInputScore,
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

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
    'ripasso',
    'finanza',
    'aziendale',
    'pranzo',
    'cena',
    'colazione',
     'chatto',
     'chiacchiero',
      'leggo',
      'leggendo',
      'giornale',
      'notizie',
      'articolo',
      'diario',
      'appunti',
      'guardo',
      'romanzo',
    'revisionando',
    'rispondendo',
    'preparando',
    'aggiornando',
    'rilasciato',
    'pubblicato',
    'inviato',
    'slide',
    'presentazione',
    'mail',
    'email',
    'guidando',
    'metro',
    'autobus',
    'treno',
    'spesa',
    'pulizie',
    'piatti',
    'nuotando',
    'pedalando',
    'calcio',
    'basket',
    'pallavolo',
    'film',
    'serie',
    'concerto',
    'mostra',
    'museo',
    'podcast',
    'uscendo',
    'incontrando',
    'famiglia',
    'amici',
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

const ZH_SHORT_MOOD_TIME_ANCHOR = /(今天|明天|后天|待会|等下|一会|晚点|上午|中午|下午|晚上|刚刚|刚才|昨天|前天|下周|本周|这周|下个月|本月|\d{1,2}(?:[:：]\d{1,2}|点(?:\d{1,2}分?)?))/;

function getCompactSemanticLength(input: string): number {
  return input
    .replace(/\s+/g, '')
    .replace(/[，,。.!?！？；;、:：'"“”‘’`~\-]/g, '')
    .length;
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

function buildScoresFromEvidence(evidence: LiveEvidence[]): LiveInputScore {
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

function buildReasonsFromEvidence(evidence: LiveEvidence[]): string[] {
  return evidence.map((item) => item.reasonCode);
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

  const hasActivity = includesAny(text, activityVerbs) || activityPatterns.some((pattern) => pattern.test(text));
  const hasMood = includesAny(text, moodWords) || moodPatterns.some((pattern) => pattern.test(text));
  const hasStrongCompletion = completionPatterns.some((pattern) => pattern.test(text));

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

  if (hasActivity && hasMood) {
    return {
      kind: 'activity',
      internalKind: 'activity_with_mood',
      confidence: 'high',
      scores,
      reasons: [...reasons, 'activity_with_mood_detected'],
      evidence,
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
    relatedActivityId: getRelatedOngoingActivityId(context),
  };
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
  return ZH_ACTIVITY_VERBS.some((verb) => verb.length >= 2 && input.includes(verb));
}

function detectActivityCompletion(input: string): boolean {
  return hasStrongCompletionSignal(input);
}

function detectActivityOngoing(input: string): boolean {
  return hasOngoingSignal(input);
}

function detectLexiconActivity(input: string): boolean {
  return hasActivitySignal(input);
}

function detectFutureOrPlanned(input: string): boolean {
  return ZH_FUTURE_OR_PLAN_PATTERNS.some((pattern) => pattern.test(input));
}

function detectNegatedOrNotOccurred(input: string): boolean {
  return ZH_NEGATED_OR_NOT_OCCURRED_PATTERNS.some((pattern) => pattern.test(input));
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

function hasMoodSignal(input: string): boolean {
  if (includesAny(input, ZH_MOOD_WORDS)) return true;
  return ZH_MOOD_PATTERNS.some((pattern) => pattern.test(input));
}

function endsWithMoodSignal(input: string): boolean {
  const trimmed = input.replace(/[啊呀呢吧嘛哦哈了的]+$/, '');
  const tail = trimmed.slice(-4);
  return hasMoodSignal(tail);
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
  const hasFutureOrPlanned = detectFutureOrPlanned(text);
  if (hasFutureOrPlanned) {
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

  const hasNegatedOrNotOccurred = detectNegatedOrNotOccurred(text);
  if (hasNegatedOrNotOccurred) {
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

  if (shouldForceShortPureMood(text)) {
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

  const hasOngoing = detectActivityOngoing(text);
  const hasStrongCompletion = detectActivityCompletion(text);
  const goToPlaceDetection = detectGoToPlaceActivity(text);
  const hasGoToPlace = goToPlaceDetection.matched;
  const hasActivity = detectLexiconActivity(text);
  const hasDirectMood = hasMoodSignal(text);
  const hasWeakCompletion = hasWeakCompletionSignal(text);
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

  const hasMood = hasDirectMood || hasWeakCompletion;

  const recent = context.recentActivity;
  if (recent) {
    const referencesLastActivity = includesAny(text, ZH_LAST_ACTIVITY_REFERENCES) || hasContextKeywordOverlap(text, recent.content);
    const hasEvaluation = includesAny(text, ZH_EVALUATION_WORDS) || hasMood;
    const hasStrongNewActivity = containsNewActivitySignal(text);

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

  if (hasActivityEvidence && hasMood) {
    const extractedMood = getMoodKey(text);
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

  const relatedActivityId = getRelatedOngoingActivityId(context);
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
