# CURRENT TASK (Session Resume Anchor)

- Last Updated: 2026-03-09
- Owner: current working session
- Purpose: this file is the quick resume anchor for any new session.

## Current Focus

- Mainline task is now `moodauto`: implement the V1 automatic activity/mood recognition flow defined in `docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md`.
- `cleanup` is now a past task track and historical reference only; it is no longer the active execution board.
- V1 target: the chat main input auto-classifies `activity` vs `mood`, defaults ambiguous input to `mood`, keeps `activity_with_mood` attached mood info, and keeps the primary path AI-free.

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
- [ ] Phase 2 / P0: implement `reclassifyRecentInput(messageId, nextKind)` and the minimal timeline-repair logic needed for post-send correction.
- [ ] Phase 3 / Backlog: expand English/Italian dictionaries, add telemetry, and decide whether AI fallback is necessary based on misclassification data.

## Next Step (Single)

- Start Phase 2 / P0: implement `reclassifyRecentInput(messageId, nextKind)` with a minimal timeline-repair path for latest-message correction.

## Blockers

- No external blocker at the moment.
- Main engineering risk: activity <-> mood reclassification can affect timeline duration and "current activity" state, so that repair work should stay isolated to the Phase 2 correction flow.

## Validation Snapshot

- Added `Vitest` unit regression coverage for live input classification and context lookup under `src/services/input/liveInputClassifier.test.ts` and `src/services/input/liveInputContext.test.ts`.
- Validation rerun in this session: `npm run test:unit`, `npm run lint:max-lines`, `npm run lint:docs-sync`, `npm run lint:state-consistency`, `npx tsc --noEmit`, and `npm run build`.

## Resume Order

1. Read `LLM.md`.
2. Read this file (`docs/CURRENT_TASK.md`).
3. Read `docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md`.
4. Read `src/features/chat/README.md`.
5. Inspect the current send path in `src/features/chat/ChatInputBar.tsx`, `src/features/chat/ChatPage.tsx`, `src/store/useChatStore.ts`, and `src/store/chatActions.ts`.
6. Use `docs/CODE_CLEANUP_HANDOVER_PLAN.md` only as historical reference when a past cleanup decision needs to be checked.
