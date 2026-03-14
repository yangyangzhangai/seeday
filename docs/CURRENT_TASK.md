# CURRENT TASK (Session Resume Anchor)

- Last Updated: 2026-03-13 (PM, session-27)
- Owner: current working session
- Purpose: this file is the quick resume anchor for any new session.

## Current Focus

- Mainline task status: `magicpen-v2` remains the active track.
- Scope anchor for next execution: route strategy pivot approved in session-26; replace clause-first dual routing with two-lane gate (`activity/mood local` vs `todo-signal -> magic pen whole-sentence parse`).
- Doc planning anchor for this execution: `LLM.md -> docs/MAGIC_PEN_CAPTURE_SPEC.md -> src/features/chat/README.md -> src/features/todo/README.md -> src/features/report/README.md`.
- `moodauto` remains a follow-up branch and is not the immediate target.

## Past Focus

- `magicpen` implementation track is paused as a non-blocking branch; remaining optional manual UX polish can resume later.
- `cleanup` remains historical reference in `docs/CODE_CLEANUP_HANDOVER_PLAN.md` and `docs/CHANGELOG.md`.

## Latest Execution Snapshots (Keep Last 3)

### 2026-03-13 PM / session-27

- MP7 baseline landed:
  - mode-on send no longer does clause-first dual routing
  - two-lane gate in `handleMagicPenModeSend(...)`: no todo signal -> local `sendAutoRecognizedInput`; has todo signal -> whole sentence magic parse
- Magic pen parse contract upgraded in code path to four kinds: `activity` / `mood` / `todo_add` / `activity_backfill` (+ `unparsed`).
- Commit split landed:
  - auto-write high-confidence `mood` + non-time-anchored high-confidence `activity`
  - review sheet keeps `todo_add` + `activity_backfill`
  - low-confidence `activity/mood` no direct-write; routed into `unparsedSegments`
- Regressions updated and green:
  - `src/features/chat/chatPageActions.test.ts`
  - `src/services/input/magicPenParser.test.ts`
  - `src/store/magicPenActions.test.ts`
  - `api/magic-pen-parse.test.ts`

### 2026-03-13 PM / session-26

- Product decision updated for tomorrow implementation:
  - no longer clause-first as default
  - two-lane gate only: pure `activity/mood` uses local auto-recognition; any todo-signal input goes to magic pen parse
  - magic pen parse contract upgraded to four kinds: `activity` / `mood` / `todo_add` / `activity_backfill`
- Commit policy under magic pen confirmed:
  - auto-write: `mood` + high-confidence non-conflicting `activity`
  - review sheet: `todo_add` + `activity_backfill`
  - low-confidence `activity/mood` must not direct-write
- Documentation sync done in `docs/MAGIC_PEN_CAPTURE_SPEC.md` with session-26 override section.

### 2026-03-13 PM / session-25

- MP6 stabilization fix landed for mixed `realtime + magic` sentences joined by `和`, so inputs like `我在吃饭和早上逃课去逛街` no longer collapse into a single review clause.
- `src/services/input/magicPenClauseRouter.ts` now applies a narrow secondary split only when `和/还有` is followed by a strong clause-start signal; this keeps `我和朋友...` style noun phrases untouched.
- Regression coverage added:
  - `src/services/input/magicPenClauseRouter.test.ts` for `和`-joined realtime/backfill and multi-magic splits
  - `src/services/input/magicPenParser.test.ts` for `早上逃课去逛街`

### 2026-03-13 PM / session-24

- MP6 landed: mode-on send now uses clause-level dual routing (`realtime` direct write + `magic/uncertain` review).
- Safety rails landed: no uncertain direct-write, `lang`-aware router, mode-on send orchestration extracted to helper, local pending guard prevents duplicate sends.
- Test coverage landed:
  - `src/services/input/magicPenClauseRouter.test.ts` (13 cases)
  - `src/features/chat/chatPageActions.test.ts` (12 cases)

## Locked Product Decisions (session-26)

1. Mode-off keeps existing local `sendAutoRecognizedInput()` behavior unchanged.
2. Mode-on uses two-lane gate only:
   - no todo signal -> local `activity/mood` flow
   - has todo signal -> whole sentence goes to magic pen parse (no clause-first hard split)
3. Magic pen parse contract is four kinds: `activity` / `mood` / `todo_add` / `activity_backfill` (+ `unparsed`).
4. Under magic pen:
   - auto-write `mood` + high-confidence non-conflicting `activity`
   - `todo_add` and `activity_backfill` must enter review sheet
   - low-confidence `activity/mood` must not direct-write
5. This decision supersedes session-24 clause-first routing as the active implementation baseline.

## MP7 Preparation Checklist (for next implementation day)

- [x] Replace clause-first send orchestration with two-lane todo-signal gate in `chatPageActions.ts`
- [x] Expand magic pen type/API contract to four kinds and update parser mapping
- [x] Implement commit split: auto-write (`mood` + high-confidence `activity`) vs review (`todo_add` + `activity_backfill`)
- [x] Add regression cases for mixed input (`我好累，明天开会`; `我在吃饭和早上逃课去逛街`)
- [x] Re-run docs-sync + type-check + key unit tests

## Next Step (Single)

- Next: run docs-sync/state-consistency/build loop after session-27 changes, then decide whether low-confidence `activity/mood` should remain unparsed-only or move into explicit review cards in MP7.1.

## Resume Order

1. Read `LLM.md`.
2. Read this file (`docs/CURRENT_TASK.md`).
3. Read `docs/MAGIC_PEN_CAPTURE_SPEC.md`.
4. Inspect `src/features/chat/chatPageActions.ts`, `src/services/input/magicPenParser.ts`, `api/magic-pen-parse.ts`.
5. Verify key tests: `npm run test:unit -- src/features/chat/chatPageActions.test.ts src/services/input/magicPenParser.test.ts`.
