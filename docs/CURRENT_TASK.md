# CURRENT TASK (Session Resume Anchor)

- Last Updated: 2026-03-20
- Owner: current working session
- Purpose: this file is the single execution anchor for `多语言词库优化` and `植物系统开发`.

## Current Focus

- **Task Completed**: `多语言词库优化` (Multi-language Lexicon Optimization) is fully implemented, verified, and documented.
- **Next Mainline**: Return to `植物系统开发` (Phase 3-4 convergence) or continue with Magic Pen multi-language expansion as requested.

## Latest Execution Snapshot (2026-03-20)

- [x] **Unified Lexicon Architecture**: Created `src/services/input/lexicon/` with per-language files for activities, moods, and categories.
- [x] **Interfaces & Factory**: Implemented `types.ts` and `getLexicon.ts` for clean multi-language access.
- [x] **Core Refactoring**: `autoDetectMood` and `classifyRecordActivityType` now use the centralized lexicon and support `lang` parameter (ZH/EN/IT).
- [x] **Logic Synchronization**: Updated `liveInputRules.zh.ts`, `magicPenTodoSalvage.ts`, and `magicPenDraftBuilder.ts` to consume the new system.
- [x] **Documentation Sync**: Updated `ACTIVITY_LEXICON.md`, `ACTIVITY_MOOD_AUTO_RECOGNITION.md`, `TSHINE_DEV_SPEC.md`, and created `LEXICON_ARCHITECTURE.md`.
- [x] **Validation**: All 129 core classification tests and multi-language regressions pass.

---

## Historical Tasks (Plant System Phase 0-3)

- 已完成 Phase 0 数据层与 Phase 1 算法层... (keeping the rest of the file content)


## Reference Documents

- Global rules: `LLM.md`
- PRD: `docs/TimeShine_植物生长_PRD_v1_8.docx`
- Tech Design: `docs/TimeShine_植物生长_技术实现文档_v1.7.docx`
- Project boundary: `docs/PROJECT_MAP.md`
- iOS/Web implementation spec: `docs/TSHINE_DEV_SPEC.md`

## Phase Plan (P0-P6)

### Phase 0 - 基线与数据层（先打地基）

**目标**：完成数据结构、类型和映射，建立可联调基础。

- [x] 建表迁移：`daily_plant_records`（含 `(user_id, date)` 唯一索引）与 `plant_direction_config`。
- [x] 补齐字段：`timezone`、`root_metrics(jsonb)`、`is_support_variant`、`cycle_id(null)` 等一期必需字段。
- [x] 新建类型：`src/types/plant.ts`（RootType/PlantStage/RootMetrics/DailyPlantRecord/Direction 配置）。
- [x] 扩展映射：在 `src/lib/dbMappers.ts` 增加 `fromDbPlantRecord` 与 `toDbPlantRecord`。
- [x] 约束确认：root_type 仅存 5 种主根型（tap/fib/sha/bra/bul），sup 只用 `is_support_variant` 表示。
- [x] 产出 SQL 回滚脚本（仅撤销本次新增对象）。

**验收**：本地/测试库可完成插入、查询、幂等复写；TypeScript 无类型缺口。

### Phase 1 - 算法层（可计算、可调参）

**目标**：落地根系指标计算、根型评分和 SVG 路径生成核心能力。

- [x] 新建 `src/lib/plantCalculator.ts`：`computeRootMetrics()`、`matchRootType()`、`resolveSupportVariant()`。
- [x] 固化分母口径：
  - dominant/top2_gap 用加权总时长（生活方向 0.3）。
  - support_ratio/娱乐占比用真实总时长。
  - evenness/branchiness 仅看目标性方向。
- [x] 实现评分制竞争 + tie-break（分差 < 6 时 fib > tap > bra > sha > bul）。
- [x] 将阈值/权重集中到 `ROOT_SCORE_CONFIG`，确保可配置调参。
- [x] 新建 `src/lib/rootRenderer.ts`：对数长度映射、方向角、主根融合（1次主根、2-3次侧根、4次后增粗延长）。
- [x] 实现固定 seed 控制点扰动，保证“同日同根刷新形态不变”。

**验收**：提供覆盖正常/空气/娱乐主导/sup 触发的单元测试；输出结果与 PRD 附录口径一致。

### Phase 2 - Store 与 API 主链路（数据流打通）

**目标**：把前端状态、后端生成和数据库写入串成完整链路。

- [x] 新建 `src/store/usePlantStore.ts`（todaySegments/todayPlant/directionOrder/isGenerating/selectedRootId）。
- [x] 接入活动数据监听：新增、编辑、删除在当日未生成前持续实时影响根系（跨到次日自动重置）。
- [x] 新建 `api/plant-generate.ts`：时间窗校验、幂等校验、优先级判定、写库、返回状态协议。
- [x] 新建 `api/plant-diary.ts`：复用既有 AI 管线，支持 fallback 文案与异步重试。
- [x] 新建 `api/plant-history.ts`：按日期区间拉取植物历史记录。
- [x] 统一接口状态枚举：`too_early` / `empty_day` / `generated` / `already_generated`。

**验收**：前端可调用 API 走完整生成流程；重复调用同一天生成接口返回同一记录。

### Phase 3 - 根系白天体验（可视 + 可交互）

**目标**：在 `ReportPage` 内完成白天根系区核心体验与交互（常驻可见，不做独立入口页）。

**P3 交互冻结变更（2026-03-18）**：

- 冻结决策 A：土壤区不再作为“可拖拽画布”，避免误触和交互冲突；根系主交互收敛为“点击/长按根段查看详情”。
- 冻结决策 B：方向类型映射改为用户可配置，不在土壤区临时拖拽换位；统一在“我的”页提供 `DirectionSettings` 入口。
- 冻结决策 C：土壤区必须显示“方向图例/区域标注”，明确每个方向当前对应的类型，降低理解成本。
- 冻结决策 D：根段详情卡必须展示完整信息：`活动名称` + `时间段(start-end)` + `时长` + `类型` + `专注度`。
- 冻结决策 E：保留“报告页默认可见根系区”的 IA，不新增独立植物入口页面。

- [x] 页面承载改造：在 `src/features/report/ReportPage.tsx` 的「周报 / 月报 / 自定义」按钮区块下方新增 `PlantRootSection`（进入报告页默认可见）。
- [x] 新建/落地组件骨架：`SoilCanvas`、`RootSystem`、`RootSegmentPath`、`RootDetailBubble`（建议放置在 `src/features/report/plant/`，由 `ReportPage` 组装）。
- [x] 实现触发时机：<5 分钟不渲染；5-15 分钟结束后出现；>15 分钟 15 分钟起实时延伸。
- [x] 完成 SVG 风格规范：圆角圆头、低饱和棕灰色、轻微噪声、双描边、土层渐变过渡。
- [x] 支持点击/长按根段展示详情气泡（类别/时长/专注度）。
- [x] 交互改造（替换旧实现）：移除土壤拖拽行为与相关提示，避免与根段点击事件冲突。
- [x] 可选保留项评估：缩放是否保留为按钮触发；若保留需保证不影响根段点选命中率。
- [x] 白天生成按钮禁用 + 文案提示（不可提前生成）；但根系区始终可见。
- [ ] 移动端适配必做项（剩余）：WebView 下根系交互动画稳定 >= 30fps（iOS/Android 真机验证）。
- [x] UI 收口：根段详情气泡改为“智能避让定位”（避免贴边裁切、被底部导航遮挡）。
- [x] UI 收口：根系缩放与拖拽边界策略细化（极限缩放时防止内容不可达/回弹抖动）。
- [ ] UI 收口：根系层级可读性调参（主根/侧根/延展根在高密度时仍可区分）。
- [x] UI 收口：生成按钮状态文案与禁用态视觉统一（白天禁用、晚间可点、生成后锁定）。
- [x] UI 收口：无根段状态视觉优化（空状态插画/引导文案层级，避免“空白区”观感）。
- [x] UI 收口（新增）：土壤方向图例/区域标注（例如上/右上/右下/左下/左上）与当前类型一一对应显示。
- [x] UI 收口（新增）：详情卡补齐时间信息（start-end），并确认名称/时长/类型/专注度字段在多语言下完整展示。
- [x] UI 收口（新增）：根段详情改为“根旁浮层气泡”，点选后 5 秒自动消失。
- [x] 测试任务：新增 `usePlantStore` P3 时机规则单测（<5m、5-15m、>15m 进行中延伸）。
- [x] 测试任务：新增 `SoilCanvas` 交互单测（缩放、拖拽、重置、边界 clamp）。
- [x] 测试任务：新增 `RootSegmentPath` 交互单测（点击选中、长按选中、取消长按）。
- [x] 测试任务：新增 `/report` 集成测试（根系区默认可见、按钮禁用规则、详情气泡开合）。
- [x] 测试任务（新增）：新增“根段点选命中”回归用例（禁止容器手势吞掉点击/长按，确保点击后必出详情）。
- [x] 测试任务（新增）：新增“方向图例一致性”测试（图例映射与 `directionOrder`/`plant_direction_config` 一致）。
- [ ] 测试任务：补充移动端冒烟清单（iPhone 刘海屏 + Android 全面屏 + 小屏机型）。
- [x] 测试任务：补充性能采样记录模板（FPS、长任务、交互掉帧点）并沉淀到 `docs/`。

**验收**：中高压活动数据下根系可读且可交互，动画观感平滑。

### Phase 4 - 晚间生成与揭晓体验（仪式感闭环）

**目标**：完成“晚8点后生成 -> 揭晓植物 -> 展示日记”完整用户闭环。

- [ ] 生成按钮状态机（00:00-19:59 禁用；20:00-23:59 可用；次日首次打开自动兜底；未生成时根系可持续增长到当日 24:00）。
- [ ] 二次确认弹窗：确认后不可逆，不提供重新生成入口。
- [ ] 破土动画组件 `PlantRevealAnimation` 与 `PlantImage` 展示串联。
- [ ] 实现素材检索四级降级：`plantId` 精确 -> 同 rootType+stage -> rootType 默认 mid -> `sha_mid_001`。
- [ ] 处理特殊场景：空气植物（AND 条件）、娱乐主导植物、无记录日兜底文案。
- [ ] 生成后锁定规则：当天植物生成后不再因活动变更而回刷。

**验收**：功能从点击到展示动画在 3 秒内启动；所有异常场景有稳定降级。

### Phase 5 - 历史页与方向设置（可回顾 + 可配置）

**目标**：补齐“看历史”和“调方向”的日常可用能力。

- [ ] 新建 `PlantGardenPage`，按日期展示植物图片 + AI 日记。
- [ ] 新建 `DirectionSettings`，支持 5 类方向调位并持久化到 `plant_direction_config`。
- [x] 将 `DirectionSettings` 入口前置到“我的”页（Profile）并与根系区联动，作为土壤区交互替代主入口。
- [ ] 确保位置与根型解耦：换位置只改视觉角度，不改 category_key 判定。
- [ ] 路由策略更新：不新增独立 `/plant` 主入口；植物根系主体验固定内嵌在 `/report`。如需历史/设置路由，优先挂在报告域下并保持“进入报告页即见根系”不变。
- [ ] 完成多语言词条（zh/en/it）及 UI 文案替换。

**验收**：方向配置刷新后生效且历史记录不污染；历史页稳定分页/查询。

### Phase 6 - 联调、校准、发布准备（上线前封板）

**目标**：完成性能、调参与稳定性收敛，达到可上线标准。

- [ ] 指标校准：`ROOT_SCORE_CONFIG`、对数映射参数、根系视觉密度。
- [ ] 性能验证：根系动画 >= 30fps、LCP < 2s、SVG path 数量压力测试。
- [ ] 时区验证：20:00 门槛、次日自动兜底、跨时区写入 `timezone`。
- [ ] API 稳定性：超时/失败/重试链路、幂等行为、异常码与前端状态一致。
- [ ] 安全与体验红线：无负向文案、无枯萎形态、生成后不可重生。
- [ ] 文档同步：更新 `docs/CHANGELOG.md`、模块 README、必要的 `DOC-DEPS` 声明。

**验收**：达到 PRD 非功能指标并通过端到端回归。

## Cross-Cutting Workstreams (并行任务)

- [ ] 素材流：设计在开发启动后 2 周内交付首批 >= 81 张素材，命名符合规范。
- [ ] AI 流：补齐三场景 prompt（正常/空气/娱乐主导）与多语言版本。
- [ ] 测试流：单测 + API 集成 + e2e 场景（时间窗、幂等、降级、锁定规则）。
- [ ] 测试流（P3 增补）：根系 UI 交互测试 + WebView 30fps 采样 + 移动端三机型冒烟回归。
- [ ] 观测流：埋点生成成功率、fallback 率、平均生成时延、日记成功率。

## Stage Gates (每阶段进入下一阶段前必须通过)

- Gate A（P0->P1）：建表与类型已稳定，映射可读写。
- Gate B（P1->P2）：算法测试通过，评分与优先级结果可复现。
- Gate C（P2->P3）：API 主链路跑通且幂等正确。
- Gate D（P3->P4）：白天根系体验可用，交互无阻塞。
- Gate E（P4->P5）：晚间生成闭环稳定，降级完整。
- Gate F（P5->P6）：历史/设置可用，多语言覆盖完成。

## Frozen Scope For Phase 1 Release

- 仅做 1 天模式；3/7 天养成、季节天气、里程碑装饰、社交分享全部延期到二期。
- 根系渲染方案固定 SVG；Canvas 迁移仅作为二期性能预案。
- 专注度临时规则固定：单条记录 >= 90 分钟为 high，其余 medium。

## Resume Order

1. Read `LLM.md`.
2. Read this file (`docs/CURRENT_TASK.md`).
3. Read PRD: `docs/TimeShine_植物生长_PRD_v1_8.docx`.
4. Read Tech Design: `docs/TimeShine_植物生长_技术实现文档_v1.7.docx`.
5. Read module map: `docs/PROJECT_MAP.md`.
6. Start execution from Phase 0 tasks in this file.

## Post-P6 Backlog (P6 完成后再开发)

> 启动条件：**仅在 Phase 6 全部验收通过后**进入本段开发。

### 分类体系统一改造（仅使用 `activityType`，不新增 `activityCategory`）

**目标**：待办与活动在生成时即完成分类，后续链路只消费同一分类结果，不再二次分类。

- [x] 统一 `activityType` 枚举语义：`study/work/social/life/entertainment/health/chat/mood`，禁止再写入 `待分类/未分类` 等自由文本。
- [x] 待办创建即分类：`Todo.category` 统一落六分类（规则优先，低置信再 AI 补判）。
- [x] 待办触发活动时继承分类：从待办开始/完成生成活动时，直接把 `todo.category` 写入活动 `activityType`。
- [x] 自由文本活动即时分类：输入侧先本地规则判定，低置信时再调用 AI；AI 不阻塞“完成即生成根系”主链路。
- [x] 报告层去二次分类：`reportHelpers` 不再按关键词重分，改为直接按 `activityType` 聚合。
- [x] 植物链路改读统一分类：`plantActivityMapper` / `plant-generate` 优先消费六分类 `activityType`，仅对历史脏数据保留兼容回退。
- [x] 类型与映射收敛：收紧 `Message.activityType` 与 `TodayActivity.activityType` 类型，更新 `dbMappers`、store、API 读写映射。
- [x] 历史数据迁移与兼容：为旧记录提供一次性映射/回填策略，确保报告与植物结果连续可用。

**验收**：

- [x] 新增活动在创建瞬间即有最终分类。
- [x] 待办生成活动不触发重复分类。
- [x] 报告统计与植物根系分类一致，且无需二次重算。
