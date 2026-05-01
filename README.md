# Seeday

Seeday 是一个以「记录时间线 + Growth 任务 + 周期复盘」为核心的时间记录应用。

## 功能概览

- Chat (`/chat`): 记录活动、心情标签与 Magic Pen 整理流，支持 AI 辅助分类。
- Growth (`/growth`): 承载任务管理主页面，包含 Todo CRUD、优先级/状态、成长瓶（Bottle）与 Focus 模式；`/todo` 当前保留为兼容重定向。
- Report (`/report`): 按日/周/月/自定义区间生成报告，内嵌植物根系互动区，支持观察员分析（Seeday Diary）。
- Profile (`/profile`): 管理 AI 模式、批注掉落率、每日目标开关与植物方向配置等个人偏好。
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

3. 启动前端开发环境

```bash
npm run dev
```

当前 `package.json` 中：

- `npm run dev`
- `npm run dev:vite`

两者都只启动 Vite 前端开发服务器（等价别名）。

```bash
npm run dev:vite
```

说明：仓库当前没有把 `api/*` 本地 serverless 调试绑定到 `npm run dev`；如需联调服务端函数，需要额外接入对应运行时或使用已部署环境。

## 构建与预览

```bash
npm run build
npm run preview
```

## 环境变量

参见 `.env.example`，当前常用变量如下：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`
- `QWEN_API_KEY`
- `ZHIPU_API_KEY`

可选扩展变量：

- `CLASSIFY_MODEL`
- `DASHSCOPE_BASE_URL`
- `MAGIC_PEN_FALLBACK_MODEL`

说明：AI 相关 Key 仅在服务端函数 `api/*` 使用，不应暴露到前端。

## 目录结构（当前）

```text
api/                  # Vercel Serverless Functions
docs/                 # 交接文档与架构文档
scripts/              # 校验、benchmark 与工程脚本
src/
  api/                # 前端 API client 与 Supabase 实例
  components/         # 共享 UI 组件
  features/           # 业务模块（auth/chat/growth/report/profile）
  hooks/              # Realtime/image upload 等 hooks
  i18n/               # 国际化词条与初始化
  lib/                # 纯工具与辅助函数
  server/             # serverless 共用 handler/prompt/http 工具
  services/           # 输入分类、Magic Pen、词库等纯逻辑服务
  store/              # Zustand stores
  types/              # 共享类型
  App.tsx             # 路由与主布局
```

## 开发校验

- 类型检查: `npx tsc --noEmit`
- 生产构建: `npm run build`
- 手测建议: `/chat`、`/growth`、`/report`、`/profile`

## 已知事项

- 当前构建会有 Vite 的大 chunk 警告（不影响构建成功）。
- 项目已锁定使用 `npm`（主锁文件为 `package-lock.json`）。

## 文档入口

- 当前任务锚点: `docs/CURRENT_TASK.md`
- 目录地图: `docs/PROJECT_MAP.md`
- 架构说明: `docs/ARCHITECTURE.md`
- 贡献规范: `CONTRIBUTING.md`
