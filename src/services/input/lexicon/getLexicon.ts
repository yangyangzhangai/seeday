// DOC-DEPS: LLM.md -> docs/ACTIVITY_LEXICON.md -> docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md
//
// Central factory for per-language lexicon bundles.
// Consumers should call getLexicon(lang) instead of importing language files directly.
// This keeps the language-switching logic in one place and makes adding a new
// language a single-file change (add the imports + the LEXICONS entry below).

import type { ActivityLexicon, CategoryLexicon, LanguageLexicon, MoodLexicon } from './types';

import { zhActivityLexicon } from './activityLexicon.zh';
import { enActivityLexicon } from './activityLexicon.en';
import { itActivityLexicon } from './activityLexicon.it';

import { zhMoodLexicon } from './moodLexicon.zh';
import { enMoodLexicon } from './moodLexicon.en';
import { itMoodLexicon } from './moodLexicon.it';

import { zhCategoryLexicon } from './categoryLexicon.zh';
import { enCategoryLexicon } from './categoryLexicon.en';
import { itCategoryLexicon } from './categoryLexicon.it';

// ─── Combined bundles ─────────────────────────────────────────────────────────

const LEXICONS: Record<'zh' | 'en' | 'it', LanguageLexicon> = {
  zh: { lang: 'zh', activity: zhActivityLexicon, mood: zhMoodLexicon, category: zhCategoryLexicon },
  en: { lang: 'en', activity: enActivityLexicon, mood: enMoodLexicon, category: enCategoryLexicon },
  it: { lang: 'it', activity: itActivityLexicon, mood: itMoodLexicon, category: itCategoryLexicon },
};

// ─── Public API ───────────────────────────────────────────────────────────────

export type SupportedLang = 'zh' | 'en' | 'it';

export function getLexicon(lang: SupportedLang): LanguageLexicon {
  return LEXICONS[lang];
}

export function getMoodLexicon(lang: SupportedLang): MoodLexicon {
  return LEXICONS[lang].mood;
}

export function getCategoryLexicon(lang: SupportedLang): CategoryLexicon {
  return LEXICONS[lang].category;
}

export function getActivityLexicon(lang: SupportedLang): ActivityLexicon {
  return LEXICONS[lang].activity;
}
