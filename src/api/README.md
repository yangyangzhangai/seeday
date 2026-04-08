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
- `callTodoDecomposeAPI()`
- `callPlantGenerateAPI()`
- `callPlantDiaryAPI()`
- `callPlantHistoryAPI()` (`GET` with auth headers + query params)
- `callPlantAssetTelemetryAPI()` (records resolved plant image fallback level)

All AI-facing requests must route through `/api/*` serverless handlers.

## Upstream Dependencies

- Invoked by store/action layers in `src/store/*`
- Uses browser `fetch` and response error normalization
- Uses env configuration from `src/api/supabase.ts`

## Downstream Impact

- Changes in request/response contracts affect all feature modules
- Error-shape changes can break store fallback handling
- Any new endpoint must be reflected in both `src/api/client.ts` and `api/*`
- `/api/annotation` internals are split as entry + handler + prompt templates (`api/annotation.ts`, `src/server/annotation-handler.ts`, `src/server/annotation-prompts.ts`)
- Plant endpoints (`/api/plant-generate`, `/api/plant-diary`, `/api/plant-history`) require Supabase Bearer token from current session；其中 `plant-history` 是当前 GET 型端点。
- Plant generate response status includes `monthly_exhausted` when the current month has no unused candidate plant IDs left for the computed root type.
- Plant asset telemetry endpoint (`/api/plant-asset-telemetry`) records which fallback level (`1-4`) was used when plant artwork resolves.
- `/api/live-input-telemetry` is the consolidated telemetry endpoint: `POST` ingests live-input events, `GET` returns dashboard aggregates for live input events, plant fallback telemetry events, and diary sticker operations (`diary_sticker_*`) from `telemetry_events`.

## Current Notes

- The ongoing `moodauto` classifier/refactor work remains in `src/services/input` + `src/store` and does not add new frontend API endpoints.
- Added Magic Pen parse contract for `/api/magic-pen-parse` to support AI-first draft extraction.
- `callMagicPenParseAPI()` supports `lang` (`zh`/`en`/`it`), and server prompt routing now follows this field.
- Magic Pen parse `segments[*].kind` now supports four kinds: `activity` / `mood` / `todo_add` / `activity_backfill` (plus `unparsed` array for unmatched content).
- Magic Pen parse `segments[*]` now supports `timeRelation` (`realtime` / `future` / `past` / `unknown`) for parser-first direct-write gating.
- Endpoint robustness baseline now includes `src/server/magic-pen-parse.test.ts` (body validation + wrapped JSON extraction + invalid-output fallback).
- `callAnnotationAPI()` and `callDiaryAPI()` now automatically attach the current `preferences.aiMode` so annotation and diary prompts stay aligned with the selected companion persona.
- `callAnnotationAPI()` request context now includes `statusSummary/contextHints/frequentActivities/todayContext` plus suggestion-gating fields (`allowSuggestion`, `consecutiveTextCount`), and response supports `suggestion` payload for actionable AI bubbles.
- `callAnnotationAPI()` `userContext` now supports `recoveryNudge` (missed-streak reminder context), and suggestion payload supports reward metadata (`rewardStars`, `rewardBottleId`, `recoveryKey`) for one-time bonus awarding on completion.
- `callTodoDecomposeAPI()` routes to `/api/todo-decompose`, which now uses OpenAI (`OPENAI_API_KEY`) with default model `gpt-4o-mini` (override via `TODO_DECOMPOSE_MODEL`).
- Plant diary generation now reads the authenticated user's `user_metadata.ai_mode` on the server side before building diary prompts.
- The legacy `/api/chat` companion-response endpoint has been retired. `/chat` now runs as a record timeline plus Magic Pen surface, and all remaining AI calls still route through `/api/*`.

## Related Docs

- `LLM.md`
- `docs/PROJECT_MAP.md`
- `api/README.md`
- `docs/ARCHITECTURE.md`
- `docs/CURRENT_TASK.md`
