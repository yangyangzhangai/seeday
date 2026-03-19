# Chat Module

## Entry

- Page entry: `src/features/chat/ChatPage.tsx`

## Public Interface

- Route: `/chat`
- Main user flows:
  - Chat conversation (`chat` mode)
  - Auto-recognized record input (`record` mode): single input routes through `sendAutoRecognizedInput()` and classifies `activity` vs `mood`
- Magic Pen (`record` side flow): wand button toggles Magic Pen mode. Current runtime is parser-first whole-sentence extraction (`parseMagicPenInput(...)`) with a strict single-item direct-write gate. The next target architecture keeps parser-first handling for mixed input, adds a local fast path for simple single-intent `activity` / `mood`, and moves toward hybrid commit where realtime `activity|mood` can auto-write while `todo_add` / `activity_backfill` stay in `MagicPenSheet` review.
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
  - `src/features/chat/chatPageActions.ts` (message-row reclassify + mode-on send orchestration + pending guard)
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
- `docs/CURRENT_TASK.md`

## Test Coverage Anchor

- Chat row correction wiring regression: `src/features/chat/chatPageActions.test.ts`
- Magic Pen parser regression: `src/services/input/magicPenParser.test.ts`
- Magic Pen commit orchestration regression: `src/store/magicPenActions.test.ts`

## Latest Timeline Interaction Updates (2026-03-19)

- EventCard top-right action area is unified under card-active state:
  - camera upload trigger moved from in-card slot icon to action area
  - event-to-mood conversion button added next to delete
  - delete remains in the same action cluster
- ImageUploader now supports external trigger mode:
  - `hideUploadButton` to hide in-slot camera icon
  - `openSignal` to programmatically open file picker from card action area
- Reclassify visibility policy is now strict latest-record-only:
  - Timeline computes `latestRecordMessageId` from all `record + text` messages
  - EventCard `allowConvertToMood` and MoodCard `allowConvertToEvent` are both gated by latest id
- Store-level hard guard added for mood-to-event conversion:
  - `convertMoodToEvent(moodMsgId)` returns early unless `moodMsgId` is the latest `record + text` message
- Timeline disappearance fix after event->mood conversion:
  - converted message now sets `detached: true` so it remains visible as a mood card in timeline

## Store Refactor Update (2026-03-19)

- `src/store/useChatStore.ts` was split to keep the store entry under max-lines gate:
  - shared types/interfaces moved to `src/store/useChatStore.types.ts`
  - legacy `activity_type` backfill helper moved to `src/store/chatStoreLegacy.ts`
- `src/store/useChatStore.ts` remains the single runtime state/action entry consumed by chat page components.
