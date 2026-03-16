# Activity Lexicon (ZH)

## Goal

- Keep one shared source of truth for Chinese activity lexicon.
- Ensure live input classification and Magic Pen fallback use the same base dictionary.

## Source of Truth

- Core file: `src/services/input/activityLexicon.zh.ts`
- Shared exports:
  - `ZH_SHARED_ACTIVITY_STRONG_PHRASES`
  - `ZH_SHARED_ACTIVITY_VERBS`

## Consumers

- Live input rules: `src/services/input/liveInputRules.zh.ts`
  - Re-exports shared lists as `ZH_ACTIVITY_STRONG_PHRASES` and `ZH_ACTIVITY_VERBS`.
- Magic Pen rules: `src/services/input/magicPenRules.zh.ts`
  - Builds `ZH_MAGIC_PEN_ACTIVITY_VERBS` from shared lists plus Magic Pen specific additions.

## Maintenance Rules

- Add new generic activity terms to `activityLexicon.zh.ts` first.
- Only add terms directly in consumer files when they are strategy-specific.
- Add or update tests when introducing new terms that affect classification.
