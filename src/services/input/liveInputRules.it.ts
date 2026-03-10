// DOC-DEPS: LLM.md -> docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md -> src/features/chat/README.md

export const IT_ACTIVITY_VERBS = [
  'studio',
  'studiare',
  'studiando',
  'ho studiato',
  'lavoro',
  'lavorare',
  'lavorando',
  'ho lavorato',
  'riunione',
  'meeting',
  'corro',
  'correre',
  'correndo',
  'ho corso',
  'cammino',
  'camminare',
  'camminando',
  'scrivo',
  'scrivere',
  'scrivendo',
  'ho scritto',
  'allenamento',
  'palestra',
  'spesa',
  'ho comprato',
  'chiamata',
  'telefonata',
];

export const IT_MOOD_WORDS = [
  'stanco',
  'stanca',
  'stressato',
  'stressata',
  'ansioso',
  'ansiosa',
  'triste',
  'felice',
  'contento',
  'contenta',
  'calmo',
  'calma',
  'arrabbiato',
  'arrabbiata',
  'esausto',
  'esausta',
  'sollevato',
  'sollevata',
  'confuso',
  'confusa',
  'sollievo',
];

export const IT_MOOD_PATTERNS = [
  /\b(mi\s+sento|sono)\s+(molto\s+|troppo\s+|davvero\s+)?(stanco|stanca|stressato|stressata|ansioso|ansiosa|triste|felice|calmo|calma|arrabbiato|arrabbiata|esausto|esausta|sollevato|sollevata)\b/i,
  /\b(era|e\s+stata|e\s+stato|andata)\s+(stressante|pesante|ottima|bene|male)\b/i,
  /\bmi\s+ha\s+(stressato|stressata|confuso|confusa|stancato|stancata)\b/i,
  /\bmi\s+ha\s+dato\s+sollievo\b/i,
];

export const IT_ACTIVITY_PATTERNS = [
  /\b(sto|stavo)\s+(studiando|lavorando|correndo|camminando|scrivendo)\b/i,
  /\b(ho\s+appena\s+)?(fatto|finito)\s+(la\s+)?(riunione|chiamata|spesa|lezione|corsa)\b/i,
  /\b(sto\s+scrivendo|sto\s+lavorando\s+su)\s+(il\s+)?(report|documento|compito|codice)\b/i,
  /\b(in\s+ufficio|in\s+palestra|a\s+scuola)\b/i,
  /\b(in|alla)\s+riunione\b/i,
  /\b(videochiamata|chiamata)\b/i,
];

export const IT_STRONG_COMPLETION_PATTERNS = [
  /\b(ho\s+)?(finito|completato)\b/i,
  /\bappena\s+finito\b/i,
  /\b(ho\s+)?(chiuso|terminato)\s+(la\s+)?(riunione|chiamata|lezione|sessione)\b/i,
  /\b(ho\s+)?(inviato)\s+(il\s+)?(report|documento)\b/i,
];

export const IT_FUTURE_OR_PLAN_PATTERNS = [
  /\b(domani|dopo|piu\s+tardi|tra\s+poco|stasera|prossim[oa])\b/i,
  /\b(voglio|vorrei|devo|andr[oò]|sto\s+per|andr[oò]\s+a|ho\s+intenzione\s+di)\b/i,
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
