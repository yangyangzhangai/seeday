// DOC-DEPS: LLM.md -> docs/MAGIC_PEN_CAPTURE_SPEC.md -> src/features/chat/README.md
import { classifyLiveInput } from './liveInputClassifier';
import type { LiveInputContext } from './types';

export type MagicPenClauseRoute = 'realtime' | 'magic' | 'uncertain';

export interface MagicPenClauseRouterResult {
  realtimeClauses: string[];
  magicClauses: string[];
  uncertainClauses: string[];
}

interface MagicPenClauseRouterOptions {
  lang?: string;
  now?: number;
  recentActivity?: LiveInputContext['recentActivity'];
}

const ROUTER_PUNCT_SPLITTER = /[，。！？；;!?\n]/;

const ZH_CONNECTORS = ['然后', '后来', '并且', '而且', '同时', '另外', '以及'];
const EN_CONNECTORS = [' and then ', ' then ', ' afterwards ', ' later '];
const IT_CONNECTORS = [' e poi ', ' poi ', ' dopo ', ' successivamente '];
const ZH_MIXED_BOUNDARY_CONNECTORS = ['和', '还有'];

const ZH_REALTIME_NOW_SIGNALS = ['现在', '正在', '此刻', '刚在'];
const EN_REALTIME_NOW_SIGNALS = ['now', 'right now', 'currently'];
const IT_REALTIME_NOW_SIGNALS = ['adesso', 'ora', 'in questo momento'];

const ZH_MOOD_SIGNALS = ['心情', '难过', '开心', '烦', '累', '焦虑', '紧张', '生气', '低落', '快乐'];
const EN_MOOD_SIGNALS = ['feel', 'tired', 'sad', 'happy', 'upset', 'stressed', 'anxious'];
const IT_MOOD_SIGNALS = ['mi sento', 'stanco', 'triste', 'felice', 'stressato', 'ansioso', 'arrabbiato'];

const ZH_TODO_SIGNALS = [
  '明天',
  '后天',
  '下周',
  '待会',
  '稍后',
  '晚点',
  '记得',
  '提醒我',
  '别忘了',
  '还要',
  '要',
  '需要',
];
const EN_TODO_SIGNALS = ['tomorrow', 'later', 'remember to', 'need to', 'have to', 'next week'];
const IT_TODO_SIGNALS = ['domani', 'piu tardi', 'più tardi', 'ricordami', 'devo', 'settimana prossima'];

const ZH_BACKFILL_SIGNALS = ['上午', '下午', '晚上', '中午', '今早', '早上', '刚刚', '刚才', '已经', '做完', '开完'];
const EN_BACKFILL_SIGNALS = ['this morning', 'in the morning', 'this afternoon', 'tonight', 'earlier', 'already'];
const IT_BACKFILL_SIGNALS = ['stamattina', 'nel pomeriggio', 'stasera', 'prima', 'appena', 'gia', 'già'];
const ZH_SECONDARY_CLAUSE_START_TOKENS = Array.from(
  new Set([
    ...ZH_REALTIME_NOW_SIGNALS,
    ...ZH_TODO_SIGNALS,
    ...ZH_BACKFILL_SIGNALS,
    '我现在',
    '我正在',
    '我刚在',
    '我好',
    '我很',
    '我有点',
    '我心情',
    '心情',
  ]),
);

function includesAny(input: string, signals: string[]): boolean {
  return signals.some((token) => input.includes(token));
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeClause(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

function splitByConnectors(segment: string, connectors: string[]): string[] {
  if (!segment) return [];
  let parts = [segment];
  for (const connector of connectors) {
    const next: string[] = [];
    for (const part of parts) {
      if (!part.includes(connector)) {
        next.push(part);
        continue;
      }
      const split = part
        .split(connector)
        .map((piece) => piece.trim())
        .filter(Boolean);
      next.push(...split);
    }
    parts = next;
  }
  return parts.map(normalizeClause).filter(Boolean);
}

function splitClauses(rawText: string, lang: 'zh' | 'en' | 'it' | 'unsupported'): string[] {
  const coarse = rawText
    .trim()
    .split(ROUTER_PUNCT_SPLITTER)
    .map(normalizeClause)
    .filter(Boolean);

  if (coarse.length === 0) {
    return [];
  }

  const connectors =
    lang === 'zh' ? ZH_CONNECTORS : lang === 'en' ? EN_CONNECTORS : lang === 'it' ? IT_CONNECTORS : [];

  return coarse.flatMap((segment) => splitByConnectors(segment, connectors));
}

function resolveLang(lang?: string): 'zh' | 'en' | 'it' | 'unsupported' {
  if (!lang) return 'zh';
  const normalized = lang.toLowerCase();
  if (normalized === 'zh' || normalized === 'en' || normalized === 'it') {
    return normalized;
  }
  return 'unsupported';
}

function hasTodoSignal(clause: string, lang: 'zh' | 'en' | 'it' | 'unsupported'): boolean {
  if (lang === 'zh') {
    return includesAny(clause, ZH_TODO_SIGNALS) || /(\d{1,2}[.-]\d{1,2}|\d{1,2}月\d{1,2}(?:日|号)?)/.test(clause);
  }
  if (lang === 'en') {
    return includesAny(clause.toLowerCase(), EN_TODO_SIGNALS);
  }
  if (lang === 'it') {
    return includesAny(clause.toLowerCase(), IT_TODO_SIGNALS);
  }
  return false;
}

function hasBackfillSignal(clause: string, lang: 'zh' | 'en' | 'it' | 'unsupported'): boolean {
  if (lang === 'zh') {
    return includesAny(clause, ZH_BACKFILL_SIGNALS) || /(\d{1,2}[:：]\d{1,2}|\d{1,2}点)/.test(clause);
  }
  if (lang === 'en') {
    return includesAny(clause.toLowerCase(), EN_BACKFILL_SIGNALS) || /\b\d{1,2}:\d{2}\b/.test(clause);
  }
  if (lang === 'it') {
    return includesAny(clause.toLowerCase(), IT_BACKFILL_SIGNALS) || /\b\d{1,2}:\d{2}\b/.test(clause);
  }
  return false;
}

function hasRealtimeNowSignal(clause: string, lang: 'zh' | 'en' | 'it' | 'unsupported'): boolean {
  if (lang === 'zh') return includesAny(clause, ZH_REALTIME_NOW_SIGNALS);
  const lowered = clause.toLowerCase();
  if (lang === 'en') return includesAny(lowered, EN_REALTIME_NOW_SIGNALS);
  if (lang === 'it') return includesAny(lowered, IT_REALTIME_NOW_SIGNALS);
  return false;
}

function hasDirectMoodSignal(clause: string, lang: 'zh' | 'en' | 'it' | 'unsupported'): boolean {
  if (lang === 'zh') return includesAny(clause, ZH_MOOD_SIGNALS);
  const lowered = clause.toLowerCase();
  if (lang === 'en') return includesAny(lowered, EN_MOOD_SIGNALS);
  if (lang === 'it') return includesAny(lowered, IT_MOOD_SIGNALS);
  return false;
}

function hasImplicitRealtimeSubjectSignal(
  clause: string,
  lang: 'zh' | 'en' | 'it' | 'unsupported',
): boolean {
  if (lang !== 'zh') {
    return false;
  }
  return /^我?在/.test(clause);
}

function routeClauseWithoutMixedSplit(
  clause: string,
  lang: 'zh' | 'en' | 'it' | 'unsupported',
  context: LiveInputContext,
): MagicPenClauseRoute {
  if (hasTodoSignal(clause, lang) || hasBackfillSignal(clause, lang)) {
    return 'magic';
  }

  if (lang === 'unsupported') {
    return 'uncertain';
  }

  const classification = classifyLiveInput(clause, context);
  const mediumOrHigh = classification.confidence === 'high' || classification.confidence === 'medium';
  const realtimeMood =
    (classification.kind === 'mood' && mediumOrHigh) ||
    hasDirectMoodSignal(clause, lang);
  const implicitRealtimeSubject = hasImplicitRealtimeSubjectSignal(clause, lang);
  const realtimeActivity =
    (classification.kind === 'activity' &&
      mediumOrHigh &&
      (
        hasRealtimeNowSignal(clause, lang)
        || classification.reasons.includes('matched_ongoing_signal')
        || implicitRealtimeSubject
      )) ||
    (hasRealtimeNowSignal(clause, lang) && !hasDirectMoodSignal(clause, lang));

  if (realtimeMood || realtimeActivity) {
    return 'realtime';
  }

  return 'uncertain';
}

function buildZhMixedSplitCandidates(clause: string): Array<[string, string]> {
  if (!includesAny(clause, ZH_MIXED_BOUNDARY_CONNECTORS)) {
    return [];
  }

  const connectorPattern = ZH_MIXED_BOUNDARY_CONNECTORS
    .map(escapeRegExp)
    .join('|');
  const startTokenPattern = ZH_SECONDARY_CLAUSE_START_TOKENS
    .slice()
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|');
  const boundaryPattern = new RegExp(`(${connectorPattern})(?=${startTokenPattern})`, 'g');

  const candidates: Array<[string, string]> = [];
  for (const match of clause.matchAll(boundaryPattern)) {
    const connector = match[1];
    const index = match.index ?? -1;
    if (index <= 0) continue;
    const head = normalizeClause(clause.slice(0, index));
    const tail = normalizeClause(clause.slice(index + connector.length));
    if (head && tail) {
      candidates.push([head, tail]);
    }
  }
  return candidates;
}

function expandMixedClause(
  clause: string,
  lang: 'zh' | 'en' | 'it' | 'unsupported',
  context: LiveInputContext,
): string[] {
  if (lang !== 'zh') {
    return [clause];
  }

  for (const [head, tail] of buildZhMixedSplitCandidates(clause)) {
    const headRoute = routeClauseWithoutMixedSplit(head, lang, context);
    const tailRoute = routeClauseWithoutMixedSplit(tail, lang, context);
    if (headRoute === 'uncertain' || tailRoute === 'uncertain') {
      continue;
    }
    return [
      ...expandMixedClause(head, lang, context),
      ...expandMixedClause(tail, lang, context),
    ];
  }

  return [clause];
}

export function routeMagicPenClauses(
  rawText: string,
  options: MagicPenClauseRouterOptions = {},
): MagicPenClauseRouterResult {
  const lang = resolveLang(options.lang);
  const clauses = splitClauses(rawText, lang);
  const result: MagicPenClauseRouterResult = {
    realtimeClauses: [],
    magicClauses: [],
    uncertainClauses: [],
  };

  const context: LiveInputContext = {
    now: options.now ?? Date.now(),
    recentActivity: options.recentActivity,
  };

  for (const clause of clauses) {
    const expandedClauses = expandMixedClause(clause, lang, context);
    for (const expandedClause of expandedClauses) {
      const route = routeClauseWithoutMixedSplit(expandedClause, lang, context);
      if (route === 'magic') {
        result.magicClauses.push(expandedClause);
      } else if (route === 'realtime') {
        result.realtimeClauses.push(expandedClause);
      } else {
        result.uncertainClauses.push(expandedClause);
      }
    }
  }

  return result;
}
