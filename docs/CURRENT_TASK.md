# CURRENT TASK (Session Resume Anchor)

## Current Override (2026-03-25)

- Status: 日记功能重建 Phase 1–4 进行中
- Scope owner: current working session
- This section supersedes the 2026-03-21 multilingual classification mainline. That work is complete (PR0–PR4 all landed). Current focus is diary rebuild per `docs/DIARY_REBUILD_PLAN.md`.

### Current Mainline

- 按 `docs/DIARY_REBUILD_PLAN.md` 执行日记功能重建，分四个 Phase：
  - Phase 1（数据对齐 A1-A5）→ Phase 2（代码清理 A6-A7）→ Phase 3（AI 管线 D1-D6）→ Phase 4（可视化 V1-V7）

### Execution Checklist (2026-03-25)

- [x] A1–A3：审计 ReportStats / Message / MoodStore 字段对齐 — 已确认无断裂
- [x] A4：审计 Todo 字段在日报管线中的消费 — 已确认对齐
- [x] A5：审计 GrowthStore (Bottle) 在日报管线中的消费 — 已确认对齐
- [x] A6：清除 report 组件全部硬编码中文，改为 `t()` i18n key（ZH/EN/IT）
  - `ReportPage.tsx`、`ReportDetailModal.tsx`、`ReportStatsView.tsx`
- [x] A7（部分）：`generateActionSummary` / `generateMoodSummary` 改为 `lang` 参数驱动，支持 ZH/EN/IT
  - `src/store/reportHelpers.ts`、`src/store/reportActions.ts`
- [x] D1：buildRawInput 关联活动心情 — 已确认在 reportActions.ts:298 完成
- [x] D2：buildRawInput 纳入每日目标 — 已确认在 reportActions.ts:200 完成
- [x] D3（部分）：AI 输入链路 IT 沿用 EN（可接受）；用户可见摘要已通过 A7 修复
- [x] V2：`ActivityCategoryDonut` — SVG 圆环图，来源 `stats.actionAnalysis`
- [x] V4：`SpectrumBarChart` — 8类水平条形图，来源 `stats.spectrum`
- [x] V6：`LightQualityDashboard` — 光质读数三组对比条，来源 `stats.lightQuality`
- [x] V7（部分）：三个新组件集成到 `ReportDetailModal` Page 1
- [x] `ReportStats` 扩展 `spectrum` / `lightQuality` 字段，日记生成后自动写入并持久化

### 已完成（本会话追加）

- [x] DayEcoSphere：日记界面植物上方三个玻璃生态球（心情/活动/待解锁），点击展开图表面板
  - 左球：今日心情能量曲线（SVG 折线图，按时间轴排布）+ 心情分类饼图
  - 中球：今日活动分类圆环（复用 `ActivityCategoryDonut`）
  - 右球：空置占位
  - 晚上 20 点后显示"数据将归入今日日记"提示
  - 数据来源与日记报告完全一致（`computeActivityDistribution` / `computeMoodDistribution` / `computeMoodEnergyTimeline`）

### 待处理（下次会话入口）

- [ ] V3：MoodEnergyTimeline — 需要时间戳数据，当前 moodDistribution 无时间轴信息，需要数据结构扩展
- [ ] V5：TodoCompletionCard 独立组件优化（现有 ReportStatsView 已覆盖基本需求，可选做视觉升级）
- [ ] D5（剩余）：历史趋势补充 mood key 维度 — 能量水平趋势已有，缺 happy/anxious 等心情分布跨日趋势
- [ ] A7（剩余）：`getDateRange` title 字符串多语言化（存入 DB，影响 reports 表，优先级低）
- ✅ D4：formatForDiaryAI 已完整实现，无需改动
- ✅ D6：classify.ts prompt 已与 ClassifiedData + D1/D2 数据格式完全对齐，无需改动

### Session Close Snapshot (2026-03-25)

- 回环校验结果：`lint:secrets` ✅ `lint:max-lines` ✅ `lint:docs-sync` ✅ `lint:state-consistency` ✅ `tsc --noEmit` ✅
- 新增 i18n keys：26 个（ZH/EN/IT 三语对齐）
- 新建组件：`ActivityCategoryDonut.tsx`、`SpectrumBarChart.tsx`、`LightQualityDashboard.tsx`
- 修改组件：`ReportPage.tsx`、`ReportDetailModal.tsx`、`ReportStatsView.tsx`
- 修改 store：`useReportStore.ts`（ReportStats 扩展 + diary 生成后写入 spectrum/lightQuality）
- 修改 helpers：`reportHelpers.ts`（多语言摘要）、`reportActions.ts`（传 lang 参数）

### Execution Checklist (2026-03-21)

 - [x] Synced the four AI companion personas (`van`, `agnes`, `zep`, `spring_thunder`) into annotation, report diary, and plant diary prompt flows via a shared prompt source.

 - [x] 完成会话启动必读链路：`LLM.md`、`docs/CURRENT_TASK.md`、`docs/PROJECT_MAP.md`、`docs/TSHINE_DEV_SPEC.md`
 - [x] 完成 `PR0`：落地多语言 fixture、可复跑 benchmark runner、npm 命令、baseline artifact 与基线文档
 - [x] 完成 `PR1a`：chat/todo/refine 链路显式透传 `lang`，并清理 helper 内隐式 `zh` 回退路径
  - [x] 执行 `PR1b`：新增 `src/lib/categoryAdapters.ts`，建立 `ActivityRecordType <-> DiaryClassifierCategory` 单一适配边界并补齐单测
  - [x] 执行 `PR2`：完成 lexicon SSOT 收敛（EN/IT 去重、Magic Pen 改读中心词库、迁移遗留 ZH 词表）
  - [x] 执行 `PR3`：拆分语言信号提取器并保留共享 resolver，按 PR0 基线做回归对比与风险子集报告
  - [x] 执行 `PR4`：加固 Magic Pen fallback 与 todo 分类质量（EN/IT 保守落 `unparsed`，减少默认 `life` 偏置）
  - [x] 每个后续 PR 完成后执行回环校验：`lint:max-lines`、`lint:docs-sync`、`lint:state-consistency`、`tsc --noEmit`，并同步 `docs/CHANGELOG.md` 与本文件

### Session Close Snapshot (2026-03-21)

- `PR1b`、`PR2`、`PR3`、`PR4` 已按主线落地。
- 基线回归结果（`docs/benchmarks/pr0-baseline.latest.json`）当前为全量通过：
  - live-input intent: `100.00% (18/18)`
  - activity category: `100.00% (18/18)`
  - todo category: `100.00% (18/18)`
  - magic-pen fallback: `100.00% (6/6)`
- 下一工作入口建议：直接从 `PR4` 开始，优先处理 Magic Pen EN/IT conservative fallback 与 todo category commit 前分类链路。

### PR4 Execution Snapshot (2026-03-21)

- Magic Pen todo 草稿默认分类从硬编码 `life` 调整为 `unset`，并在提交前按当前语言执行 `normalizeTodoCategory(...)`，避免提前锁死分类：
  - `src/services/input/magicPenDraftBuilder.ts`
  - `src/services/input/magicPenParserLocalFallback.ts`
  - `src/services/input/magicPenTodoSalvage.ts`
  - `src/store/magicPenActions.ts`
  - `src/features/chat/MagicPenSheet.tsx`
- local fallback 新增语言参数并明确 EN/IT conservative 行为：非 ZH 仅处理单段高置信 todo 信号，其余保守落 `unparsed`：
  - `src/services/input/magicPenParser.ts`
  - `src/services/input/magicPenParserLocalFallback.ts`
  - `scripts/multilingual_classification_benchmark.ts`
- 补齐 PR4 回归覆盖：
  - `src/services/input/magicPenParser.test.ts`
  - `src/services/input/magicPenDraftBuilder.test.ts`
  - `src/store/magicPenActions.test.ts`
  - `src/i18n/locales/{zh,en,it}.ts`
- 回环校验结果：
  - `npm run eval:classification:pr0`：四组 benchmark 全量 `100%`
  - `npx vitest run src/services/input/magicPenDraftBuilder.test.ts src/services/input/magicPenParser.test.ts src/services/input/magicPenTodoSalvage.test.ts src/store/magicPenActions.test.ts`
  - `npm run lint:max-lines`
  - `npm run lint:docs-sync`
  - `npm run lint:state-consistency`
  - `npx tsc --noEmit`

### Why This Work Is Reopened

- Runtime language propagation is incomplete. Some EN and IT flows still silently default to `zh`.
- `ActivityRecordType` and `DiaryClassifierCategory` are still partially mixed in downstream mapping paths.
- ZH already reuses the central lexicon more consistently, but EN and IT still duplicate lists inside rule files.
- Magic Pen still depends on a legacy ZH activity lexicon copy, so the project does not yet have a true SSOT for activity phrases.
- Magic Pen todo category handling is biased toward hard-coded `life`, which lowers category quality for parsed todo drafts.
- EN and IT Magic Pen fallback behavior has not been frozen as a written spec, so implementation and review remain subjective.

### Frozen Decisions

- `ActivityRecordType` and `DiaryClassifierCategory` must remain separate taxonomies.
- `src/services/input/lexicon/` is the long-term single source of truth for shared lexical data.
- `PR1a` only fixes `lang` plumbing. It must not include classifier rewrites.
- `PR1b` introduces the category adapter boundary and lands immediately after `PR1a`.
- `PR3` cannot begin until `PR0` benchmark fixtures and rerunnable baselines exist.
- Magic Pen EN and IT fallback are intentionally conservative. Ambiguous cases should become `unparsed`, not forced records.

### PR0 - Benchmark And Gold Set Baseline

**Goal**
- Freeze a measurable baseline before modifying classifier logic.

**Tasks**
- Build multilingual fixture sets for:
  - live input intent: `activity`, `mood`, `activity_with_mood`, `mood_about_last_activity`
  - activity category classification
  - todo category classification
  - Magic Pen fallback outcomes
- Add a repeatable runner that prints before and after metrics.
- Record baseline numbers before any refactor PR starts.

**Required scenario coverage**
- ZH:
  - short pure mood utterances
  - explicit completed activities
  - future-plan text that must not become completed activity
  - recent-context mood-about-last-activity cases
- EN:
  - token-boundary-sensitive activity phrases
  - negation
  - future modal or plan statements
  - activity plus mood attachment
- IT:
  - common verb-form variation
  - gendered mood adjectives
  - obligation and future phrasing
  - activity plus mood attachment
- Magic Pen:
  - simple activity
  - simple mood
  - simple todo
  - zh backfill-like input
  - EN and IT ambiguous input that must remain `unparsed`

**Suggested file areas**
- `src/services/input/__tests__/`
- `src/lib/__tests__/`
- `src/services/input/__fixtures__/`
- `scripts/` benchmark runner if appropriate

**Acceptance**
- A benchmark command exists and can be rerun by later PRs.
- Baseline results are saved in review notes or a local benchmark artifact.
- All later PRs can compare against the same fixture set.

**Execution snapshot (2026-03-21)**
- Added multilingual fixture sets under `src/services/input/__fixtures__/`:
  - `liveInput.intent.fixture.json`
  - `activity.category.fixture.json`
  - `todo.category.fixture.json`
  - `magicPen.fallback.fixture.json`
- Added benchmark runner `scripts/multilingual_classification_benchmark.ts`.
- Added rerunnable commands in `package.json`:
  - `npm run eval:classification:pr0`
  - `npm run eval:classification:pr0:artifact`
- Baseline artifact generated at `docs/benchmarks/pr0-baseline.latest.json`.
- Baseline summary documented in `docs/benchmarks/PR0_BASELINE.md`.
- Current baseline snapshot:
  - live-input internal accuracy: `94.44% (17/18)`
  - activity category accuracy: `94.44% (17/18)`
  - todo category accuracy: `72.22% (13/18)`
  - magic-pen fallback accuracy: `100.00% (6/6)`

**Benchmark runner correction (2026-03-21)**
- Fixed `scripts/multilingual_classification_benchmark.ts` todo-evaluation path to pass fixture `lang` into `normalizeTodoCategory(...)`.
- This removes cross-language false negatives in the benchmark harness and aligns todo metrics with runtime language plumbing.

### PR1a - Lang Plumbing Only

**Goal**
- Make runtime language explicit across chat, todo, and low-confidence refine flows.

**Scope**
- Parameter propagation only.
- No rule rewrites.
- No lexicon rewrites.
- No category semantic changes.

**Primary files**
- `src/store/useChatStore.ts`
- `src/store/chatActions.ts`
- `src/store/chatTimelineActions.ts`
- `src/store/useTodoStore.ts`
- `src/lib/mood.ts`
- `src/lib/activityType.ts`
- any helper that calls `autoDetectMood`, `classifyRecordActivityType`, or classifier-refine APIs without forwarding `lang`

**Tasks**
- Audit all `autoDetectMood()` call sites and pass `lang` explicitly.
- Audit all `classifyRecordActivityType()` call sites and pass `lang` explicitly.
- Audit low-confidence classifier refine paths and pass `lang` through request builders and API wrappers.
- Remove hidden reliance on default `zh` anywhere the caller already knows the active language.

**Acceptance**
- Existing ZH tests remain green.
- New EN and IT propagation tests pass.
- No critical chat or todo path silently falls back to implicit `zh`.

**Execution snapshot (2026-03-21)**
- Propagated runtime language through chat/todo classification and mood auto-detection paths:
  - `src/store/useChatStore.ts`
  - `src/store/chatActions.ts`
  - `src/store/chatTimelineActions.ts`
  - `src/store/useTodoStore.ts`
- Updated low-confidence classifier refine requests to forward `lang` explicitly in:
  - chat record refine flow
  - todo category refine flow
- Extended language plumbing in category helpers to avoid hidden `zh` fallback in nested calls:
  - `src/lib/activityType.ts`
  - `src/store/reportHelpers.ts`
  - `src/store/reportActions.ts`

### PR1b - Category System Split

**Goal**
- Separate local app categories from report or AI-side classifier categories.

**Scope**
- Introduce one explicit adapter boundary between:
  - local `ActivityRecordType`
  - report or AI `DiaryClassifierCategory`

**Suggested file targets**
- `src/lib/categoryAdapters.ts`
- `src/lib/activityType.ts`
- `/api/classify` integration call sites
- downstream helpers that currently interpret AI-side categories as if they were local categories

**Tasks**
- Move category-mapping logic into a dedicated adapter module.
- Define the adapter API clearly and test it directly.
- Remove hidden ZH-only assumptions from mappings such as `deep_focus -> work or study`.
- Update docs and tests so the two taxonomies are no longer described as one system.

**Acceptance**
- One clear translation layer exists between the two category systems.
- Mapping behavior is language-aware where needed and covered by tests.
- Reviewers can see category-boundary ownership from file structure alone.

**Execution snapshot (2026-03-21)**
- Added explicit category adapter boundary in `src/lib/categoryAdapters.ts` for translating `DiaryClassifierCategory -> ActivityRecordType`.
- Updated low-confidence AI refine paths to use the adapter directly in:
  - `src/store/useChatStore.ts`
  - `src/store/useTodoStore.ts`
- Added direct adapter tests in `src/lib/categoryAdapters.test.ts`.

### PR2 - Lexicon SSOT Consolidation

**Goal**
- Make the lexicon folder the real single source of truth.

**Primary files**
- `src/services/input/lexicon/getLexicon.ts`
- `src/services/input/lexicon/types.ts`
- `src/services/input/lexicon/activityLexicon.zh.ts`
- `src/services/input/lexicon/activityLexicon.en.ts`
- `src/services/input/lexicon/activityLexicon.it.ts`
- `src/services/input/liveInputRules.en.ts`
- `src/services/input/liveInputRules.it.ts`
- `src/services/input/magicPenRules.zh.ts`
- legacy `src/services/input/activityLexicon.zh.ts`

**Tasks**
- Merge any still-used legacy ZH phrases into the new lexicon tree.
- Update Magic Pen rules to consume the centralized lexicon.
- Refactor EN and IT live-input rule modules to derive reusable word lists from the lexicon rather than maintain parallel copies.
- Remove or deprecate legacy lexical files once imports are migrated.

**Acceptance**
- Adding a reusable lexical item requires editing the centralized lexicon only.
- EN and IT no longer duplicate core reusable word lists in multiple rule files.
- Magic Pen and live-input rules stop depending on different activity phrase sources.

**Execution snapshot (2026-03-21)**
- Refactored EN and IT live-input reusable lexical lists to source from centralized lexicon bundles:
  - `src/services/input/liveInputRules.en.ts`
  - `src/services/input/liveInputRules.it.ts`
- Updated Magic Pen ZH activity detection rules to consume `lexicon/activityLexicon.zh.ts` directly.
- Removed legacy duplicated file `src/services/input/activityLexicon.zh.ts` after import migration.

### PR3 - Shared Resolver Plus Language Extractors

**Goal**
- Keep one final decision framework while letting each language use a strategy suited to its grammar.

**Primary files**
- `src/services/input/liveInputClassifier.ts`
- `src/services/input/liveInputContext.ts`
- `src/services/input/types.ts`
- new per-language extractor modules under `src/services/input/signals/` or similar
- corresponding tests

**Required language strategy**
- ZH:
  - phrase-first detection
  - short pure mood override
  - verb-object and completion-pattern handling
  - negation and not-yet-happened filtering
  - recent-activity context support
- EN:
  - token boundaries
  - phrasal verbs
  - negation scope
  - modal and future-plan handling
  - activity-plus-mood attachment
- IT:
  - common inflection handling
  - gender-form tolerance for mood adjectives
  - obligation and future patterns
  - lightweight verb normalization where practical

**Tasks**
- Split evidence extraction from final resolution.
- Preserve one shared resolver so output semantics remain aligned across languages.
- Model mood as attached evidence rather than burying it inside ad hoc branches.
- Run the PR0 benchmark before the refactor, during milestone checks, and before merge.

**Acceptance**
- ZH benchmark does not regress below the agreed baseline.
- EN and IT core intent accuracy reaches the benchmark gate.
- High-risk subsets are reported separately, not hidden in one aggregate score.

**Execution snapshot (2026-03-21)**
- Added explicit EN/IT negation intercept rules and wired them into shared resolver flow:
  - `src/services/input/liveInputRules.en.ts`
  - `src/services/input/liveInputRules.it.ts`
  - `src/services/input/liveInputClassifier.ts`
- Expanded IT activity lexicon coverage so migrated lexicon-source rules preserve prior activity detection behavior.
- Re-ran benchmark and refreshed artifact (`docs/benchmarks/pr0-baseline.latest.json`):
  - live-input intent: `100.00% (18/18)`
  - high-risk negation subset: `100.00% (3/3)`
  - activity category: `100.00% (18/18)`
  - todo category: `100.00% (18/18)`
- Split ZH signal extraction out of resolver path into:
  - `src/services/input/signals/zhSignalExtractor.ts`
  - `src/services/input/liveInputClassifier.ts` now consumes the extractor and keeps shared decision semantics.
- Added shared resolver module for score aggregation and final decision output:
  - `src/services/input/resolver/liveInputResolver.ts`
  - `src/services/input/liveInputClassifier.ts` now focuses on language-specific evidence assembly and context routing.

**Category lexicon calibration (2026-03-21)**
- Tuned category keyword coverage to resolve remaining work/study boundary misses:
  - `src/services/input/lexicon/categoryLexicon.en.ts` (added probability/statistics-focused study terms)
  - `src/services/input/lexicon/categoryLexicon.zh.ts` (added `周报`/`准备周报` work signals)

### PR4 - Magic Pen Category And Fallback Hardening

**Goal**
- Make Magic Pen local behavior predictable, conservative, and measurable.

**Primary files**
- `src/services/input/magicPenParser.ts`
- `src/services/input/magicPenParserLocalFallback.ts`
- `src/services/input/magicPenTodoSalvage.ts`
- `src/services/input/magicPenDraftBuilder.ts`
- `src/features/chat/MagicPenSheet.tsx`
- `src/store/magicPenActions.ts`
- `src/features/chat/chatPageActions.ts`
- `api/magic-pen-parse.ts`
- `src/server/magic-pen-prompts.ts`

**Frozen fallback spec**
- ZH fallback:
  - keep the current richer local capability
  - support `activity_backfill`, `todo_add`, and `unparsed`
  - retain existing salvage where it is already reliable
- EN fallback:
  - only high-confidence single-segment `activity`, `mood`, or `todo_add`
  - no `activity_backfill`
  - no multi-segment split
  - no local time inference
  - uncertain input becomes `unparsed`
- IT fallback:
  - same conservative envelope as EN
  - allow limited inflection and gender-form tolerance
  - still no local backfill or complex time parsing

**Tasks**
- Stop defaulting Magic Pen todo drafts to hard-coded `life` when category can be computed later.
- Allow draft-stage category to remain unset when that produces cleaner behavior.
- Classify todo category from localized text before commit, then refine only if confidence is low.
- Ensure non-hit EN and IT fallback samples fail safely into `unparsed`.

**Acceptance**
- Magic Pen todo category quality improves on the benchmark set.
- EN and IT fallback behavior is stable against the written spec.
- Fast path and parser path no longer drift on obvious simple cases.

### Quantitative Gates

- ZH regression rule: no significant drop from the PR0 baseline.
- EN and IT live-input core intent accuracy target: `>= 90%`.
- High-risk subsets must be reported separately:
  - future plan vs actual activity
  - negation
  - mood about last activity
- Magic Pen EN and IT fallback target: `>= 85%` on conservative sample sets.
- Magic Pen safety rule: ambiguous non-hit cases should become `unparsed`, not incorrect persisted records.
- Any PR that changes classifier behavior should include benchmark output in review notes.

### Explicit Non-Goals

- Do not rewrite all multilingual logic in one PR.
- Do not replace the AI Magic Pen parser with a fully rule-based system.
- Do not merge `DiaryClassifierCategory` into local `ActivityRecordType`.
- Do not add heavy NLP dependencies unless benchmark evidence later proves they are needed.
- Do not treat the plant-system archive below as the active plan for this workstream.

### Resume Order For This Mainline

1. Read `LLM.md`.
2. Read this file and follow the PR order in this override section.
3. Read `docs/PROJECT_MAP.md`.
4. Read `docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md`.
5. Read `docs/LEXICON_ARCHITECTURE.md`.
6. Read Magic Pen specs and prompt docs before starting `PR4`.
7. Start execution from `PR0`, not from direct refactor work.

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

- [x] 生成按钮状态机（00:00-19:59 禁用；20:00-23:59 可用；次日首次打开自动兜底；未生成时根系可持续增长到当日 24:00）。
- [x] 二次确认弹窗：确认后不可逆，不提供重新生成入口。
- [x] 破土动画组件 `PlantRevealAnimation` 与 `PlantImage` 展示串联。
- [x] 实现素材检索四级降级：`plantId` 精确 -> 同 rootType+stage -> rootType 默认 mid -> `sha_mid_001`。
- [x] 处理特殊场景：空气植物（AND 条件）、娱乐主导植物、无记录日兜底文案。
- [x] 生成后锁定规则：当天植物生成后不再因活动变更而回刷。

**Phase 4 execution snapshot（2026-03-22）**：

- `src/store/usePlantStore.ts`：补齐 next-day first-open auto-backfill（上一日缺失记录时自动触发一次补生成），并将植物生成请求显式透传 `lang`。
- `src/features/report/plant/PlantRootSection.tsx`：生成前增加不可逆确认弹窗；生成失败时回落统一错误提示。
- `src/i18n/locales/{zh,en,it}.ts`：新增植物生成确认与失败提示文案，保持三语一致。
- `src/store/usePlantStore.test.ts`：新增自动补生成日期推导与单日单次尝试规则单测。
- `src/features/report/plant/PlantRevealAnimation.tsx` + `src/features/report/plant/PlantImage.tsx`：落地揭晓动画与图片展示串联。
- `src/features/report/plant/plantImageResolver.ts`：实现四级素材降级链路，并新增 `plantImageResolver.test.ts` 覆盖。
- `src/features/report/plant/plantSpecialScenario.ts`：按空气植物 AND 条件与娱乐主导比例识别特殊日，并在 `PlantRootSection` 展示对应揭晓文案。
- `src/i18n/locales/{zh,en,it}.ts`：补齐无记录日兜底提示与特殊场景揭晓文案。
- `src/features/report/plant/PlantImage.tsx` + `api/plant-asset-telemetry.ts`：新增植物素材解析埋点，上报命中 fallback level（1-4）。
- `api/live-input-dashboard.ts` + `src/features/telemetry/LiveInputTelemetryPage.tsx`：将 plant fallback telemetry 并入 `/telemetry/live-input` 统一看板展示。

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

- [x] 统一 `activityType` 枚举语义：`study/work/social/life/entertainment/health/mood`，禁止再写入 `待分类/未分类` 等自由文本。
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
