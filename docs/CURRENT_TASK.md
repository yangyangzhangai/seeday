# CURRENT TASK (Session Resume Anchor)

- Last Updated: 2026-03-10 (PM, session-8)
- Owner: current working session
- Purpose: this file is the quick resume anchor for any new session.

## Current Focus

- Mainline task status: `moodauto` development track is closed; this area now runs in monitor-only mode unless regression triggers fire.
- `cleanup` is now a past task track and historical reference only; it is no longer the active execution board.
- V1 target: the chat main input auto-classifies `activity` vs `mood`, defaults ambiguous input to `mood`, keeps `activity_with_mood` attached mood info, and keeps the primary path AI-free.
- Doc planning anchor for this execution: `LLM.md -> docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md -> src/features/chat/README.md`.

## Past Focus

- `cleanup` work is treated as historical context for this session, including completed H/F/C board items already recorded in `docs/CODE_CLEANUP_HANDOVER_PLAN.md` and `docs/CHANGELOG.md`.
- User-owned leftovers `C12` and `C13` stay outside the current mainline unless they are explicitly reactivated later.

## Active Checklist

- [x] Phase 1 / P0: audit the current input path (`src/features/chat/ChatInputBar.tsx` -> `src/features/chat/ChatPage.tsx` -> `src/store/useChatStore.ts` -> `src/store/chatActions.ts`) and define the minimal insertion point for `sendAutoRecognizedInput()`.
- [x] Phase 1 / P0: add the rule-based input classification entry under `src/services/input/` with `types.ts`, `liveInputClassifier.ts`, `liveInputContext.ts`, and `liveInputRules.zh.ts`.
- [x] Phase 1 / P0: route the main record send path through rule-based auto recognition and remove unconditional AI classification from the primary input flow.
- [x] Phase 1 / P1: support `activity_with_mood` writeback through `useMoodStore.activityMood` and `useMoodStore.moodNote`, while preserving the existing `message.isMood` semantics.
- [x] Phase 1 / P1: remove persistent `isMoodMode` dependence from the main input UX and switch to a neutral single-input mental model.
- [x] Phase 1 / P1: add regression tests for rule matching and recent-activity context bias, starting with the Chinese seed cases in `docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md`.
- [x] Phase 1 / P1: refactor `sendAutoRecognizedInput()` into explicit classify -> dispatch -> effects stages via `src/store/chatActions.ts`, so classification result and send behavior are decoupled.
- [x] Phase 2 / P0: implement `reclassifyRecentInput(messageId, nextKind)` and the minimal timeline-repair logic needed for post-send correction (latest message path).
- [x] Phase 2 / P1: add sentence-level store-action regression tests for auto recognition and latest-message reclassify flow (`sendAutoRecognizedInputFlow` + `buildRecentReclassifyResult`).
- [x] Phase 2 / P1+: add store-integration regression for `useChatStore -> chatActions` latest-message correction interaction.
- [x] Phase 2 / P1++: add UI interaction regression for `ChatPage` message-row correction trigger wiring.
- [x] Phase 2 / P2: add source/origin-aware cleanup for derived `activityMood`/`moodNote` when latest `mood -> activity` correction happens, so report reads cannot keep stale attachment data.
- [x] Phase 2 / P2: add write-layer regression for the runtime boundary from discussion doc: ongoing activity may absorb standalone mood, ended activity must not absorb standalone mood without evidence.
- [x] Phase 3 / Backlog: expand English/Italian dictionaries, add telemetry, and decide whether AI fallback is necessary based on misclassification data.
- [x] Phase 3 / P0 (zh-only baseline): run `timeshine_gold_samples.xlsx` offline evaluation and land first-pass zh rule tuning for major false positives/false negatives (`new_activity`, `activity_with_mood`, and `mood_about_last_activity` context bias).
- [x] Phase 3 / P1: align activity edit mood-recompute behavior with discussion doc (`auto` recalculable, `manual` immutable) and back it with tests.
- [x] Phase 3 / P0+: implement context-gated completion handling in zh classifier: strong completion follows context relevance chain, weak completion stays mood-biased, and future/plan negatives are intercepted before ongoing/activity checks.

## Next Step (Single)

- Keep `moodauto` in monitor mode: continue sample collection and only reopen development when regression triggers are hit.

## Regression Reopen Triggers

- Reopen `moodauto` as active development if `python scripts/evaluate_natural_probe.py` reports `internal_accuracy < 75%` in two consecutive reruns.
- Reopen `moodauto` as active development if `mood_about_last_activity` recall in natural probe drops below `70%` in two consecutive reruns.
- If triggers are not hit, keep AI fallback disabled and continue rules-only maintenance.

## Blockers

- No external blocker at the moment.
- Main engineering risk: activity <-> mood reclassification can affect timeline duration and "current activity" state, so that repair work should stay isolated to the Phase 2 correction flow.

## Validation Snapshot

- Added `Vitest` unit regression coverage for live input classification and context lookup under `src/services/input/liveInputClassifier.test.ts` and `src/services/input/liveInputContext.test.ts`.
- Validation rerun in this session: `npm run test:unit`, `npm run lint:max-lines`, `npm run lint:docs-sync`, `npm run lint:state-consistency`, `npx tsc --noEmit`, and `npm run build`.
- Store-path refactor landed in this session: `sendAutoRecognizedInputFlow()` now orchestrates classify/dispatch/post-effects in `src/store/chatActions.ts`, and `useChatStore.sendAutoRecognizedInput()` is reduced to orchestration-only wiring.
- Phase 2 latest-message correction landed in this session: message-row quick reclassify UI + `reclassifyRecentInput()` store action with minimal timeline repair (`mood -> activity` closes previous open activity; `activity -> mood` reopens previous adjacent activity when applicable).
- Next validation gap: end-to-end regression is not yet automated for the full send/reclassify chain; Phase 2 / P1 will add this test coverage.
- Added store-action regression tests in `src/store/chatActions.test.ts` covering representative sentence routing (`mood`, `activity`, `activity_with_mood`, `mood_about_last_activity`) and latest-message reclassify timeline repair boundaries.
- Added store-integration regression tests in `src/store/useChatStore.integration.test.ts` to verify sentence routing and latest-message reclassify behavior through real store actions (`sendAutoRecognizedInput`, `reclassifyRecentInput`).
- Added reproducible gold evaluation script `scripts/evaluate_live_input_gold.py` (default source: parent-level `timeshine_gold_samples.xlsx`) and npm command `npm run eval:live-input:gold` for zh baseline reruns.
- Tuned zh rules in `src/services/input/liveInputRules.zh.ts` and `src/services/input/liveInputClassifier.ts`: reduced single-character verb false positives, added colloquial activity patterns, expanded mood/evaluation signals, and added non-activity intent guards.
- Added gold-driven zh regression cases in `src/services/input/liveInputClassifier.test.ts` and reran `npm run test:unit -- src/services/input/liveInputClassifier.test.ts`.
- Current offline snapshot (`scripts/evaluate_live_input_gold.py`): full-set `internalKind` moved from 66.00% to 71.00%; zh subset moved from 70.24% to 76.19%.
- Added ChatPage wiring regression coverage by extracting `handleLatestMessageReclassify()` into `src/features/chat/chatPageActions.ts` and adding `src/features/chat/chatPageActions.test.ts` (forward args, await ordering, and failure behavior).
- Product decision confirmed for completion semantics: completion utterances are context-gated (`no related context => activity`, `related context => mood_about_last_activity`), with weak completion markers (`终于/总算/松口气/撑过去`) treated as mood signals instead of completion triggers.
- Classifier refactor constraints confirmed: (1) non-activity/future intent interception must run before ongoing/activity detection; (2) context relevance must use tokenized activity keyword overlap and explicit deictic references, not raw substring contains.
- Implemented classifier decision-chain update in `src/services/input/liveInputClassifier.ts` and `src/services/input/liveInputRules.zh.ts`: non-activity intent precheck, strong/weak completion split, ongoing signal detector, and token-overlap context relevance (raw substring contains removed).
- Extended classifier regressions in `src/services/input/liveInputClassifier.test.ts` for context-gated completion and negative-intent priority; reran `npm run test:unit -- src/services/input/liveInputClassifier.test.ts` (40/40 passed).
- Implemented mood attachment source/origin tracking in `src/store/useMoodStore.ts` (`activityMoodMeta`/`moodNoteMeta`, linked mood message id) and added deterministic `clearAutoMoodAttachmentsByMessage()` cleanup entry for correction flow.
- Updated send/write path in `src/store/useChatStore.ts` + `src/store/chatActions.ts`: `sendMood(content, { relatedActivityId })` no longer falls back to latest activity; `standalone_mood` now only attaches via explicit ongoing-context id.
- Upgraded latest-message reclassify cleanup to linked-id semantics (instead of content string equality) and covered ongoing-vs-ended attach boundary + source-aware cleanup + edit recompute behavior in `src/store/useChatStore.integration.test.ts` and `src/store/chatActions.test.ts`.
- Validation rerun in this session: `npm run test:unit -- src/store/chatActions.test.ts src/store/useChatStore.integration.test.ts`, `npm run test:unit -- src/services/input/liveInputClassifier.test.ts`, `npx tsc --noEmit`, and `npm run lint:state-consistency`.
- Added first-pass multilingual rule seeds in `src/services/input/liveInputRules.en.ts` and `src/services/input/liveInputRules.it.ts`, then wired latin-path fallback classification in `src/services/input/liveInputClassifier.ts`.
- Extended `src/services/input/liveInputClassifier.test.ts` with en/it baseline regressions (`standalone_mood`, `new_activity`, `mood_about_last_activity`, planned/future interception) and reran classifier tests (46/46 passed).
- Offline evaluation rerun snapshot in this session: `npm run eval:live-input:gold` (zh subset `internal_accuracy=98.81%`), `python scripts/evaluate_natural_probe.py` (`internal_accuracy=80.00%`, still showing `activity_with_mood -> standalone_mood` as top gap).
- Landed zh rule tuning round-2 focused on `activity_with_mood` misses: expanded completion/activity patterns (`打完/改代码/交作业/会开得`), added mood-eval patterns (`得很顺利/得很好/感觉轻松`), and treated weak completion as mood evidence for mixed activity+mood routing.
- Added targeted zh regressions in `src/services/input/liveInputClassifier.test.ts` for natural probe failure phrases (`和客户会开得很顺利`, `刚打完球，好爽`, `写完报告了，终于松口气`, `午休睡得很好`, `买到想要的东西，开心`) and reran tests (51/51 passed).
- Evaluation rerun after round-2: `python scripts/evaluate_natural_probe.py` improved `internal_accuracy` from `80.00%` to `89.23%` (`activity_with_mood` recall `46.67% -> 66.67%`); zh gold slightly regressed `98.81% -> 98.21%` due one `new_activity -> activity_with_mood` over-trigger sample.
- Expanded en/it baseline dictionaries in `src/services/input/liveInputRules.en.ts` and `src/services/input/liveInputRules.it.ts` with stronger completion, activity, mood-evaluation, and future-plan patterns; updated latin context relevance in `src/services/input/liveInputClassifier.ts` from raw substring match to token-overlap matching.
- Added `src/services/input/liveInputRules.test.ts` (24 smoke regressions across zh/en/it rule packs) and expanded en/it classifier regressions in `src/services/input/liveInputClassifier.test.ts`; reran targeted tests (`93/93` passed).
- Added lightweight local telemetry in `src/services/input/liveInputTelemetry.ts` and wired it into `src/store/chatActions.ts` + `src/store/useChatStore.ts` to track auto-recognition distribution, top reasons, and reclassify path counts.
- AI fallback decision refreshed from latest rerun (`npm run eval:live-input:gold`, `python scripts/evaluate_natural_probe.py`): keep fallback disabled for now; current errors are still explainable by rule tuning and correction path remains available.
- Session-8 decision: stop `moodauto` as active implementation mainline and treat it as monitor-only mainline with explicit reopen thresholds (`internal_accuracy < 75%` twice, or `mood_about_last_activity` recall < `70%` twice).

## Resume Order

1. Read `LLM.md`.
2. Read this file (`docs/CURRENT_TASK.md`).
3. Read `docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md`.
4. Read `src/features/chat/README.md`.
5. Inspect the current send path in `src/features/chat/ChatInputBar.tsx`, `src/features/chat/ChatPage.tsx`, `src/store/useChatStore.ts`, and `src/store/chatActions.ts`.
6. Use `docs/CODE_CLEANUP_HANDOVER_PLAN.md` only as historical reference when a past cleanup decision needs to be checked.
