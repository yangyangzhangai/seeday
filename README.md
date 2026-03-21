# Tshine

Tshine 是一个以「聊天记录 + Todo + 日报观察」为核心的时间记录应用。

## 功能概览

- Chat (`/chat`): 记录活动、心情标签与 Magic Pen 整理流，支持 AI 辅助分类。
- Todo (`/todo`): 任务增删改查、优先级与状态管理，并与记录流程联动。
- Report (`/report`): 按日/周/月/自定义区间生成报告，支持观察员分析（Timeshine Diary）。
- Auth (`/auth`): 基于 Supabase 的登录/注册与会话初始化。
- i18n: 内置 `zh / en / it` 三语切换。

## 技术栈

- 前端: React 18 + TypeScript + Vite + Tailwind CSS
- 状态管理: Zustand（含 persist）
- 数据与鉴权: Supabase
- 服务端接口: Vercel Serverless Functions（`/api/*`）
- 多语言: i18next + react-i18next

## 本地开发

1. 安装依赖

```bash
npm install
```

2. 复制环境变量模板并填写

```bash
cp .env.example .env
```

Windows PowerShell 可用：

```powershell
Copy-Item .env.example .env
```

3. 启动开发环境（含 `api/*` 本地函数）

```bash
npm run dev
```

可选：只启动前端 Vite

```bash
npm run dev:vite
```

## 构建与预览

```bash
npm run build
npm run preview
```

## 环境变量

参见 `.env.example`，核心变量如下：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `CHUTES_API_KEY`
- `ZHIPU_API_KEY`

说明：AI 相关 Key 仅在服务端函数 `api/*` 使用，不应暴露到前端。

## 目录结构（当前）

```text
api/                  # Vercel Serverless Functions
docs/                 # 交接文档与架构文档
src/
  components/         # 共享 UI 组件
  features/           # 业务模块（auth/chat/todo/report）
  api/                # 前端 API client 与 Supabase 实例
  store/              # Zustand stores
  lib/                # 纯工具与辅助函数
  i18n/               # 国际化词条与初始化
  App.tsx             # 路由与主布局
```

## 开发校验

- 类型检查: `npx tsc --noEmit`
- 生产构建: `npm run build`
- 手测建议: `/chat`、`/todo`、`/report`

## 已知事项

- 当前构建会有 Vite 的大 chunk 警告（不影响构建成功）。
- 项目已锁定使用 `npm`（主锁文件为 `package-lock.json`）。

## 文档入口

- 当前任务锚点: `docs/CURRENT_TASK.md`
- 目录地图: `docs/PROJECT_MAP.md`
- 架构说明: `docs/ARCHITECTURE.md`
- 贡献规范: `CONTRIBUTING.md`
