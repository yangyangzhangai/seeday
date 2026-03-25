// DOC-DEPS: LLM.md -> docs/ACTIVITY_LEXICON.md -> docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md
//
// English mood lexicon – single source of truth for all EN mood signals.
// Mirrors the structure of moodLexicon.zh.ts.

import type { MoodLexicon } from './types.js';

export const enMoodLexicon: MoodLexicon = {

  // ── Explicit mood words → MoodKey mapping ───────────────────────────────
  // Note: high-ambiguity words (great, content, beat, rough, blue, sharp) are
  // intentionally excluded here and handled via moodSentencePatterns instead.
  explicitMoodMap: [
    { pattern: /\b(happy|glad|excited|thrilled|joyful|elated|overjoyed|stoked|pumped|hyped|buzzing|vibing|ecstatic|giddy|jazzed|psyched|blessed|thriving|grinning|cheerful|delighted|in a good mood|in good spirits|upbeat|optimistic|over the moon)\b/i, mood: 'happy' },
    { pattern: /\b(calm|relaxed|peaceful|zen|chill|serene|mellow|tranquil|unbothered|carefree|easygoing|easy-going|at ease|laid back|settled|grounded|composed|centered)\b/i, mood: 'calm' },
    { pattern: /\b(focused|productive|motivated|driven|energized|energised|in the zone|in flow|flow state|in my element|dialed in|on a roll|locked in|laser focused|laser-focused)\b/i, mood: 'focused' },
    { pattern: /\b(satisfied|fulfilled|accomplished|pleased|proud|chuffed|relieved|grateful)\b/i, mood: 'satisfied' },
    {
      pattern: /\b(tired|exhausted|drained|fatigued|groggy|sluggish|lethargic|dragging|burnt out|burned out|worn out|sleepy|wiped|spent|zonked|shattered|sleep deprived|knackered|worn down|dead tired|fried|sore|done for|running on empty|barely awake|half asleep|dead on my feet)\b/i,
      mood: 'tired',
    },
    {
      pattern: /\b(anxious|nervous|stressed|stressful|worried|uneasy|overwhelmed|paranoid|rattled|worked up|flustered|keyed up|tense|on edge|panicky|frazzled|restless|jittery|freaking out|freaked out|wired|spiraling|dreading|guilty)\b/i,
      mood: 'anxious',
    },
    { pattern: /\b(bored|tedious|dull|pointless|monotonous|mind-numbing|meh|unstimulated|zoned out|checked out|blah|so over it|can't be bothered|couldn't be bothered|going through the motions)\b/i, mood: 'bored' },
    {
      pattern: /\b(sad|down|upset|frustrated|annoyed|angry|depressed|miserable|deflated|lousy|crappy|in a funk|down in the dumps|awful|terrible|gloomy|gutted|defeated|heartbroken|devastated|hopeless|irritated|wrecked|bummed|fed up|pissed off|emo|brutal|had enough)\b/i,
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
  // High-ambiguity words (great, content, beat, rough, blue, sharp) are excluded;
  // they only fire via moodSentencePatterns where context disambiguates them.
  allMoodWords: [
    // happy
    'happy', 'glad', 'excited', 'thrilled', 'joyful', 'elated', 'overjoyed', 'stoked', 'pumped', 'hyped', 'buzzing', 'vibing', 'ecstatic', 'giddy', 'jazzed', 'psyched', 'blessed', 'thriving', 'grinning', 'cheerful', 'delighted', 'in a good mood', 'in good spirits', 'upbeat', 'optimistic', 'over the moon',
    // calm
    'calm', 'relaxed', 'peaceful', 'zen', 'chill', 'serene', 'mellow', 'tranquil', 'unbothered', 'carefree', 'easygoing', 'settled', 'grounded', 'composed', 'centered',
    // focused
    'focused', 'productive', 'motivated', 'driven', 'energized', 'energised', 'in the zone', 'in flow', 'flow state', 'in my element', 'dialed in', 'on a roll', 'locked in', 'laser focused',
    // satisfied
    'satisfied', 'fulfilled', 'accomplished', 'pleased', 'proud', 'chuffed', 'relieved', 'grateful',
    // tired
    'tired', 'exhausted', 'drained', 'fatigued', 'groggy', 'sluggish', 'lethargic', 'dragging', 'burnt out', 'burned out', 'worn out', 'sleepy', 'wiped', 'spent', 'zonked', 'shattered', 'sleep deprived', 'knackered', 'worn down', 'dead tired', 'fried', 'sore', 'done for', 'running on empty', 'barely awake', 'dead on my feet',
    // anxious
    'anxious', 'nervous', 'stressed', 'stressful', 'worried', 'uneasy', 'overwhelmed', 'paranoid', 'rattled', 'worked up', 'flustered', 'keyed up', 'tense', 'on edge', 'panicky', 'frazzled', 'restless', 'jittery', 'freaking out', 'freaked out', 'wired', 'spiraling', 'dreading', 'guilty',
    // bored
    'bored', 'tedious', 'dull', 'pointless', 'monotonous', 'meh', 'unstimulated', 'zoned out', 'checked out', 'blah', 'so over it', 'going through the motions',
    // down
    'sad', 'upset', 'frustrated', 'annoyed', 'angry', 'depressed', 'miserable', 'deflated', 'lousy', 'crappy', 'in a funk', 'down in the dumps', 'awful', 'terrible', 'gloomy', 'gutted', 'defeated', 'heartbroken', 'devastated', 'hopeless', 'irritated', 'wrecked', 'bummed', 'fed up', 'pissed off', 'emo', 'brutal',
    // misc sentiment helpers
    'relief', 'lighter',
  ],

  // ── Mood sentence patterns ────────────────────────────────────────────────
  moodSentencePatterns: [
    /\b(feel|feeling)\s+(very\s+|so\s+|really\s+)?(tired|exhausted|stressed|stressful|anxious|sad|down|happy|calm|angry|overwhelmed|drained|relieved|frustrated|annoyed|good|better|optimistic)\b/i,
    /\b(so|very|really|quite)\s+(tired|exhausted|stressed|anxious|sad|happy|calm|angry|frustrated|drained|relieved|good|positive)\b/i,
    /\b(was|is|felt|feels)\s+(stressful|annoying|great|awful|rough|smooth|pointless|tedious)\b/i,
    /\bmade\s+me\s+(anxious|stressed|upset|angry|nervous)\b/i,
    /\b(i am|i'm)\s+(kinda\s+|kind of\s+)?(meh|frazzled|gutted|panicky)\b/i,
    /\b(i am|i'm)\s+(doing\s+)?(okay|ok|fine)\b/i,
    /\b(this|that)\s+(is|was)\s+(so\s+)?(draining|exhausting|rough)\b/i,
    /\b(i am|i'm)\s+(so\s+|really\s+)?(dead tired|worn down|hopeless|irritated)\b/i,
    /\b(i feel|i'm feeling)\s+(a bit\s+|pretty\s+)?(restless|jittery|composed|grateful)\b/i,
    /\b(i feel|i'm feeling)\s+(so\s+|really\s+)?(good|great|happy|cheerful)\b/i,
    /\b(feels?|felt)\s+(so\s+|really\s+)?(good|great|better)\b/i,
    /\b(i feel|i'm feeling)\s+(so\s+|really\s+)?(sad|blue|bummed|fed up)\b/i,
    /\b(feel|feeling|felt)\s+(a bit\s+|kind of\s+|kinda\s+|so\s+|really\s+)?(down|blue)\b/i,
    /\b(i'm|i am)\s+(so\s+)?(pissed off|over it|freaking out)\b/i,
    /\b(feels?|felt)\s+like\s+(a\s+)?(weight\s+off|relief)\b/i,
    /\b(weight\s+off\s+my\s+shoulders?)\b/i,
    /\b(dreading)\b/i,
    /\b(running\s+on\s+fumes)\b/i,
    /\b(brain\s+(is|'s)\s+(totally\s+)?fried)\b/i,
    /\b(feeling\s+guilty|guilty)\b/i,
    /\b(went\s+(really\s+|pretty\s+|surprisingly\s+)?well)\b/i,
    /\b(waste\s+of\s+time)\b/i,
    /\b(ugly\s+cry|made\s+me\s+cry)\b/i,
    /\b(left\s+me\s+feeling\s+(centered|grounded|calm|better))\b/i,
    /\b(such\s+a\s+good\s+time)\b/i,
    /\b(can\s+barely\s+walk)\b/i,
    /\b(way\s+harder\s+than\s+expected)\b/i,
    /\b(so\s+sore|sore\s+from)\b/i,
    /\b(made\s+my\s+day)\b/i,
    /\b(crushed\s+it)\b/i,
    // Disambiguated high-ambiguity words — require sentence context (modifier required)
    /\b(feeling|feel|felt)\s+(so\s+|really\s+|pretty\s+|kinda\s+|kind\s+of\s+)?(great|good)\b/i,
    /\b(so|really|pretty|kinda|kind\s+of)\s+(great|good)\b/i,
    /\b(i'm|i\s+am|was|is)\s+(feeling\s+)?(great|good)\b/i,
    /\b(feels?\s+(so\s+|really\s+)?|so\s+|really\s+)(great|good)\b/i,
    /\b(i'm|i\s+am)\s+(feeling\s+)?(content|at\s+peace)\b/i,
    /\b(pretty\s+|really\s+|totally\s+|absolutely\s+)?(beat|dead)\b/i,
    /\b(what\s+a\s+(rough|tough|hard)\s+(day|week|morning|night))\b/i,
    /\b(such\s+a\s+(rough|tough)\s+(day|week))\b/i,
    /\b(feeling\s+(a\s+bit\s+|kinda\s+|kind\s+of\s+)?(blue|down|low))\b/i,
    /\b(i\s+feel|i'm\s+feeling)\s+(a\s+bit\s+|kinda\s+|kind\s+of\s+)?(sharp|on\s+point|dialed\s+in)\b/i,
    /\b(nailed\s+it|killed\s+it|smashed\s+it|knocked\s+it\s+out\s+of\s+the\s+park)\b/i,
    /\b(what\s+a\s+day)\b/i,
    /\b(can't\s+be\s+bothered|couldn't\s+be\s+bothered)\b/i,
    /\b(had\s+enough)\b/i,
    // more tired/energy patterns
    /\b(barely\s+(functioning|surviving|keeping\s+it\s+together))\b/i,
    /\b(need(ed)?\s+(a\s+)?coffee|need(ed)?\s+(a\s+)?nap|need(ed)?\s+(a\s+)?break)\b/i,
    /\b(haven't\s+slept|couldn't\s+sleep|no\s+sleep)\b/i,
    /\b(hit\s+a\s+wall)\b/i,
    // more focused/motivated patterns
    /\b(getting\s+things?\s+done|on\s+a\s+roll\s+today|crushing\s+it\s+today)\b/i,
    /\b(so\s+motivated|feeling\s+motivated|really\s+motivated)\b/i,
    /\b(fired?\s+up\s+(today|right\s+now)?)\b/i,
    /\b(in\s+the\s+zone\s+today)\b/i,
    // more anxious patterns
    /\b(can't\s+(stop\s+)?think(ing)?\s+about\s+it)\b/i,
    /\b(so\s+stressed\s+out|really\s+stressed\s+out)\b/i,
    /\b(losing\s+(my\s+)?mind)\b/i,
    /\b(can't\s+focus|couldn't\s+focus|hard\s+to\s+focus)\b/i,
    // more satisfied patterns
    /\b(feeling\s+(really\s+|super\s+)?(accomplished|proud|satisfied))\b/i,
    /\b(that\s+(went|worked)\s+(really\s+)?(well|smoothly))\b/i,
    // more down patterns
    /\b(not\s+(feeling\s+)?great|not\s+feeling\s+well|feeling\s+off)\b/i,
    /\b(just\s+not\s+my\s+(day|week))\b/i,
    /\b(can't\s+catch\s+a\s+break)\b/i,
    /\b(everything\s+(is|feels)\s+(like\s+too\s+much|overwhelming))\b/i,
    // more bored patterns
    /\b(just\s+killing\s+time|nothing\s+going\s+on|nothing\s+to\s+do)\b/i,
    /\b(so\s+(slow|boring)\s+today)\b/i,
    // calm/relief patterns
    /\b(finally\s+getting\s+some\s+rest|finally\s+relaxing)\b/i,
    /\b(taking\s+it\s+easy|chilling\s+out)\b/i,
  ],
};
