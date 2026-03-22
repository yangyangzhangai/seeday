import {
  EN_ACTIVITY_PATTERNS,
  EN_ACTIVITY_VERBS,
  EN_FUTURE_OR_PLAN_PATTERNS,
  EN_MOOD_PATTERNS,
  EN_MOOD_WORDS,
  EN_NEGATED_OR_NOT_OCCURRED_PATTERNS,
  EN_STRONG_COMPLETION_PATTERNS,
} from '../liveInputRules.en';
import {
  IT_ACTIVITY_PATTERNS,
  IT_ACTIVITY_VERBS,
  IT_FUTURE_OR_PLAN_PATTERNS,
  IT_MOOD_PATTERNS,
  IT_MOOD_WORDS,
  IT_NEGATED_OR_NOT_OCCURRED_PATTERNS,
  IT_STRONG_COMPLETION_PATTERNS,
} from '../liveInputRules.it';

export type LatinLang = 'en' | 'it';

const LATIN_TOKEN_PATTERN = /[a-z\u00c0-\u017f]+(?:['’-][a-z\u00c0-\u017f]+)*/gi;

function tokenizeLatin(input: string): string[] {
  return input.toLowerCase().match(LATIN_TOKEN_PATTERN) ?? [];
}

function normalizeLatinSignal(signal: string): string {
  return (signal.toLowerCase().match(LATIN_TOKEN_PATTERN) ?? []).join(' ');
}

function buildLatinTextIndex(input: string): {
  normalized: string;
  tokenSet: Set<string>;
} {
  const tokens = tokenizeLatin(input);
  return {
    normalized: tokens.join(' '),
    tokenSet: new Set(tokens),
  };
}

function containsNormalizedLatinSignal(
  indexedText: { normalized: string; tokenSet: Set<string> },
  normalizedSignal: string,
): boolean {
  if (!normalizedSignal) {
    return false;
  }

  if (normalizedSignal.includes(' ')) {
    return indexedText.normalized.includes(normalizedSignal);
  }

  return indexedText.tokenSet.has(normalizedSignal);
}

export function containsLatinSignal(input: string, signal: string): boolean {
  return containsNormalizedLatinSignal(buildLatinTextIndex(input), normalizeLatinSignal(signal));
}

export function containsAnyLatinSignal(input: string, words: readonly string[]): boolean {
  const indexedText = buildLatinTextIndex(input);
  return words.some((word) => containsNormalizedLatinSignal(indexedText, normalizeLatinSignal(word)));
}

export function detectLatinLanguage(input: string): LatinLang {
  const lowered = input.toLowerCase();
  if (containsAnyLatinSignal(lowered, [
    'sono',
    'sto',
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
    'acqua',
    'bollire',
    'comprare',
    'verdure',
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

export function extractLatinKeywords(input: string): string[] {
  const tokens = tokenizeLatin(input).filter((token) => token.length >= 4);
  return Array.from(new Set(tokens));
}

export function hasLatinContextKeywordOverlap(text: string, contextText: string): boolean {
  const textTokens = extractLatinKeywords(text);
  if (textTokens.length === 0) {
    return false;
  }
  const contextTokens = new Set(extractLatinKeywords(contextText));
  return textTokens.some((token) => contextTokens.has(token));
}

export function extractLatinSignals(text: string): {
  lang: LatinLang;
  hasFuturePlan: boolean;
  hasNegatedOrNotOccurred: boolean;
  hasActivity: boolean;
  hasMood: boolean;
  hasStrongCompletion: boolean;
} {
  const lang = detectLatinLanguage(text);
  const activityVerbs = lang === 'it' ? IT_ACTIVITY_VERBS : EN_ACTIVITY_VERBS;
  const moodWords = lang === 'it' ? IT_MOOD_WORDS : EN_MOOD_WORDS;
  const moodPatterns = lang === 'it' ? IT_MOOD_PATTERNS : EN_MOOD_PATTERNS;
  const activityPatterns = lang === 'it' ? IT_ACTIVITY_PATTERNS : EN_ACTIVITY_PATTERNS;
  const completionPatterns = lang === 'it' ? IT_STRONG_COMPLETION_PATTERNS : EN_STRONG_COMPLETION_PATTERNS;
  const futurePatterns = lang === 'it' ? IT_FUTURE_OR_PLAN_PATTERNS : EN_FUTURE_OR_PLAN_PATTERNS;
  const negationPatterns = lang === 'it' ? IT_NEGATED_OR_NOT_OCCURRED_PATTERNS : EN_NEGATED_OR_NOT_OCCURRED_PATTERNS;

  return {
    lang,
    hasFuturePlan: futurePatterns.some((pattern) => pattern.test(text)),
    hasNegatedOrNotOccurred: negationPatterns.some((pattern) => pattern.test(text)),
    hasActivity: containsAnyLatinSignal(text, activityVerbs) || activityPatterns.some((pattern) => pattern.test(text)),
    hasMood: containsAnyLatinSignal(text, moodWords) || moodPatterns.some((pattern) => pattern.test(text)),
    hasStrongCompletion: completionPatterns.some((pattern) => pattern.test(text)),
  };
}
