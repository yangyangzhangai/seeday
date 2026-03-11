# Chat Module

## Entry

- Page entry: `src/features/chat/ChatPage.tsx`

## Public Interface

- Route: `/chat`
- Main user flows:
  - Chat conversation (`chat` mode)
  - Auto-recognized record input (`record` mode): single input routes through `sendAutoRecognizedInput()` and classifies `activity` vs `mood`
  - Magic Pen (`record` side flow): wand button toggles Magic Pen mode; when mode is on, tapping send triggers parse and opens `MagicPenSheet` with `activity_backfill` / `todo_add` drafts, then commit via `insertActivity(null, null, ...)` and `addTodo(...)`
  - Latest-message correction (`record` mode): message row supports quick reclassify between `activity` and `mood` through `reclassifyRecentInput(messageId, nextKind)`
  - Primary record input path uses local rule classification by default (no unconditional classifier API call)
  - Mood quick record (`isMood` message path) remains as the message semantic output, not an input mode toggle

## Upstream Dependencies

- Stores:
  - `src/store/useChatStore.ts`
  - `src/store/useMoodStore.ts`
  - `src/store/useAnnotationStore.ts`
  - `src/store/useStardustStore.ts`
- Services:
  - `src/services/input/liveInputClassifier.ts`
  - `src/services/input/liveInputContext.ts`
  - `src/services/input/magicPenParser.ts`
  - `src/services/input/magicPenDraftBuilder.ts`
  - `src/features/chat/chatPageActions.ts` (message-row reclassify UI handler wiring)
- Chat action flow:
  - `src/store/chatActions.ts` (`classify -> dispatch -> post-effects` pipeline + latest-message reclassify timeline repair helpers)
  - `src/store/magicPenActions.ts` (Magic Pen draft commit orchestration)
- API client: `src/api/client.ts`
- UI feedback components: `src/components/feedback/*`

## Downstream Impact

- `/chat` writes message/activity/mood data used by `/report` analytics
- Chat actions can trigger annotation and stardust generation paths
- Changes in message schema impact `useReportStore` and DB mappers

## Related Docs

- `LLM.md`
- `docs/PROJECT_MAP.md`
- `FEATURE_STATUS.md`
- `docs/ARCHITECTURE.md`
- `docs/CODE_CLEANUP_HANDOVER_PLAN.md`

## Test Coverage Anchor

- Chat row correction wiring regression: `src/features/chat/chatPageActions.test.ts`
- Magic Pen parser regression: `src/services/input/magicPenParser.test.ts`
- Magic Pen commit orchestration regression: `src/store/magicPenActions.test.ts`
