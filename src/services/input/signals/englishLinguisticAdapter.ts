// DOC-DEPS: LLM.md -> docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md -> docs/ACTIVITY_LEXICON.md
import nlp from 'compromise/two';

export type EnglishActivityGrammarKind =
  | 'phrasal_verb'
  | 'motion_destination'
  | 'action_object'
  | 'location_phrase'
  | 'bare_noun_phrase';

export interface EnglishLinguisticSignals {
  hasActivityGrammar: boolean;
  activityGrammarKind?: EnglishActivityGrammarKind;
  activityTokens: string[];
  hasMentalState: boolean;
  mentalStateTokens: string[];
  hasNegation: boolean;
  hasFutureConstruction: boolean;
}

type EnglishTerm = {
  text: string;
  normal: string;
  root?: string;
  tags?: string[];
};

type EnglishSentence = {
  terms?: EnglishTerm[];
};

const MENTAL_STATE_ROOTS = new Set([
  'dread', 'dream', 'enjoy', 'fear', 'feel', 'hate', 'hope', 'imagine',
  'like', 'love', 'miss', 'prefer', 'regret', 'remember', 'remind',
  'think', 'wonder', 'worry', 'wish',
]);

const MOVEMENT_ROOTS = new Set([
  'arrive', 'come', 'commute', 'cycle', 'drive', 'fly', 'get', 'go',
  'head', 'hike', 'move', 'return', 'ride', 'run', 'travel', 'visit', 'walk',
]);

const DESTINATION_PATTERNS = [
  '#Verb (to|into|toward|towards) #Determiner? (#Adjective|#Noun)+',
  '#Verb (at|in) #Determiner? (#Adjective|#Noun)+',
  '#Verb #Particle? from #Determiner? (#Adjective|#Noun)+',
];

const ACTION_OBJECT_PATTERN = '#Verb #Determiner? (#Possessive|#Adjective|#Noun)+';
const LOCATION_PHRASE_PATTERN = '^(at|in) #Determiner? (#Possessive|#Adjective|#Noun)+$';

function getTerms(document: ReturnType<typeof nlp>): EnglishTerm[] {
  document.compute('root');
  const sentences = document.json() as unknown as EnglishSentence[];
  return sentences.flatMap((sentence) => sentence.terms ?? []);
}

function hasTag(term: EnglishTerm, tag: string): boolean {
  return term.tags?.includes(tag) ?? false;
}

function getPrimaryVerbRoot(terms: EnglishTerm[]): string | undefined {
  const primaryVerb = terms.find((term) => (
    hasTag(term, 'Verb')
    && !hasTag(term, 'Auxiliary')
    && !hasTag(term, 'Copula')
    && !hasTag(term, 'Modal')
  ));
  return primaryVerb?.root ?? primaryVerb?.normal;
}

function getMatchTokens(document: ReturnType<typeof nlp>, pattern: string): string[] {
  return document
    .match(pattern)
    .out('array')
    .map((value: string) => value.trim().toLowerCase())
    .filter(Boolean);
}

function isBareNounPhrase(terms: EnglishTerm[]): boolean {
  if (terms.length === 0 || terms.length > 4) return false;
  if (terms.some((term) => hasTag(term, 'Verb'))) return false;
  if (!terms.some((term) => hasTag(term, 'Noun'))) return false;
  return terms.every((term) => (
    hasTag(term, 'Noun')
    || hasTag(term, 'Adjective')
    || hasTag(term, 'Determiner')
    || hasTag(term, 'Possessive')
  ));
}

function selectActivityGrammar(
  document: ReturnType<typeof nlp>,
  terms: EnglishTerm[],
  primaryVerbRoot?: string,
): { kind?: EnglishActivityGrammarKind; tokens: string[] } {
  const phrasalVerbs = getMatchTokens(document, '#Verb #Particle');
  const destinations = DESTINATION_PATTERNS.flatMap((pattern) => getMatchTokens(document, pattern));
  if (destinations.length > 0 && primaryVerbRoot && MOVEMENT_ROOTS.has(primaryVerbRoot)) {
    return { kind: 'motion_destination', tokens: destinations };
  }

  const actionObjects = getMatchTokens(document, ACTION_OBJECT_PATTERN);
  if (actionObjects.length > 0 && primaryVerbRoot) {
    return { kind: 'action_object', tokens: actionObjects };
  }

  if (phrasalVerbs.length > 0) {
    return { kind: 'phrasal_verb', tokens: phrasalVerbs };
  }

  const locations = getMatchTokens(document, LOCATION_PHRASE_PATTERN);
  if (locations.length > 0) {
    return { kind: 'location_phrase', tokens: locations };
  }

  if (isBareNounPhrase(terms)) {
    return { kind: 'bare_noun_phrase', tokens: [document.text().toLowerCase()] };
  }

  return { tokens: [] };
}

export function extractEnglishLinguisticSignals(input: string): EnglishLinguisticSignals {
  const document = nlp(input);
  const terms = getTerms(document);
  const primaryVerbRoot = getPrimaryVerbRoot(terms);
  const hasMentalState = Boolean(primaryVerbRoot && MENTAL_STATE_ROOTS.has(primaryVerbRoot));
  const grammar = hasMentalState
    ? { tokens: [] }
    : selectActivityGrammar(document, terms, primaryVerbRoot);

  return {
    hasActivityGrammar: Boolean(grammar.kind),
    activityGrammarKind: grammar.kind,
    activityTokens: Array.from(new Set(grammar.tokens)),
    hasMentalState,
    mentalStateTokens: hasMentalState && primaryVerbRoot ? [primaryVerbRoot] : [],
    hasNegation: document.match('#Negative').found,
    hasFutureConstruction: document.has('will') || document.match('going to #Verb').found,
  };
}

