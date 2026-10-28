<!-- DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md -> docs/AI_USAGE_INVENTORY.md -->

# Frontend API Module

## Entry

- `src/api/client.ts`: frontend API request facade
- `src/api/supabase.ts`: Supabase browser client
- `src/api/reminderResponses.ts`: authenticated Supabase CRUD mapper for reminder receipts

## Public Interface

- `callAnnotationAPI()`
- `callClassifierAPI()`
- `callDiaryAPI()`
- `callShortInsightAPI()` (reuses `/api/diary`)
- `callMagicPenParseAPI()`
- `callTodoDecomposeAPI()`
- `callPlantGenerateAPI()`
- `callPlantHistoryAPI()` (`GET` with auth headers + query params)
- `callPlantAssetTelemetryAPI()` (records resolved plant image fallback level)
- `callLiveInputTelemetryIngestAPI()` / `callLiveInputTelemetryDashboardAPI()`
- `callUserAnalyticsDashboardAPI()` / `callUserAnalyticsLookupAPI()`
- `callProfileSettingsTelemetryDashboardAPI()`
- `callExtractProfileAPI()` (weekly report trigger; extracts `observed/dynamic/memory` profile patch, supports `lang` routing)
- `callDeleteAccountAPI()` (accepts a fresh native Apple authorization code when the linked account uses Apple, allowing the server to exchange, identity-check, and revoke Apple authorization before data deletion)
- `callSubscriptionAPI()` (membership activate/restore/cancel bridge for payment adapters)
- `callActivateTrialAPI()`
- `callStripeCheckoutAPI()` (web stripe adapter: create checkout session URL via `/api/subscription`)
- `callStripeFinalizeAPI()` (web stripe adapter: finalize returned checkout session and persist plus metadata)
- `upsertReminderResponse()` / `fetchReminderResponses()` (idempotent current-day cross-device reminder receipts)

All AI-facing requests must route through `/api/*` serverless handlers.
Pure AI calls also pass through one client-side consent gate: the signed-in account must have the current consent version granted, otherwise the client emits the global consent-review event and raises `ApiClientError(code='ai_consent_required')`. The server independently verifies the same database record; client state is never the sole authorization evidence.
Reminder receipts use the authenticated Supabase client directly; RLS restricts rows to `auth.uid() = user_id`.

## Upstream Dependencies

- Invoked by store/action layers in `src/store/*`
- Uses browser `fetch` and response error normalization
- Uses env configuration from `src/api/supabase.ts`

## Downstream Impact

- Changes in request/response contracts affect all feature modules
- Error-shape changes can break store fallback handling
- Any new endpoint must be reflected in both `src/api/client.ts` and `api/*`
- `/api/annotation` internals are split as entry + handler + prompt templates (`api/annotation.ts`, `src/server/annotation-handler.ts`, `src/server/annotation-prompts.ts`)
- Plant endpoints (`/api/plant-generate`, `/api/plant-history`) require Supabase Bearer token from current session；其中 `plant-history` 是当前 GET 型端点。
- Plant generate response status includes `monthly_exhausted` when the current month has no unused candidate plant IDs left for the computed root type.
- `callPlantGenerateAPI()` accepts optional `action: 'snapshot_existing'` to backfill an existing legacy plant's root snapshot without creating a new endpoint or bypassing user/date ownership checks.
- Plant response records may include `rootSnapshot` (saved root segments, direction order, and generation-time activity details); clients should prefer it over rebuilding card backs from mutable messages.
- Plant asset telemetry endpoint (`/api/plant-asset-telemetry`) records which fallback level (`1-4`) was used when plant artwork resolves.
- `/api/live-input-telemetry` is the consolidated telemetry endpoint: `POST` ingests live-input events, `GET` returns dashboard aggregates for live input events, plant fallback telemetry events, diary sticker operations (`diary_sticker_*`), and AI annotation telemetry events (`density_scored`/`trigger_blocked`/`event_triggered`/`event_condensed`/`lateral_sampled`) from `telemetry_events`; `GET` with `module=user_analytics` returns user-growth dashboard payloads (supports `type=user_lookup`), and `GET` with `module=holiday_check&date=YYYY-MM-DD&country=XX` returns reminder free-day detection payload (`{ isFreeDay, reason, name? }`).
- `callExtractProfileAPI()` posts weekly report `recentMessages[] + lang` to `/api/extract-profile` with auth header and gets a profile patch payload (`Partial<UserProfileV2>`), then `useAuthStore.updateUserProfile(...)` merges it into `user_profiles.profile`; profile patch now includes `observed.weeklyStateSummary`, `observed.topActivities` (top3), `observed.topMoods` (top3).

## Current Notes

- 2026-10-28: DeepSeek sampling/output budgets are tuned server-side per feature; frontend payloads and response contracts are unchanged. Prompts and provider-switch configuration are unchanged; see `docs/AI_USAGE_INVENTORY.md` for current budgets.
- The ongoing `moodauto` classifier/refactor work remains in `src/services/input` + `src/store` and does not add new frontend API endpoints.
- `callClassifierAPI()` now forwards Supabase `Authorization` header; backend `/api/classify` enforces Plus membership and can return `403 membership_required` for non-Plus users.
- Annotation, classifier/todo-decompose, full diary/insight, Magic Pen, and profile extraction now all attach Supabase auth and require current AI consent. Diary teaser remains deterministic; plant generation remains available without consent but the server uses only local fallback text and skips all AI providers.
- AI routing is configured server-side through `AI_PROVIDER_MODE` (default DeepSeek, optional `legacy`). Frontend request/response contracts and language/persona inputs are unchanged. Model names, non-thinking settings, output budgets, and rollback configuration are maintained in `docs/AI_USAGE_INVENTORY.md`.
- `callClassifierAPI()` unified response is now single-input schema: `data.kind` (`activity|mood`, mandatory binary), `data.activity_type` (six activity classes), `data.mood_type` (8-key mood enum or null), `data.matched_bottle` (optional), and `data.confidence` (0~1).
- API client now normalizes server errors into `ApiClientError` (`code/status/details/path/requestId`) and exports `isMembershipRequiredError()` for stable branch handling without brittle string matching.
- Membership classification observability now reuses `/api/live-input-telemetry` `classification` ingest path with `reasons[]` tags (`membership_classification`, `user_plan:*`, `classification_path:*`, `ai_called:*`, `ai_result_kind:*`, `bottle_match_source:*`) to avoid adding extra endpoint/files.
- Added Magic Pen parse contract for `/api/magic-pen-parse` to support AI-first draft extraction.
- `callMagicPenParseAPI()` supports `lang` (`zh`/`en`/`it`), and server prompt routing now follows this field.
- Magic Pen parse `segments[*].kind` now supports four kinds: `activity` / `mood` / `todo_add` / `activity_backfill` (plus `unparsed` array for unmatched content).
- Magic Pen parse `segments[*]` now supports `timeRelation` (`realtime` / `future` / `past` / `unknown`) for parser-first direct-write gating.
- Magic Pen treats empty/low-coverage/missing-time/under-split remote output as `low_quality` and falls back to the existing local parser. Current AI provider and model configuration are maintained only in `docs/AI_USAGE_INVENTORY.md`.
- Provider exhaustion returns the complete submitted `rawText` in `unparsed`; the frontend no longer substitutes a fixed Chinese failure placeholder or silently slices requests at 500 characters.
- Endpoint robustness includes `src/server/magic-pen-parse.test.ts`, `src/server/magic-pen-quality.test.ts`, and `src/services/input/magicPenParser.remoteFallback.test.ts`.
- `callAnnotationAPI()` and `callDiaryAPI()` now automatically attach the current `preferences.aiMode` so annotation and diary prompts stay aligned with the selected companion persona.
- `callDiaryAPI()` now supports `mode: 'full' | 'teaser'`; `teaser` returns low-cost copy used for Free diary blur-lock surface.
- `callDiaryAPI()` full-mode responses are complete, unsliced diary bodies: the server treats length as a soft target, retries one early/incomplete provider result, and returns an error rather than exposing a second incomplete draft.
- `callShortInsightAPI()` reuses `/api/diary` with `action='insight'`; its ZH/EN/IT result is a card-sized complete phrase (English/Italian at most eight whole words) rather than a fixed 20-character slice.
- `callSubscriptionAPI()` posts to `/api/subscription` with auth header; iOS IAP adapter uses it to persist both auth metadata membership fields and the normalized `user_account_state.plan_*` snapshot after server-side verification.
- The IAP activation request contract is unchanged; the server signs Apple verification JWTs with the JWS-required ES256 IEEE-P1363 format and retries Sandbox when the Production lookup returns `401` or `404`, covered by `api/subscription.test.ts`.
- Stripe web checkout now also uses `/api/subscription` in two authenticated actions: `stripe_checkout` (returns `checkoutUrl`) and `stripe_finalize` (verifies `stripe_session_id` then writes `membership_plan`).
- Stardust creation no longer calls a dedicated emoji model endpoint; the emoji is reused from annotation content in store layer with local fallback (`✨`).
- `callAnnotationAPI()` request context now includes `statusSummary/contextHints/frequentActivities/todayContext/characterStateText/characterStateMeta/currentDate/countryCode/holiday` plus optional `latitude/longitude` and optional env fields (`weatherContext/seasonContext/weatherAlerts`), along with suggestion-gating fields (`allowSuggestion`, `consecutiveTextCount`). `pendingTodos[*]` additionally supports `createdAt/ageDays` for stale-todo detection; response supports `suggestion` payload for actionable AI bubbles.
- `callAnnotationAPI()` `userContext` now also supports `userProfileSnapshot` (long-term profile snapshot text + meal-time hints), gated by `useAuthStore.longTermProfileEnabled` on the client side.
- annotation 服务端新增横向联想采样：根据 `aiMode + userContext.userId + eventSummary` 生成 `associationInstruction` 并插入 prompt（U4，位于角色状态后）；采样状态优先写入 `user_metadata.lateral_association_state_v1`（无 service role 时回退进程内缓存）。
- annotation 服务端新增低叙事密度判定：基于 `today_narrative_cache_v1` 做规则评分 + 分数连续概率触发（受 `todayRichness` 影响），命中后注入单条叙事指令。
- `callAnnotationAPI()` `userContext` now supports `recoveryNudge` (missed-streak reminder context), and suggestion payload supports reward metadata (`rewardStars`, `rewardBottleId`, `recoveryKey`) plus stale-todo pre-decompose metadata (`decomposeReady`, `decomposeSourceTodoId`, `decomposeSteps`) for one-time bonus awarding and step-first execution.
- Annotation suggestion mode now uses a dedicated companion system prompt instead of the plain annotation system prompt. Todo targeting uses `todoId` as the only hard locator, rewrites `todoTitle` from the canonical pending-todo row, and only forced suggestion mode may whole-payload-fallback to another todo; allow-suggestion mode now drops the button instead of swapping in a different fallback todo.
- `callAnnotationAPI()` response may include `narrativeEvent` (`eventType/eventId/instruction/isTriggeredReply`) so store layer can correlate low-density-triggered replies with `event_condensed` telemetry.
- Annotation prompt assembly now goes through `src/server/annotation-prompt-builder.ts`, which centralizes prompt packaging for both annotation/suggestion paths and returns a unified `{ model, instructions, input }` payload to the LLM call.
- Annotation provider 路由由服务端统一配置，默认三语均使用 DeepSeek；原英/意 OpenAI 路径仅在 legacy 模式启用，具体模型以 `docs/AI_USAGE_INVENTORY.md` 为准。
- Annotation 事件层新增待办完成透传：完成待办时会发送 `activity_completed`，并在 `eventData` 附带 `todoCompletionContext`（important/recurrence/createdAt/threeMonth）与按条件附加的紧凑 `summary`，普通输入继续走 `activity_recorded`。
- `callTodoDecomposeAPI()` routes to `/api/todo-decompose`（由 `vercel.json` rewrite 到 `/api/classify` 的 `todo_decompose` 分支）；默认三语均使用 DeepSeek，原英/意 Gemini 适配器仅在 legacy 模式启用，具体配置以 `docs/AI_USAGE_INVENTORY.md` 为准。
- `callTodoDecomposeAPI()` now forwards Supabase `Authorization` header as a member-only path guard, aligned with `/api/classify` auth + Plus enforcement.
- Plant diary generation now reads the authenticated user's `user_metadata.ai_mode` on the server side before building diary prompts.
- The legacy `/api/chat` companion-response endpoint has been retired. `/chat` now runs as a record timeline plus Magic Pen surface, and all remaining AI calls still route through `/api/*`.

## Related Docs

- `LLM.md`
- `docs/PROJECT_MAP.md`
- `api/README.md`
- `docs/AI_USAGE_INVENTORY.md`
- `docs/ARCHITECTURE.md`
- `docs/CURRENT_TASK.md`
