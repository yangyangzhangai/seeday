# Tshine 架构说明（真实实现）

- 文档版本: v2.0
- 最后更新: 2026-03-04
- 目标: 描述当前仓库真实架构，不含愿景型未实现模块

## 1. 架构总览

Tshine 采用前后端同仓模式：

1. 前端 (`src/`): React SPA，负责页面交互、状态管理、数据展示。
2. 服务端函数 (`api/`): Vercel Serverless，负责 AI 请求中转与密钥保护。
3. 数据层: Supabase，负责用户、消息、任务、报告等持久化。

```text
Browser (React)
  -> Zustand Stores
  -> Supabase SDK (业务数据)
  -> src/api/client.ts
  -> /api/* (Vercel Serverless)
  -> External LLM Providers
```

## 2. 前端分层

### 2.1 路由层

- 入口: `src/App.tsx`
- 路由:
  - `/chat`
  - `/todo`
  - `/report`
  - `/auth`
- 主布局: Header + BottomNav + 全局批注气泡 + 星尘动画（组件分组于 `components/layout` 与 `components/feedback`）

### 2.2 Feature 层

- `src/features/auth`: 登录注册
- `src/features/chat`: 聊天与活动记录
- `src/features/growth`: 成长页（习惯/目标瓶 + 待办 + 专注）
- `src/features/report`: 报告视图、详情与统计

### 2.3 状态层（Zustand）

- `useAuthStore`: 用户与会话初始化
- `useChatStore`: 消息流、记录模式、历史加载、活动编辑
- `useTodoStore`: 待办 CRUD 与状态同步
- `useReportStore`: 报告生成、报告列表、观察手记
- `useAnnotationStore`: 批注状态、触发与展示
- `useMoodStore`: 心情映射与本地持久化（含容量裁剪）
- `useStardustStore`: 星尘相关状态

说明: store/action/helper 已做分拆，避免超长函数集中在单文件。

### 2.4 API 调用层

- 文件: `src/api/client.ts`
- 作用:
  - 统一封装前端到 serverless 的 HTTP 调用
  - 提供 `callChatAPI` / `callReportAPI` / `callAnnotationAPI`
  - 提供 `callClassifierAPI` / `callDiaryAPI` / `callStardustAPI`

## 3. 服务端函数层

目录: `api/`

- `chat.ts`: 对话生成
- `report.ts`: 报告分析
- `annotation.ts`: 批注生成与内容提取
- `classify.ts`: 结构化分类
- `diary.ts`: 观察手记生成
- `stardust.ts`: 星尘 Emoji 生成

通用约束:

1. 仅接受预期方法（通常 `POST`）。
2. 从环境变量读取密钥（如 `CHUTES_API_KEY`）。
3. 返回结构化错误，避免前端拿到原始异常堆栈。

## 4. 数据与持久化

### 4.1 云端数据

- Supabase 由 `src/api/supabase.ts` 初始化。
- 各 store 通过 Supabase 读写业务数据（消息、待办、报告等）。

### 4.2 本地数据

- 多个 store 使用 `persist` 持久化到 localStorage。
- `useMoodStore` 已增加容量上限裁剪，防止无限增长。

## 5. 核心业务流程

### 5.1 聊天/记录流程

1. `ChatPage` 触发 `useChatStore.sendMessage`。
2. store 更新本地状态并写入 Supabase。
3. 根据模式触发 AI 对话、心情检测、批注等后续动作。

### 5.2 报告流程

1. `ReportPage` 触发 `generateReport(type, date)`。
2. `useReportStore` 聚合 Todo + Message + Mood 数据。
3. `reportActions/reportHelpers` 计算统计并生成报告对象。
4. 报告写入本地与 Supabase，详情页可进一步触发观察手记生成。

### 5.3 跨天日报触发

- 逻辑位于 `App` 主布局层。
- 通过定时器与 `visibilitychange` 检查跨天并生成前一日日报。

## 6. 国际化

- 入口: `src/i18n/index.ts`
- 语言: `zh` / `en` / `it`
- 策略:
  - `fallbackLng = en`
  - `load = languageOnly`
  - 语言选择缓存到 localStorage

## 7. 安全边界

1. 前端不保存第三方 AI 密钥。
2. 所有 AI 请求经由 `api/*` 中转。
3. 仅保留必要的前端公开配置（如 Supabase anon key）。

## 8. 当前技术债（架构相关）

1. C12（批注概率策略恢复）与 C13（调试日志清理）已停止执行，后续由用户自行推进。
2. 多个核心文件仍超过 400 行告警阈值，需继续按 max-lines 规则拆分。

## 9. 关联文档

- 主计划: `docs/CODE_CLEANUP_HANDOVER_PLAN.md`
- 目录地图: `docs/PROJECT_MAP.md`
- 项目上下文: `PROJECT_CONTEXT.md`
- 功能状态: `FEATURE_STATUS.md`
