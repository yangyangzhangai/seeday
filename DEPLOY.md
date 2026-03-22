# 部署指南（Vercel Serverless）

## 架构

```text
Browser (Vite/React)
  -> /api/* (Vercel Serverless)
  -> External AI Providers
     - OpenAI: annotation
     - Chutes: report/diary/stardust/plant-diary
     - DashScope/Qwen: classify
     - Zhipu + Qwen fallback: magic-pen-parse
```

## 必要环境变量

```bash
OPENAI_API_KEY=...
CHUTES_API_KEY=...
QWEN_API_KEY=...
ZHIPU_API_KEY=...
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

说明：
- `OPENAI_API_KEY` 用于 `annotation`
- `CHUTES_API_KEY` 用于 `report/diary/stardust/plant-diary`
- `QWEN_API_KEY` 用于 `classify`，也可作为 `magic-pen-parse` 的 fallback provider
- `ZHIPU_API_KEY` 用于 `magic-pen-parse` 主路
- 可选：`CLASSIFY_MODEL`、`DASHSCOPE_BASE_URL`、`MAGIC_PEN_FALLBACK_MODEL`

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
- `POST /api/stardust`
- `POST /api/magic-pen-parse`
- `POST /api/plant-generate`
- `POST /api/plant-diary`
- `GET /api/plant-history`

## 运行时模型（当前实现）

- `/api/report`: `NousResearch/Hermes-4-405B-FP8-TEE`
- `/api/diary`: `Qwen/Qwen3-235B-A22B-Instruct-2507-TEE`
- `/api/annotation`: `gpt-4.1-mini`
- `/api/classify`: `qwen-plus`（可由 `CLASSIFY_MODEL` 覆盖）
- `/api/stardust`: `NousResearch/Hermes-4-405B-FP8-TEE`
- `/api/magic-pen-parse`: `glm-4.7-flash`（失败时可回退 `qwen-flash`）
- `/api/plant-diary`: `Qwen/Qwen3-235B-A22B-Instruct-2507-TEE`

## 安全注意事项

- 永远不要提交 `.env`
- 密钥只放在 Vercel 环境变量
- 前端只保留公开配置（`VITE_*`）
