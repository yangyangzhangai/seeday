// DOC-DEPS: LLM.md -> docs/ACTIVITY_LEXICON.md -> docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md
//
// Italian mood lexicon – single source of truth for all IT mood signals.
// Mirrors the structure of moodLexicon.zh.ts.
// Previously IT mood words lived only in liveInputRules.it.ts (IT_MOOD_WORDS,
// IT_MOOD_PATTERNS) with no activity→mood inference and no presence in mood.ts.

import type { MoodLexicon } from './types.js';

export const itMoodLexicon: MoodLexicon = {

  // ── Parole di umore esplicite → MoodKey ────────────────────────────────
  explicitMoodMap: [
    { pattern: /\b(felice|contento|contenta|entusiasta|allegro|allegra|euforico|euforica|gasato|gasata|felicissimo|felicissima|raggiante|di buon umore|in forma|positivo|positiva|ottimista)\b/i, mood: 'happy' },
    { pattern: /\b(calmo|calma|sereno|serena|rilassato|rilassata|tranquillo|tranquilla|in pace|rasserenato|rasserenata|equilibrato|equilibrata)\b/i, mood: 'calm' },
    { pattern: /\b(concentrato|concentrata|produttivo|produttiva|in forma|sul pezzo|focalizzato|focalizzata)\b/i, mood: 'focused' },
    { pattern: /\b(soddisfatto|soddisfatta|appagato|appagata|realizzato|realizzata|orgoglioso|orgogliosa|sollevato|sollevata)\b/i, mood: 'satisfied' },
    {
      pattern: /\b(stanco|stanca|esausto|esausta|stremato|stremata|scarico|scarica|a pezzi|sfinito|sfinita|distrutto|distrutta|cotto|cotta|spossato|spossata)\b/i,
      mood: 'tired',
    },
    {
      pattern: /\b(ansioso|ansiosa|stressato|stressata|nervoso|nervosa|preoccupato|preoccupata|agitato|agitata|in ansia|in paranoia|teso|tesa|in panico)\b/i,
      mood: 'anxious',
    },
    { pattern: /\b(annoiato|annoiata|stufo|stufa|noioso|noiosa|annoiatissimo|annoiatissima|che noia|monotono|monotona|mi annoio)\b/i, mood: 'bored' },
    {
      pattern: /\b(triste|arrabbiato|arrabbiata|frustrato|frustrata|confuso|confusa|abbattuto|abbattuta|depresso|depressa|di umore nero|giu di morale|a terra|demoralizzato|demoralizzata|deluso|delusa|svuotato|svuotata|senza energie|scazzato|scazzata|che schifo|emo)\b/i,
      mood: 'down',
    },
  ],

  // ── Attività → umore inferito ────────────────────────────────────────────
  activityMoodMap: [
    // happy: sport, uscite sociali, cibo
    {
      pattern: /\b(correndo|allenamento|palestra|yoga|nuotando|nuotato|pedalando|calcio|basket|tennis|trekking|escursione|camminata)\b/i,
      mood: 'happy',
    },
    {
      pattern: /\b(pranzo|cena|colazione|mangiando|cucinare|cucinando|aperitivo|brunch)\b/i,
      mood: 'happy',
    },
    {
      pattern: /\b(uscendo|festa|karaoke|amici|famiglia|film|concerto|mostra|museo|uscita)\b/i,
      mood: 'happy',
    },
    // satisfied: task completion
    {
      pattern: /\b(finito|completato|rilasciato|pubblicato|inviato|terminato|consegnato)\b/i,
      mood: 'satisfied',
    },
    // focused: deep work / study
    {
      pattern: /\b(studiando|lavorando|scrivendo|riunione|lezione|ufficio|codice|revisionando|ricercando|progettando)\b/i,
      mood: 'focused',
    },
    // tired: overwork, late night
    { pattern: /\b(straordinario|notte tarda|pendolare|pendolando|di corsa)\b/i, mood: 'tired' },
    // bored: waiting, idle
    { pattern: /\b(aspettando|coda|in coda|traffico|bloccato|bloccata|non ho niente da fare)\b/i, mood: 'bored' },
    // down: failures, errors
    { pattern: /\b(errore|fallito|fallita|bug|crash|rotto|rotta|bloccato|rifiutato)\b/i, mood: 'down' },
    // calm: leisure
    {
      pattern: /\b(meditazione|meditando|tè|caffè|passeggiata|bagno|podcast|musica|romanzo|leggendo per piacere)\b/i,
      mood: 'calm',
    },
  ],

  // ── Tutte le parole di umore ─────────────────────────────────────────────
  allMoodWords: [
    'felice', 'contento', 'contenta', 'entusiasta', 'allegro', 'allegra', 'euforico', 'euforica', 'gasato', 'gasata', 'felicissimo', 'felicissima', 'raggiante', 'di buon umore', 'in forma', 'positivo', 'positiva', 'ottimista',
    'calmo', 'calma', 'sereno', 'serena', 'rilassato', 'rilassata', 'tranquillo', 'tranquilla', 'in pace', 'rasserenato', 'rasserenata', 'equilibrato', 'equilibrata',
    'concentrato', 'concentrata', 'produttivo', 'produttiva', 'sul pezzo', 'focalizzato', 'focalizzata',
    'soddisfatto', 'soddisfatta', 'appagato', 'appagata', 'orgoglioso', 'orgogliosa', 'sollevato', 'sollevata',
    'stanco', 'stanca', 'esausto', 'esausta', 'stremato', 'stremata', 'scarico', 'scarica', 'sfinito', 'sfinita', 'distrutto', 'distrutta', 'cotto', 'cotta', 'spossato', 'spossata',
    'ansioso', 'ansiosa', 'stressato', 'stressata', 'nervoso', 'nervosa', 'preoccupato', 'preoccupata', 'agitato', 'agitata', 'in ansia', 'in paranoia', 'teso', 'tesa', 'in panico',
    'annoiato', 'annoiata', 'stufo', 'stufa', 'annoiatissimo', 'annoiatissima', 'che noia', 'monotono', 'monotona', 'mi annoio',
    'triste', 'arrabbiato', 'arrabbiata', 'frustrato', 'frustrata', 'confuso', 'confusa',
    'abbattuto', 'abbattuta', 'depresso', 'depressa', 'giu di morale', 'a terra', 'demoralizzato', 'demoralizzata', 'deluso', 'delusa', 'svuotato', 'svuotata', 'senza energie', 'scazzato', 'scazzata', 'che schifo',
    'emo',
    'sollevato', 'sollevata', 'sollievo', 'pesante', 'faticoso', 'bene', 'male', 'ok',
  ],

  // ── Pattern di frasi di umore ────────────────────────────────────────────
  moodSentencePatterns: [
    /\b(mi\s+sento|sono)\s+(molto\s+|troppo\s+|davvero\s+)?(stanco|stanca|stressato|stressata|ansioso|ansiosa|triste|felice|calmo|calma|arrabbiato|arrabbiata|esausto|esausta|sollevato|sollevata)\b/i,
    /\b(era|è\s+stata|è\s+stato|andata)\s+(stressante|pesante|ottima|bene|male)\b/i,
    /\bmi\s+ha\s+(stressato|stressata|confuso|confusa|stancato|stancata)\b/i,
    /\b(mi\s+sento|sono)\s+(in\s+ansia|giu\s+di\s+morale|a\s+terra|distrutto|distrutta|cotto|cotta)\b/i,
    /\b(che\s+ansia|che\s+noia)\b/i,
    /\b(mi\s+sento|sono)\s+(teso|tesa|spossato|spossata|svuotato|svuotata)\b/i,
    /\b(mi\s+sento|sono)\s+(molto\s+)?(raggiante|equilibrato|equilibrata)\b/i,
    /\b(mi\s+sento|sono)\s+(molto\s+|davvero\s+)?(bene|felice|contento|contenta|ottimista)\b/i,
    /\b(mi\s+sento|sono)\s+(molto\s+|davvero\s+)?(triste|scazzato|scazzata|in\s+panico)\b/i,
    /\b(oggi\s+)?(sono\s+)?(giu|a\s+pezzi|ko)\b/i,
    /\bmi\s+ha\s+dato\s+sollievo\b/i,
    /\b(mi\s+sento|sono)\s+(un\s+po'\s+|molto\s+)?(bene|male|scarico|scarica|sereno|serena)\b/i,
    /\b(è|e)\s+(molto\s+|davvero\s+)?(faticoso|pesante|stressante)\b/i,
  ],
};
