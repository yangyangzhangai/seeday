# Tshine 项目上下文（Project Context）

- 更新时间: 2026-03-04
- 适用范围: `Tshine2-13-mainc` 全仓
- 目标: 让接手人 30 分钟内建立可执行心智模型

## 1. 产品定位

Tshine 是一个围绕时间记录的应用，核心闭环是：

1. 在 `/chat` 记录活动与心情。
2. 在 `/todo` 管理任务并形成完成数据。
3. 在 `/report` 汇总并生成日报/周报/月报与观察手记。

用户价值是将碎片化记录转成可复盘、可调整的行为反馈。

## 2. 技术与运行时

- 前端: React + TypeScript + Vite + Tailwind
- 状态管理: Zustand（含 `persist`）
- 数据: Supabase（`messages` / `todos` / `reports` 等）
- 服务端: Vercel Serverless Functions（`api/*.ts`）
- 多语言: i18next（`zh` / `en` / `it`）

开发命令（现状）:

- `npm run dev`: 用 `vercel dev` 跑前端 + serverless
- `npm run dev:vite`: 只跑前端
- `npm run build`: 生产构建

## 3. 关键入口

- 前端入口: `src/main.tsx`
- 路由与主布局: `src/App.tsx`
- 页面路由:
  - `/chat` -> `src/features/chat/ChatPage.tsx`
  - `/todo` -> `src/features/todo/TodoPage.tsx`
  - `/report` -> `src/features/report/ReportPage.tsx`
  - `/auth` -> `src/features/auth/AuthPage.tsx`

## 4. 数据流（真实实现）

1. 页面触发 store action。
2. store 读写 Supabase（`src/api/supabase.ts`）和本地持久化状态。
3. AI 相关能力统一由 `src/api/client.ts` 调用 `api/*` serverless。
4. serverless 在服务端读取 `CHUTES_API_KEY` 等环境变量并请求外部模型。

约束: 前端 `src/**` 不应直连带密钥的第三方 AI 服务。

## 5. 目录分工（当前）

- `api/`: Vercel serverless（聊天、报告、批注、分类、日记、stardust）
- `src/features/`: 业务模块（auth/chat/todo/report）
- `src/store/`: Zustand store 与 actions/helpers
- `src/api/`: 前端 API client 与 Supabase 实例
- `src/components/layout`: 布局类共享组件
- `src/components/feedback`: 反馈/提示类共享组件
- `src/lib/`: 工具与纯函数
- `src/i18n/`: 国际化初始化与词条
- `docs/`: 交接主文档与结构文档

## 6. 当前清理主线状态（摘要）

- Phase A（安全）: 已完成
- Phase B（文档同构）: 已完成
- Phase C（结构拆分）: 已完成（C12/C13 已停止执行，后续由用户自行执行）
- Phase D（目录治理）: 已完成
- Phase E（治理与规范）: 已完成（E1/E2/E3）

权威看板以 `docs/CODE_CLEANUP_HANDOVER_PLAN.md` 为准。

## 7. 环境变量

核心变量见 `.env.example`：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `CHUTES_API_KEY`
- `ZHIPU_API_KEY`

## 8. 当前已知风险

1. C12（批注概率策略恢复）与 C13（调试日志清理）已停止执行，后续由用户自行推进。
2. 包管理器已统一为 `npm`，主锁文件为 `package-lock.json`。
3. `max-lines` 已落地（400 告警 / 800 报错），超大文件仍需持续拆分。

## 9. 接手建议

1. **先读 `docs/TSHINE_DEV_SPEC.md`**：iOS 开发规范，包含技术栈、分层架构、移动端 UI 规则、App Store 审核风险规避。
2. 再读 `docs/CODE_CLEANUP_HANDOVER_PLAN.md` 任务看板与交接日志。
3. 再看 `README.md` 与 `docs/ARCHITECTURE.md` 建立运行/分层认知。
4. 开发时遵守单主题提交，改动后至少执行 `npx tsc --noEmit` 与 `npm run build`。
