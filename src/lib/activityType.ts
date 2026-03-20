import { getCategoryLexicon, type SupportedLang } from '../services/input/lexicon/getLexicon';
import { zhCategoryLexicon } from '../services/input/lexicon/categoryLexicon.zh';

export const ACTIVITY_RECORD_TYPES = [
  'study',
  'work',
  'social',
  'life',
  'entertainment',
  'health',
] as const;

export type ActivityRecordType = (typeof ACTIVITY_RECORD_TYPES)[number];
export type ActivityType = ActivityRecordType | 'chat' | 'mood';
export type ActivityTypeConfidence = 'high' | 'medium' | 'low';

interface ActivityTypeResult {
  activityType: ActivityRecordType;
  confidence: ActivityTypeConfidence;
}

// Derived from zhCategoryLexicon for backward-compatible isStudyLike() calls.
const STUDY_HINTS: readonly string[] = zhCategoryLexicon.keywords.study;



const CHAT_OR_MOOD_TYPES = new Set(['chat', 'mood']);
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

function includesAnyKeyword(input: string, keywords: string[]): number {
  let score = 0;
  for (const keyword of keywords) {
    if (input.includes(keyword.toLowerCase())) {
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
    const score = includesAnyKeyword(normalized, keywords[type] as string[]);
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

export function mapClassifierCategoryToActivityType(
  category?: string | null,
  content?: string | null,
): ActivityRecordType {
  const normalizedCategory = (category ?? '').trim().toLowerCase();
  const normalizedContent = (content ?? '').trim().toLowerCase();

  if (!normalizedCategory) {
    return classifyRecordActivityType(normalizedContent).activityType;
  }

  if (normalizedCategory === 'deep_focus') {
    return resolveWorkOrStudy(normalizedContent);
  }
  if (normalizedCategory === 'necessary') return 'life';
  if (normalizedCategory === 'body') return 'health';
  if (normalizedCategory === 'social_duty') return 'social';
  if (normalizedCategory === 'self_talk') return 'life';
  if (normalizedCategory === 'dopamine') return 'entertainment';
  if (normalizedCategory === 'dissolved') return 'life';
  if (normalizedCategory === 'recharge') {
    const socialWords = getCategoryLexicon('zh').keywords.social as string[];
    if (socialWords.some((word) => normalizedContent.includes(word.toLowerCase()))) {
      return 'social';
    }
    return 'entertainment';
  }
  return classifyRecordActivityType(normalizedContent).activityType;
}

export function normalizeActivityType(
  value?: string | null,
  content?: string | null,
): ActivityType {
  const normalizedValue = (value ?? '').trim().toLowerCase();
  const normalizedContent = (content ?? '').trim().toLowerCase();

  if (!normalizedValue) {
    return classifyRecordActivityType(normalizedContent).activityType;
  }

  if (CHAT_OR_MOOD_TYPES.has(normalizedValue)) {
    return normalizedValue as ActivityType;
  }

  if (RECORD_TYPES.has(normalizedValue as ActivityRecordType)) {
    return normalizedValue as ActivityRecordType;
  }

  const legacyMapped = LEGACY_TO_RECORD_TYPE[normalizedValue];
  if (!legacyMapped) {
    return classifyRecordActivityType(normalizedContent).activityType;
  }

  if (legacyMapped === 'work_or_study') {
    return resolveWorkOrStudy(normalizedContent);
  }

  if (normalizedValue === 'unknown' || normalizedValue === '待分类' || normalizedValue === '未分类') {
    return classifyRecordActivityType(normalizedContent).activityType;
  }

  return legacyMapped;
}

export function normalizeTodoCategory(category?: string | null, title?: string | null): ActivityRecordType {
  return normalizeActivityType(category, title) as ActivityRecordType;
}
