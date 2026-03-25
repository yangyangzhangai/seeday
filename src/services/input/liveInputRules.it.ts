// DOC-DEPS: LLM.md -> docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md -> src/features/chat/README.md

import { getActivityLexicon, getMoodLexicon } from './lexicon/getLexicon.js';

const itActivity = getActivityLexicon('it');
const itMood = getMoodLexicon('it');

export const IT_ACTIVITY_VERBS = Array.from(new Set([...itActivity.strongPhrases, ...itActivity.verbs]));

export const IT_MOOD_WORDS = [...itMood.allMoodWords];

export const IT_MOOD_PATTERNS = [...itMood.moodSentencePatterns];

export const IT_ACTIVITY_PATTERNS = [
  /\b(sto|stavo)\s+(studiando|lavorando|correndo|camminando|scrivendo)\b/i,
  /\b(sto|stavo)\s+(revisionando|rispondendo|preparando|aggiornando|debuggando)\b/i,
  /\b(studio|sto\s+studiando|ripasso|sto\s+ripassando|imparo|sto\s+imparando)\s+(?!come\s+fare\b)([a-z\u00c0-\u017f][a-z\u00c0-\u017f0-9-]*(\s+[a-z\u00c0-\u017f][a-z\u00c0-\u017f0-9-]*){0,3})\b/i,
  /\b(revisiono|sto\s+revisionando|rispondo|sto\s+rispondendo|preparo|sto\s+preparando|aggiorno|sto\s+aggiornando)\s+(a|il|la|alle|ai)?\s*(email|mail|presentazione|slide|roadmap|report|documento|ticket|codice)\b/i,
  /\b(ho\s+appena\s+)?(fatto|finito)\s+(la\s+)?(riunione|chiamata|spesa|lezione|corsa)\b/i,
  /\b(sto\s+scrivendo|sto\s+lavorando\s+su)\s+(il\s+)?(report|documento|compito|codice)\b/i,
  /\b(ho\s+appena\s+)?(pubblicato|rilasciato|inviato)\s+(una\s+|il\s+)?(correzione|feature|aggiornamento|report|documento)\b/i,
  /\b(sto|stavo)\s+(guidando|prendendo)\s+(la\s+)?(macchina|metro|autobus|treno|taxi)\b/i,
  /\b(sono|sto)\s+(in\s+)?(metro|autobus|treno|macchina|ufficio|palestra|supermercato)\b/i,
  /\b(sto|ho\s+)?(facendo|fatto|finito)\s+(la\s+)?(spesa|lavatrice|pulizie|cena|pranzo|colazione)\b/i,
  /\b(sto|ho\s+)?(lavando|lavato)\s+(i\s+)?piatti\b/i,
  /\b(sto|ho\s+)?(nuotando|nuotato|pedalando|pedalato|camminando|fatto\s+trekking|fatto\s+yoga)\b/i,
  /\b(gioco|sto\s+giocando|ho\s+giocato)\s+(a\s+)?(calcio|basket|tennis|badminton|pallavolo)\b/i,
  /\b(sto|ho\s+)?(guardando|visto)\s+(un\s+)?(film|serie|streaming)\b/i,
  /\b(sto|ho\s+)?(ascoltando|ascoltato)\s+(un\s+)?podcast\b/i,
  /\b(sto|ho\s+)?(uscendo|uscito|incontrando|incontrato)\s+(con\s+)?(amici|famiglia)\b/i,
  /\b(sono\s+andato|vado|sto\s+andando)\s+(al\s+|alla\s+)?(concerto|mostra|museo|bar)\b/i,
  /\b(karaoke|giochi\s+da\s+tavolo|serata\s+giochi)\b/i,
  /\b(chatto|sto\s+chattando|chiacchiero|sto\s+chiacchierando)\s+(con\s+.+)?\b/i,
  /\b(prendo|ho\s+preso|sto\s+prendendo|faccio|ho\s+fatto)\s+(colazione|pranzo|cena)\b/i,
  /\b(guardo|sto\s+guardando|ho\s+guardato)\s+(anime|serie|film|notizie)\b/i,
  /\b(leggo|sto\s+leggendo|ho\s+letto)\s+(manga|romanzo|libro|giornale|articolo|articoli|notizie)\b/i,
  /\b(scrivo|sto\s+scrivendo|ho\s+scritto)\s+(il\s+)?(diario|resoconto|appunti)\b/i,
  /\b(prendo|sto\s+prendendo|ho\s+preso)\s+(appunti|note)\b/i,
  /\b(visita\s+medica|dal\s+dentista|visita\s+dal\s+dentista)\b/i,
  /\b(pago|sto\s+pagando|ho\s+pagato)\s+(le\s+)?(bollette|utenze|affitto)\b/i,
  /\b(videogioco|sto\s+giocando|ho\s+giocato)\b/i,
  /\b(in\s+ufficio|in\s+palestra|a\s+scuola)\b/i,
  /\b(in|alla)\s+riunione\b/i,
  /\b(videochiamata|chiamata)\b/i,
];

export const IT_STRONG_COMPLETION_PATTERNS = [
  /\b(ho\s+)?(finito|completato)\b/i,
  /\bappena\s+finito\b/i,
  /\b(ho\s+)?(chiuso|terminato)\s+(la\s+)?(riunione|chiamata|lezione|sessione)\b/i,
  /\b(ho\s+)?(inviato)\s+(il\s+)?(report|documento)\b/i,
  /\b(finalmente\s+)?(rilasciato|pubblicato|spedito)\b/i,
  /\bho\s+finito\s+le\s+slide\b/i,
];

export const IT_FUTURE_OR_PLAN_PATTERNS = [
  /\b(domani|dopo|piu\s+tardi|tra\s+poco|stasera|prossim[oa])\b/i,
  /\b(voglio|vorrei|devo|andr[oò]|sto\s+per|andr[oò]\s+a|ho\s+intenzione\s+di)\b/i,
];

export const IT_NEGATED_OR_NOT_OCCURRED_PATTERNS = [
  /\b(non\s+sto|non\s+stavo)\s+(lavorando|studiando|correndo|camminando)\b/i,
  /\b(non\s+ho|non\s+sono\s+riuscit[oa]\s+a)\s+(lavorato|studiato|finito|iniziato|andato)\b/i,
  /\b(nessun\s+progresso|non\s+ho\s+concluso\s+niente)\b/i,
  /\b(volevo|avevo\s+intenzione\s+di)\s+.+\s+ma\s+non\s+(ho|sono\s+riuscit[oa])\b/i,
];

export const IT_SHORT_REPLY_PATTERNS = [
  /^(ok|va bene|bene|capito|ricevuto|perfetto|grazie)$/i,
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
];
