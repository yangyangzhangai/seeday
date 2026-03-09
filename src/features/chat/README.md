# Chat Module

## Entry

- Page entry: `src/features/chat/ChatPage.tsx`

## Public Interface

- Route: `/chat`
- Main user flows:
  - Chat conversation (`chat` mode)
  - Auto-recognized record input (`record` mode): single input routes through `sendAutoRecognizedInput()` and classifies `activity` vs `mood`
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
