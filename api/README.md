# API Serverless Guide

`api/*` 是 Vercel Serverless Functions，负责在服务端持有密钥并调用第三方模型。

## 边界约束

1. 仅处理服务端逻辑，不依赖 `window`、`localStorage` 等浏览器对象。
2. 前端统一通过 `src/api/client.ts` 调用，不在 `src/**` 直连第三方 AI。
3. 所有函数统一设置 CORS，并只接受各自的预期方法（含 `OPTIONS` 预检）；当前绝大多数为 `POST`，`/api/plant-history` 为 `GET`。
4. 密钥统一从 `process.env` 读取（如 `OPENAI_API_KEY`、`CHUTES_API_KEY`、`QWEN_API_KEY`、`ZHIPU_API_KEY`）。

## 端点清单（与当前实现一致）

| Method | Route | File | Success shape |
| --- | --- | --- | --- |
| `POST` | `/api/report` | `report.ts` | `{ content }` |
| `POST` | `/api/annotation` | `annotation.ts` (entry) + `src/server/annotation-handler.ts` + `src/server/annotation-prompts.ts` | `{ content, tone, displayDuration, source, reason?, suggestion? }` |
| `POST` | `/api/classify` | `classify.ts` | `{ success: true, data, raw }` |
| `POST` | `/api/diary` | `diary.ts` | `{ success: true, content }` |
| `POST` | `/api/stardust` | `stardust.ts` | `{ emojiChar }` |
| `POST` | `/api/magic-pen-parse` | `magic-pen-parse.ts` | `{ success: true, data: { segments, unparsed }, raw, traceId, parseStrategy, providerUsed }` |
| `POST` | `/api/plant-generate` | `plant-generate.ts` | `{ success, status, plant, diaryStatus?, message? }` |
| `POST` | `/api/plant-diary` | `plant-diary.ts` | `{ success, diaryText, diaryStatus }` |
| `GET` | `/api/plant-history` | `plant-history.ts` | `{ success, records }` |
| `POST` | `/api/plant-asset-telemetry` | `plant-asset-telemetry.ts` | `{ success, id }` (`{ success: false, skipped: true }` when table not provisioned) |
| `POST` | `/api/live-input-telemetry` | `live-input-telemetry.ts` | `{ success, id }` |
| `GET` | `/api/live-input-dashboard` | `live-input-dashboard.ts` | `{ success, summary, byInternalKind, correctionPaths, topReasons, byLang, plantFallbackLevels, diaryStickerActions, series, recentEvents }` |

`/api/magic-pen-parse` request body includes: `rawText`, `todayDateStr`, `currentHour`, optional `lang` (`zh`/`en`/`it`), and optional local-time context (`currentLocalDateTime`, `timezoneOffsetMinutes`) for finer future/past disambiguation.
`segments[*]` may include `timeRelation` (`realtime`/`future`/`past`/`unknown`) for parser-first runtime gating.
If `QWEN_API_KEY` is configured, `/api/magic-pen-parse` will fallback to DashScope OpenAI-compatible endpoint when Zhipu call fails by timeout/http/empty content/parse failure.
Plant endpoints require `Authorization: Bearer <supabase access token>` and validate current user before DB read/write.
`/api/plant-generate` `status` supports: `too_early` / `empty_day` / `generated` / `already_generated` / `monthly_exhausted`.
Frontend annotation and report-diary requests now include the current `aiMode`, and plant diary generation reads `user_metadata.ai_mode` server-side so all diary/comment surfaces can follow the same four companion personas.
Annotation request `userContext` now supports `statusSummary`, `contextHints`, `frequentActivities`, `allowSuggestion`, and `consecutiveTextCount` for suggestion-mode gating and prompt context.
Live input telemetry ingest/dashboard endpoints also use `Authorization: Bearer <supabase access token>`; dashboard additionally requires `SUPABASE_SERVICE_ROLE_KEY` plus admin allowlist/metadata. The dashboard now aggregates `live_input_events`, `plant_asset_events`, and `telemetry_events` (`diary_sticker_*`) as a unified telemetry view.

当前 provider 映射：

- `/api/annotation` -> `OPENAI_API_KEY`
- `/api/report` / `/api/stardust` / `/api/plant-diary` -> `CHUTES_API_KEY`
- `/api/diary` -> `OPENAI_API_KEY`（`gpt-4o`）
- `/api/classify` -> `QWEN_API_KEY`（可选 `CLASSIFY_MODEL`、`DASHSCOPE_BASE_URL`）
- `/api/magic-pen-parse` -> `ZHIPU_API_KEY` 主路，`QWEN_API_KEY` 兜底

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
