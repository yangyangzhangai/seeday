// DOC-DEPS: LLM.md -> docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md -> src/features/chat/README.md

export const EN_ACTIVITY_VERBS = [
  'work',
  'working',
  'worked',
  'study',
  'studying',
  'studied',
  'meet',
  'meeting',
  'run',
  'running',
  'ran',
  'walk',
  'walking',
  'code',
  'coding',
  'coded',
  'cook',
  'cooking',
  'cooked',
  'write',
  'writing',
  'wrote',
  'report',
  'review',
  'reviewing',
  'workout',
  'exercising',
  'gym',
  'commute',
  'commuting',
  'shopping',
  'bought',
  'call',
  'calling',
];

export const EN_MOOD_WORDS = [
  'tired',
  'exhausted',
  'stressed',
  'stressful',
  'anxious',
  'sad',
  'down',
  'upset',
  'frustrated',
  'annoyed',
  'drained',
  'relieved',
  'happy',
  'glad',
  'calm',
  'angry',
  'overwhelmed',
  'pointless',
];

export const EN_MOOD_PATTERNS = [
  /\b(feel|feeling)\s+(very\s+|so\s+|really\s+)?(tired|exhausted|stressed|stressful|anxious|sad|down|happy|calm|angry|overwhelmed|drained|relieved|frustrated|annoyed)\b/i,
  /\b(so|very|really|quite)\s+(tired|exhausted|stressed|stressful|anxious|sad|happy|calm|angry|frustrated|drained|relieved)\b/i,
  /\b(was|is|felt|feels)\s+(stressful|annoying|great|awful|rough|smooth)\b/i,
  /\b(was|is|felt|feels)\s+pointless\b/i,
  /\bmade\s+me\s+(anxious|stressed|upset|angry)\b/i,
];

export const EN_ACTIVITY_PATTERNS = [
  /\b(i am|i'm|im)\s+(working|studying|coding|running|walking|cooking)\b/i,
  /\b(working|studying|coding|running|walking|cooking)\s+(now|right now)\b/i,
  /\b(just\s+)?(had|did|wrapped\s+up)\s+(a\s+)?(meeting|workout|class|call)\b/i,
  /\b(writing|working\s+on|reviewing)\s+(the\s+)?(report|doc|assignment|ticket|code)\b/i,
  /\b(on\s+my\s+way\s+to|at)\s+(the\s+)?(office|gym|school)\b/i,
  /\b(in|on)\s+(a\s+)?meeting\b/i,
  /\bvideo\s+call\b/i,
];

export const EN_STRONG_COMPLETION_PATTERNS = [
  /\b(just\s+)?(finished|done|completed)\b/i,
  /\bfinished\s+(the\s+)?(report|meeting|task|workout|class)\b/i,
  /\b(wrapped\s+up|got\s+done\s+with)\s+(the\s+)?(report|meeting|task|class|workout|call)\b/i,
  /\b(sent\s+out\s+the\s+report)\b/i,
];

export const EN_FUTURE_OR_PLAN_PATTERNS = [
  /\b(tomorrow|later|soon|tonight|later\s+today|next\s+(hour|meeting|class|week))\b/i,
  /\b(gonna|going\s+to|plan\s+to|want\s+to|about\s+to|will|need\s+to|have\s+to)\b/i,
];

export const EN_LAST_ACTIVITY_REFERENCES = [
  'that',
  'it',
  'the meeting',
  'that meeting',
  'that task',
  'that call',
  'that report',
  'just now',
  'earlier',
  'earlier one',
  'what i just did',
  'that phone call',
  'that class',
  'that workout',
  'that training',
  'that lesson',
  'the call earlier',
  'the class earlier',
  'the workout earlier',
];
