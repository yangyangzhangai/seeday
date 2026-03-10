# Frontend API Module

## Entry

- `src/api/client.ts`: frontend API request facade
- `src/api/supabase.ts`: Supabase browser client

## Public Interface

- `callChatAPI()`
- `callReportAPI()`
- `callAnnotationAPI()`
- `callClassifierAPI()`
- `callDiaryAPI()`
- `callStardustAPI()`

All AI-facing requests must route through `/api/*` serverless handlers.

## Upstream Dependencies

- Invoked by store/action layers in `src/store/*`
- Uses browser `fetch` and response error normalization
- Uses env configuration from `src/api/supabase.ts`

## Downstream Impact

- Changes in request/response contracts affect all feature modules
- Error-shape changes can break store fallback handling
- Any new endpoint must be reflected in both `src/api/client.ts` and `api/*`
- `/api/annotation` internals are split as entry + handler + prompt templates (`api/annotation.ts`, `api/annotation-handler.ts`, `api/annotation-prompts.ts`)

## Current Notes

- The ongoing `moodauto` classifier/refactor work remains in `src/services/input` + `src/store` and does not add new frontend API endpoints.
- Existing frontend API facade contracts in `src/api/client.ts` remain unchanged in this round.

## Related Docs

- `LLM.md`
- `docs/PROJECT_MAP.md`
- `api/README.md`
- `docs/ARCHITECTURE.md`
- `docs/CODE_CLEANUP_HANDOVER_PLAN.md`
