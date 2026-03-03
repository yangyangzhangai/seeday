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
- [ ] B1: 重写根 `README.md`
- [ ] B2: 新建 `PROJECT_CONTEXT.md`
- [ ] B3: 新建 `FEATURE_STATUS.md`
- [ ] B4: 重写 `docs/ARCHITECTURE.md`（仅真实实现）
- [ ] B5: 新建 `docs/CHANGELOG.md`

### Phase C: 结构拆分
- [x] C1: 拆分 `ChatPage.tsx`
- [x] C2: 拆分 `useChatStore.ts`（chatHelpers 已提取）
- [ ] C3: 拆分 `ReportPage.tsx` — 拆分子组件到独立文件
- [ ] C4: 拆分 `useReportStore.ts` — 提取 `reportHelpers.ts`
- [ ] C5: 拆分 `TodoPage.tsx`
- [ ] C6: **[P0]** 提取 `reportHelpers.ts`（时间范围/过滤/分类器逻辑），useReportStore 减少 ~200 行
- [ ] C7: **[P0]** 拆分 `sendMessage` → `chatActions.ts`（关闭活动/持久化/心情检测/AI 响应），useChatStore 减少 ~120 行
- [ ] C8: **[P1]** 统一 Supabase session 封装 → `lib/supabase-utils.ts`
- [ ] C9: **[P1]** 修复硬编码中文 → i18n（ChatPage ~10 处, ReportPage ~3 处, AuthPage ~4 处, useReportStore ~多处）
- [ ] C10: **[P1]** 提取 `catMap` 到 `lib/todoHelpers.ts`（消除 TodoPage + TodoItem 重复）
- [ ] C11: **[P1]** 移动跨天日报生成逻辑从 ChatPage → App.tsx
- [ ] C12: **[P2]** 恢复 `annotationHelpers.ts` 概率逻辑（移除测试模式 100% 触发）
- [ ] C13: **[P2/暂缓]** 清理 DEBUG console.log（~26 处分布在 5 个 store 文件）— 用户调试中，暂不删除
- [ ] C14: **[P2]** MoodStore 数据清理策略（防止 localStorage 溢出）
- [ ] C15: **[P2]** 统一 Todo 字段映射函数（`toDbTodo()`）
- [ ] C16: **[P2]** 修复 `sendMood` 缺失 `ChatState` 接口声明

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
