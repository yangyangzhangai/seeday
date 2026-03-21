// DOC-DEPS: LLM.md -> docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md -> src/features/chat/README.md

import { getActivityLexicon, getMoodLexicon } from './lexicon/getLexicon';

const enActivity = getActivityLexicon('en');
const enMood = getMoodLexicon('en');

export const EN_ACTIVITY_VERBS = Array.from(new Set([...enActivity.strongPhrases, ...enActivity.verbs]));

export const EN_MOOD_WORDS = [...enMood.allMoodWords];

export const EN_MOOD_PATTERNS = [...enMood.moodSentencePatterns];

export const EN_ACTIVITY_PATTERNS = [
  /\b(i am|i'm|im)\s+(working|studying|coding|running|walking|cooking)\b/i,
  /\b(working|studying|coding|running|walking|cooking)\s+(now|right now)\b/i,
  /\b(study|studying|review|reviewing|learn|learning)\s+(?!about\s+to\b|how\s+to\b)([a-z][a-z0-9-]*(\s+[a-z][a-z0-9-]*){0,3})\b/i,
  /\b(just\s+)?(had|did|wrapped\s+up)\s+(a\s+)?(meeting|workout|class|call)\b/i,
  /\b(writing|working\s+on|reviewing)\s+(the\s+)?(report|doc|assignment|ticket|code)\b/i,
  /\b(sending|replying\s+to|answering)\s+(emails?|messages?)\b/i,
  /\b(preparing|building|drafting|updating)\s+(a\s+|the\s+)?(presentation|slides|roadmap|report|doc|deck)\b/i,
  /\b(debugging|fixing|testing)\b/i,
  /\b(just\s+)?(pushed|shipped|deployed|released)\s+(a\s+|the\s+)?(fix|feature|update)\b/i,
  /\b(driving|taking)\s+(a\s+)?(taxi|bus|train|subway)\b/i,
  /\b(commuting|on\s+the\s+way\s+to)\s+(work|office|school|gym)\b/i,
  /\b(doing|finished|did)\s+(laundry|cleaning|dishes|meal\s+prep|grocery\s+shopping)\b/i,
  /\b(playing|played)\s+(football|soccer|basketball|badminton|tennis|ping\s+pong)\b/i,
  /\b(swimming|hiking|cycling|biking|doing\s+yoga|doing\s+pilates|stretching)\b/i,
  /\b(watching|watched)\s+(a\s+)?(movie|series|tv\s+show|livestream)\b/i,
  /\b(listening\s+to)\s+(a\s+)?(podcast|music)\b/i,
  /\b(hanging\s+out|meeting|met|visiting|visited)\s+(friends|family)\b/i,
  /\b(went\s+to|going\s+to)\s+(a\s+)?(concert|museum|exhibition|cafe)\b/i,
  /\b(karaoke|board\s+games?|game\s+night|date\s+night)\b/i,
  /\b(chatting|chatted)\s+with\b/i,
  /\b(hanging\s+out|hung\s+out)\b/i,
  /\b(grabbing|grabbed|having|had)\s+(breakfast|lunch|dinner|brunch)\b/i,
  /\b(watching|watched|reading|read)\s+(anime|manga|novel|novels)\b/i,
  /\b(reading|read|skimming|skimmed)\s+(the\s+)?(newspaper|news|article|articles)\b/i,
  /\b(journaling|journaled|writing|wrote)\s+(a\s+)?(journal|diary|journal\s+entry)\b/i,
  /\b(taking|took|reviewing)\s+(notes|meeting\s+notes|class\s+notes)\b/i,
  /\b(doctor|dentist)\s+(appointment|visit)\b/i,
  /\b(paying|paid)\s+(the\s+)?(bills?|rent|utilities)\b/i,
  /\b(gaming|playing\s+games|played\s+games)\b/i,
  /\b(on\s+my\s+way\s+to|at)\s+(the\s+)?(office|gym|school)\b/i,
  /\b(in|on)\s+(a\s+)?meeting\b/i,
  /\bvideo\s+call\b/i,
];

export const EN_STRONG_COMPLETION_PATTERNS = [
  /\b(just\s+)?(finished|done|completed)\b/i,
  /\bfinished\s+(the\s+)?(report|meeting|task|workout|class)\b/i,
  /\b(wrapped\s+up|got\s+done\s+with)\s+(the\s+)?(report|meeting|task|class|workout|call)\b/i,
  /\b(sent\s+out\s+the\s+report)\b/i,
  /\b(finally\s+)?(shipped|released|deployed|pushed)\b/i,
  /\b(done\s+for\s+today)\b/i,
];

export const EN_FUTURE_OR_PLAN_PATTERNS = [
  /\b(tomorrow|later|soon|tonight|later\s+today|next\s+(hour|meeting|class|week))\b/i,
  /\b(gonna|going\s+to|plan\s+to|want\s+to|about\s+to|will|need\s+to|have\s+to)\b/i,
];

export const EN_NEGATED_OR_NOT_OCCURRED_PATTERNS = [
  /\b(not|never)\s+(working|studying|coding|running|walking|exercising|doing)\b/i,
  /\b(didn't|did not|haven't|have not|couldn't|could not|wasn't|was not)\s+(work|study|exercise|go|finish|start)\b/i,
  /\b(no\s+progress|nothing\s+done|got\s+nothing\s+done)\b/i,
  /\b(wanted\s+to|planned\s+to)\s+.+\s+but\s+(didn't|did not|couldn't|could not)\b/i,
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
