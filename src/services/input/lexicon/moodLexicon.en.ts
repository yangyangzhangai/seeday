// DOC-DEPS: LLM.md -> docs/ACTIVITY_LEXICON.md -> docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md
//
// English mood lexicon – single source of truth for all EN mood signals.
// Mirrors the structure of moodLexicon.zh.ts.

import type { MoodLexicon } from './types';

export const enMoodLexicon: MoodLexicon = {

  // ── Explicit mood words → MoodKey mapping ───────────────────────────────
  explicitMoodMap: [
    { pattern: /\b(happy|glad|excited|thrilled|joyful|great|elated|overjoyed)\b/i, mood: 'happy' },
    { pattern: /\b(calm|relaxed|peaceful|zen|chill|serene|at ease|laid back)\b/i, mood: 'calm' },
    { pattern: /\b(focused|productive|in the zone|dialed in|on a roll|sharp)\b/i, mood: 'focused' },
    { pattern: /\b(satisfied|fulfilled|accomplished|content|pleased|proud)\b/i, mood: 'satisfied' },
    {
      pattern: /\b(tired|exhausted|drained|fatigued|burnt out|burned out|worn out|sleepy|beat|wiped)\b/i,
      mood: 'tired',
    },
    {
      pattern: /\b(anxious|nervous|stressed|stressful|worried|uneasy|overwhelmed|tense|on edge)\b/i,
      mood: 'anxious',
    },
    { pattern: /\b(bored|tedious|dull|pointless|monotonous|mind-numbing)\b/i, mood: 'bored' },
    {
      pattern: /\b(sad|down|upset|frustrated|annoyed|angry|depressed|miserable|rough|awful|terrible|gloomy)\b/i,
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
    'happy', 'glad', 'excited', 'thrilled', 'joyful', 'great', 'elated', 'overjoyed',
    'calm', 'relaxed', 'peaceful', 'zen', 'chill', 'serene',
    'focused', 'productive', 'dialed in', 'in the zone', 'on a roll',
    'satisfied', 'fulfilled', 'accomplished', 'content', 'pleased', 'proud',
    'tired', 'exhausted', 'drained', 'fatigued', 'burnt out', 'burned out', 'worn out', 'sleepy', 'beat', 'wiped',
    'anxious', 'nervous', 'stressed', 'stressful', 'worried', 'uneasy', 'overwhelmed', 'tense',
    'bored', 'tedious', 'dull', 'pointless', 'monotonous',
    'sad', 'down', 'upset', 'frustrated', 'annoyed', 'angry', 'depressed', 'miserable', 'rough', 'awful', 'terrible',
    'relieved', 'relief', 'lighter', 'good', 'okay', 'ok', 'heavy',
  ],

  // ── Mood sentence patterns ────────────────────────────────────────────────
  moodSentencePatterns: [
    /\b(feel|feeling)\s+(very\s+|so\s+|really\s+)?(tired|exhausted|stressed|stressful|anxious|sad|down|happy|calm|angry|overwhelmed|drained|relieved|frustrated|annoyed)\b/i,
    /\b(so|very|really|quite)\s+(tired|exhausted|stressed|anxious|sad|happy|calm|angry|frustrated|drained|relieved)\b/i,
    /\b(was|is|felt|feels)\s+(stressful|annoying|great|awful|rough|smooth|pointless|tedious)\b/i,
    /\bmade\s+me\s+(anxious|stressed|upset|angry|nervous)\b/i,
    /\b(feels?|felt)\s+like\s+(a\s+)?(weight\s+off|relief)\b/i,
    /\b(weight\s+off\s+my\s+shoulders?)\b/i,
  ],
};
