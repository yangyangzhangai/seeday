# Tshine 项目目录结构地图 (Project Map)

> **版本标记:** v1.0 
> **最后更新:** 2026-03-03
> **说明:** 本文档是唯一的目录规划真实来源。后续新建文件请严格参照此规范落子。

## 1. 整体架构 (目标结构)

```text
/
├── api/             # Vercel Serverless Functions（仅服务端）
├── docs/            # 架构、规范、历史归档与交接文档
├── src/             # 前端 React 代码
│   ├── app/         # 入口、路由、全局 Provider（暂未抽离）
│   ├── features/    # 业务模块（按业务领域聚合：auth/chat/todo/report）
│   ├── shared/      # 共享层 (目前暂作根级，待收拢至 shared/)
│   └── ...          # 当前散落配置（如 /lib, /store, /components 等，分步重构中）
```

## 2. 详细职责与边界

### `/api` (服务端函数)
- **职责**: Vercel Serverless Functions入口，仅在服务端运行。
- **边界**: 这里不能 `import` 任何依赖于 Browser API (`window`, `localStorage` 等) 的代码。所有外部 Key 操作应在这里读取环境变量执行。
- **当前状态**: 已将直连通道（如 qwen、stardust）迁移到此处。

### `/src/features` (业务核心)
- **职责**: 按照产品功能垂直聚合代码，而非按照框架分层。
- **规范/入口**:
  - 新增页面默认放在独立 feature 文件夹（如 `features/auth/AuthPage.tsx`）。
  - 各个 feature 应该是内聚的。如果有个组件只在一个 feature 中使用，就放在该 folder 内部。
- **当前状态**: 
  - `auth/`: 用户登录登出页面 （原 pages/AuthPage 迁移至此）
  - `chat/`: 对话模块
  - `report/`: 周报月报汇总分析模块
  - `todo/`: 任务打卡模块

### `/src/shared` (共享层) *规划中*
- **职责**: 面向整个项目复用的技术机制或业务组件。
- **子目录约束**:
  - `ui/`: (对应现在的 `components/`) 纯木偶组件，如 `Button`, `Modal`，不绑定业务状态。
  - `lib/`: 纯净工具函数库（如 `time.ts`, `aiParser.ts`）。
  - `api/`: （对应目前的 `src/api` client）客户端与后端交互的服务定义。
  - `store/`: 全局 Zustand state (跨功能的全局状态，比如 User/Auth信息；只属于单模块的 Store 可下沉至相应 `features/` 中)。
- **当前状态**: 还在以 `src/lib`, `src/components`, `src/store` 平铺展开的形式存在，未来将平滑迁移至 `shared/` 内。

### `/docs`
- **职责**: 项目的交接、结构、说明文档集。
- **结构**:
  - `CODE_CLEANUP_HANDOVER_PLAN.md`: 主线重构任务看板。
  - `PROJECT_MAP.md`: (本文档) 目录导航。
  - `/archive`: 过期的遗留历史说明文件。

## 3. 已弃用与黑名单策略

- 🚫 **弃用**: `src/pages` - 所有页面移至 `src/features/*` 中，不再提供空洞的大杂烩容器。
- 🚫 **弃用**: `src/utils` - 所有基于业务耦合的 util 函数已被分离到 `src/lib`（纯函数）或功能内。
- 🚫 **禁止**: 前端在 `src/**` 内直接 `import` 第三方 AI 的 SDK 或 API Key。必须走 `src/api/client.ts` 提交到 Vercel (指 `root/api/`) 执行。

## 4. 后续维护
如果后续对系统结构有进一步调整，必须同步更新该文件中的状态。
