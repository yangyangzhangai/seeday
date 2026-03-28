// DOC-DEPS: LLM.md -> docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md -> src/features/chat/README.md

import { getActivityLexicon, getMoodLexicon } from './lexicon/getLexicon.js';
import { itActivityVerbData, itPlaceNouns } from './lexicon/activityLexicon.it.js';
import type { ItVerbEntry } from './lexicon/activityLexicon.it.js';

const itActivity = getActivityLexicon('it');
const itMood = getMoodLexicon('it');

function generateItVerbForms(entry: ItVerbEntry): string[] {
  const [infinitive, group, irregularParticipo, irregularGerundio, irregularPresent1sg] = entry;
  const stem = infinitive.slice(0, -3);
  const gerundio = irregularGerundio ?? (stem + (group === 'are' ? 'ando' : 'endo'));
  const participio = irregularParticipo ?? (stem + (group === 'are' ? 'ato' : group === 'ere' ? 'uto' : 'ito'));
  const present1sg = irregularPresent1sg ?? (stem + 'o');
  return [infinitive, gerundio, participio, present1sg, `sto ${gerundio}`, `ho ${participio}`];
}

const IT_ACTIVITY_VERB_FORMS = itActivityVerbData.flatMap(generateItVerbForms);

export const IT_PLACE_NOUNS: readonly string[] = itPlaceNouns;

export const IT_ACTIVITY_VERBS = Array.from(new Set([
  ...itActivity.strongPhrases,
  ...itActivity.verbs,
  ...IT_ACTIVITY_VERB_FORMS,
]));

export const IT_MOOD_WORDS = [...itMood.allMoodWords];

export const IT_MOOD_PATTERNS = [...itMood.moodSentencePatterns];

export const IT_ACTIVITY_PATTERNS = [...itActivity.phrasePatterns];

export const IT_STRONG_COMPLETION_PATTERNS = [
  /\b(ho\s+)?(finito|completato)\b/i,
  /\bappena\s+finito\b/i,
  /\b(ho\s+)?(chiuso|terminato)\s+(la\s+)?(riunione|chiamata|lezione|sessione)\b/i,
  /\b(ho\s+)?(inviato)\s+(il\s+)?(report|documento)\b/i,
  /\b(finalmente\s+)?(rilasciato|pubblicato|spedito|consegnato)\b/i,
  /\bho\s+finito\s+le\s+slide\b/i,
  /\b(ho\s+)?(consegnato|presentato)\s+(il\s+|la\s+)?(compito|progetto|relazione|tesi)\b/i,
  /\b(sono\s+uscito|sono\s+uscita)\s+(da|dall[' a])\s+(ufficio|riunione|palestra|scuola|lezione)\b/i,
  /\b(finalmente\s+)?(a\s+casa|tornato\s+a\s+casa|tornata\s+a\s+casa)\b/i,
];

export const IT_FUTURE_OR_PLAN_PATTERNS = [
  /\b(domani|dopo|pi[uù]\s+tardi|tra\s+poco|stasera|prossim[oa]|la\s+prossima\s+settimana)\b/i,
  /\b(voglio|vorrei|devo|andr[oò]|sto\s+per|andr[oò]\s+a|ho\s+intenzione\s+di|mi\s+serve|ho\s+bisogno\s+di)\b/i,
  /\b(pensavo\s+di|stavo\s+pensando\s+di)\b/i,
];

export const IT_NEGATED_OR_NOT_OCCURRED_PATTERNS = [
  /\b(non\s+sto|non\s+stavo)\s+(lavorando|studiando|correndo|camminando|facendo)\b/i,
  /\b(non\s+ho|non\s+sono\s+riuscit[oa]\s+a)\s+(lavorato|studiato|finito|iniziato|andato|andato)\b/i,
  /\b(nessun\s+progresso|non\s+ho\s+concluso\s+niente|non\s+ho\s+fatto\s+niente|non\s+ho\s+combinato\s+niente)\b/i,
  /\b(volevo|avevo\s+intenzione\s+di)\s+.+\s+ma\s+non\s+(ho|sono\s+riuscit[oa])\b/i,
  /\b(ho\s+saltato|ho\s+perso)\s+(la\s+)?(palestra|lezione|riunione|allenamento|corso)\b/i,
];

export const IT_SHORT_REPLY_PATTERNS = [
  /^(ok|va bene|bene|capito|ricevuto|perfetto|grazie|esatto|certo|giusto|ovvio|dai|sì|si|no)$/i,
];

export const IT_SHORT_ACTIVITY_SHELL_PATTERNS = [
  /^(bere|bevo|bollire|cucinare|cuocere|preparare|comprare|fare)\s+(acqua|riso|pranzo|cena|spesa|verdure|frutta|pasti?)$/i,
  /^(fare\s+la\s+spesa|preparare\s+i\s+pasti)$/i,
];

export const IT_LAST_ACTIVITY_REFERENCES = [
  'quello',
  'quella',
  'prima',
  'quella riunione',
  'riunione di prima',
  'quella chiamata',
  'quella lezione',
  'quel lavoro',
  'quella sessione',
  'la chiamata di prima',
  'quella cosa che ho fatto',
  'quella cosa',
  'quella corsa',
  'quell\'allenamento',
  'quella partita',
  'quel film',
  'quella serata',
  'quel meeting',
  'la lezione di prima',
  'l\'allenamento di prima',
  'poco fa',
  'appena adesso',
];
