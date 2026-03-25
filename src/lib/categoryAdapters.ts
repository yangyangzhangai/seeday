import { classifyRecordActivityType, type ActivityRecordType } from './activityType';
import { getCategoryLexicon, type SupportedLang } from '../services/input/lexicon/getLexicon';

/** @deprecated Use ACTIVITY_RECORD_TYPES from activityType.ts instead */
export const DIARY_CLASSIFIER_CATEGORIES = [
  'study',
  'work',
  'social',
  'life',
  'entertainment',
  'health',
] as const;

export type DiaryClassifierCategory = (typeof DIARY_CLASSIFIER_CATEGORIES)[number];

function resolveWorkOrStudyByContent(content: string, lang: SupportedLang): ActivityRecordType {
  const normalized = content.toLowerCase();
  const studyHints = getCategoryLexicon(lang).keywords.study;
  return studyHints.some((hint) => normalized.includes(hint.toLowerCase())) ? 'study' : 'work';
}

export function mapDiaryClassifierCategoryToActivityType(
  category?: string | null,
  content?: string | null,
  lang: SupportedLang = 'zh',
): ActivityRecordType {
  const normalizedCategory = (category ?? '').trim().toLowerCase();
  const normalizedContent = (content ?? '').trim().toLowerCase();

  if (!normalizedCategory) {
    return classifyRecordActivityType(normalizedContent, lang).activityType;
  }

  if (normalizedCategory === 'deep_focus') {
    return resolveWorkOrStudyByContent(normalizedContent, lang);
  }
  if (normalizedCategory === 'necessary') return 'life';
  if (normalizedCategory === 'body') return 'health';
  if (normalizedCategory === 'social_duty') return 'social';
  if (normalizedCategory === 'self_talk') return 'life';
  if (normalizedCategory === 'dopamine') return 'entertainment';
  if (normalizedCategory === 'dissolved' || normalizedCategory === 'unknown') {
    return classifyRecordActivityType(normalizedContent, lang).activityType;
  }
  if (normalizedCategory === 'recharge') {
    const socialWords = getCategoryLexicon(lang).keywords.social;
    if (socialWords.some((word) => normalizedContent.includes(word.toLowerCase()))) {
      return 'social';
    }
    return 'entertainment';
  }

  return classifyRecordActivityType(normalizedContent, lang).activityType;
}

export const mapClassifierCategoryToActivityType = mapDiaryClassifierCategoryToActivityType;
