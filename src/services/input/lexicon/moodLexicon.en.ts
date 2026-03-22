// DOC-DEPS: LLM.md -> docs/ACTIVITY_LEXICON.md -> docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md
//
// English mood lexicon – single source of truth for all EN mood signals.
// Mirrors the structure of moodLexicon.zh.ts.

import type { MoodLexicon } from './types';

export const enMoodLexicon: MoodLexicon = {

  // ── Explicit mood words → MoodKey mapping ───────────────────────────────
  explicitMoodMap: [
    { pattern: /\b(happy|glad|excited|thrilled|joyful|great|elated|overjoyed|stoked|pumped|cheerful|delighted|in a good mood|in good spirits|upbeat|optimistic)\b/i, mood: 'happy' },
    { pattern: /\b(calm|relaxed|peaceful|zen|chill|serene|at ease|laid back|settled|grounded|composed)\b/i, mood: 'calm' },
    { pattern: /\b(focused|productive|in the zone|dialed in|on a roll|sharp|locked in|laser focused)\b/i, mood: 'focused' },
    { pattern: /\b(satisfied|fulfilled|accomplished|content|pleased|proud|relieved|grateful)\b/i, mood: 'satisfied' },
    {
      pattern: /\b(tired|exhausted|drained|fatigued|burnt out|burned out|worn out|sleepy|beat|wiped|spent|sleep deprived|knackered|worn down|dead tired)\b/i,
      mood: 'tired',
    },
    {
      pattern: /\b(anxious|nervous|stressed|stressful|worried|uneasy|overwhelmed|tense|on edge|panicky|frazzled|restless|jittery|freaking out|spiraling)\b/i,
      mood: 'anxious',
    },
    { pattern: /\b(bored|tedious|dull|pointless|monotonous|mind-numbing|meh|unstimulated|blah|so over it)\b/i, mood: 'bored' },
    {
      pattern: /\b(sad|down|upset|frustrated|annoyed|angry|depressed|miserable|rough|awful|terrible|gloomy|gutted|defeated|heartbroken|devastated|hopeless|irritated|blue|bummed|fed up|pissed off)\b/i,
      mood: 'down',
    },
  ],

  // ── Activity keywords → inferred mood mapping ────────────────────────────
  activityMoodMap: [
    // happy: sports, social, food, outings
    {
      pattern: /\b(running|workout|exercise|gym|yoga|swimming|hiking|cycling|biking|basketball|football|soccer|tennis|badminton|ping.pong)\b/i,
      mood: 'happy',
    },
    {
      pattern: /\b(breakfast|lunch|dinner|brunch|eating out|meal|potluck|barbecue|bbq)\b/i,
      mood: 'happy',
    },
    {
      pattern: /\b(hang(ing)? out|party|karaoke|date|friends|concert|exhibition|museum|movie night|game night)\b/i,
      mood: 'happy',
    },
    // satisfied: task completion
    {
      pattern: /\b(finished|completed|shipped|deployed|released|submitted|done|wrapped up|delivered|launched)\b/i,
      mood: 'satisfied',
    },
    // focused: deep work / study
    {
      pattern: /\b(studying|working|coding|reading|writing|meeting|class|office|reviewing|debugging|designing|researching)\b/i,
      mood: 'focused',
    },
    // tired: overwork, commute, late night
    { pattern: /\b(overtime|late night|cramming|commut(e|ing)|rush(ing)?|all.nighter)\b/i, mood: 'tired' },
    // bored: waiting, idle
    { pattern: /\b(waiting|queue|stuck in traffic|scrolling|nothing to do|killing time)\b/i, mood: 'bored' },
    // down: failures, errors
    {
      pattern: /\b(fail(ed|ure)?|bug|crash|broke(n)?|mistake|rejected|blocked|stuck)\b/i,
      mood: 'down',
    },
    // calm: leisure, rest
    {
      pattern: /\b(meditat(e|ing)|tea|coffee break|walk(ing)?|bath|podcast|music|novel|reading for fun|stretching)\b/i,
      mood: 'calm',
    },
  ],

  // ── All mood words (for fast "does text contain mood signal?" checks) ────
  allMoodWords: [
    'happy', 'glad', 'excited', 'thrilled', 'joyful', 'great', 'elated', 'overjoyed', 'stoked', 'pumped', 'cheerful', 'delighted', 'in a good mood', 'in good spirits', 'upbeat', 'optimistic',
    'calm', 'relaxed', 'peaceful', 'zen', 'chill', 'serene', 'settled', 'grounded', 'composed',
    'focused', 'productive', 'dialed in', 'in the zone', 'on a roll', 'locked in', 'laser focused',
    'satisfied', 'fulfilled', 'accomplished', 'content', 'pleased', 'proud', 'relieved', 'grateful',
    'tired', 'exhausted', 'drained', 'fatigued', 'burnt out', 'burned out', 'worn out', 'sleepy', 'beat', 'wiped', 'spent', 'sleep deprived', 'knackered', 'worn down', 'dead tired',
    'anxious', 'nervous', 'stressed', 'stressful', 'worried', 'uneasy', 'overwhelmed', 'tense', 'on edge', 'panicky', 'frazzled', 'restless', 'jittery', 'freaking out', 'spiraling',
    'bored', 'tedious', 'dull', 'pointless', 'monotonous', 'meh', 'unstimulated', 'blah', 'so over it',
    'sad', 'down', 'upset', 'frustrated', 'annoyed', 'angry', 'depressed', 'miserable', 'rough', 'awful', 'terrible', 'gloomy', 'gutted', 'defeated', 'heartbroken', 'devastated', 'hopeless', 'irritated', 'blue', 'bummed', 'fed up', 'pissed off',
    'relieved', 'relief', 'lighter', 'good', 'okay', 'ok', 'heavy',
  ],

  // ── Mood sentence patterns ────────────────────────────────────────────────
  moodSentencePatterns: [
    /\b(feel|feeling)\s+(very\s+|so\s+|really\s+)?(tired|exhausted|stressed|stressful|anxious|sad|down|happy|calm|angry|overwhelmed|drained|relieved|frustrated|annoyed|good|better|optimistic)\b/i,
    /\b(so|very|really|quite)\s+(tired|exhausted|stressed|anxious|sad|happy|calm|angry|frustrated|drained|relieved|good|positive)\b/i,
    /\b(was|is|felt|feels)\s+(stressful|annoying|great|awful|rough|smooth|pointless|tedious)\b/i,
    /\bmade\s+me\s+(anxious|stressed|upset|angry|nervous)\b/i,
    /\b(i am|i'm)\s+(kinda\s+|kind of\s+)?(meh|frazzled|gutted|panicky)\b/i,
    /\b(this|that)\s+(is|was)\s+(so\s+)?(draining|exhausting|rough)\b/i,
    /\b(i am|i'm)\s+(so\s+|really\s+)?(dead tired|worn down|hopeless|irritated)\b/i,
    /\b(i feel|i'm feeling)\s+(a bit\s+|pretty\s+)?(restless|jittery|composed|grateful)\b/i,
    /\b(i feel|i'm feeling)\s+(so\s+|really\s+)?(good|great|happy|cheerful)\b/i,
    /\b(i feel|i'm feeling)\s+(so\s+|really\s+)?(sad|blue|bummed|fed up)\b/i,
    /\b(i'm|i am)\s+(so\s+)?(pissed off|over it|freaking out)\b/i,
    /\b(feels?|felt)\s+like\s+(a\s+)?(weight\s+off|relief)\b/i,
    /\b(weight\s+off\s+my\s+shoulders?)\b/i,
  ],
};
