import { getCategoryLexicon, type SupportedLang } from '../services/input/lexicon/getLexicon.js';
import { containsLatinSignal } from '../services/input/signals/latinSignalExtractor.js';
import { zhCategoryLexicon } from '../services/input/lexicon/categoryLexicon.zh.js';

export const ACTIVITY_RECORD_TYPES = [
  'study',
  'work',
  'social',
  'life',
  'entertainment',
  'health',
] as const;

export type ActivityRecordType = (typeof ACTIVITY_RECORD_TYPES)[number];
export type ActivityType = ActivityRecordType | 'mood';
export type ActivityTypeConfidence = 'high' | 'medium' | 'low';

interface ActivityTypeResult {
  activityType: ActivityRecordType;
  confidence: ActivityTypeConfidence;
}

// Derived from zhCategoryLexicon for backward-compatible isStudyLike() calls.
const STUDY_HINTS: readonly string[] = zhCategoryLexicon.keywords.study;
const SPECIAL_ACTIVITY_TYPES = new Set(['mood']);
const RECORD_TYPES = new Set<ActivityRecordType>(ACTIVITY_RECORD_TYPES);

const LEGACY_TO_RECORD_TYPE: Record<string, ActivityRecordType | 'work_or_study'> = {
  work_study: 'work_or_study',
  deep_focus: 'work_or_study',
  exercise: 'health',
  body: 'health',
  sport: 'health',
  social_duty: 'social',
  recharge: 'entertainment',
  dopamine: 'entertainment',
  necessary: 'life',
  self_talk: 'life',
  dissolved: 'life',
  unknown: 'life',
  '待分类': 'life',
  '未分类': 'life',
};

function includesAnyKeyword(input: string, keywords: string[], lang: SupportedLang): number {
  let score = 0;
  for (const keyword of keywords) {
    const matched =
      lang === 'zh'
        ? input.includes(keyword.toLowerCase())
        : containsLatinSignal(input, keyword);
    if (matched) {
      score += keyword.length >= 2 ? 2 : 1;
    }
  }
  return score;
}

function isStudyLike(input: string): boolean {
  return STUDY_HINTS.some((hint) => input.includes(hint.toLowerCase()));
}

function resolveWorkOrStudy(input: string): ActivityRecordType {
  return isStudyLike(input) ? 'study' : 'work';
}

export function isLegacyChatActivityType(value?: string | null): boolean {
  return (value ?? '').trim().toLowerCase() === 'chat';
}

export function classifyRecordActivityType(
  content?: string | null,
  lang: SupportedLang = 'zh',
): ActivityTypeResult {
  const normalized = (content ?? '').trim().toLowerCase();
  if (!normalized) {
    return { activityType: 'life', confidence: 'low' };
  }

  const keywords = getCategoryLexicon(lang).keywords;

  let bestType: ActivityRecordType = 'life';
  let bestScore = -1;
  let secondScore = -1;

  for (const type of ACTIVITY_RECORD_TYPES) {
    const score = includesAnyKeyword(normalized, keywords[type] as string[], lang);
    if (score > bestScore) {
      secondScore = bestScore;
      bestScore = score;
      bestType = type;
    } else if (score > secondScore) {
      secondScore = score;
    }
  }

  if (bestScore <= 0) {
    return { activityType: 'life', confidence: 'low' };
  }

  if (bestScore - secondScore >= 2) {
    return { activityType: bestType, confidence: 'high' };
  }

  return { activityType: bestType, confidence: 'medium' };
}

export function normalizeActivityType(
  value?: string | null,
  content?: string | null,
  lang: SupportedLang = 'zh',
): ActivityType {
  const normalizedValue = (value ?? '').trim().toLowerCase();
  const normalizedContent = (content ?? '').trim().toLowerCase();

  if (!normalizedValue) {
    return classifyRecordActivityType(normalizedContent, lang).activityType;
  }

  if (SPECIAL_ACTIVITY_TYPES.has(normalizedValue)) {
    return normalizedValue as ActivityType;
  }

  if (isLegacyChatActivityType(normalizedValue)) {
    return classifyRecordActivityType(normalizedContent, lang).activityType;
  }

  if (RECORD_TYPES.has(normalizedValue as ActivityRecordType)) {
    return normalizedValue as ActivityRecordType;
  }

  const legacyMapped = LEGACY_TO_RECORD_TYPE[normalizedValue];
  if (!legacyMapped) {
    return classifyRecordActivityType(normalizedContent, lang).activityType;
  }

  if (legacyMapped === 'work_or_study') {
    return resolveWorkOrStudy(normalizedContent);
  }

  if (normalizedValue === 'unknown' || normalizedValue === '待分类' || normalizedValue === '未分类') {
    return classifyRecordActivityType(normalizedContent, lang).activityType;
  }

  return legacyMapped;
}

export function normalizeTodoCategory(
  category?: string | null,
  title?: string | null,
  lang: SupportedLang = 'zh',
): ActivityRecordType {
  return normalizeActivityType(category, title, lang) as ActivityRecordType;
}
