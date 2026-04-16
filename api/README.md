# API Serverless Guide

`api/*` 是 Vercel Serverless Functions，负责在服务端持有密钥并调用第三方模型。

## 边界约束

1. 仅处理服务端逻辑，不依赖 `window`、`localStorage` 等浏览器对象。
2. 前端统一通过 `src/api/client.ts` 调用，不在 `src/**` 直连第三方 AI。
3. 所有函数统一设置 CORS，并只接受各自的预期方法（含 `OPTIONS` 预检）；当前绝大多数为 `POST`，`/api/plant-history` 为 `GET`。
4. 密钥统一从 `process.env` 读取（如 `OPENAI_API_KEY`、`CHUTES_API_KEY`、`QWEN_API_KEY`、`GEMINI_API_KEY`、`ZHIPU_API_KEY`）。

## 端点清单（与当前实现一致）

| Method | Route | File | Success shape |
| --- | --- | --- | --- |
| `POST` | `/api/report` | `report.ts` | `{ content }` |
| `POST` | `/api/annotation` | `annotation.ts` (entry) + `src/server/annotation-handler.ts` + `src/server/annotation-prompts.ts` + `src/server/annotation-prompt-builder.ts` | `{ content, tone, displayDuration, source, reason?, suggestion? }` |
| `POST` | `/api/classify` | `classify.ts` | `{ success: true, data, raw }` |
| `POST` | `/api/diary` | `diary.ts` | `{ success: true, content }` |
| `POST` | `/api/magic-pen-parse` | `magic-pen-parse.ts` | `{ success: true, data: { segments, unparsed }, raw, traceId, parseStrategy, providerUsed }` |
| `POST` | `/api/todo-decompose` | `todo-decompose.ts` | `{ success: true, steps, parseStatus, model, provider }` |
| `POST` | `/api/extract-profile` | `extract-profile.ts` | `{ success: true, profile, skipped?, reason? }` |
| `POST` | `/api/plant-generate` | `plant-generate.ts` | `{ success, status, plant, diaryStatus?, message? }` |
| `POST` | `/api/plant-diary` | `plant-diary.ts` | `{ success, diaryText, diaryStatus }` |
| `GET` | `/api/plant-history` | `plant-history.ts` | `{ success, records }` |
| `POST` | `/api/plant-asset-telemetry` | `plant-asset-telemetry.ts` | `{ success, id }` (`{ success: false, skipped: true }` when table not provisioned) |
| `POST` | `/api/live-input-telemetry` | `live-input-telemetry.ts` | `{ success, id }` |
| `GET` | `/api/live-input-telemetry` | `live-input-telemetry.ts` | `{ success, summary, byInternalKind, correctionPaths, topReasons, byLang, plantFallbackLevels, diaryStickerActions, series, recentEvents }` |
| `POST` | `/api/subscription` | `subscription.ts` | `{ success, plan, isPlus, expiresAt, verificationEnvironment }` |

`/api/magic-pen-parse` request body includes: `rawText`, `todayDateStr`, `currentHour`, optional `lang` (`zh`/`en`/`it`), and optional local-time context (`currentLocalDateTime`, `timezoneOffsetMinutes`) for finer future/past disambiguation.
`segments[*]` may include `timeRelation` (`realtime`/`future`/`past`/`unknown`) for parser-first runtime gating.
`/api/magic-pen-parse` currently tries DashScope OpenAI-compatible Qwen first (`qwen-flash`, overridable by `MAGIC_PEN_FALLBACK_MODEL`), then falls back to Zhipu (`glm-4.7-flash`) when needed.
Plant endpoints require `Authorization: Bearer <supabase access token>` and validate current user before DB read/write.
`/api/extract-profile` requires `Authorization: Bearer <supabase access token>` and accepts `recentMessages[] + lang` (`zh`/`en`/`it`) from frontend weekly-report flow.
`/api/plant-generate` `status` supports: `too_early` / `empty_day` / `generated` / `already_generated` / `monthly_exhausted`.
Frontend annotation and report-diary requests now include the current `aiMode`, and plant diary generation reads `user_metadata.ai_mode` server-side so all diary/comment surfaces can follow the same four companion personas.
`/api/diary` now supports `mode: 'full' | 'teaser'`; teaser mode uses deterministic template selection (no LLM call) for Free diary teaser rendering.
`/api/subscription` requires `Authorization: Bearer <supabase access token>` and `SUPABASE_SERVICE_ROLE_KEY`; iOS flow currently supports `source='iap'` (`activate`/`restore`/`cancel`) and writes membership fields into `auth.users.user_metadata`.
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

当前 provider 映射：

- `/api/annotation` -> `DEEPSEEK_API_KEY`（zh, model `deepseek-chat`）+ `OPENAI_API_KEY`（en/it, model `gpt-4.1-mini`）；可选 `ANNOTATION_DEEPSEEK_BASE_URL`、`OPENAI_BASE_URL`
- `/api/extract-profile` -> `OPENAI_API_KEY`（可选 `PROFILE_EXTRACT_MODEL`，默认 `gpt-4o-mini`；按 `lang` 路由中/英/意 prompt）
- `/api/todo-decompose` -> 中文默认走 DashScope `QWEN_API_KEY`（`TODO_DECOMPOSE_MODEL_ZH`，默认 `qwen-plus`），其余语言走 Gemini 原生 `GEMINI_API_KEY`（`TODO_DECOMPOSE_MODEL`，默认 `gemini-2.5-flash`）；可选 `TODO_DECOMPOSE_GEMINI_BASE_URL`、`TODO_DECOMPOSE_GEMINI_FALLBACK_MODEL` 与 `TODO_DECOMPOSE_VERBOSE_LOGS=true`
- `/api/report` -> `CHUTES_API_KEY`
- `/api/diary` -> `OPENAI_API_KEY`（`gpt-4o`）
- `/api/classify` -> `QWEN_API_KEY`（可选 `CLASSIFY_MODEL`、`DASHSCOPE_BASE_URL`）
- `/api/magic-pen-parse` -> `ZHIPU_API_KEY` 主路，`QWEN_API_KEY` 兜底
- `/api/subscription` -> Apple App Store Server API（`APPLE_IAP_ISSUER_ID`、`APPLE_IAP_KEY_ID`、`APPLE_IAP_PRIVATE_KEY`、`APPLE_IAP_BUNDLE_ID`）

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

- `src/server/magic-pen-parse.test.ts`: 覆盖 `rawText` 入参校验、模型输出包裹 JSON 解析、非法输出安全兜底。
