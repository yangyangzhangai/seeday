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
- `callMagicPenParseAPI()`

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
- Added Magic Pen parse contract for `/api/magic-pen-parse` to support AI-first draft extraction.
- `callMagicPenParseAPI()` supports `lang` (`zh`/`en`/`it`), and server prompt routing now follows this field.
- Magic Pen parse `segments[*].kind` now supports four kinds: `activity` / `mood` / `todo_add` / `activity_backfill` (plus `unparsed` array for unmatched content).
- Endpoint robustness baseline now includes `api/magic-pen-parse.test.ts` (body validation + wrapped JSON extraction + invalid-output fallback).

## Related Docs

- `LLM.md`
- `docs/PROJECT_MAP.md`
- `api/README.md`
- `docs/ARCHITECTURE.md`
- `docs/CODE_CLEANUP_HANDOVER_PLAN.md`
