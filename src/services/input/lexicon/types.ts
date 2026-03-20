// DOC-DEPS: LLM.md -> docs/ACTIVITY_LEXICON.md -> docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md
//
// Language-agnostic interfaces for the shared lexicon system.
// Each supported language (zh / en / it) implements all three interfaces.
// Consumers should import from getLexicon.ts rather than from language files directly.

import type { MoodKey } from '../../../lib/moodOptions';
import type { ActivityRecordType } from '../../../lib/activityType';

// ─── Activity ────────────────────────────────────────────────────────────────

/**
 * Core activity vocabulary for a language.
 *
 * strongPhrases – complete, self-contained activity phrases that can be matched
 *   verbatim (e.g. "开会", "running", "riunione").  Each phrase MUST be ≥ 2
 *   characters / tokens so it never fires on coincidental single-char matches.
 *
 * verbs – bare root verbs that only confirm an activity when paired with an
 *   object from ZH_ACTIVITY_OBJECTS (Chinese-specific).  For EN/IT this list
 *   is empty; all vocabulary lives in strongPhrases.
 */
export interface ActivityLexicon {
  strongPhrases: readonly string[];
  verbs: readonly string[];
}

// ─── Mood ────────────────────────────────────────────────────────────────────

/**
 * A single mood-mapping rule: a regex to test against the input text and the
 * MoodKey it resolves to on a match.
 */
export interface MoodRule {
  pattern: RegExp;
  mood: MoodKey;
}

/**
 * Full mood vocabulary for one language.
 *
 * explicitMoodMap   – words / phrases that *directly* name an emotional state
 *                     ("tired", "烦", "stanco").  Checked first.
 * activityMoodMap   – activity keywords that imply a probable mood when no
 *                     explicit mood word is present ("running" → happy).
 * allMoodWords      – flat list of all mood-signal words (used for fast
 *                     "does this text contain a mood signal?" checks).
 * moodSentencePatterns – regex patterns matching full mood-bearing sentence
 *                       structures ("feel very tired", "好累啊", "mi sento stanco").
 */
export interface MoodLexicon {
  explicitMoodMap: readonly MoodRule[];
  activityMoodMap: readonly MoodRule[];
  allMoodWords: readonly string[];
  moodSentencePatterns: readonly RegExp[];
}

// ─── Category ────────────────────────────────────────────────────────────────

/**
 * Classification vocabulary for one language.
 * Maps every ActivityRecordType to an array of keywords that signal membership
 * of that category.  Scoring is additive: longer keywords score higher.
 */
export interface CategoryLexicon {
  keywords: Record<ActivityRecordType, readonly string[]>;
}

// ─── Combined per-language bundle ─────────────────────────────────────────────

export interface LanguageLexicon {
  lang: 'zh' | 'en' | 'it';
  activity: ActivityLexicon;
  mood: MoodLexicon;
  category: CategoryLexicon;
}
