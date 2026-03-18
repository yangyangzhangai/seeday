# Tshine 全局地图（唯一版本）

- 版本: v2.0
- 更新: 2026-03-05
- 说明: 本文件是当前仓库目录与边界的唯一地图来源（as-is），不描述愿景结构。

## 1) 仓库顶层

```text
/
├── api/                # Vercel Serverless Functions
├── docs/               # 交接、架构、变更记录
├── public/             # 静态资源
├── scripts/            # 工程脚本（当前: max-lines 检查）
├── src/                # 前端 React 代码
├── README.md
├── PROJECT_CONTEXT.md
├── FEATURE_STATUS.md
├── DEPLOY.md
└── CONTRIBUTING.md
```

## 2) 前端 `src/` 实际分工

```text
src/
├── api/
│   ├── client.ts       # 前端到 /api/* 的统一调用封装
│   └── supabase.ts     # Supabase 客户端
├── components/
│   ├── layout/         # Header/BottomNav/LanguageSwitcher
│   └── feedback/       # Annotation/Stardust/ErrorBoundary
├── features/
│   ├── auth/
│   ├── chat/
│   ├── todo/
│   └── report/
├── i18n/               # 国际化初始化与词条
├── lib/                # 纯函数与映射工具
├── store/              # Zustand stores + actions/helpers
├── constants/
├── types/
├── App.tsx
└── main.tsx
```

## 3) 服务端 `api/` 实际端点

- `chat.ts` -> `POST /api/chat`
- `report.ts` -> `POST /api/report`
- `annotation.ts` -> `POST /api/annotation`
- `classify.ts` -> `POST /api/classify`
- `diary.ts` -> `POST /api/diary`
- `stardust.ts` -> `POST /api/stardust`
- `src/server/http.ts` -> 通用 CORS/method/error 包装

## 3.1) 服务端共享模块 `src/server/`

- `src/server/annotation-handler.ts` -> `/api/annotation` 共享处理逻辑
- `src/server/annotation-prompts.ts` -> annotation prompt 模板
- `src/server/magic-pen-prompts.ts` -> magic-pen prompt 模板
- `src/server/plant-shared.ts` -> 植物接口鉴权/序列化/日期窗口工具
- `src/server/plant-diary-service.ts` -> 植物日记生成服务

## 4) 关键边界（必须遵守）

1. 前端 `src/**` 不直连第三方 AI 密钥或 SDK。
2. AI 请求统一走 `src/api/client.ts -> /api/*`。
3. 服务端密钥只从 `process.env` 读取（如 `CHUTES_API_KEY`、`ZHIPU_API_KEY`）。
4. 页面入口统一放在 `src/features/*`。

## 5) 与当前治理状态对齐

- 当前主线状态与任务进度以 `docs/CURRENT_TASK.md` 为准。
- C12/C13 在本轮为停止执行项（由用户后续自行推进）。

## 6) Core Path Index (for doc-sync)

- `src/features/auth`
- `src/features/chat`
- `src/features/growth`
- `src/features/report`
- `src/store/`
- `src/i18n/`
- `src/api/`
- `api/`
