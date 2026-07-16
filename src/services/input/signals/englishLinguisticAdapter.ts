// DOC-DEPS: LLM.md -> docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md -> docs/ACTIVITY_LEXICON.md
import nlp from 'compromise';

export interface EnglishLinguisticSignals {
  hasPhrasalVerb: boolean;
  phrasalVerbs: string[];
}

export function extractEnglishLinguisticSignals(input: string): EnglishLinguisticSignals {
  const document = nlp(input);
  const phrasalVerbs = document
    .match('#Verb #Particle')
    .out('array')
    .map((phrase: string) => phrase.trim().toLowerCase())
    .filter(Boolean);

  return {
    hasPhrasalVerb: phrasalVerbs.length > 0,
    phrasalVerbs: Array.from(new Set(phrasalVerbs)),
  };
}

