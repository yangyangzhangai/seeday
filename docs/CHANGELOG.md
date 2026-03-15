# Changelog

All notable changes to this repository are documented here.

## 2026-03-15 - Magic Pen MP8.0 Provider Fallback (`zhipu -> qwen-flash`)

### Changed

- Updated `api/magic-pen-parse.ts` to run `glm-4.7-flash` as primary provider and automatically fallback to DashScope OpenAI-compatible `qwen-flash` when primary call fails by timeout / non-2xx / empty content / parse failure.
- Added provider-level timeout and failure-reason observability (`timeout`, `empty_content`, `parse_failed`, etc.) plus fallback trace metadata (`providerUsed`, `fallbackFrom`) in API response.
- Updated `src/api/client.ts` parse response contract typing to include fallback provider metadata.
- Added fallback regression in `api/magic-pen-parse.test.ts` to ensure empty-content primary responses are recovered by `qwen-flash`.
- Synced environment/documentation contracts in `.env.example` and `api/README.md` for `QWEN_API_KEY`, `DASHSCOPE_BASE_URL`, and `MAGIC_PEN_FALLBACK_MODEL`.

### Validation

- `npm run test:unit -- api/magic-pen-parse.test.ts`
- `npm run build`

## 2026-03-15 - Magic Pen MP7.9 Future-Period Todo Reclassification Guard (`早上输入 晚上看电影`)

### Changed

- Updated `src/services/input/magicPenDraftBuilder.ts` to add a post-parse guard that reclassifies `activity_backfill` to `todo_add` when segment intent is future-oriented (`timeRelation: future`) or when zh period wording is clearly future from current morning context.
- Added shared todo draft construction in `buildTodoDraftFromSegment(...)` to keep dueDate/content normalization consistent for native todo and reclassified todo flows.
- Updated `src/services/input/magicPenParserLocalFallback.ts` so local fallback classification also treats morning-entered evening-period phrases as todo intent, avoiding AI/local divergence.
- Updated fallback todo content cleanup to strip period-leading todo phrasing (`晚上/今晚/今夜`) for concise todo text output.
- Added regressions in:
  - `src/services/input/magicPenDraftBuilder.test.ts`
  - `src/services/input/magicPenParser.test.ts`

### Validation

- `npm run test:unit -- src/services/input/magicPenParser.test.ts src/services/input/magicPenDraftBuilder.test.ts`

## 2026-03-15 - Vercel Region Pin for `/api/magic-pen-parse` (`fra1`)

### Changed

- Updated `vercel.json` function config to pin `api/magic-pen-parse.ts` to `fra1` and set `maxDuration: 20` to reduce cross-region routing latency and cap long-running upstream waits.

### Validation

- Manual deploy/log verification required: confirm runtime region is `fra1` (not `iad1`) and compare p95 latency for `/api/magic-pen-parse`.

## 2026-03-14 - Magic Pen MP7.8 Fallback Todo Date Guard (`8-9点`)

### Changed

- Updated zh todo date-anchor pattern in `src/services/input/magicPenRules.zh.ts` so numeric `month-day` tokens (`\d{1,2}[.-]\d{1,2}`) are ignored when followed by time units (`点/时/分`), preventing `8-9点` from being interpreted as `8月9日`.
- Updated `src/services/input/magicPenDateParser.ts` numeric dueDate extractor with the same trailing time-unit guard to keep fallback date extraction consistent with the rule layer.
- Added targeted regression coverage in `src/services/input/magicPenDateParser.test.ts`:
  - keep `3.18` as a valid dueDate
  - ensure `我8-9点吃早饭` does not produce a todo dueDate

### Validation

- `npx vitest run src/services/input/magicPenDateParser.test.ts`
- `npx vitest run src/services/input/magicPenParser.test.ts`

## 2026-03-14 - Magic Pen MP7.7 Dynamic Period Allocation + Parser-Priority Guard

### Changed

- Updated `/api/magic-pen-parse` prompt (`zh`/`en`/`it`) to remove rigid fixed-window period guidance and allow optional `durationMinutes` for `activity_backfill` segments.
- Extended Magic Pen parse contract with optional `durationMinutes` across `api/magic-pen-parse.ts`, `src/api/client.ts`, and `src/services/input/magicPenTypes.ts`.
- Updated `src/services/input/magicPenDraftBuilder.ts` period handling:
  - period backfill end time is capped by current local time (`endAt <= now`)
  - when duration exists (or zh text implies duration such as `半小时`), allocation is duration-aware and anchored near current time
  - added local `alignPeriodDraftsToMessageGaps(...)` so period drafts prefer filling local timeline gaps without sending history context to AI
- Updated `src/features/chat/MagicPenSheet.tsx` to apply period-gap alignment before initial validation/render.
- Updated `src/services/input/liveInputClassifier.ts` with short pure mood override (`<6` semantic chars, no time/activity/planned signals) to force `standalone_mood` with `high` confidence.
- Updated `src/features/chat/chatPageActions.ts` local fast-path guard to bypass direct write and force parser route when period/time/planned signals are present (for example `上午开会`, `要开会了`).
- Added regressions in:
  - `src/features/chat/chatPageActions.test.ts`
  - `src/services/input/liveInputClassifier.test.ts`
  - `src/services/input/magicPenDraftBuilder.test.ts`
  - `api/magic-pen-parse.test.ts`

### Validation

- `npm run test:unit -- src/features/chat/chatPageActions.test.ts src/services/input/liveInputClassifier.test.ts src/services/input/magicPenDraftBuilder.test.ts api/magic-pen-parse.test.ts`
- `npx tsc --noEmit`

## 2026-03-14 - Magic Pen MP7.6 Activity Backfill Content Cleanup

### Changed

- Updated `src/services/input/magicPenDraftBuilder.ts` to normalize leading first-person prefixes in `activity_backfill` content generated from AI parse results (for example `我学习` -> `学习`).
- Updated `src/services/input/magicPenParserLocalFallback.ts` to apply equivalent leading-pronoun cleanup for local fallback activity parsing, keeping AI/local behavior aligned.
- Added regression coverage:
  - `src/services/input/magicPenDraftBuilder.test.ts`: activity backfill normalization case
  - `src/services/input/magicPenParser.test.ts`: activity backfill content should not start with `我`

### Validation

- `npm run test:unit -- api/magic-pen-parse.test.ts src/services/input/magicPenDraftBuilder.test.ts src/services/input/magicPenParser.test.ts`
- `npx tsc --noEmit`

## 2026-03-14 - Magic Pen MP7.5 Local Time Context + Todo Content Cleanup

### Changed

- Updated `src/services/input/magicPenParser.ts` to send local-time parser context (`todayDateStr` based on local date, `currentLocalDateTime`, `timezoneOffsetMinutes`) instead of relying only on UTC-derived date/hour context.
- Updated `/api/magic-pen-parse` prompts (`zh`/`en`/`it`) to use precise local datetime context and to prefer `todo_add` for future/obligation phrases (for example `晚上要...`), reducing false `activity_backfill` classification.
- Updated todo content normalization so first-person immediate phrasing no longer produces noisy todo text (`我待会开会` -> `开会`) in both AI draft mapping and local fallback parsing.
- Extended regressions in:
  - `api/magic-pen-parse.test.ts` (local datetime context injection)
  - `src/services/input/magicPenDraftBuilder.test.ts` (todo content normalization)
  - `src/services/input/magicPenParser.test.ts` (immediate todo pronoun stripping)

### Validation

- `npm run test:unit -- api/magic-pen-parse.test.ts src/services/input/magicPenDraftBuilder.test.ts src/services/input/magicPenParser.test.ts src/features/chat/chatPageActions.test.ts`
- `npx tsc --noEmit`

## 2026-03-14 - Magic Pen MP7.4 Four-Kind Mixed Extraction Prompt + Routing Regression Sync

### Changed

- Updated `/api/magic-pen-parse` prompts (`zh`/`en`/`it`) to explicitly require mixed-input four-kind extraction coverage (`activity` / `mood` / `todo_add` / `activity_backfill`) whenever recognizable in one sentence.
- Clarified prompt confidence guidance so clearly recognizable realtime `activity` / `mood` segments are more likely to return stable `high` confidence + typed segments instead of falling into `unparsed`.
- Kept runtime commit split policy unchanged in code semantics: only AI `high+realtime activity|mood` auto-write, `todo_add|activity_backfill` stay in `MagicPenSheet`, and non-eligible AI `activity|mood` stay `unparsed`.
- Added regression coverage:
  - `src/features/chat/chatPageActions.test.ts` now covers one-sentence four-kind flow with `activity+mood` auto-write and `todo_add+activity_backfill` review split.
  - `src/services/input/magicPenDraftBuilder.test.ts` now covers medium realtime mood -> `unparsed` and deterministic four-kind split behavior.

### Validation

- `npm run test:unit -- src/features/chat/chatPageActions.test.ts src/services/input/magicPenDraftBuilder.test.ts api/magic-pen-parse.test.ts`
- `npx tsc --noEmit`

## 2026-03-14 - Magic Pen MP7.3 Parser-First Runtime Cutover

### Changed

- Replaced mode-on two-lane todo-signal gate in `src/features/chat/chatPageActions.ts` with parser-first whole-input send (`parseMagicPenInput(...)` always runs in Magic Pen mode).
- Added runtime safety gate in mode-on send: direct write is allowed only when parse result has exactly one `autoWriteItem` and no `drafts`/`unparsedSegments`; mixed results now always open `MagicPenSheet`.
- Expanded Magic Pen parse contract with `timeRelation` (`realtime`/`future`/`past`/`unknown`) across `api/magic-pen-parse.ts`, `src/api/client.ts`, and `src/services/input/magicPenTypes.ts`.
- Updated `src/services/input/magicPenDraftBuilder.ts` to enforce strict single-item realtime auto-write and route non-eligible `activity/mood` outputs to review/unparsed path.
- Added/updated regressions in `src/features/chat/chatPageActions.test.ts`, `src/services/input/magicPenDraftBuilder.test.ts`, and `api/magic-pen-parse.test.ts` for parser-first and strict auto-write behavior.

### Validation

- `npm run test:unit -- src/features/chat/chatPageActions.test.ts src/services/input/magicPenParser.test.ts src/services/input/magicPenDraftBuilder.test.ts api/magic-pen-parse.test.ts`
- `npx tsc --noEmit`
- `npm run lint:docs-sync`
- `npm run lint:state-consistency`

## 2026-03-14 - Magic Pen MP7.2 Parser-First Handoff + Dead Code Cleanup

### Changed

- Reset the next Magic Pen implementation target: member-only mode will move from the todo-signal gate to parser-first whole-sentence extraction, while ordinary record mode keeps the existing `activity/mood` auto-classification semantics.
- Synced the new implementation boundary and handoff notes in `docs/CURRENT_TASK.md`, `docs/MAGIC_PEN_CAPTURE_SPEC.md`, and `src/features/chat/README.md`.
- Removed orphaned clause-router files `src/services/input/magicPenClauseRouter.ts` and `src/services/input/magicPenClauseRouter.test.ts`; they were no longer used at runtime and are no longer part of the target architecture.
- Removed dead `recentActivity` plumbing from Magic Pen send wiring in `src/features/chat/chatPageActions.ts` and `src/features/chat/ChatPage.tsx`.

### Validation

- `npm run test:unit -- src/features/chat/chatPageActions.test.ts src/services/input/magicPenParser.test.ts`
- `npx tsc --noEmit`

## 2026-03-14 — Magic Pen MP7.1 Decision Lock (Low-Confidence Unparsed-Only)

### Changed

- Locked MP7.1 decision to keep low-confidence `activity/mood` in `unparsedSegments` only (no direct-write and no explicit review-card conversion in this slice).
- Added regression coverage in `src/services/input/magicPenDraftBuilder.test.ts` to enforce:
  - low-confidence `mood` -> no `autoWriteItems`, no review drafts, goes to `unparsedSegments`
  - low-confidence `activity` without time anchors -> no `autoWriteItems`, no review drafts, goes to `unparsedSegments`
- Updated `docs/CURRENT_TASK.md` with session-28 snapshot and the new single next step based on the locked policy.

### Validation

- `npm run test:unit -- src/services/input/magicPenDraftBuilder.test.ts`
- `npm run lint:max-lines`
- `npm run lint:docs-sync`
- `npm run lint:state-consistency`
- `npx tsc --noEmit`
- `npm run build`

## 2026-03-13 — Magic Pen MP7 Two-Lane Gate + Four-Kind Parse Contract

### Changed

- Updated `src/features/chat/chatPageActions.ts` mode-on send orchestration from clause-first routing to a two-lane gate: no todo signal keeps local `sendAutoRecognizedInput`, todo-signal input sends the whole sentence to magic pen parse.
- Added todo-signal gate logic in `chatPageActions.ts` and removed hard dependency on `magicPenClauseRouter` from mode-on send path.
- Expanded magic pen parse kind contract to four kinds (`activity` / `mood` / `todo_add` / `activity_backfill`) across `api/magic-pen-parse.ts`, `src/api/client.ts`, and `src/services/input/magicPenTypes.ts`.
- Updated `src/services/input/magicPenDraftBuilder.ts` and parser pipeline to split parse outputs into `autoWriteItems` vs review drafts: high-confidence `mood` + non-time-anchored `activity` auto-write; `todo_add` + `activity_backfill` stay in review; low-confidence `activity/mood` fall into `unparsedSegments`.
- Synced tests in `src/features/chat/chatPageActions.test.ts` for two-lane gate behavior and auto-write ordering while keeping parser/store/endpoint regressions green.

### Validation

- `npm run test:unit -- src/features/chat/chatPageActions.test.ts src/services/input/magicPenParser.test.ts src/store/magicPenActions.test.ts api/magic-pen-parse.test.ts`
- `npx tsc --noEmit`

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` with session-27 snapshot and MP7 checklist progress.
- Updated `src/features/chat/README.md` to reflect two-lane mode-on behavior and split write policy.
- Updated `docs/CODE_CLEANUP_HANDOVER_PLAN.md` with session-27 execution handover.

## 2026-03-13 — Magic Pen MP6 Clause-Level Dual Routing + Pending Guard

### Changed

- Added `src/services/input/magicPenClauseRouter.ts` to route mode-on send input into `realtimeClauses`, `magicClauses`, and `uncertainClauses` with language-aware safety bias.
- Updated `src/features/chat/chatPageActions.ts` to extract mode-on send orchestration: realtime clauses commit first, magic/uncertain clauses parse into `MagicPenSheet`, and duplicate sends are blocked by local pending guard.
- Updated `src/features/chat/ChatPage.tsx` to wire mode-on send through `handleMagicPenModeSend(...)` and pass `isMagicPenSending` into `ChatInputBar` loading/disable state.
- Expanded regressions in `src/features/chat/chatPageActions.test.ts` and added `src/services/input/magicPenClauseRouter.test.ts` for realtime-only/magic-only/mixed/uncertain/pending/lang-safety paths.

### Validation

- `npm run test:unit -- src/services/input/magicPenClauseRouter.test.ts src/features/chat/chatPageActions.test.ts`
- `npx tsc --noEmit`

### Doc-sync impact

- Updated `docs/CODE_CLEANUP_HANDOVER_PLAN.md` with Session-24 MP6 execution snapshot.
- Updated `src/features/chat/README.md` to document clause-level dual routing flow and test anchors.

## 2026-03-13 — Magic Pen Mixed `和` Sentence Routing Fix (Session-25)

### Changed

- Updated `src/services/input/magicPenClauseRouter.ts` to add a narrow secondary split for Chinese mixed-lane sentences where `和/还有` is followed by a strong clause-start signal, so mode-on input can separate realtime activity from backfill/todo without requiring punctuation.
- Added router regressions in `src/services/input/magicPenClauseRouter.test.ts` for `我在吃饭和早上逃课去逛街` and multi-magic `和`-joined time blocks.
- Extended `src/services/input/magicPenParser.test.ts` with `早上逃课去逛街` to keep local fallback coverage aligned with the routing fix.

### Validation

- `npm run test:unit -- src/services/input/magicPenClauseRouter.test.ts src/services/input/magicPenParser.test.ts src/features/chat/chatPageActions.test.ts`
- `npx tsc --noEmit`

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` with Session-25 stabilization snapshot.
- Updated `docs/CODE_CLEANUP_HANDOVER_PLAN.md` with Session-25 handover entry.

## 2026-03-12 — Magic Pen Multilingual Prompt Routing + Same-Day Todo Date (Session-23)

### Changed

- Updated `api/magic-pen-parse.ts` to switch among dedicated zh/en/it prompts using request `lang`, while keeping the same strict JSON output schema.
- Updated `src/services/input/magicPenParser.ts` to pass parser language into `buildDraftsFromAIResult(...)`.
- Updated `src/services/input/magicPenDraftBuilder.ts` to infer todo `dueDate` when AI returns immediate-time phrasing (for example `待会跑步` -> today).
- Updated `src/services/input/magicPenDateParser.ts` + `src/services/input/magicPenRules.zh.ts` so local fallback also maps same-day relative wording (`待会/一会/稍后/晚点/...`) to today's date.
- Added regressions for both changes: `api/magic-pen-parse.test.ts`, `src/services/input/magicPenDraftBuilder.test.ts`, and `src/services/input/magicPenParser.test.ts`.

### Validation

- `npm run test:unit -- api/magic-pen-parse.test.ts src/services/input/magicPenDraftBuilder.test.ts src/services/input/magicPenParser.test.ts src/store/magicPenActions.test.ts`
- `npx tsc --noEmit`
- `npm run lint:docs-sync`
- `npm run lint:state-consistency`
- `npm run build`

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` and `docs/CODE_CLEANUP_HANDOVER_PLAN.md` with session-23 handoff and completion snapshot.
- Updated `src/api/README.md` and `api/README.md` to reflect language-routed prompt behavior and request contract.

## 2026-03-12 — Magic Pen Sheet Simplification + Endpoint Test Closure (Session-22)

### Changed

- Removed the extra parse entry UI from `src/features/chat/MagicPenSheet.tsx` (top textarea + parse button + parse error state) so the sheet now opens directly with already-parsed drafts from send-triggered flow.
- Updated `src/features/chat/ChatPage.tsx` to stop passing `initialText` seed into `MagicPenSheet`; mode-on send now only seeds parsed drafts/unparsed segments.
- Added endpoint-level robustness tests in `api/magic-pen-parse.test.ts` for body validation (`400`), wrapped-JSON extraction, and invalid-output safe fallback.
- Closed MP3 cleanup evaluation outcome: `src/services/input/magicPenRules.zh.ts` remains required by local fallback/date parsing/draft building paths and is intentionally retained.

### Validation

- `npm run test:unit -- api/magic-pen-parse.test.ts src/services/input/magicPenParser.test.ts src/store/magicPenActions.test.ts`
- `npx tsc --noEmit`
- `npm run lint:docs-sync`
- `npm run lint:state-consistency`
- `npm run build`

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` to record session-22 snapshot and mark MP3/MP4 checklist closure.
- Updated `src/features/chat/README.md`, `src/api/README.md`, and `api/README.md` with the simplified Magic Pen flow and endpoint test coverage note.
- Updated `docs/CODE_CLEANUP_HANDOVER_PLAN.md` with this handover entry.

## Documentation Isomorphism Logging Rules

1. Any structural/interface/code-path change must include one changelog line in the same PR.
2. Changelog entries must reference both code path and doc path updates.
3. If `npm run lint:docs-sync` scope is touched, the entry must mention doc-sync impact.

## 2026-03-11 — Magic Pen V2 Mode-B + AI-First Parser Cutover (Session-21)

### Changed

- Switched chat interaction to Mode-B in `src/features/chat/ChatInputBar.tsx` and `src/features/chat/ChatPage.tsx`: wand button now toggles Magic Pen mode, and send branches to parse flow only when mode is on.
- Updated `src/features/chat/MagicPenSheet.tsx` to consume send-triggered seed drafts (`initialDrafts` / `initialUnparsedSegments`) and use async parse action with loading/error UX.
- Added server endpoint `api/magic-pen-parse.ts` (GLM-4.7-flash + `ZHIPU_API_KEY`) with robust response parsing fallback: direct JSON parse -> outer object extraction -> safe empty fallback.
- Added frontend client contract `callMagicPenParseAPI()` in `src/api/client.ts` and synced endpoint docs in `api/README.md` and `src/api/README.md`.
- Refactored parser entry `src/services/input/magicPenParser.ts` to async AI-first pipeline; moved local regex parser into `src/services/input/magicPenParserLocalFallback.ts` fallback path.
- Extended type/contracts in `src/services/input/magicPenTypes.ts` and `src/services/input/magicPenDraftBuilder.ts` for AI segment mapping and HH:mm conversion.
- Updated locale packs `src/i18n/locales/en.ts`, `src/i18n/locales/zh.ts`, and `src/i18n/locales/it.ts` with Mode-B and parsing/error keys.
- Updated tests: async parser assertions in `src/services/input/magicPenParser.test.ts`, removed obsolete open/close helper assertions in `src/features/chat/chatPageActions.test.ts`, and added `src/services/input/magicPenDraftBuilder.test.ts`.

### Validation

- `npm run test:unit -- src/services/input/magicPenParser.test.ts src/services/input/magicPenDraftBuilder.test.ts src/store/magicPenActions.test.ts src/features/chat/chatPageActions.test.ts`
- `npx tsc --noEmit`
- `npm run lint:docs-sync`
- `npm run lint:state-consistency`
- `npm run build`

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` with session-21 snapshot and MP0/MP1/MP2/MP4/MP5 checklist progress.
- Updated `docs/CODE_CLEANUP_HANDOVER_PLAN.md` section 8 with this session handover record.
- Updated module/API docs: `src/features/chat/README.md`, `src/api/README.md`, and `api/README.md`.

## 2026-03-11 — Moodauto Write-Path Verification (Phase E)

### Changed

- Added explicit write-path guard regressions in `src/store/chatActions.test.ts`:
  - standalone mood routes with `relatedActivityId` only when recent activity is ongoing.
  - standalone mood does not fallback attach to ended activity (`sendMood(content, undefined)`).
- Revalidated store integration behavior in `src/store/useChatStore.integration.test.ts` for ongoing attach and ended no-attach constraints.

### Validation

- `npm run test:unit -- src/store/chatActions.test.ts src/store/useChatStore.integration.test.ts src/services/input/liveInputClassifier.test.ts`
- `npm run eval:live-input:gold`

### Metrics

- zh gold: `kind_accuracy=88.69%`, `internal_accuracy=82.74%`.
- top mismatches: `new_activity -> standalone_mood (9)`, `activity_with_mood -> standalone_mood (7)`, `mood_about_last_activity -> standalone_mood (6)`.

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` to mark Phase E checklist complete and record the mismatch snapshot.
- Updated `docs/CODE_CLEANUP_HANDOVER_PLAN.md` handover log with write-path verification progress.

## 2026-03-11 — Moodauto Evidence Objectization (Classifier + Telemetry)

### Changed

- Added internal evidence schema in `src/services/input/types.ts`: `LiveEvidence` with `source`, `strength`, `polarity`, `tokens`, and `reasonCode`; exposed as optional `evidence` on `LiveInputClassification`.
- Refactored `src/services/input/liveInputClassifier.ts` to evidence-first scoring: classifier now builds evidence entries, maps evidence to scores centrally, and then resolves `internalKind`.
- Synced telemetry aggregation in `src/services/input/liveInputTelemetry.ts` to count reason codes from evidence while preserving backward-compatible reason counting.
- Added evidence assertions in `src/services/input/liveInputClassifier.test.ts` for planned interception and go/place happened-shell enrichment.

### Validation

- `npm run test:unit -- src/services/input/liveInputClassifier.test.ts src/services/input/liveInputRules.test.ts src/store/chatActions.test.ts src/store/useChatStore.integration.test.ts`
- `npx tsc --noEmit`
- `npm run lint:docs-sync`
- `npm run lint:state-consistency`

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` with session-18 execution snapshot and Phase C completion.
- Updated `docs/CODE_CLEANUP_HANDOVER_PLAN.md` handover log for evidence-objectization slice.

## 2026-03-11 — Moodauto Runtime Reorder (Structure-First + Go/Place)

### Changed

- Reordered zh runtime classification pipeline in `src/services/input/liveInputClassifier.ts` to structure-first order: `future/planned` intercept -> `negated/not occurred` intercept -> ongoing -> completion -> `go + place` -> lexicon -> mood -> context linking -> final dispatch.
- Added `detectGoToPlaceActivity()` in `src/services/input/liveInputClassifier.ts` with happened-shell strengthening (`刚/已经/了/回来`) and explicit reason codes.
- Added `ZH_PLACE_NOUNS` in `src/services/input/liveInputRules.zh.ts` and split non-activity interception into `ZH_FUTURE_OR_PLAN_PATTERNS` + `ZH_NEGATED_OR_NOT_OCCURRED_PATTERNS` (with `ZH_NON_ACTIVITY_PATTERNS` kept as combined export for compatibility).
- Expanded regressions in `src/services/input/liveInputClassifier.test.ts` and `src/services/input/liveInputRules.test.ts` for required `go + place` / planned / negated / happened-shell / mood-mixed scenarios.

### Validation

- `npm run test:unit -- src/services/input/liveInputClassifier.test.ts src/services/input/liveInputRules.test.ts src/store/useChatStore.integration.test.ts`

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` with session-17 execution snapshot and checklist progress.
- Updated `docs/CODE_CLEANUP_HANDOVER_PLAN.md` handover log for this runtime reorder slice.

## 2026-03-11 — Magic Pen Todo Refinement (Multi-task + Due Date)

### Changed

- Extended `src/services/input/magicPenParser.ts` todo pipeline with date-anchor aware segmentation so compact multi-task input can emit multiple todo drafts.
- Added todo date extraction for `明天` / `后天` / `下周X` / `3.18` / `3-18` / `3月18(号)` and mapped parsed values to `todo.dueDate`.
- Implemented yearless-date rollover rule in parser: resolve to this year first; if the date is already past, roll to next year.
- Improved todo content cleanup to remove date/duty scaffolding from `draft.content` (for example `明天考试` -> `考试`).
- Updated `src/features/chat/MagicPenSheet.tsx` to show editable todo date input bound to `draft.todo.dueDate`; extracted helper utilities to new `src/features/chat/magicPenSheetHelpers.ts`.
- Added parser regressions in `src/services/input/magicPenParser.test.ts` for multi-task todo split, date matrix parsing, content cleanup, and year rollover behavior.
- Added locale key `chat_magic_pen_due_date` in `src/i18n/locales/en.ts`, `src/i18n/locales/zh.ts`, and `src/i18n/locales/it.ts`.

### Validation

- `npm run test:unit -- src/services/input/magicPenParser.test.ts`
- `npm run test:unit -- src/store/magicPenActions.test.ts`
- `npx tsc --noEmit`

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` with session-15 execution snapshot and next manual-acceptance focus.
- Updated `docs/CODE_CLEANUP_HANDOVER_PLAN.md` with a new handoff log entry for this parser/sheet refinement slice.

## 2026-03-11 — Magic Pen Phase 2 Slice (Explicit Time-Range Parsing)

### Changed

- Extended `src/services/input/magicPenParser.ts` with explicit range extraction for activity drafts (`从10点到12点`, `10:30-11:45`, `至` / `~` variants) before fallback single-point parsing.
- Added end-time period-label inference when only the range start carries a period token (for example `下午3点到4:30` keeps end time in the same afternoon context).
- Updated content stripping logic in parser normalization so range markers do not leak into draft text content.
- Extracted Magic Pen open/close input handoff rules into `src/features/chat/chatPageActions.ts` and rewired `src/features/chat/ChatPage.tsx` to consume those helpers for deterministic restore behavior.
- Added regression tests in `src/features/chat/chatPageActions.test.ts` for input handoff capture, cancel-restore, and submit-no-restore paths.
- Improved `src/features/chat/MagicPenSheet.tsx` partial-retry UX: failed drafts reset to retryable state on edit/delete, and submit CTA switches to `chat_magic_pen_retry_failed` when only failed drafts remain.
- Added `chat_magic_pen_retry_failed` locale key in `src/i18n/locales/en.ts`, `src/i18n/locales/zh.ts`, and `src/i18n/locales/it.ts`.

### Validation

- `npm run test:unit -- magicPenParser.test.ts magicPenActions.test.ts`
- `npm run test:unit -- src/features/chat/chatPageActions.test.ts src/services/input/magicPenParser.test.ts src/store/magicPenActions.test.ts`
- `npm run lint:max-lines`
- `npm run lint:docs-sync`
- `npm run lint:state-consistency`
- `npx tsc --noEmit`
- `npm run build`

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` to mark the Phase 2 parser slice complete and keep manual sheet acceptance as the next single step.
- Updated `docs/CODE_CLEANUP_HANDOVER_PLAN.md` with this session's execution and validation snapshot.

## 2026-03-11 — Magic Pen Phase 1 Implementation (Chat Entry + Parser + Commit)

### Added

- Added Magic Pen feature files: `src/features/chat/MagicPenSheet.tsx`, `src/services/input/magicPenTypes.ts`, `src/services/input/magicPenRules.zh.ts`, `src/services/input/magicPenParser.ts`, `src/services/input/magicPenDraftBuilder.ts`, `src/store/magicPenActions.ts`.
- Added automated coverage for Magic Pen parser and commit orchestration: `src/services/input/magicPenParser.test.ts`, `src/store/magicPenActions.test.ts`.

### Changed

- Updated `src/features/chat/ChatInputBar.tsx` to include explicit Magic Pen entry button and callback wiring.
- Updated `src/features/chat/ChatPage.tsx` with minimal wiring-only state (`isMagicPenOpen`, `restoreInputRef`) and `MagicPenSheet` mount/close handoff.
- Updated locale dictionaries `src/i18n/locales/en.ts`, `src/i18n/locales/zh.ts`, and `src/i18n/locales/it.ts` with Magic Pen UI/error/status keys.

### Validation

- `npm run test:unit`
- `npm run lint:max-lines`
- `npm run lint:docs-sync`
- `npm run lint:state-consistency`
- `npx tsc --noEmit`
- `npm run build`

### Doc-sync impact

- Updated `src/features/chat/README.md` with Magic Pen user flow, dependencies, and test anchors.
- Updated `docs/CODE_CLEANUP_HANDOVER_PLAN.md` and `docs/CURRENT_TASK.md` to reflect execution progress and validation snapshot.

## 2026-03-11 — Magic Pen Spec Upgrade (Draft -> Execution-Ready)

### Changed

- Rewrote `docs/MAGIC_PEN_CAPTURE_SPEC.md` from a product draft into an implementation-ready spec aligned with the current `/chat` input flow, `useChatStore.insertActivity()`, `useTodoStore.addTodo()`, and report-duration constraints.
- Corrected repo-reality mismatches in the spec: no existing left-slot button in `ChatInputBar`, no current `MagicPen` code, no `/api/magic-pen-parse` endpoint, and no support for timestamp-only activity backfill in the current timeline model.
- Replaced the speculative file plan with an executable one that avoids colliding with the existing `src/services/input/types.ts` and explicitly keeps magic-pen parsing out of `ChatPage.tsx`.

### Validation

- `npm run lint:docs-sync`

### Doc-sync impact

- `docs/MAGIC_PEN_CAPTURE_SPEC.md` now serves as the implementation baseline for future magic-pen work under `src/features/chat`, `src/services/input`, `src/store`, and `src/i18n/locales/*`.

## 2026-03-10 — Moodauto Phase 3.6 (Evaluator Alignment + Evidence-Only Recall Patch + Monitor Mainline)

### Changed

- Aligned python evaluator behavior with the TS classifier contract in `scripts/evaluate_live_input_gold.py` (latin branch routing, token-overlap context matching, and evidence-based `mood_about_last_activity` gating) to reduce evaluation drift.
- Expanded evidence-only reference/evaluation coverage for `mood_about_last_activity` in zh/en/it rule packs: `src/services/input/liveInputRules.zh.ts`, `src/services/input/liveInputRules.en.ts`, and `src/services/input/liveInputRules.it.ts`.
- Refined latin language detection cues in `src/services/input/liveInputClassifier.ts` and synced evaluator-side language cues in `scripts/evaluate_live_input_gold.py`.
- Extended classifier regressions in `src/services/input/liveInputClassifier.test.ts` for new zh/en/it evidence cases.

### Validation

- `npm run test:unit -- src/services/input/liveInputClassifier.test.ts src/services/input/liveInputRules.test.ts`
- `python scripts/evaluate_natural_probe.py`
- `npm run eval:live-input:gold`

### Metrics

- Natural probe (`120` samples): `internal_accuracy 75.83% -> 77.50%`.
- Natural probe `mood_about_last_activity` recall: `69.57% -> 78.26%`.
- zh natural-probe `mood_about_last_activity` recall: `68.75% -> 75.00%`.
- zh gold `internal_accuracy`: `93.45% -> 94.05%`; zh gold `mood_about_last_activity` recall: `38.46% -> 46.15%`.

### Decision

- Product execution decision: close `moodauto` as active development mainline and keep it in monitor mode with explicit reopen triggers based on consecutive natural-probe regressions.

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` to mark the mainline transition (`development -> monitor`) and record reopen thresholds.
- Updated `docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md` metrics section to mirror monitor-mode reopen thresholds and fallback policy.

## 2026-03-10 — Moodauto Phase 3.5 (Backlog Closure: Multilingual + Telemetry + Fallback Decision)

### Added

- Added lightweight local telemetry module `src/services/input/liveInputTelemetry.ts` to track auto-recognition totals, internal-kind distribution, top classifier reasons, and reclassify path counts.
- Added `src/services/input/liveInputRules.test.ts` with 24 smoke regressions across zh/en/it rule packs (ongoing/completion/mood/future-plan coverage).

### Changed

- Expanded English rule seeds in `src/services/input/liveInputRules.en.ts` for completion variants (`wrapped up`, `got done with`), richer activity patterns (report/review/meeting/workout contexts), mood/evaluation expressions (`relieved`, `drained`, `that was stressful`), and stronger future-plan interception.
- Expanded Italian rule seeds in `src/services/input/liveInputRules.it.ts` for completion/activity variants (`ho appena finito`, `ho terminato`, `inviato il report`), richer mood terms (`esausto`, `sollevato`), and broader future-plan phrases (`ho intenzione di`).
- Updated latin classifier context relevance in `src/services/input/liveInputClassifier.ts` to use token-overlap matching instead of raw substring contains for recent-activity linkage.
- Wired telemetry recording into auto-send and correction paths (`src/store/chatActions.ts`, `src/store/useChatStore.ts`) and covered telemetry behavior in `src/store/chatActions.test.ts` + `src/store/useChatStore.integration.test.ts`.
- Extended multilingual regressions in `src/services/input/liveInputClassifier.test.ts` with en/it `activity_with_mood`, future-plan blocking, and unrelated-context non-linking cases.

### Validation

- `npm run test:unit -- src/services/input/liveInputClassifier.test.ts src/services/input/liveInputRules.test.ts src/store/chatActions.test.ts src/store/useChatStore.integration.test.ts`
- `npm run eval:live-input:gold`
- `python scripts/evaluate_natural_probe.py`
- `npx tsc --noEmit`
- `npm run lint:state-consistency`

### Metrics and Decision

- zh gold (latest rerun): `internal_accuracy=98.21%`.
- natural probe (latest rerun): `internal_accuracy=89.23%`, remaining top gap still `activity_with_mood` under-recall.
- Product/engineering decision: keep AI fallback disabled for now; continue rule + telemetry-driven hardening and revisit only if correction/misclassification trends regress.

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` checklist/next-step/validation snapshot to mark the Phase 3 backlog item complete and record the fallback decision basis.

## 2026-03-10 — Moodauto Phase 3.4 (Activity-with-Mood Recall Tuning Round 2)

### Changed

- Tuned zh activity detection in `src/services/input/liveInputRules.zh.ts` with new high-frequency natural patterns (`改代码`, `打完`, `通电话`, `午休`, `会开得`, `刚把...交了`) to reduce `activity_with_mood -> standalone_mood` misses.
- Tuned zh mood-evaluation patterns in `src/services/input/liveInputRules.zh.ts` (`得很顺利/得很好`, `感觉轻松`) and promoted weak completion words as mood evidence in `src/services/input/liveInputClassifier.ts` for mixed routing (`activity_with_mood`).
- Synced offline evaluator heuristics in `scripts/evaluate_live_input_gold.py` with the same tuning direction for comparable natural/gold reruns.

### Added

- Added targeted regression samples in `src/services/input/liveInputClassifier.test.ts` for previously missed natural cases: `和客户会开得很顺利`, `刚打完球，好爽`, `写完报告了，终于松口气`, `午休睡得很好`, `买到想要的东西，开心`.

### Validation

- `npm run test:unit -- src/services/input/liveInputClassifier.test.ts`
- `npx tsc --noEmit`
- `npm run eval:live-input:gold`
- `python scripts/evaluate_natural_probe.py`

### Metrics

- Natural probe `internal_accuracy`: `80.00% -> 89.23%`.
- Natural probe `activity_with_mood` recall: `46.67% -> 66.67%`.
- zh gold `internal_accuracy`: `98.81% -> 98.21%` (minor tradeoff: one `new_activity -> activity_with_mood` over-trigger).

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` validation snapshot with round-2 tuning scope and post-rerun metrics/tradeoff note.

## 2026-03-10 — Moodauto Phase 3.3 (Multilingual Baseline Seed + Eval Rerun)

### Added

- Added `src/services/input/liveInputRules.en.ts` with baseline English activity/mood/future-plan/reference rules for V1 latin-path fallback.
- Added `src/services/input/liveInputRules.it.ts` with baseline Italian activity/mood/future-plan/reference rules for V1 latin-path fallback.
- Added en/it baseline regressions to `src/services/input/liveInputClassifier.test.ts` for `standalone_mood`, `new_activity`, `mood_about_last_activity`, and future/plan interception behavior.

### Changed

- Updated `src/services/input/liveInputClassifier.ts` to route non-CJK latin input into lightweight language-aware (en/it) classification while keeping zh chain as the primary path.
- Kept ongoing-context attach hint for mood outputs (`relatedActivityId`) consistent across zh and latin paths.

### Validation

- `npm run test:unit -- src/services/input/liveInputClassifier.test.ts`
- `npx tsc --noEmit`
- `npm run eval:live-input:gold`
- `python scripts/evaluate_natural_probe.py`

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` validation snapshot with multilingual baseline landing and latest evaluation metrics.

## 2026-03-10 — Moodauto Phase 2.4/3.2 (Source-Aware Attachment Cleanup + Edit Recompute)

### Changed

- Updated `src/store/useMoodStore.ts` to track mood attachment origin metadata (`activityMoodMeta` / `moodNoteMeta`) with `source` and optional `linkedMoodMessageId`, plus `clearAutoMoodAttachmentsByMessage()` for deterministic correction cleanup.
- Updated `src/store/chatActions.ts` reclassify side effects to clean derived mood attachment data by linked mood message id instead of content equality, and routed mood dispatch with explicit `relatedActivityId`.
- Updated `src/store/useChatStore.ts` `sendMood()` to stop implicit fallback attachment to the latest activity; mood attach now only happens when dispatch passes explicit `relatedActivityId`.
- Updated `src/store/useChatStore.ts` `updateActivity()` to recompute mood only when attachment source is `auto` and custom manual label is not applied.
- Updated `src/services/input/liveInputClassifier.ts` so `standalone_mood` can carry ongoing activity id as runtime write hint (`relatedActivityId`) without changing classification kind.

### Added

- Added integration regressions in `src/store/useChatStore.integration.test.ts` for ongoing-vs-ended standalone mood attachment boundary and edit recompute behavior (`auto` mutable / `manual` immutable).
- Added source-aware cleanup assertions in `src/store/chatActions.test.ts` and integration flow to ensure `mood -> activity` correction clears linked auto mood artifacts.

### Validation

- `npm run test:unit -- src/store/chatActions.test.ts src/store/useChatStore.integration.test.ts`
- `npm run test:unit -- src/services/input/liveInputClassifier.test.ts`
- `npx tsc --noEmit`
- `npm run lint:state-consistency`

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` checklist and validation snapshot to mark Phase 2 / P2 and Phase 3 / P1 done and to set the next focus on Phase 3 backlog.

## 2026-03-10 — Moodauto Phase 3.1 (Context-Gated Completion Chain)

### Changed

- Updated `src/services/input/liveInputClassifier.ts` decision order to enforce non-activity/future-intent interception before activity detection and to split completion handling into strong completion (context-gated) vs weak completion (mood-biased evidence).
- Added ongoing/completion/context-token helpers and removed raw substring-based recent-context linkage in favor of token-overlap relevance checks.
- Updated `src/services/input/liveInputRules.zh.ts` with ongoing patterns, strong completion patterns, weak completion words, expanded future/plan negative patterns, and context keyword dictionary used by overlap matching.
- Extended `src/services/input/liveInputClassifier.test.ts` with regressions for strong completion with/without related context, weak completion non-linking behavior, and negative-intent priority.

### Validation

- `npm run test:unit -- src/services/input/liveInputClassifier.test.ts`
- `npm run lint:docs-sync`
- `npm run lint:state-consistency`

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` checklist/next-step/validation snapshot for the completion-context classifier milestone.
- Updated `docs/ACTIVITY_MOOD_AUTO_RECOGNITION_REFACTOR_PROPOSAL.md` to record agreed constraints (weak completion isolation, token-overlap context relevance, and negative-intent-first ordering).

## 2026-03-10 — Moodauto Phase 2.3 (ChatPage Reclassify Wiring Regression)

### Added

- Added `src/features/chat/chatPageActions.ts` to isolate latest-message correction trigger wiring (`reclassifyRecentInput` + row-action collapse) from `ChatPage` UI container.
- Added `src/features/chat/chatPageActions.test.ts` covering the reclassify trigger contract: argument forwarding, collapse ordering after async completion, and failure-path non-collapse.

### Changed

- Updated `src/features/chat/ChatPage.tsx` to delegate row correction handler to `handleLatestMessageReclassify()` for deterministic regression coverage.

### Validation

- `npm run test:unit -- src/features/chat/chatPageActions.test.ts`

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` to mark Phase 2 / P1++ done and expand next executable items from `docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md` (derived data cleanup, ongoing/ended attachment boundary, and mood source recompute rules).
- Updated `src/features/chat/README.md` with the new chat-page action helper dependency and test coverage anchor.

## 2026-03-10 — Moodauto Phase 3 (zh Gold Calibration Round 1)

### Added

- Added `scripts/evaluate_live_input_gold.py` to run offline classifier evaluation against parent-level `timeshine_gold_samples.xlsx`, including accuracy, mismatch pairs, and per-label recall breakdown.
- Added `npm run eval:live-input:gold` in `package.json` to rerun zh baseline checks quickly.
- Added gold-driven zh regression cases in `src/services/input/liveInputClassifier.test.ts` for colloquial activity terms, non-activity intent guards, and short context-evaluation mood cases.

### Changed

- Tuned zh rule dictionary in `src/services/input/liveInputRules.zh.ts`: expanded colloquial activity phrases, added single-verb activity patterns, expanded mood/evaluation lexicon, and introduced non-activity intent patterns.
- Updated classifier logic in `src/services/input/liveInputClassifier.ts` to reduce single-character verb false positives, apply non-activity score correction, and strengthen short evaluative context bias to `mood_about_last_activity`.

### Validation

- `npm run test:unit -- src/services/input/liveInputClassifier.test.ts`
- `python scripts/evaluate_live_input_gold.py --lang zh`
- `python scripts/evaluate_live_input_gold.py`

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` validation snapshot and next-step focus to include gold-based zh calibration status and follow-up direction.

## 2026-03-09 — Moodauto Phase 2.2 (Store Integration Regression)

### Added

- Added `src/store/useChatStore.integration.test.ts` to validate end-to-end store flow (`useChatStore -> chatActions`) for representative sentence routing and latest-message `reclassifyRecentInput()` timeline repair.
- Covered integration cases for `activity_with_mood` writeback, `mood_about_last_activity` linkage, and bidirectional latest-message correction (`mood <-> activity`).

### Notes

- Test run keeps non-blocking `zustand persist middleware` warnings in node test runtime (storage unavailable), while assertions and behavior checks pass.

### Doc-sync impact

- Updated progress and remaining test gap in `docs/CURRENT_TASK.md` (store integration completed; ChatPage UI trigger regression remains follow-up).

## 2026-03-09 — Moodauto Phase 2.1 (Sentence-level Store Regression Tests)

### Added

- Added `src/store/chatActions.test.ts` with sentence-level regression for auto-recognition dispatch (`mood`, `activity`, `activity_with_mood`, `mood_about_last_activity`) through `sendAutoRecognizedInputFlow()`.
- Added latest-message correction regression in `src/store/chatActions.test.ts` for `buildRecentReclassifyResult()` timeline repair boundaries (`mood -> activity`, `activity -> mood`, and non-latest rejection).

### Doc-sync impact

- Synced progress and remaining validation gap in `docs/CURRENT_TASK.md` (Phase 2 / P1 store-action tests completed; UI/store integration regression kept as follow-up).

## 2026-03-09 — Moodauto Phase 2 (Latest-message Reclassify)

### Changed

- Added `reclassifyRecentInput(messageId, nextKind)` in `src/store/useChatStore.ts` for latest-message correction in record mode.
- Added minimal timeline-repair helpers in `src/store/chatActions.ts`: latest-message `mood -> activity` closes previous open activity at the target timestamp, and latest-message `activity -> mood` reopens adjacent previous activity when it was closed by that message.
- Added row-level quick reclassify entry in `src/features/chat/MessageItem.tsx` and connected it in `src/features/chat/ChatPage.tsx` (latest record only).
- Added i18n keys for reclassify actions in `src/i18n/locales/en.ts`, `src/i18n/locales/zh.ts`, and `src/i18n/locales/it.ts`.

### Doc-sync impact

- Updated chat module contract in `src/features/chat/README.md` to include latest-message correction flow and chat action ownership.
- Updated session anchor in `docs/CURRENT_TASK.md` to mark Phase 2 / P0 latest-message correction complete and move next focus to Phase 3 backlog.
- Synced handover log in `docs/CODE_CLEANUP_HANDOVER_PLAN.md` for code/doc state consistency.

## 2026-03-09 — Moodauto Phase 1.5 (Input Flow Decoupling)

### Changed

- Refactored auto-recognized input flow in `src/store/chatActions.ts` into explicit stages: `classifyAutoRecognizedInput()`, `dispatchAutoRecognizedInput()`, `applyAutoRecognizedInputEffects()`, and unified orchestrator `sendAutoRecognizedInputFlow()`.
- Updated `src/store/useChatStore.ts` so `sendAutoRecognizedInput()` now delegates to the unified flow and no longer mixes classification rules with send side effects in one inline branch block.
- Kept behavior compatibility for `activity_with_mood` by applying mood writeback (`setMood` / `setMoodNote`) in the post-effects stage after dispatch.

### Doc-sync impact

- Synced session anchor in `docs/CURRENT_TASK.md` to record the classify -> dispatch -> effects decoupling milestone while keeping Phase 2 (`reclassifyRecentInput`) as the next active step.
- Synced handover log in `docs/CODE_CLEANUP_HANDOVER_PLAN.md` for code/doc state consistency.

## 2026-03-09 — Moodauto Phase 1 (Rule Regression Tests)

### Added

- Added `Vitest` unit test setup in `package.json` with `test:unit` and `test:unit:watch`, and added `vitest` to `devDependencies`.
- Added `src/services/input/liveInputClassifier.test.ts` with zh seed case coverage for `standalone_mood`, `new_activity`, `activity_with_mood`, and `mood_about_last_activity`, plus additional regression samples and context-bias/no-bias boundaries.
- Added `src/services/input/liveInputContext.test.ts` for recent-activity lookup behavior, including ongoing-priority, 30-minute window acceptance, and mood/chat exclusion.

### Doc-sync impact

- Synced execution checkpoint and next-step focus in `docs/CURRENT_TASK.md` (Phase 1 / P1 marked complete; Phase 2 / P0 promoted as next step).
- Synced handover board/log in `docs/CODE_CLEANUP_HANDOVER_PLAN.md` for traceability of test infrastructure and regression coverage landing.

## 2026-03-09 — Moodauto Phase 1 (Auto Recognized Input)

### Changed

- Added rule-based live input classification service under `src/services/input/` (`types.ts`, `liveInputRules.zh.ts`, `liveInputContext.ts`, `liveInputClassifier.ts`) for `activity`/`mood` auto recognition with recent-activity context bias.
- Added `sendAutoRecognizedInput()` in `src/store/useChatStore.ts` as the chat main input entry, and routed `ChatPage` send flow through this unified action.
- Updated record-path mood detection in `src/store/chatActions.ts` to local rule detection only, removing the unconditional classifier API dependency from the primary path.
- Updated `ChatInputBar` and `ChatPage` to a neutral single-input UX (no heart mode toggle) and added `chat_placeholder_neutral` i18n key in `src/i18n/locales/en.ts`, `src/i18n/locales/zh.ts`, and `src/i18n/locales/it.ts`.
- Added `activity_with_mood` writeback in `src/store/useChatStore.ts` to persist derived mood tag and note via `useMoodStore.activityMood` and `useMoodStore.moodNote` without changing message persistence schema.

### Doc-sync impact

- Mainline task status and next checkpoint were synced in `docs/CURRENT_TASK.md`.
- Input-path behavior and ownership moved to rule-based service/store entry while keeping module boundary under `src/features/chat` + `src/store` + `src/services/input`.

## 2026-03-07 — Cleanup H5/H6/H7

### Changed

- Completed cleanup task H5 by splitting annotation serverless implementation: `api/annotation.ts` is now a thin route entry, core handler moved to `api/annotation-handler.ts`, and prompt/default-template logic moved to `api/annotation-prompts.ts`.
- Completed cleanup task H6 by extracting `insertActivity` collision/persistence flow from `src/store/useChatStore.ts` into `src/store/chatActions.ts` via `buildInsertedActivityResult` and `persistInsertedActivityResult`; also extracted duration-sync helper flow (`buildMessageDurationUpdate`/`persistMessageDurationUpdate`).
- Completed cleanup task H7 by removing unused heavy dependencies `cannon-es`, `matter-js`, `three`, and `@types/matter-js` from `package.json` and lockfile.
- Synced cleanup decision: H8 (`commit-msg` hook) is marked as stop-execution by user choice and will not be implemented in this round.

### Doc-sync impact

- API route internals changed (`api/annotation.ts` split into entry + handler + prompts) and module docs were synced in `src/api/README.md`.
- Cleanup board and session anchor were synced in `docs/CODE_CLEANUP_HANDOVER_PLAN.md` and `docs/CURRENT_TASK.md`.

## 2026-03-06 (续) — Git Hook 自动拦截

### Added

- Added `scripts/check-secrets.mjs`: scans staged files for hardcoded keys/tokens (patterns: `sk-`, `cpk_`, Bearer, Supabase service role). Registered as `npm run lint:secrets`.
- Added `scripts/pre-commit.mjs`: pre-commit hook entry point, runs 4 checks in fast-fail order (secrets → max-lines → doc-sync → tsc).
- Added `scripts/install-hooks.mjs`: installs hook scripts into `.git/hooks/`, auto-runs via `npm run prepare`.
- Added `npm run lint:all`: shortcut running all 4 quality checks.
- Added `npm run prepare`: auto-installs git hooks on `npm install`.
- `LLM.md` expanded into full AI onboarding guide: session SOP (3-step), coding rules, loop checks, doc-sync matrix, prohibited items, and related-doc table.

### Doc-sync impact

- `scripts/` directory: 3 new files, no existing paths changed → `check-doc-sync` scope unaffected.
- `package.json` scripts block changed → no README update required (no API/store/route changes).

## 2026-03-06

### Added

- Added `LLM.md` as the single L1 AI/LLM entry document and removed `CLAUDE.md` from active plan scope.
- Added module-level docs: `src/features/auth/README.md`, `src/features/todo/README.md`, `src/features/report/README.md`, and `src/api/README.md`.
- Added `scripts/check-doc-sync.mjs` and new command `npm run lint:docs-sync`.
- Added `docs/CURRENT_TASK.md` as the session-resume anchor file for checkpointed restart.
- Added `scripts/check-state-consistency.mjs` and new command `npm run lint:state-consistency` to block code/doc state drift.

### Changed

- Standardized `src/features/chat/README.md` to the module-template format (entry/interface/upstream/downstream/docs).
- Added `DOC-DEPS` headers to key files (`src/App.tsx`, `src/api/client.ts`, all `src/store/use*Store.ts`, all `api/*.ts`) for L3 file-level dependency tracing.
- Updated `CONTRIBUTING.md` with a required "code change -> doc update" matrix and doc-sync execution rules.
- Updated `LLM.md` global read order to require `docs/CURRENT_TASK.md` before project-map/module reads.
- Updated `scripts/check-doc-sync.mjs` required-doc list to include `docs/CURRENT_TASK.md`.
- Updated `CONTRIBUTING.md` with a session resume SOP and mandatory `lint:state-consistency` pre-submit check.

## 2026-03-05

### Changed

- Completed cleanup task F16 by decoupling annotation sync from `todayStats.events` and using `annotations[]` as the source of pending cloud sync records.
- Added `syncedToCloud` to `AIAnnotation` and updated `useAnnotationStore` to mark local annotations unsynced on create, then flip to synced after successful insert/upsert.
- Added capped event retention for `todayStats.events` (`MAX_TODAY_EVENTS = 400`) to prevent unbounded local persisted growth while preserving recent runtime context.
- Synced execution status and handover details into `docs/CODE_CLEANUP_HANDOVER_PLAN.md` (board + handover log entry).
- Completed cleanup tasks F12-F15: introduced `api/http.ts` shared wrappers (CORS/method/error JSON), unified annotation extraction in `src/lib/aiParser.ts`, optimized Stardust lookup/writeback flow, and reduced ChatPage timer hot-path overhead.
- Updated API handlers (`api/chat.ts`, `api/report.ts`, `api/classify.ts`, `api/diary.ts`, `api/stardust.ts`, `api/annotation.ts`) to use shared HTTP helpers for consistent behavior.
- Completed cleanup task F17 by introducing `src/lib/dbMappers.ts` and unifying DB row mapping for Message/Todo/Report/Stardust/Annotation/Auth sync paths.
- Completed cleanup task F18 by migrating Mood domain internal values to English keys (`happy/calm/focused/...`) with i18n-based rendering and persisted-data compatibility migration.

## 2026-03-04

### Added

- Added `CONTRIBUTING.md` with contribution flow, directory boundaries, validation, and rollback expectations.
- Added `docs/archive/2026-03-04-root-residual-disposition.md` to record root residual file disposition.
- Added `scripts/check-max-lines.mjs` and `npm run lint:max-lines` for file-size guardrails (warn >400 lines, error >800 lines).

### Changed

- Locked package manager strategy to `npm` and removed `pnpm-lock.yaml`.
- Updated package-management wording in `README.md`, `PROJECT_CONTEXT.md`, and install steps in `DEPLOY.md`.
- Synced cleanup board and handover log for D3, D6, D9, and E1 in `docs/CODE_CLEANUP_HANDOVER_PLAN.md`.
- Reviewed and improved `.gitignore` by removing duplicate `.env` rules and adding `.vercel/` ignore.
- Rewrote `api/README.md` and `src/store/README.md` to align with current implementation boundaries and reduce drift.
- Grouped shared components by responsibility into `src/components/layout` and `src/components/feedback`, then updated imports in app entry points and chat feature.
- Synced cleanup status decision: C12 and C13 are now marked as stop-execution items and will be handled by the user later.
- Corrected documentation alignment across `FEATURE_STATUS.md`, `PROJECT_CONTEXT.md`, and `docs/ARCHITECTURE.md` for the C12/C13 stop-execution status.

### Removed

- Removed stale root files: `TO-DO.json`, `YOUWARE.md`, and `SECURITY_FIX.md`.

## 2026-03-03

### Added

- Added `PROJECT_CONTEXT.md` as the global onboarding context document.
- Added `FEATURE_STATUS.md` to track module-level implementation status.
- Added `docs/CHANGELOG.md` as the single changelog entry point.

### Changed

- Rewrote root `README.md` to reflect real project scope, setup, architecture entry points, and known issues.
- Rewrote `docs/ARCHITECTURE.md` to reflect current implemented architecture only.
- Completed C14 by adding bounded pruning strategy in `src/store/useMoodStore.ts` to avoid unbounded localStorage growth.
- Fixed report detail title i18n mismatch in `src/features/report/ReportDetailModal.tsx` and locale keys.
- Synced cleanup board status for C14 and C16 in `docs/CODE_CLEANUP_HANDOVER_PLAN.md`.

### Notes

- C12/C13 are now marked as stop-execution items and are intentionally left for user-owned follow-up.
