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

## ZH Activity Detection Layers

The Chinese classifier uses a multi-layer fallback to detect activity signals:

1. **`strongPhrases`** — exact multi-char match (e.g. `起床`, `开会`). Use for indivisible compound words.
2. **verb + object pair** — single verb from `ZH_ACTIVITY_VERBS` (e.g. `吃`) paired with an object from `ZH_ACTIVITY_OBJECTS` (e.g. `饭`).
3. **`ZH_ACTIVITY_SINGLE_VERB_PATTERNS`** — regex for special verb forms.
4. **2-char verbs** in `ZH_ACTIVITY_VERBS` matched standalone (e.g. `开会`).
5. **`zhStandaloneActivityNouns`** — pure nouns (≤4 chars) that imply an activity when used alone (e.g. `漫画` → reading manga, `游戏` → playing games).
6. **`hasShortActionShell`** — fallback for very short inputs (<4 chars compact length) starting with a known 1-char verb.

**Movement verbs** (`去上下关回到进出`) are kept in `ZH_SHORT_SHELL_MOVEMENT_VERBS` (used only by `hasShortActionShell`) and NOT added to `ZH_ACTIVITY_VERBS` to avoid verb+object false positives (e.g. `去吧`).

## IT Activity Detection: Verb Form Generator

Italian verb conjugation is complex. Instead of manually listing all forms, `liveInputRules.it.ts` auto-generates 6 forms per verb from the `itActivityVerbData` table in `activityLexicon.it.ts`:

| Generated form | Example (mangiare) |
|---|---|
| Infinitive | `mangiare` |
| Gerundio | `mangiando` |
| Participio passato | `mangiato` |
| Present-1sg | `mangio` |
| `sto + gerundio` | `sto mangiando` |
| `ho + participio` | `ho mangiato` |

Irregular forms are specified inline: `['fare', 'are', 'fatto', 'facendo', 'faccio']`.

**To add a new Italian activity verb**: add one entry to `itActivityVerbData` in `activityLexicon.it.ts`. If the verb form is unambiguously Italian (not an English word), also add the gerundio/participio/present-1sg to the `detectLatinLanguage` list in `latinSignalExtractor.ts`.

## EN/IT Structural Go+Place Detection

Both EN and IT have structural place-based detection to catch inputs like `at the library` or `sono andato in palestra` without needing per-combination phrases.

Detection requires **both**:
1. A place noun from `EN_PLACE_NOUNS` / `IT_PLACE_NOUNS` (lexicon SSOT in `activityLexicon.{en,it}.ts`)
2. A movement/location verb: EN: `went to | at the | got to | arrived at | headed to | got back from`; IT: `sono andato/a | vado | sono al/alla/in | sto andando`

**`EN_PLACE_NOUNS`** only lists places NOT already covered as tokens in `EN_ACTIVITY_VERBS` (e.g. `gym` is already a token; `library`, `park`, `pool` are not). Avoid adding places that would cause false positives without the movement-verb prefix.

## Maintenance Rules

1. **Modify Lexicon First**: Always update the relevant file in `src/services/input/lexicon/` before modifying consumer logic.
2. **Multi-language Parity**: When adding a term in one language, consider if its equivalent should be added to other languages.
3. **IT verbs via generator**: Add new Italian verbs to `itActivityVerbData`, not directly to `strongPhrases`, unless the form is genuinely a compound word with no verb-object decomposition.
4. **ZH go+place redundancy**: Do NOT add `去+地点` phrases to ZH `strongPhrases` — these are already covered by the structural go+place detection using `ZH_ACTIVITY_VERBS` + `ZH_PLACE_NOUNS`.
5. **Regex Safely**: When adding terms to `activityLexicon`, ensure they don't break existing patterns in `liveInputRules`.
6. **Test Coverage**: Update or add tests in `liveInputClassifier.test.ts` or `liveInputClassifier.i18n.test.ts` when modifying the lexicon.
