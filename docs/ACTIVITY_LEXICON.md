# Multi-language Lexicon System

## Goal

- Keep a unified, shared source of truth for all activity and mood related vocabulary.
- Ensure live input classification, Magic Pen fallback, and mood auto-detection use the same base dictionaries across all supported languages.
- Support **Chinese (ZH)**, **English (EN)**, and **Italian (IT)** with high consistency.

## Architecture

The lexicon system is centralized in `src/services/input/lexicon/`.

- **Interfaces**: `types.ts` defines the structure for all lexicons.
- **Service Factory**: `getLexicon.ts` provides language-specific lexicon bundles.
- **Language Data**:
  - `activityLexicon.{zh,en,it}.ts`: Core activity phrases and verbs.
  - `moodLexicon.{zh,en,it}.ts`: Mood signals, sentence patterns, and activity-to-mood inferences.
  - `categoryLexicon.{zh,en,it}.ts`: Keywords for activity classification (life, work, study, etc.).

## Source of Truth

- **Activity List**: `src/services/input/lexicon/activityLexicon.*.ts`
- **Mood List**: `src/services/input/lexicon/moodLexicon.*.ts`
- **Category Keywords**: `src/services/input/lexicon/categoryLexicon.*.ts`

## Consumers

- **Live Input Rules**: `src/services/input/liveInputRules.*.ts` imports from the lexicon to build regex patterns.
- **Magic Pen Rules**: `src/services/input/magicPenRules.*.ts` (ZH) utilizes shared activity lists for segment classification.
- **Mood Logic**: `src/lib/mood.ts` uses `moodLexicon` for language-aware mood inference.
- **Classification Logic**: `src/lib/activityType.ts` uses `categoryLexicon` for the multi-language `classifyRecordActivityType` function.

## Maintenance Rules

1. **Modify Lexicon First**: Always update the relevant file in `src/services/input/lexicon/` before modifying consumer logic.
2. **Multi-language Parity**: When adding a term in one language, consider if its equivalent should be added to other languages.
3. **Regex Safely**: When adding terms to `activityLexicon`, ensure they don't break existing patterns in `liveInputRules`.
4. **Test Coverage**: Update or add tests in `liveInputClassifier.test.ts` or `mood.test.ts` when modifying the lexicon.

For more details on the implementation details, see [Lexicon Architecture](./LEXICON_ARCHITECTURE.md).
