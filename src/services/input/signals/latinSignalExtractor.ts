import {
  EN_ACTIVITY_PATTERNS,
  EN_ACTIVITY_VERBS,
  EN_FUTURE_OR_PLAN_PATTERNS,
  EN_MOOD_PATTERNS,
  EN_MOOD_WORDS,
  EN_NEGATED_OR_NOT_OCCURRED_PATTERNS,
  EN_PLACE_NOUNS,
  EN_STRONG_COMPLETION_PATTERNS,
} from '../liveInputRules.en.js';
import {
  IT_ACTIVITY_PATTERNS,
  IT_ACTIVITY_VERBS,
  IT_FUTURE_OR_PLAN_PATTERNS,
  IT_MOOD_PATTERNS,
  IT_MOOD_WORDS,
  IT_NEGATED_OR_NOT_OCCURRED_PATTERNS,
  IT_PLACE_NOUNS,
  IT_STRONG_COMPLETION_PATTERNS,
} from '../liveInputRules.it.js';

export type LatinLang = 'en' | 'it';

const LATIN_TOKEN_PATTERN = /[a-z\u00c0-\u017f]+(?:['\u2019][a-z\u00c0-\u017f]+)*/gi;
const LATIN_CONTEXT_ALIASES: Record<string, string[]> = {
  film: ['movie'],
  gym: ['workout', 'training', 'exercise'],
  movie: ['film'],
  training: ['gym', 'workout', 'exercise'],
  workout: ['gym', 'training', 'exercise'],
};

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
  // Words that are exclusively or strongly Italian (never/rarely appear in English)
  // Excluded intentionally: film, slide, email, mail, podcast, museo, serie —
  // these are shared with English and would cause false Italian detection.
  if (containsAnyLatinSignal(lowered, [
    'sono',
    'sto',
    'stanco',
    'stanca',
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
    'presentazione',
    'guidando',
    'metro',
    'autobus',
    'treno',
    'spesa',
    'acqua',
    'bollire',
     'comprare',
      'cercare',
      'tracciare',
      'pagamento',
      'bonifico',
      'verificare',
      'reimpostare',
      'disconnettersi',
      'identita',
      'autenticazione',
      'verdure',
      'pulizie',
    'piatti',
    'nuotando',
    'pedalando',
    'calcio',
    'pallavolo',
    'concerto',
    'mostra',
    'uscendo',
    'incontrando',
    'famiglia',
    'amici',
    'stressato',
    'stressata',
    'ansioso',
    'ansiosa',
    'annoiato',
    'annoiata',
    'stufo',
    'stufa',
    'contento',
    'contenta',
    'arrabbiato',
    'arrabbiata',
    'stanco',
    'stanca',
    'esausto',
    'esausta',
    'felice',
    'triste',
    'soddisfatto',
    'soddisfatta',
    'concentrato',
    'concentrata',
    'motivato',
    'motivata',
    'rilassato',
    'rilassata',
    'deluso',
    'delusa',
    'pallavolo',
    'arrampicata',
    'giardinaggio',
    'fisioterapia',
    'ripetizioni',
    'colloquio',
    'volontariato',
    'allenandomi',
    'flessioni',
    'addominali',
    // Generated verb forms — present-1sg (unambiguous Italian)
    'vado',
    'faccio',
    'mangio',
    'dormo',
    'corro',
    'cucino',
    'disegno',
    'ballo',
    'suono',
    'nuoto',
    'pedalando',
    'sciando',
    // Generated verb forms — gerundio (unambiguous Italian)
    'mangiando',
    'cucinando',
    'dormendo',
    'correndo',
    'disegnando',
    'ballando',
    'cantando',
    'suonando',
    'nuotando',
    // Generated verb forms — participio (unambiguous Italian)
    'mangiato',
    'dormito',
    'cucinato',
    'disegnato',
    'ballato',
    'suonato',
    'nuotato',
    'fatto',
    'visto',
  ])) {
    return 'it';
  }
  return 'en';
}

export function extractLatinKeywords(input: string): string[] {
  const tokens = tokenizeLatin(input)
    .filter((token) => token.length >= 3)
    .flatMap((token) => [token, ...(LATIN_CONTEXT_ALIASES[token] ?? [])]);
  return Array.from(new Set(tokens));
}

function commonPrefixLength(a: string, b: string): number {
  const limit = Math.min(a.length, b.length);
  let idx = 0;
  while (idx < limit && a[idx] === b[idx]) idx += 1;
  return idx;
}

function areLatinKeywordsRelated(a: string, b: string): boolean {
  if (a === b) {
    return true;
  }

  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length >= 5 && longer.startsWith(shorter)) {
    return true;
  }

  return commonPrefixLength(a, b) >= 6;
}

export function hasLatinContextKeywordOverlap(text: string, contextText: string): boolean {
  const textTokens = extractLatinKeywords(text);
  if (textTokens.length === 0) {
    return false;
  }
  const contextTokens = extractLatinKeywords(contextText);
  return textTokens.some((token) => contextTokens.some((contextToken) => areLatinKeywordsRelated(token, contextToken)));
}

function hasEnGoToPlace(text: string): boolean {
  const lowerText = text.toLowerCase();
  const hasPlace = EN_PLACE_NOUNS.some((place) => lowerText.includes(place));
  if (!hasPlace) return false;
  return /\b(went\s+to|at\s+the|got\s+to|arrived\s+at|headed\s+to|got\s+back\s+from|back\s+from|just\s+got\s+to)\b/i.test(lowerText);
}

function hasItGoToPlace(text: string): boolean {
  const lowerText = text.toLowerCase();
  const hasPlace = IT_PLACE_NOUNS.some((place) => lowerText.includes(place));
  if (!hasPlace) return false;
  return /\b(sono\s+andato|sono\s+andata|vado|sto\s+andando|sono\s+(al|alla|in)|mi\s+trovo\s+(al|alla|in))\b/i.test(lowerText);
}

export function extractLatinSignals(text: string): {
  lang: LatinLang;
  hasFuturePlan: boolean;
  hasNegatedOrNotOccurred: boolean;
  hasActivityLexicon: boolean;
  hasActivityPattern: boolean;
  hasActivity: boolean;
  hasMoodLexicon: boolean;
  hasMoodPattern: boolean;
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
  const hasActivityLexicon = containsAnyLatinSignal(text, activityVerbs);
  const hasActivityPattern = activityPatterns.some((pattern) => pattern.test(text));
  const hasGoToPlace = lang === 'it' ? hasItGoToPlace(text) : hasEnGoToPlace(text);
  const hasMoodLexicon = containsAnyLatinSignal(text, moodWords);
  const hasMoodPattern = moodPatterns.some((pattern) => pattern.test(text));

  return {
    lang,
    hasFuturePlan: futurePatterns.some((pattern) => pattern.test(text)),
    hasNegatedOrNotOccurred: negationPatterns.some((pattern) => pattern.test(text)),
    hasActivityLexicon,
    hasActivityPattern,
    hasActivity: hasActivityLexicon || hasActivityPattern || hasGoToPlace,
    hasMoodLexicon,
    hasMoodPattern,
    hasMood: hasMoodLexicon || hasMoodPattern,
    hasStrongCompletion: completionPatterns.some((pattern) => pattern.test(text)),
  };
}
