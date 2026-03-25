// DOC-DEPS: LLM.md -> docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md -> src/features/chat/README.md

import { getActivityLexicon, getMoodLexicon } from './lexicon/getLexicon.js';

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
  /\b(just\s+)?got\s+home\b/i,
  /\b(went|headed\s+out)\s+for\s+(a\s+)?(run|walk)\b/i,
  /\b(out\s+for\s+(a\s+)?coffee)\b/i,
  /\b(grabbing|grabbed|having|had)\s+(a\s+)?coffee\b/i,
  /\b(writing|working\s+on|reviewing)\s+(the\s+)?(report|doc|assignment|ticket|code)\b/i,
  /\b(sending|replying\s+to|answering)\s+(emails?|messages?)\b/i,
  /\b(preparing|building|drafting|updating)\s+(a\s+|the\s+)?(presentation|slides|roadmap|report|doc|deck)\b/i,
  /\b(deep\s+in|buried\s+in)\s+(a\s+|the\s+|my\s+)?(doc|deck|report|paperwork|spreadsheet|inbox)\b/i,
  /\b(finishing\s+up|wrapping\s+up|polishing)\s+(a\s+|the\s+|my\s+)?(deck|doc|report|paper|slides?)\b/i,
  /\b(doing|having|in)\s+(a\s+)?(1:1|1:1s|one-on-one|one-on-ones|one\s+on\s+one|one\s+on\s+ones|sync|sync-up)\b/i,
  /\b(in\s+(a\s+)?)sync\b/i,
  /\b(grinding\s+through|working\s+through)\s+(my\s+)?(inbox|emails?)\b/i,
  /\b(just\s+)?sent\s+(the\s+|my\s+)?((weekly|status)\s+)?(update|report|deck|slides?|doc|paper)\b/i,
  /\b(debugging|fixing|testing)\b/i,
  /\b(just\s+)?(pushed|shipped|deployed|released)\s+(a\s+|the\s+)?(fix|feature|update)\b/i,
  /\b(driving|taking)\s+(a\s+)?(taxi|bus|train|subway)\b/i,
  /\b(commuting|on\s+the\s+way\s+to)\s+(work|office|school|gym)\b/i,
  /\b(doing|finished|did)\s+(the\s+)?(laundry|cleaning|dishes|meal\s+prep|grocery\s+shopping)\b/i,
  /\b(doing|working\s+on)\s+(my\s+)?homework\b/i,
  /\b(cramming)\s+for\s+(my\s+|the\s+)?(exam|quiz|test|midterm|final)\b/i,
  /\b(in|at)\s+(class|lecture|lab)\b/i,
  /\b(doing|reviewing)\s+(anki\s+)?flashcards\b/i,
  /\b(office\s+hours?)\b/i,
  /\b(taking|took)\s+(a\s+)?shower\b/i,
  /\b(just\s+)?woke\s+up\b/i,
  /\b(getting|got)\s+ready\s+for\s+bed\b/i,
  /\b(picking\s+up|picked\s+up)\s+(my\s+)?order\b/i,
  /\b(playing|played)\s+(football|soccer|basketball|badminton|tennis|ping\s+pong)\b/i,
  /\b(swimming|hiking|cycling|biking|doing\s+yoga|doing\s+pilates|stretching)\b/i,
  /\b(did|ran)\s+(a\s+)?\d+(k|km|mile|miles)\b/i,
  /\b(leg\s+day)\b/i,
  /\b(pr['’]?d)\s+(on\s+)?(deadlift|squat|bench)\b/i,
  /\b(watching|watched)\s+(a\s+)?(movie|series|tv\s+show|livestream)\b/i,
  /\b(listening\s+to)\s+(a\s+)?(podcast|music)\b/i,
  /\b(hanging\s+out|meeting|met|visiting|visited)\s+(friends|family)\b/i,
  /\b(catching\s+up)\s+with\s+(family|friends?)\b/i,
  /\b(calling|called)\s+(my\s+)?(mom|mother|dad|father|parents?|family|friend|friends)\b/i,
  /\b(on\s+(a\s+)?)date\b/i,
  /\b(met)\s+(an?\s+old\s+)?friend\b/i,
  /\b(went\s+to)\s+(a\s+)?(concert|museum|exhibition|cafe)\b/i,
  /\b(karaoke|board\s+games?|game\s+night|date\s+night)\b/i,
  /\b(chatting|chatted)\s+with\b/i,
  /\b(hanging\s+out|hung\s+out)\b/i,
  /\b(grabbing|grabbed|having|had)\s+(breakfast|lunch|dinner|brunch)\b/i,
  /\b(waiting\s+in\s+line)\b/i,
  /\b(back[-\s]?to[-\s]?back)\s+meetings\b/i,
  /\b(reading|read|finished\s+reading)\s+(a\s+)?(book|novel|chapter)\b/i,
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
  /\b(pulled\s+an\s+all[-\s]?nighter)\b/i,
  /\b(got\s+promoted)\b/i,
  /\b(wrapped\s+(the\s+)?)sprint\b/i,
  /\b(bombed|aced)\s+(that\s+|the\s+|my\s+)?(quiz|test|exam|midterm|final|presentation)\b/i,
];

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
];
