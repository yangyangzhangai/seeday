<!-- DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> docs/AI_USAGE_INVENTORY.md -> src/api/README.md -->

# API Serverless Guide

`api/*` 是 Vercel Serverless Functions，负责在服务端持有密钥并调用第三方模型。

## 边界约束

1. 仅处理服务端逻辑，不依赖 `window`、`localStorage` 等浏览器对象。
2. 前端统一通过 `src/api/client.ts` 调用，不在 `src/**` 直连第三方 AI。
3. 所有函数统一设置 CORS，并只接受各自的预期方法（含 `OPTIONS` 预检）；当前绝大多数为 `POST`，`/api/plant-history` 为 `GET`。
4. 密钥统一从 `process.env` 读取；模型由 `src/server/ai-routing.ts` 集中选择，默认全部 DeepSeek、关闭 thinking；保留旧供应商供 `AI_PROVIDER_MODE=legacy` 切换。模型/语言映射、请求预算见 `docs/AI_USAGE_INVENTORY.md`。
5. 第三方 AI 端点必须在调用服务商前核验当前版本的 `user_account_state.ai_consent_*`。纯 AI 端点未同意返回 `403 ai_consent_required`，consent 状态无法读取时返回 `503 ai_consent_verification_failed`；不得因校验故障放行。

## 端点清单（与当前实现一致）

| Method | Route | File | Success shape |
| --- | --- | --- | --- |
| `POST` | `/api/annotation` | `annotation.ts` (entry) + `src/server/annotation-handler.ts` + `src/server/annotation-prompts.ts` + `src/server/annotation-prompt-builder.ts` | `{ content, tone, displayDuration, source, reason?, suggestion? }` |
| `POST` | `/api/classify` | `classify.ts` | `{ success: true, data, raw }` |
| `POST` | `/api/diary` | `diary.ts` | full/teaser: `{ success: true, content }`; insight: `{ insight }` |
| `POST` | `/api/magic-pen-parse` | `magic-pen-parse.ts` | `{ success: true, data: { segments, unparsed }, raw, traceId, parseStrategy, providerUsed }` |
| `POST` | `/api/todo-decompose` | `classify.ts`（`module=todo_decompose` 分支；`vercel.json` 重写兼容旧路径） | `{ success: true, steps, parseStatus, model, provider }` |
| `POST` | `/api/extract-profile` | `extract-profile.ts` | `{ success: true, profile, skipped?, reason? }` |
| `POST` | `/api/delete-account` | `delete-account.ts` | `{ ok: true }` |
| `POST` | `/api/plant-generate` | `plant-generate.ts` | `{ success, status, plant, diaryStatus?, message? }` |
| `GET` | `/api/plant-history` | `plant-history.ts` | `{ success, records }` |
| `POST` | `/api/plant-asset-telemetry` | `plant-asset-telemetry.ts` | `{ success, id }` (`{ success: false, skipped: true }` when table not provisioned) |
| `POST` | `/api/live-input-telemetry` | `live-input-telemetry.ts` | `{ success, id }` |
| `GET` | `/api/live-input-telemetry` | `live-input-telemetry.ts` | default: `{ success, summary, byInternalKind, correctionPaths, topReasons, byLang, plantFallbackLevels, diaryStickerActions, series, recentEvents }`; when `module=user_analytics`: `{ overview, dailySeries, retention, generatedAt }` or `{ found, user }` (`type=user_lookup`); when `module=holiday_check`: `{ isFreeDay, reason, name? }` |
| `POST` | `/api/subscription` | `subscription.ts` | iap: `{ success, plan, isPlus, expiresAt, verificationEnvironment }`; stripe checkout: `{ success, checkoutUrl }`; stripe finalize: `{ success, plan, isPlus, expiresAt, verificationEnvironment }` |

`/api/classify` requires `Authorization: Bearer <supabase access token>` and enforces Plus membership; non-Plus requests return `403 { error: 'membership_required' }`.
`/api/annotation`、AI 模式 `/api/diary`、`/api/classify`/`todo-decompose`、`/api/magic-pen-parse`、`/api/extract-profile` 都要求 Supabase bearer token 与当前 AI consent 版本。`/api/diary` teaser 不调用 AI，保持无 consent 的确定性模板路径。
`/api/classify` unified response contract: `{ success: true, data: { kind: 'activity' | 'mood', activity_type: 'study' | 'work' | 'social' | 'life' | 'entertainment' | 'health', mood_type: 'happy' | 'calm' | 'focused' | 'satisfied' | 'tired' | 'anxious' | 'bored' | 'down' | null, matched_bottle: { type, id, stars } | null, confidence }, raw }`; `kind` is hard-constrained to binary `activity|mood` (no null/unknown).
`/api/todo-decompose` is rewritten to the `/api/classify` `todo_decompose` branch, so it follows the same auth + Plus guard and membership error contract.
`/api/magic-pen-parse` request body includes: `rawText`, `todayDateStr`, `currentHour`, optional `lang` (`zh`/`en`/`it`), and optional local-time context (`currentLocalDateTime`, `timezoneOffsetMinutes`) for finer future/past disambiguation.
`segments[*]` may include `timeRelation` (`realtime`/`future`/`past`/`unknown`) for parser-first runtime gating.
`/api/magic-pen-parse` 对可解析 JSON 仍执行语义质量门槛：空提取、低原文覆盖、漏掉明确时间锚点或复杂句拆分严重不足均视为 `low_quality`。远端失败时，响应会把完整 `rawText` 保留在 `unparsed`，供前端运行既有本地兜底。服务商与模型配置统一见 `docs/AI_USAGE_INVENTORY.md`。
Plant endpoints require `Authorization: Bearer <supabase access token>` and validate current user before DB read/write.
`/api/plant-generate` 是混合端点：未同意或 consent 状态不可读时仍可完成确定性植物计算，但必须使用本地静态文案，不得调用任何 AI 服务商。
`/api/extract-profile` requires `Authorization: Bearer <supabase access token>` and accepts `recentMessages[] + lang` (`zh`/`en`/`it`) from frontend weekly-report flow.
`/api/delete-account` requires `Authorization: Bearer <supabase access token>` plus `SUPABASE_SERVICE_ROLE_KEY`. It fails closed: for Apple-linked accounts the iOS client reauthorizes through the native Apple sheet and sends a fresh authorization code; the server exchanges it for an Apple token, verifies the returned Apple subject/audience against the linked Supabase identity, revokes the token, then deletes known user-scoped tables, all `seeday-images/<userId>/**` objects, and finally the Supabase Auth user. Any exchange/identity/revoke/storage/table/auth failure aborts the remaining flow.
`/api/plant-generate` `status` supports: `too_early` / `empty_day` / `generated` / `already_generated` / `monthly_exhausted`.
`/api/plant-generate` accepts optional `action: 'snapshot_existing'`. This action is allowed before 20:00 only for an already-existing user/date record and stores its current cloud-derived root/activity/direction snapshot inside `root_metrics`; it never creates a new plant.
Newly generated records include the same root snapshot, and Plus observation text is rejected/retried when it exceeds the card budget before falling back to the existing localized static line.
Frontend annotation and report-diary requests now include the current `aiMode`, and plant diary generation reads `user_metadata.ai_mode` server-side so all diary/comment surfaces can follow the same four companion personas.
`/api/diary` now supports `mode: 'full' | 'teaser'`; teaser mode uses deterministic template selection (no LLM call) for Free diary teaser rendering.
`/api/diary` full mode uses a soft 2-4 paragraph length target and never post-slices the generated body by character or word count. Provider truncation or a missing terminal sentence triggers one concise retry; a second incomplete result returns an error so it cannot be persisted as a generated diary.
`/api/diary` `action='insight'` returns one complete card-sized phrase: Chinese uses a 20-character safety budget, while English and Italian use at most eight whole words and are never sliced mid-word.
`/api/subscription` requires `Authorization: Bearer <supabase access token>` and `SUPABASE_SERVICE_ROLE_KEY`; iOS flow supports `source='iap'` (`activate`/`restore`/`cancel`) and web stripe flow supports `source='stripe'` with `action='stripe_checkout'` (create checkout session URL) + `action='stripe_finalize'` (verify returned `stripe_session_id` then persist membership metadata). The handler now also mirrors the normalized plan/trial snapshot into `public.user_account_state` so frontend onboarding/account-state reads do not depend on ad-hoc metadata aliases alone.
Apple App Store Server API authorization JWTs are signed with ES256 using the JWS-required IEEE-P1363 signature encoding. Transaction lookup uses Apple's current `api.storekit.apple.com` hosts and retries against Sandbox when Production returns `401` or `404`, covering TestFlight/Sandbox transactions without changing the client request contract; `api/subscription.test.ts` guards both behaviors.
Annotation request `userContext` now supports `statusSummary`, `contextHints`, `frequentActivities`, `todayContext`, `characterStateText`, `characterStateMeta`, `currentDate`, `countryCode`, `holiday`, optional `latitude`/`longitude`, optional env context (`weatherContext`/`seasonContext`/`weatherAlerts`), `allowSuggestion`, `consecutiveTextCount`, and `recoveryNudge` for suggestion-mode gating and interruption-recovery reminders. `pendingTodos[*]` also supports `createdAt/ageDays` so suggestion mode can detect stale todos.
Annotation request `userContext` now also supports optional `userProfileSnapshot` (long-term profile snapshot text + meal-time hints), which is injected into prompt when `long_term_profile_enabled=true`.
Annotation request `userContext` additionally supports optional `userId` for lateral-association state partitioning (`userId + aiMode`); server samples one association focus per call and injects it into prompt U4. State is persisted in `auth.users.user_metadata.lateral_association_state_v1` when `SUPABASE_SERVICE_ROLE_KEY` is available, otherwise it falls back to in-memory cache.
Annotation server now includes low-narrative-density detection (`today_narrative_cache_v1`) in the same `/api/annotation` flow: score is rule-based (freshness/density/emotion/vocab), trigger decision is server-side only and score-driven (continuous probability based on `currentScore` + `todayRichness`), and at most one narrative instruction is injected per request.
`/api/annotation` response may include `narrativeEvent` (`eventType`, `eventId`, `instruction`, `isTriggeredReply`) for frontend condensation telemetry (`event_condensed`).
When `ANNOTATION_VERBOSE_LOGS=true`, `/api/annotation` writes full debug logs to Vercel Logs, including request payload (`eventData` + `userContext`), built prompts (system/user), raw LLM output, final response payload, and special-mode resolution details (suggestion gate, narrative trigger, lateral-association trigger/type/instruction).
Character-state prompt injection can be soft-disabled server-side via `ANNOTATION_CHARACTER_STATE_ENABLED=false` (fallbacks to `none/无/nessuno` in prompt U3 block).
Annotation prompt assembly is unified by `src/server/annotation-prompt-builder.ts`, which packages `model + instructions + input` for both annotation and suggestion branches before calling the model.
Annotation event payload now supports todo-completion context fields in `eventData` (`todoCompletionContext` + optional compact `summary`) so `/api/annotation` can distinguish normal activity records from completed todos without prompt changes.
Annotation suggestion payload may include reward metadata (`rewardStars`, `rewardBottleId`, `recoveryKey`) so frontend can grant one-time bonus stars after completion. For stale todo suggestions, payload may also include pre-decompose metadata (`decomposeReady`, `decomposeSourceTodoId`, `decomposeSteps[]`) generated before suggestion is shown.
Live input telemetry ingest/dashboard currently share one endpoint (`/api/live-input-telemetry`) and use `Authorization: Bearer <supabase access token>`; dashboard additionally requires `SUPABASE_SERVICE_ROLE_KEY` plus admin allowlist/metadata. The dashboard now aggregates `live_input_events`, `plant_asset_events`, and `telemetry_events` (`diary_sticker_*` + annotation telemetry events such as `density_scored/event_triggered/lateral_sampled`) as a unified telemetry view.
`/api/live-input-telemetry` `GET` now also supports `module=user_analytics` to return growth/premium/retention metrics and `type=user_lookup` user diagnostics without a separate `/api/user-analytics` function.
`/api/live-input-telemetry` `GET` also supports `module=holiday_check&date=YYYY-MM-DD&country=XX` for reminder scheduling (weekend/legal holiday check), replacing standalone `/api/check-holiday` to keep Hobby deployment within the function limit.
Membership AI classification path observability is recorded through `/api/live-input-telemetry` `eventType='classification'` by attaching tags in `reasons[]` (`membership_classification`, `user_plan:*`, `classification_path:*`, `ai_called:*`, `ai_result_kind:*`, `bottle_match_source:*`).

## 外部服务配置

- 2026-10-28：按用途调整 DeepSeek 的 temperature/max_tokens（含日记重试、批注重写和待办预拆解），详见 AI 清单的请求预算表；提示词、超时、前端契约与旧 OpenAI/Gemini 参数保持原值。
- 模型迁移不改变前端端点、请求字段或响应结构。默认模式所有语言走 DeepSeek Chat Completions，完整日记用 Pro，其余能力用 Flash，均发送 `thinking: { type: 'disabled' }`。保留 OpenAI Responses/Chat Completions 和 Gemini generateContent 适配器；切换环境变量并重新部署即可恢复，不新增 Serverless Function。
- AI 服务商、模型、发送数据范围和 AI 日志边界只在 `docs/AI_USAGE_INVENTORY.md` 维护；本文件不再复制 provider 映射。
- 所有 OpenAI Chat Completions / Responses 请求均显式发送 `store: false`，避免在当前组织的 per-call logging 策略下创建应用状态；供应商 abuse-monitoring 留存仍以 `docs/AI_USAGE_INVENTORY.md` 的控制台证据和官方边界为准。
- `/api/subscription` 使用 Apple App Store Server API（`APPLE_IAP_ISSUER_ID`、`APPLE_IAP_KEY_ID`、`APPLE_IAP_PRIVATE_KEY`、`APPLE_IAP_BUNDLE_ID`）和 Stripe API（`STRIPE_SECRET_KEY`、`STRIPE_PRICE_MONTHLY`、`STRIPE_PRICE_ANNUAL`）。
- `/api/delete-account` 使用独立的 Sign in with Apple 凭据：`APPLE_SIGN_IN_TEAM_ID`、`APPLE_SIGN_IN_KEY_ID`、`APPLE_SIGN_IN_PRIVATE_KEY`、`APPLE_SIGN_IN_CLIENT_ID`。它们不能用 App Store Connect IAP issuer/key 替代；iOS App 的 client ID 应与 bundle ID 一致。

## 本地调试（Windows）

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

说明：当前仓库的 `npm run dev` / `npm run dev:vite` 都只启动 Vite 前端，未内置本地 serverless runtime。

## 新增/修改函数 checklist

1. 校验 `req.method`，拒绝非预期方法。
2. 参数校验失败返回 `4xx`，并提供可读 `error` 信息。
3. 下游 AI 请求失败时返回结构化 JSON，不透出敏感信息。
4. 同步 `src/api/client.ts` 的请求/响应类型。
5. 修改后至少执行 `npx tsc --noEmit` 与 `npm run build`。

## Endpoint test anchor

- `src/server/magic-pen-parse.test.ts` + `src/server/magic-pen-quality.test.ts`: 覆盖入参校验、包裹 JSON 解析、低质量输出、本地安全兜底和中英文覆盖率/时间锚点判断。
