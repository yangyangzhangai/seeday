# Changelog

All notable changes to this repository are documented here.

> Note: changelog 仅记录有效变更；会话过程性噪音应写入 `docs/CURRENT_TASK.md`，不在此重复展开。

## 2026-04-11 - Tweak: EcoSphere 气泡漂浮物理调优

### Changed

- `src/features/report/plant/useBubbleMotionController.ts`
  - 自由漂浮改为随机游走扰动，减少规律性方向循环。
  - 漂浮与重力影响整体降速约 2.5 倍，提升轻盈感。
  - 新增双气泡重叠阈值（2/3 直径）阻尼反弹，避免完全重叠。
  - 初始位置与漂移方向随机化，进入页面更自然。

## 2026-04-11 - Tweak: Profile「专属记忆」文案与编辑界面简化

### Changed

- `src/features/profile/components/LongTermProfileToggle.tsx` + `src/i18n/locales/{zh,en,it}.ts`
  - 长期画像文案升级为「专属记忆」语义，强调陪伴关系与“被记住”体验。
- `src/features/profile/components/UserProfileSection.tsx`
  - 移除三分栏 tab（作息/个性化画像/纪念日），改为单页内容容器。
- `src/features/profile/components/UserProfilePanel.tsx`
  - 编辑区合并为单页：作息与自由画像同屏编辑，并保留单一保存按钮。
  - 前台不再展示纪念日新增/删除/来源标签 UI，保存链路仅提交 `manual`。
- `src/features/profile/README.md` + `docs/CURRENT_TASK.md`
  - 同步模块接口说明与当前任务记录。

## 2026-04-10 - Feat: 低叙事密度判定 + 今日小事事件注入（Doc1 P1）

### Changed

- `src/server/narrative-density-types.ts`、`src/server/narrative-density-constants.ts`（新增）
  - 新增低叙事密度缓存/触发/埋点相关类型与常量（四维权重、阈值修正系数、概率、每日上限、类型权重）。
- `src/server/narrative-density-scorer.ts`、`src/server/narrative-density-trigger.ts`、`src/server/narrative-density-state.ts`（新增）
  - 落地纯规则评分（freshness/density/emotion/vocab）与触发决策（首条跳过、阈值修正、每日总上限/类型上限、概率抽样）。
  - 新增 `today_narrative_cache_v1` 读写（优先 `user_metadata`，无 service role 时回退进程内缓存），并支持跨日重置。
- `src/server/narrative-event-library.ts`、`src/server/narrative-density-telemetry.ts`（新增）
  - 新增 P1 事件库（`natural_event` / `character_mention`）与 `[今日小事] ...` 注入文案生成。
  - 新增服务端 telemetry 上报：`density_scored` / `trigger_blocked` / `event_triggered`。
- `src/server/annotation-handler.ts`、`src/server/annotation-prompt-builder.ts`、`src/server/annotation-prompts.user.ts`
  - 在 `/api/annotation` 链路接入低叙事密度判定与注入；suggestion/normal annotation 双链路均可接收同一条今日小事注入。
  - `/api/annotation` 响应新增 `narrativeEvent`（`eventType/eventId/instruction/isTriggeredReply`）供前端对齐凝结埋点。
- `src/store/useAnnotationStore.ts`、`src/types/annotation.ts`、`src/services/input/reportTelemetryEvent.ts`
  - store 层保存 `narrativeEvent` 元数据；当 suggestion 被接受且 `isTriggeredReply=true` 时新增 `event_condensed` telemetry。
- `src/server/narrative-density-scorer.test.ts`、`src/server/narrative-density-trigger.test.ts`（新增）
  - 新增首版单测覆盖：事件归类、低/高密度分差、首条拦截、低密命中触发。

### Validation

- `npx tsc --noEmit` ✅
- `npx vitest run src/server/narrative-density-scorer.test.ts src/server/narrative-density-trigger.test.ts src/server/annotation-handler.test.ts` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`、`api/README.md`、`src/api/README.md`、`src/store/README.md`。

## 2026-04-10 - Feat: 周画像提取支持多语言 + 新增周状态/高频活动/高频心情

### Changed

- `src/server/extract-profile-service.ts`
  - `/api/extract-profile` 提取 prompt 新增 `zh/en/it` 三语路由（基于 `lang`）。
  - 扩展提取 schema：`observed.weeklyStateSummary`、`observed.topActivities`（top3）、`observed.topMoods`（top3）。
  - 新字段沿用 `ConfidenceSignal` 结构并统一做 `lastSeenAt` ISO 归一化。
- `api/extract-profile.ts`
  - 新增 `lang` 入参解析与白名单归一化（`zh`/`it`，其他回退 `en`），并透传至提取服务。
- `src/api/client.ts` + `src/store/reportActions.ts`
  - `callExtractProfileAPI()` 请求体新增 `lang`。
  - 周报触发链路 `triggerWeeklyProfileExtraction()` 透传当前 i18n 语言到服务端。
- `src/types/userProfile.ts` + `src/lib/buildUserProfileSnapshot.ts`
  - `UserProfileObserved` 新增周状态/高频活动/高频心情字段类型。
  - 长期画像快照文本新增这三个字段，批注 prompt 可直接消费。

### Doc Sync

- 更新 `api/README.md`、`src/api/README.md`、`docs/CURRENT_TASK.md`。

## 2026-04-10 - Feat: EcoSphere 饼图自由漂浮 + 设备重力联动

### Changed

- `src/features/report/plant/DayEcoSphere.tsx`
  - 两枚 Donut 气泡从固定定位改为在顶部空白区域内自由漂浮，支持边界碰撞与阻尼反弹。
  - 保留点击展开逻辑（心情气泡仍可展开能量曲线面板），并维持现有夜间提示行为。
  - Donut 文本字号轻微上调（`fontSize: 6 -> 7`），提升气泡内标签可读性。
- `src/features/report/plant/useBubbleMotionController.ts`（新增）
  - 新增气泡物理控制 hook：`requestAnimationFrame` 驱动速度/位移更新，包含漂浮扰动、空气阻尼、边界反弹。
  - 接入 `deviceorientation`（倾斜重力）与 `devicemotion`（摇晃冲量）输入；传感器不可用或权限未授予时自动退化到纯自由漂浮。
- `src/services/native/motionService.ts`（新增）
  - 新增运动能力封装：传感器支持检测、iOS 运动权限请求（按需）、倾斜向量监听。

### Validation

- `npx tsc --noEmit` ✅

## 2026-04-10 - Feat: 角色状态改为持续影响 + 衰减注入（移除同日去重）

### Changed

- `src/lib/characterState/constants.ts`
  - `CharacterStateTracker` 新增 `activeEffects` 持续影响状态，移除 `injectedByDate` 同日去重结构。
- `src/lib/characterState/event-tracker.ts`
  - 新增持续影响能力：`decayAndPruneActiveEffects()`、`addOrRefreshActiveEffect()`、`getActiveEffectScore()`、`listActiveBehaviorIds()`。
  - 延迟事件改为“到期消费一次后进入持续影响池”，不再按天重复注入。
- `src/lib/characterState/character-state-builder.ts`
  - 注入策略由“当次命中+同日去重”改为“命中累积影响 -> 时间衰减 -> 从 active effects 选文案”。
  - 衰减降级优先走 `lite` 文案（缺失时 fallback 到 `instant`），并继续保留 `trend` 与并发上限 2 条。
  - 行为参数改为配置化读取（`BEHAVIOR_EFFECT_CONFIG`），不再写死在 builder 内。
- `src/lib/characterState/behavior-map.ts`
  - 新增 B01-B21 全量衰减参数配置（`baseScore/maxScore/ttlHours/halfLifeHours`）。
  - 补齐部分行为的 `lite` 文案：B02（吸烟）、B03（熬夜）、B09（咖啡）。
- `src/types/annotation.ts` / `src/server/annotation-handler.ts`
  - 扩展 `characterStateMeta` 调试字段（active effects、文案档位、抑制列表）。
  - `/api/annotation` 响应新增 `debugCharacterState`，可直接在浏览器 F12 的 Network 中查看本次角色状态注入上下文。
- `src/lib/characterState/event-tracker.test.ts` / `src/lib/characterState/character-state-builder.test.ts`
  - 单测改为覆盖“同日持续影响”“衰减过期清理”“延迟消费一次”新逻辑。

### Validation

- `npm run -s test:unit -- src/lib/characterState/event-tracker.test.ts src/lib/characterState/character-state-builder.test.ts` ✅
- `npx tsc --noEmit` ✅

## 2026-04-10 - Fix: iOS 套壳输入缩放/滚动条/拖拽手感

### Changed

- `index.html`
  - 收紧 viewport：增加 `maximum-scale=1.0` 与 `user-scalable=no`，降低 iOS 输入聚焦导致页面放大且不回退的概率。
- `src/index.css`
  - 补充根层约束：`html/body/#root` 全高与根滚动锁定，统一 `text-size-adjust`。
  - 新增 `app-scroll-container`，统一隐藏滚动条并保留惯性滚动（`-webkit-overflow-scrolling: touch`）。
- `src/features/growth/GrowthPage.tsx`、`src/features/profile/ProfilePage.tsx`、`src/features/chat/components/TimelineView.tsx`、`src/features/report/plant/PlantRootSection.tsx`
  - 主滚动容器切换为 `app-scroll-container`，减少 iOS WebView 下可见网页滚动条。
- `src/services/native/keyboardService.ts`（新增）+ `src/main.tsx`
  - 新增 iOS 原生键盘监听与视口修正初始化，键盘显隐时同步根 class 与高度变量，并在收起后执行滚动位置回正。
- `package.json`、`capacitor.config.ts`、`ios/App/App/capacitor.config.json`
  - 引入 `@capacitor/keyboard`，配置 `Keyboard.resize = body` 并同步 iOS Capacitor 配置。
- `ios/App/App/AppDelegate.swift`
  - App 激活与启动后统一调整 WKWebView scrollView：关闭 bounce 与滚动指示器，减少“网页感”滚动表现。
- `src/features/growth/GrowthTodoSection.tsx`
  - 长按拖拽参数调优：触发延时 `320ms -> 220ms`，取消阈值 `8px -> 14px`，提升移动端拖拽手感。

### Validation

- `npx tsc --noEmit` ✅
- `npm run lint:docs-sync` ✅

## 2026-04-10 - Refactor: Stardust 统一复用批注 Emoji（移除独立模型端点）

### Changed

- `src/store/useStardustStore.ts`
  - 移除 `callStardustAPI` 依赖，不再在凝结时调用独立 AI 选 Emoji。
  - 新增本地 `extractEmojiFromAnnotation(...)`，优先复用批注内容中的 emoji，缺失时兜底 `✨`。
- `src/api/client.ts`
  - 删除 `callStardustAPI()` 及其请求/响应类型。
- `api/stardust.ts`
  - 删除 `/api/stardust` serverless 入口。

### Validation

- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `api/README.md`、`src/api/README.md`、`docs/PROJECT_MAP.md`、`docs/ARCHITECTURE.md`、`docs/AI_USAGE_INVENTORY.md`、`.env.example`、`scripts/check-doc-sync.mjs`。

## 2026-04-10 - Feat: 周报点击触发用户画像提取（P3）

### Changed

- `api/extract-profile.ts`（新增）
  - 新增 `/api/extract-profile` 端点（需 Supabase Bearer token）。
  - 接收前端透传 `recentMessages[]`，调用服务端提取逻辑并返回 `profile` patch。
- `src/server/extract-profile-service.ts`（新增）
  - 新增画像提取服务：基于 OpenAI（默认 `gpt-4o-mini`）将最近记录总结为 `observed/dynamicSignals/anniversariesVisible/hiddenMoments`。
  - 增加严格 schema 校验与保守清洗：非法字段丢弃，不阻塞主链路。
- `src/api/client.ts`
  - 新增 `callExtractProfileAPI()` 与请求/响应类型定义。
- `src/store/reportActions.ts` + `src/store/useReportStore.ts`
  - 新增 `triggerWeeklyProfileExtraction()`：当 `generateReport('weekly', ...)` 执行时并行触发画像提取。
  - 长期画像开关关闭时自动短路；提取成功后通过 `useAuthStore.updateUserProfile(...)` merge 写回 `user_profile_v2`，避免 metadata 覆盖。

### Validation

- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`：冻结“周报点击触发画像提取，每次点击都执行”的触发口径，并标记 P3 完成。
- 更新 `api/README.md`、`src/api/README.md`、`src/store/README.md`：补充新端点与周报触发链路说明。

## 2026-04-10 - Update: User Profile UI 三分栏改版（作息/个性化画像/我的纪念日）

### Changed

- `src/features/profile/components/UserProfileSection.tsx`
  - 将“我的画像”页签改为 3 个固定入口：`作息时间`、`个性化画像`、`我的纪念日`。
  - 移除该区域对“画像快照”页签的直接展示，改为只承载画像编辑任务。
- `src/features/profile/components/UserProfilePanel.tsx`
  - 移除“主要用途”与目标输入区，新增 `manual.freeText` 自由输入区用于个性化画像描述。
  - 纪念日列表保留用户新增 + AI 自动写入的混合数据，并新增来源标识（我添加的 / AI 识别）。
  - 保存链路继续复用 `updateUserProfile(...)`，统一提交作息、自由画像、纪念日。
- `src/features/profile/components/userProfilePanelHelpers.ts`
  - `buildManualPayload(...)` 调整为写入 `freeText`，不再更新 `primaryUse/currentGoal/lifeGoal`。
- i18n：`src/i18n/locales/zh.ts` / `src/i18n/locales/en.ts` / `src/i18n/locales/it.ts`
  - 新增三分栏页签、个性化画像输入、纪念日来源标签相关词条。
  - 同步更新画像区域描述文案。

### Validation

- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`：补记 Profile 画像编辑区的三分栏 UI 改版落地。

## 2026-04-09 - Update: User Profile v1.1（仅画像系统 + Profile UI 强化）

### Changed

- `src/features/profile/components/UserProfilePanel.tsx`
  - 新增“无改动不保存”脏检查，避免重复写入 metadata。
  - 新增纪念日完整性校验（名称/日期必须成对填写），提升保存反馈明确性。
  - 抽离表单工具到 `userProfilePanelHelpers.ts`，降低主组件复杂度并便于复用。
- `src/features/profile/components/LongTermProfileToggle.tsx`
  - 新增保存中态与成功/失败反馈文案，避免静默切换。
  - 补充 `role=switch` 与 `aria-checked`，提升可访问性。
- `src/features/profile/components/UserProfileInsightsCard.tsx`（新增）
  - 在 Profile 页新增“画像快照”展示卡，聚合展示建议饭点、临近纪念日与最新回忆素材。
  - 快照来源统一复用 `buildUserProfileSnapshot(...)`。
- `src/features/profile/ProfilePage.tsx`
  - 接入 `UserProfileInsightsCard`，形成“编辑 + 快照反馈”闭环。
- `src/features/growth/LifeGoalPanel.tsx`（新增）
  - 新增“人生目标管理”面板，支持在 Growth 页直接编辑长期人生目标。
  - 写入链路复用 `useAuthStore.updateUserProfile(...)`，与 Profile 页 `manual.lifeGoal` 保持双向同步。
- `src/features/growth/GrowthPage.tsx`
  - Growth 主页面接入 `LifeGoalPanel`，形成“成长执行区 + 长期方向”同屏管理。
- `src/store/authProfileHelpers.ts`
  - 强化 `parseUserProfileV2(...)` 的输入清洗：manual/纪念日/隐性回忆数据校验，降低脏数据进入状态层风险。
- i18n：`src/i18n/locales/zh.ts` / `src/i18n/locales/en.ts` / `src/i18n/locales/it.ts`
  - 新增长期画像保存状态、画像保存校验、画像快照卡文案 key。
  - 新增 Growth 人生目标管理文案 key（保存态/同步提示/无变更提示）。
- 文档：`src/features/profile/README.md`、`src/features/growth/README.md`
  - 同步 Profile 快照卡与 Growth 人生目标管理面板能力说明。

### Validation

- `npx tsc --noEmit` ✅
- `npx vitest run src/lib/buildUserProfileSnapshot.test.ts src/lib/suggestionDetector.test.ts` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`：本轮策略明确为“仅画像系统 + Profile/Growth UI，不做新手引导”，并标记人生目标双向同步完成。

## 2026-04-09 - Feat: User Profile v1.1 P2 首版（我的画像编辑面板）

### Changed

- `src/features/profile/components/UserProfilePanel.tsx`（新增）
  - 新增“我的画像”折叠面板，支持编辑 `manual` 层字段：`primaryUse`、`wakeTime`、`sleepTime`、`mealTimes`、`currentGoal`、`lifeGoal`。
  - 新增 A 类可见纪念日管理（新增/删除/每年重复），写入 `user_profile_v2.anniversariesVisible`。
  - 保存链路统一复用 `useAuthStore.updateUserProfile(...)`，沿用 metadata `read -> merge -> write` 策略。
- `src/features/profile/ProfilePage.tsx`
  - Profile 页面接入 `UserProfilePanel`，与“长期画像开关”并列展示。
- i18n：`src/i18n/locales/zh.ts` / `src/i18n/locales/en.ts` / `src/i18n/locales/it.ts`
  - 新增 `profile_user_profile_*` 词条，覆盖用途/作息/目标/纪念日/保存状态文案。
- `src/features/profile/README.md`
  - 同步 profile 模块能力说明，补充 UserProfilePanel 入口与职责。

### Validation

- `npx tsc --noEmit` ✅
- `npm run build` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`：P2 状态更新为“画像编辑已落地，目标双向同步待补”。

## 2026-04-09 - Feat: User Profile v1.1 P0 基建（开关 + 快照 + prompt 注入）

### Changed

- `src/types/userProfile.ts`（新增）
  - 新增用户画像 v2 类型：`UserProfileV2`、`VisibleAnniversary`、`HiddenMoment`、`ConfidenceSignal`、`UserProfileSnapshot`。
- `src/lib/buildUserProfileSnapshot.ts`（新增）
  - 新增长期画像快照构建：合并 manual/observed/dynamic/hidden 信息，产出英文快照文本、建议链路可用饭点、临近纪念日与召回素材。
  - 新增 `isLongTermProfileEnabled(...)` 门控工具函数。
- `src/store/useAuthStore.ts` + `src/store/authProfileHelpers.ts`（新增）
  - `useAuthStore` 扩展状态：`longTermProfileEnabled`、`userProfileV2`。
  - 新增 `updateLongTermProfileEnabled(...)` 与 `updateUserProfile(...)`，统一执行 `read -> merge -> write` 的 metadata 更新，避免覆盖并行字段。
  - `updatePreferences` 持久化路径改为基于最新 metadata 合并写入。
- `src/features/profile/components/LongTermProfileToggle.tsx`（新增） + `src/features/profile/ProfilePage.tsx`
  - Profile 页新增“长期画像”总开关 UI，并持久化到 `user_metadata.long_term_profile_enabled`。
- `src/store/useAnnotationStore.ts`
  - 在开关开启时构建 `userProfileSnapshot` 并透传给 annotation API。
  - suggestion context hint 检测接入 declared/observed 饭点。
- `src/types/annotation.ts` / `src/server/annotation-handler.ts` / `src/server/annotation-prompt-builder.ts` / `src/server/annotation-prompts.user.ts`
  - 扩展 `AnnotationRequest.userContext.userProfileSnapshot`。
  - annotation + suggestion 双路径 prompt 注入长期画像快照块。
- `src/lib/suggestionDetector.ts`
  - `isMealTime(...)` 升级为 `isMealTime(hour, declared?, observed?)`，优先声明饭点，次选观测饭点，最后回退 legacy 时间窗。
- i18n：`src/i18n/locales/zh.ts` / `src/i18n/locales/en.ts` / `src/i18n/locales/it.ts`
  - 新增长期画像开关文案 key：`profile_long_term_profile`、`profile_long_term_profile_desc`。
- 测试新增/更新
  - 新增 `src/lib/buildUserProfileSnapshot.test.ts`。
  - 更新 `src/lib/suggestionDetector.test.ts`（声明/观测/fallback 饭点判定）。
  - 更新 `src/server/annotation-prompts.user.test.ts`（长期画像快照注入）。

### Validation

- `npx vitest run src/lib/suggestionDetector.test.ts src/lib/buildUserProfileSnapshot.test.ts src/server/annotation-prompts.user.test.ts` ✅
- `npm run lint:all` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`：主线 4 P0-0 ~ P0-5 标记完成。
- 更新 `src/store/README.md`、`src/api/README.md`、`api/README.md`、`src/features/profile/README.md`：同步开关、快照透传与契约变更。

## 2026-04-09 - Feat: annotation 横向联想中间层（首版采样 + U4 注入）

### Changed

- `src/server/lateral-association-sampler.ts`（新增）
  - 新增联想采样核心：11 种联想类型 + 3 种出发点采样、动态权重调整、上次去重、daily 受限类型拦截、tone tag 近 3 次去重。
  - 联想/出发点基础权重按需求文档第 3 章表格落地（包含 Agnes/Momo 冲突值修正）。
  - 新增三语指令构建：联想指令 + 出发点追加指令 + tone_only 语气指令。
- `src/server/lateral-association-state.ts`（新增）
  - 新增服务端状态读写：优先持久化到 `auth.users.user_metadata.lateral_association_state_v1`（`userId + characterId` 维度），无 service role 时回退进程内缓存。
  - 支持按 `dailyDate` 自动换日重置 daily 限制集合。
- `src/server/annotation-handler.ts`
  - 在 annotation/suggestion 双路径 prompt 组装前接入横向联想采样。
  - 采样结果写入 `associationInstruction` 并传递到 prompt U4 段。
  - 新增可观测日志字段（`associationType/originType/toneTag/instruction`，受 verbose 开关控制）。
- `src/server/annotation-prompt-builder.ts` / `src/server/annotation-prompts.user.ts`
  - 扩展 prompt 输入字段 `associationInstruction`，并在角色状态块后注入 U4 指令。
- `src/types/annotation.ts` / `src/store/useAnnotationStore.ts`
  - `AnnotationRequest.userContext` 新增可选 `userId`，前端透传当前登录用户 id 供服务端状态分桶。
- 测试新增/更新
  - 新增 `src/server/lateral-association-sampler.test.ts`。
  - 更新 `src/server/annotation-prompts.user.test.ts`（覆盖 U4 指令注入）。
  - 新增分布统计验收：Momo `self_led` 采样比例在容差内逼近 25%。

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`：新增“横向联想中间层”主线与 P0-P7 任务拆解。
- 更新 `src/store/README.md`、`src/api/README.md`、`api/README.md`：同步横向联想接入与 `userContext.userId` 契约。
- 更新 `docs/timeshine_lateral_association_spec_v1.1 (1).extracted.txt`：将 5.3 常量修正为与第 3 章权重表一致。

## 2026-04-09 - Fix: suggestion 待办高亮丢失与长期待办预拆解漏触发

### Changed

- `src/features/growth/GrowthPage.tsx`
  - 调整 `pendingSuggestionIntent` 消费时机：等待 todo store hydrate 且父待办存在后再消费，避免页面初次挂载时提前清空导致“未高亮/未落地子步骤”。
  - 增加过期意图清理分支（>45s）避免陈旧 intent 残留。
- `src/lib/dbMappers.ts`
  - `fromDbTodo` 新增时间字段归一化（支持 number / 数字字符串 / ISO 字符串），统一映射 `createdAt/dueAt/completedAt/startedAt/sortOrder` 为毫秒时间戳。
  - 修复由时间字段字符串导致 `ageDays` 计算失真、stale todo 判定不稳定的问题。
- `src/store/useAnnotationStore.ts`
  - 构建 `pendingTodos` 时对 `createdAt/dueAt` 做毫秒归一化，确保 `ageDays` 计算稳定并透传可用时间字段。
- `src/server/annotation-handler.ts`
  - stale todo 预拆解判定新增时间解析兜底：除 `ageDays` 外，支持基于 `createdAt` 推断“创建 >=3 天”与 `dueAt` 逾期判定（兼容字符串时间）。
- 测试更新
  - `src/lib/dbMappers.test.ts` 增加 todo 字符串时间字段解析用例。
  - `src/server/annotation-handler.test.ts` 增加 `ageDays` 缺失但 `createdAt` 为旧字符串时仍触发预拆解用例。

### Validation

- `npx vitest run src/server/annotation-handler.test.ts src/lib/dbMappers.test.ts` ✅
- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`：记录本次 suggestion 跨页时序与 stale todo 判定修复。

## 2026-04-08 - Feat: annotation 行为-角色状态映射（B01-B21）接入 U3

### Changed

- `src/lib/characterState/*`（新增）
  - 新增行为状态模块：`behavior-map` / `behavior-matcher` / `event-tracker` / `character-state-builder` / `index`。
  - 支持 B01-B21 关键词匹配（zh/en/it）、B05 时长阈值、B06 茶种路由、延迟触发、活跃日 streak、7 天密度衰减、同日去重、并发上限 2 条。
- `src/store/useAnnotationStore.ts`
  - 新增 `characterStateTracker` 持久化状态。
  - 在 annotation 触发前构建 `characterStateText` 与 `characterStateMeta`，并透传到 `/api/annotation`。
  - 新增前端开关 `VITE_ANNOTATION_CHARACTER_STATE_ENABLED`（默认 `true`）。
- `src/types/annotation.ts`
  - 扩展 `AnnotationRequest.userContext`：新增 `characterStateText` 与 `characterStateMeta`。
- `src/server/annotation-prompt-builder.ts` / `src/server/annotation-prompts.user.ts` / `src/server/annotation-handler.ts`
  - 在 annotation 与 suggestion 双路径 prompt 中注入 U3 段（`Character current state` / `角色当前状态` / `Stato attuale del personaggio`）。
  - `characterStateText` 为空时按语言回退到 `none/无/nessuno`。
  - 新增 server 侧总开关：`ANNOTATION_CHARACTER_STATE_ENABLED=false` 时不注入行为状态正文（仅保留回退占位）。
- 测试新增/更新
  - 新增 `src/lib/characterState/behavior-matcher.test.ts`、`src/lib/characterState/event-tracker.test.ts`、`src/lib/characterState/character-state-builder.test.ts`。
  - 更新 `src/server/annotation-prompts.user.test.ts`、`src/server/annotation-handler.test.ts` 覆盖 U3 注入与 server 开关禁用场景。

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`：记录“行为-角色状态映射”开发落地完成。
- 更新 `src/store/README.md`、`src/api/README.md`、`api/README.md`：同步 annotation 上下文字段扩展。

## 2026-04-08 - Feat: suggestion 长期待办“先拆解后建议”落地

### Changed

- `src/server/todo-decompose-service.ts`（新增）
  - 提取待办拆解共享服务 `decomposeTodoWithAI(...)`，统一 3-6 步拆解规则与 JSON 解析归一化。
- `api/todo-decompose.ts`
  - 改为复用 `todo-decompose-service`，避免与 suggestion 预拆解链路双份实现漂移。
- `src/server/annotation-handler.ts`
  - suggestion 命中 `todo` 且识别为长期未完成（`ageDays>=3` 或逾期 >=24h）时，先调用拆解服务生成子步骤，再返回建议。
  - suggestion payload 新增预拆解透传：`decomposeReady` / `decomposeSourceTodoId` / `decomposeSteps[]`。
  - 建议文案与按钮在预拆解命中时改为“已拆好 + 开始第一步”语义。
- `src/types/annotation.ts` / `src/server/annotation-suggestion.ts`
  - 扩展 suggestion 与 pending intent 类型，支持预拆解字段；`PendingTodoSummary` 增加 `createdAt/ageDays`。
- `src/store/useAnnotationStore.ts`
  - 透传 pending todo `createdAt/ageDays` 到 annotation 请求。
  - 接收 suggestion 预拆解字段并写入本地 annotation 状态。
- `src/components/feedback/AIAnnotationBubble.tsx`
  - 接受 todo suggestion 时将 `decomposeSteps` 写入 `pendingSuggestionIntent`，用于跨页落地。
- `src/features/growth/GrowthPage.tsx`
  - 消费 `pendingSuggestionIntent` 时若携带 `decomposeSteps` 且父待办尚无子待办，则自动创建子待办并高亮。

### Validation

- `npx vitest run src/server/annotation-handler.test.ts src/components/feedback/AIAnnotationBubble.test.ts` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`：记录“先拆解后建议”主链路完成。
- 更新 `docs/PROJECT_MAP.md`：补充 `src/server/todo-decompose-service.ts` 共享职责。
- 更新 `api/README.md`、`src/api/README.md`、`src/store/README.md`：同步预拆解契约与跨页落地行为。

## 2026-04-08 - Refactor: annotation prompt 统一拼装入口（build prompt package）

### Changed

- `src/server/annotation-prompt-builder.ts`（新增）
  - 新增统一拼装函数 `buildAnnotationPromptPackage(...)`，集中生成 LLM 调用所需 `{ model, instructions, input }`。
  - 支持 `annotation` 与 `suggestion` 两种 mode，并统一接收日期/节日/天气/季节/预警等上下文字段。
- `src/server/annotation-handler.ts`
  - suggestion 分支与普通批注分支改为复用统一 prompt package，不再在 handler 内分散拼接 `systemPrompt/userPrompt/model`。
  - rewrite 分支改为复用同一份 prompt package 输入，减少分支漂移风险。

### Validation

- `npx vitest run src/server/annotation-handler.test.ts` ✅
- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`：记录“统一 prompt 组装入口”已落地。
- 更新 `docs/PROJECT_MAP.md`：补充 `src/server/annotation-prompt-builder.ts` 模块职责。
- 更新 `src/api/README.md`：补充 annotation 双路径 prompt package 统一组装说明。

## 2026-04-08 - Feat: annotation 天气/季节最小上下文（复合天气 + 大风/雾霾预警）

### Changed

- `src/types/annotation.ts`
  - 扩展 annotation 契约：新增 `WeatherContextV2` / `SeasonContextV2` / `WeatherAlert` 类型，并在 `userContext` 增加 `latitude`、`longitude`、`weatherContext`、`seasonContext`、`weatherAlerts` 可选字段。
- `src/lib/seasonContext.ts`（新增）
  - 新增季节解析（仅输出 `spring/summer/autumn/winter/unknown`）。
- `src/server/weather-provider.ts`（新增） / `src/server/air-quality-provider.ts`（新增）
  - 新增 Open-Meteo 天气与空气质量快照拉取（800ms 超时，失败返回 `null`）。
- `src/server/weather-context.ts`（新增） / `src/server/weather-alerts.ts`（新增）
  - 新增天气映射：`temperatureC + conditions[]`（支持复合标签，如 `rain_medium + windy`）。
  - 新增业务预警：`strong_wind_watch`（风速/阵风阈值）与 `haze_watch`（PM2.5/PM10/AQI 阈值）。
- `src/server/annotation-handler.ts` / `src/server/annotation-prompts.user.ts`
  - 在普通批注与 suggestion-aware 双路径注入最小环境上下文行（Season/Weather/Alerts），并保证外部接口异常不阻断主链路。
- `src/store/useAnnotationStore.ts`
  - 从 `user_metadata` 透传可选 `latitude/longitude` 到 annotation 请求。
- 测试新增/更新
  - 新增 `src/lib/seasonContext.test.ts`、`src/server/weather-context.test.ts`、`src/server/weather-alerts.test.ts`。
  - 更新 `src/server/annotation-prompts.user.test.ts`、`src/server/annotation-handler.test.ts`。

### Doc Sync

- 更新 `docs/TIMESHINE_AI活人感系统_天气与季节_实现方案.md` 为开发交付版 v2.0（最小契约 + 多标签天气 + 预警数据源与阈值）。
- 更新 `docs/PROJECT_MAP.md`、`api/README.md`、`src/api/README.md`、`docs/CURRENT_TASK.md`，对齐新模块与 annotation 契约。

## 2026-04-08 - Feat: annotation 国家与节假日上下文（法定+社会）

### Changed

- `src/types/annotation.ts`
  - 扩展 annotation 契约：新增 `userContext.countryCode` 与 `userContext.holiday`，并补充 `AnnotationHolidayContext` 类型。
- `src/store/useAnnotationStore.ts`
  - 发起 annotation 请求时优先读取 `user_metadata.country_code`（ISO2）并透传；无用户字段时由服务端时区兜底。
- `src/server/country-resolver.ts`（新增）
  - 新增国家解析器：`profile` 优先，`timezone` 次之，最后默认 `CN`。
- `src/server/holiday-resolver.ts`（新增）
  - 新增节假日解析器：基于 `date-holidays` 解析法定节假日，并补充社会节日规则（含圣诞节、平安夜、情人节、万圣节、跨年夜）。
- `src/server/annotation-handler.ts` / `src/server/annotation-prompts.user.ts`
  - 在普通批注与 suggestion 双链路注入 holiday context（`Current holiday / 今日节日 / Festivita di oggi`）。
- `package.json` / `package-lock.json`
  - 新增依赖：`date-holidays`。
- `api/README.md` / `src/api/README.md` / `docs/PROJECT_MAP.md`
  - 同步 annotation `userContext` 字段与新增 server 模块说明。

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`：记录国家字段优先 + 时区兜底、法定/社会节日接入完成。

## 2026-04-08 - Feat: annotation 区分普通记录与待办完成（含特殊待办摘要门控）

### Changed

- `src/lib/todoCompletionAnnotation.ts`（新增）
  - 新增待办完成 annotation 负载构建：输出 `todoCompletionContext`（重要度/重复类型/创建时间/关联瓶子/90天统计）。
  - 新增特殊待办门控：仅在“关联瓶子”或“重复任务（daily/weekly/monthly）”或“创建 >= 3 天”时附加紧凑 `summary`，降低 token 开销。
- `src/store/useChatStore.ts` / `src/store/useChatStore.types.ts`
  - `sendMessage` 增加可选 annotation 事件透传参数（`annotationEventType` / `annotationEventData`），使完成待办可触发 `activity_completed`。
- `src/features/growth/GrowthTodoSection.tsx` / `src/features/growth/FocusMode.tsx`
  - 待办完成路径改为向 annotation 发送完成事件，并附带待办上下文；普通输入保持原 `activity_recorded`。
- `src/store/useTodoStore.ts`
  - `completeTodoByMessage` 调整为返回 `Todo | null`，便于完成路径构建上下文。

### Validation

- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `src/store/README.md`：补充待办完成事件分流、特殊待办判定与 token 控制规则。
- 更新 `api/README.md` / `src/api/README.md`：补充 annotation `eventData.todoCompletionContext` + 条件 `summary` 契约说明。
- 更新 `docs/CURRENT_TASK.md`：记录本轮“待办完成语义化透传”已完成。

## 2026-04-08 - Feat: annotation 先接入结构化日期上下文（Step 1）

### Changed

- `src/types/annotation.ts`
  - 扩展 annotation 请求契约：新增 `userContext.currentDate`（`year/month/day/weekday/weekdayName/isoDate`）。
- `src/store/useAnnotationStore.ts`
  - 在触发 annotation 请求时注入当前本地日期结构化字段，补齐“今天几号/星期几/年月日”数据透传。
- `src/server/annotation-handler.ts` / `src/server/annotation-prompts.user.ts`
  - 将 `currentDate` 注入普通批注与 suggestion 两条 prompt 路径，统一进入 LLM 上下文。
- `api/README.md` / `src/api/README.md`
  - 同步 annotation `userContext` 契约文档，补充 `currentDate` 字段。

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`：记录本次 annotation 日期上下文接入进展（Step 1）。

## 2026-04-08 - Fix: 连续专注休息态右上角关闭确认 + 文案 i18n 对齐

### Changed

- `src/features/growth/FocusMode.tsx`
  - 修复休息倒计时状态点击右上角关闭无反应：现在会弹出确认弹窗。
  - 休息态关闭复用“结束专注”同一套确认文案与按钮；确认后退出整个 FocusMode（终止后续队列），取消则继续休息。
  - 将休息态硬编码文案替换为 i18n key（休息提示、跳过休息按钮）。
- `src/i18n/locales/{zh,en,it}.ts`
  - 新增 `growth_focus_resting` / `growth_focus_skip_rest`。
  - 保持待办拆解按钮文案为 `分步完成 / Step by Step / Passo dopo passo`。
  - 调整 `growth_todo_section`：`今日要事 -> 近日要事`，并同步 `Recent Tasks / Attivita recenti`。

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`：补充本次 Growth 连续专注休息态关闭修复与多语言文案对齐记录。

## 2026-04-08 - Refactor: annotation 建议链路可靠性 + schema 解析 + 文档对齐

### Changed

- `src/store/useAnnotationStore.ts` / `src/types/annotation.ts`
  - 新增 `pendingSuggestionIntent` 持久化意图与消费 action（`setPendingSuggestionIntent` / `consumePendingSuggestionIntent`），用于跨页 suggestion 接受链路。
  - 新增 `PendingSuggestionIntent` 类型。
- `src/components/feedback/AIAnnotationBubble.tsx` / `src/features/growth/GrowthPage.tsx`
  - suggestion 接受主链路改为 store 持久化意图（todo）；移除 `setTimeout + window event` 作为主依赖，事件仅保留 fallback。
- `src/server/annotation-handler.ts`
  - suggestion 解析与相似度逻辑下沉到独立模块，主 handler 聚焦流程编排。
  - 删除 prompt 明文与正文明文日志；新增 `ANNOTATION_VERBOSE_LOGS=true` 控制详细元日志。
- `src/server/annotation-suggestion.ts`（新增）
  - 使用 zod schema (`safeParse`) 约束 suggestion JSON（兼容 mode/legacy 结构），替代脆弱正则解析路径。
  - 统一 suggestion normalize 与 force/recovery fallback 构造。
- `src/server/annotation-similarity.ts`（新增）
  - 抽离相似度、emoji 提取与重写 prompt 工具。
- `src/server/annotation-prompts.defaults.ts`（新增） / `src/server/annotation-prompts.user.ts`（新增） / `src/server/annotation-prompts.ts`
  - prompt 文件按 defaults/user 拆分，`annotation-prompts.ts` 作为聚合出口。
- `src/api/client.ts`
  - 移除重复 `AnnotationRequest/AnnotationResponse` 本地定义，改为复用 `src/types/annotation.ts` 单一契约来源。
- 文档与校验脚本
  - 更新 `docs/PROJECT_MAP.md`、`docs/ARCHITECTURE.md`、`api/README.md`、`src/api/README.md`，对齐 telemetry 路由/端点与 annotation 模块拆分现状。
  - 更新 `scripts/check-doc-sync.mjs`：覆盖 telemetry/profile 路由、`/api/live-input-telemetry` 端点 token，并纳入新增 annotation 子模块 DOC-DEPS 校验。

### Validation

- `npm run lint:docs-sync` ✅
- `npm run lint:state-consistency` ✅
- `npm run lint:max-lines` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`：将本轮 P0/P1/P2 改造项标记为已完成并补充实现口径。

## 2026-04-08 - Fix: iOS 套壳 OAuth 回跳链路 + 输入键盘/放大问题

### Changed

- `src/store/useAuthStore.ts`
  - OAuth 登录 `redirectTo` 改为平台感知：Web 使用 `window.location.origin`，原生套壳使用 `VITE_IOS_OAUTH_REDIRECT_URL`（默认 `com.tshine.app://auth/callback`）。
- `src/lib/mobileAuthBridge.ts`（新增） + `src/main.tsx`
  - 新增 Capacitor `appUrlOpen` 桥接，支持处理 OAuth deep link 回调并执行 Supabase 会话恢复（`exchangeCodeForSession` / `setSession`）。
- `src/features/auth/AuthPage.tsx`
  - Google/Apple OAuth 增加超时兜底，避免回跳失败时登录按钮长期 loading。
- `src/features/report/plant/PlantRootSection.tsx`
  - 日记输入改为直接可编辑并在焦点事件进入编辑态，移除 `readOnly + 异步 focus` 路径，改善 iOS WebView 不弹键盘问题。
- `src/index.css`
  - iOS 防缩放规则扩展到页面级 `input/textarea/select`，统一移动端输入字号下限，降低聚焦自动放大概率。
- `ios/App/App/Info.plist` + `.env.example`
  - 增加 iOS URL scheme（`com.tshine.app`）配置并补充 OAuth redirect 环境变量示例。

### Validation

- `npx tsc --noEmit` ✅
- `npm run lint:docs-sync` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`：新增 `CAPACITOR_IOS_AUTH_INPUT_FIX` 主线与排查/实施清单。
- 更新 `docs/CHANGELOG.md`：记录本次 iOS 套壳修复代码与配置路径。

## 2026-04-08 - Fix: 待办拆解改用 OpenAI + 分步完成文案 + 空结果提示

### Changed

- `api/todo-decompose.ts`
  - 将待办拆解模型调用从 DashScope(Qwen)切换为 OpenAI Chat Completions，密钥改为 `OPENAI_API_KEY`。
  - 新增 `TODO_DECOMPOSE_MODEL` 环境变量（默认 `gpt-4o-mini`），并启用 `response_format: json_object` 提升 JSON 输出稳定性。
  - 保留并强化 JSON 解析兜底与时长范围 clamp（5-90 分钟）。
- `src/features/growth/SubTodoList.tsx`
  - 修复字段映射：`durationMinutes` 正确映射到 store 所需的 `suggestedDuration`，避免子步骤建议时长丢失。
  - 新增空步骤提示分支：当接口成功但未返回可用步骤时，给出可读反馈而非统一失败文案。
- `src/i18n/locales/{zh,en,it}.ts`
  - 拆解按钮文案更新为更柔和表达：`分步完成` / `Step by Step` / `Passo dopo passo`。
  - 新增 `todo_decompose_empty` 文案，用于“返回空步骤”提示。
- `api/README.md` / `src/api/README.md` / `.env.example`
  - 同步 `/api/todo-decompose` 契约、provider 说明与 `TODO_DECOMPOSE_MODEL` 配置说明。

## 2026-04-08 - Feat: AI 待办拆解 + 连续专注队列模式

### Added

- `api/todo-decompose.ts`（新增）
  - 新 Serverless 端点 `POST /api/todo-decompose`，接收 `{title, lang}`，调用 QWEN_API_KEY 将待办拆解为 3-6 个子步骤，每步返回 `{title, durationMinutes}`。
  - 支持 zh / en / it 三语言 prompt，输出结果做 clamp（5-90 分钟）。
- `src/features/growth/SubTodoList.tsx`（新增）
  - 子步骤列表组件，渲染在 `GrowthTodoCard` 展开面板底部。
  - 包含"AI 拆解"按钮（调用 `callTodoDecomposeAPI`，loading/error 状态）。
  - 每条子步骤支持单独勾选、单独开番茄钟。
  - 子步骤 ≥ 2 条未完成时显示"连续专注"按钮（浅蓝色药丸样式）。

### Changed

- `src/store/useTodoStore.ts`
  - `Todo` 接口新增 `parentId?: string` 和 `suggestedDuration?: number` 字段。
  - 新增 `addSubTodos(parentId, steps[])` action：批量创建子待办并同步 Supabase。
  - `toggleTodo` 新增父待办自动完成逻辑：所有子步骤勾完时自动标记父待办完成。
- `src/lib/dbMappers.ts`
  - `fromDbTodo` / `toDbTodo` / `toDbTodoUpdates` 映射新增 `parent_id`、`suggested_duration` 字段。
- `src/api/client.ts`
  - 新增 `callTodoDecomposeAPI(title, lang)` 函数及 `DecomposeStep` 类型。
- `src/features/growth/GrowthTodoCard.tsx`
  - 新增 `subTodos` 和 `onSequentialFocus` props。
  - 展开面板末尾接入 `SubTodoList` 组件。
- `src/features/growth/GrowthTodoSection.tsx`
  - 构建 `subTodoMap`（parentId → sub-todos），过滤掉有 `parentId` 的子待办不在主列表渲染。
  - 向 `GrowthTodoCard` 传入 `subTodos` 和 `onSequentialFocus`。
- `src/store/useFocusStore.ts`
  - 新增 `queue: FocusQueueItem[]`、`queueIndex: number` 队列状态。
  - 新增 `startFocusQueue(items)`、`advanceQueue()`、`clearQueue()` actions。
  - persist 改为只持久化 `sessions`，队列和 currentSession 不持久化（页面刷新不恢复计时）。
- `src/features/growth/FocusMode.tsx`
  - 新增 `queueTodos` prop，进入队列模式。
  - 顶部显示步骤进度轨道（完成/进行中/待开始三态）。
  - 步骤完成后进入 5 分钟休息倒计时，可跳过，自动推进下一步。
  - 队列模式开始按钮文案改为"连续专注"，隐藏正计时按钮。
- `src/features/growth/GrowthPage.tsx`
  - 新增 `focusQueue` state，`onSequentialFocus` 回调将子步骤列表传入 `FocusMode`。
- `src/i18n/locales/zh|en|it.ts`
  - 新增翻译 key：`todo_decompose_btn`、`todo_decompose_loading`、`todo_decompose_error`、`todo_decompose_steps_label`、`todo_decompose_min`、`todo_sequential_focus`。

### Database

- `todos` 表新增字段：
  - `parent_id UUID REFERENCES todos(id) ON DELETE CASCADE`
  - `suggested_duration INTEGER`
  - 索引：`idx_todos_parent_id ON todos(parent_id)`

---

## 2026-04-07 - Feat: 建议模式新增中断挽回提醒与 2 星一次性奖励

### Changed

- `src/lib/recoverySuggestion.ts`（新增）
  - 新增中断检测器：
    - 识别 active 瓶子连续 3 天未完成；
    - 识别 daily/weekly 重复待办“昨日断档”；
    - 产出 `recoveryNudge`（包含 `key/reason/rewardStars/todoId|bottleId`）。
  - 新增提醒时机控制：
    - 优先按目标历史完成时间计算提醒时段；
    - 无历史统一采用中午 12 点窗口（±2h）；
    - 同一 key 每日最多提醒 2 次，二次提醒最小间隔 4h。
- `src/store/useAnnotationStore.ts`
  - 在 suggestion 上下文注入 `userContext.recoveryNudge`，并在命中时强制建议输出。
  - 新增当日提醒去重（`shownRecoverySuggestionKeys`）与一次性奖励状态（`activeRecoveryBonus`）。
  - 新增 `consumeRecoveryBonusForCompletion()`：完成匹配 todo/bottle 时消费奖励并返回星数（默认 1，奖励 2）。
- `src/server/annotation-prompts.ts` / `src/server/annotation-handler.ts`
  - suggestion prompt 新增 recovery nudge 规则（要求“今天完成可得两颗星”）。
  - 解析 suggestion JSON 时支持并透传奖励字段：`rewardStars`、`rewardBottleId`、`recoveryKey`。
  - 新增强制兜底：当 recovery nudge 存在时，即使模型输出异常也返回可执行建议和 2 星奖励元数据。
- `src/features/growth/GrowthTodoSection.tsx` / `src/features/growth/FocusMode.tsx` / `src/store/useChatStore.ts` / `src/store/useGrowthStore.ts`
  - 统一星星发放路径支持倍率（`incrementBottleStars`）。
  - 在 todo 完成、focus 完成、活动匹配瓶子完成时优先消费 recovery bonus，实现“建议并开始后完成得 2 星”。
- `src/types/annotation.ts` / `src/api/client.ts`
  - 扩展 annotation 契约：新增 `RecoveryNudgeContext` 与 suggestion 奖励字段类型。
- 测试
  - 新增 `src/lib/recoverySuggestion.test.ts`（3 天断档、昨日断档、当日去重）。
  - 扩展 `src/server/annotation-handler.test.ts`（验证 recovery nudge 注入 2 星字段）。

### Validation

- `npx vitest run src/lib/recoverySuggestion.test.ts src/server/annotation-handler.test.ts src/components/feedback/AIAnnotationBubble.test.ts` ✅
- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（记录中断挽回提醒与 2 星奖励落地）。
- 更新 `src/store/README.md`、`src/api/README.md`、`api/README.md`（同步 annotation 新契约与奖励元数据）。

## 2026-04-07 - Chore: 魔法笔 EN/IT 提示词对齐最新中文规则

### Changed

- `src/server/magic-pen-prompts.ts`
  - 同步更新 `MAGIC_PEN_PROMPT_EN` 与 `MAGIC_PEN_PROMPT_IT`，对齐当前中文提示词的意图边界：
    - `activity` 语义收敛为“当前进行中，通常不超过一件”；
    - `activity_backfill` 扩展为“已完成/前置/常识上已发生”的事件；
    - 混合句新增硬规则：同输入最多保留一个 `activity`，其余活动片段默认转 `activity_backfill`，仅明确并行表达时允许并行活动；
    - 补充“已识别当前活动 + 更早明确时间活动 -> backfill”的判定说明。

### Validation

- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（记录本次魔法笔多语言 prompt 对齐）。

## 2026-04-07 - UX: 日记详情页植物图支持打开植物翻转卡

### Changed

- `src/features/report/ReportDetailModal.tsx`
  - 新增 `onOpenPlantCard` 回调接口。
  - 在日记第 2 页（观察日记区）将植物图片改为可点击入口；有当日植物记录时点击可触发外层打开植物卡片。
- `src/features/report/ReportPage.tsx`
  - 新增 `openedPlantCard` 状态，用于承接 `ReportDetailModal` 点击事件并展示 `PlantCardModal`。
  - 挂载 `PlantCardModal`，复用现有 `PlantFlipCard`（含背面根系交互）与关闭逻辑。

### Validation

- `npx tsc --noEmit` ✅
- `npx vitest run src/features/report/reportPage.integration.test.tsx` ⚠️ 失败（现有测试 mock 缺少 `initReactI18next` 导出，与本次改动无关）

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（记录本次日记植物图到植物卡片入口接入）。

## 2026-04-07 - Fix: 魔法笔自动写入改为直接执行 AI kind（移除二次分类漂移）

### Changed

- `src/features/chat/chatPageActions.ts`
  - mode-on parser 路径下，`autoWriteItems` 不再走 `sendAutoRecognizedInput(...)` 二次分类，改为调用新的 `writeMagicPenAutoItem(...)` 直接按 AI `kind` 执行写入。
  - 删除 `unparsedSegments` 的本地二次重分类与“提升自动写入”逻辑，未识别片段统一留在 Sheet review。
  - active todo 自动完成判定改为基于本次实际写入 `kind`，避免依赖二次分类结果。
- `src/features/chat/ChatPage.tsx`
  - 为魔法笔新增 `writeMagicPenAutoItem` 注入：`kind=mood` 直写 `sendMood`，`kind=activity` 直写 `sendMessage`；若存在 `linkedMoodContent`，补发关联心情。
- `src/features/chat/chatPageActions.test.ts`
  - 回归测试更新：验证 parser auto-write 使用 AI kind 直写、unparsed 不再自动提升、以及 mixed 场景仍正确打开 review。

### Validation

- `npm run test:unit -- src/features/chat/chatPageActions.test.ts` ✅
- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（记录本次魔法笔“移除二次分类”修复）。

## 2026-04-06 - Feat: Today Context 词库增强（zh/en/it）与误判抑制

### Changed

- `src/lib/todayContext.ts`
  - 将 today context 识别从简单关键词 includes 升级为规则化匹配（regex patterns + excludes）。
  - 扩充 `health/special_day/major_event` 三类多语言词库，覆盖感冒生病、升学/求职、关系变化、搬家、孕育、丧亲等关键事件表达。
  - 追加女性经期语义识别（如“来例假/痛经”、`on my period`、`ho il ciclo`）并纳入 health 类。
  - 继续扩充细粒度生活病症词库：牙痛/智齿发炎/口腔溃疡/反酸/落枕等，并采用英语/意大利语常用表达（如 `my tooth is killing me`、`dente del giudizio infiammato`、`afte`）。
  - 医疗就诊补充牙科场景（看牙医、根管、拔牙、补牙及对应 en/it 表达）。
  - 新增健康类否定拦截（如“我没有感冒”/`not sick`/`non sto male`）避免误命中。
  - 对高歧义词增加排除规则（如 `cold plunge`）降低非疾病场景误报。
- `src/lib/todayContext.test.ts`
  - 新增多语言回归：英文疾病命中与误判拦截、意大利语重大事件、否定句不命中、同类单条保留、special_day+major_event 同时命中。
  - 补充经期健康信号与婚恋重大事件命中用例。
  - 新增牙痛/溃疡多语言命中与牙科就诊命中回归。

### Validation

- `npx vitest run src/lib/todayContext.test.ts` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（记录 today context 词库补强与误判抑制已完成）。

## 2026-04-06 - Feat: Today Context 同步到 Supabase annotations

### Changed

- `src/types/annotation.ts`
  - `AIAnnotation` 新增 `todayContext?: TodayContextSnapshot` 字段，保存生成时上下文快照。
- `src/store/useAnnotationStore.ts`
  - 批注对象创建时挂载 `todayContext`，并随 `toDbAnnotation(...)` 进入云端。
- `src/lib/dbMappers.ts`
  - `toDbAnnotation` 新增 `today_context` 写入。
  - `fromDbAnnotation` 新增 `today_context` 回读。
- `docs/SUPABASE_TODAY_CONTEXT_SQL.md`
  - 新增迁移 SQL：`annotations.today_context jsonb` + GIN/日期表达式索引 + 校验语句。
- `docs/SUPABASE_PERSISTENCE_INVENTORY.md`
  - Annotations 持久化字段清单新增 `today_context`。
- `src/api/README.md`
  - 标注 annotation `userContext` 契约新增 `todayContext`。
- `api/README.md`
  - 标注 `/api/annotation` `userContext` 支持 `todayContext`。

### Validation

- `npx tsc --noEmit` ✅
- `npx vitest run src/lib/todayContext.test.ts` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（记录 today context 云端落库完成）。
- 新增 `docs/SUPABASE_TODAY_CONTEXT_SQL.md`（可直接复制到 Supabase SQL Editor 执行）。

## 2026-04-06 - Feat: Today Context（今日上下文）最小闭环接入 annotation 链路

### Changed

- `src/lib/todayContext.ts`
  - 新增 today context 关键词识别与日级缓存合并逻辑（`health` / `special_day` / `major_event`）。
  - 新增跨天自动失效、同类去重、最多 5 条保留策略。
- `src/store/useAnnotationStore.ts`
  - 新增 `todayContextSnapshot` 状态并持久化。
  - 在 `triggerAnnotation` 中接入“事件文本识别 -> 当日缓存更新 -> `userContext.todayContext` 透传”。
  - 在日重置动作中同步清空 today context。
- `src/types/annotation.ts`
  - 新增 `TodayContextCategory` / `TodayContextItem` / `TodayContextSnapshot` 类型。
  - 扩展 `AnnotationRequest.userContext.todayContext`。
- `src/api/client.ts`
  - 扩展 annotation 请求契约，支持 `userContext.todayContext`。
- `src/server/annotation-prompts.ts`
  - 新增 `buildTodayContextText(...)`。
  - 在普通批注与 suggestion prompt 中注入 `today context` 段落（zh/en/it）。
- `src/server/annotation-handler.ts`
  - 在 API handler 中构建并透传 `todayContextText` 到两条 prompt 组装路径。
- `src/lib/todayContext.test.ts`
  - 新增识别、跨天失效、去重排序 3 个单测用例。

### Validation

- `npx vitest run src/lib/todayContext.test.ts` ✅
- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（记录 today context P0 最小闭环完成）。

## 2026-04-04 - Fix: AI companion prompts ESM import resolution on Vercel

### Changed

- `src/lib/aiCompanion/prompts/index.ts`
  - 将四个 re-export 改为显式 `.js` 后缀（`./van.js` / `./agnes.js` / `./zep.js` / `./momo.js`），避免 Node ESM 在 serverless 运行时把无后缀路径解析为不存在模块。

### Validation

- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（记录本次 Vercel `ERR_MODULE_NOT_FOUND` 修复）。

## 2026-04-03 - Feat: 活动词库补强（zh/en/it 操作型表达扩展）

### Changed

- `src/services/input/lexicon/activityLexicon.zh.ts`
  - 新增 24 条中文操作型活动短语，覆盖查询/修改/提交/认证/账号操作（如 `查询日志`、`提交审核`、`重置密码`）。
- `src/services/input/lexicon/activityLexicon.en.ts`
  - 新增 26 条英文操作型活动短语，覆盖 query/edit/submit/auth/account 场景（如 `query logs`、`submit ticket`、`two-factor authentication`）。
- `src/services/input/lexicon/activityLexicon.it.ts`
  - 新增 25 条意大利语操作型活动短语，覆盖查询/修改/提交/认证/账号场景（如 `cercare log`、`inviare richiesta`、`reimpostare password`）。
- `src/services/input/lexicon/categoryLexicon.zh.ts`
  - 补充中午/工作语境分流关键词：数据/日志/工单/提交流程归 `work`；订单/快递/账号操作归 `life`。
- `src/services/input/lexicon/categoryLexicon.en.ts`
  - 增补 EN 语境分流关键词：query/submit/review/auth 归 `work`；order/package/account 操作归 `life`。
- `src/services/input/lexicon/categoryLexicon.it.ts`
  - 增补 IT 语境分流关键词：operational work actions 归 `work`；ordine/pacco/account 操作归 `life`。
- `src/services/input/signals/latinSignalExtractor.ts`
  - 扩展 Italian 语言信号词，新增 `cercare/tracciare/reimpostare/disconnettersi/identita/autenticazione`，确保新增 IT 操作词不会误判为英语语句。
- `src/services/input/liveInputClassifier.test.ts`
  - 新增中文回归用例：`查询日志`、`查询快递`、`重置密码`。
- `src/services/input/liveInputClassifier.i18n.test.ts`
  - 新增英语与意大利语回归用例：`query logs/look up order/reset password`、`cercare log/tracciare pacco/reimpostare password`。

### Validation

- `npx vitest run src/services/input/liveInputClassifier.test.ts src/services/input/liveInputClassifier.i18n.test.ts` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（记录本次词库补强完成项）。

## 2026-04-02 - Prompt: suggestion 场景规则补强（zh/en/it）

### Changed

- `src/server/annotation-prompts.ts`
  - 在 `buildSuggestionAwareUserPrompt(...)` 的三语分支中新增两条场景规则：
    - 用户生病/身体不适时，优先给出具体可执行的休息建议（含动作+时长），并避免推荐工作/学习任务。
    - 用户难过/低落时，先简短共情，再基于用户常做活动给出低负担、可立即开始的小建议。

### Validation

- 未执行（本次为 prompt 文案策略调整）。

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（记录本次 suggestion prompt 多语言规则补强）。

## 2026-04-02 - UX: 我的页 AI 选中态小幅回调（鼠尾草+淡金）

### Changed

- `src/features/profile/components/AIModeSection.tsx`
  - 将 AI 陪伴模式选中态从过淡绿微调回更有层次的鼠尾草玻璃感（仅小幅增加深度）。
  - 同步细调开关开启态与选中文字颜色，保持清透但不发白。
- `src/features/profile/components/AIAnnotationDropRate.tsx`
  - 将陪伴频率选中金色做轻微降饱和和提亮处理，保留暖感但减轻厚重感。

### Validation

- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（记录本次鼠尾草/淡金小幅回调）。

## 2026-04-02 - UX: 我的页 AI 模式绿色选中态清透化微调

### Changed

- `src/features/profile/components/AIModeSection.tsx`
  - AI 陪伴模式选中卡片由偏实的绿色改为低饱和玻璃感绿色渐变，增强清透与轻盈感。
  - 同步降低选中文字对比度，并弱化开关开启态阴影，避免视觉过重。

### Validation

- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（记录本次绿色选中态清透化微调）。

## 2026-04-02 - Plant: 本月同根系植物候选去重

### Changed

- `api/plant-generate.ts`
  - 新增按生成日期计算当月区间并查询 `daily_plant_records.plant_id` 的逻辑。
  - 对当前根系候选池按 `plantId` 做「本月去重」过滤，AI 仅从当月未使用候选中选择。
  - 当候选池耗尽时返回新状态 `monthly_exhausted`（含 message），不再继续生成。
- `src/types/plant.ts`
  - 扩展 `PlantApiStatus`：新增 `monthly_exhausted`。
- `src/features/report/plant/PlantRootSection.tsx`
  - 生成按钮反馈增加 `monthly_exhausted` 分支提示。
- `src/i18n/locales/{zh,en,it}.ts`
  - 新增 `plant_generate_monthly_exhausted` 文案。

### Validation

- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `api/README.md` 与 `src/api/README.md`（同步 plant-generate 新状态契约）。
- 更新 `docs/CURRENT_TASK.md`（记录本次植物月内去重改动）。

## 2026-04-02 - UX: 我的页 AI 选中态恢复上一版绿色风格

### Changed

- `src/features/profile/components/AIModeSection.tsx`
  - AI 陪伴模式开关开启态从新版蓝色发光恢复为旧版绿色底色。
  - 角色卡选中态恢复为绿色描边 + 浅绿色背景，移除蓝色文本/发光样式。
- `src/features/profile/components/AIAnnotationDropRate.tsx`
  - 陪伴频率选中按钮恢复为旧版绿色选中态（绿色描边、浅绿色底、绿色文字）。

### Validation

- 未执行（本次为样式回退，未改业务逻辑）。

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（记录本次 profile 选中态 UI 回退）。

## 2026-04-02 - UX: 日记详情页切换为 notebook 双页视觉

### Changed

- `src/features/report/ReportDetailModal.tsx`
  - 以 `日记页UI 0401` 为参考重建日记详情页视觉：顶部 notebook 导航 + 日期抬头 + 虚线分隔结构。
  - 第 1 页改为 `activity / mood / to-do / habits` 四段分栏，含环形图、进度条与星标展示。
  - 第 2 页改为 `AI 观察 + my diary` 上下结构，保留 AI 日记生成入口、植物图展示与手写日记保存。
  - 保留原有日切换入口（上一天/下一天）与只读模式下的历史日记展示。

### Validation

- `npm run build` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（补充本次 notebook 风格日记页 UI 对齐记录）。

## 2026-03-31 - UX: Growth 待办卡片支持双击标题快速编辑

### Changed

- `src/features/growth/GrowthTodoCard.tsx`
  - 新增标题双击编辑：双击待办标题后进入内联输入态，可直接修改卡片文字。
  - 新增编辑提交/取消交互：`Enter` 或失焦保存，`Esc` 取消并恢复原标题。
  - 编辑态与长按拖拽隔离：标题区域标记为非拖拽区，避免双击改标题时误触发拖拽。

### Validation

- 未执行（本次为单组件交互增强）。

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（补充本次待办卡片双击编辑交互记录）。

## 2026-03-31 - UX: 首页/我的头像点击逻辑统一为放大预览+右下角三点换头像

### Changed

- `src/features/chat/components/DatePicker.tsx`
  - 首页头像点击改为先打开放大预览弹层，不再直接触发文件选择。
  - 放大预览新增右下角三点菜单，支持「更换头像」。
  - 上传头像压缩参数提升为 `640px + JPEG 0.95`，放大预览更清晰。
- `src/features/profile/components/UserInfoCard.tsx`
  - 「我的」页头像弹层交互改为与首页一致：放大图 + 右下角三点换头像。
  - 移除原独立底部「更换头像」按钮，统一通过三点菜单操作。
  - 上传头像压缩参数提升为 `640px + JPEG 0.95`，优化放大图清晰度。
- `src/lib/imageUtils.ts`
  - `resizeImageToDataUrl` 新增 `quality` 参数（默认 `0.85`），支持高质量头像上传场景。

### Validation

- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（补充本次头像交互统一与清晰度优化记录）。

## 2026-03-31 - UX: 待办卡片支持长按拖拽换序

### Changed

- `src/features/growth/GrowthTodoSection.tsx`
  - 新增长按拖拽交互：用户长按待办卡片后可上下拖动，与其他待办卡片交换顺序。
  - 增加拖拽中的视觉反馈（卡片跟随位移与轻微放大），并在松手后提交最终顺序。
  - 对按钮、输入框等交互控件增加拖拽排除，避免误触发长按拖拽。
- `src/store/useTodoStore.ts`
  - 新增 `reorderTodosByIds(orderedIds)`，按最终顺序批量更新 `sortOrder` 并同步 Supabase。

### Validation

- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（补充本次待办长按拖拽换序交互）。

## 2026-03-31 - UX: 待办卡片移除六点拖拽图标 + 删除叉仅点击后显示

### Changed

- `src/features/growth/GrowthTodoCard.tsx`
  - 移除待办勾选框前的六点拖拽图标（`GripVertical`），主行信息更简洁。
  - 待办卡片右上角删除叉改为默认不显示，仅在用户点击该卡片后显示。
  - 卡片点击展开状态对已完成待办同样生效，以便在不显示 hover 的情况下仍可触发删除入口。

### Validation

- 未执行（本次为 UI 交互微调）。

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（补充本次待办卡片交互微调记录）。

## 2026-03-31 - UX: 成长页卡片删除叉按交互显示 + 瓶子区下移

### Changed

- `src/features/growth/BottleCard.tsx`
  - 删除叉按钮改为默认隐藏，移动端仅在用户点击瓶子周围区域后显示；桌面端继续保留 hover 显示。
  - 点击瓶子本体触发「生成待办」主动作，不再与删除态共用同一次点击。
  - 新增卡片外点击收起逻辑，避免删除叉长期悬浮。
- `src/features/growth/GrowthTodoCard.tsx`
  - 删除叉按钮改为默认隐藏，移动端仅在卡片展开后显示；桌面端继续保留 hover 显示。
- `src/features/growth/BottleList.tsx`
  - 瓶子横向列表增加顶部间距，使整体视觉位置下移。

### Validation

- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（补充本次 Growth 页交互与布局微调）。

## 2026-03-30 - Test/Fix: suggestion 意图识别补充自然表达覆盖

### Changed

- `src/lib/suggestionIntentDetector.ts`
  - 扩展显式求建议规则，新增对自然表达的识别：
    - "给点/给些/来点建议"
    - "能不能/能否/可以 + 给我/给点 + 建议"
    - "我该/我应该 + 先做哪个/选哪个"
    - "我该...还是..." 决策句式
    - "告诉我下一步" 与 "接下来我应该..." 句式

### Added Tests

- `src/lib/suggestionIntentDetector.test.ts`
  - 新增自然表达正例、陈述句负例、非中文输入、空白与标点噪声等覆盖，测试总数从 3 增加到 7。

### Validation

- `npx vitest run src/lib/suggestionIntentDetector.test.ts` ✅
- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（补充本次 suggestion 意图识别补测与漏判修复）。

## 2026-03-30 - Feat: 显式求建议直通（中文）+ 强制建议兜底

### Changed

- `src/lib/suggestionIntentDetector.ts`（新增）
  - 新增中文显式求建议意图识别与打分（覆盖"帮我规划/帮我选择/该怎么办/下一步做什么"等表达）。
- `src/store/useAnnotationStore.ts`
  - 新增显式求建议检测：命中后可绕过批注触发门槛（冷却/概率/日限）并直通 suggestion 请求。
  - 透传 `userContext.forceSuggestion` 到 `/api/annotation`。
  - 保持 suggestion 记账逻辑不变：显式建议命中后仍会消耗分时段配额并刷新 suggestion 冷却（影响后续主动建议）。
- `src/server/annotation-prompts.ts`
  - suggestion-aware prompt 新增 `forceSuggestion` 分支：显式求建议时强制模型只输出 suggestion JSON。
- `src/server/annotation-handler.ts`
  - 新增 `forceSuggestion` 模式（`allowSuggestion || forceSuggestion`）。
  - 新增强制建议兜底：当模型未返回可解析 suggestion JSON 或分支异常时，服务端构造可执行 suggestion，确保前端按钮可展示。
- `src/types/annotation.ts` / `src/api/client.ts`
  - 扩展 annotation userContext 契约：新增 `forceSuggestion?: boolean`，并补齐 `timezone?: string` 类型。

### Added Tests

- `src/lib/suggestionIntentDetector.test.ts`（新增）
  - 覆盖中文显式求建议识别与普通记录不误触发。
- `src/server/annotation-handler.test.ts`
  - 新增 `forceSuggestion=true` 用例，验证在非 JSON 输出下仍返回 suggestion。

### Validation

- `npx vitest run src/lib/suggestionIntentDetector.test.ts src/server/annotation-handler.test.ts` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（补充显式求建议直通与配额/冷却策略说明）。

## 2026-03-30 - UX: AI 批注头像改为半悬浮超出弹窗

### Changed

- `src/components/feedback/AIAnnotationBubble.tsx`
  - 移除批注头像的圆形白色头像框（`bg-white` + `ring`）。
  - 将 AI 人设头像放大，并改为 `absolute` 定位到卡片左上角外侧，呈现“半悬浮超出弹窗”的视觉。
  - 批注文案区域增加左侧内边距，避免与放大头像重叠。

### Validation

- `npm run build` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（补充本次 AI 批注头像视觉改动）。

## 2026-03-29 - Fix: Live Input Telemetry 缺表容错与提示文案修正

### Changed

- `api/live-input-dashboard.ts`
  - 新增 `isMissingOptionalTableError(...)`，将 Supabase 缺表错误从仅识别 `42P01` 扩展到兼容 `PGRST205` 与常见缺表 message（`does not exist` / `schema cache`）。
  - `plant_asset_events` 与 `telemetry_events` 查询在缺表场景下按空结果降级，不再中断整页看板。
- `src/features/telemetry/LiveInputTelemetryPage.tsx`
  - 修正告警文案中内联 `<code>` 前后的空白拼接，避免出现 `metadata.LIVE_INPUT_ADMIN_EMAILS` / 环境变量名称粘连显示。

### Validation

- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（补充本次 telemetry 看板修复项）。

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

- Added shared companion persona definitions in `src/lib/aiCompanion.ts` for the four supported modes: `van`, `agnes`, `zep`, and `momo`.
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
