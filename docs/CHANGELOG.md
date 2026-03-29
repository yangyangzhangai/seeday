# Changelog

All notable changes to this repository are documented here.

## Documentation Isomorphism Logging Rules

1. Any structural/interface/code-path change must include one changelog line in the same PR.
2. Changelog entries must reference both code path and doc path updates.
3. If `npm run lint:docs-sync` scope is touched, the entry must mention doc-sync impact.

## 2026-03-29 - UX: 记录页日期圆点支持无限左滑查看历史

### Changed

- `src/features/chat/components/DatePicker.tsx`
  - 日期圆点条改为横向滚动时间轴，支持持续左滑。
  - 当滚动接近最左侧时自动补充更早日期（按 21 天分段预加载），实现历史日期无限延展。
  - 增加横向吸附（scroll snap），滑动停止后自动贴合到最近日期圆点，提升手感与可读性。
  - 保留未来日期禁用策略，并在切换日期后自动滚动居中到当前选中日期。

### Validation

- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（补充本次记录页日期交互改动）。

## 2026-03-29 - Test: AI 建议模式 P7 回环补测（窗口边界/跨日重置/自动凝结）

### Changed

- `src/store/useAnnotationStore.ts`
  - 导出 `getSuggestionPeriod(...)` 与 `shouldResetStats(...)` 供单测直接校验窗口边界与跨日重置规则。
  - 修复 `triggerAnnotation` 内同名变量 `period` 重复声明，避免构建/测试阶段编译失败。
- `src/store/useAnnotationStore.test.ts`（新增）
  - 新增 suggestion 时间窗口边界测试（`06:00/13:00/19:00` 分段）与 0 点跨日重置判定测试。
- `src/components/feedback/AIAnnotationBubble.tsx`
  - 抽离 `runSuggestionAcceptFlow(...)`，将“点击建议 -> 记录 accepted -> 自动凝结”流程函数化，便于单测覆盖。
  - 调整 `handleDismiss` 声明顺序，避免在 effect 依赖中前置引用。
- `src/components/feedback/AIAnnotationBubble.test.ts`（新增）
  - 覆盖 activity/todo 建议接受分支，以及异常 suggestion 的跳过分支；验证 accepted 成功后会触发 `handleCondense()`。

### Validation

- `npx vitest run src/store/useAnnotationStore.test.ts src/components/feedback/AIAnnotationBubble.test.ts src/server/annotation-handler.test.ts src/lib/suggestionDetector.test.ts` ✅
- `npm run lint:all` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（P7 子任务状态：单测补齐与 lint:all 已完成）。

## 2026-03-29 - Fix: 日记贴纸埋点接入 telemetry_events + 看板聚合

### Changed

- `src/services/input/reportTelemetryEvent.ts`（新增）
  - 新增 `reportTelemetryEvent(...)`，将 `diary_sticker_deleted` / `diary_sticker_reordered` / `diary_sticker_restored` 事件统一写入 Supabase `telemetry_events`。
- `src/features/report/ReportDetailModal.tsx`
  - 在 `handleDeleteSticker` 上报 `diary_sticker_deleted`（`stickerId/reportId/date`）。
  - 在 `handleDragEnd` 贴纸换序成功时上报 `diary_sticker_reordered`（`newOrder/reportId/date`）。
- `api/live-input-dashboard.ts`
  - 聚合查询新增 `telemetry_events`，筛选 `diary_sticker_*` 事件并并入 `/api/live-input-dashboard`。
  - `summary` 新增 `diaryStickerCount`，分布新增 `diaryStickerActions`，日序列新增 `diaryStickerCount`，`recentEvents` 新增 `diary_sticker` 事件明细字段。
- `src/services/input/liveInputTelemetryApi.ts`
  - Dashboard/RecentEvent 类型新增 diary sticker 字段与事件类型，保证前后端契约一致。
- `src/features/telemetry/LiveInputTelemetryPage.tsx`
  - 看板新增「Diary Sticker Ops」统计卡、`Diary Stickers` 日序列表头、`Diary Sticker Actions` 分布区块、Recent Events 贴纸事件详情展示。

### Validation

- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（贴纸埋点状态由待处理改为主链路完成）。
- 更新 `api/README.md` 与 `src/api/README.md`（补充 diary sticker 聚合字段说明）。

## 2026-03-29 - Feature: 日记详情页布局重构 + 图表贴纸化

### Changed

- `src/store/useReportStore.ts`
  - 新增 `StickerItem` 接口（`id` / `visible` / `x` / `y`）
  - `Report` 接口新增 `stickerLayout?: StickerItem[]`，通过 Zustand persist 本地持久化贴纸状态

- `src/features/report/ReportDetailModal.tsx`
  - **Page 1** 重排：植物 → AI 观察日记（从 Page 2 移来）→ 待办事项
  - **Page 2** 重排：活动图表贴纸 + 心情图表贴纸 → 手写日记
  - 移除 `CollapsibleSection`（收起/展开按钮），改为 `StickerWrapper` 贴纸组件
  - 贴纸支持：X 键删除（`visible: false`）、拖拽把手调换顺序，状态实时写入 `updateReport`
  - 图标依赖：`Bookmark` → `X` + `GripVertical`（lucide-react）

- `src/features/report/DiaryBookViewer.tsx`
  - **day-left 页**：活动/心情数据移出，改为植物 → AI 观察日记 → 任务统计
  - **day-right 页**：原 AI 观察日记移出，改为活动分类列表 + 心情光谱条 → 我的日记
  - **ExpandedView**：左侧显示植物 + AI 观察 + 任务，右侧显示活动/心情摘要 + 我的日记
  - 书架翻页视图与详情页布局保持一致

### ⚠️ 待处理（埋点未完成）

- 贴纸删除、贴纸换序等用户行为**尚未上报埋点**，详见 `docs/CURRENT_TASK.md` 中"日记贴纸埋点"待办项

### Validation

- `npx tsc --noEmit` ✅

### Doc Sync

- `docs/CURRENT_TASK.md` 已补充贴纸埋点待办项

## 2026-03-29 - Feat: AI 建议模式两层过滤主链路落地（P0-P6）

### Changed

- `src/types/annotation.ts`
  - 扩展 suggestion 契约：`PendingTodoSummary.dueAt`、`AIAnnotation.suggestionAccepted`、`AnnotationRequest.userContext.statusSummary/contextHints/frequentActivities/allowSuggestion/consecutiveTextCount`。
- `src/lib/buildStatusSummary.ts`（新增）
  - 新增客户端状态摘要构建器，统一输出短摘要文本和高频活动列表。
- `src/lib/suggestionDetector.ts`（新增）
  - 新增情境提示器，按优先级选取最多 2 条 context hints。
- `src/store/useAnnotationStore.ts`
  - 新增 suggestion 专用门控状态（分时段计数、日上限、最小间隔、不可连续 suggestion）。
  - 接入 `statusSummary/contextHints/frequentActivities` 透传。
  - 新增 `recordSuggestionOutcome(...)` 与 `getAdaptiveMinInterval()`（7 天接受率驱动 30min/1h/2h）。
- `src/server/annotation-prompts.ts`
  - 新增 suggestion-aware prompt 组装，支持普通批注与 suggestion JSON 双路输出指令。
- `src/server/annotation-handler.ts`
  - suggestion 模式从 overwork 专属改为客户端门控驱动（`allowSuggestion`）。
  - 新增双格式 suggestion 解析兼容：
    - v2: `{"mode":"suggestion",...}`
    - legacy: `{"message":...,"type":...}`
  - suggestion 解析失败时回退普通批注。
- `src/components/feedback/AIAnnotationBubble.tsx`
  - 点击建议后自动记录接受结果并触发自动凝结；X 关闭/超时时记录未接受。
- `src/lib/dbMappers.ts`
  - `annotations` 映射新增 `suggestion_accepted` 读写支持。
- 文档同步：`api/README.md`、`src/api/README.md`、`src/store/README.md`、`docs/CURRENT_TASK.md`。

### Added Tests

- `src/server/annotation-handler.test.ts`
  - 覆盖 v2 suggestion JSON 和 legacy suggestion JSON 解析分支。
- `src/lib/suggestionDetector.test.ts`
  - 覆盖情境提示优先级 Top-2 选择。

### Doc-sync impact

- 本次改动涉及 `src/**`、`api/**`、`docs/**` 多处契约与状态文档，已同步 `docs/CURRENT_TASK.md` 与本文件。

## 2026-03-29 - UI: 同步 Tshine UI 的专注页与我的页视觉

### Changed

- `src/features/growth/FocusMode.tsx`
  - 专注设时界面改为深色沉浸式环形刻度风格，支持拖拽调时、预设时长快捷按钮、玻璃风主按钮与一致的结束确认弹层。
- `src/features/growth/FocusTimer.tsx`
  - 运行态计时界面改为与设时界面一致的刻度环与玻璃中心盘，统一倒计时/正计时视觉反馈与结束按钮样式。
- `src/features/profile/ProfilePage.tsx`
- `src/features/profile/components/UserInfoCard.tsx`
- `src/features/profile/components/AIModeSection.tsx`
- `src/features/profile/components/AIAnnotationDropRate.tsx`
- `src/features/profile/components/DailyGoalToggle.tsx`
- `src/features/profile/components/MembershipCard.tsx`
- `src/features/profile/components/SettingsList.tsx`
  - 我的页与卡片组件统一切换为浅暖玻璃风（卡片材质、开关、标签、列表行与会员卡视觉），保留原有 store/api 行为与交互逻辑。

### Validation

- `npx tsc --noEmit` ✅
- `npm run build` ✅

### Doc Sync

- `docs/CURRENT_TASK.md` 已同步记录本次 UI 迁移范围。

## 2026-03-28 - Fix: 记录页恢复语言与登录/退出交互

### Changed

- `src/features/chat/components/DatePicker.tsx`
  - 在记录页顶部恢复语言切换入口（`LanguageSwitcher`）。
  - 恢复登录/退出交互：未登录显示登录按钮，已登录显示退出按钮并复用原确认文案。
  - 头像区域恢复上传入口：点击头像可选择图片并调用 `updateAvatar` 更新用户头像。

### Validation

- `npx tsc --noEmit` ✅

### Doc Sync

- `docs/CURRENT_TASK.md` 已同步记录本次交互恢复改动。

## 2026-03-28 - UI: 导航统一回到底部（移除桌面侧边导航）

### Changed

- `src/components/layout/BottomNav.tsx`
  - 移除桌面侧边导航，恢复全端统一底部导航形态。
  - 底部导航容器最大宽度调整为 `max-w-[960px]`，确保桌面端也保持底部悬浮且与主内容宽度一致。
- `src/App.tsx`
  - 移除桌面侧边导航预留内边距（删除 `md:pl-24`），避免主内容左侧出现空白。

### Doc Sync

- `docs/CURRENT_TASK.md` 已同步补充该导航回退决策。

## 2026-03-28 - UI: 桌面端 + 移动端双端适配骨架

### Changed

- `src/components/layout/BottomNav.tsx`
  - 保留移动端底部胶囊导航（`md` 以下），新增桌面端左侧悬浮竖向导航（`md` 及以上）。
- `src/App.tsx`
  - `PageOutlet` 增加桌面模式侧边导航留白（`md:pl-24`）和底部留白调整（`md:pb-8`）。
  - 主壳背景在桌面模式切换为暖色径向渐变，移动端维持原背景。
- `src/features/growth/GrowthPage.tsx`
- `src/features/profile/ProfilePage.tsx`
- `src/features/report/ReportPage.tsx`
  - 页面主容器由固定手机宽度扩展为响应式（移动 `max-w-[430px]`、桌面 `max-w-[980px]`），桌面增加圆角边框与卡片阴影。
- `src/features/chat/ChatPage.tsx`
- `src/features/chat/ChatInputBar.tsx`
  - 聊天主容器与输入区最大宽度由 `430` 调整为 `960`，确保桌面端时间线与输入区可正常拉伸。

### Doc Sync

- `docs/CURRENT_TASK.md` 已同步记录本次双端适配改动范围与文件清单（满足 docs-sync 约束）。

## 2026-03-28 - Fix: 报告页恢复植物/根系可见性

### Changed

- `src/features/report/plant/PlantRootSection.tsx`
  - 页面挂载时补充一次今日消息加载（当 chat store 为空时触发 `fetchMessages`），随后刷新根系片段，避免仅显示空白画布。
  - 土壤画布上边距由 `120` 调整为 `40`，恢复根系主区域可见高度。
  - 在未生成植物状态增加顶部小苗预览浮层，保留"植物 + 根系"视觉连续性。
- `src/features/report/plant/PlantRootSection.tsx`
  - 改为按今日时间窗调用 `loadMessagesForDateRange(...)` 预热聊天数据，再刷新根系，减少 report 首屏拿不到 messages 的情况。
  - 生态球层移动到画布容器内并提升层级，避免被画布上层截断。
- `src/features/report/plant/SoilCanvas.tsx`
  - 增加土壤底色兜底（图片未命中时不再显示白板）。
  - 无根系数据时渲染轻量静态根系占位，避免空白区域观感。
- `src/features/report/ReportPage.tsx`
  - 修复报告页主容器丢失 `flex-col` 导致 `PlantRootSection` 的 `flex-1` 区域塌陷问题（症状：生态球与根系整体不显示，按钮贴顶）。

### Validation

- `npx tsc --noEmit` ✅

## 2026-03-28 - UI: 对齐 Tshine UI 原型视觉（保留现有业务逻辑）

### Changed

- 统一主视觉为原型的浅暖玻璃风格，并保持现有 store/api 逻辑不变：
  - `src/index.css`：新增 Inter + Material Symbols，统一全局基准字体与背景。
  - `src/components/layout/BottomNav.tsx`：重做底部导航为原型同款悬浮玻璃圆角胶囊样式（图标切换态保持路由逻辑）。
  - `src/App.tsx`：主布局移除全局 Header，改由页面自身头部承载；调整 `PageOutlet` 底部留白以配合新导航。
- Growth / Report / Profile 三页的外层容器与头部改为原型一致的移动端卡片画布与磨砂头部视觉：
  - `src/features/growth/GrowthPage.tsx`
  - `src/features/report/ReportPage.tsx`
  - `src/features/profile/ProfilePage.tsx`
- Growth 页局部组件配色与按钮风格向原型靠齐（不改动作与数据流）：
  - `src/features/growth/BottleList.tsx`
  - `src/features/growth/GrowthTodoSection.tsx`

### Validation

- `npx tsc --noEmit` ✅
- `npm run build` ✅

## 2026-03-28 - Feat: EN/IT Phase 1 — 词库框架升级（动词形态生成器 + 地点检测）

### Added

- **`activityLexicon.en.ts`**: 补充缺失基础动词 `eat/eating/ate/eaten`、`sleep/sleeping`、`dance/dancing/danced`、`sing/singing/sang`；新增 `enPlaceNouns` 导出（18 个非 strongPhrases 场所名词：pool、library、park、cafe 等）。
- **`liveInputRules.en.ts`**: 导入并导出 `EN_PLACE_NOUNS`。
- **`activityLexicon.it.ts`**: 新增 `ItVerbEntry` 类型 + `itActivityVerbData` 表（34 个意大利语动词，含不规则变位信息）；新增 `itPlaceNouns` 导出（24 个场所名词）。
- **`liveInputRules.it.ts`**: 新增 `generateItVerbForms()` 函数，每个动词自动生成 6 种形态（不定式、动名词、过去分词、第一人称现在时、`sto+动名词`、`ho+过去分词`）；`IT_ACTIVITY_VERBS` 合并所有生成形态（非破坏性扩展）；导出 `IT_PLACE_NOUNS`。
- **`latinSignalExtractor.ts`**: 新增 `hasEnGoToPlace()` 和 `hasItGoToPlace()` 结构化地点检测函数，`extractLatinSignals()` 的 `hasActivity` 现同时包含地点检测结果；EN/IT 语言识别列表新增 30+ 个意大利语特有动词形态（`vado`、`faccio`、`mangio`、`dormo`、`mangiando`、`mangiato` 等），确保单词意大利语输入能被正确识别。
- **测试**: `liveInputClassifier.i18n.test.ts` 新增 34 个回归测试（EN 13 个 + IT 21 个）；全部通过，无现有测试回归。

### Why

意大利语动词变位复杂，原有词表依靠手动维护所有形态，导致 `mangio`（我在吃）、`dormo`（我在睡）、`vado al cinema`（去电影院）等常见输入被误判为心情。英语缺少 `eat/sleep/dance/sing` 等基础动词，以及 `at the library`、`went to the park` 等场所类活动表达。

---

## 2026-03-28 - Feat: ZH 词库框架优化（动词数据驱动 + 独立名词活动识别）

### Changed

- **`activityLexicon.zh.ts`**: 移除 11 个与 go+place 逻辑重复的 `去+地点` strongPhrases（`去超市`、`去医院` 等，均已由动词+地点结构覆盖）；移除 11 个可由 verb+object 框架覆盖的冗余短语（`画画`、`弹琴` 等）；新增 12 个动词至 `verbs` 列表（`画`、`弹`、`唱`、`跳`、`踢`、`织`、`绣`、`折`、`喝`、`开`、`包`、`登`）；新增 `zhStandaloneActivityNouns` 导出（15 个独立名词：漫画、游戏、钢琴、象棋等）。
- **`liveInputRules.zh.ts`**: 导入并导出 `ZH_STANDALONE_ACTIVITY_NOUNS`；新增乐器/舞蹈对象词至 `ZH_ACTIVITY_OBJECTS`（`琴`、`吉他`、`钢琴`、`舞` 等）。
- **`zhSignalExtractor.ts`**: `hasActivitySignal` 新增短名词兜底逻辑（≤4 字纯名词匹配 `ZH_STANDALONE_ACTIVITY_NOUNS`）。
- **`liveInputClassifier.ts`**: `hasShortActionShell` 由硬编码正则改为数据驱动（读取 `ZH_ACTIVITY_VERBS`），新增 `ZH_SHORT_SHELL_MOVEMENT_VERBS` 常量隔离方向动词避免 verb+object 误判。
- **测试**: `liveInputClassifier.test.ts` 新增 10 个爱好/独立名词活动回归测试（画画、弹琴、漫画、游戏等）。

### Why

原有修复是"治标不治本"的逐条补充，词表与检测逻辑割裂。框架升级后：动词列表为唯一真相源，`hasShortActionShell` 自动感知新增动词，`去+地点` 类无需重复维护。

---

## 2026-03-26 - Fix: 日记页面布局适配手机端（按钮不再与导航重叠）

### Fixed

- **ReportPage**：`h-[calc(100vh-64px)]` → `h-full`，正确适配 PageOutlet 的 `pt-14 pb-16` 内边距（之前多出 56px 导致溢出）。
- **PlantRootSection**：从 `absolute inset-0` 改为 `h-full flex flex-col` 相对流布局；画布区域 `flex-1 min-h-0 overflow-hidden`；生成按钮改为正常流底部（`px-4 py-3`），无需 `env(safe-area-inset-bottom)` 偏移，天然不与底部导航重叠；DayEcoSphere 覆盖层仍为 `absolute top-0` 但在外层容器之上，弹窗不被裁剪。
- **DayEcoSphere 心情弹窗**：调整内容顺序为"心情分布→能量曲线"（与参考截图一致）；弹窗背景色改为 `rgba(248,242,229,0.94)` 更暖米黄；能量曲线颜色改为暖棕 `#b08060`（匹配参考截图色调）。

---

## 2026-03-26 - Feat: 日记页面植物场景全屏沉浸式重构

### Changed

- **全屏沉浸式植物场景**：日记页面植物区域去掉所有卡片边框，土壤根系画布填满整个内容区。
  - `ReportPage.tsx`：内容区由 `p-4 space-y-4` 改为 `flex-1 relative overflow-hidden`，不再单独渲染 `DayEcoSphere`。
  - `PlantRootSection.tsx`：去掉 `bg-white p-4 rounded-xl shadow-sm border` 卡片样式，改为 `absolute inset-0`；新增 `onOpenDiaryBook` prop；`DayEcoSphere` 作为 `z-20` 顶部浮层嵌入；植物图片为中部绝对定位浮层；生成按钮为底部浮层（含 `safe-area-inset-bottom`）；空状态改为磨砂玻璃小卡片浮层；移除 `resolvePlantSpecialScenario` 及未使用变量。
  - `SoilCanvas.tsx`：移除外层 `rounded-2xl border p-3` 包裹 div，画布 div 改为 `w-full h-full`（无固定高度）；图例改至 `top-3 right-3`；缩放控件改为 `absolute bottom-3 left-3` 内置浮层；合并 `wrapperRef` 与 `canvasRef` 为单一 ref。
  - `DayEcoSphere.tsx`：外层 div 改为 `pointer-events-none`，交互元素加 `pointer-events-auto`；弹窗改为暖沙色磨砂玻璃风格（`rgba(245,238,224,0.90)` + `backdrop-blur-14px`），匹配参考设计图。

---

## 2026-03-26 - Feat: 生态球第三个球接入查看日记本功能

### Changed

- **DayEcoSphere 右球**：将原"待解锁"占位球（✨，disabled）改为可点击的"日记本"入口。
  - 图标从 ✨ 改为 📔，颜色改为暖棕色 `#a78b6e`，移除 `disabled` 属性。
  - 新增 `onOpenDiaryBook?: () => void` prop，由 `ReportPage` 注入 `() => setShowDiaryBook(true)`。
  - 新增 i18n key `eco_sphere_diary_label`（zh: 日记本 / en: Diary / it: Diario）。
  - 文件：`src/features/report/plant/DayEcoSphere.tsx`、`src/features/report/ReportPage.tsx`、`src/i18n/locales/{zh,en,it}.ts`。

---

## 2026-03-25 - Feat: 日记界面植物上方生态球（DayEcoSphere）

### Added

- **DayEcoSphere 组件**：在日记页面植物根系区域上方新增三个玻璃质感生态球。
  - 左球（🌙 心情）：点击展开今日心情能量曲线（SVG 折线图）+ 心情分类饼图，复用 `MoodPieChart`。
  - 中球（🌿 活动）：点击展开今日活动分类圆环图，复用 `ActivityCategoryDonut`。
  - 右球（✨ 待解锁）：暂为占位，显示为半透明禁用态。
  - 晚上 20 点后在气泡下方显示提示文字，说明数据将归入今日日记。
  - 数据来源与日记报告保持一致（`computeActivityDistribution`、`computeMoodDistribution`、`computeMoodEnergyTimeline` 均来自今日消息）。
  - `src/features/report/plant/DayEcoSphere.tsx` — 新建组件（含 `MoodEnergyLine` SVG 子组件 + `GlassBubble` 子组件）。
  - `src/features/report/reportPageHelpers.ts` — 新增 `MoodEnergyPoint` 类型、`computeMoodDistribution`、`computeMoodEnergyTimeline` 导出函数。
  - `src/features/report/ReportPage.tsx` — 在 `<PlantRootSection />` 上方挂载 `<DayEcoSphere />`。
  - `src/i18n/locales/{zh,en,it}.ts` — 新增 7 个 i18n key（`eco_sphere_*`）。

---

## 2026-03-25 - Feat: 聊天输入框草稿持久化

### Added

- **输入框草稿缓存**：用户在聊天输入框输入的内容现在会自动保存到 `localStorage`，切换页面或窗口后回来仍可继续编辑；发送成功后草稿自动清除。
  - `src/features/chat/ChatPage.tsx` — `input` 初始值改为懒加载读取 `localStorage.getItem('chat_input_draft')`；新增 `useEffect` 监听 `input` 变化同步写入/删除 `chat_input_draft` key；`setInput('')` 触发空值时自动 `removeItem`，无需额外改动 `handleSend`。

---

## 2026-03-25 - Fix: 跨天打开网页显示昨日数据问题

### Fixed

- **ChatPage 初始化跳过跨天刷新的 bug**：`hasInitialized` 持久化到 localStorage，导致第二天打开网页时 init useEffect 直接 `return`，不拉取今日数据，跨天定时器最长要等 30 秒才刷新。
  - `src/features/chat/ChatPage.tsx` — init useEffect 中当 `hasInitialized=true` 时，先调用 `checkAndRefreshForNewDay()`，若检测到日期已变更则立即触发 `fetchMessages()`。
  - 同日内页面切换行为不变（`currentDateStr === todayStr` 时 `checkAndRefreshForNewDay` 为空操作）。

---

## 2026-03-25 - Diary Rebuild Audit: D4 + D6 Already Complete

### Audit Findings (no code changes)

Code audit against `docs/DIARY_REBUILD_PLAN.md` revealed two tasks already fully implemented but undocumented:

- **D4 (formatForDiaryAI)** — `src/lib/report-calculator/formatter.ts` already uses every field of `ComputedResult`: `mood_records`, `spectrum` (with anomaly flags), `light_quality` (focus/scatter/active/passive/todo), `energy_log` (with per-slot mood), `gravity_mismatch`, `history_trends`. ZH/EN two-path, IT falls back to EN (acceptable for AI input). No changes needed.

- **D6 (classify.ts prompt alignment)** — `api/classify.ts` ZH/EN/IT three-language prompts already reflect D1 mood-tag format (`[心情：label]` / `[mood: label]`), D2 daily-goal format (`今日目标：` / `Today's Goal:`), habit check-in and todo sections. Output spec matches `ClassifiedData` type exactly (total_duration_min, items[], todos{completed,total}, energy_log[]). No changes needed.

- **D5 (history trends)** — partially done: `computeHistoryTrend` in `src/lib/report-calculator/core.ts` already tracks energy-level trend (via energy_log high/medium/low). Remaining gap: no cross-day trend for mood-key distribution (happy/anxious/etc. from moodDistribution). To be completed.

- Updated docs:
  - `docs/DIARY_REBUILD_PLAN.md` — D4 marked ✅, D6 marked ✅, D5 marked ⚠️ with gap description
  - `docs/CURRENT_TASK.md` — pending list updated accordingly

## 2026-03-25 - Diary Rebuild Phase 2+4: Visualization Components + i18n

### Added

- V2: `ActivityCategoryDonut` — SVG donut chart from `stats.actionAnalysis` (6-category, percent + total hours):
  - `src/features/report/ActivityCategoryDonut.tsx`

- V4: `SpectrumBarChart` — horizontal bar chart from `SpectrumItem[]` (8-category, emoji, anomaly highlight):
  - `src/features/report/SpectrumBarChart.tsx`

- V6: `LightQualityDashboard` — 3-row comparison bar from `LightQuality` (focus/scatter, active/passive, todo ratio):
  - `src/features/report/LightQualityDashboard.tsx`

- Extended `ReportStats` to carry `spectrum?: SpectrumItem[]` and `lightQuality?: LightQuality`:
  - `src/store/useReportStore.ts` — interface extension + import
  - `src/store/useReportStore.ts` — `generateTimeshineDiary` now saves `computed.spectrum` + `computed.light_quality` into report stats after diary generation

- V7: Integrated three new visualization components into `ReportDetailModal` Page 1 (after existing sections):
  - `src/features/report/ReportDetailModal.tsx` — imports + conditional render blocks

- Added 9 new i18n keys (ZH/EN/IT): `report_activity_category`, `report_spectrum_title`, `report_light_quality_title`, `lq_focus`, `lq_scatter`, `lq_active`, `lq_passive`, `lq_todo_done`, `lq_todo_total`

- Updated docs:
  - `src/features/report/README.md` — visualization components listed

## 2026-03-25 - Report i18n Cleanup + Action/Mood Summary Multilingual

### Changed

- A6: Replaced all hardcoded Chinese strings in report UI components with `t()` i18n calls:
  - `src/features/report/ReportPage.tsx` — page title, diary book button, generate button, early-tip dialog
  - `src/features/report/ReportDetailModal.tsx` — back button labels, date format (ZH/EN locale-aware), generate plant placeholder, swipe hint, my-diary section (title, placeholder, empty state, save button)
  - `src/features/report/ReportStatsView.tsx` — habit check-in title, goal progress title, recurring tasks label, task priority label, priority level labels, check-in status badges

- A7 (partial): Made `generateActionSummary` and `generateMoodSummary` multilingual (ZH/EN/IT):
  - `src/store/reportHelpers.ts` — both functions now accept `lang: SupportedLang = 'zh'`; added EN/IT text variants; `FALLBACK_SUMMARY`, `ACTION_CATEGORY_LABELS`, `ACTION_CATEGORY_ENCOURAGEMENT` now keyed by lang
  - `src/store/reportActions.ts` — callers now pass `currentLang` / `moodLang` to both summary functions

- Added 17 new i18n keys (ZH/EN/IT):
  - `src/i18n/locales/zh.ts`, `en.ts`, `it.ts` — `report_view_diary_book`, `report_generate_button`, `report_early_tip`, `report_early_tip_ok`, `report_back_diary_book`, `report_generate_plant`, `report_swipe_hint`, `report_my_diary`, `report_diary_placeholder`, `report_diary_empty`, `report_save`, `report_habit_checkin`, `report_goal_progress`, `report_goal_done_today`, `report_goal_not_today`, `report_recurring_tasks`, `report_task_priority`

- Updated docs:
  - `src/features/report/README.md` — noted i18n coverage completed for all user-visible strings

## 2026-03-24 - Daily Report Todo Breakdown Refactor

### Changed

- Removed four-quadrant priority stats from daily reports (`priorityStats` field and UI section deleted):
  - `src/store/useReportStore.ts` — removed `priorityStats` from `ReportStats` type
  - `src/store/reportActions.ts` — removed dead `priorityStats` computation (was always zero since priority migrated to `high/medium/low`)
  - `src/features/report/ReportStatsView.tsx` — removed quadrant distribution render block

- Fixed template todos being incorrectly counted in report stats:
  - `src/store/reportHelpers.ts` — `filterRelevantTodos` now skips `isTemplate: true` entries

- Added structured daily todo breakdown, splitting todos into four groups based on bottle linkage and recurrence:
  - `src/store/reportHelpers.ts` — added `computeDailyTodoStats`, `HabitCheckinItem`, `GoalProgressItem`, `DailyTodoStats`
  - `src/store/useReportStore.ts` — added `habitCheckin`, `goalProgress`, `independentRecurring`, `oneTimeTasks` to `ReportStats`; imported `useGrowthStore` in `generateReport` and `generateTimeshineDiary`
  - `src/store/reportActions.ts` — `createGeneratedReport` now accepts `bottles: BottleSnapshot[]` and calls `computeDailyTodoStats` for daily reports; `runTimeshineDiary` accepts `bottles` and computes breakdown for AI input; `buildRawInput` rewritten to include habit check-in, goal progress, completed task titles
  - `src/features/report/ReportStatsView.tsx` — daily UI now shows: habit checkin list, goal progress with star bar, independent recurring count bar, one-time task priority breakdown with completed-title chips

- Updated docs:
  - `src/features/report/README.md` — added `useGrowthStore` to Upstream Dependencies; documented `ReportStats` daily fields

### Validation

- `npx tsc --noEmit`: 0 errors

## 2026-03-22 - Plant Phase 4 Generate Window And Irreversible Confirmation

### Changed

- Updated plant generation store flow in `src/store/usePlantStore.ts`:
  - pass explicit runtime `lang` to `callPlantGenerateAPI(...)`
  - add next-day first-open auto-backfill attempt for the previous date when no previous-day plant record exists
  - persist a per-day backfill-attempt marker to avoid repeated retries on the same local date
- Updated report plant trigger UX in `src/features/report/plant/PlantRootSection.tsx`:
  - require confirmation before generating today's plant (irreversible for the day)
  - surface a localized failure hint when API call throws
- Added new i18n copy for plant-generation confirmation/error states in:
  - `src/i18n/locales/zh.ts`
  - `src/i18n/locales/en.ts`
  - `src/i18n/locales/it.ts`
- Added reveal and plant-image display chain in report plant section:
  - `src/features/report/plant/PlantRootSection.tsx`
  - `src/features/report/plant/PlantRevealAnimation.tsx`
  - `src/features/report/plant/PlantImage.tsx`
- Added four-level plant artwork fallback resolver (`plantId` -> `rootType+stage` -> `rootType_early_001` -> `sha_early_001`) in:
  - `src/features/report/plant/plantImageResolver.ts`
  - `src/features/report/plant/plantImageResolver.test.ts`
- Added special-scenario handling for air-day and entertainment-dominant reveal copy, plus empty-day fallback hint wiring in:
  - `src/features/report/plant/plantSpecialScenario.ts`
  - `src/features/report/plant/plantSpecialScenario.test.ts`
  - `src/features/report/plant/PlantRootSection.tsx`
  - `src/i18n/locales/zh.ts`
  - `src/i18n/locales/en.ts`
  - `src/i18n/locales/it.ts`
- Added plant image observability telemetry for fallback-level resolution in:
  - `src/features/report/plant/PlantImage.tsx`
  - `src/features/report/plant/plantImageResolver.ts`
  - `src/api/client.ts`
  - `api/plant-asset-telemetry.ts`
  - `scripts/plant_asset_telemetry_schema.sql`
- Merged plant fallback telemetry into the existing telemetry dashboard surface (`/telemetry/live-input`) in:
  - `api/live-input-dashboard.ts`
  - `src/services/input/liveInputTelemetryApi.ts`
  - `src/features/telemetry/LiveInputTelemetryPage.tsx`
- Updated docs to define `/telemetry/live-input` as the unified telemetry website for multiple instrumentation streams in:
  - `LLM.md`
  - `api/README.md`
  - `src/api/README.md`
  - `docs/PROJECT_MAP.md`
- Added focused store helper coverage in `src/store/usePlantStore.test.ts` for:
  - previous-date derivation (`addDaysToDate`)
  - once-per-day auto-backfill gate (`shouldAttemptPlantAutoBackfill`)

### Validation

- `npx vitest run src/store/usePlantStore.test.ts`
- `npx vitest run src/store/usePlantStore.test.ts src/features/report/plant/plantImageResolver.test.ts`
- `npx vitest run src/store/usePlantStore.test.ts src/features/report/plant/plantImageResolver.test.ts src/features/report/plant/plantSpecialScenario.test.ts src/features/report/plant/plantGenerateUi.test.ts`
- `npx tsc --noEmit`

### Doc-sync impact

- Synced Phase 4 execution state and completion checkboxes in `docs/CURRENT_TASK.md` for generate-window state machine, irreversible confirmation, generated-day lock, reveal-animation chain, artwork fallback order, and special-scenario fallback copy.

## 2026-03-21 - PR4 Magic Pen Fallback And Todo Category Hardening

### Changed

- Removed hard-coded Magic Pen todo draft category default `life` so draft-stage category can remain unset and be resolved later:
  - `src/services/input/magicPenTypes.ts`
  - `src/services/input/magicPenDraftBuilder.ts`
  - `src/services/input/magicPenParserLocalFallback.ts`
  - `src/services/input/magicPenTodoSalvage.ts`
  - `src/features/chat/MagicPenSheet.tsx`
- Updated Magic Pen commit path to classify todo category with explicit runtime language right before write, reducing EN/IT drift from implicit `zh` fallback:
  - `src/store/magicPenActions.ts`
- Hardened local parser fallback with conservative non-ZH behavior: no local backfill/multi-segment inference, only clear single-segment todo signals are drafted, otherwise `unparsed`:
  - `src/services/input/magicPenParser.ts`
  - `src/services/input/magicPenParserLocalFallback.ts`
  - `scripts/multilingual_classification_benchmark.ts`
- Added/updated regression coverage and UI copy for the unset-category flow:
  - `src/services/input/magicPenParser.test.ts`
  - `src/services/input/magicPenDraftBuilder.test.ts`
  - `src/store/magicPenActions.test.ts`
  - `src/i18n/locales/en.ts`
  - `src/i18n/locales/zh.ts`
  - `src/i18n/locales/it.ts`
- Synced doc-sync guard list with the retired chat API by replacing removed `api/chat.ts` with `api/magic-pen-parse.ts` in:
  - `scripts/check-doc-sync.mjs`

### Validation

- `npm run eval:classification:pr0`
- `npx vitest run src/services/input/magicPenDraftBuilder.test.ts src/services/input/magicPenParser.test.ts src/services/input/magicPenTodoSalvage.test.ts src/store/magicPenActions.test.ts`
- `npm run lint:max-lines`
- `npm run lint:docs-sync`
- `npm run lint:state-consistency`
- `npx tsc --noEmit`

### Doc-sync impact

- Synced PR4 execution status and benchmark/check loop in `docs/CURRENT_TASK.md`, and updated `scripts/check-doc-sync.mjs` key-file list to match current API surface.

## 2026-03-21 - Retire Legacy Chat Mode Runtime

### Changed

- Removed the dead companion-response runtime path by deleting `api/chat.ts`, removing `callChatAPI()` from `src/api/client.ts`, and dropping the unused AI chat response branch from `src/store/useChatStore.ts` and `src/store/chatActions.ts`.
- Simplified chat store send semantics to record-only runtime: `ChatState.mode`, `setMode(...)`, and `sendMessage(..., forcedMode)` were removed from `src/store/useChatStore.types.ts`, `src/store/useChatStore.ts`, and dependent growth/focus call sites.
- Added thin legacy filtering for historical `activity_type='chat'` rows so they no longer surface in runtime timeline/state paths:
  - `src/store/useChatStore.ts`
  - `src/features/chat/components/YesterdaySummaryPopup.tsx`
  - `src/store/useAuthStore.ts`
  - `api/plant-generate.ts`
- Narrowed activity typing and compatibility helpers so `chat` is no longer a first-class runtime `ActivityType`, while legacy rows are explicitly recognized and skipped in:
  - `src/lib/activityType.ts`
  - `src/lib/dbMappers.ts`
  - `src/store/chatStoreLegacy.ts`
  - `src/store/reportHelpers.ts`
  - `src/lib/plantActivityMapper.ts`
- Updated module/deploy/docs surfaces to describe `/chat` as record timeline + Magic Pen instead of a dual chat/record mode flow:
  - `README.md`
  - `FEATURE_STATUS.md`
  - `src/features/chat/README.md`
  - `src/api/README.md`
  - `api/README.md`
  - `DEPLOY.md`
  - `docs/PROJECT_MAP.md`
  - `docs/CURRENT_TASK.md`

## 2026-03-21 - AI Companion Persona Sync For Annotation And Diaries

### Changed

- Added shared companion persona definitions in `src/lib/aiCompanion.ts` for the four supported modes: `van`, `agnes`, `zep`, and `spring_thunder`.
- Updated `src/api/client.ts` to auto-attach the active `aiMode` when calling:
  - `callAnnotationAPI(...)`
  - `callDiaryAPI(...)`
- Updated annotation prompt assembly to follow the selected companion persona in:
  - `src/server/annotation-prompts.ts`
  - `src/server/annotation-handler.ts`
- Updated report diary prompt assembly to follow the selected companion persona in `api/diary.ts`.
- Updated plant diary generation to read the authenticated user's persona and apply it in:
  - `api/plant-generate.ts`
  - `api/plant-diary.ts`
  - `src/server/plant-diary-service.ts`
- Added focused prompt wiring coverage in `src/lib/aiCompanion.test.ts`.

### Validation

- `npx.cmd tsc --noEmit`
- `npx.cmd vitest run src/lib/aiCompanion.test.ts`

### Doc-sync impact

- Synced the new AI companion persona flow across API/docs surfaces in `src/api/README.md`, `api/README.md`, `docs/CURRENT_TASK.md`, and `docs/CHANGELOG.md`.

## 2026-03-21 — PR1a Lang Plumbing For Chat/Todo/Refine Paths

### Changed

- Updated chat store language propagation in `src/store/useChatStore.ts` to pass explicit runtime/content language into:
  - `autoDetectMood(...)`
  - `classifyRecordActivityType(...)`
  - low-confidence `callClassifierAPI(...)` refine requests
- Updated extracted timeline actions in `src/store/chatTimelineActions.ts` to forward language when recomputing mood and activity categories.
- Updated shared chat action helpers in `src/store/chatActions.ts`:
  - added runtime/content language resolvers
  - threaded language through `triggerMoodDetection(...)`, `closePreviousActivity(...)`, and `buildInsertedActivityResult(...)`
- Updated todo store refine flow in `src/store/useTodoStore.ts` to forward language for:
  - rule classification
  - todo category normalization
  - low-confidence AI refine calls
- Updated category helper plumbing in `src/lib/activityType.ts` to carry `lang` through nested fallbacks in:
  - `mapClassifierCategoryToActivityType(...)`
  - `normalizeActivityType(...)`
  - `normalizeTodoCategory(...)`
- Updated report-side category usage to accept language-aware classification:
  - `src/store/reportHelpers.ts`
  - `src/store/reportActions.ts`

### Validation

- `npx vitest run src/lib/activityType.test.ts src/store/chatActions.test.ts src/store/useChatStore.integration.test.ts src/store/reportHelpers.test.ts`
- `npx tsc --noEmit`

### Doc-sync impact

- Synced PR1a language-propagation code path updates across `src/store/**` and `src/lib/activityType.ts` with anchor docs `docs/CURRENT_TASK.md` and `docs/CHANGELOG.md`.

## 2026-03-21 — PR0 Multilingual Classification Baseline Setup

### Added

- Added multilingual PR0 fixture sets in `src/services/input/__fixtures__/`:
  - `liveInput.intent.fixture.json`
  - `activity.category.fixture.json`
  - `todo.category.fixture.json`
  - `magicPen.fallback.fixture.json`
- Added benchmark runner `scripts/multilingual_classification_benchmark.ts` to evaluate:
  - live input intent (`kind` + `internalKind`)
  - activity category classification
  - todo category normalization quality
  - Magic Pen local fallback outcomes
- Added npm commands in `package.json`:
  - `eval:classification:pr0`
  - `eval:classification:pr0:artifact`
- Added baseline docs/artifact paths:
  - `docs/benchmarks/PR0_BASELINE.md`
  - `docs/benchmarks/pr0-baseline.latest.json`

### Validation

- `npm run eval:classification:pr0:artifact`
- Baseline snapshot recorded:
  - live-input internal accuracy: `94.44% (17/18)`
  - activity category accuracy: `94.44% (17/18)`
  - todo category accuracy: `72.22% (13/18)`
  - magic-pen local fallback accuracy: `100.00% (6/6)`

### Doc-sync impact

- Synced PR0 execution anchor and baseline evidence across code path updates (`src/services/input/__fixtures__/**`, `scripts/multilingual_classification_benchmark.ts`, `package.json`) and docs (`docs/CURRENT_TASK.md`, `docs/benchmarks/PR0_BASELINE.md`, `docs/CHANGELOG.md`).

## 2026-03-21 — useChatStore Split: Timeline Actions Extracted

### Changed

- Replaced `import type { Message } from './useChatStore'` with `from './useChatStore.types'` across 6 files: `src/store/chatActions.ts`, `src/store/chatActions.test.ts`, `src/store/useChatStore.integration.test.ts`, `src/store/chatHelpers.ts`, `src/store/reportActions.ts`, `src/store/reportHelpers.test.ts`.
- Removed self-referencing type `import('./useChatStore').MoodDescription` in `src/store/useChatStore.ts` (line 635), using `MoodDescription` from `.types` directly.
- Extracted 9 timeline-write actions from `src/store/useChatStore.ts` into new `src/store/chatTimelineActions.ts` using `createChatTimelineActions(set, get)` factory:
  - `insertActivity`, `updateActivity`, `deleteActivity`, `updateMessageDuration`, `updateMessageImage`, `detachMoodFromEvent`, `reattachMoodToEvent`, `convertMoodToEvent`, `detachMoodMessage`.
- `src/store/useChatStore.ts` now uses spread `...createChatTimelineActions(set, get)` to compose the new actions, keeping `ChatState` interface and `persist` config unchanged.
- `src/store/useChatStore.ts` line count: 830 → 716, passing the max-lines error gate (800).

### Validation

- `npx vitest run src/store/chatActions.test.ts src/store/useChatStore.integration.test.ts` — 21/21 tests pass.
- `npx tsc --noEmit` — no type errors.
- `node scripts/check-max-lines.mjs` — no files exceed error limit; `useChatStore.ts` reduced from 830 to 716 lines.

### Doc-sync impact

- Updated `src/features/chat/README.md` ("Store Refactor Update" section) to document the new `chatTimelineActions.ts` file and the updated file layout.
- No change to `docs/TSHINE_DEV_SPEC.md` or `docs/ARCHITECTURE.md` since no architectural contract changed — only internal file decomposition.

## 2026-03-20 — Multi-language Lexicon Optimization & Unified Architecture

### Added

- Created a unified, multi-language lexicon system in `src/services/input/lexicon/`:
    - `types.ts`: Defined `ActivityLexicon`, `MoodLexicon`, `CategoryLexicon`, and `LanguageLexicon` interfaces.
    - `getLexicon.ts`: Implemented a factory for language-based lexicon retrieval (ZH, EN, IT).
    - `activityLexicon.{zh,en,it}.ts`: Centralized 200+ activity terms and verbs.
    - `moodLexicon.{zh,en,it}.ts`: Consolidated mood explicit mappings, activity-to-mood inferences, and sentence patterns.
    - `categoryLexicon.{zh,en,it}.ts`: Centralized activity classification keywords for all supported languages.
- Added `docs/LEXICON_ARCHITECTURE.md` as the core documentation for the new architecture.

### Changed

- Refactored `src/lib/mood.ts` (`autoDetectMood`) to use the new `MoodLexicon` and support the `lang` parameter for multi-language inference.
- Refactored `src/lib/activityType.ts` (`classifyRecordActivityType`) to use the new `CategoryLexicon`, enabling full English and Italian category classification.
- Updated `src/services/input/liveInputRules.zh.ts` to source all its vocabulary from the centralized lexicon, eliminating duplicate lists.
- Updated `src/services/input/magicPenTodoSalvage.ts` to use `zhMoodLexicon` for consistent mood detection.
- Updated `src/services/input/magicPenDraftBuilder.ts` to correctly flag `missing_time` when time resolution is missing, fixing a parsing regression.
- Updated `docs/ACTIVITY_LEXICON.md` and `docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md` to point to the new centralized lexicon architecture.
- Updated `docs/TSHINE_DEV_SPEC.md` to include the `lexicon/` folder in the project structure.

### Validation

- `npx vitest run src/lib/mood.test.ts src/lib/activityType.test.ts src/services/input/liveInputClassifier.test.ts src/services/input/magicPenParser.test.ts src/services/input/magicPenTodoSalvage.test.ts`
- Verified all 129 `liveInputClassifier` tests pass, including context bias and multilingual regressions.
- Verified Magic Pen parsing correctly extracts content and dates after the lexicon migration.

### Doc-sync impact

- Synced the new lexicon architecture across code paths (`src/services/input/lexicon/**`, `src/lib/mood.ts`, `src/lib/activityType.ts`, `src/services/input/liveInputRules.zh.ts`, `src/services/input/magicPenDraftBuilder.ts`) and documentation files (`docs/CHANGELOG.md`, `docs/ACTIVITY_LEXICON.md`, `docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md`, `docs/LEXICON_ARCHITECTURE.md`).

## 2026-03-19 — Chat Reclassify Guard + Timeline Action Area + ChatStore Split

### Added

- Added chat store type module `src/store/useChatStore.types.ts` and legacy activity-type backfill helper `src/store/chatStoreLegacy.ts` to split `useChatStore` structure from runtime actions.
- Added integration regression `only allows mood -> activity conversion for latest record message` in `src/store/useChatStore.integration.test.ts`.

### Changed

- Updated `src/features/chat/components/EventCard.tsx`, `src/features/chat/components/ImageUploader.tsx`, and `src/features/chat/components/TimelineView.tsx` to move image upload trigger into card-active top-right action area and add event->mood quick conversion action.
- Updated `src/features/chat/components/MoodCard.tsx`, `src/features/chat/components/TimelineView.tsx`, and `src/store/useChatStore.ts` so mood/activity mutual conversion is restricted to the latest `record + text` message at both UI and store guard levels.
- Updated `src/store/chatActions.ts` activity->mood reclassify result to set `detached: true` so converted mood cards stay visible in timeline.
- Updated `src/features/chat/chatPageActions.ts`, `src/store/magicPenActions.ts`, `src/store/reportHelpers.test.ts`, `src/store/useChatStore.integration.test.ts`, `src/store/usePlantStore.ts`, and `src/store/useTodoStore.ts` to fix strict typing regressions surfaced by diagnostics.
- Split `src/store/useChatStore.ts` by extracting types/interfaces and legacy backfill helper, reducing the store entry file below the max-lines hard gate.
- Updated `scripts/check-state-consistency.mjs` to remove forced doc-sync mapping for `src/features/growth/GrowthPage.tsx`.
- Updated locale keys in `src/i18n/locales/zh.ts`, `src/i18n/locales/en.ts`, and `src/i18n/locales/it.ts` with `event_to_mood`.

### Validation

- `npm run test:unit -- src/store/useChatStore.integration.test.ts`
- `npm run test:unit -- src/store/reportHelpers.test.ts src/features/chat/chatPageActions.test.ts src/store/magicPenActions.test.ts`
- `npx tsc --noEmit`
- `npm run lint:state-consistency`
- `npm run lint:docs-sync`
- `npm run build`
- `npm run lint:all`

### Doc-sync impact

- Synced this round’s chat/store refactor + behavior corrections across code paths (`src/store/**`, `src/features/chat/**`, `scripts/check-state-consistency.mjs`, `src/i18n/locales/*.ts`) and anchor docs (`docs/CHANGELOG.md`, `src/features/chat/README.md`, `src/store/README.md`, `docs/CURRENT_TASK.md`).

## 2026-03-19 — ActivityType Unified Classification Chain

### Added

- Added unified activity classification utility `src/lib/activityType.ts` and regression tests `src/lib/activityType.test.ts`.
- Added chain-level regression tests `src/store/reportHelpers.test.ts` and `src/lib/plantActivityMapper.test.ts` to lock report/plant consumption of unified `activityType`.

### Changed

- Updated `src/store/useChatStore.ts` and `src/store/chatActions.ts` to stop writing `待分类/未分类`, classify record activities at write-time, and add low-confidence AI refinement without blocking write path.
- Updated `src/store/useTodoStore.ts`, `src/features/growth/GrowthTodoSection.tsx`, `src/features/growth/FocusMode.tsx`, and `src/services/input/magicPenDraftBuilder.ts` so todos are classified on creation and todo-triggered activity records inherit todo category directly.
- Updated `src/store/reportHelpers.ts` to aggregate activity distribution by stored `activityType` instead of keyword secondary classification.
- Updated `src/lib/plantActivityMapper.ts` to prioritize normalized unified `activityType` mapping with legacy compatibility fallback.
- Updated `src/lib/dbMappers.ts`, `src/store/useAnnotationStore.ts`, and `src/types/annotation.ts` to tighten activity type mapping/types and normalize legacy records.
- Updated `docs/CURRENT_TASK.md` classification checklist/acceptance items to completed state.

### Validation

- `npx vitest run src/lib/activityType.test.ts src/lib/plantActivityMapper.test.ts src/store/reportHelpers.test.ts src/store/chatActions.test.ts src/store/useChatStore.integration.test.ts`
- `npx tsc --noEmit`
- `npm run build`
- `npm run lint:all` fails due existing max-lines gate on `src/store/useChatStore.ts` (>800 lines), unrelated to this change set.
- `npm run test:unit` still has pre-existing unrelated failures in `src/server/magic-pen-parse.test.ts`, `src/features/chat/chatPageActions.test.ts`, and `src/services/input/magicPenParser.test.ts`.

### Doc-sync impact

- Synced unified classification implementation changes across code paths (`src/store/**`, `src/lib/**`, `src/features/growth/**`, `src/services/input/**`) with execution docs (`docs/CURRENT_TASK.md`, `docs/CHANGELOG.md`).

## 2026-03-18 — Plant System Phase 3 (Viewport Clamp + Hit-Target Regression Guard)

### Added

- Added viewport math helper `src/features/report/plant/soilCanvasViewport.ts` and unit coverage `src/features/report/plant/soilCanvasViewport.test.ts` for scale clamp, drag-bound clamp, focus offset, and reset-to-center behavior.
- Added performance evidence template `docs/PLANT_P3_PERFORMANCE_SAMPLING_TEMPLATE.md` for WebView FPS/long-task sampling and Gate-D acceptance records.

### Changed

- Updated `src/features/report/plant/SoilCanvas.tsx` with clamped viewport offset, selected-root auto-focus under zoom, and deterministic reset behavior to reduce extreme-zoom unreachable/jitter states.
- Updated `src/features/report/plant/RootSegmentPath.tsx` and `src/features/report/plant/rootInteractionHelpers.ts` to introduce a transparent expanded hit layer (`resolveRootHitStrokeWidth`) for dense-root tap/long-press reliability.
- Updated `src/features/report/plant/PlantRootSection.tsx` empty-state block to a structured guidance card to improve no-root readability.
- Extended `src/features/report/plant/rootInteractionHelpers.test.ts` with hit-target regression assertions.
- Updated `docs/CURRENT_TASK.md` P3 checklist and snapshot to reflect completed boundary/hit/empty-state/template items.

### Validation

- `npm run test:unit -- src/features/report/plant/soilCanvasViewport.test.ts src/features/report/plant/rootInteractionHelpers.test.ts`
- `npx tsc --noEmit`

### Doc-sync impact

- Synced implementation changes in `src/features/report/plant/**` with execution docs `docs/CURRENT_TASK.md` and `docs/CHANGELOG.md`, and added reusable performance sampling artifact in `docs/`.

## 2026-03-18 — Plant Root Realtime Window Fix (Post-20:00)

### Changed

- Updated `src/store/usePlantStore.ts` root refresh gating: removed the `20:00` hard stop so ungenerated days continue mapping completed activities to roots until day rollover (`00:00`), while keeping "generated today" lock behavior unchanged.
- Updated `docs/CURRENT_TASK.md` timing description/checklist wording to align with the implemented rule: root realtime updates continue within the current day and stop on generate-lock or next-day reset.
- Updated product/spec source docs `docs/TimeShine_植物生长_PRD_v1_8.docx` and `docs/TimeShine_植物生长_技术实现文档_v1.7.docx` to unify timing wording: roots keep updating until `24:00` if not generated, and lock immediately after manual/auto generation.

### Validation

- `npm run test:unit -- src/store/usePlantStore.test.ts src/features/report/plant/plantGenerateUi.test.ts`

### Doc-sync impact

- Synced timing-rule behavior between code path (`src/store/usePlantStore.ts`) and task/spec docs (`docs/CURRENT_TASK.md`, `docs/TimeShine_植物生长_PRD_v1_8.docx`, `docs/TimeShine_植物生长_技术实现文档_v1.7.docx`, `docs/CHANGELOG.md`).

## 2026-03-18 — Plant System Phase 3 (UI Polish + Test Backfill)

### Added

- Added test coverage for P3 root interaction and timing flows: `src/store/usePlantStore.test.ts`, `src/features/report/plant/rootInteractionHelpers.test.ts`, `src/features/report/plant/plantGenerateUi.test.ts`, `src/features/report/plant/soilLegend.test.ts`, and `src/features/report/reportPage.integration.test.tsx`.
- Added small helper modules to keep report plant interactions testable and deterministic: `src/features/report/plant/rootInteractionHelpers.ts`, `src/features/report/plant/plantGenerateUi.ts`, and `src/features/report/plant/soilLegend.ts`.

### Changed

- Updated `src/features/report/plant/SoilCanvas.tsx` to move the direction legend into an in-soil right-bottom floating card, keep touch pass-through, and add clamped zoom-control disabled states plus zoom level display.
- Updated `src/features/report/plant/RootSystem.tsx` and `src/features/report/plant/RootSegmentPath.tsx` to improve dense-scene readability (main/side root visual hierarchy and selected-root top-layer rendering).
- Updated `src/features/report/plant/PlantRootSection.tsx` to unify generate-button state UX (daytime locked / evening enabled / generated locked) and upgrade root empty-state presentation.
- Updated `src/store/usePlantStore.ts` by extracting realtime duration resolution (`resolvePlantDurationForMessage`) for explicit P3 timing rule testing.
- Extended locale packs `src/i18n/locales/zh.ts`, `src/i18n/locales/en.ts`, and `src/i18n/locales/it.ts` with root empty-state title and generated-button copy.
- Updated `docs/CURRENT_TASK.md` latest snapshot and P3 checklist status to reflect this round of UI/test completion.

### Validation

- `npm run test:unit -- src/store/usePlantStore.test.ts src/features/report/plant/rootInteractionHelpers.test.ts src/features/report/plant/plantGenerateUi.test.ts src/features/report/plant/soilLegend.test.ts src/features/report/reportPage.integration.test.tsx`

### Doc-sync impact

- Synced code-path changes (`src/features/report/plant/**`, `src/store/usePlantStore.ts`, `src/i18n/locales/*.ts`) with execution anchor docs (`docs/CURRENT_TASK.md`, `docs/CHANGELOG.md`).

## 2026-03-18 — Plant System Phase 3 (Image 1 Interaction Convergence)

### Added

- Added profile direction-config UI `src/features/profile/components/DirectionSettingsPanel.tsx` and wired it into `src/features/profile/components/SettingsList.tsx` so users can set the five direction-category mappings from the “My/Profile” page.

### Changed

- Updated `src/features/report/plant/SoilCanvas.tsx` to remove drag/pan gesture handling, keep button-based zoom/reset, and add in-soil direction legend labels (top/right-top/right-bottom/left-bottom/left-top) bound to live `directionOrder`.
- Updated `src/features/report/plant/PlantRootSection.tsx` and `src/features/report/plant/RootDetailBubble.tsx` to show fixed root detail fields with full info: activity name, start-end time range, duration, type, and focus.
- Updated `src/features/report/plant/SoilCanvas.tsx`, `src/features/report/plant/PlantRootSection.tsx`, and `src/lib/rootRenderer.ts` so root details render as an in-canvas bubble near the selected root tip (instead of below the canvas) and auto-dismiss after 5 seconds.
- Extended locale packs `src/i18n/locales/zh.ts`, `src/i18n/locales/en.ts`, and `src/i18n/locales/it.ts` with root direction legend labels, detail time-range label, soil-canvas reset text, and profile direction-setting copy.
- Updated `docs/CURRENT_TASK.md` Phase 3 / Phase 5 checklist and latest snapshot to reflect the interaction replacement and direction-setting entry completion.

### Doc-sync impact

- Synced implementation status for code paths (`src/features/report/plant/**`, `src/features/profile/components/**`, `src/i18n/locales/*.ts`) with task anchor docs (`docs/CURRENT_TASK.md`, `docs/CHANGELOG.md`).

## 2026-03-18 — Plant System Phase 3 (Report Embedded Root Daytime Experience)

### Added

- Added report-embedded plant root UI components under `src/features/report/plant/`: `PlantRootSection.tsx`, `SoilCanvas.tsx`, `RootSystem.tsx`, `RootSegmentPath.tsx`, and `RootDetailBubble.tsx`.

### Changed

- Updated `src/features/report/ReportPage.tsx` to permanently render the root section directly below the week/month/custom button group, following the frozen IA decision for `/report` default visibility.
- Updated `src/store/usePlantStore.ts` daytime segment refresh logic to support P3 timing rules: `<5m` hidden, `5-15m` visible after completion, `>15m` ongoing segments visible via realtime extension.
- Refined mobile-shell behavior in `src/features/report/ReportPage.tsx` and `src/features/report/plant/SoilCanvas.tsx`: safe-area-aware bottom spacing, bottom-nav avoidance padding, and stronger touch-target/active feedback for non-hover interaction.
- Added first-pass performance tuning for root daytime interactions in `src/store/usePlantStore.ts` and `src/features/report/plant/*`: segment equality short-circuit before state updates, RAF-batched pan updates, and memoized root rendering components.
- Extended locale packs `src/i18n/locales/en.ts`, `src/i18n/locales/zh.ts`, and `src/i18n/locales/it.ts` with root-section labels, generate-status hints, category/focus detail labels, and interaction copy.
- Updated `docs/CURRENT_TASK.md` latest snapshot + P3 checklist to reflect implemented root daytime interaction milestones and remaining mobile/performance hardening item.

### Validation

- `npx tsc --noEmit`
- `npm run lint:docs-sync`

### Doc-sync impact

- Synced implementation status between code paths (`src/features/report/**`, `src/store/usePlantStore.ts`, `src/i18n/locales/*.ts`) and task anchor docs (`docs/CURRENT_TASK.md`, `docs/CHANGELOG.md`).

## 2026-03-18 — Documentation Governance Cleanup (Handover Doc Removal)

### Changed

- Updated `scripts/check-state-consistency.mjs` to require `docs/CHANGELOG.md` as the sole global state-doc gate for code-path changes.
- Removed stale references to deleted `docs/CODE_CLEANUP_HANDOVER_PLAN.md` in active docs: `LLM.md`, `docs/PROJECT_MAP.md`, `PROJECT_CONTEXT.md`, `CONTRIBUTING.md`, `README.md`, `src/features/chat/README.md`, `src/features/auth/README.md`, `src/features/report/README.md`, and `src/api/README.md`.
- Clarified doc governance wording in `LLM.md` and `CONTRIBUTING.md` so session restore and doc-sync anchors now point to `docs/CURRENT_TASK.md` + `docs/CHANGELOG.md`.

### Validation

- `npm run lint:state-consistency`

### Doc-sync impact

- Synced documentation policy to the current repository reality where handover tracking is consolidated into `docs/CURRENT_TASK.md` and `docs/CHANGELOG.md`.

## 2026-03-18 — Plant System Phase 0 (Data Baseline + SQL Fix)

### Added

- Added plant domain types in `src/types/plant.ts` (root type/stage/focus/category, root metrics, daily record, direction config).
- Added DB schema scripts `scripts/plant_p0_schema_up.sql` and `scripts/plant_p0_schema_down.sql` for Phase 0 table setup and rollback.

### Changed

- Extended `src/lib/dbMappers.ts` with `fromDbPlantRecord()` and `toDbPlantRecord()` to normalize `daily_plant_records` app-model <-> DB-row mapping.
- Updated `scripts/plant_p0_schema_up.sql` policy statements from unsupported `CREATE POLICY IF NOT EXISTS` to `DROP POLICY IF EXISTS + CREATE POLICY` for Supabase SQL editor compatibility.
- Synced `docs/CURRENT_TASK.md` as the execution anchor and marked Phase 0 checklist items complete.

### Validation

- `npx tsc --noEmit`
- `npm run lint:docs-sync`
- `npm run lint:max-lines`

### Doc-sync impact

- Added this changelog entry for code/documentation consistency.
- Updated `docs/CURRENT_TASK.md` with Phase 0 completion and handoff snapshot.

## 2026-03-18 — Plant System Phase 1 (Algorithm Layer)

### Added

- Added `src/lib/plantCalculator.ts` with `computeRootMetrics()`, `matchRootType()`, `resolveSupportVariant()`, plus configurable `ROOT_SCORE_CONFIG` and special-day helpers (`isAirPlantDay`, `isEntertainmentDominantDay`).
- Added `src/lib/rootRenderer.ts` with logarithmic length mapping, fixed direction-angle rendering, same-direction root fusion (main/side/extend), seeded path perturbation, and SVG-ready render payload output.
- Added unit tests `src/lib/plantCalculator.test.ts` and `src/lib/rootRenderer.test.ts` covering denominator rules, score competition + tie-break, air/fun/support scenarios, fusion behavior, and deterministic path generation.

### Validation

- `npm run test:unit -- src/lib/plantCalculator.test.ts src/lib/rootRenderer.test.ts`
- `npx tsc --noEmit`

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` to mark Phase 1 algorithm checklist items complete.

## 2026-03-18 — Plant System Phase 2 (Store + API Mainline)

### Added

- Added plant store `src/store/usePlantStore.ts` with day-segment state, generation state, root selection state, direction-order persistence, and 20:00-before realtime sync from chat activities.
- Added plant API endpoints `api/plant-generate.ts`, `api/plant-diary.ts`, and `api/plant-history.ts`.
- Added plant API shared helpers `api/plant-shared.ts` and diary service `api/plant-diary-service.ts` for auth, timezone/day-window handling, DB serialization, and fallback diary generation.
- Added activity-to-plant mapping helper `src/lib/plantActivityMapper.ts`.

### Changed

- Extended `src/types/plant.ts` with `RootSegment`, default direction order, and plant API request/response contracts.
- Extended `src/api/client.ts` with authenticated plant API calls: `callPlantGenerateAPI`, `callPlantDiaryAPI`, and `callPlantHistoryAPI`.
- Updated endpoint/module docs in `api/README.md` and `src/api/README.md` for the new plant routes and bearer-auth contract.
- Updated `docs/CURRENT_TASK.md` to mark Phase 2 checklist complete and set Phase 3 as next execution entry.

### Doc-sync impact

- Synced `docs/CURRENT_TASK.md`, `api/README.md`, and `src/api/README.md` with the new plant data-flow contracts.

## 2026-03-11 — Magic Pen V2 Mode-B + AI-First Parser Cutover (Session-21)

### Changed

- Switched chat interaction to Mode-B in `src/features/chat/ChatInputBar.tsx` and `src/features/chat/ChatPage.tsx`: wand button now toggles Magic Pen mode, and send branches to parse flow only when mode is on.
- Updated `src/features/chat/MagicPenSheet.tsx` to consume send-triggered seed drafts (`initialDrafts` / `initialUnparsedSegments`) and use async parse action with loading/error UX.
- Added server endpoint `api/magic-pen-parse.ts` (GLM-4.7-flash + `ZHIPU_API_KEY`) with robust response parsing fallback: direct JSON parse -> outer object extraction -> safe empty fallback.
- Added frontend client contract `callMagicPenParseAPI()` in `src/api/client.ts` and synced endpoint docs in `api/README.md` and `src/api/README.md`.
- Refactored parser entry `src/services/input/magicPenParser.ts` to async AI-first pipeline; moved local regex parser into `src/services/input/magicPenParserLocalFallback.ts` fallback path.
- Extended type/contracts in `src/services/input/magicPenTypes.ts` and `src/services/input/magicPenDraftBuilder.ts` for AI segment mapping and HH:mm conversion.
- Updated locale packs `src/i18n/locales/en.ts`, `src/i18n/locales/zh.ts`, and `src/i18n/locales/it.ts` with Mode-B and parsing/error keys.
- Updated tests: async parser assertions in `src/services/input/magicPenParser.test.ts`, removed obsolete open/close helper assertions in `src/features/chat/chatPageActions.test.ts`, and added `src/services/input/magicPenDraftBuilder.test.ts`.

### Validation

- `npm run test:unit -- src/services/input/magicPenParser.test.ts src/services/input/magicPenDraftBuilder.test.ts src/store/magicPenActions.test.ts src/features/chat/chatPageActions.test.ts`
- `npx tsc --noEmit`
- `npm run lint:docs-sync`
- `npm run lint:state-consistency`
- `npm run build`

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` with session-21 snapshot and MP0/MP1/MP2/MP4/MP5 checklist progress.
- Updated `docs/CODE_CLEANUP_HANDOVER_PLAN.md` section 8 with this session handover record.
- Updated module/API docs: `src/features/chat/README.md`, `src/api/README.md`, and `api/README.md`.

## 2026-03-11 — Moodauto Write-Path Verification (Phase E)

### Changed

- Added explicit write-path guard regressions in `src/store/chatActions.test.ts`:
  - standalone mood routes with `relatedActivityId` only when recent activity is ongoing.
  - standalone mood does not fallback attach to ended activity (`sendMood(content, undefined)`).
- Revalidated store integration behavior in `src/store/useChatStore.integration.test.ts` for ongoing attach and ended no-attach constraints.

### Validation

- `npm run test:unit -- src/store/chatActions.test.ts src/store/useChatStore.integration.test.ts src/services/input/liveInputClassifier.test.ts`
- `npm run eval:live-input:gold`

### Metrics

- zh gold: `kind_accuracy=88.69%`, `internal_accuracy=82.74%`.
- top mismatches: `new_activity -> standalone_mood (9)`, `activity_with_mood -> standalone_mood (7)`, `mood_about_last_activity -> standalone_mood (6)`.

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` to mark Phase E checklist complete and record the mismatch snapshot.
- Updated `docs/CODE_CLEANUP_HANDOVER_PLAN.md` handover log with write-path verification progress.

## 2026-03-11 — Moodauto Evidence Objectization (Classifier + Telemetry)

### Changed

- Added internal evidence schema in `src/services/input/types.ts`: `LiveEvidence` with `source`, `strength`, `polarity`, `tokens`, and `reasonCode`; exposed as optional `evidence` on `LiveInputClassification`.
- Refactored `src/services/input/liveInputClassifier.ts` to evidence-first scoring: classifier now builds evidence entries, maps evidence to scores centrally, and then resolves `internalKind`.
- Synced telemetry aggregation in `src/services/input/liveInputTelemetry.ts` to count reason codes from evidence while preserving backward-compatible reason counting.
- Added evidence assertions in `src/services/input/liveInputClassifier.test.ts` for planned interception and go/place happened-shell enrichment.

### Validation

- `npm run test:unit -- src/services/input/liveInputClassifier.test.ts src/services/input/liveInputRules.test.ts src/store/chatActions.test.ts src/store/useChatStore.integration.test.ts`
- `npx tsc --noEmit`
- `npm run lint:docs-sync`
- `npm run lint:state-consistency`

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` with session-18 execution snapshot and Phase C completion.
- Updated `docs/CODE_CLEANUP_HANDOVER_PLAN.md` handover log for evidence-objectization slice.

## 2026-03-11 — Moodauto Runtime Reorder (Structure-First + Go/Place)

### Changed

- Reordered zh runtime classification pipeline in `src/services/input/liveInputClassifier.ts` to structure-first order: `future/planned` intercept -> `negated/not occurred` intercept -> ongoing -> completion -> `go + place` -> lexicon -> mood -> context linking -> final dispatch.
- Added `detectGoToPlaceActivity()` in `src/services/input/liveInputClassifier.ts` with happened-shell strengthening (`刚/已经/了/回来`) and explicit reason codes.
- Added `ZH_PLACE_NOUNS` in `src/services/input/liveInputRules.zh.ts` and split non-activity interception into `ZH_FUTURE_OR_PLAN_PATTERNS` + `ZH_NEGATED_OR_NOT_OCCURRED_PATTERNS` (with `ZH_NON_ACTIVITY_PATTERNS` kept as combined export for compatibility).
- Expanded regressions in `src/services/input/liveInputClassifier.test.ts` and `src/services/input/liveInputRules.test.ts` for required `go + place` / planned / negated / happened-shell / mood-mixed scenarios.

### Validation

- `npm run test:unit -- src/services/input/liveInputClassifier.test.ts src/services/input/liveInputRules.test.ts src/store/useChatStore.integration.test.ts`

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` with session-17 execution snapshot and checklist progress.
- Updated `docs/CODE_CLEANUP_HANDOVER_PLAN.md` handover log for this runtime reorder slice.

## 2026-03-11 — Magic Pen Todo Refinement (Multi-task + Due Date)

### Changed

- Extended `src/services/input/magicPenParser.ts` todo pipeline with date-anchor aware segmentation so compact multi-task input can emit multiple todo drafts.
- Added todo date extraction for `明天` / `后天` / `下周X` / `3.18` / `3-18` / `3月18(号)` and mapped parsed values to `todo.dueDate`.
- Implemented yearless-date rollover rule in parser: resolve to this year first; if the date is already past, roll to next year.
- Improved todo content cleanup to remove date/duty scaffolding from `draft.content` (for example `明天考试` -> `考试`).
- Updated `src/features/chat/MagicPenSheet.tsx` to show editable todo date input bound to `draft.todo.dueDate`; extracted helper utilities to new `src/features/chat/magicPenSheetHelpers.ts`.
- Added parser regressions in `src/services/input/magicPenParser.test.ts` for multi-task todo split, date matrix parsing, content cleanup, and year rollover behavior.
- Added locale key `chat_magic_pen_due_date` in `src/i18n/locales/en.ts`, `src/i18n/locales/zh.ts`, and `src/i18n/locales/it.ts`.

### Validation

- `npm run test:unit -- src/services/input/magicPenParser.test.ts`
- `npm run test:unit -- src/store/magicPenActions.test.ts`
- `npx tsc --noEmit`

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` with session-15 execution snapshot and next manual-acceptance focus.
- Updated `docs/CODE_CLEANUP_HANDOVER_PLAN.md` with a new handoff log entry for this parser/sheet refinement slice.

## 2026-03-11 — Magic Pen Phase 2 Slice (Explicit Time-Range Parsing)

### Changed

- Extended `src/services/input/magicPenParser.ts` with explicit range extraction for activity drafts (`从10点到12点`, `10:30-11:45`, `至` / `~` variants) before fallback single-point parsing.
- Added end-time period-label inference when only the range start carries a period token (for example `下午3点到4:30` keeps end time in the same afternoon context).
- Updated content stripping logic in parser normalization so range markers do not leak into draft text content.
- Extracted Magic Pen open/close input handoff rules into `src/features/chat/chatPageActions.ts` and rewired `src/features/chat/ChatPage.tsx` to consume those helpers for deterministic restore behavior.
- Added regression tests in `src/features/chat/chatPageActions.test.ts` for input handoff capture, cancel-restore, and submit-no-restore paths.
- Improved `src/features/chat/MagicPenSheet.tsx` partial-retry UX: failed drafts reset to retryable state on edit/delete, and submit CTA switches to `chat_magic_pen_retry_failed` when only failed drafts remain.
- Added `chat_magic_pen_retry_failed` locale key in `src/i18n/locales/en.ts`, `src/i18n/locales/zh.ts`, and `src/i18n/locales/it.ts`.

### Validation

- `npm run test:unit -- magicPenParser.test.ts magicPenActions.test.ts`
- `npm run test:unit -- src/features/chat/chatPageActions.test.ts src/services/input/magicPenParser.test.ts src/store/magicPenActions.test.ts`
- `npm run lint:max-lines`
- `npm run lint:docs-sync`
- `npm run lint:state-consistency`
- `npx tsc --noEmit`
- `npm run build`

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` to mark the Phase 2 parser slice complete and keep manual sheet acceptance as the next single step.
- Updated `docs/CODE_CLEANUP_HANDOVER_PLAN.md` with this session's execution and validation snapshot.

## 2026-03-11 — Magic Pen Phase 1 Implementation (Chat Entry + Parser + Commit)

### Added

- Added Magic Pen feature files: `src/features/chat/MagicPenSheet.tsx`, `src/services/input/magicPenTypes.ts`, `src/services/input/magicPenRules.zh.ts`, `src/services/input/magicPenParser.ts`, `src/services/input/magicPenDraftBuilder.ts`, `src/store/magicPenActions.ts`.
- Added automated coverage for Magic Pen parser and commit orchestration: `src/services/input/magicPenParser.test.ts`, `src/store/magicPenActions.test.ts`.

### Changed

- Updated `src/features/chat/ChatInputBar.tsx` to include explicit Magic Pen entry button and callback wiring.
- Updated `src/features/chat/ChatPage.tsx` with minimal wiring-only state (`isMagicPenOpen`, `restoreInputRef`) and `MagicPenSheet` mount/close handoff.
- Updated locale dictionaries `src/i18n/locales/en.ts`, `src/i18n/locales/zh.ts`, and `src/i18n/locales/it.ts` with Magic Pen UI/error/status keys.

### Validation

- `npm run test:unit`
- `npm run lint:max-lines`
- `npm run lint:docs-sync`
- `npm run lint:state-consistency`
- `npx tsc --noEmit`
- `npm run build`

### Doc-sync impact

- Updated `src/features/chat/README.md` with Magic Pen user flow, dependencies, and test anchors.
- Updated `docs/CODE_CLEANUP_HANDOVER_PLAN.md` and `docs/CURRENT_TASK.md` to reflect execution progress and validation snapshot.

## 2026-03-11 — Magic Pen Spec Upgrade (Draft -> Execution-Ready)

### Changed

- Rewrote `docs/MAGIC_PEN_CAPTURE_SPEC.md` from a product draft into an implementation-ready spec aligned with the current `/chat` input flow, `useChatStore.insertActivity()`, `useTodoStore.addTodo()`, and report-duration constraints.
- Corrected repo-reality mismatches in the spec: no existing left-slot button in `ChatInputBar`, no current `MagicPen` code, no `/api/magic-pen-parse` endpoint, and no support for timestamp-only activity backfill in the current timeline model.
- Replaced the speculative file plan with an executable one that avoids colliding with the existing `src/services/input/types.ts` and explicitly keeps magic-pen parsing out of `ChatPage.tsx`.

### Validation

- `npm run lint:docs-sync`

### Doc-sync impact

- `docs/MAGIC_PEN_CAPTURE_SPEC.md` now serves as the implementation baseline for future magic-pen work under `src/features/chat`, `src/services/input`, `src/store`, and `src/i18n/locales/*`.

## 2026-03-10 — Moodauto Phase 3.6 (Evaluator Alignment + Evidence-Only Recall Patch + Monitor Mainline)

### Changed

- Aligned python evaluator behavior with the TS classifier contract in `scripts/evaluate_live_input_gold.py` (latin branch routing, token-overlap context matching, and evidence-based `mood_about_last_activity` gating) to reduce evaluation drift.
- Expanded evidence-only reference/evaluation coverage for `mood_about_last_activity` in zh/en/it rule packs: `src/services/input/liveInputRules.zh.ts`, `src/services/input/liveInputRules.en.ts`, and `src/services/input/liveInputRules.it.ts`.
- Refined latin language detection cues in `src/services/input/liveInputClassifier.ts` and synced evaluator-side language cues in `scripts/evaluate_live_input_gold.py`.
- Extended classifier regressions in `src/services/input/liveInputClassifier.test.ts` for new zh/en/it evidence cases.

### Validation

- `npm run test:unit -- src/services/input/liveInputClassifier.test.ts src/services/input/liveInputRules.test.ts`
- `python scripts/evaluate_natural_probe.py`
- `npm run eval:live-input:gold`

### Metrics

- Natural probe (`120` samples): `internal_accuracy 75.83% -> 77.50%`.
- Natural probe `mood_about_last_activity` recall: `69.57% -> 78.26%`.
- zh natural-probe `mood_about_last_activity` recall: `68.75% -> 75.00%`.
- zh gold `internal_accuracy`: `93.45% -> 94.05%`; zh gold `mood_about_last_activity` recall: `38.46% -> 46.15%`.

### Decision

- Product execution decision: close `moodauto` as active development mainline and keep it in monitor mode with explicit reopen triggers based on consecutive natural-probe regressions.

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` to mark the mainline transition (`development -> monitor`) and record reopen thresholds.
- Updated `docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md` metrics section to mirror monitor-mode reopen thresholds and fallback policy.

## 2026-03-10 — Moodauto Phase 3.5 (Backlog Closure: Multilingual + Telemetry + Fallback Decision)

### Added

- Added lightweight local telemetry module `src/services/input/liveInputTelemetry.ts` to track auto-recognition totals, internal-kind distribution, top classifier reasons, and reclassify path counts.
- Added `src/services/input/liveInputRules.test.ts` with 24 smoke regressions across zh/en/it rule packs (ongoing/completion/mood/future-plan coverage).

### Changed

- Expanded English rule seeds in `src/services/input/liveInputRules.en.ts` for completion variants (`wrapped up`, `got done with`), richer activity patterns (report/review/meeting/workout contexts), mood/evaluation expressions (`relieved`, `drained`, `that was stressful`), and stronger future-plan interception.
- Expanded Italian rule seeds in `src/services/input/liveInputRules.it.ts` for completion/activity variants (`ho appena finito`, `ho terminato`, `inviato il report`), richer mood terms (`esausto`, `sollevato`), and broader future-plan phrases (`ho intenzione di`).
- Updated latin classifier context relevance in `src/services/input/liveInputClassifier.ts` to use token-overlap matching instead of raw substring contains for recent-activity linkage.
- Wired telemetry recording into auto-send and correction paths (`src/store/chatActions.ts`, `src/store/useChatStore.ts`) and covered telemetry behavior in `src/store/chatActions.test.ts` + `src/store/useChatStore.integration.test.ts`.
- Extended multilingual regressions in `src/services/input/liveInputClassifier.test.ts` with en/it `activity_with_mood`, future-plan blocking, and unrelated-context non-linking cases.

### Validation

- `npm run test:unit -- src/services/input/liveInputClassifier.test.ts src/services/input/liveInputRules.test.ts src/store/chatActions.test.ts src/store/useChatStore.integration.test.ts`
- `npm run eval:live-input:gold`
- `python scripts/evaluate_natural_probe.py`
- `npx tsc --noEmit`
- `npm run lint:state-consistency`

### Metrics and Decision

- zh gold (latest rerun): `internal_accuracy=98.21%`.
- natural probe (latest rerun): `internal_accuracy=89.23%`, remaining top gap still `activity_with_mood` under-recall.
- Product/engineering decision: keep AI fallback disabled for now; continue rule + telemetry-driven hardening and revisit only if correction/misclassification trends regress.

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` checklist/next-step/validation snapshot to mark the Phase 3 backlog item complete and record the fallback decision basis.

## 2026-03-10 — Moodauto Phase 3.4 (Activity-with-Mood Recall Tuning Round 2)

### Changed

- Tuned zh activity detection in `src/services/input/liveInputRules.zh.ts` with new high-frequency natural patterns (`改代码`, `打完`, `通电话`, `午休`, `会开得`, `刚把...交了`) to reduce `activity_with_mood -> standalone_mood` misses.
- Tuned zh mood-evaluation patterns in `src/services/input/liveInputRules.zh.ts` (`得很顺利/得很好`, `感觉轻松`) and promoted weak completion words as mood evidence in `src/services/input/liveInputClassifier.ts` for mixed routing (`activity_with_mood`).
- Synced offline evaluator heuristics in `scripts/evaluate_live_input_gold.py` with the same tuning direction for comparable natural/gold reruns.

### Added

- Added targeted regression samples in `src/services/input/liveInputClassifier.test.ts` for previously missed natural cases: `和客户会开得很顺利`, `刚打完球，好爽`, `写完报告了，终于松口气`, `午休睡得很好`, `买到想要的东西，开心`.

### Validation

- `npm run test:unit -- src/services/input/liveInputClassifier.test.ts`
- `npx tsc --noEmit`
- `npm run eval:live-input:gold`
- `python scripts/evaluate_natural_probe.py`

### Metrics

- Natural probe `internal_accuracy`: `80.00% -> 89.23%`.
- Natural probe `activity_with_mood` recall: `46.67% -> 66.67%`.
- zh gold `internal_accuracy`: `98.81% -> 98.21%` (minor tradeoff: one `new_activity -> activity_with_mood` over-trigger).

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` validation snapshot with round-2 tuning scope and post-rerun metrics/tradeoff note.

## 2026-03-10 — Moodauto Phase 3.3 (Multilingual Baseline Seed + Eval Rerun)

### Added

- Added `src/services/input/liveInputRules.en.ts` with baseline English activity/mood/future-plan/reference rules for V1 latin-path fallback.
- Added `src/services/input/liveInputRules.it.ts` with baseline Italian activity/mood/future-plan/reference rules for V1 latin-path fallback.
- Added en/it baseline regressions to `src/services/input/liveInputClassifier.test.ts` for `standalone_mood`, `new_activity`, `mood_about_last_activity`, and future/plan interception behavior.

### Changed

- Updated `src/services/input/liveInputClassifier.ts` to route non-CJK latin input into lightweight language-aware (en/it) classification while keeping zh chain as the primary path.
- Kept ongoing-context attach hint for mood outputs (`relatedActivityId`) consistent across zh and latin paths.

### Validation

- `npm run test:unit -- src/services/input/liveInputClassifier.test.ts`
- `npx tsc --noEmit`
- `npm run eval:live-input:gold`
- `python scripts/evaluate_natural_probe.py`

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` validation snapshot with multilingual baseline landing and latest evaluation metrics.

## 2026-03-10 — Moodauto Phase 2.4/3.2 (Source-Aware Attachment Cleanup + Edit Recompute)

### Changed

- Updated `src/store/useMoodStore.ts` to track mood attachment origin metadata (`activityMoodMeta` / `moodNoteMeta`) with `source` and optional `linkedMoodMessageId`, plus `clearAutoMoodAttachmentsByMessage()` for deterministic correction cleanup.
- Updated `src/store/chatActions.ts` reclassify side effects to clean derived mood attachment data by linked mood message id instead of content equality, and routed mood dispatch with explicit `relatedActivityId`.
- Updated `src/store/useChatStore.ts` `sendMood()` to stop implicit fallback attachment to the latest activity; mood attach now only happens when dispatch passes explicit `relatedActivityId`.
- Updated `src/store/useChatStore.ts` `updateActivity()` to recompute mood only when attachment source is `auto` and custom manual label is not applied.
- Updated `src/services/input/liveInputClassifier.ts` so `standalone_mood` can carry ongoing activity id as runtime write hint (`relatedActivityId`) without changing classification kind.

### Added

- Added integration regressions in `src/store/useChatStore.integration.test.ts` for ongoing-vs-ended standalone mood attachment boundary and edit recompute behavior (`auto` mutable / `manual` immutable).
- Added source-aware cleanup assertions in `src/store/chatActions.test.ts` and integration flow to ensure `mood -> activity` correction clears linked auto mood artifacts.

### Validation

- `npm run test:unit -- src/store/chatActions.test.ts src/store/useChatStore.integration.test.ts`
- `npm run test:unit -- src/services/input/liveInputClassifier.test.ts`
- `npx tsc --noEmit`
- `npm run lint:state-consistency`

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` checklist and validation snapshot to mark Phase 2 / P2 and Phase 3 / P1 done and to set the next focus on Phase 3 backlog.

## 2026-03-10 — Moodauto Phase 3.1 (Context-Gated Completion Chain)

### Changed

- Updated `src/services/input/liveInputClassifier.ts` decision order to enforce non-activity/future-intent interception before activity detection and to split completion handling into strong completion (context-gated) vs weak completion (mood-biased evidence).
- Added ongoing/completion/context-token helpers and removed raw substring-based recent-context linkage in favor of token-overlap relevance checks.
- Updated `src/services/input/liveInputRules.zh.ts` with ongoing patterns, strong completion patterns, weak completion words, expanded future/plan negative patterns, and context keyword dictionary used by overlap matching.
- Extended `src/services/input/liveInputClassifier.test.ts` with regressions for strong completion with/without related context, weak completion non-linking behavior, and negative-intent priority.

### Validation

- `npm run test:unit -- src/services/input/liveInputClassifier.test.ts`
- `npm run lint:docs-sync`
- `npm run lint:state-consistency`

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` checklist/next-step/validation snapshot for the completion-context classifier milestone.
- Updated `docs/ACTIVITY_MOOD_AUTO_RECOGNITION_REFACTOR_PROPOSAL.md` to record agreed constraints (weak completion isolation, token-overlap context relevance, and negative-intent-first ordering).

## 2026-03-10 — Moodauto Phase 2.3 (ChatPage Reclassify Wiring Regression)

### Added

- Added `src/features/chat/chatPageActions.ts` to isolate latest-message correction trigger wiring (`reclassifyRecentInput` + row-action collapse) from `ChatPage` UI container.
- Added `src/features/chat/chatPageActions.test.ts` covering the reclassify trigger contract: argument forwarding, collapse ordering after async completion, and failure-path non-collapse.

### Changed

- Updated `src/features/chat/ChatPage.tsx` to delegate row correction handler to `handleLatestMessageReclassify()` for deterministic regression coverage.

### Validation

- `npm run test:unit -- src/features/chat/chatPageActions.test.ts`

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` to mark Phase 2 / P1++ done and expand next executable items from `docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md` (derived data cleanup, ongoing/ended attachment boundary, and mood source recompute rules).
- Updated `src/features/chat/README.md` with the new chat-page action helper dependency and test coverage anchor.

## 2026-03-10 — Moodauto Phase 3 (zh Gold Calibration Round 1)

### Added

- Added `scripts/evaluate_live_input_gold.py` to run offline classifier evaluation against parent-level `timeshine_gold_samples.xlsx`, including accuracy, mismatch pairs, and per-label recall breakdown.
- Added `npm run eval:live-input:gold` in `package.json` to rerun zh baseline checks quickly.
- Added gold-driven zh regression cases in `src/services/input/liveInputClassifier.test.ts` for colloquial activity terms, non-activity intent guards, and short context-evaluation mood cases.

### Changed

- Tuned zh rule dictionary in `src/services/input/liveInputRules.zh.ts`: expanded colloquial activity phrases, added single-verb activity patterns, expanded mood/evaluation lexicon, and introduced non-activity intent patterns.
- Updated classifier logic in `src/services/input/liveInputClassifier.ts` to reduce single-character verb false positives, apply non-activity score correction, and strengthen short evaluative context bias to `mood_about_last_activity`.

### Validation

- `npm run test:unit -- src/services/input/liveInputClassifier.test.ts`
- `python scripts/evaluate_live_input_gold.py --lang zh`
- `python scripts/evaluate_live_input_gold.py`

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` validation snapshot and next-step focus to include gold-based zh calibration status and follow-up direction.

## 2026-03-09 — Moodauto Phase 2.2 (Store Integration Regression)

### Added

- Added `src/store/useChatStore.integration.test.ts` to validate end-to-end store flow (`useChatStore -> chatActions`) for representative sentence routing and latest-message `reclassifyRecentInput()` timeline repair.
- Covered integration cases for `activity_with_mood` writeback, `mood_about_last_activity` linkage, and bidirectional latest-message correction (`mood <-> activity`).

### Notes

- Test run keeps non-blocking `zustand persist middleware` warnings in node test runtime (storage unavailable), while assertions and behavior checks pass.

### Doc-sync impact

- Updated progress and remaining test gap in `docs/CURRENT_TASK.md` (store integration completed; ChatPage UI trigger regression remains follow-up).

## 2026-03-09 — Moodauto Phase 2.1 (Sentence-level Store Regression Tests)

### Added

- Added `src/store/chatActions.test.ts` with sentence-level regression for auto-recognition dispatch (`mood`, `activity`, `activity_with_mood`, `mood_about_last_activity`) through `sendAutoRecognizedInputFlow()`.
- Added latest-message correction regression in `src/store/chatActions.test.ts` for `buildRecentReclassifyResult()` timeline repair boundaries (`mood -> activity`, `activity -> mood`, and non-latest rejection).

### Doc-sync impact

- Synced progress and remaining validation gap in `docs/CURRENT_TASK.md` (Phase 2 / P1 store-action tests completed; UI/store integration regression kept as follow-up).

## 2026-03-09 — Moodauto Phase 2 (Latest-message Reclassify)

### Changed

- Added `reclassifyRecentInput(messageId, nextKind)` in `src/store/useChatStore.ts` for latest-message correction in record mode.
- Added minimal timeline-repair helpers in `src/store/chatActions.ts`: latest-message `mood -> activity` closes previous open activity at the target timestamp, and latest-message `activity -> mood` reopens adjacent previous activity when it was closed by that message.
- Added row-level quick reclassify entry in `src/features/chat/MessageItem.tsx` and connected it in `src/features/chat/ChatPage.tsx` (latest record only).
- Added i18n keys for reclassify actions in `src/i18n/locales/en.ts`, `src/i18n/locales/zh.ts`, and `src/i18n/locales/it.ts`.

### Doc-sync impact

- Updated chat module contract in `src/features/chat/README.md` to include latest-message correction flow and chat action ownership.
- Updated session anchor in `docs/CURRENT_TASK.md` to mark Phase 2 / P0 latest-message correction complete and move next focus to Phase 3 backlog.
- Synced handover log in `docs/CODE_CLEANUP_HANDOVER_PLAN.md` for code/doc state consistency.

## 2026-03-09 — Moodauto Phase 1.5 (Input Flow Decoupling)

### Changed

- Refactored auto-recognized input flow in `src/store/chatActions.ts` into explicit stages: `classifyAutoRecognizedInput()`, `dispatchAutoRecognizedInput()`, `applyAutoRecognizedInputEffects()`, and unified orchestrator `sendAutoRecognizedInputFlow()`.
- Updated `src/store/useChatStore.ts` so `sendAutoRecognizedInput()` now delegates to the unified flow and no longer mixes classification rules with send side effects in one inline branch block.
- Kept behavior compatibility for `activity_with_mood` by applying mood writeback (`setMood` / `setMoodNote`) in the post-effects stage after dispatch.

### Doc-sync impact

- Synced session anchor in `docs/CURRENT_TASK.md` to record the classify -> dispatch -> effects decoupling milestone while keeping Phase 2 (`reclassifyRecentInput`) as the next active step.
- Synced handover log in `docs/CODE_CLEANUP_HANDOVER_PLAN.md` for code/doc state consistency.

## 2026-03-09 — Moodauto Phase 1 (Rule Regression Tests)

### Added

- Added `Vitest` unit test setup in `package.json` with `test:unit` and `test:unit:watch`, and added `vitest` to `devDependencies`.
- Added `src/services/input/liveInputClassifier.test.ts` with zh seed case coverage for `standalone_mood`, `new_activity`, `activity_with_mood`, and `mood_about_last_activity`, plus additional regression samples and context-bias/no-bias boundaries.
- Added `src/services/input/liveInputContext.test.ts` for recent-activity lookup behavior, including ongoing-priority, 30-minute window acceptance, and mood/chat exclusion.

### Doc-sync impact

- Synced execution checkpoint and next-step focus in `docs/CURRENT_TASK.md` (Phase 1 / P1 marked complete; Phase 2 / P0 promoted as next step).
- Synced handover board/log in `docs/CODE_CLEANUP_HANDOVER_PLAN.md` for traceability of test infrastructure and regression coverage landing.

## 2026-03-09 — Moodauto Phase 1 (Auto Recognized Input)

### Changed

- Added rule-based live input classification service under `src/services/input/` (`types.ts`, `liveInputRules.zh.ts`, `liveInputContext.ts`, `liveInputClassifier.ts`) for `activity`/`mood` auto recognition with recent-activity context bias.
- Added `sendAutoRecognizedInput()` in `src/store/useChatStore.ts` as the chat main input entry, and routed `ChatPage` send flow through this unified action.
- Updated record-path mood detection in `src/store/chatActions.ts` to local rule detection only, removing the unconditional classifier API dependency from the primary path.
- Updated `ChatInputBar` and `ChatPage` to a neutral single-input UX (no heart mode toggle) and added `chat_placeholder_neutral` i18n key in `src/i18n/locales/en.ts`, `src/i18n/locales/zh.ts`, and `src/i18n/locales/it.ts`.
- Added `activity_with_mood` writeback in `src/store/useChatStore.ts` to persist derived mood tag and note via `useMoodStore.activityMood` and `useMoodStore.moodNote` without changing message persistence schema.

### Doc-sync impact

- Mainline task status and next checkpoint were synced in `docs/CURRENT_TASK.md`.
- Input-path behavior and ownership moved to rule-based service/store entry while keeping module boundary under `src/features/chat` + `src/store` + `src/services/input`.

## 2026-03-07 — Cleanup H5/H6/H7

### Changed

- Completed cleanup task H5 by splitting annotation serverless implementation: `api/annotation.ts` is now a thin route entry, core handler moved to `api/annotation-handler.ts`, and prompt/default-template logic moved to `api/annotation-prompts.ts`.
- Completed cleanup task H6 by extracting `insertActivity` collision/persistence flow from `src/store/useChatStore.ts` into `src/store/chatActions.ts` via `buildInsertedActivityResult` and `persistInsertedActivityResult`; also extracted duration-sync helper flow (`buildMessageDurationUpdate`/`persistMessageDurationUpdate`).
- Completed cleanup task H7 by removing unused heavy dependencies `cannon-es`, `matter-js`, `three`, and `@types/matter-js` from `package.json` and lockfile.
- Synced cleanup decision: H8 (`commit-msg` hook) is marked as stop-execution by user choice and will not be implemented in this round.

### Doc-sync impact

- API route internals changed (`api/annotation.ts` split into entry + handler + prompts) and module docs were synced in `src/api/README.md`.
- Cleanup board and session anchor were synced in `docs/CODE_CLEANUP_HANDOVER_PLAN.md` and `docs/CURRENT_TASK.md`.

## 2026-03-06 (续) — Git Hook 自动拦截

### Added

- Added `scripts/check-secrets.mjs`: scans staged files for hardcoded keys/tokens (patterns: `sk-`, `cpk_`, Bearer, Supabase service role). Registered as `npm run lint:secrets`.
- Added `scripts/pre-commit.mjs`: pre-commit hook entry point, runs 4 checks in fast-fail order (secrets → max-lines → doc-sync → tsc).
- Added `scripts/install-hooks.mjs`: installs hook scripts into `.git/hooks/`, auto-runs via `npm run prepare`.
- Added `npm run lint:all`: shortcut running all 4 quality checks.
- Added `npm run prepare`: auto-installs git hooks on `npm install`.
- `LLM.md` expanded into full AI onboarding guide: session SOP (3-step), coding rules, loop checks, doc-sync matrix, prohibited items, and related-doc table.

### Doc-sync impact

- `scripts/` directory: 3 new files, no existing paths changed → `check-doc-sync` scope unaffected.
- `package.json` scripts block changed → no README update required (no API/store/route changes).

## 2026-03-06

### Added

- Added `LLM.md` as the single L1 AI/LLM entry document and removed `CLAUDE.md` from active plan scope.
- Added module-level docs: `src/features/auth/README.md`, `src/features/todo/README.md`, `src/features/report/README.md`, and `src/api/README.md`.
- Added `scripts/check-doc-sync.mjs` and new command `npm run lint:docs-sync`.
- Added `docs/CURRENT_TASK.md` as the session-resume anchor file for checkpointed restart.
- Added `scripts/check-state-consistency.mjs` and new command `npm run lint:state-consistency` to block code/doc state drift.

### Changed

- Standardized `src/features/chat/README.md` to the module-template format (entry/interface/upstream/downstream/docs).
- Added `DOC-DEPS` headers to key files (`src/App.tsx`, `src/api/client.ts`, all `src/store/use*Store.ts`, all `api/*.ts`) for L3 file-level dependency tracing.
- Updated `CONTRIBUTING.md` with a required "code change -> doc update" matrix and doc-sync execution rules.
- Updated `LLM.md` global read order to require `docs/CURRENT_TASK.md` before project-map/module reads.
- Updated `scripts/check-doc-sync.mjs` required-doc list to include `docs/CURRENT_TASK.md`.
- Updated `CONTRIBUTING.md` with a session resume SOP and mandatory `lint:state-consistency` pre-submit check.

## 2026-03-05

### Changed

- Completed cleanup task F16 by decoupling annotation sync from `todayStats.events` and using `annotations[]` as the source of pending cloud sync records.
- Added `syncedToCloud` to `AIAnnotation` and updated `useAnnotationStore` to mark local annotations unsynced on create, then flip to synced after successful insert/upsert.
- Added capped event retention for `todayStats.events` (`MAX_TODAY_EVENTS = 400`) to prevent unbounded local persisted growth while preserving recent runtime context.
- Synced execution status and handover details into `docs/CODE_CLEANUP_HANDOVER_PLAN.md` (board + handover log entry).
- Completed cleanup tasks F12-F15: introduced `api/http.ts` shared wrappers (CORS/method/error JSON), unified annotation extraction in `src/lib/aiParser.ts`, optimized Stardust lookup/writeback flow, and reduced ChatPage timer hot-path overhead.
- Updated API handlers (`api/chat.ts`, `api/report.ts`, `api/classify.ts`, `api/diary.ts`, `api/stardust.ts`, `api/annotation.ts`) to use shared HTTP helpers for consistent behavior.
- Completed cleanup task F17 by introducing `src/lib/dbMappers.ts` and unifying DB row mapping for Message/Todo/Report/Stardust/Annotation/Auth sync paths.
- Completed cleanup task F18 by migrating Mood domain internal values to English keys (`happy/calm/focused/...`) with i18n-based rendering and persisted-data compatibility migration.

## 2026-03-04

### Added

- Added `CONTRIBUTING.md` with contribution flow, directory boundaries, validation, and rollback expectations.
- Added `docs/archive/2026-03-04-root-residual-disposition.md` to record root residual file disposition.
- Added `scripts/check-max-lines.mjs` and `npm run lint:max-lines` for file-size guardrails (warn >400 lines, error >800 lines).

### Changed

- Locked package manager strategy to `npm` and removed `pnpm-lock.yaml`.
- Updated package-management wording in `README.md`, `PROJECT_CONTEXT.md`, and install steps in `DEPLOY.md`.
- Synced cleanup board and handover log for D3, D6, D9, and E1 in `docs/CODE_CLEANUP_HANDOVER_PLAN.md`.
- Reviewed and improved `.gitignore` by removing duplicate `.env` rules and adding `.vercel/` ignore.
- Rewrote `api/README.md` and `src/store/README.md` to align with current implementation boundaries and reduce drift.
- Grouped shared components by responsibility into `src/components/layout` and `src/components/feedback`, then updated imports in app entry points and chat feature.
- Synced cleanup status decision: C12 and C13 are now marked as stop-execution items and will be handled by the user later.
- Corrected documentation alignment across `FEATURE_STATUS.md`, `PROJECT_CONTEXT.md`, and `docs/ARCHITECTURE.md` for the C12/C13 stop-execution status.

### Removed

- Removed stale root files: `TO-DO.json`, `YOUWARE.md`, and `SECURITY_FIX.md`.

## 2026-03-03

### Added

- Added `PROJECT_CONTEXT.md` as the global onboarding context document.
- Added `FEATURE_STATUS.md` to track module-level implementation status.
- Added `docs/CHANGELOG.md` as the single changelog entry point.

### Changed

- Rewrote root `README.md` to reflect real project scope, setup, architecture entry points, and known issues.
- Rewrote `docs/ARCHITECTURE.md` to reflect current implemented architecture only.
- Completed C14 by adding bounded pruning strategy in `src/store/useMoodStore.ts` to avoid unbounded localStorage growth.
- Fixed report detail title i18n mismatch in `src/features/report/ReportDetailModal.tsx` and locale keys.
- Synced cleanup board status for C14 and C16 in `docs/CODE_CLEANUP_HANDOVER_PLAN.md`.

### Notes

- C12/C13 are now marked as stop-execution items and are intentionally left for user-owned follow-up.
