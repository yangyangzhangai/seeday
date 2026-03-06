# 部署指南（Vercel Serverless）

## 架构

```text
Browser (Vite/React)
  -> /api/* (Vercel Serverless)
  -> External AI Providers
     - Chutes: chat/report/diary/annotation/stardust
     - Zhipu : classify
```

## 必要环境变量

```bash
CHUTES_API_KEY=...
ZHIPU_API_KEY=...
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

说明：
- `CHUTES_API_KEY` 用于 `chat/report/diary/annotation/stardust`
- `ZHIPU_API_KEY` 用于 `classify`（`glm-4.7-flash`）

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

- `POST /api/chat`
- `POST /api/report`
- `POST /api/annotation`
- `POST /api/classify`
- `POST /api/diary`
- `POST /api/stardust`

## 运行时模型（当前实现）

- `/api/chat`: `NousResearch/Hermes-4-405B-FP8-TEE`
- `/api/report`: `NousResearch/Hermes-4-405B-FP8-TEE`
- `/api/diary`: `Qwen/Qwen3-235B-A22B-Instruct-2507-TEE`
- `/api/classify`: `glm-4.7-flash`

## 安全注意事项

- 永远不要提交 `.env`
- 密钥只放在 Vercel 环境变量
- 前端只保留公开配置（`VITE_*`）
