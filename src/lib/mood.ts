// DOC-DEPS: LLM.md -> docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md -> docs/ACTIVITY_LEXICON.md
import type { MoodOption } from '../store/useMoodStore';
import { getMoodLexicon, type SupportedLang } from '../services/input/lexicon/getLexicon';

const options: MoodOption[] = ['happy', 'calm', 'focused', 'satisfied', 'tired', 'anxious', 'bored', 'down'];

/**
 * Infer a MoodOption from the content of an activity and its duration.
 *
 * Priority:
 *   1. Explicit mood words in the text (e.g. "开心", "tired", "felice")
 *   2. Activity keywords that imply a probable mood (e.g. "running" → happy)
 *   3. Duration heuristics (≥ 240 min → tired, ≥ 60 min → focused)
 *   4. Default: 'calm'
 *
 * Previously this function only recognised Chinese text.  It now accepts a
 * `lang` param (defaulting to 'zh' for backward compatibility) so that English
 * and Italian activities are inferred correctly.
 */
export function autoDetectMood(
  content: string,
  durationMin: number,
  lang: SupportedLang = 'zh',
): MoodOption {
  const lexicon = getMoodLexicon(lang);

  for (const rule of lexicon.explicitMoodMap) {
    if (rule.pattern.test(content)) return rule.mood;
  }

  for (const rule of lexicon.activityMoodMap) {
    if (rule.pattern.test(content)) return rule.mood;
  }

  if (durationMin >= 240) return 'tired';
  if (durationMin >= 60) return 'focused';
  return 'calm';
}

export function allMoodOptions(): MoodOption[] {
  return options;
}
