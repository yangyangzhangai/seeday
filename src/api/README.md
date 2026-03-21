# Frontend API Module

## Entry

- `src/api/client.ts`: frontend API request facade
- `src/api/supabase.ts`: Supabase browser client

## Public Interface

- `callReportAPI()`
- `callAnnotationAPI()`
- `callClassifierAPI()`
- `callDiaryAPI()`
- `callStardustAPI()`
- `callMagicPenParseAPI()`
- `callPlantGenerateAPI()`
- `callPlantDiaryAPI()`
- `callPlantHistoryAPI()`

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
- Plant endpoints (`/api/plant-generate`, `/api/plant-diary`, `/api/plant-history`) require Supabase Bearer token from current session.

## Current Notes

- The ongoing `moodauto` classifier/refactor work remains in `src/services/input` + `src/store` and does not add new frontend API endpoints.
- Added Magic Pen parse contract for `/api/magic-pen-parse` to support AI-first draft extraction.
- `callMagicPenParseAPI()` supports `lang` (`zh`/`en`/`it`), and server prompt routing now follows this field.
- Magic Pen parse `segments[*].kind` now supports four kinds: `activity` / `mood` / `todo_add` / `activity_backfill` (plus `unparsed` array for unmatched content).
- Magic Pen parse `segments[*]` now supports `timeRelation` (`realtime` / `future` / `past` / `unknown`) for parser-first direct-write gating.
- Endpoint robustness baseline now includes `api/magic-pen-parse.test.ts` (body validation + wrapped JSON extraction + invalid-output fallback).
- `callAnnotationAPI()` and `callDiaryAPI()` now automatically attach the current `preferences.aiMode` so annotation and diary prompts stay aligned with the selected companion persona.
- Plant diary generation now reads the authenticated user's `user_metadata.ai_mode` on the server side before building diary prompts.
- The legacy `/api/chat` companion-response endpoint has been retired. `/chat` now runs as a record timeline plus Magic Pen surface, and all remaining AI calls still route through `/api/*`.

## Related Docs

- `LLM.md`
- `docs/PROJECT_MAP.md`
- `api/README.md`
- `docs/ARCHITECTURE.md`
- `docs/CURRENT_TASK.md`
