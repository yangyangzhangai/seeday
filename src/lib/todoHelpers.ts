const CATEGORY_LABEL_KEYS: Record<string, string> = {
  study: 'category_study',
  work: 'category_work',
  social: 'category_social',
  life: 'category_life',
  entertainment: 'category_entertainment',
  health: 'category_health',
  学习: 'category_study',
  工作: 'category_work',
  社交: 'category_social',
  生活: 'category_life',
  娱乐: 'category_entertainment',
  健康: 'category_health',
};

export function getCategoryLabel(key: string, t: (translationKey: string) => string): string {
  const translationKey = CATEGORY_LABEL_KEYS[key];
  return translationKey ? t(translationKey) : key;
}
