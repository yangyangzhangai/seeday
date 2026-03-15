# CURRENT TASK (Session Resume Anchor)

- Last Updated: 2026-03-15 (session-40)
- Owner: current working session
- Purpose: this file is the quick resume anchor for any new session.

## Current Focus

- Mainline task status: `magicpen-v2` remains the active track.
- Scope anchor for next execution: session-40 keeps parser-first mixed-input extraction and lands server-side provider fallback for `/api/magic-pen-parse` (`zhipu -> qwen-flash`) on timeout/empty/parse failure.
- Doc planning anchor for next execution: `LLM.md -> docs/MAGIC_PEN_CAPTURE_SPEC.md -> src/features/chat/README.md -> src/features/todo/README.md -> src/features/report/README.md`.
- Boundary lock: do not refactor the global ordinary-mode `activity/mood` auto-classifier as part of the next Magic Pen slice.

## Past Focus

- `magicpen` implementation track remains active; session-26/session-27 two-lane gate work is now historical context, not the next target architecture.
- `cleanup` remains historical reference in `docs/CODE_CLEANUP_HANDOVER_PLAN.md` and `docs/CHANGELOG.md`.

## Latest Execution Snapshots (Keep Last 3)

### 2026-03-15 / session-40

- Landed Magic Pen provider fallback in `/api/magic-pen-parse`:
  - primary provider: Zhipu `glm-4.7-flash`
  - fallback provider: DashScope OpenAI-compatible `qwen-flash`
  - fallback triggers: `timeout` / `http_error` / `empty_content` / `invalid_payload` / `parse_failed`
- Extended response observability:
  - response metadata now includes `providerUsed` and `fallbackFrom`
  - server logs now expose provider failure reasons for deterministic production diagnosis
- Added regressions and contract sync:
  - `api/magic-pen-parse.test.ts` added empty-content fallback case
  - `.env.example` / `api/README.md` synced with `QWEN_API_KEY`, `DASHSCOPE_BASE_URL`, `MAGIC_PEN_FALLBACK_MODEL`

### 2026-03-15 / session-39

- Landed Vercel function region pin for Magic Pen parse:
  - `vercel.json` now pins `api/magic-pen-parse.ts` to `fra1`
  - added `maxDuration: 20` to cap long-running upstream waits
- Goal: reduce `iad1 -> open.bigmodel.cn` cross-region latency spikes observed in production logs.

### 2026-03-15 / session-38

- Landed future-period todo reclassification guard:
  - AI result mapping now converts future-oriented `activity_backfill` to `todo_add` when context indicates pending intent (for example morning input `晚上看电影`).
  - local fallback parser now applies aligned future-period todo detection to avoid AI/local divergence.
  - fallback todo content cleanup now strips leading period tokens (`晚上/今晚/今夜`) so output is concise (`看电影`).
- Added regressions:
  - `magicPenDraftBuilder.test.ts`: future-period backfill -> todo case
  - `magicPenParser.test.ts`: morning `晚上看电影` should parse as todo with same-day dueDate

### 2026-03-14 / session-37

- Landed Magic Pen fallback todo-date anti-misclassification guard:
  - `8-9点` style time-range tokens are no longer treated as todo `month-day` date anchors in zh rules.
  - `extractTodoDueDate(...)` now blocks numeric month-day capture when the token is immediately followed by time units (`点/时/分`).
- Added regressions:
  - `magicPenDateParser.test.ts`: keeps `3.18` date parsing valid while ensuring `我8-9点吃早饭` does not generate todo dueDate.

### 2026-03-14 / session-36

- Landed Magic Pen dynamic period backfill allocation and reduced prompt rigidity:
  - `/api/magic-pen-parse` prompt no longer enforces fixed period clock windows; parser contract accepts optional `durationMinutes`.
  - `magicPenDraftBuilder` now resolves period backfill locally with `endAt <= now`; if duration is present (or inferred from zh text like `半小时`), it anchors near current time.
  - Added local gap-priority alignment (`alignPeriodDraftsToMessageGaps`) so period drafts prefer filling existing timeline gaps without sending history context to AI.
- Landed mode-on parser-priority guard in `chatPageActions`:
  - period/time/planned signals now bypass local fast path and force parser route, preventing phrases like `上午开会` / `要开会了` from being direct-written as ongoing activity.
- Landed short pure mood high-confidence override in local classifier:
  - `<6` chars with pure mood signal and no time/activity/planned markers now force `standalone_mood + high`.
- Added regressions:
  - `chatPageActions.test.ts`: parser-priority guard cases (`上午开会`, `要开会了`)
  - `magicPenDraftBuilder.test.ts`: period end capping, duration-driven period allocation, zh duration inference, local gap alignment
  - `api/magic-pen-parse.test.ts`: `durationMinutes` passthrough
  - `liveInputClassifier.test.ts`: short pure mood override behavior

### 2026-03-14 / session-35

- Landed activity-backfill content cleanup for first-person phrasing:
  - AI draft mapping now normalizes leading first-person prefixes for backfill activity text (for example `我学习` -> `学习`)
  - local fallback activity parsing applies the same leading-pronoun cleanup path
- Added regressions:
  - `magicPenDraftBuilder.test.ts`: activity_backfill normalization assertion
  - `magicPenParser.test.ts`: activity backfill output no longer starts with `我`

### 2026-03-14 / session-34

- Landed timezone-aware parser context for AI prompt:
  - `parseMagicPenInput(...)` now sends local `todayDateStr` (no UTC slice drift), `currentLocalDateTime`, and `timezoneOffsetMinutes`
  - `/api/magic-pen-parse` prompt now explicitly instructs future/obligation phrases (for example `晚上要...`) to prefer `todo_add` over `activity_backfill`
- Landed todo content cleanup for immediate phrasing:
  - normalized leading first-person pronouns in todo content (`我待会开会` -> `开会`) for both AI result path and local fallback path
- Added regressions:
  - `api/magic-pen-parse.test.ts`: verifies local datetime context token injection
  - `magicPenDraftBuilder.test.ts`: verifies `我开会` normalization to `开会`
  - `magicPenParser.test.ts`: verifies `我待会开会` outputs todo content `开会`

### 2026-03-14 / session-33

- Implemented parser-contract clarification in runtime/docs/tests:
  - strengthened `/api/magic-pen-parse` zh/en/it prompt rules for mixed four-kind extraction
  - kept post-parse split policy unchanged: only AI `high+realtime activity|mood` auto-write, `todo_add|activity_backfill` remain review, non-eligible `activity|mood` remain `unparsed`
- Added regressions:
  - `src/features/chat/chatPageActions.test.ts`: one-sentence four-kind flow auto-writes `activity+mood` then opens sheet with review drafts
  - `src/services/input/magicPenDraftBuilder.test.ts`: medium realtime mood remains unparsed; four-kind result split stays deterministic

### 2026-03-14 / session-33

- Locked clarification of session-31 mixed-input behavior:
  - local fast path remains for simple single-intent mode-on input
  - mixed/complex input routes whole sentence to AI parser
- Locked AI parse contract intent:
  - parser should distinguish and return all applicable kinds in one pass: `activity`, `mood`, `todo_add`, `activity_backfill`
  - when one sentence contains all four, all four should be returned
- Locked post-parse commit policy:
  - `activity` / `mood` auto-write only when AI marks `high` confidence + `realtime`
  - `todo_add` / `activity_backfill` always go to `MagicPenSheet` review
  - non-`high+realtime` AI `activity` / `mood` fall back to `unparsed` (safety-first)

## Locked Product Decisions (session-36)

1. Mode-off keeps the existing local `sendAutoRecognizedInput()` behavior unchanged for all users.
2. Ordinary binary `activity/mood` auto-classification semantics are out of scope for the next Magic Pen slice; do not refactor that system as part of this handoff.
3. Mode-on target architecture is `local fast path + parser-first mixed handling`:
   - simple single-intent standalone `activity` / `mood` can be classified and written locally
   - mixed-intent or complex input routes the whole raw sentence to `parseMagicPenInput(...)`
   - do not pre-split clauses on the client
4. Magic Pen parser owns mixed-input understanding and should return structured multi-segment output from the original whole sentence.
5. Future-triggered emotion remains valid `mood`; pure future plans without explicit emotion must not be forced into `mood` inside Magic Pen parsing.
6. Commit policy target is split by parser kind:
   - AI `activity` / `mood` only auto-write when `high` + `realtime`
   - `todo_add` and `activity_backfill` require confirmation in `MagicPenSheet`
   - AI `activity` / `mood` that are not `high+realtime` degrade to `unparsed` (not auto-write, not draft review)
7. Mixed-result UX target:
   - auto-write eligible realtime items first
   - then open `MagicPenSheet` for remaining review items
   - provide visible status copy and an undo/reversal path for auto-written items
8. When one sentence contains linked `activity + mood`, the preferred write behavior is `activity record + attached mood/note`, not two unrelated peer records.
9. This decision supersedes the stricter session-30 direct-write target as the next implementation goal. Current code may still partially reflect prior gating until follow-up implementation lands.

10. AI prompt and response shaping must explicitly optimize for mixed extraction coverage so recognizable `activity` / `mood` in complex sentences are returned as typed segments instead of being dropped as `unparsed`.

## Session-36 Handoff Checklist

- [x] Relax parser prompt period-window rigidity and extend contract with optional `durationMinutes`
- [x] Resolve period backfill locally with `<= now` cap and duration-aware allocation
- [x] Add local gap-priority alignment for period backfill drafts without sending history context to AI
- [x] Add mode-on parser-priority guards for time/planned signals to avoid local fast-path miswrites
- [x] Add short pure mood high-confidence override for local classifier

## Session-35 Handoff Checklist

- [x] Normalize leading first-person pronouns in `activity_backfill` content for both AI parse mapping and local fallback
- [x] Add regressions covering activity-backfill cleanup behavior

## Session-34 Handoff Checklist

- [x] Pass precise local datetime context to parser API (`todayDateStr` local date, `currentLocalDateTime`, `timezoneOffsetMinutes`)
- [x] Update parser prompt to bias future/obligation period phrases to `todo_add` (avoid `晚上要...` misclassified as `activity_backfill`)
- [x] Normalize todo content for first-person immediate phrasing (`我待会开会` -> `开会`) across AI/local paths
- [x] Add regressions for datetime-context injection and todo-content normalization

## Next Step (Single)

- Next: monitor one production cycle of `/api/magic-pen-parse` fallback hit-rate (`providerUsed`, `fallbackFrom`) and validate that repeated sends no longer require manual refresh.

## Resume Order

1. Read `LLM.md`.
2. Read this file (`docs/CURRENT_TASK.md`).
3. Read `docs/MAGIC_PEN_CAPTURE_SPEC.md`.
4. Inspect `src/features/chat/chatPageActions.ts`, `src/services/input/magicPenParser.ts`, `src/services/input/magicPenDraftBuilder.ts`, `api/magic-pen-parse.ts`.
5. Verify key tests: `npm run test:unit -- src/features/chat/chatPageActions.test.ts src/services/input/magicPenParser.test.ts src/services/input/magicPenDraftBuilder.test.ts`.
