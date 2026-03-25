// DOC-DEPS: LLM.md -> docs/ACTIVITY_LEXICON.md -> docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md
//
// Italian mood lexicon – single source of truth for all IT mood signals.
// Mirrors the structure of moodLexicon.zh.ts.
// Previously IT mood words lived only in liveInputRules.it.ts (IT_MOOD_WORDS,
// IT_MOOD_PATTERNS) with no activity→mood inference and no presence in mood.ts.

import type { MoodLexicon } from './types.js';

export const itMoodLexicon: MoodLexicon = {

  // ── Parole di umore esplicite → MoodKey ────────────────────────────────
  // Nota: si usano classi di caratteri [oò], [aà] ecc. per coprire sia input
  // con accento sia senza accento (comune su tastiere mobili).
  explicitMoodMap: [
    { pattern: /\b(felice|contento|contenta|entusiasta|allegro|allegra|euforico|euforica|gasato|gasata|carico|carica|gioioso|gioiosa|su\s+di\s+giri|in\s+vena|felicissimo|felicissima|raggiante|di\s+buon\s+umore|positivo|positiva|ottimista|al\s+settimo\s+cielo)\b/i, mood: 'happy' },
    { pattern: /\b(calmo|calma|sereno|serena|rilassato|rilassata|tranquillo|tranquilla|disteso|distesa|placido|placida|in\s+pace|a\s+posto|rasserenato|rasserenata|equilibrato|equilibrata)\b/i, mood: 'calm' },
    { pattern: /\b(concentrato|concentrata|produttivo|produttiva|motivato|motivata|determinato|determinata|deciso|decisa|ispirato|ispirata|sul\s+pezzo|focalizzato|focalizzata|in\s+forma)\b/i, mood: 'focused' },
    { pattern: /\b(soddisfatto|soddisfatta|appagato|appagata|realizzato|realizzata|fiero|fiera|gratificato|gratificata|orgoglioso|orgogliosa|sollevato|sollevata)\b/i, mood: 'satisfied' },
    {
      pattern: /\b(stanco|stanca|esausto|esausta|stremato|stremata|scarico|scarica|assonnato|assonnata|intontito|intontita|svogliato|svogliata|spento|spenta|senza\s+forze|a\s+pezzi|sfinito|sfinita|distrutto|distrutta|cotto|cotta|spossato|spossata|morto|morta|ko|k\.o\.)\b/i,
      mood: 'tired',
    },
    {
      pattern: /\b(ansioso|ansiosa|stressato|stressata|nervoso|nervosa|preoccupato|preoccupata|agitato|agitata|travolto|travolta|sopraffatto|sopraffatta|sotto\s+pressione|in\s+apprensione|in\s+ansia|in\s+paranoia|teso|tesa|in\s+panico|in\s+palla)\b/i,
      mood: 'anxious',
    },
    { pattern: /\b(annoiato|annoiata|stufo|stufa|apatico|apatica|noioso|noiosa|annoiatissimo|annoiatissima|che\s+noia|che\s+palle|monotono|monotona|mi\s+annoio)\b/i, mood: 'bored' },
    {
      pattern: /\b(triste|arrabbiato|arrabbiata|frustrato|frustrata|confuso|confusa|affranto|affranta|amareggiato|amareggiata|abbattuto|abbattuta|depresso|depressa|di\s+cattivo\s+umore|incupito|incupita|su\s+tutte\s+le\s+furie|di\s+umore\s+nero|gi[uù]\s+di\s+morale|a\s+terra|demoralizzato|demoralizzata|deluso|delusa|svuotato|svuotata|senza\s+energie|scazzato|scazzata|che\s+schifo|incazzato|incazzata|emo)\b/i,
      mood: 'down',
    },
  ],

  // ── Attività → umore inferito ────────────────────────────────────────────
  activityMoodMap: [
    // happy: sport, uscite sociali, feste
    {
      pattern: /\b(correndo|allenamento|palestra|yoga|nuotando|nuotato|pedalando|calcio|basket|tennis|trekking|escursione|camminata|partita)\b/i,
      mood: 'happy',
    },
    {
      pattern: /\b(aperitivo|brunch|festa|karaoke|amici|famiglia|concerto|mostra|museo|uscita|serata)\b/i,
      mood: 'happy',
    },
    // satisfied: task completion
    {
      pattern: /\b(finito|completato|rilasciato|pubblicato|inviato|terminato|consegnato|spedito)\b/i,
      mood: 'satisfied',
    },
    // focused: deep work / study
    {
      pattern: /\b(studiando|lavorando|scrivendo|riunione|lezione|ufficio|codice|revisionando|ricercando|progettando)\b/i,
      mood: 'focused',
    },
    // tired: overwork, late night, commute
    { pattern: /\b(straordinario|notte tarda|notte in bianco|pendolare|pendolando|di corsa|tutto il giorno)\b/i, mood: 'tired' },
    // bored: waiting, idle
    { pattern: /\b(aspettando|coda|in coda|nel traffico|bloccato nel traffico|bloccata nel traffico|non ho niente da fare|non sapevo cosa fare)\b/i, mood: 'bored' },
    // down: failures, errors
    { pattern: /\b(errore|fallito|fallita|bug|crash|rotto|rotta|non funziona|rifiutato|rifiutata)\b/i, mood: 'down' },
    // calm: leisure, relaxation
    {
      pattern: /\b(meditazione|meditando|t[eè]|caff[eè]|passeggiata|bagno|podcast|musica|romanzo|leggendo per piacere|stretching|riposo)\b/i,
      mood: 'calm',
    },
  ],

  // ── Tutte le parole di umore ─────────────────────────────────────────────
  // Nota: si escludono 'in forma', 'bene', 'male', 'ok' da soli perché troppo
  // ambigui — coperti dai moodSentencePatterns con contesto.
  allMoodWords: [
    // happy
    'felice', 'contento', 'contenta', 'entusiasta', 'allegro', 'allegra', 'euforico', 'euforica', 'gasato', 'gasata', 'carico', 'carica', 'gioioso', 'gioiosa', 'su di giri', 'in vena', 'felicissimo', 'felicissima', 'raggiante', 'di buon umore', 'positivo', 'positiva', 'ottimista', 'al settimo cielo',
    // calm
    'calmo', 'calma', 'sereno', 'serena', 'rilassato', 'rilassata', 'tranquillo', 'tranquilla', 'disteso', 'distesa', 'placido', 'placida', 'in pace', 'a posto', 'rasserenato', 'rasserenata', 'equilibrato', 'equilibrata',
    // focused
    'concentrato', 'concentrata', 'produttivo', 'produttiva', 'motivato', 'motivata', 'determinato', 'determinata', 'deciso', 'decisa', 'ispirato', 'ispirata', 'sul pezzo', 'focalizzato', 'focalizzata',
    // satisfied
    'soddisfatto', 'soddisfatta', 'appagato', 'appagata', 'fiero', 'fiera', 'gratificato', 'gratificata', 'orgoglioso', 'orgogliosa', 'sollevato', 'sollevata',
    // tired
    'stanco', 'stanca', 'esausto', 'esausta', 'stremato', 'stremata', 'scarico', 'scarica', 'assonnato', 'assonnata', 'intontito', 'intontita', 'svogliato', 'svogliata', 'spento', 'spenta', 'senza forze', 'sfinito', 'sfinita', 'distrutto', 'distrutta', 'cotto', 'cotta', 'spossato', 'spossata', 'morto', 'morta', 'ko',
    // anxious
    'ansioso', 'ansiosa', 'stressato', 'stressata', 'nervoso', 'nervosa', 'preoccupato', 'preoccupata', 'agitato', 'agitata', 'travolto', 'travolta', 'sopraffatto', 'sopraffatta', 'sotto pressione', 'in apprensione', 'in ansia', 'in paranoia', 'teso', 'tesa', 'in panico', 'in palla',
    // bored
    'annoiato', 'annoiata', 'stufo', 'stufa', 'apatico', 'apatica', 'annoiatissimo', 'annoiatissima', 'che noia', 'che palle', 'monotono', 'monotona', 'mi annoio',
    // down
    'triste', 'arrabbiato', 'arrabbiata', 'frustrato', 'frustrata', 'confuso', 'confusa', 'affranto', 'affranta', 'amareggiato', 'amareggiata', 'abbattuto', 'abbattuta', 'depresso', 'depressa', 'di cattivo umore', 'incupito', 'incupita', 'su tutte le furie', 'giu di morale', 'giù di morale', 'a terra', 'demoralizzato', 'demoralizzata', 'deluso', 'delusa', 'svuotato', 'svuotata', 'senza energie', 'scazzato', 'scazzata', 'che schifo', 'incazzato', 'incazzata',
    'emo',
    // misc
    'sollievo', 'pesante', 'faticoso', 'faticosa',
  ],

  // ── Pattern di frasi di umore ────────────────────────────────────────────
  // Si usano [eè], [uù], [iì] per compatibilità tastiere mobili senza accento.
  moodSentencePatterns: [
    /\b(mi\s+sento|sono)\s+(molto\s+|troppo\s+|davvero\s+)?(stanco|stanca|stressato|stressata|ansioso|ansiosa|triste|felice|calmo|calma|arrabbiato|arrabbiata|esausto|esausta|sollevato|sollevata)\b/i,
    /\b([eè]ra|[eè]\s+stata|[eè]\s+stato|andata)\s+(stressante|pesante|ottima|bene|male)\b/i,
    /\bmi\s+ha\s+(stressato|stressata|confuso|confusa|stancato|stancata)\b/i,
    /\b(mi\s+sento|sono)\s+(in\s+ansia|gi[uù]\s+di\s+morale|a\s+terra|distrutto|distrutta|cotto|cotta)\b/i,
    /\b(che\s+ansia|che\s+noia|che\s+palle)\b/i,
    /\b(mi\s+sento|sono)\s+(teso|tesa|spossato|spossata|svuotato|svuotata)\b/i,
    /\b(mi\s+sento|sono)\s+(molto\s+)?(raggiante|equilibrato|equilibrata)\b/i,
    /\b(mi\s+sento|sono)\s+(molto\s+|davvero\s+)?(bene|felice|contento|contenta|ottimista|carico|carica)\b/i,
    /\b(mi\s+sento|sono)\s+(molto\s+|davvero\s+)?(triste|scazzato|scazzata|in\s+panico|incazzato|incazzata)\b/i,
    /\b(oggi\s+)?(sono\s+)?(gi[uù]|a\s+pezzi|ko|k\.o\.)\b/i,
    /\bmi\s+ha\s+dato\s+sollievo\b/i,
    /\b(mi\s+sento|sono)\s+(un\s+po['']\s+|molto\s+)?(bene|male|scarico|scarica|sereno|serena)\b/i,
    /\b([eèe])\s+(molto\s+|davvero\s+)?(faticoso|pesante|stressante)\b/i,
    // Reflexive verbs in passato prossimo
    /\bmi\s+sono\s+(allenato|allenata|stancato|stancata|stressato|stressata|rilassato|rilassata|divertito|divertita|annoiato|annoiata|svegliato|svegliata|riposato|riposata)\b/i,
    // Event evaluation patterns
    /\b(la\s+riunione|l[' ']esame|il\s+colloquio|la\s+gara|la\s+partita)\s+([eè]\s+andata?|[eè]\s+andato?)\s+(bene|male|benissimo|malissimo|ottimamente)\b/i,
    /\b(non\s+vedo\s+l[' ']ora)\b/i,
    /\b(finalmente)\b/i,
    /\b(meno\s+male)\b/i,
    /\b(per\s+fortuna)\b/i,
    /\b(che\s+stress|che\s+fatica|che\s+stanchezza)\b/i,
    /\b(sono\s+a\s+pezzi|sono\s+distrutto|sono\s+distrutta|sono\s+morto|sono\s+morta)\b/i,
    /\b(non\s+ne\s+posso\s+pi[uù])\b/i,
    // più stanco/stressato/motivato — gradi comparativi
    /\b(mi\s+sento|sono)\s+(pi[uù]\s+)?(riposato|riposata|carico|carica|motivato|motivata)\b/i,
    /\b(sono\s+)?(decisamente|davvero|proprio)\s+(stanco|stanca|stressato|stressata|felice|contento|contenta)\b/i,
    // non ce la faccio / non riesco
    /\b(non\s+ce\s+la\s+(faccio|facevo)|non\s+riesco\s+a\s+concentrarmi)\b/i,
    /\b(ho\s+bisogno\s+di\s+(riposare|dormire|una\s+pausa|staccare))\b/i,
    /\b(ho\s+sonno|ho\s+tanta\s+voglia\s+di\s+dormire)\b/i,
    // eventi andati bene/male
    /\b(tutto\s+[eè]\s+andato\s+bene)\b/i,
    /\b(non\s+[eè]\s+andato\s+bene|[eè]\s+andato\s+male)\b/i,
    /\b([eè]\s+stata\s+una\s+bella\s+(giornata|mattinata|serata|esperienza))\b/i,
    /\b([eè]\s+stata\s+una\s+(giornata|mattinata|serata)\s+(di\s+)?(merda|pessima|orribile|bruttissima))\b/i,
    // voglia / motivazione
    /\b(non\s+ho\s+voglia\s+di\s+niente|zero\s+voglia|non\s+mi\s+va\s+niente)\b/i,
    /\b(ho\s+tanta\s+voglia\s+di\s+(fare|lavorare|studiare|correre))\b/i,
    // su di giri / giù di morale short forms
    /\b(sono\s+)?(su\s+di\s+giri|gi[uù]\s+di\s+corda|di\s+cattivo\s+umore)\b/i,
    // stressato dalla situazione
    /\b(questa\s+(cosa|situazione|roba)\s+mi\s+(stress[ao]|angosc[ia]|tormenta))\b/i,
    // fatica fisica
    /\b(ho\s+i\s+muscoli\s+(indolenziti|doloranti|a\s+pezzi))\b/i,
    /\b(mi\s+fanno\s+male\s+(le\s+gambe|le\s+braccia|i\s+muscoli))\b/i,
  ],
};
