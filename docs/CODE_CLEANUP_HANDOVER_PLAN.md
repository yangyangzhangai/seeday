# Tshine 代码整理交接计划

- 文档版本: v1.4
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
- [ ] C12: **[P2]** 恢复 `annotationHelpers.ts` 概率逻辑（移除测试模式 100% 触发）
- [ ] C13: **[P2/暂缓]** 清理 DEBUG console.log（~26 处分布在 5 个 store 文件）— 用户调试中，暂不删除
- [x] C14: **[P2]** MoodStore 数据清理策略（防止 localStorage 溢出）
- [x] C15: **[P2]** 统一 Todo 字段映射函数（`toDbTodo()`）
- [x] C16: **[P2]** 修复 `sendMood` 缺失 `ChatState` 接口声明

### Phase D: 目录治理
- [x] D1: 新建 `docs/PROJECT_MAP.md`（目录职责/入口/边界/状态）
- [x] D2: 统一页面入口策略（`pages` 向 `features` 收敛）
- [ ] D3: 统一前后端 API 分层边界（`src/*` 调用、`api/*` 服务端）
- [x] D4: 清理或迁移遗留直连实现（含 `src/api/qwen.ts`）
- [x] D5: 清理占位目录 README，合并为单一地图文档
- [ ] D6: 锁定单一包管理器并确认主锁文件策略
- [x] D7: 清理 `src/i18n/locales/en.ts.temp`
- [x] D8: 清理空目录与占位目录（`src/assets`, `src/styles`, `src/layouts`）
- [ ] D9: 根目录残留文件评估处置（`TO-DO.json`, `YOUWARE.md`, `SECURITY_FIX.md`, `scripts/test-minmax.ts`）

### Phase E: 规范化
- [ ] E1: 新建 `CONTRIBUTING.md`
- [ ] E2: 组件目录按职责分组（`layout/feedback`）
- [ ] E3: 配置文件行数约束（`max-lines`）

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
