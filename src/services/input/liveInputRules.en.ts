// DOC-DEPS: LLM.md -> docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md -> src/features/chat/README.md

import { getActivityLexicon, getMoodLexicon } from './lexicon/getLexicon.js';

const enActivity = getActivityLexicon('en');
const enMood = getMoodLexicon('en');

export const EN_ACTIVITY_VERBS = Array.from(new Set([...enActivity.strongPhrases, ...enActivity.verbs]));

export const EN_MOOD_WORDS = [...enMood.allMoodWords];

export const EN_MOOD_PATTERNS = [...enMood.moodSentencePatterns];

export const EN_ACTIVITY_PATTERNS = [...enActivity.phrasePatterns];

export const EN_STRONG_COMPLETION_PATTERNS = [
  /\b(just\s+)?(finished|done|completed)\b/i,
  /\bfinished\s+(the\s+)?(report|meeting|task|workout|class)\b/i,
  /\b(done|finished)\s+with\s+(the\s+)?(work|report|meeting|task|workout|class|call|book|reading)\b/i,
  /\b(wrapped\s+up|got\s+done\s+with)\s+(the\s+)?(report|meeting|task|class|workout|call)\b/i,
  /\b(sent\s+out\s+the\s+report)\b/i,
  /\b(finishing\s+up)\s+(the\s+)?(deck|doc|report|paper|slides?)\b/i,
  /\b(just\s+)?sent\s+(the\s+|my\s+)?((weekly|status)\s+)?(update|report|deck|slides?|doc|paper)\b/i,
  /\b(just\s+)?turned\s+in\s+(the\s+|my\s+)?(paper|assignment|homework)\b/i,
  /\b(finally\s+)?(shipped|released|deployed|pushed)\b/i,
  /\b(done\s+for\s+today)\b/i,
  /\b(knocked\s+it\s+out|got\s+it\s+done|knocked\s+out\s+(the\s+|my\s+)?tasks?)\b/i,
  /\b(finally\s+)?got\s+home\b/i,
];

export const EN_FUTURE_OR_PLAN_PATTERNS = [
  /\b(tomorrow|later|soon|tonight|later\s+today|next\s+(hour|meeting|class|week))\b/i,
  /\b(gonna|going\s+to|plan\s+to|want\s+to|about\s+to|will|need\s+to|have\s+to)\b/i,
];

export const EN_NEGATED_OR_NOT_OCCURRED_PATTERNS = [
  /\b(not|never)\s+(working|studying|coding|running|walking|exercising|doing)\b/i,
  /\b(didn't|did not|haven't|have not|couldn't|could not|wasn't|was not)\s+(work|study|exercise|go|finish|start)\b/i,
  /\b(skipped|skip(ping)?)\s+(the\s+)?(gym|workout|run|class)\b/i,
  /\b(no\s+progress|nothing\s+done|got\s+nothing\s+done)\b/i,
  /\b(wanted\s+to|planned\s+to)\s+.+\s+but\s+(didn't|did not|couldn't|could not)\b/i,
];

export const EN_SHORT_REPLY_PATTERNS = [
  /^(ok|okay|kk|yep|yeah|yup|sure|fine|got it|thanks|thank you)$/i,
];

export const EN_SHORT_ACTIVITY_SHELL_PATTERNS = [
  /^(drink|boil|cook|steam|prep|prepare|buy|get)\s+(water|tea|rice|meal|lunch|dinner|groceries|veggies|vegetables|fruits?)$/i,
  /^(meal prep|food prep)$/i,
];

export const EN_LAST_ACTIVITY_REFERENCES = [
  'that',
  'it',
  'the meeting',
  'that meeting',
  'the standup',
  'that standup',
  'the presentation',
  'that presentation',
  'that task',
  'that call',
  'that report',
  'the commute',
  'that commute',
  'the workout',
  'that workout',
  'the dinner',
  'that dinner',
  'that movie',
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
  'that run',
  'the run earlier',
  'that session',
  'that game',
  'that match',
  'the whole thing',
  'that exam',
  'that test',
];
