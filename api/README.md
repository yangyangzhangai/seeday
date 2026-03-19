# API Serverless Guide

`api/*` 是 Vercel Serverless Functions，负责在服务端持有密钥并调用第三方模型。

## 边界约束

1. 仅处理服务端逻辑，不依赖 `window`、`localStorage` 等浏览器对象。
2. 前端统一通过 `src/api/client.ts` 调用，不在 `src/**` 直连第三方 AI。
3. 所有函数统一设置 CORS，并只接受 `POST`（含 `OPTIONS` 预检）。
4. 密钥统一从 `process.env` 读取（如 `CHUTES_API_KEY`、`ZHIPU_API_KEY`）。

## 端点清单（与当前实现一致）

| Route | File | Success shape |
| --- | --- | --- |
| `/api/chat` | `chat.ts` | `{ content, model, usage? }` |
| `/api/report` | `report.ts` | `{ content }` |
| `/api/annotation` | `annotation.ts` (entry) + `src/server/annotation-handler.ts` + `src/server/annotation-prompts.ts` | `{ content, tone, displayDuration, source, reason? }` |
| `/api/classify` | `classify.ts` | `{ success: true, data, raw }` |
| `/api/diary` | `diary.ts` | `{ success: true, content }` |
| `/api/stardust` | `stardust.ts` | `{ emojiChar }` |
| `/api/magic-pen-parse` | `magic-pen-parse.ts` | `{ success: true, data: { segments, unparsed }, raw, traceId, parseStrategy, providerUsed }` |
| `/api/plant-generate` | `plant-generate.ts` | `{ success, status, plant, diaryStatus? }` |
| `/api/plant-diary` | `plant-diary.ts` | `{ success, diaryText, diaryStatus }` |
| `/api/plant-history` | `plant-history.ts` | `{ success, records }` |

`/api/magic-pen-parse` request body includes: `rawText`, `todayDateStr`, `currentHour`, optional `lang` (`zh`/`en`/`it`), and optional local-time context (`currentLocalDateTime`, `timezoneOffsetMinutes`) for finer future/past disambiguation.
`segments[*]` may include `timeRelation` (`realtime`/`future`/`past`/`unknown`) for parser-first runtime gating.
If `QWEN_API_KEY` is configured, `/api/magic-pen-parse` will fallback to DashScope OpenAI-compatible endpoint when Zhipu call fails by timeout/http/empty content/parse failure.
Plant endpoints require `Authorization: Bearer <supabase access token>` and validate current user before DB read/write.

## 本地调试（Windows）

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

## 新增/修改函数 checklist

1. 校验 `req.method`，拒绝非预期方法。
2. 参数校验失败返回 `4xx`，并提供可读 `error` 信息。
3. 下游 AI 请求失败时返回结构化 JSON，不透出敏感信息。
4. 同步 `src/api/client.ts` 的请求/响应类型。
5. 修改后至少执行 `npx tsc --noEmit` 与 `npm run build`。

## Endpoint test anchor

- `src/server/magic-pen-parse.test.ts`: 覆盖 `rawText` 入参校验、模型输出包裹 JSON 解析、非法输出安全兜底。
