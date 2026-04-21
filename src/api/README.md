# Frontend API Module

## Entry

- `src/api/client.ts`: frontend API request facade
- `src/api/supabase.ts`: Supabase browser client

## Public Interface

- `callReportAPI()`
- `callAnnotationAPI()`
- `callClassifierAPI()`
- `callDiaryAPI()`
- `callMagicPenParseAPI()`
- `callTodoDecomposeAPI()`
- `callPlantGenerateAPI()`
- `callPlantDiaryAPI()`
- `callPlantHistoryAPI()` (`GET` with auth headers + query params)
- `callPlantAssetTelemetryAPI()` (records resolved plant image fallback level)
- `callExtractProfileAPI()` (weekly report trigger; extracts `observed/dynamic/memory` profile patch, supports `lang` routing)
- `callSubscriptionAPI()` (membership activate/restore/cancel bridge for payment adapters)
- `callStripeCheckoutAPI()` (web stripe adapter: create checkout session URL via `/api/subscription`)
- `callStripeFinalizeAPI()` (web stripe adapter: finalize returned checkout session and persist plus metadata)

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
- `/api/live-input-telemetry` is the consolidated telemetry endpoint: `POST` ingests live-input events, `GET` returns dashboard aggregates for live input events, plant fallback telemetry events, diary sticker operations (`diary_sticker_*`), and AI annotation telemetry events (`density_scored`/`trigger_blocked`/`event_triggered`/`event_condensed`/`lateral_sampled`) from `telemetry_events`; `GET` with `module=user_analytics` returns user-growth dashboard payloads (supports `type=user_lookup`), and `GET` with `module=holiday_check&date=YYYY-MM-DD&country=XX` returns reminder free-day detection payload (`{ isFreeDay, reason, name? }`).
- `callExtractProfileAPI()` posts weekly report `recentMessages[] + lang` to `/api/extract-profile` with auth header and gets a profile patch payload (`Partial<UserProfileV2>`), then `useAuthStore.updateUserProfile(...)` merges it into `user_metadata.user_profile_v2`; profile patch now includes `observed.weeklyStateSummary`, `observed.topActivities` (top3), `observed.topMoods` (top3).

## Current Notes

- The ongoing `moodauto` classifier/refactor work remains in `src/services/input` + `src/store` and does not add new frontend API endpoints.
- Added Magic Pen parse contract for `/api/magic-pen-parse` to support AI-first draft extraction.
- `callMagicPenParseAPI()` supports `lang` (`zh`/`en`/`it`), and server prompt routing now follows this field.
- Magic Pen parse `segments[*].kind` now supports four kinds: `activity` / `mood` / `todo_add` / `activity_backfill` (plus `unparsed` array for unmatched content).
- Magic Pen parse `segments[*]` now supports `timeRelation` (`realtime` / `future` / `past` / `unknown`) for parser-first direct-write gating.
- Endpoint robustness baseline now includes `src/server/magic-pen-parse.test.ts` (body validation + wrapped JSON extraction + invalid-output fallback).
- `callAnnotationAPI()` and `callDiaryAPI()` now automatically attach the current `preferences.aiMode` so annotation and diary prompts stay aligned with the selected companion persona.
- `callDiaryAPI()` now supports `mode: 'full' | 'teaser'`; `teaser` returns low-cost copy used for Free diary blur-lock surface.
- `callSubscriptionAPI()` posts to `/api/subscription` with auth header; iOS IAP adapter uses it to persist `membership_plan` after server-side verification.
- Stripe web checkout now also uses `/api/subscription` in two authenticated actions: `stripe_checkout` (returns `checkoutUrl`) and `stripe_finalize` (verifies `stripe_session_id` then writes `membership_plan`).
- Stardust creation no longer calls a dedicated emoji model endpoint; the emoji is reused from annotation content in store layer with local fallback (`✨`).
- `callAnnotationAPI()` request context now includes `statusSummary/contextHints/frequentActivities/todayContext/characterStateText/characterStateMeta/currentDate/countryCode/holiday` plus optional `latitude/longitude` and optional env fields (`weatherContext/seasonContext/weatherAlerts`), along with suggestion-gating fields (`allowSuggestion`, `consecutiveTextCount`). `pendingTodos[*]` additionally supports `createdAt/ageDays` for stale-todo detection; response supports `suggestion` payload for actionable AI bubbles.
- `callAnnotationAPI()` `userContext` now also supports `userProfileSnapshot` (long-term profile snapshot text + meal-time hints), gated by `user_metadata.long_term_profile_enabled` on the client side.
- annotation 服务端新增横向联想采样：根据 `aiMode + userContext.userId + eventSummary` 生成 `associationInstruction` 并插入 prompt（U4，位于角色状态后）；采样状态优先写入 `user_metadata.lateral_association_state_v1`（无 service role 时回退进程内缓存）。
- annotation 服务端新增低叙事密度判定：基于 `today_narrative_cache_v1` 做规则评分 + 分数连续概率触发（受 `todayRichness` 影响），命中后注入单条叙事指令。
- `callAnnotationAPI()` `userContext` now supports `recoveryNudge` (missed-streak reminder context), and suggestion payload supports reward metadata (`rewardStars`, `rewardBottleId`, `recoveryKey`) plus stale-todo pre-decompose metadata (`decomposeReady`, `decomposeSourceTodoId`, `decomposeSteps`) for one-time bonus awarding and step-first execution.
- `callAnnotationAPI()` response may include `narrativeEvent` (`eventType/eventId/instruction/isTriggeredReply`) so store layer can correlate low-density-triggered replies with `event_condensed` telemetry.
- Annotation prompt assembly now goes through `src/server/annotation-prompt-builder.ts`, which centralizes prompt packaging for both annotation/suggestion paths and returns a unified `{ model, instructions, input }` payload to the LLM call.
- Annotation model/provider 路由：`zh` 使用 `deepseek-chat`（`DEEPSEEK_API_KEY` + 可选 `ANNOTATION_DEEPSEEK_BASE_URL`，走 `chat.completions`），`en/it` 使用 `gpt-4.1-mini`（`OPENAI_API_KEY` + 可选 `OPENAI_BASE_URL`）。
- Annotation 事件层新增待办完成透传：完成待办时会发送 `activity_completed`，并在 `eventData` 附带 `todoCompletionContext`（important/recurrence/createdAt/threeMonth）与按条件附加的紧凑 `summary`，普通输入继续走 `activity_recorded`。
- `callTodoDecomposeAPI()` routes to `/api/todo-decompose`（由 `vercel.json` rewrite 到 `/api/classify` 的 `todo_decompose` 分支）；zh defaults to DashScope `qwen-plus` (`QWEN_API_KEY`, override via `TODO_DECOMPOSE_MODEL_ZH`), en/it default to Gemini `gemini-2.5-flash` (`GEMINI_API_KEY`, override via `TODO_DECOMPOSE_MODEL`, auto-fallback via `TODO_DECOMPOSE_GEMINI_FALLBACK_MODEL`).
- Plant diary generation now reads the authenticated user's `user_metadata.ai_mode` on the server side before building diary prompts.
- The legacy `/api/chat` companion-response endpoint has been retired. `/chat` now runs as a record timeline plus Magic Pen surface, and all remaining AI calls still route through `/api/*`.

## Related Docs

- `LLM.md`
- `docs/PROJECT_MAP.md`
- `api/README.md`
- `docs/ARCHITECTURE.md`
- `docs/CURRENT_TASK.md`
