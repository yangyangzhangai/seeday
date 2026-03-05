import type { TFunction } from 'i18next';

export const MOOD_KEYS = [
  'happy',
  'calm',
  'focused',
  'satisfied',
  'tired',
  'anxious',
  'bored',
  'down',
] as const;

export type MoodKey = (typeof MOOD_KEYS)[number];

const LEGACY_LABEL_TO_KEY: Record<string, MoodKey> = {
  开心: 'happy',
  平静: 'calm',
  专注: 'focused',
  满足: 'satisfied',
  疲惫: 'tired',
  焦虑: 'anxious',
  无聊: 'bored',
  低落: 'down',
};

const KEY_TO_LEGACY_LABEL: Record<MoodKey, string> = {
  happy: '开心',
  calm: '平静',
  focused: '专注',
  satisfied: '满足',
  tired: '疲惫',
  anxious: '焦虑',
  bored: '无聊',
  down: '低落',
};

const KEY_TO_I18N: Record<MoodKey, string> = {
  happy: 'mood_happy',
  calm: 'mood_calm',
  focused: 'mood_focused',
  satisfied: 'mood_satisfied',
  tired: 'mood_tired',
  anxious: 'mood_anxious',
  bored: 'mood_bored',
  down: 'mood_down',
};

export function normalizeMoodKey(value?: string | null): MoodKey | undefined {
  if (!value) return undefined;
  if ((MOOD_KEYS as readonly string[]).includes(value)) {
    return value as MoodKey;
  }
  return LEGACY_LABEL_TO_KEY[value];
}

export function moodKeyToLegacyLabel(value: MoodKey): string {
  return KEY_TO_LEGACY_LABEL[value];
}

export function getMoodI18nKey(value?: string | null): string | undefined {
  const key = normalizeMoodKey(value);
  return key ? KEY_TO_I18N[key] : undefined;
}

export function getMoodDisplayLabel(value: string | undefined, t: TFunction): string {
  const key = getMoodI18nKey(value);
  if (!key) return value || '';
  return t(key);
}
