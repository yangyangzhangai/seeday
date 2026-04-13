# 部署指南（Vercel Serverless）

## 架构

```text
Browser (Vite/React)
  -> /api/* (Vercel Serverless)
  -> External AI Providers
     - DeepSeek + OpenAI: annotation（按语言路由）
     - Chutes: report/diary/stardust/plant-diary
     - DashScope/Qwen: classify
     - Zhipu + Qwen fallback: magic-pen-parse
```

## 必要环境变量

```bash
OPENAI_API_KEY=...
OPENAI_BASE_URL=https://api.openai.com/v1
CHUTES_API_KEY=...
QWEN_API_KEY=...
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
GEMINI_API_KEY=...
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
DEEPSEEK_API_KEY=...
ZHIPU_API_KEY=...
ANNOTATION_DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

说明：
- `DEEPSEEK_API_KEY` + `OPENAI_API_KEY` 用于 `annotation`（`zh -> deepseek-chat`，`en/it -> gpt-4.1-mini`）
- `CHUTES_API_KEY` 用于 `report`
- `QWEN_API_KEY` 用于 `classify`、`todo-decompose(zh)`，也可作为 `magic-pen-parse` 的 fallback provider
- `GEMINI_API_KEY` 用于 `todo-decompose(en/it)`（Gemini 原生接口）
- `ZHIPU_API_KEY` 用于 `magic-pen-parse` 主路
- 可选：`ANNOTATION_DEEPSEEK_BASE_URL`、`OPENAI_BASE_URL`、`CLASSIFY_MODEL`、`DASHSCOPE_BASE_URL`、`MAGIC_PEN_FALLBACK_MODEL`、`TODO_DECOMPOSE_MODEL`、`TODO_DECOMPOSE_MODEL_ZH`、`TODO_DECOMPOSE_GEMINI_BASE_URL`、`TODO_DECOMPOSE_GEMINI_FALLBACK_MODEL`、`TODO_DECOMPOSE_VERBOSE_LOGS`

## 本地开发

```bash
npm install
cp .env.example .env
npm run dev
```

Windows PowerShell:

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

说明：当前 `npm run dev` / `npm run dev:vite` 都只启动 Vite 前端；本仓库没有额外封装本地 serverless 调试脚本。

## 部署到 Vercel

### 方式 A：Vercel CLI

```bash
npx vercel login
npx vercel --prod
```

### 方式 B：Git 集成

1. 推送到 GitHub/GitLab/Bitbucket
2. 在 Vercel 导入仓库
3. 配置环境变量
4. 自动部署

## API 端点（当前实现）

- `POST /api/report`
- `POST /api/annotation`
- `POST /api/classify`
- `POST /api/diary`
- `POST /api/magic-pen-parse`
- `POST /api/plant-generate`
- `GET /api/plant-history`
- `POST /api/live-input-telemetry`
- `GET /api/live-input-dashboard`

## Live Input Telemetry

To enable the new live input telemetry dashboard in production:

- Run `scripts/live_input_telemetry_schema.sql` in Supabase SQL Editor.
- Set `SUPABASE_SERVICE_ROLE_KEY` in Vercel.
- Set `LIVE_INPUT_ADMIN_EMAILS` to the comma-separated admin email list that can open `/telemetry/live-input`.
- Optionally set `LIVE_INPUT_TELEMETRY_STORE_RAW_TEXT=true` if you explicitly want to store raw user input for debugging.

## 运行时模型（当前实现）

- `/api/report`: `NousResearch/Hermes-4-405B-FP8-TEE`
- `/api/diary`: `action=insight -> gpt-4o-mini`；默认日记正文 `gpt-4o`
- `/api/annotation`: `zh=deepseek-chat`，`en/it=gpt-4.1-mini`
- `/api/todo-decompose`: `zh=qwen-plus`（可由 `TODO_DECOMPOSE_MODEL_ZH` 覆盖），`en/it=gemini-2.5-flash`（可由 `TODO_DECOMPOSE_MODEL` 覆盖；404 模型下线时自动降级到 `TODO_DECOMPOSE_GEMINI_FALLBACK_MODEL`）
- `/api/classify`: `qwen-plus`（可由 `CLASSIFY_MODEL` 覆盖）
- `/api/magic-pen-parse`: `glm-4.7-flash`（失败时可回退 `qwen-flash`）
- `/api/plant-generate`（内部 `src/server/plant-diary-service.ts`）: `gpt-4.1-mini`

## 安全注意事项

- 永远不要提交 `.env`
- 密钥只放在 Vercel 环境变量
- 前端只保留公开配置（`VITE_*`）
