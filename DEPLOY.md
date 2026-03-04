# 部署指南 - Vercel Serverless 架构

## 架构说明

```
用户浏览器 (前端 Vite)
       ↓
/api/* (Vercel Serverless Functions)
       ↓
AI 服务 (Chutes)
```

所有 API Keys 都存储在服务端环境变量中，前端代码无法直接访问，保证安全性。

**Timeshine 三步走架构**:
```
用户原始输入
    ↓
/api/classify (Qwen2.5-7B)    ← 轻量分类器
    ↓
计算层 (纯代码)               ← 本地计算光谱/进度条/异常
    ↓
/api/diary (Hermes-4-405B)    ← 顶配日记生成
    ↓
诗意观察手记
```

## 快速部署

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`:

```bash
cp .env.example .env
```

填写必要的环境变量:

```bash
# Chutes AI API Key (必需)
CHUTES_API_KEY=your_chutes_api_key_here

# Supabase 配置
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. 本地测试

```bash
# 使用 Vercel CLI 本地开发 (推荐)
npx vercel dev

# 或直接启动 Vite 开发服务器
npm run dev
```

本地开发时，API 请求会通过 Vite proxy 自动转发到本地 Serverless Functions。

### 4. 部署到 Vercel

#### 方式 A: 使用 Vercel CLI

```bash
# 登录 Vercel
npx vercel login

# 部署
npx vercel --prod
```

#### 方式 B: Git 集成 (推荐)

1. 将代码推送到 GitHub/GitLab/Bitbucket
2. 在 Vercel Dashboard 导入项目
3. 配置环境变量
4. 自动部署

### 5. 配置 Vercel 环境变量

在 Vercel Dashboard → Project Settings → Environment Variables 中添加:

| 变量名 | 说明 | 必需 |
|--------|------|------|
| `CHUTES_API_KEY` | Chutes AI API Key | 是 |
| `VITE_SUPABASE_URL` | Supabase 项目 URL | 是 |
| `VITE_SUPABASE_ANON_KEY` | Supabase Anon Key | 是 |

## API 端点

部署后可以通过以下端点访问:

- `POST /api/chat` - AI 聊天
- `POST /api/classify` - **步骤1: 活动分类** (Qwen2.5-7B)
- `POST /api/diary` - **步骤3: 生成观察手记** (Hermes-4-405B)
- `POST /api/annotation` - AI 智能批注

## 获取 API Keys

### Chutes API Key
1. 访问 https://chutes.ai/
2. 注册并登录
3. 在 Dashboard 获取 API Key
4. 使用的模型:
   - 分类: `Qwen/Qwen2.5-7B-Instruct` (轻量、快速)
   - 日记: `NousResearch/Hermes-4-405B-FP8-TEE` (顶配、创意)

### Supabase 配置
1. 访问 https://supabase.com/
2. 创建项目
3. 在 Project Settings → API 中获取 URL 和 Anon Key

## 验证部署

部署完成后，访问以下 URL 测试:

```bash
# 测试 Chat API
curl -X POST https://your-project.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'

# 测试分类器 API
curl -X POST https://your-project.vercel.app/api/classify \
  -H "Content-Type: application/json" \
  -d '{"rawInput":"早上写代码2小时，下午开会1小时"}'

# 测试日记 API
curl -X POST https://your-project.vercel.app/api/diary \
  -H "Content-Type: application/json" \
  -d '{"structuredData":"【今日结构化数据】\\n▸ 今日光谱分布\\n  🔵 深度专注  2h  [████░░░░░░]","date":"2024-01-01"}'
```

## 常见问题

### Q: 本地开发时 API 返回 404?
A: 确保使用 `npx vercel dev` 而不是 `npm run dev`，或者配置 Vite proxy。

### Q: 部署后 API 返回 500?
A: 检查 Vercel Dashboard 的 Function Logs，确认环境变量是否正确配置。

### Q: 如何更新 API Key?
A: 在 Vercel Dashboard → Environment Variables 中更新，然后重新部署。

### Q: 观察手记生成失败?
A: 检查 Chutes API Key 是否有足够配额，以及模型 `NousResearch/Hermes-4-405B-FP8-TEE` 是否可用。

## 安全注意事项

✅ **已保护**: API Keys 存储在服务端环境变量
✅ **已保护**: 前端无法直接访问 AI 服务
✅ **已保护**: 所有 API 调用都经过服务端验证

⚠️ **重要**: 永远不要将 `.env` 文件提交到 Git!
⚠️ **重要**: 定期轮换 API Keys

## 项目结构

```
.
├── api/                    # Vercel Serverless Functions
│   ├── chat.ts            # 聊天 API
│   ├── report.ts          # 报告 API
│   └── annotation.ts      # AI 批注 API
├── src/
│   ├── api/
│   │   ├── client.ts      # 前端 API Client (调用 /api/*)
│   │   ├── qwen.ts        # (废弃，保留参考)
│   │   └── gemini.ts      # (废弃，保留参考)
│   └── store/
│       ├── useChatStore.ts       # 已更新为使用 client.ts
│       ├── useReportStore.ts     # 已更新为使用 client.ts
│       └── useAnnotationStore.ts # 已更新为使用 client.ts
├── .env.example           # 环境变量模板
└── DEPLOY.md             # 本文件
```
