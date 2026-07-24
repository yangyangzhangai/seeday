// DOC-DEPS: LLM.md -> docs/MAGIC_PEN_CAPTURE_SPEC.md -> docs/ACTIVITY_LEXICON.md -> src/features/chat/README.md
import { getActivityLexicon, getMoodLexicon } from './lexicon/getLexicon';
import type { SupportedLang } from './lexicon/getLexicon';
import type { MagicPenDraftConfidence } from './magicPenTypes';

export type MagicPenFallbackKind =
  | 'realtime_activity'
  | 'realtime_mood'
  | 'todo_add'
  | 'activity_backfill'
  | 'unparsed';

export interface MagicPenFallbackDecision {
  kind: MagicPenFallbackKind;
  confidence: MagicPenDraftConfidence;
  linkedMoodContent?: string;
}

interface SemanticSignals {
  action: boolean;
  mood: boolean;
  realtime: boolean;
  past: boolean;
  future: boolean;
  intent: boolean;
  wish: boolean;
  negated: boolean;
  crossDay: boolean;
}

const LANGUAGE_PATTERNS: Record<SupportedLang, {
  realtime: RegExp;
  past: RegExp;
  future: RegExp;
  intent: RegExp;
  wish: RegExp;
  negated: RegExp;
  crossDay: RegExp;
  genericAction: RegExp;
}> = {
  zh: {
    realtime: /(?:现在|正在|正(?:在)?|还在|目前|此刻|这会儿)/,
    past: /(?:刚刚|刚才|已经|刚结束|做完|完成了|今天|今早|早上|上午|中午|下午|晚上)/,
    future: /(?:待会儿?|等会儿?|等下|一会儿?|稍后|晚点|之后|明天|后天|下周|本周|这周|本月|(?<![:：\d])\d{1,2}[.-]\d{1,2}(?!\s*(?:点|时|分)|[:：\d])|\d{1,2}月\d{1,2}(?:日|号)?)/,
    intent: /(?:记得|提醒我|别忘了|还要|需要|必须|应该|打算|计划|准备|(?:我)?得(?:先|马上|赶紧|去|做|写|改|买|交|发|回|整理|准备|学习|开会|吃饭|游泳|跑步)|(?:我)?要(?:去|做|写|改|买|交|发|回|整理|准备|学习|开会|吃饭|游泳|跑步))/,
    wish: /(?:希望|但愿|愿望|要是.+就好|想让自己|希望能)/,
    negated: /(?:不想|不打算|不会|不要|没在|没有在|并未|还没)/,
    crossDay: /(?:昨天|前天|上周|上个月|去年)/,
    genericAction: /(?:工作|上班|学习|开会|考试|旅游|旅行|复查|写|改|做|买|交|发|回|整理|准备|吃饭|游泳|跑步|运动|健身|通勤|看电影|打电话|做饭)/,
  },
  en: {
    realtime: /\b(?:right now|currently|at the moment|i am|i'm|im|we are|we're)\b/i,
    past: /\b(?:just|earlier|today|this morning|this afternoon|this evening|finished|completed|wrapped up|worked|studied|went|had|did)\b/i,
    future: /\b(?:later|soon|tomorrow|next week|afterwards)\b/i,
    intent: /\b(?:need to|have to|must|should|remember to|plan to|planning to|going to|will)\b/i,
    wish: /\b(?:i hope|hopefully|i wish|wish i|if only|hope to feel)\b/i,
    negated: /\b(?:do not|don't|did not|didn't|am not|i'm not|not going to|won't|cannot|can't)\b/i,
    crossDay: /\b(?:yesterday|the day before|last week|last month|last year)\b/i,
    genericAction: /\b(?:work|study|meet|submit|send|reply|write|edit|buy|eat|cook|swim|run|exercise|call|clean|prepare|finish|review)\w*\b/i,
  },
  it: {
    realtime: /\b(?:adesso|ora|in questo momento|sto|stiamo|sono)\b/i,
    past: /\b(?:appena|prima|oggi|stamattina|nel pomeriggio|stasera|ho finito|ho lavorato|ho studiato|sono andat[oa]|ho fatto)\b/i,
    future: /\b(?:pi[uù] tardi|tra poco|domani|dopodomani|la prossima settimana|dopo)\b/i,
    intent: /\b(?:devo|devi|dobbiamo|bisogna|ricorda|ricordati|ho bisogno di|intendo|penso di|andr[oò]|voglio)\b/i,
    wish: /\b(?:spero|magari|vorrei sentirmi|se solo|mi auguro)\b/i,
    negated: /\b(?:non voglio|non devo|non sto|non sono|non ho|non far[oò]|non posso)\b/i,
    crossDay: /\b(?:ieri|l'altro ieri|la settimana scorsa|il mese scorso|l'anno scorso)\b/i,
    genericAction: /\b(?:lavor|studi|riunion|invi|scriv|modific|compr|mangi|cucin|nuot|corr|allen|chiam|pul|prepar|finisc|revision)\w*\b/i,
  },
};

const FUTURE_PERIODS: Record<SupportedLang, Array<{ pattern: RegExp; startHour: number }>> = {
  zh: [
    { pattern: /今早|早上/, startHour: 6 },
    { pattern: /上午/, startHour: 8 },
    { pattern: /中午/, startHour: 10 },
    { pattern: /下午/, startHour: 12 },
    { pattern: /晚上/, startHour: 17 },
    { pattern: /今晚|今夜/, startHour: 20 },
  ],
  en: [
    { pattern: /\bthis morning\b/i, startHour: 6 },
    { pattern: /\bthis afternoon\b/i, startHour: 12 },
    { pattern: /\bthis evening\b/i, startHour: 17 },
    { pattern: /\btonight\b/i, startHour: 20 },
  ],
  it: [
    { pattern: /\bstamattina\b/i, startHour: 6 },
    { pattern: /\bnel pomeriggio\b/i, startHour: 12 },
    { pattern: /\bquesta sera\b/i, startHour: 17 },
    { pattern: /\bstasera\b/i, startHour: 20 },
  ],
};

function testPattern(pattern: RegExp, text: string): boolean {
  pattern.lastIndex = 0;
  return pattern.test(text);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsNonZhPhrase(text: string, phrase: string): boolean {
  const boundaryPattern = new RegExp(
    `(?:^|[^\\p{L}\\p{N}])${escapeRegExp(phrase)}(?=$|[^\\p{L}\\p{N}])`,
    'iu',
  );
  return boundaryPattern.test(text);
}

function hasLexiconActivity(text: string, lang: SupportedLang): boolean {
  const lexicon = getActivityLexicon(lang);
  if (lexicon.phrasePatterns.some((pattern) => testPattern(pattern, text))) return true;
  const normalized = text.toLocaleLowerCase();
  return lexicon.strongPhrases.some((phrase) => {
    const candidate = phrase.toLocaleLowerCase().trim();
    if (candidate.length < 2) return false;
    if (lang === 'zh') return normalized.includes(candidate);
    return containsNonZhPhrase(normalized, candidate);
  });
}

function hasLexiconMood(text: string, lang: SupportedLang): boolean {
  const lexicon = getMoodLexicon(lang);
  return lexicon.explicitMoodMap.some(({ pattern }) => testPattern(pattern, text))
    || lexicon.moodSentencePatterns.some((pattern) => testPattern(pattern, text));
}

function hasFuturePeriod(text: string, now: Date, lang: SupportedLang): boolean {
  return FUTURE_PERIODS[lang].some(({ pattern, startHour }) => (
    testPattern(pattern, text) && now.getHours() < startHour
  ));
}

function extractClockHour(text: string, lang: SupportedLang): number | undefined {
  if (lang === 'zh') {
    const match = text.match(/(?:早上|上午|中午|下午|晚上)?\s*(\d{1,2})(?::\d{1,2}|：\d{1,2}|点)/);
    if (!match) return undefined;
    let hour = Number(match[1]);
    if (/(?:下午|晚上)/.test(text) && hour < 12) hour += 12;
    return hour;
  }
  const match = text.match(/\b(?:at\s+|alle\s+)?(\d{1,2})(?::\d{2})?\s*(am|pm)?\b/i);
  if (!match || (!match[2] && !/(?:at|alle)\s+/i.test(match[0]))) return undefined;
  let hour = Number(match[1]);
  if (match[2]?.toLowerCase() === 'pm' && hour < 12) hour += 12;
  if (match[2]?.toLowerCase() === 'am' && hour === 12) hour = 0;
  return hour;
}

function collectSignals(text: string, now: Date, lang: SupportedLang): SemanticSignals {
  const patterns = LANGUAGE_PATTERNS[lang];
  const clockHour = extractClockHour(text, lang);
  const futureClock = clockHour !== undefined && clockHour > now.getHours();
  const pastClock = clockHour !== undefined && clockHour <= now.getHours();
  return {
    action: hasLexiconActivity(text, lang) || testPattern(patterns.genericAction, text),
    mood: hasLexiconMood(text, lang),
    realtime: testPattern(patterns.realtime, text),
    past: pastClock || testPattern(patterns.past, text),
    future: futureClock || hasFuturePeriod(text, now, lang) || testPattern(patterns.future, text),
    intent: testPattern(patterns.intent, text),
    wish: testPattern(patterns.wish, text),
    negated: testPattern(patterns.negated, text),
    crossDay: testPattern(patterns.crossDay, text),
  };
}

function decideFromSignals(text: string, signals: SemanticSignals): MagicPenFallbackDecision {
  if (signals.crossDay || signals.wish || signals.negated) {
    return { kind: 'unparsed', confidence: 'low' };
  }
  if (signals.future || signals.intent) {
    return signals.action
      ? { kind: 'todo_add', confidence: signals.intent ? 'high' : 'medium' }
      : { kind: 'unparsed', confidence: 'low' };
  }
  if (signals.realtime && signals.action) {
    return {
      kind: 'realtime_activity',
      confidence: 'high',
      linkedMoodContent: signals.mood ? text : undefined,
    };
  }
  if (signals.mood) {
    return { kind: 'realtime_mood', confidence: 'high' };
  }
  if (signals.action && signals.past) {
    return { kind: 'activity_backfill', confidence: 'high' };
  }
  return { kind: 'unparsed', confidence: 'low' };
}

function splitWithPreservedConnectors(text: string, connector: RegExp): string[] {
  const marked = text.replace(connector, (match) => `\n${match} `);
  return marked.split(/\n+/).map((item) => item.trim()).filter(Boolean);
}

export function splitMagicPenFallbackSegments(text: string, lang: SupportedLang): string[] {
  const punctuationSplit = text
    .split(/(?:[。！？!?;\n]+|(?<!\d)\.(?!\d))/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (lang === 'zh') return punctuationSplit.flatMap((item) => item.split(/[，、；]/)).map((item) => item.trim()).filter(Boolean);
  if (lang === 'en') {
    return punctuationSplit.flatMap((item) => splitWithPreservedConnectors(
      item,
      /\b(?:and\s+later|and\s+then|then\s+(?=i\b|we\b)|afterwards\s+(?=i\b|we\b))\b/gi,
    ));
  }
  return punctuationSplit.flatMap((item) => splitWithPreservedConnectors(
    item,
    /\b(?:e\s+poi|poi\s+(?=devo\b|voglio\b|andr[oò]\b)|dopo\s+(?=devo\b|voglio\b|andr[oò]\b))\b/gi,
  ));
}

export function classifyMagicPenFallbackSegment(
  text: string,
  now: Date,
  lang: SupportedLang,
): MagicPenFallbackDecision {
  if (lang === 'zh' && /(?:很多事|好多事|各种事)/.test(text)) {
    return { kind: 'unparsed', confidence: 'low' };
  }
  return decideFromSignals(text, collectSignals(text, now, lang));
}
