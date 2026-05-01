# Seeday 架构说明（真实实现）

- 文档版本: v2.2
- 最后更新: 2026-04-08
- 目标: 描述当前仓库真实架构，不含愿景型未实现模块

## 1. 架构总览

Seeday 采用前后端同仓模式：

1. 前端 (`src/`): React SPA，负责页面交互、状态管理、数据展示。
2. 服务端函数 (`api/`): Vercel Serverless，负责 AI 请求中转与密钥保护。
3. 数据层: Supabase，负责用户、消息、任务、报告、成长瓶、专注记录与植物记录等持久化。

```text
Browser (React)
  -> BrowserRouter + MainLayout
  -> Zustand Stores
  -> src/services/input/*
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
  - `/growth`
  - `/todo` -> redirect to `/growth`
  - `/report`
  - `/profile`
  - `/telemetry/live-input`
  - `/auth`
- 主布局: Header + BottomNav + 全局批注气泡 + 星尘动画（组件分组于 `components/layout` 与 `components/feedback`）
- App 级还挂载 `useRealtimeSync()` 与跨天日报自动触发逻辑。

### 2.2 Feature 层

- `src/features/auth`: 登录注册
- `src/features/chat`: 聊天与活动记录
- `src/features/growth`: Growth 页面（Todo + Bottle + Focus）
- `src/features/report`: 报告视图、详情、统计与植物根系区
- `src/features/profile`: 个人设置与植物方向配置
- `src/features/telemetry`: live-input 运营看板（管理员）

### 2.3 服务层（纯逻辑）

- `src/services/input`: 多语言词库、信号提取、live input 分类、Magic Pen parser/fallback
- `src/lib/*`: 映射、报表计算、植物计算与通用纯函数

### 2.4 状态层（Zustand）

- `useAuthStore`: 用户与会话初始化
- `useChatStore`: 消息流、记录模式、历史加载、活动编辑
- `useTodoStore`: Todo CRUD、分类、排序与消息联动
- `useGrowthStore`: 成长瓶、每日目标弹窗与瓶子进度
- `useFocusStore`: 专注会话与活动关联
- `useReportStore`: 报告生成、报告列表、观察手记
- `usePlantStore`: 当日植物、根系片段、方向配置与生成动作
- `useAnnotationStore`: 批注状态、触发与展示
- `useMoodStore`: 心情映射与本地持久化（含容量裁剪）
- `useStardustStore`: 星尘相关状态

说明: store/action/helper 已做分拆，避免超长函数集中在单文件。

### 2.5 API 调用层

- 文件: `src/api/client.ts`
- 作用:
  - 统一封装前端到 serverless 的 HTTP 调用
  - 提供 `callReportAPI` / `callAnnotationAPI`
  - 提供 `callClassifierAPI` / `callDiaryAPI`
  - 提供 `callMagicPenParseAPI`
  - 提供 `callPlantGenerateAPI` / `callPlantDiaryAPI` / `callPlantHistoryAPI`

## 3. 服务端函数层

目录: `api/`

- `report.ts`: 报告分析（`POST /api/report`）
- `annotation.ts`: 批注生成与内容提取（`POST /api/annotation`）
- `classify.ts`: 结构化分类（`POST /api/classify`）
- `diary.ts`: 观察手记生成（`POST /api/diary`）
- `magic-pen-parse.ts`: Magic Pen AI 结构化提取（`POST /api/magic-pen-parse`）
- `todo-decompose.ts`: Todo 步骤拆解（`POST /api/todo-decompose`）
- `plant-generate.ts`: 生成当日植物记录（`POST /api/plant-generate`）
- `plant-diary.ts`: 植物日记生成（`POST /api/plant-diary`）
- `plant-history.ts`: 植物历史读取（`GET /api/plant-history`）
- `plant-asset-telemetry.ts`: 植物素材降级埋点（`POST /api/plant-asset-telemetry`）
- `live-input-telemetry.ts`: live-input 埋点与看板（`POST` ingest, `GET` dashboard）

共享服务位于 `src/server/`：

- `http.ts`: CORS / method / error 包装
- `annotation-handler.ts` / `annotation-prompts.ts`
- `annotation-prompts.defaults.ts` / `annotation-prompts.user.ts`
- `annotation-suggestion.ts` / `annotation-similarity.ts`
- `magic-pen-prompts.ts`
- `plant-shared.ts` / `plant-diary-service.ts`

通用约束:

1. 仅接受预期方法（大多数为 `POST`，`plant-history` 为 `GET`）。
2. 从环境变量读取密钥（如 `OPENAI_API_KEY`、`QWEN_API_KEY`、`ZHIPU_API_KEY`）。
3. 返回结构化错误，避免前端拿到原始异常堆栈。

## 4. 数据与持久化

### 4.1 云端数据

- Supabase 由 `src/api/supabase.ts` 初始化。
- 各 store 通过 Supabase 读写业务数据（消息、待办、报告、bottles、focus_sessions、daily_plant_records、plant_direction_config 等）。

### 4.2 本地数据

- 多个 store 使用 `persist` 持久化到 localStorage。
- `useMoodStore` 已增加容量上限裁剪，防止无限增长。

## 5. 核心业务流程

### 5.1 聊天/记录流程

1. `ChatPage` 触发 `useChatStore.sendMessage`。
2. 普通记录优先走本地 activity/mood 分类；Magic Pen mode-on 时走 `api/magic-pen-parse.ts`。
3. store 更新本地状态并写入 Supabase。
4. 根据记录结果触发批注、星尘、报告统计等后续动作。

### 5.2 Growth / Todo 流程

1. `GrowthPage` 组合 `useTodoStore`、`useGrowthStore` 与 `useFocusStore`。
2. Todo 的新增/编辑/完成与 message 记录、分类和专注时长联动。
3. 成长瓶和每日目标状态由 Growth / Auth 两侧共同同步。

### 5.3 报告与植物流程

1. `ReportPage` 触发 `generateReport(type, date)`。
2. `useReportStore` 聚合 Todo + Message + Mood 数据。
3. `reportActions/reportHelpers` 计算统计并生成报告对象。
4. 报告写入本地与 Supabase，详情页可进一步触发观察手记生成。
5. 同页内 `PlantRootSection` 通过 `usePlantStore` 加载当日根系、触发植物生成、读取历史与方向配置。

### 5.4 跨天日报触发

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
2. 多个核心文件仍超过 400 行告警阈值，需继续按 max-lines 规则拆分（1200 硬限）。

## 9. 关联文档

- 目录地图: `docs/PROJECT_MAP.md`
- 项目上下文: `PROJECT_CONTEXT.md`
- 功能状态: `FEATURE_STATUS.md`
