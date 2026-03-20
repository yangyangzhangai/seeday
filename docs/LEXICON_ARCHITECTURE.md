# Lexicon Architecture Spec

> **Goal**: Provide a clean, unified, and multi-language codebase for all activity and mood classification.

## 1. Directory Structure

All lexicon-related logic is centralized in `src/services/input/lexicon/`.

```text
lexicon/
├── types.ts           # Lexicon Interfaces (Activity, Mood, Category)
├── getLexicon.ts      # Factory & Language Switching Node
├── activityLexicon.zh.ts # Activity terms (Strong Phrases & Verbs)
├── activityLexicon.en.ts
├── activityLexicon.it.ts
├── moodLexicon.zh.ts     # Mood words, Infer-from-Activity patterns, Sentences
├── moodLexicon.en.ts
├── moodLexicon.it.ts
├── categoryLexicon.zh.ts # Classification keywords (Life, Work, Study...)
├── categoryLexicon.en.ts
└── categoryLexicon.it.ts
```

## 2. Core Interfaces (`types.ts`)

### `ActivityLexicon`
Handles the base activity vocabulary.
- `strongPhrases`: Multi-character terms that are always activities (e.g., `开会`, `shopping`).
- `verbs`: Single-character verbs (ZH) or base action stems (EN/IT) that usually require an object.

### `MoodLexicon`
Handles mood-related classification and inference.
- `explicitMoodMap`: Direct mapping from word to `MoodKey` (e.g., `happy`, `tired`).
- `activityMoodMap`: Inference rules for activities that imply a mood (e.g., `meeting` -> `focused`).
- `allMoodWords`: Flat list of all mood signals for fast boolean checks.
- `moodSentencePatterns`: Regexes for full sentence mood patterns (e.g., `I feel...`, `好...`).

### `CategoryLexicon`
Handles categorical classification. Maps `ActivityCategory` keys (work, study, gym, life, etc.) to lists of keywords.

## 3. The Factory Pattern (`getLexicon.ts`)

The `getLexicon(lang)` function is the primary entry point. It returns a `LanguageLexicon` object containing the activity, mood, and category bundles for the requested language.

```typescript
import { getLexicon } from './lexicon/getLexicon';

const lexicon = getLexicon('zh');
// Use lexicon.activity, lexicon.mood, etc.
```

## 4. Multi-language Support

The system is designed to be language-aware without duplicating logic:

1.  **Chinese (ZH)**: Robust regex-based parsing for non-spaced phrases.
2.  **English (EN)** & **Italian (IT)**: Space-aware matching and stem-based verb recognition.

## 5. Coding Standards & Maintenance

1.  **No Logic in Lexicon**: Lexicon files should contain ONLY data (objects, arrays, strings). Use `types.ts` to enforce structure.
2.  **SSOT**: Never hardcode keywords for activity classification or mood inference inside `.ts` components or other library files. Always source from the Lexicon.
3.  **Default to ZH**: To maintain backward compatibility, functions like `autoDetectMood` or `classifyRecordActivityType` default to `'zh'` if no language is specified.
4.  **Testing**: Always run `liveInputClassifier.test.ts` after updating the lexicon to ensure no regressions in classification logic.
