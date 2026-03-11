# Changelog

All notable changes to this repository are documented here.

## Documentation Isomorphism Logging Rules

1. Any structural/interface/code-path change must include one changelog line in the same PR.
2. Changelog entries must reference both code path and doc path updates.
3. If `npm run lint:docs-sync` scope is touched, the entry must mention doc-sync impact.

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
