# Tshine 代码整理交接计划

- 文档版本: v1.6
- 创建日期: 2026-03-03
- 适用范围: `Tshine2-13-mainc` 全仓
- 目标: 在不重写项目的前提下，完成安全清理、文档同构、结构拆分与可维护性提升

## 1. 项目现状（已确认）

1. 架构可用，不需要重写：Vite + React + Zustand + Supabase + Vercel Serverless。
2. 当前主要问题集中在三类：
   - 大文件/高复杂度（如 chat/report/store 模块）
   - 明文密钥残留
   - 文档与代码不同步
3. `.env.example` 已存在，可直接作为环境变量模板。
4. 本阶段暂不接入 Hook 拦截，后续统一实施。

## 2. 治理目标与边界

### 2.1 目标

1. 从代码中彻底移除明文密钥。
2. 建立可交接的整理流程文档。
3. 分阶段拆分巨型文件，降低维护成本。
4. 每个阶段可独立验收，避免大爆炸式改动。

### 2.2 非目标（本轮不做）

1. 不做 UI 全量重设计。
2. 不做数据库大迁移。
3. 不做一次性全仓重构。

### 2.3 文档治理第一步（必须先做）

1. `docs/CODE_CLEANUP_HANDOVER_PLAN.md` 是唯一主交接文档（Single Source of Truth），不得删除，不得改名。
2. 所有新的“结构分析/整改建议/阶段总结”必须合并进本文件，不再新增平行主计划文档。
3. 允许新增专题文档（如 `PROJECT_MAP.md`、`FEATURE_STATUS.md`），但它们只承载细节，不替代主计划。
4. 每次合并外部报告时，必须在本文件同步更新以下四项：
   - 变更来源（报告名称、日期、作者）
   - 决策结论（采纳/部分采纳/不采纳）
   - 任务看板变化（新增、删除、状态变更）
   - 风险与回滚点
5. 本文件更新频率要求：
   - 每个 PR 合并后当日更新一次
   - 每周至少做一次状态回顾（即使无代码变更）

### 2.4 第一步验收标准（DoD）

1. 本文件中已明确“主交接文档不可删除/改名”的规则。
2. 本文件中存在“按 PR 拆分执行清单（可独立回滚）”。
3. 交接日志中有本次规则落地记录，可追溯。

### 2.5 外部审计报告对齐状态

1. 2026-03-03 结构审计报告已纳入本计划主线，并以“可执行任务”形式落地。
2. 审计要点归档位置：`docs/archive/2026-03-03-structure-audit-summary.md`。
3. 本文件为执行基线；归档文件用于保留审计上下文与历史依据。

## 3. 分阶段计划（交接主线）

## Phase A: 安全清理（最高优先级）

### A.1 任务

1. 删除前先做引用扫描，确认 `src/services/aiService.ts`、`src/api/qwen.ts` 未被运行路径引用再删。
2. 移除明文密钥（仅保留环境变量读取）。
3. 清理或替换包含明文密钥的历史调试文件。
4. 确保前端构建产物中不暴露服务端密钥。

### A.2 重点文件

1. `src/services/aiService.ts`
2. `src/api/qwen.ts`
3. `import requests.py`
4. `scripts/test-annotation.js`
5. `src/store/useStardustStore.ts`（含硬编码 Bearer）

### A.3 验收标准

1. `rg -n "sk-|cpk_|Bearer" . --glob '!node_modules/**' --glob '!dist/**'` 无敏感残留（文档示例占位符除外）。
2. `npx tsc --noEmit` 通过。
3. `npm run build` 通过。
4. 关键页面手测不回归（`/chat`, `/todo`, `/report`）。

### A.4 DoD（完成定义）

1. 引用扫描结论已记录（可追溯到文件与命令）。
2. 明文密钥清理完成并通过 `tsc` + `build`。
3. 关键页面冒烟测试通过（`/chat`, `/todo`, `/report`）。

## Phase B: 文档同构（可交接核心）

### B.1 任务

1. 重写根 `README.md`（真实功能、开发/部署、目录结构、已知问题）。
2. 建立全局上下文文档（建议 `PROJECT_CONTEXT.md`）。
3. 建立模块状态文档（建议 `FEATURE_STATUS.md`）。
4. 重写 `docs/ARCHITECTURE.md`（仅描述当前真实实现，移除愿景型虚构模块）。
5. 新建 `docs/CHANGELOG.md`（按 PR 记录变更与回滚点）。
6. 过时文档不一刀切删除，优先迁移到 `docs/archive/` 并保留迁移说明。

### B.2 验收标准

1. 新人只读 3 份文档可在 30 分钟内定位核心代码路径。
2. 文档中的功能状态与实际代码一致。

### B.3 DoD（完成定义）

1. 文档与代码同构，且过时文档已迁移至 `docs/archive/`（含说明）。
2. `npx tsc --noEmit` 通过。
3. `npm run build` 通过。
4. 关键页面冒烟测试通过（`/chat`, `/todo`, `/report`）。

## Phase C: 结构拆分（渐进）

### C.1 执行顺序

1. `src/features/chat/ChatPage.tsx`
2. `src/store/useChatStore.ts`
3. `src/features/report/ReportPage.tsx`
4. `src/store/useReportStore.ts`
5. `src/features/todo/TodoPage.tsx`

### C.2 拆分策略

1. 页面组件拆为：容器组件 + 展示组件 + hooks。
2. store 拆为：state/action 骨架 + 纯业务函数模块。
3. 保证每次只拆一个模块并可单独回滚。

### C.3 阶段阈值

1. 第一阶段：文件 <= 800 行（硬约束）。
2. 第二阶段：文件 <= 500 行（告警目标）。
3. 稳定后再推进到更严格阈值。

### C.4 DoD（完成定义）

1. 本阶段目标文件行数达标（按阈值约束）。
2. `npx tsc --noEmit` 通过。
3. `npm run build` 通过。
4. 关键页面冒烟测试通过（`/chat`, `/todo`, `/report`）。

### C.5 深度代码审计（2026-03-03）

> 审计范围: 全部 4 个 Feature 页面 + 全部 7 个 Store 文件 + 2 个 Helper 文件，共 13 个文件 ~3750 行 ~155KB。

#### C.5.1 文件规模现状

| 类别 | 文件 | 行数 | 大小 |
|------|------|------|------|
| Feature | `ChatPage.tsx` | 476 | 20KB |
| Feature | `ReportPage.tsx` | 633 | 28KB |
| Feature | `TodoPage.tsx` | 472 | 19KB |
| Feature | `AuthPage.tsx` | 304 | 13KB |
| Store | `useChatStore.ts` | 614 | 22KB |
| Store | `useReportStore.ts` | 680 | 31KB |
| Store | `useTodoStore.ts` | 289 | 10KB |
| Store | `useStardustStore.ts` | 402 | 14KB |
| Store | `useAnnotationStore.ts` | 344 | 11KB |
| Store | `useAuthStore.ts` | 172 | 6KB |
| Store | `useMoodStore.ts` | 76 | 3KB |
| Helper | `chatHelpers.ts` | 68 | 3KB |
| Helper | `annotationHelpers.ts` | 212 | 5KB |

#### C.5.2 严重问题（P0）

**P0-1: `useReportStore.ts` 巨型函数 + 业务逻辑内联（680 行）**

- `generateReport`（L144–L435）约 290 行，混合了：日期范围计算、Todo 过滤统计、中文关键词分类器（60+ 行硬编码关键词）、心情分布计算、摘要文案生成、Supabase 持久化。
- `generateTimeshineDiary`（L496–L669）约 170 行，与 `triggerAIAnalysis` 大量重复：
  - 时间范围计算逻辑重复 3 次（L448–L460, L510–L521, L152–L172）
  - 活动消息过滤逻辑重复 3 次（L266–L273, L468–L474, L524–L529）
  - Todo 统计过滤逻辑重复 2 次（L176–L186, L532–L536）
- **方案**: 提取 `reportHelpers.ts`，含 `getDateRange()`, `filterActivities()`, `filterRelevantTodos()`, `classifyActivities()`, `computeMoodDistribution()`, `generateActionSummary()`, `generateMoodSummary()`。预计 store 减少 ~200 行。

**P0-2: `useChatStore.ts` `sendMessage` 过于庞大（170 行）**

- `sendMessage`（L195–L363）混合 7 种职责：计算上一活动 duration、更新 Supabase、自动检测心情 + 分类器 API、创建消息 + 乐观更新、持久化、触发 AI 批注、AI 聊天响应。
- `sendMood`（L550–L593）未在 `ChatState` 接口声明，类型不完整。
- **方案**: 提取 `chatActions.ts`，含 `closePreviousActivity()`, `persistMessageToSupabase()`, `triggerMoodDetection()`, `handleAIChatResponse()`。预计 store 减少 ~120 行。

#### C.5.3 中等问题（P1）

**P1-1: 硬编码中文字符串（绕过 i18n）**

| 文件 | 位置 | 硬编码内容 |
|------|------|------------|
| `ChatPage.tsx` | L47, L51, L430, L433–L434 | `'自定义'` |
| `ChatPage.tsx` | L290 | `'加载更多记录…'` |
| `ChatPage.tsx` | L296 | `'— 已是最早的记录 —'` |
| `ChatPage.tsx` | L308–L311 | `'昨天你记录了...'`, `'最后在做：'`, `'点击或上滑...'` |
| `ChatPage.tsx` | L326–L327 | `'新的一天…'`, `'记录你正在做的事情'` |
| `ReportPage.tsx` | L153 | `'分钟'` |
| `ReportPage.tsx` | L559 | `'今日心情光谱'` |
| `useReportStore.ts` | L15, L155–L167 | `FALLBACK_SUMMARY`, 标题生成 |
| `useReportStore.ts` | L231–L258 | 整个关键词分类器（60 行中文） |
| `useReportStore.ts` | L299–L311 | 行动总结模板 |
| `useReportStore.ts` | L385–L392 | 心情简评模板 |
| `useChatStore.ts` | L241, L258, L373 | `'待分类'`, `'chat'` |
| `useMoodStore.ts` | L4–L12 | MoodOption 类型使用中文字面量 |
| `AuthPage.tsx` | L71, L127, L270, L287 | `'请输入有效的手机号'`, `'选择头像'`, `'关闭'`, `'更换头像'` |

**P1-2: Supabase session 获取模式重复 ~20 次**

同一 `const { data: { session } } = await supabase.auth.getSession()` 模式在所有 store 中重复。方案：新建 `lib/supabase-utils.ts` 提供 `withSession()` 封装。

**P1-3: `ReportPage.tsx` 未拆分子组件（633 行）**

一个文件内定义 4 个组件（`ActivityRecordsView`, `MoodPieChart`, `ReportStatsView`, `ReportPage`），主页面 JSX 含 3 层嵌套模态框，约 250 行。方案：拆分到独立文件，主文件降至 ~200 行。

**P1-4: `TodoPage.tsx` `catMap` 重复定义**

`catMap`（类别翻译映射）在 `TodoItem`（L35–L41）和 `TodoPage`（L155–L161）中完全重复。方案：提取到 `lib/todoHelpers.ts`。

**P1-5: `ChatPage.tsx` 跨天日报生成逻辑错放**

L113–L134 的 `useEffect` 负责跨天自动生成日报，与聊天页面无关，且事件监听器清理有 bug（L132: `gen as any`）。方案：移到 `App.tsx`。

#### C.5.4 低优先级问题（P2）

1. **`annotationHelpers.ts` 测试模式硬编码**: L141–L143 直接 `return true`，跳过全部概率逻辑（L145–L200 被注释掉），生产环境也使用 100% 触发率。
2. **过度 console.log**: `useTodoStore`(8处), `useStardustStore`(6处), `useAnnotationStore`(5处), `useChatStore`(4处), `useReportStore`(3处)。建议统一 `import.meta.env.DEV && console.log()`。
3. **`useStardustStore.ts` Emoji 正则过长**: L79 约 800 字符的 Unicode 正则，建议改用 `emoji-regex` npm 包。
4. **`useTodoStore.ts` `updateTodo` 字段映射脆弱**: L125–L163 手动驼峰→下划线映射，容易遗漏。建议统一 `toDbTodo()` 映射函数。
5. **`useMoodStore.ts` Record 对象持续膨胀**: `activityMood`、`customMoodLabel` 等按 message ID 为 key 的 Record 从不清理，长期使用有 localStorage 溢出风险。
6. **`insertActivity` 时间冲突处理复杂**: `useChatStore.ts` L366–L458 含 3 种碰撞处理逻辑，缺乏测试。建议提取为纯函数。

#### C.5.5 整体健康度评分

| 维度 | 评分 | 说明 |
|------|:----:|------|
| 可维护性 | 4/10 | 大函数多、职责不清 |
| i18n 完整度 | 5/10 | 核心流程有 i18n，UI/数据层有大量硬编码中文 |
| 代码重复 | 3/10 | 时间范围/session/消息过滤重复率高 |
| 类型安全 | 6/10 | 基本类型定义在，但有 `any` 和缺失接口 |
| 性能 | 6/10 | 基本合理，MoodStore 无限增长和每秒 timer 有隐患 |
| 测试覆盖 | 1/10 | 无任何单元测试 |

#### C.5.6 推荐优化执行顺序

| 优先级 | 任务 | 预估工时 | 影响范围 |
|:------:|------|:--------:|----------|
| P0 | 提取 `reportHelpers.ts` | 2h | `useReportStore` 减少 ~200 行 |
| P0 | 拆分 `sendMessage` 到 `chatActions.ts` | 2h | `useChatStore` 减少 ~120 行 |
| P1 | 统一 Supabase session 封装 | 1h | 所有 store 文件 |
| P1 | 拆分 `ReportPage.tsx` 子组件 | 1.5h | 单文件减少 ~350 行 |
| P1 | 修复硬编码中文→i18n | 2h | ChatPage, ReportPage, AuthPage |
| P1 | 提取 `catMap` 到 todoHelpers | 0.5h | TodoPage, TodoItem |
| P1 | 移动跨天日报逻辑到 App 层 | 0.5h | ChatPage → App.tsx |
| P2 | 恢复 annotationHelpers 概率逻辑 | 0.5h | annotationHelpers.ts |
| P2 | 清理 DEBUG console.log | 0.5h | 所有 store 文件 |
| P2 | MoodStore 数据清理策略 | 1h | useMoodStore |
| P2 | 统一 Todo 字段映射函数 | 1h | useTodoStore |

## Phase D: 目录治理与地图（规范化）

### D.1 目标

1. 统一目录分层与边界，避免 `pages/features/components/store` 混用造成职责漂移。
2. 建立单一真实目录地图，确保文档与代码结构一致。
3. 控制复杂度扩散，减少后续新增功能的接入成本。

### D.2 目标结构（落地模板）

```text
src/
  app/                # 入口、路由、全局 provider
  features/           # 按业务聚合（auth/chat/todo/report）
  shared/             # 共享层（api/ui/lib/types/constants/i18n/styles）
api/                  # Vercel Serverless Functions（仅服务端）
docs/                 # 架构与交接文档
```

### D.3 执行策略（渐进、不大爆炸）

1. 优先统一规则，不先做大规模搬迁；先写地图，再按模块迁移。
2. 前端 API 调用统一走 `src` 内 API Client，服务端接口只保留根目录 `api/*`。
3. 页面入口统一收敛到 `features`（如将 `src/pages/AuthPage.tsx` 迁至 `src/features/auth`）。
4. 目录占位 `README` 精简或删除，统一由 `docs/PROJECT_MAP.md` 作为导航主文档。
5. 锁定单一包管理器（npm 或 pnpm 二选一），避免双锁文件长期并存。
6. `lib/utils.ts` 不直接重命名为 `textProcessor.ts`；先按职责拆分，再基于实际职责命名。
7. 低风险清理项分批落地并逐项验收：
   - `src/i18n/locales/en.ts.temp`
   - 空目录/占位目录（`src/assets`, `src/styles`, `src/layouts`）
   - 占位 README（`src/api`, `src/components`, `src/pages`, `src/store`, `src/styles`, `src/types`, `src/layouts`）
   - 根目录残留待评估文件（`TO-DO.json`, `YOUWARE.md`, `SECURITY_FIX.md`, `scripts/test-minmax.ts`）

### D.4 验收标准

1. 存在并维护 `docs/PROJECT_MAP.md`，包含目录职责、入口文件、依赖边界、状态归属。
2. `src` 内不存在未使用的直连 AI 通道（如 `src/api/qwen.ts` 这类遗留实现）。
3. 路由页面目录规则统一（新增页面默认进入 `features/*`）。
4. 包管理器策略明确，避免协作冲突（仅保留一套主锁文件）。

### D.5 DoD（完成定义）

1. 目录边界调整完成并通过路径校验。
2. `npx tsc --noEmit` 通过。
3. `npm run build` 通过。
4. 关键页面冒烟测试通过（`/chat`, `/todo`, `/report`）。

## Phase E: 规范化与长期约束（持续）

### E.1 任务

1. 组件目录按职责分组（如 `components/layout`, `components/feedback`），保持与现有视觉结构兼容。
2. 新建 `CONTRIBUTING.md`，明确命名规范、目录约定、PR 模板、回滚要求。
3. 引入文件规模约束（如 ESLint `max-lines`：400 告警、800 报错），防止再次出现巨型文件。

### E.2 验收标准

1. 新增贡献者可依据 `CONTRIBUTING.md` 独立提交标准化 PR。
2. 关键目录分组可读性提升，新增组件按分组规则入库。
3. 巨型文件约束规则在 CI 或本地 lint 可执行。

### E.3 DoD（完成定义）

1. `CONTRIBUTING.md` 生效并在 README 或主计划中有入口。
2. 规则配置通过 `npx tsc --noEmit`、`npm run build`、关键页面冒烟验证。
3. 不引入与现有代码风格冲突的强制规则。

## 4. 任务看板（供交接更新）

### Phase A: 安全清理
- [x] A1: 移除 `aiService.ts` 明文密钥
- [x] A2: 处理 `qwen.ts`（删除或迁移为服务端调用）
- [x] A3: 清理调试脚本中的明文密钥（部分完成）
- [x] A4: 清理 `useStardustStore.ts` 中硬编码 Bearer

### Phase B: 文档同构
- [x] B1: 重写根 `README.md`
- [x] B2: 新建 `PROJECT_CONTEXT.md`
- [x] B3: 新建 `FEATURE_STATUS.md`
- [x] B4: 重写 `docs/ARCHITECTURE.md`（仅真实实现）
- [x] B5: 新建 `docs/CHANGELOG.md`

### Phase C: 结构拆分
- [x] C1: 拆分 `ChatPage.tsx`
- [x] C2: 拆分 `useChatStore.ts`（chatHelpers 已提取）
- [x] C3: 拆分 `ReportPage.tsx` — 子组件独立 + 页面逻辑下沉到 `reportPageHelpers.ts`
- [x] C4: 拆分 `useReportStore.ts` — 提取 `reportActions.ts`，store 改为编排式调用
- [x] C5: 拆分 `TodoPage.tsx`
- [x] C6: **[P0]** 提取 `reportHelpers.ts`（时间范围/过滤/分类器逻辑），useReportStore 减少 ~200 行
- [x] C7: **[P0]** 拆分 `sendMessage` → `chatActions.ts`（关闭活动/持久化/心情检测/AI 响应），useChatStore 减少 ~120 行
- [x] C8: **[P1]** 统一 Supabase session 封装 → `lib/supabase-utils.ts`
- [x] C9: **[P1]** 修复硬编码中文 → i18n（ChatPage ~10 处, ReportPage ~3 处, AuthPage ~4 处, useReportStore ~多处）
- [x] C10: **[P1]** 提取 `catMap` 到 `lib/todoHelpers.ts`（消除 TodoPage + TodoItem 重复）
- [x] C11: **[P1]** 移动跨天日报生成逻辑从 ChatPage → App.tsx
- [ ] C12: **[P2/停止执行]** 恢复 `annotationHelpers.ts` 概率逻辑（移除测试模式 100% 触发）— 后续由用户自行执行
- [ ] C13: **[P2/停止执行]** 清理 DEBUG console.log（~26 处分布在 5 个 store 文件）— 后续由用户自行执行
- [x] C14: **[P2]** MoodStore 数据清理策略（防止 localStorage 溢出）
- [x] C15: **[P2]** 统一 Todo 字段映射函数（`toDbTodo()`）
- [x] C16: **[P2]** 修复 `sendMood` 缺失 `ChatState` 接口声明

### Phase D: 目录治理
- [x] D1: 新建 `docs/PROJECT_MAP.md`（目录职责/入口/边界/状态）
- [x] D2: 统一页面入口策略（`pages` 向 `features` 收敛）
- [x] D3: 统一前后端 API 分层边界（`src/*` 调用、`api/*` 服务端）
- [x] D4: 清理或迁移遗留直连实现（含 `src/api/qwen.ts`）
- [x] D5: 清理占位目录 README，合并为单一地图文档
- [x] D6: 锁定单一包管理器并确认主锁文件策略（已统一为 `npm` + `package-lock.json`）
- [x] D7: 清理 `src/i18n/locales/en.ts.temp`
- [x] D8: 清理空目录与占位目录（`src/assets`, `src/styles`, `src/layouts`）
- [x] D9: 根目录残留文件评估处置（`TO-DO.json`, `YOUWARE.md`, `SECURITY_FIX.md`, `scripts/test-minmax.ts`）

### Phase E: 规范化
- [x] E1: 新建 `CONTRIBUTING.md`
- [x] E2: 组件目录按职责分组（`layout/feedback`）
- [x] E3: 配置文件行数约束（`max-lines`）

### 编号约定（防止 B 编号混淆）

- `Phase B` 的 `B1-B5`：指“文档同构”任务编号（本计划原始编号体系）
- `审计报告` 的 `B1-B7`：在本计划内统一重命名为 `AB1-AB7`（Audit Bug）
- 映射规则：`AB1 = 审计B1`，`AB2 = 审计B2` ... `AB7 = 审计B7`
- 本文件后续凡出现 `ABx`，均指 2026-03-04 审计报告缺陷编号，不再与 Phase B 混用

### 状态口径约定（防止“历史日志”与“当前状态”混淆）

- `第 4 节 任务看板` 是当前有效状态（单一事实源）
- `第 8 节 交接日志` 仅记录时间序列历史，可能包含“已完成 -> 回切 -> 停止执行”等阶段性状态
- 如任务看板与历史日志存在差异，以任务看板为准；日志只用于追溯

### Phase F: 2026-03-04 审计修复批次（按用户约束执行）
- [x] F1: **[P0/AB7]** 清理 `src/api/client.ts` 恒等三元与死代码（`API_BASE` 固定 `'/api'`）
- [x] F2: **[P0/AB6]** 清理 `useChatStore.sendMessage` 中 record 分支空逻辑注释（避免误导）
- [x] F3: **[P1/AB4]** 统一“今日日期”口径为本地时间（`useAnnotationStore` 对齐 `getLocalDateString`）
- [x] F4: **[P1/AB2]** 修复 `triggerMoodDetection` 语言硬编码（`lang` 改为按 `i18n.language` 动态）
- [x] F5: **[P1/AB5]** 统一消息持久化：`sendMood` 复用 `persistMessageToSupabase`（支持 `isMood`）
- [x] F6: **[P1]** 统一 `reportActions` 同日判断为 `isSameDay`，提取单次 `isToday` 复用
- [x] F7: **[P1]** 抽取 `src/api/client.ts` 通用 `postJson<TReq,TRes>`，收口 6 个重复 `fetch` 模式
- [x] F8: **[P1]** 收敛 `ChatPage` 中 MoodStore 分散 selector（单 selector/`useShallow`）
- [x] F9: **[P2]** 处理 `supabase-utils.ts` 未使用封装（`withSession` / `getSessionUserId`）
- [x] F10: **[P2]** 清理死代码：`pulseSlowStyle`、`generateEmojiPrompt`、`extractEmojiFromResponse`（若确认无引用）
- [x] F11: **[P2]** 移除 `ReportPage` 中 `setTimeout(50)` 竞态，改为可预测返回（`reportId`/report 对象）
- [x] F12: **[P2]** 抽取 `api/*` 公共包装（CORS/Method Guard/Error JSON）以消除重复
- [x] F13: **[P2]** 统一 AI 批注提取逻辑（`api/annotation.ts` 与 `src/lib/aiParser.ts` 合并策略）
- [x] F14: **[P2]** `Stardust` 查询与写回优化（`messageId -> memory` 映射；跨 store 写回改 action 化）
- [x] F15: **[P2]** 优化 `ChatPage` 每秒遍历消息的计时器路径（减少 O(n) 高频扫描）
- [x] F16: **[P2]** 限制 `useAnnotationStore.todayStats.events` 增长（上限/裁剪或去持久化）
- [x] F17: **[P3]** 统一 DB Row 映射函数（Todo/Report/Stardust/Annotation/Auth 同构）
- [x] F18: **[P3]** 心情领域 i18n 深改（`MoodOption` 中文字面量去耦）
- [ ] F19: **[停止执行/AB1]** 审计项 AB1/C12（`FORCE_ANNOTATION_TRIGGER`）本轮不改，后续由用户自行执行
- [ ] F20: **[停止执行]** 审计项 C13（DEBUG `console.log` 批量清理）本轮不改，后续由用户自行执行

### Phase G: 分形文档 + 强制同构
- [x] G1: 新建根目录 `LLM.md` 作为强制加载入口（Single Entry），明确文档权威顺序、三层读取顺序、禁止事项与回环检查规则。
- [x] G2: 固化三层分形结构（L1/L2/L3）并写入规范：
  - L1 全局层：`docs/PROJECT_MAP.md`（全局唯一地图，持续维护 as-is）
  - L2 模块层：为核心模块补齐 README（`src/features/auth|chat|todo|report/README.md`、`src/api/README.md`）
  - L3 文件层：关键文件头部增加依赖声明模板（先覆盖 `src/api/client.ts`、`src/store/use*Store.ts`、`api/*.ts`、`src/App.tsx`）
- [x] G3: 建立“文档-代码同构清单”并落地到模块 README：每个模块必须包含入口、对外接口、上游依赖、下游影响、关联文档。
- [x] G4: 新增 `scripts/check-doc-sync.mjs`，实现最小同构校验：
  - 核心模块 README 存在性检查
  - 关键文件依赖头声明存在性检查
  - `docs/PROJECT_MAP.md` 核心目录覆盖检查
- [x] G5: 在 `package.json` 新增 `lint:docs-sync` 并纳入标准验收命令；`CONTRIBUTING.md` 增加“代码变更 -> 必改文档”矩阵与执行要求。
- [x] G6: 在 `docs/CHANGELOG.md` 增加“文档同构变更记录规范”，要求每次结构/接口改动同步登记。
- [x] G7: 首轮基线对齐专项（一次性收敛）：
  - 清理重复定义（同一事实只保留一个主文档）
  - 统一术语（模块名、接口名、状态名）
  - 抽查 5 条核心路径（`/chat`、`/todo`、`/report`、`/api/*`、`i18n`）验证“代码与文档双向可追溯”

### Phase G 验收标准

1. AI 仅通过三次读取可拿到完整上下文：`LLM.md` -> `docs/PROJECT_MAP.md` -> 模块 README/关键文件头。
2. 任意核心改动可从代码反查文档、从文档定位代码（双向可追溯）。
3. `npm run lint:docs-sync` 可稳定执行，并能拦截“改代码不改文档”的常见漂移。
4. `CONTRIBUTING.md` 中存在清晰的文档回环规则，且与实际脚本一致。

### Phase G DoD（完成定义）

1. G1-G7 全部勾选完成。
2. `npx tsc --noEmit` 通过。
3. `npm run build` 通过。
4. `npm run lint:docs-sync` 通过。
5. 冒烟验证通过（`/chat`、`/todo`、`/report` 关键路径可用）。

### Phase H: 2026-03-06 审计后续（Hook + 代码瘦身 + 依赖清理）

> 来源：2026-03-06 全项目审计报告（文件规模热力图 + 依赖检查 + Hook 方案设计）

- [x] H1: **[P0]** 新建 `scripts/check-secrets.mjs` 密钥泄露扫描脚本
- [x] H2: **[P0]** 新建 `scripts/pre-commit.mjs` pre-commit hook 入口（串联 4 项检查）
- [x] H3: **[P0]** 新建 `scripts/install-hooks.mjs` + `npm run prepare` 自动安装 hook
- [x] H4: **[P0]** `LLM.md` 升级为完整 AI Session SOP（启动步骤、编码规范、回环检查、文档同步矩阵）
- [x] H5: **[P1]** 给 `api/annotation.ts`（当前 700 行，接近 800 上限）瘦身 → 提取 `annotation-prompts.ts`(prompt 模板)
- [x] H6: **[P1]** `useChatStore.ts` 继续瘦身（当前 552 行）→ 提取 `insertActivity`（含碰撞处理 ~90 行）到 `chatActions.ts`，目标降至 ~460 行
- [x] H7: **[P2]** 检查并清理未使用的重型依赖（`cannon-es`、`matter-js`、`three`），确认实际使用后决定保留或移除以减小 bundle
- [ ] H8: **[停止执行/用户决定不启用]** commit-msg hook（提交消息格式校验）

### Phase H 验收标准

1. 全部 hook 脚本安装并可通过 `node ./scripts/pre-commit.mjs` 验证。
2. H5 完成后 `api/annotation.ts` ≤ 300 行。
3. H6 完成后 `useChatStore.ts` ≤ 470 行。
4. `npx tsc --noEmit`、`npm run build`、`npm run lint:all` 通过。

### Phase H DoD（完成定义）

1. H1-H8 全部勾选完成或标记为不执行。
2. `npx tsc --noEmit` 通过。
3. `npm run build` 通过。
4. `npm run lint:all` 通过。
5. 冒烟验证通过（`/chat`、`/todo`、`/report` 关键路径可用）。

### Phase I: iOS 上架合规审计（2026-03-07 TSHINE_DEV_SPEC 对照审计）

> 来源：2026-03-07 代码审计报告 `docs/CODE_AUDIT_VS_DEV_SPEC.md`，对照 `docs/TSHINE_DEV_SPEC.md` v1.2

#### 分层架构（P0，功能大改时同步重构）
- [ ] I1: **[P0]** 创建 `src/api/repositories/`（`messageRepo.ts`, `todoRepo.ts`, `reportRepo.ts`, `stardustRepo.ts`, `annotationRepo.ts`），将 Store 中 50+ 处直接 Supabase 调用封装其中
- [ ] I2: **[P0]** 创建 `src/services/` 业务逻辑层（`chatService.ts`, `todoService.ts`, `reportService.ts`），从 Store 提取业务逻辑
- [ ] I3: **[P1]** 瘦身 `useChatStore.ts`（15.5KB ~430 行）— 借助 I1/I2 自然减少

#### 移动端 UI（P0-P1，可与 UI 美化同步）
- [ ] I4: **[P0]** 46 处 `hover:` 添加配套 `active:` 触控反馈（优先：`TodoItem` 7处、`AuthPage` 6处、`Header` 5处）
- [ ] I5: **[P1]** `Header.tsx` 添加 `safe-area-inset-top`
- [ ] I6: **[P1]** `BottomNav.tsx` 添加 `safe-area-inset-bottom`
- [ ] I7: **[P1]** `index.css` 全局添加 `user-select: none`（输入框/textarea 例外）
- [ ] I8: **[P2]** `ReportStatsView.tsx` `group-hover:` tooltip 改为 touch/click 触发

#### Capacitor 就绪（P0-P1）
- [ ] I9: **[P0]** `App.tsx` `BrowserRouter` -> `MemoryRouter`
- [ ] I10: **[P0]** 创建 `src/services/native/storageService.ts`（Zustand persist 用 `@capacitor/preferences` 适配器替代 localStorage）
- [ ] I11: **[P1]** `App.tsx` `document.visibilitychange` -> `@capacitor/app` 的 `appStateChange`
- [ ] I12: **[P1]** `App.tsx` `window.dispatchEvent(CustomEvent)` -> Zustand 事件或直接 store 调用
- [ ] I13: **[P2]** `TodoItem.tsx` `window.addEventListener('resize')` -> ResizeObserver 或响应式 CSS

#### App Store 审核合规（P1-P2）
- [ ] I14: **[P1]** 添加离线检测 + 离线提示 UI（断网不白屏）
- [ ] I15: **[P1]** 实现 App 内账号删除功能（设置页"删除账号"按钮 + Supabase Auth deleteUser）
- [ ] I16: **[P1]** 创建隐私政策页面（App 内可访问 + URL 供 App Store Connect）
- [ ] I17: **[P2]** 添加骨架屏加载状态（替代无反馈加载）

#### 代码质量（P1，已有部分在 C13/F20 但未执行）
- [ ] I18: **[P1]** 清理 50+ 处裸露 `console.log/error`（含 11 处 `[DEBUG]` 日志），用 `import.meta.env.DEV &&` 保护
- [ ] I19: **[P2]** 跨 Store 调用（`useTodoStore` -> `useAnnotationStore.triggerAnnotation()`）改为通过 services 层协调

### Phase I 验收标准

1. Store 文件中不再直接 import `supabase`（I1 完成后）。
2. 所有 `hover:` 均有配套 `active:`（I4 完成后）。
3. `BrowserRouter` 已替换（I9 完成后）。
4. Zustand persist 不使用 localStorage（I10 完成后）。
5. `npx tsc --noEmit`、`npm run build` 通过。

### Phase I DoD（完成定义）

1. I1-I19 全部勾选完成或标记为不执行。
2. `npx tsc --noEmit` 通过。
3. `npm run build` 通过。
4. 冒烟验证通过（`/chat`、`/todo`、`/report` 关键路径可用）。

## 5. 每阶段统一验证清单

1. `npx tsc --noEmit`
2. `npm run build`
3. 手测：
   - `/chat` 发送消息/渲染
   - `/todo` 增删改查
   - `/report` 报告查看与切换

## 6. 交接协议（必须执行）

1. 每次提交只做一个主题（安全清理 / 文档 / 单模块拆分）。
2. 提交说明必须包含：变更范围、风险、回滚点、验证结果。
3. 每次结束必须更新本文件第 8 节“交接日志”。
4. 如发现与本计划冲突的历史改动，先记录再继续，不直接覆盖他人改动。
5. 禁止删除或改名 `docs/CODE_CLEANUP_HANDOVER_PLAN.md`；新增报告必须合并回本文件。

## 7. 按 PR 拆分执行清单（可独立回滚）

### PR-00 文档基线（当前 PR）

1. 范围：固化主文档规则，补齐分阶段计划和 PR 执行清单。
2. 涉及文件：`docs/CODE_CLEANUP_HANDOVER_PLAN.md`。
3. 验收：文档规则明确、清单可执行、交接日志可追溯。
4. 回滚点：回退当前 PR 提交（`git revert <commit>`）。

### PR-01 安全摸底与引用审计（只读审计）

1. 范围：扫描密钥、扫描遗留 AI 直连文件引用、输出审计结论。
2. 涉及文件：文档为主（必要时更新本文件与 `SECURITY_FIX.md`）。
3. 验收：
   - 明确 `src/services/aiService.ts`、`src/api/qwen.ts` 是否被引用
   - 明确删除前影响面
4. 回滚点：仅文档变更，直接回退 PR。

### PR-02 安全清理（删除遗留直连）

1. 范围：删除或下线 `src/services/aiService.ts`、`src/api/qwen.ts`，统一走 `src/api/client.ts -> api/*`。
2. 涉及文件：`src/services/aiService.ts`、`src/api/qwen.ts`、相关 import 调整。
3. 验收：
   - `rg -n "sk-|cpk_|Bearer" . --glob '!node_modules/**' --glob '!dist/**'` 无命中
   - `npx tsc --noEmit` 通过
   - `npm run build` 通过
4. 回滚点：若有回归，仅回退本 PR。

### PR-03 低风险清理（临时文件/占位目录）

1. 范围：删除临时文件与无效占位内容（分批进行）。
2. 涉及文件：
   - `src/i18n/locales/en.ts.temp`
   - 空目录/占位目录：`src/assets`, `src/styles`, `src/layouts`
   - 占位 README：`src/api`, `src/components`, `src/pages`, `src/store`, `src/styles`, `src/types`, `src/layouts`
   - 根目录残留评估：`TO-DO.json`, `YOUWARE.md`, `SECURITY_FIX.md`, `scripts/test-minmax.ts`
3. 验收：
   - 构建与类型检查通过
   - 无 import 断链
4. 回滚点：如误删依赖，回退本 PR 后重新分批提交。

### PR-04 目录归一（低到中风险）

1. 范围：`pages -> features` 收敛、`utils -> lib` 收敛、路径修复。
2. 涉及文件：`src/pages/AuthPage.tsx` 迁移与所有相关 import。
3. 验收：
   - 路由正常
   - `/auth`, `/chat`, `/todo`, `/report` 可访问
   - `lib/utils.ts` 先按职责拆分，不做无依据重命名
4. 回滚点：回退本 PR，不影响其他阶段。

### PR-05 地图文档落地

1. 范围：新增并维护 `docs/PROJECT_MAP.md`，沉淀目录职责/边界/入口。
2. 验收：新人可按地图在 30 分钟内定位核心模块。
3. 回滚点：仅文档变更，直接回退。

### PR-06 ChatPage 拆分

1. 范围：`ChatPage.tsx` 拆为容器 + 子组件 + hooks。
2. 验收：
   - `ChatPage.tsx` 行数降到阶段阈值内
   - 行为与 UI 不回归
3. 回滚点：仅回退本 PR（不与 store 拆分捆绑）。

### PR-07 useChatStore 拆分

1. 范围：提取 `chatActions.ts`、`chatHelpers.ts`，收敛巨型 action。
2. 验收：
   - store 行数降到阶段阈值内
   - 聊天/记录/插入/编辑流程通过
3. 回滚点：仅回退本 PR。

### PR-08 Report 模块拆分 + Store 深度优化

已基于 C.5 深度代码审计拆分为以下子 PR：

#### PR-08A: 提取 `reportHelpers.ts`（P0）

1. 范围：从 `useReportStore.ts` 提取以下纯函数到 `src/store/reportHelpers.ts`：
   - `getDateRange(type, date, customEndDate)` — 合并 3 处重复的日期范围计算
   - `filterActivities(messages, start, end)` — 合并 3 处重复的活动过滤
   - `filterRelevantTodos(todos, start, end, type)` — 合并 2 处重复的 Todo 过滤
   - `classifyActivities(records)` — 提取 60 行中文关键词分类器
   - `computeMoodDistribution(messages, moodStore, start, end)` — 心情分布计算
   - `generateActionSummary(analysis)` — 行动总结模板
   - `generateMoodSummary(distribution)` — 心情简评模板
2. `useReportStore.ts` 的 `generateReport`、`triggerAIAnalysis`、`generateTimeshineDiary` 改为调用 helpers。
3. 验收：store 减少 ~200 行，周报/月报/日报流程不回归。
4. 回滚点：回退本子 PR。

#### PR-08B: 拆分 `ReportPage.tsx` 子组件（P1）

1. 范围：将 `ReportPage.tsx`（633 行）拆分为：
   - `src/features/report/ActivityRecordsView.tsx`（L17–L63）
   - `src/features/report/MoodPieChart.tsx`（L75–L160）
   - `src/features/report/ReportStatsView.tsx`（L162–L260）
   - `src/features/report/ReportDetailModal.tsx`
   - `src/features/report/TaskListModal.tsx`
2. `ReportPage.tsx` 主文件从 633 行降至 ~200 行。
3. 验收：日报详情、心情饼图、任务列表弹窗正常渲染。
4. 回滚点：回退本子 PR。

#### PR-08C: 拆分 `chatActions.ts`（P0）

1. 范围：从 `useChatStore.ts` 的 `sendMessage`（170 行）提取到 `src/store/chatActions.ts`：
   - `closePreviousActivity(messages, now)` — 关闭上一活动 + 更新 duration
   - `persistMessageToSupabase(message, session)` — 消息持久化
   - `triggerMoodDetection(messageId, content)` — 心情检测 + 分类器 API
   - `handleAIChatResponse(messages, session)` — AI 聊天响应
2. 同时修复 `sendMood` 缺失 `ChatState` 接口声明。
3. 验收：store 减少 ~120 行，聊天/记录/AI 对话流程不回归。
4. 回滚点：回退本子 PR。

#### PR-08D: Supabase session 统一 + 杂项优化（P1/P2）

1. 范围：
   - 新建 `src/lib/supabase-utils.ts`（`withSession()` 封装）
   - 修复硬编码中文 → i18n（ChatPage ~10 处, ReportPage ~3 处, AuthPage ~4 处）
   - 提取共享 `catMap` → `lib/todoHelpers.ts`
   - 移动跨天日报生成逻辑从 ChatPage → App.tsx
2. 验收：构建通过，所有页面中文/英文/意文 UI 正常显示。
3. 回滚点：回退本子 PR。

### PR-09 文档同构收口

1. 范围：重写 `README.md`、`ARCHITECTURE.md`、`FEATURE_STATUS.md`、新增 `CHANGELOG.md`，完成与代码同构。
2. 验收：文档内容与实际代码一致，旧信息迁移至 `docs/archive/` 并有迁移说明。
3. 回滚点：仅回退文档 PR，不影响代码功能。

### PR-10 规范化收口

1. 范围：新建 `CONTRIBUTING.md`，组件目录按职责分组，配置 `max-lines` 规则。
2. 验收：
   - 规范文档可指导新增提交
   - 分组后路径可读性提升且不破坏现有功能
   - 规则可执行且不造成大面积误报
3. 回滚点：拆分为 `PR-10A/10B/10C` 独立回退。

### PR-11 审计修复批次（2026-03-04 报告对齐）

1. 范围：按 Phase F 执行审计修复（F1-F18），并显式排除 F19/F20（用户自行执行）。
2. 推荐拆分：
   - PR-11A（P0）：`client.ts` 死代码清理 + `sendMessage` 空分支收口（F1/F2）
   - PR-11B（P1）：日期口径、语言口径、消息持久化一致性（F3/F4/F5/F6）
   - PR-11C（P1）：API Client 复用封装 + ChatPage selector 收口（F7/F8）
   - PR-11D（P2）：setTimeout 竞态、死代码与 store 性能修正（F9-F16）
   - PR-11E（P3）：DB 映射同构 + MoodOption i18n 深改（F17/F18）
3. 验收：`npx tsc --noEmit`、`npm run build`、`/chat /todo /report` 冒烟测试通过。
4. 回滚点：按子 PR 独立回退，避免跨主题连带回滚。

### PR-12 审计后续（2026-03-06 报告对齐）

1. 范围：按 Phase H 执行审计后续（H1-H8）。
2. 推荐拆分：
   - PR-12A（已完成）：Hook 基础设施（H1/H2/H3/H4）— `check-secrets.mjs`, `pre-commit.mjs`, `install-hooks.mjs`, `LLM.md` 升级
   - PR-12B（P1）：拆分 `api/annotation.ts`（H5）
   - PR-12C（P1）：`useChatStore.ts` 瘦身（H6）
   - PR-12D（P2）：依赖清理 `cannon-es`/`matter-js`/`three`（H7）
   - PR-12E（P3，可选）：commit-msg hook（H8）
3. 验收：`npm run lint:all`、`npm run build`、冒烟测试通过。
4. 回滚点：按子 PR 独立回退。

### PR-13 iOS 上架合规改造（2026-03-07 TSHINE_DEV_SPEC 审计对齐）

1. 范围：按 Phase I 执行上架合规改造（I1-I19）。
2. 推荐拆分（建议与功能大改同步执行）：
   - PR-13A（P0）：分层架构 -- 创建 `api/repositories/` + `services/`，将 Supabase 调用从 Store 移出（I1/I2/I3）
   - PR-13B（P0）：Capacitor 核心 -- `BrowserRouter` -> `MemoryRouter` + `storageService.ts`（I9/I10）
   - PR-13C（P0/P1）：移动端 UI -- 46 处 `hover:` + `active:` + 安全区域 + `user-select: none`（I4/I5/I6/I7/I8）
   - PR-13D（P1）：App Store 合规 -- 离线检测 + 账号删除 + 隐私政策（I14/I15/I16）
   - PR-13E（P1）：Web->Capacitor API -- `visibilitychange` + `CustomEvent` + `resize`（I11/I12/I13）
   - PR-13F（P1/P2）：代码质量 -- console.log 清理 + 骨架屏 + 跨 Store 解耦（I17/I18/I19）
3. 验收：`npx tsc --noEmit`、`npm run build`、冒烟测试通过、Store 中不直接 import supabase。
4. 回滚点：按子 PR 独立回退。

## 8. 交接日志（持续追加）

### 2026-03-03

- 已完成:
  1. 建立《代码整理交接计划》文档。
  2. 确认 `.env.example` 已存在。
  3. 确认本轮暂不接入 Hook 拦截。
  4. 已将 `import requests.py` 中硬编码 Key 改为读取 `CHUTES_API_KEY`。
  5. 已将 `scripts/test-annotation.js` 中硬编码 Key 改为读取 `CHUTES_API_KEY`。
- 已回滚:
  1. 已回滚 `src/services/aiService.ts`（尝试改为 `/api/chat` 后因编码污染回滚）。
  2. 已回滚 `src/store/useStardustStore.ts`（尝试移除硬编码 Bearer 后因编码污染回滚）。
  3. 已回滚 `src/api/qwen.ts`（尝试改 env 后因编码污染回滚）。
  4. 已回滚 `SECURITY_FIX.md` 到原始状态（避免乱码文档继续传播）。
- 下一步建议执行人:
  1. 以 UTF-8 安全方式重新执行 A1/A2/A4（优先用编辑器原生保存，不走本地代码页转码）。
  2. 再执行一次 `npx tsc --noEmit` 与 `npm run build`。
  3. 推进 Phase B（文档同构）。
- 阻塞项:
  1. 编码风险：含大量中文的大文件若用错误编码读写会被污染。
  2. 目录调整若跨模块批量迁移，存在导入路径回归风险；需按模块小步推进。

- 本次文档补充:
  1. 已合并“目录治理与地图（Phase D）”计划。
  2. 已把目录治理任务并入统一任务看板（D1-D6）。
  3. 已固化“第一步：主交接文档不可删除/改名，新增报告必须回并本文件”规则。
  4. 已新增“按 PR 拆分执行清单（PR-00 ~ PR-09）”，用于独立回滚管理。
  5. 已补充：删除 `aiService.ts/qwen.ts` 前必须先做引用扫描。
  6. 已补充：`lib/utils.ts` 先按职责拆分再命名，不直接改成 `textProcessor.ts`。
  7. 已补充：过时文档迁移至 `docs/archive/`，不一刀切删除。
  8. 已补充：Phase A/B/C/D 均有 DoD（`tsc`、`build`、关键页面冒烟）。
  9. 已补充：外部结构审计报告对齐状态与归档路径。
  10. 已补充：报告中点名清理项（`en.ts.temp`、空目录、占位 README、根目录残留文件）已纳入任务看板。
  11. 已补充：`CHANGELOG.md`、`CONTRIBUTING.md`、`max-lines` 规则纳入执行清单。

### 2026-03-03 (续) — PR-01 / PR-02 / PR-03 执行

#### PR-01 安全摸底与引用审计（只读）

- 扫描结论：
  - `src/api/qwen.ts`：含明文 `sk-` Key；**零引用**（无任何文件 import），可安全删除。
  - `src/services/aiService.ts`：含明文 `cpk_` Key；**零引用**，可安全删除。
  - `src/store/useStardustStore.ts:L125`：含明文 `cpk_` Bearer，直连 Chutes API；需迁移到 serverless。
  - `src/api/client.ts`：无明文密钥，调用模式正确（转发至 `api/*` serverless）。
- 扫描命令：PowerShell `Select-String` 扫描 `cpk_|sk-|Bearer`。
- 影响面：删除 `qwen.ts/aiService.ts` 无连锁影响；`useStardustStore` 需同步改造。

#### PR-02 安全清理（已完成） ✅

- 变更范围：
  1. 新增 `api/stardust.ts` — Vercel Serverless Emoji 生成接口，使用 `process.env.CHUTES_API_KEY`。
  2. `src/api/client.ts` — 新增 `callStardustAPI()` 函数，路由至 `/api/stardust`。
  3. `src/store/useStardustStore.ts` — 移除 60 行直连 Chutes API 代码（含明文 `cpk_` Key），改为调用 `callStardustAPI()`；新增 `import { callStardustAPI }`。
  4. 删除 `src/services/aiService.ts`（含明文 `cpk_` Key，零引用）。
  5. 删除 `src/api/qwen.ts`（含明文 `sk-` Key，零引用）。
- 验收结果：
  - `src/` 目录 `sk-|cpk_` 零残留 ✓
  - `npx tsc --noEmit` 通过，零错误 ✓
  - `npm run build` 通过（11.95s）✓
- 风险回滚点：`git revert PR-02 commit`，不影响 PR-03。

#### PR-03 低风险清理（已完成） ✅

- 变更范围：
  1. 删除 `src/i18n/locales/en.ts.temp`（临时文件）。
  2. 删除占位 README：`src/api/`, `src/components/`, `src/pages/`, `src/store/`, `src/styles/`, `src/types/`, `src/layouts/`。
  3. 删除空目录：`src/assets/`, `src/styles/`, `src/layouts/`。
  4. 删除 `scripts/test-minmax.ts`（调试脚本残留）。
  5. 保留评估（留到 Phase B 一并处理）：`TO-DO.json`, `YOUWARE.md`（内容过时但无代码依赖）, `SECURITY_FIX.md`。
- 验收结果：
  - `npx tsc --noEmit` 通过，零错误 ✓
  - 无 import 断链 ✓
- 风险：本 PR 仅文档/目录变更，无运行时影响。

#### 任务看板同步

以下项已完成：
- [x] A1: 移除 `aiService.ts` 明文密钥（已删除文件）
- [x] A2: 处理 `qwen.ts`（已删除文件）
- [x] A4: 清理 `useStardustStore.ts` 中硬编码 Bearer（已迁移到 serverless）
- [x] D7: 清理 `src/i18n/locales/en.ts.temp`
- [x] D8: 清理空目录与占位目录（`src/assets`, `src/styles`, `src/layouts`）
- [x] D5: 清理占位目录 README（已删除 7 个）

下一步建议：
1. 手测关键页面（`/chat`, `/todo`, `/report`）确认无功能回归。
2. 推进 PR-04（目录归一：`pages → features` 收敛、`utils → lib` 合并）。
3. 推进 PR-05（`docs/PROJECT_MAP.md` 地图文档）。

#### PR-04 目录归一（已完成） ✅

- 变更范围：
  1. 将 `src/pages/AuthPage.tsx` 迁移至 `src/features/auth/AuthPage.tsx`，并更新所有引入。
  2. 彻底删除空的 `src/pages` 目录。
  3. 将 `src/utils/reportCalculator.ts` 迁移至 `src/lib/reportCalculator.ts`，并删除了空的 `src/utils` 目录。
  4. 拆解 `src/lib/utils.ts` 中的 AI 格式化及提取函数至 `src/lib/aiParser.ts`，时间转换逻辑至 `src/lib/time.ts`。
- 验收结果：
  - `npx tsc --noEmit` 修复无误通过 ✓
  - `npm run build` 处理了全部衍生路径依赖问题，顺利构建成功 ✓

#### PR-05 地图文档落地（已完成） ✅

- 变更范围：
  1. 新增 `docs/PROJECT_MAP.md`，定义架构地图。
  2. 收口规范了目标分层的定义 `/api`, `/docs`, `/src/features`, `/src/shared` 等核心边界。

#### 更新任务看板状态
- [x] D1: 新建 `docs/PROJECT_MAP.md`
- [x] D2: 统一页面入口策略


#### PR-06 ChatPage 拆分（已完成） ✅

- 变更范围：
  1. 新建 `MessageItem.tsx` — 单条消息展示组件（心情模式 + 活动模式）。
  2. 新建 `MoodPickerModal.tsx` — 心情选择弹窗组件。
  3. 新建 `EditInsertModal.tsx` — 编辑/插入活动弹窗组件。
  4. 新建 `ChatInputBar.tsx` — 底部输入栏组件。
  5. `ChatPage.tsx` 缩减到宾容器组件，保留状态/effects/handlers。
- 验收结果：`npx tsc --noEmit` ✔，`npm run build` ✔

#### PR-07 useChatStore 拆分（已完成） ✅

- 变更范围：
  1. 新建 `src/store/chatHelpers.ts`，提取纯函数：`getLocalDateString`、`mapDbRowToMessage`、`buildChatApiMessages`、`getAiErrorText`。
  2. `useChatStore.ts` 移除重复/内联逻辑，改为引用 helpers。
- 验收结果：`npx tsc --noEmit` ✔，`npm run build` ✔

下一步建议： 手测关键页面（`/chat`, `/todo`, `/report`），然后推进 PR-08（Report 模块拆分）或 PR-09（文档同构）。

### 2026-03-03 (续) — C.5 深度代码审计

#### 变更来源

- 报告名称: 核心 Feature & Store 代码审计报告
- 日期: 2026-03-03
- 范围: 全部 4 个 Feature 页面 + 全部 7 个 Store 文件 + 2 个 Helper 文件

#### 决策结论

- 采纳全部 P0（2 项）和 P1（5 项）优化建议
- P2（5 项）标记为后续批次
- 审计发现 14 个问题点，按严重程度 P0/P1/P2 分级

#### 任务看板变化

新增任务 C6–C16（详见第 4 节任务看板），其中：
- C6, C7 为 P0，对应 PR-08A、PR-08C
- C8–C11 为 P1，对应 PR-08D
- C12–C16 为 P2，暂不排入 PR 计划

#### 风险与回滚点

1. `reportHelpers.ts` 提取需确保分类器关键词列表完整迁移，错误会导致日报行动分析数据为空。
2. `sendMessage` 拆分涉及乐观更新逻辑，需保证异步时序不变。
3. i18n 硬编码修复需同步更新 `zh.ts`、`en.ts`、`it.ts` 三份翻译文件，遗漏会导致 key 显示 raw string。
4. 跨天日报逻辑移到 App.tsx 需确认 `useReportStore.getState()` 在路由未加载时可正常调用。

### 2026-03-03 (续) — 部署阻塞修复 + 轻量优化（未做大拆分）

#### 变更来源

- 来源: 本地构建复核 + Vercel 报错复盘（`Could not resolve "./MessageItem" from "src/features/chat/ChatPage.tsx"`）

#### 决策结论

- 本轮不执行 C3/C4/C6/C7 大拆分，仅先解决部署阻塞与低风险代码问题。
- 结构拆分任务保持原计划，不提前标记完成。

#### 代码与配置变更

1. 修复 Vercel 构建失败根因：
   - 原因: `.gitignore` 误配置 `chat/`，导致 `src/features/chat/*.tsx` 子组件未被 Git 跟踪，云端构建缺失文件。
   - 处理: 删除 `.gitignore` 中 `chat/` 忽略规则。
2. 修复 `ChatPage` 事件监听清理缺陷：
   - 文件: `src/features/chat/ChatPage.tsx`
   - 原问题: `addEventListener` 使用匿名函数，`removeEventListener` 却传 `gen as any`，清理对象不一致。
   - 处理: 改为命名函数 `handleVisibilityChange`，确保 add/remove 对称。

#### 当前行数复核（实测）

- `src/store/useChatStore.ts`: 614
- `src/features/chat/ChatPage.tsx`: 480
- `src/store/useReportStore.ts`: 684
- `src/features/report/ReportPage.tsx`: 633
- `src/features/todo/TodoPage.tsx`: 471
- `src/store/chatHelpers.ts`: 67

结论: 与 C.5 审计结论基本一致，说明核心拆分任务（C3/C4/C6/C7）仍待落地。

#### 验证结果

- `npx tsc --noEmit` 通过 ✓
- `npm run build` 通过 ✓

#### 风险与回滚点

1. 若需回滚部署修复，可恢复 `.gitignore` 对应行（不建议，会再次导致云端缺文件）。
2. `ChatPage` 仅修改监听器清理方式，属于低风险行为一致性修复。

#### 今日执行总结（同步）

1. 已完成（部署恢复直接相关）：
   - 清除 `.gitignore` 的 `chat/` 误忽略规则，确保 `ChatInputBar.tsx`、`EditInsertModal.tsx`、`MessageItem.tsx`、`MoodPickerModal.tsx` 可被 Git 跟踪并进入云端构建。
   - 修复 `ChatPage` 跨天日报 `visibilitychange` 监听器清理不对称问题，移除 `gen as any` 用法，避免潜在监听泄漏。
2. 已完成（小范围逻辑修正，非大拆分）：
   - `useChatStore.ts`：补齐 `sendMood` 的接口声明；AI 响应分支条件改为 `effectiveMode === 'chat'`。
   - `useReportStore.ts`：报告活动统计过滤增加 `!m.isMood`，避免将心情消息误计入活动记录。
3. 明确未完成（保持原计划）：
   - C3/C4/C6/C7（ReportPage/useReportStore/useChatStore 大体量拆分）尚未执行，状态不变。
4. 本轮目标达成判断：
   - 已解除 Vercel 当前构建阻塞点；在不做大拆分前提下完成了低风险优化与可部署修复。

### 2026-03-03 (续) — PR-08A / PR-08C 首轮落地（P0）

#### 变更来源

- 来源: 当日执行计划（优先推进 C6/C7），目标先完成 Report 与 Chat 的 P0 拆分，不做一次性大爆炸重构。

#### 决策结论

- 采纳并落地 C6（PR-08A）与 C7（PR-08C）第一批改造。
- 保持“行为不变优先”，先抽取复用逻辑并通过 `tsc` + `build`，再做体验层优化。

#### 代码变更范围

1. 新增 `src/store/reportHelpers.ts`：
   - `getDateRange()`
   - `filterActivities()`
   - `filterRelevantTodos()`
   - `classifyActivities()`
   - `computeMoodDistribution()`
   - `generateActionSummary()`
   - `generateMoodSummary()`
2. 重构 `src/store/useReportStore.ts`：
   - `generateReport`、`triggerAIAnalysis`、`generateTimeshineDiary` 改为调用 helper，移除重复的时间范围/过滤/分类逻辑。
3. 新增 `src/store/chatActions.ts`：
   - `closePreviousActivity()`
   - `persistMessageToSupabase()`
   - `triggerMoodDetection()`
   - `handleAIChatResponse()`
4. 重构 `src/store/useChatStore.ts`：
   - `sendMessage` 改为编排式调用 `chatActions`，缩减内联逻辑。

#### 验证结果

- `npx tsc --noEmit` 通过 ✓
- `npm run build` 通过 ✓

#### 任务看板变化

- [x] C6 完成（`reportHelpers.ts` 已提取并接入）
- [x] C7 完成（`chatActions.ts` 已提取并接入）

#### 风险与回滚点

1. 当前日报“行为分析/心情拼图”仍沿用原有触发条件（非当天、记录需有 duration）；对“今天实时可见”的体验尚未优化。
2. 若本批拆分出现回归，回滚点为 PR-08A 或 PR-08C 对应提交，按子 PR 独立回退。

### 2026-03-03 (续) — C3 + C4 收口（Report 页面与 Store 同步优化）

#### 变更来源

- 来源: 当日执行调整（先做 C4，再统一回写 cleanup 主文档），目标减少 Report 模块内联逻辑与跨层耦合。

#### 决策结论

- 采纳“先优化后拆分”的执行策略：在不改变行为前提下，完成 `ReportPage.tsx` 与 `useReportStore.ts` 双侧收口。
- C3 与 C4 同步标记完成，后续优先推进 C5 或 C8。

#### 代码变更范围

1. C3（页面层）
   - 新增 `src/features/report/reportPageHelpers.ts`（时间范围、日报心情分布、任务筛选）。
   - 新增 `ActivityRecordsView.tsx`、`MoodPieChart.tsx`、`ReportStatsView.tsx`、`ReportDetailModal.tsx`、`TaskListModal.tsx`。
   - `src/features/report/ReportPage.tsx` 由 633 行收敛至 170 行，保留容器编排职责。
2. C4（Store 层）
   - 新增 `src/store/reportActions.ts`，提取 `createGeneratedReport`、`runReportAIAnalysis`、`runTimeshineDiary`、`syncReportToSupabase`。
   - `src/store/useReportStore.ts` 改为编排式调用 actions，移除长函数内联流程。

#### 验证结果

- `npx tsc --noEmit` 通过 ✓
- `npm run build` 通过 ✓

#### 任务看板变化

- [x] C3 完成（ReportPage 拆分 + 页面逻辑收口）
- [x] C4 完成（useReportStore 拆分 + reportActions 接入）

#### 风险与回滚点

1. `runTimeshineDiary` 仍依赖分类器/日记 API 的稳定性，若远端波动会进入 `analysisStatus: error`。
2. 若出现回归，可独立回退 `src/features/report/*`（C3）或 `src/store/reportActions.ts` + `src/store/useReportStore.ts`（C4）。

### 2026-03-03 (续) — C5 收口 + Todo 低风险优化

#### 变更来源

- 来源: cleanup 主线延续（C5 未完成项）+ C.5 审计中 Todo 相关建议（C10/C15）。

#### 决策结论

- 采纳“先拆页面，再收口重复逻辑”的策略：同批完成 C5、C10、C15。
- 同步清理 Todo 范围内已确认死代码（`checkDueDates` 空壳调用链）。

#### 代码变更范围

1. C5（页面拆分）
   - 新增 `src/features/todo/TodoItem.tsx`（单项展示与交互）。
   - 新增 `src/features/todo/TodoEditorModal.tsx`（新增/编辑弹窗）。
   - 新增 `src/features/todo/todoPageHelpers.ts`（筛选/排序/优先级展示逻辑）。
   - `src/features/todo/TodoPage.tsx` 由 471 行收敛至 187 行，保留容器编排职责。
2. C10（重复逻辑提取）
   - 新增 `src/lib/todoHelpers.ts`，提取 `getCategoryLabel()`，消除 TodoPage 与 TodoItem 的重复 `catMap`。
3. C15（字段映射统一）
   - `src/store/useTodoStore.ts` 新增 `toDbTodoUpdates()` + `TODO_DB_FIELD_MAP`，统一 Todo 更新字段（camelCase → snake_case）映射。
   - 移除 `updateTodo` 内联映射与删除字段逻辑，避免遗漏字段风险。
4. 死代码清理（Todo 范围）
   - 删除 `checkDueDates` 空实现与页面调用链。
   - 清理 `useTodoStore.ts` 中未使用的 `date-fns` 导入。

#### 验证结果

- `npx tsc --noEmit` 通过 ✓
- `npm run build` 通过 ✓

#### 任务看板变化

- [x] C5 完成（TodoPage 拆分 + 页面逻辑收口）
- [x] C10 完成（`catMap` 提取到 `lib/todoHelpers.ts`）
- [x] C15 完成（Todo 字段映射统一）

#### 风险与回滚点

1. Todo 交互路径（开始计时 → 跳转 chat）保持原顺序，若出现回归可仅回退 `src/features/todo/*`。
2. `toDbTodoUpdates()` 将显式 `undefined` 映射为 `null`，可修复 `completedAt` 清空不同步；若后端约束变化可仅回退 `useTodoStore.ts` 对应提交。

### 2026-03-03 (续) — C8 收口（Supabase session 统一封装）

#### 变更来源

- 来源: cleanup 主线 C8（P1），收敛 store/action 层重复 `supabase.auth.getSession()` 模式。

#### 决策结论

- 采纳“先封装、后替换、行为不变”的策略：新增统一 helper，并在所有 store/action 中替换重复 session 获取。
- 本轮不夹带 C9/C11，保持单主题提交可独立回滚。

#### 代码变更范围

1. 新增 `src/lib/supabase-utils.ts`：
   - `getSupabaseSession()`
   - `getSessionUserId()`
   - `withSession()`
2. 替换以下文件中的重复会话获取逻辑：
   - `src/store/useTodoStore.ts`
   - `src/store/useReportStore.ts`
   - `src/store/reportActions.ts`
   - `src/store/useChatStore.ts`
   - `src/store/chatActions.ts`
   - `src/store/useStardustStore.ts`
   - `src/store/useAnnotationStore.ts`
   - `src/store/useAuthStore.ts`
3. 兼容性说明：
   - 保留原有无会话分支行为（如 `fetchMessages` 的 `hasInitialized` 回写）。
   - `useAnnotationStore` 的 `sessionData.session` 旧判空分支已统一为 helper 判空，不改业务语义。

#### 验证结果

- `npx tsc --noEmit` 通过 ✓
- `npm run build` 通过 ✓（保留既有 chunk size warning，不影响构建成功）

#### 任务看板变化

- [x] C8 完成（Supabase session 统一封装并完成全量替换）

#### 风险与回滚点

1. 主要风险为会话判空分支遗漏；本次已按原逻辑逐处保留。
2. 若出现回归，可仅回退 `src/lib/supabase-utils.ts` + 8 个 store/action 文件对应提交，其他阶段任务不受影响。

### 2026-03-03 (续) — C11 + C9 收口（跨天日报迁移 + i18n 硬编码修复）

#### 变更来源

- 来源: cleanup 主线待办（C11、C9），按“先低风险职责迁移，再做多语言收口”顺序执行。

#### 决策结论

- 先完成 C11：将跨天自动生成前一日日报逻辑从 `ChatPage` 迁移到 `App/MainLayout`，避免页面职责错位。
- 同批完成 C9：将 Chat/Auth/Report 及相关组件中的用户可见硬编码中文收敛到 i18n key，并补齐 `zh/en/it` 词条。

#### 代码变更范围

1. C11（跨天日报迁移）
   - `src/App.tsx`
     - 新增跨天日报定时检查逻辑（60s interval + `visibilitychange`）。
     - 增加登录态保护（仅 `user?.id` 存在时执行）。
   - `src/features/chat/ChatPage.tsx`
     - 删除跨天自动生成前一日日报的 `useEffect`。
2. C9（硬编码中文 → i18n）
   - 页面与核心文件：
     - `src/features/chat/ChatPage.tsx`
     - `src/features/auth/AuthPage.tsx`
     - `src/features/report/ReportPage.tsx`
     - `src/store/useReportStore.ts`
   - 同步收口相关组件：
     - `src/features/chat/MoodPickerModal.tsx`
     - `src/features/chat/MessageItem.tsx`
     - `src/features/report/ReportDetailModal.tsx`
     - `src/features/report/MoodPieChart.tsx`
   - 多语言词条补齐：
     - `src/i18n/locales/zh.ts`
     - `src/i18n/locales/en.ts`
     - `src/i18n/locales/it.ts`

#### 验证结果

- `npx tsc --noEmit` 通过 ✓
- `npm run build` 通过 ✓（保留既有 chunk size warning，不影响构建成功）

#### 任务看板变化

- [x] C11 完成（跨天日报生成逻辑迁移到 App 层）
- [x] C9 完成（核心页面 + 关联组件硬编码中文收口到 i18n）

#### 风险与回滚点

1. 跨天逻辑迁移后，主要风险为触发时机变化；当前保留原有“跨天才生成前一日”判定，并加登录态保护。
2. i18n 收口风险为 key 遗漏导致 raw key 展示；本次已同步补齐 `zh/en/it`。若回归，可先局部回退对应页面或 locale 提交。

#### 手测冒烟清单回填（/chat /report /auth）

- 自动化可验证项（已完成）
  1. `npx tsc --noEmit` 通过。
  2. `npm run build` 通过（含既有 chunk warning，不阻塞）。
- 交互手测项（需在浏览器人工点击确认）
  1. `/chat`
     - 语言切换后检查：加载更多文案、最早记录提示、昨日摘要、新日空态文案是否同步变化。
     - 心情标签弹窗检查：自定义标签默认文案、心情记录输入 placeholder、活动项操作按钮 tooltip 文案。
  2. `/report`
     - 日历星期缩写应随语言切换（`zh/en/it`）。
     - 报告详情弹窗检查：关闭按钮 aria-label、今日心情光谱标题与心情标签文案。
  3. `/auth`
     - 非法账号输入报错为 i18n 文案。
     - 头像弹窗按钮（选择头像/关闭/更多/更换头像）文案随语言切换。
- 结果记录
  - 当前 CLI 环境无法进行浏览器点击交互；上述手测项已回填为执行清单，待本机人工确认后可在本节补记“通过/失败 + 复现路径”。

### 2026-03-03 (续) — C14 收口 + 报告标题 i18n 补丁

#### 变更来源

- 来源: cleanup 主线剩余项 C14（P2）+ 用户反馈“报告详情标题仍显示中文‘日报’”。

#### 决策结论

- 采纳“先完成 C14，再做单点 UI 文案补丁”的顺序，不夹带 C12/C13。
- C12 维持测试阶段 100% 触发，不做改动。

#### 代码变更范围

1. C14（MoodStore 数据收口）
   - `src/store/useMoodStore.ts`
   - 新增 `MAX_MOOD_ENTRIES = 500` 上限。
   - 新增 `pruneMoodRecordMaps()`，对 `activityMood`、`customMoodLabel`、`customMoodApplied`、`moodNote` 四类按 `messageId` 的本地映射执行统一裁剪。
   - 在 `setMood` / `setCustomMoodLabel` / `setCustomMoodApplied` / `setMoodNote` 写入路径接入裁剪，避免 localStorage 持续膨胀。
2. 报告标题 i18n 补丁（用户反馈修复）
   - `src/features/report/ReportDetailModal.tsx`：详情标题改为按 `report.type` + 日期动态拼接并走 i18n，不再直接显示历史 `selectedReport.title`。
   - `src/i18n/locales/zh.ts`、`src/i18n/locales/en.ts`、`src/i18n/locales/it.ts`：新增 `report_daily` 词条。

#### 验证结果

- `npx tsc --noEmit` 通过 ✓
- `npm run build` 通过 ✓（保留既有 chunk size warning，不影响构建成功）

#### 任务看板变化

- [x] C14 完成（MoodStore 数据清理策略已落地）
- [x] C16 完成（看板状态已与代码一致）

#### 风险与回滚点

1. C14 的裁剪策略为“按数量上限保留最近键集合”，主要影响极早历史 mood 映射，不影响消息主数据。
2. 报告标题改为动态 i18n 后，旧报告标题不再原样显示；若需回退可仅回退 `ReportDetailModal.tsx` 与新增 locale key 的提交。

### 2026-03-03 (续) — Phase B 文档同构收口（B1-B5）

#### 变更来源

- 来源: cleanup 主线 Phase B，按 B1 -> B2 -> B3 -> B4 -> B5 顺序逐项落地。

#### 决策结论

- 采纳“文档只描述真实实现”的原则，不再保留愿景型或已弃用模块叙述。
- 本批仅做文档同构，不夹带代码行为改动。

#### 代码/文档变更范围

1. `README.md`
   - 完整重写为当前项目真实说明：功能、运行方式、环境变量、目录、验证方式、已知事项。
2. `PROJECT_CONTEXT.md`
   - 新增全局上下文文档，沉淀产品定位、分层、数据流、风险与接手路径。
3. `FEATURE_STATUS.md`
   - 新增模块状态文档，按 Auth/Chat/Todo/Report/Annotation/Stardust/i18n/API 记录状态与入口。
4. `docs/ARCHITECTURE.md`
   - 重写为“真实架构版”，移除历史中未实现或已偏离现状的模块描述。
5. `docs/CHANGELOG.md`
   - 新增变更日志基线，并回填当日关键文档与收口事项。

#### 验证结果

- 文档文件存在性校验通过（B1-B5 均已创建/重写到位）
- 本批为文档同构，未引入运行时代码路径变更

#### 任务看板变化

- [x] B1 完成（根 README 重写）
- [x] B2 完成（新增 `PROJECT_CONTEXT.md`）
- [x] B3 完成（新增 `FEATURE_STATUS.md`）
- [x] B4 完成（重写 `docs/ARCHITECTURE.md`）
- [x] B5 完成（新增 `docs/CHANGELOG.md`）

#### 风险与回滚点

1. 风险主要为文档与实现漂移；后续每次 PR 合并后应持续按协议回填本文件与 changelog。
2. 回滚可按文档文件逐个回退，不影响运行时功能。

### 2026-03-04 — D3 + D6 + D9 + E1 收口（Windows 环境）

#### 变更来源

- 来源: cleanup 主线剩余任务（Phase D: D3/D6/D9，Phase E: E1）。

#### 决策结论

1. 采纳 D6：锁定单一包管理器为 `npm`，主锁文件为 `package-lock.json`。
2. 采纳 D9：处置根目录残留文件，删除过时文件并保留处置说明归档。
3. 采纳 D3：对前后端 API 分层边界做审计收口，确认前端通过 `src/api/client.ts` 调用 `api/*`。
4. 采纳 E1：补齐 `CONTRIBUTING.md` 作为贡献与回滚规范入口。

#### 代码/文档变更范围

1. D6（包管理器统一）
   - 删除 `pnpm-lock.yaml`。
   - 更新 `README.md`、`PROJECT_CONTEXT.md`、`DEPLOY.md` 为 npm 单一路径。
2. D9（根目录残留评估处置）
   - 删除 `TO-DO.json`、`YOUWARE.md`、`SECURITY_FIX.md`。
   - 新增归档说明：`docs/archive/2026-03-04-root-residual-disposition.md`。
   - `scripts/test-minmax.ts` 保持“此前已删除”状态。
3. D3（API 分层边界审计）
   - 审计 `src/api/client.ts` 与 `src/api/supabase.ts` 调用路径，确认前端未引入第三方 AI Key 直连模式。
4. E1（贡献规范）
   - 新增 `CONTRIBUTING.md`，包含提交流程、目录边界、验证与回滚约定。
   - `README.md` 增加贡献规范入口。

#### 验证结果

- `npx tsc --noEmit` 通过 ✓
- `npm run build` 通过 ✓
- API 分层抽查：`src/api/client.ts` 仅请求 `/api/*`，未发现 `src/**` 直连第三方 AI Key 路径。

#### 任务看板变化

- [x] D3 完成（前后端 API 分层边界审计通过）
- [x] D6 完成（npm 单包管理器策略落地）
- [x] D9 完成（根目录残留文件处置完成）
- [x] E1 完成（`CONTRIBUTING.md` 落地）

#### 风险与回滚点

1. 删除根目录历史文件后，若需追溯可从 git 历史恢复。
2. 若团队后续改用其他包管理器，需同步恢复锁文件策略与文档命令，避免二次漂移。

### 2026-03-04 (续) — 文档质量审校（`.gitignore` / `api/README.md` / `src/store/README.md`）

#### 变更来源

- 来源: 当日执行中发现仓库存在新增但未审校文件（`.gitignore`、`api/README.md`、`src/store/README.md`），按用户要求做质量复核并同步 cleanup。

#### 决策结论

1. 采纳：清理 `.gitignore` 重复规则并补齐 Vercel 本地产物忽略项。
2. 采纳：重写 `api/README.md`，以“与代码实现一致的响应结构”为准，移除过时示例。
3. 采纳：重写 `src/store/README.md`，保留稳定约束与最小自检项，降低文档漂移风险。

#### 代码/文档变更范围

1. `.gitignore`
   - 删除重复 `.env` 条目。
   - 新增 `.vercel/` 忽略规则。
2. `api/README.md`
   - 更新为当前 `api/*.ts` 实际端点和成功响应结构。
   - 明确前端必须通过 `src/api/client.ts` 调用。
3. `src/store/README.md`
   - 收敛为 store 列表、组织约定、代码约束、变更自检四部分。

#### 验证结果

- `npx tsc --noEmit` 通过 ✓
- `npm run build` 通过 ✓

#### 风险与回滚点

1. 本批为文档/忽略规则调整，无运行时代码路径变更。
2. 若后续 API 响应结构调整，需要同步更新 `api/README.md`，避免再次漂移。

### 2026-03-04 (续) — E2 + E3 + C12 收口（Windows 执行）

#### 变更来源

- 来源: 今日执行计划（优先 E3 文件规模约束、E2 组件目录分组，时间允许推进 C12）。

#### 决策结论

1. 采纳 E3：落地可执行的 `max-lines` 约束（400 告警 / 800 报错）。
2. 采纳 E2：将共享组件按职责分组到 `layout/feedback`，保持行为不变。
3. 采纳 C12：恢复批注触发概率逻辑，移除测试阶段 100% 触发。
4. 维持 C13 暂缓：调试日志暂不清理。

#### 代码变更范围

1. E3（文件规模约束）
   - `package.json` 新增脚本：`lint:max-lines`。
   - 新增 `scripts/check-max-lines.mjs`：扫描 `src/`、`api/` 下 `*.ts`/`*.tsx`，超过 400 行告警、超过 800 行报错并退出非零。
2. E2（组件目录分组）
   - 新目录：`src/components/layout/`、`src/components/feedback/`。
   - 迁移并修正导入：
     - `BottomNav.tsx`、`Header.tsx`、`LanguageSwitcher.tsx` -> `layout/`
     - `ErrorBoundary.tsx`、`AIAnnotationBubble.tsx`、`StardustAnimation.tsx`、`StardustCard.tsx`、`StardustEmoji.tsx` -> `feedback/`
   - 同步更新引用文件：`src/App.tsx`、`src/main.tsx`、`src/features/chat/ChatPage.tsx`、`src/features/chat/MessageItem.tsx`。
3. C12（概率逻辑恢复）
   - `src/store/annotationHelpers.ts`：恢复权重 + 随机触发逻辑。
   - 增加全局冷却与同类事件冷却常量，移除测试模式 `return true`。

#### 验证结果

- `npm run lint:max-lines` 通过 ✓（当前仅告警，无 >800 行报错）
- `npx tsc --noEmit` 通过 ✓
- `npm run build` 通过 ✓

#### 任务看板变化

- [x] C12 完成（概率触发逻辑恢复）
- [x] E2 完成（组件目录按职责分组）
- [x] E3 完成（max-lines 约束可执行）

#### 风险与回滚点

1. C12 恢复后批注触发频率将低于测试阶段，若需要回放高频验证可临时下调冷却值或回退 `annotationHelpers.ts`。
2. E2 属路径调整，若出现导入回归可独立回退 `src/components/*` 迁移与 `App/main/Chat` 引用变更。

### 2026-03-04 (续) — C12 测试回切（按当前联调需求）

#### 变更来源

- 来源: 当前联调阶段用户要求批注维持 100% 触发，便于连续验证。

#### 决策结论

1. 暂不收口 C12 到生产概率策略。
2. 维持测试模式 100% 触发，待联调结束后再切回概率+冷却逻辑。

#### 代码变更范围

1. `src/store/annotationHelpers.ts`
   - 增加 `FORCE_ANNOTATION_TRIGGER = true`。
   - 在 `shouldGenerateAnnotation` 开头强制返回 `true`，恢复测试阶段高频触发。

#### 验证结果

- `npx tsc --noEmit` 通过 ✓

#### 任务看板变化

- [ ] C12 保持未完成（测试阶段临时回切 100% 触发）

#### 风险与回滚点

1. 当前批注触发频率高于生产预期，可能放大通知密度与噪声。
2. 联调结束后将 `FORCE_ANNOTATION_TRIGGER` 关闭即可恢复概率策略。

### 2026-03-04 (续) — C12/C13 状态对齐（停止执行）

#### 变更来源

- 来源: 用户明确要求 C12、C13 暂不继续，后续由用户自行执行。

#### 决策结论

1. C12 从“暂缓联调观察”调整为“停止执行（本轮不做）”。
2. C13 从“暂缓清理”调整为“停止执行（本轮不做）”。
3. cleanup 主线后续排期默认排除 C12/C13。

#### 文档变更范围

1. 本文件任务看板中 C12/C13 状态统一改为“停止执行（后续由用户自行执行）”。
2. 同步对齐 `FEATURE_STATUS.md`、`PROJECT_CONTEXT.md`、`docs/ARCHITECTURE.md`、`docs/CHANGELOG.md` 的状态描述。

#### 验证结果

- 本批仅文档状态对齐，无代码行为变更。

#### 任务看板变化

- [ ] C12 停止执行（后续由用户自行执行）
- [ ] C13 停止执行（后续由用户自行执行）

#### 风险与回滚点

1. 风险为文档语义误读；已统一为“停止执行”口径降低歧义。
2. 回滚点为文档提交级回退，不影响运行时行为。

### 2026-03-04 (续) — 审计报告对齐更新（用户指定：日志与 C12 不改）

#### 变更来源

- 报告名称: `Tshine2-13-mainc 代码审计报告`
- 报告日期: 2026-03-04
- 审计范围: `src/` 全仓核心文件 + `api/` serverless functions
- 外部输入结论: 审计 `AB1-AB7`（原报告 B1-B7）、`R1-R5`、`Q1-Q6`、`P1-P3` 的优先级分层修复建议

#### 决策结论（采纳/部分采纳/不采纳）

1. **采纳（本轮纳入执行池）**
   - AB7: `client.ts` 恒等三元与死代码清理（F1）
   - AB6: `sendMessage` record 分支空逻辑注释收口（F2）
   - AB4: 批注系统 UTC/本地日期不一致修复（F3）
   - AB2: `triggerMoodDetection` 语言硬编码修复（F4）
   - AB5: `sendMood` 与 `persistMessageToSupabase` 持久化路径统一（F5）
   - R1 + Q5: `reportActions` 同日判断统一为 `isSameDay` + `isToday` 单次复用（F6）
   - R4: `client.ts` 6 个 API 调用模板提取（F7）
   - R5: `ChatPage` MoodStore selector 收敛（F8）
2. **采纳（本轮作为 P2/P3 后续批次）**
   - R2/R3: DB Row 映射函数同构（F17）
   - Q1: Emoji 提取实现统一与维护性优化（并入 F10/F12/F13）
   - Q3: `withSession()` 推广策略（F9）
   - Q6: MoodPicker 状态收敛（可并入 F8 后续迭代）
   - P1/P2/P3: 计时器路径、Annotation events 上限、Stardust 跨 store 写回解耦（F14/F15/F16）
   - `ReportPage` `setTimeout(50)` 竞态改造（F11）
   - `api/*` 公共包装（CORS/Method/Error）与批注提取逻辑同构（F12/F13）
3. **部分采纳（拆分立项）**
   - AB3 + 硬编码中文深层问题：`MoodOption` 中文字面量与心情域 i18n 深改影响面大，独立为 P3（F18）
4. **不采纳（本轮明确排除）**
   - AB1 / C12: `FORCE_ANNOTATION_TRIGGER` 100% 触发，本轮不改（用户自行处理）
   - C13 / Q2: DEBUG `console.log` 清理，本轮不改（用户自行处理）

#### 任务看板变化

1. 新增 Phase F（F1-F20）用于承接 2026-03-04 审计修复。
2. 新增 PR-11（`PR-11A ~ PR-11E`）作为可独立回滚执行清单。
3. 明确排除项固化为 F19/F20，避免后续执行漂移。

#### 风险与回滚点

1. `F4/F5/F6` 涉及核心消息与报表流程，需保持“行为不变优先”，并在 `/chat`、`/report` 做完整冒烟回归。
2. `F7/F12/F13` 涉及 API 请求与错误路径，需重点验证失败分支（HTTP 非 2xx、空响应、解析失败）。
3. `F14/F15/F16` 属性能与状态结构优化，需防止因优化引入持久化语义变化。
4. 回滚策略: 按 `PR-11A~E` 子批次独立回滚，不与 C12/C13 绑定。

### 2026-03-04 (续) — Phase F 首批落地（F1-F8 + F11）

#### 变更来源

- 来源: 用户指令“开始执行新增任务”，按 Phase F 的 P0/P1 优先级先落地。

#### 决策结论

1. 完成 P0 基线：F1/F2。
2. 完成 P1 核心一致性修复：F3/F4/F5/F6/F7/F8。
3. 提前完成 P2 中的低风险竞态修复：F11。
4. 维持排除项不变：F19/F20（用户自行处理）。

#### 代码变更范围

1. `src/api/client.ts`
   - 固化 `API_BASE = '/api'`。
   - 新增通用 `postJson<TReq, TRes>()`，收口 `callChatAPI/callReportAPI/callAnnotationAPI/callClassifierAPI/callDiaryAPI/callStardustAPI` 的重复请求模板。
2. `src/store/chatActions.ts`
   - `triggerMoodDetection` 使用当前 i18n 语言传递 `lang`。
   - `persistMessageToSupabase` 增加 `isMood` 参数并写入 `is_mood` 字段。
3. `src/store/useChatStore.ts`
   - 删除 `sendMessage` 中 record 模式空逻辑分支注释。
   - `sendMood` 改为复用 `persistMessageToSupabase(..., true)`。
4. `src/store/useAnnotationStore.ts`
   - `getTodayString()` 改为本地日期口径（复用 `getLocalDateString`）。
5. `src/store/reportActions.ts`
   - 提取单次 `isToday = isSameDay(targetDate, new Date())`，统一复用在 action/mood 两处判断。
6. `src/store/useReportStore.ts` + `src/features/report/ReportPage.tsx`
   - `generateReport` 返回新报告 `id`（`Promise<string>`）。
   - `ReportPage` 移除 `setTimeout(50)` 竞态，改为 `await generateReport` 后直接选中 report。
   - `ReportPage` 同日匹配改用 `isSameDay`。
7. `src/features/chat/ChatPage.tsx`
   - MoodStore selector 合并为单 selector（`useShallow`）。
   - `activeRecord` 计算提取为 `useMemo`，计时器依赖改为 `activeRecord`。

#### 验证结果

- `npm run build` 通过 ✓

#### 任务看板变化

- [x] F1, F2, F3, F4, F5, F6, F7, F8, F11

#### 风险与回滚点

1. `generateReport` 签名从 `void` 改为 `Promise<string>`，若后续调用方有严格类型依赖需同步签名。
2. API 请求统一封装后，若需差异化 header/timeout，应在 `postJson` 增加可选参数而非回到复制实现。
3. 回滚建议按文件分组回滚：`client.ts`、`chatActions/useChatStore`、`reportActions/useReportStore/ReportPage`、`ChatPage`。

### 2026-03-05 — Phase F F16 落地（events 控增长 + 同步解耦）

#### 变更来源

- 来源: 用户指令“执行 F16 并同步到 cleanup 文档”，采用方案 A（`annotations[]` 作为同步权威，`todayStats.events` 仅实时日志）。

#### 决策结论

1. 采纳方案 A：同步逻辑从 `todayStats.events` 解耦，改为以 `annotations[]` 为唯一补同步来源。
2. `todayStats.events` 保留运行时语义并增加上限裁剪，防止本地持久化体积持续增长。
3. 新增批注同步状态字段 `syncedToCloud`，将“是否已上云”从事件日志中显式建模。

#### 代码变更范围

1. `src/types/annotation.ts`
   - `AIAnnotation` 新增 `syncedToCloud: boolean`。
2. `src/store/useAnnotationStore.ts`
   - 新增 `MAX_TODAY_EVENTS = 400` 与 `appendCappedEvent()`，统一对 `todayStats.events` 追加路径做上限裁剪。
   - 生成批注时写入 `annotations[]` 默认 `syncedToCloud: false`。
   - 生成后云端 `insert` 成功时，回写对应 annotation 为 `syncedToCloud: true`。
   - `fetchAnnotations()` 拉取云端后映射为 `syncedToCloud: true`。
   - `syncLocalAnnotations()` 改为 `annotations.filter(a => !a.syncedToCloud)` 补同步，不再依赖 `todayStats.events`。

#### 验证结果

- `npx tsc --noEmit` 通过 ✓
- `npm run build` 通过 ✓

#### 任务看板变化

- [x] F16 完成（`todayStats.events` 控增长 + 同步语义解耦）

#### 风险与回滚点

1. `todayStats.events` 裁剪后仅保留最近 400 条，极早事件日志不再长期保留（预期行为）。
2. 同步语义已迁移到 `annotations[]`，可避免因 `events` 裁剪导致补同步漏传。
3. 若需回滚，可独立回退 `src/types/annotation.ts` 与 `src/store/useAnnotationStore.ts` 对应提交。

### 2026-03-05 (续) — Phase F F9 + F10 落地（未使用封装与死代码清理）

#### 变更来源

- 来源: 用户指令“先完成 F9+F10”。

#### 决策结论

1. F9 采用“删除未使用封装”策略：保留已全仓使用的 `getSupabaseSession()`，移除未被引用的 `withSession()` 与 `getSessionUserId()`。
2. F10 采用“引用扫描后删除”策略：确认无引用后，删除 `pulseSlowStyle`、`generateEmojiPrompt`、`extractEmojiFromResponse`。

#### 代码变更范围

1. `src/lib/supabase-utils.ts`
   - 删除未使用导出：`getSessionUserId()`、`withSession()`。
2. `src/store/useStardustStore.ts`
   - 删除未使用函数：`generateEmojiPrompt()`、`extractEmojiFromResponse()`。
3. `src/components/feedback/AIAnnotationBubble.tsx`
   - 删除未使用常量：`pulseSlowStyle`。

#### 验证结果

- 引用扫描：`generateEmojiPrompt`、`extractEmojiFromResponse`、`pulseSlowStyle`、`withSession`、`getSessionUserId` 全仓无残留引用 ✓
- `npx tsc --noEmit` 通过 ✓
- `npm run build` 通过 ✓

#### 任务看板变化

- [x] F9 完成（`supabase-utils.ts` 未使用封装已清理）
- [x] F10 完成（目标死代码已清理）

#### 风险与回滚点

1. 本批为低风险清理，未改动业务流程与 API 行为。
2. 若需回滚，可独立回退 `src/lib/supabase-utils.ts`、`src/store/useStardustStore.ts`、`src/components/feedback/AIAnnotationBubble.tsx` 对应提交。

### 2026-03-05 (续) — Phase F F12 + F13 + F14 + F15 落地（API 收口 + 批注解析同构 + Stardust/Chat 性能收敛）

#### 变更来源

- 来源: 用户指令“执行”，按当日计划优先完成 Phase F 剩余 P2 的 F12-F15。

#### 决策结论

1. 采纳 F12：新增 `api/http.ts` 作为 serverless 通用包装，统一 CORS、预检、Method Guard 与错误 JSON 输出。
2. 采纳 F13：将批注提取核心逻辑收敛到 `src/lib/aiParser.ts`，`api/annotation.ts` 改为复用共享提取器与 `removeThinkingTags()`。
3. 采纳 F14：`useStardustStore` 增加 `messageId -> memoryId` 索引，`hasStardust/getStardustByMessageId` 由线性查找改为索引查询；跨 store 写回改为调用 `useChatStore.attachStardustToMessage()` action。
4. 采纳 F15：`ChatPage` 计时器路径收敛为“仅在存在 activeRecord 时启动 interval”，并将 activeRecord 查询改为逆序单次遍历，避免每秒 O(n) 路径。

#### 代码变更范围

1. API 公共包装（F12）
   - 新增：`api/http.ts`
   - 接入：`api/chat.ts`、`api/report.ts`、`api/classify.ts`、`api/diary.ts`、`api/stardust.ts`、`api/annotation.ts`
2. 批注解析同构（F13）
   - `src/lib/aiParser.ts`：补齐多语言 `extractComment/isValidComment/removeThinkingTags`
   - `api/annotation.ts`：删除本地重复提取实现，改为复用 `../src/lib/aiParser`
   - `api/report.ts`、`api/diary.ts`：统一复用 `removeThinkingTags`
3. Stardust 查询与写回优化（F14）
   - `src/store/useStardustStore.ts`：新增 `memoryIdByMessageId` 索引 + `buildMemoryIdByMessageId()`
   - `src/store/useChatStore.ts`：新增 `attachStardustToMessage()` action
4. Chat 计时器优化（F15）
   - `src/features/chat/ChatPage.tsx`：activeRecord 计算和 interval 生命周期优化

#### 验证结果

- `npx tsc --noEmit` 通过 ✓
- `npm run build` 通过 ✓

#### 任务看板变化

- [x] F12 完成（API 公共包装已落地）
- [x] F13 完成（批注提取逻辑同构完成）
- [x] F14 完成（Stardust 索引查询 + action 化写回完成）
- [x] F15 完成（Chat 计时器路径优化完成）

#### 风险与回滚点

1. F12 属 API 路径基建改造，若单个端点行为异常可按文件粒度回退对应 handler，不影响其他端点。
2. F13 共享提取器后，`api/annotation.ts` 与前端工具复用同一策略；若需快速回退可独立回退 `src/lib/aiParser.ts` + `api/annotation.ts`。
3. F14 的 `memoryIdByMessageId` 为运行时索引，持久化仍以 `memories[]` 为权威；异常时可回退 `useStardustStore.ts` 与 `useChatStore.ts` 的相关变更。
4. F15 仅收敛计时器生命周期，不改业务语义；回退点为 `ChatPage.tsx` 单文件。

### 2026-03-05 (续) — Phase F F17 + F18 落地（DB 映射同构 + MoodKey 去中文耦合）

#### 变更来源

- 来源: 用户指令“执行”，按今日计划收口 Phase F 剩余可执行项 F17/F18。

#### 决策结论

1. F17 采用“单文件映射层”方案：新增 `src/lib/dbMappers.ts`，统一 Todo/Report/Stardust/Annotation/Auth/Message 的 DB Row 映射与入库映射。
2. F18 采用“英文 key 内核”方案：Mood 领域内部值统一为 `happy/calm/focused/...`，展示层通过 i18n 翻译 key 输出。
3. 对历史本地持久化数据增加兼容迁移：在 MoodStore 持久化 `merge` 阶段把旧中文 mood 值映射为英文 key。

#### 代码变更范围

1. F17（DB 映射同构）
   - 新增 `src/lib/dbMappers.ts`：`fromDb*/toDb*` 映射函数集中管理。
   - 接入文件：
     - `src/store/chatHelpers.ts`
     - `src/store/useTodoStore.ts`
     - `src/store/useReportStore.ts`
     - `src/store/reportActions.ts`
     - `src/store/useStardustStore.ts`
     - `src/store/useAnnotationStore.ts`
     - `src/store/useAuthStore.ts`
     - `src/store/useChatStore.ts`
2. F18（Mood i18n 深改）
   - 新增 `src/lib/moodOptions.ts`（MoodKey 规范、兼容映射、i18n key 映射）。
   - `src/store/useMoodStore.ts`：`MoodOption` 改为英文 key，落地持久化迁移。
   - `src/lib/mood.ts`：自动识别结果切换到 MoodKey。
   - `src/store/chatActions.ts`：能量等级映射切换到 MoodKey。
   - `src/features/chat/MoodPickerModal.tsx`、`src/features/chat/MessageItem.tsx`、`src/features/report/MoodPieChart.tsx`、`src/lib/moodColor.ts`：展示层统一通过 i18n + key 兼容渲染。
   - `src/store/reportHelpers.ts`：情绪总结文案兼容 MoodKey，输出保持用户可读标签。

#### 验证结果

- `npx tsc --noEmit` 通过 ✓
- `npm run build` 通过 ✓

#### 任务看板变化

- [x] F17 完成（DB 映射函数同构完成）
- [x] F18 完成（MoodOption 去中文耦合完成）

#### 风险与回滚点

1. F18 主要风险为“旧本地数据中中文 mood 值”兼容；已在 `useMoodStore` 持久化 `merge` 中做迁移映射。
2. F17 主要风险为字段映射遗漏；已将读写路径收口到 `dbMappers.ts` 便于审计与回滚。
3. 若需回退，可按主题独立回退：
   - F17：`src/lib/dbMappers.ts` + 各 store 接入提交
   - F18：`src/lib/moodOptions.ts` + Mood 相关组件/store 提交

### 2026-03-05 (续) — Phase G 计划入板（待明日执行）

#### 变更来源

- 来源: 用户要求将“分形文档 + 强制同构”完整计划写入 cleanup 主文档，作为待完成任务。

#### 决策结论

1. 新增 Phase G（G1-G7）到任务看板，状态统一为未完成。
2. Phase G 作为下一执行批次，目标是建立 AI 可稳定读取的三层文档结构与强制同构回环。
3. 本次仅入板与规则固化，不执行代码/脚本实现。

#### 任务看板变化

- [ ] G1, G2, G3, G4, G5, G6, G7（全部新增，待执行）

#### 风险与回滚点

1. 若后续只补文档不加校验脚本，Phase G 将退化为“软约束”，无法长期防漂移。
2. 本次为文档变更，回滚点为本文件对应提交。

### 2026-03-06 — Phase G 命名口径调整（`CLAUDE.md` -> `LLM.md`）

#### 变更来源

- 来源: 用户指令（统一入口文档命名为 `LLM.md`，不再使用 `CLAUDE.md`）。

#### 决策结论

1. 采纳并固化：Phase G 单入口文件名统一为 `LLM.md`。
2. `CLAUDE.md` 不再作为计划目标或兼容入口。

#### 文档变更范围

1. 第 4 节任务看板 G1 描述改为：新建根目录 `LLM.md`。
2. Phase G 验收标准中的三层读取路径改为：`LLM.md` -> `docs/PROJECT_MAP.md` -> 模块 README/关键文件头。

#### 验证结果

- 本批仅文档口径同步，无代码行为变更。

#### 风险与回滚点

1. 风险主要为历史口径混用；后续新增文档与脚本统一按 `LLM.md` 执行。
2. 回滚点为本文件对应提交，不影响运行时功能。

### 2026-03-06 (续) — Phase G 全量落地（G1-G7）

#### 变更来源

- 来源: 用户指令“执行”，按 Phase G 完整落地分形文档与同构校验。

#### 决策结论

1. 采纳 `LLM.md` 单入口策略，不再引入 `CLAUDE.md`。
2. 采用“三层分形 + 脚本硬校验”方案，避免仅靠约定导致长期漂移。
3. 一次性完成 G1-G7，并将规则接入项目标准验证命令。

#### 代码/文档变更范围

1. G1/G2/G3（入口与分形结构）
   - 新增 `LLM.md`（权威顺序、三层读取、禁止事项、回环检查）。
   - 新增模块 README：
     - `src/features/auth/README.md`
     - `src/features/todo/README.md`
     - `src/features/report/README.md`
     - `src/api/README.md`
   - 重写 `src/features/chat/README.md` 为同构模板（入口/接口/上游/下游/关联文档）。
2. G2/L3（关键文件依赖头）
   - 在以下关键文件新增 `DOC-DEPS` 头声明：
     - `src/App.tsx`
     - `src/api/client.ts`
     - `src/store/use*Store.ts`（全部 7 个）
     - `api/*.ts`（全部 7 个）
3. G4/G5（脚本与命令）
   - 新增 `scripts/check-doc-sync.mjs`，校验：
     - 核心模块 README 存在性
     - 关键文件 `DOC-DEPS` 声明存在性
     - `docs/PROJECT_MAP.md` 核心路径覆盖
   - `package.json` 新增 `lint:docs-sync`。
   - `CONTRIBUTING.md` 新增“代码变更 -> 必改文档矩阵”与 `lint:docs-sync` 执行要求。
4. G6/G7（规范与基线）
   - `docs/CHANGELOG.md` 新增“Documentation Isomorphism Logging Rules”。
   - `docs/PROJECT_MAP.md` 新增 Core Path Index，收敛核心路径术语。
   - 对 `/chat`、`/todo`、`/report`、`/api/*`、`i18n` 完成文档路径抽查，确认可双向追溯。

#### 验证结果

- `npx tsc --noEmit` 通过 ✓
- `npm run build` 通过 ✓
- `npm run lint:docs-sync` 通过 ✓

#### 任务看板变化

- [x] G1, G2, G3, G4, G5, G6, G7 完成

#### 风险与回滚点

1. `lint:docs-sync` 当前为最小校验，后续新增关键模块时需同步扩充脚本清单。
2. `DOC-DEPS` 头声明是可读性约束，不改变运行行为；如需回退可按文档与脚本提交独立回退。

### 2026-03-06 (续) — Phase H: Hook 自动拦截 + 审计后续任务落地

- 变更来源: 2026-03-06 全项目审计报告
- 执行人: AI (Antigravity)
- 已完成:
  1. 新建 `scripts/check-secrets.mjs`、`scripts/pre-commit.mjs`、`scripts/install-hooks.mjs`
  2. `package.json` 新增 `lint:secrets`、`lint:all`、`prepare`
  3. `LLM.md` 升级为完整 AI 会话 SOP
  4. Hook 安装并验证通过
- 待执行: H5（拆分 annotation.ts）、H6（useChatStore 瘦身）、H7（依赖清理）、H8（commit-msg hook）
- 验证结果: `pre-commit.mjs` ✅、`lint:all` ✅、`git commit` 自动触发 ✅

### 2026-03-07 — Phase H H5/H6/H7 落地（annotation 拆分 + chat store 瘦身 + 依赖清理）

- 变更来源: 用户指令“C12/C13 不纳入今日范围，开始执行”
- 执行人: AI (OpenCode)
- 已完成:
  1. H5: 拆分 `api/annotation.ts`：新增 `api/annotation-prompts.ts` 承载 prompt 模板与默认批注；新增 `api/annotation-handler.ts` 承载 handler 逻辑；`api/annotation.ts` 收敛为路由入口转发（2 行）
  2. H6: `useChatStore.ts` 提取 `insertActivity` 碰撞处理与持久化逻辑到 `src/store/chatActions.ts`（`buildInsertedActivityResult`、`persistInsertedActivityResult`），并进一步提取 `updateMessageDuration` 相关逻辑（`buildMessageDurationUpdate`、`persistMessageDurationUpdate`）
  3. H7: 清理未使用重依赖：移除 `cannon-es`、`matter-js`、`three` 与 `@types/matter-js`，同步更新 `package-lock.json`
- 产出状态:
  - `api/annotation.ts`: 700+ 行 -> 2 行入口（目标达成）
  - `src/store/useChatStore.ts`: 552 行 -> 464 行（达成验收阈值 ≤470）
  - `src/store/chatActions.ts`: 115 行 -> 250 行（承接 store 下沉逻辑）
- 验证结果:
  - `npm run lint:max-lines` ✅（告警可接受）
  - `npm run lint:docs-sync` ✅
  - `npm run lint:state-consistency` ✅
  - `npx tsc --noEmit` ✅
  - `npm run build` ✅
- 状态调整: H8 停止执行（用户决定不启用 commit-msg hook）

### 2026-03-07 (续) — TSHINE_DEV_SPEC 对照审计 + Dev Spec v1.2 更新

- 变更来源: 用户指令"审计现有代码是否符合 TSHINE_DEV_SPEC.md 规范"
- 执行人: AI (Antigravity)
- 已完成:
  1. 对照 `TSHINE_DEV_SPEC.md` 审计全部 `src/` 代码，产出审计报告 `docs/CODE_AUDIT_VS_DEV_SPEC.md`
  2. 发现 19 个问题（5 严重 / 10 中等 / 4 低），分 6 大类：分层架构违规、移动端 UI 违规、App Store 审核风险、Capacitor 就绪度、代码质量、Web-only API 使用
  3. `TSHINE_DEV_SPEC.md` 升级到 v1.2：补充 WKWebView localStorage 风险、capacitorStorage 适配器、平台检测工具、capacitor.config.ts 配置、Vercel->Edge Functions 迁移清单、Apple 官方审核指南 8 条关键条款（2.5.1/2.5.2/2.3.1(a)/Privacy Manifests 等）、红线从 8 条扩充至 17 条
  4. 审计问题纳入本交接计划 Phase I（I1-I19）+ PR-13 执行计划
- 新增文件: `docs/CODE_AUDIT_VS_DEV_SPEC.md`
- 修改文件: `docs/TSHINE_DEV_SPEC.md`(v1.0->v1.2), `docs/CODE_CLEANUP_HANDOVER_PLAN.md`(v1.5->v1.6), `LLM.md`, `PROJECT_CONTEXT.md`
- 待执行: Phase I 全部任务（I1-I19），建议与功能大改同步进行

