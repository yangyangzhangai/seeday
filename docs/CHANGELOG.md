# Changelog

All notable effective changes are documented here.

> Note: 仅保留近期变更；更早且已收口的历史记录已清理，避免维护噪音。

## 2026-04-24

### Build: Membership AI classification tiering phase-1

- `/api/classify` 接入 `requireSupabaseRequestAuth`，并在服务端强制 Plus 校验；非 Plus 统一返回 `403 { error: 'membership_required' }`（包含 classify 与 todo_decompose 分支）
- `src/api/client.ts` 的 `callClassifierAPI()` 开始透传 Supabase `Authorization` 头，统一走鉴权 classify
- `src/store/useChatStore.ts` 完成 Free/Plus 分流与 classify 去重：
  - Free 仅本地规则，不触发 classify
  - Plus 按 `messageId` 复用单次 classify promise，避免 `sendMessage/endActivity` 重复调用
  - 星星判定改为 Plus 优先消费 AI `matched_bottle`，未命中再关键词兜底
  - AI 失败自动回退本地分类，不阻断记录链路
- `src/store/useTodoStore.ts` 的 `refineTodoCategoryWithAI()` 增加 Plus 门控，Free 不再触发该 AI 精修
- 文档同步：`docs/MEMBERSHIP_AI_CLASSIFICATION_TECH_DESIGN.md` 增加可持续打勾执行看板；`docs/CURRENT_TASK.md` 新增主线 E；`api/README.md`、`src/api/README.md`、`src/store/README.md` 同步策略口径

Validation:

- `npx tsc --noEmit` ✅
- `npx vitest run "src/store/useChatStore.integration.test.ts"` ✅

### Improve: DATA_STORAGE_P2 phase-5 owner-trusted migration guard

- 新增 `src/store/authLocalMigrationPolicy.ts`，收敛本地数据迁移决策：`sync_local_to_cloud / clear_local / block_unknown_owner / noop`
- `src/store/useAuthStore.ts` 在 `initialize` 与 `SIGNED_IN` 路径统一复用迁移策略：
  - owner 跨账号时清理当前 scope 本地域数据，阻断串号
  - v2 开启 + owner=unknown + 有本地数据时进入安全模式并记录 `unknown_owner_migration_blocked`
  - 仅 owner 可信（`anonymous` / `user(current)`）时自动执行 legacy `seeday:v1:* -> seeday:v2:*` 迁移
- `src/store/useAuthStore.ts` 在 unknown-owner 安全模式下停止 `syncLocalAnnotations(...)` 自动上云，避免旧本地数据误传当前账号
- 新增 `src/store/authLocalMigrationPolicy.test.ts`，覆盖 owner-trusted 迁移准入、unknown-owner v2 阻断、v1 兼容迁移与跨账号清理决策

Validation:

- `npx vitest run "src/store/authLocalMigrationPolicy.test.ts" "src/store/storageScope.test.ts" "src/services/reminder/reminderScheduler.scope.test.ts" "src/services/reminder/reminderScheduler.account-switch.test.ts"` ✅
- `npx tsc --noEmit` ✅
- `npm run build` ✅

### Improve: DATA_STORAGE_P2 phase-4.2 freeDay scoped policy finalized

- `src/services/reminder/reminderScheduler.ts` 将 `freeDay_<date>` 明确纳入 user-scoped key（`seeday:v2:*:local:freeDay_<date>`），避免同设备多账号共用节假日缓存
- `src/services/reminder/reminderScheduler.ts` 与 `src/services/notifications/localNotificationService.ts` 统一复用 `src/store/storageScope.ts` 的 `getScopedClientStorageKey()/resolveStorageScopeForUser()`，移除重复 scoped key 拼接逻辑
- 新增 `src/services/reminder/reminderScheduler.scope.test.ts`，覆盖 `freeDay_<date>` 在 A/B 账号下分桶缓存不串读，以及 v2 关闭时 legacy key 兼容
- 新增 `src/services/reminder/reminderScheduler.account-switch.test.ts`，覆盖 A/B 账号切换下 `reminder_scheduled_date` / `reminder_today_count` 按 user scope 隔离
- `src/services/reminder/reminderScheduler.ts` 增加 `freeDay_<date>` legacy key 迁移：v2 开启且命中旧全局 key 时，自动迁移到 scoped key 并删除旧 key
- `src/store/todoStoreHelpers.ts` 将 `todo-storage` 明确标注为 legacy 迁移键常量，保留兼容读取并在迁移后删除
- `docs/CURRENT_TASK.md` 将 `P2-4.2` / `P2-4.3` 标记为完成；`docs/DATA_STORAGE_AUDIT_REPORT.md` 同步扩展非 domain key 全量分类清单（user/global/待淘汰）
- `docs/CURRENT_TASK.md` 将 `P2-4.4` 标记为完成，并补充遗留 key 清理记录
- `docs/PROACTIVE_REMINDER_SPEC.md` 同步 `freeDay` 缓存示例为 scoped key 版本，避免规格与实现偏差

Validation:

- `npx tsc --noEmit` ✅
- `npx vitest run "src/store/storageScope.test.ts"` ✅
- `npx vitest run "src/store/storageScope.test.ts" "src/services/reminder/reminderScheduler.scope.test.ts"` ✅
- `npx vitest run "src/store/storageScope.test.ts" "src/services/reminder/reminderScheduler.scope.test.ts" "src/services/reminder/reminderScheduler.account-switch.test.ts"` ✅
- `npm run build` ✅

## 2026-04-23

### Improve: DATA_STORAGE_P2 phase-4 second batch scoped local keys

- `src/features/report/plant/PlantImage.tsx` 将植物图片缓存 key 从全局 `plant_img_v1_<plantId>` 改为 scope-aware key，避免多账号切换后读取到其他账号缓存
- `src/services/notifications/localNotificationService.ts` 的 `idle_nudge_scheduled_at` 改为 scope-aware key，并调整 `scheduleIdleNudge/cancelIdleNudge` 支持按 userId 分桶
- `src/hooks/useReminderSystem.ts` 前后台切换链路透传 userId 给 idle nudge 调度/取消
- `docs/DATA_STORAGE_AUDIT_REPORT.md` 新增 P2-4.1 非 domain key 分类清单，并将 `P2-4.1` 在 `docs/CURRENT_TASK.md` 标记为完成

Validation:

- `npx tsc --noEmit` ✅
- `npx vitest run "src/store/storageScope.test.ts"` ✅
- `npm run build` ✅

### Improve: DATA_STORAGE_P2 phase-4 first batch non-domain key scoping

- `storageScope.ts` 新增 `getScopedClientStorageKey()`，用于非 domain local/session key 的 scope-aware 命名（`seeday:v2:user:<userId>:local:<key>` / `seeday:v2:anon:local:<key>`）
- 首批用户行为 key 改为 user-scoped：
  - `chat_input_draft`（`src/features/chat/ChatPage.tsx`，并在 v2 开关开启时做 legacy key 迁移）
  - `yesterday_popup_date`（`src/features/chat/components/YesterdaySummaryPopup.tsx`）
  - `night_reminder_dismissed_date`（`src/hooks/useNightReminder.ts`）
  - `pending_notification_confirm_action`（`src/hooks/useReminderSystem.ts`）
  - `reminder_today_count` / `reminder_scheduled_date`（`src/services/reminder/reminderScheduler.ts` + `src/features/profile/components/RoutineSettingsPanel.tsx`）
- `src/store/storageScope.test.ts` 增补非 domain scoped key 断言

Validation:

- `npx tsc --noEmit` ✅
- `npx vitest run "src/store/storageScope.test.ts"` ✅
- `npm run build` ✅

### Build: DATA_STORAGE_P2 phase-2/3 scope-first auth + scoped persist rollout

- 新增 `src/store/scopedPersistStorage.ts`，将 Zustand persist storage 统一切到 scope-aware key 解析：`VITE_MULTI_ACCOUNT_ISOLATION_V2=true` 时读写 `seeday:v2:user:<userId>:<domain>` / `seeday:v2:anon:<domain>`，关闭开关时兼容回退 `seeday:v1:<domain>`
- 12 个 persisted domain store 全量接入 `storage: createScopedJSONStorage(...) + skipHydration: true`，由 `domainPersistHydration.ts` 统一手动 rehydrate
- `useAuthStore.initialize()` / `SIGNED_IN` / `SIGNED_OUT` / `signOut()` 改为 scope-first：先切 scope，再 rehydrate，再执行迁移判定与 sync/fetch；`clearLocalDomainStores` 改为 scope-aware 清理
- `useOutboxStore.flush()` 新增 active scope guard，v2 模式下仅允许当前 scope 的 userId 触发补推，避免切号串 flush
- 新增 `src/store/storageScope.test.ts` 与 `docs/MULTI_ACCOUNT_ISOLATION_E2E.md`，补齐 P2-0.3 最小测试基座（单测骨架 + 手工 e2e 脚本）

Validation:

- `npx tsc --noEmit` ✅
- `npx vitest run "src/store/useAuthStore.test.ts" "src/store/useOutboxStore.test.ts"` ✅
- `npm run build` ✅

### Build: DATA_STORAGE_P2 phase-0/1 scaffolding

- 新增 `src/store/storageScope.ts`：提供 `VITE_MULTI_ACCOUNT_ISOLATION_V2` 特性开关、active scope 读写、v2 scoped key 生成与 scoped key 清理能力
- 新增 `src/store/scopedPersistMigration.ts`：提供 legacy `seeday:v1:*` -> scoped v2 的 dry-run 迁移工具（默认不写入）
- 新增 `src/store/domainPersistHydration.ts`：提供 12 个 persisted store 的批量 rehydrate orchestrator
- `src/store/persistKeys.ts` 补充 domain 枚举与 `getV1PersistKey()`，为 v2 key 迁移工具统一 domain 源
- `src/store/useAuthStore.ts` 接入 scope 设置与 DEV 结构化日志；当 `VITE_MULTI_ACCOUNT_ISOLATION_V2` 开启时，阻断 `unknown-owner + hasLocalData` 自动迁移

Validation:

- `npx tsc --noEmit` ✅
- `npm run build` ✅

### Improve: Outbox failed UI simplified to cloud-retry action

- 按 Young 对齐结果，将 outbox 失败提示实现为极简「小云朵 + 重试」按钮：不展示技术日志，不展示复杂失败清单
- 新增 `CloudRetryButton` 统一样式；主布局（非 Growth 页）与 Growth 页顶部重试入口对齐到同一视觉语言
- `useOutboxStore` 新增 `retryNow()`：手动点击后会将 `failed/cooldown` 项立即转入 pending 并触发一次 flush

Validation:

- `npx tsc --noEmit` ✅
- `npm run build` ✅

### Improve: 地区设置严格匹配 + 国家兜底

- `RegionSettingsPanel` 继续保持“仅匹配结果可保存”的严格模式：城市/地区检索命中后才会提交，不支持自由文本直存
- 当地区检索未命中时，新增国家级候选兜底提示；用户可一键确认“保存国家”，并继续写入标准化的 `country_code + latitude + longitude`
- `geocode.ts` 新增国家检索分支（优先识别国家级 feature code），降低“小地名搜不到”时的卡住率
- 补充中/英/意 i18n 文案：国家兜底提示与“保存国家”动作文案

Validation:

- `npx tsc --noEmit` ✅

## 2026-04-22

### Improve: Profile save flicker reduction

- `useAuthStore.updateLongTermProfileEnabled()` 与 `useAuthStore.updateLanguagePreference()` 改为先更新本地 UI / user metadata，再静默走后台 metadata 同步，避免 profile 区域把云端 patch 当成前台保存流程
- `src/features/profile/components/UserProfilePanel.tsx` 去掉会被瞬时 local-first 保存触发的 `Saving...` 按钮闪现
- `src/features/profile/components/RoutineSettingsPanel.tsx` 保存按钮改为稳定文案，避免关闭弹层自动保存时闪出瞬时 saving 文案

Validation:

- `npx tsc --noEmit` ✅

### Improve: Outbox cooldown to reduce autosave flicker

- `useOutboxStore` 自动重试策略从“连续失败一路打到 failed”调整为“连续失败 3 次进入 1 小时 cooldown”，冷却结束后再恢复后台重试，避免自动保存在弱网下反复闪现
- 保留总尝试上限作为最终兜底，但短期失败不再持续高频触发上传
- `useOutboxStore.test.ts` 增加 cooldown 与延时恢复重试用例

Validation:

- `npx vitest run "src/store/useOutboxStore.test.ts"` ✅
- `npx tsc --noEmit` ✅

### Improve: Annotation suggestion outcome durable fallback

- `useAnnotationStore.recordSuggestionOutcome()` 保持本地即时更新，但在“无 session”或 `annotations.update({ suggestion_accepted })` 失败时，改为将结果写入 `annotation.outcome` outbox，避免建议接受/拒绝反馈丢失
- `useOutboxStore` 新增 `annotation.outcome` executor，负责重放 `suggestion_accepted` 更新
- 新增 `useAnnotationStore.test.ts` 用例，覆盖“离线接受建议后本地态保留且入 outbox”路径

Validation:

- `npx vitest run "src/store/useAnnotationStore.test.ts" "src/store/useOutboxStore.test.ts"` ✅
- `npx tsc --noEmit` ✅

### Improve: Report 次级更新 durable fallback

- `useReportStore.updateReport()` 保持本地乐观更新，但在“无 session”或 `reports.update(...)` 失败时，改为将完整 report 写入 `report.upsert` outbox，避免标题、正文、统计、用户备注、AI 结果等次级编辑因网络抖动丢失
- 新增 `useReportStore.test.ts` 用例，覆盖“离线更新 report 后入 outbox”路径

Validation:

- `npx vitest run "src/store/useReportStore.test.ts" "src/store/useOutboxStore.test.ts"` ✅
- `npx tsc --noEmit` ✅

### Improve: Plant direction order durable local-first sync

- `usePlantStore.setDirectionOrder()` 继续保留本地即时更新与根系预览刷新，但云端写失败时不再直接把保存流程判定为失败，而是将最新方向配置写入 `plant.directionOrder` outbox 等待补推
- `useOutboxStore` 新增 `plant.directionOrder` executor，重放时按“先删旧配置，再写入完整 5 槽顺序”同步 `plant_direction_config`
- 新增 `usePlantStore.direction-sync.test.ts`，覆盖“失败入队且本地不回滚”与“成功不入队”两条关键路径

Validation:

- `npx vitest run "src/store/usePlantStore.direction-sync.test.ts" "src/store/useOutboxStore.test.ts"` ✅
- `npx tsc --noEmit` ✅

### Improve: Chat local-first syncState + outbox 闭环

- `useChatStore` 为新发 activity/mood message 增加显式 `syncState`：本地新消息先标记 `pending` 并立即渲染，首次写库成功后回写 `synced`
- `useOutboxStore` 新增 `chat.upsert`，离线或首轮写库失败时自动承接聊天消息补推；flush 成功/失败会同步回写本地消息的 `synced` / `pending` / `failed` 状态
- `fetchMessages()` 与 `_refreshDateSilently()` 改为只保留本地 `pending/failed` 且云端缺失的消息，避免把已被删除的云端消息继续误保留在本地
- 新增 `chatSyncHelpers.test.ts` 与离线发送集成用例，覆盖本地保留规则与离线发送 outbox 入队

Validation:

- `npx vitest run "src/store/chatSyncHelpers.test.ts" "src/store/useChatStore.integration.test.ts" "src/store/useOutboxStore.test.ts"` ✅
- `npx tsc --noEmit` ✅

### Docs: 存储审计报告二次复核对齐

- `docs/DATA_STORAGE_AUDIT_REPORT.md` 升级为 v1.2：按真实代码状态标注 P0/P1 已落地项，移除对 Reminder/persist key/realtime 双通道/outbox 骨架等已完成事项的“未完成”口径
- 新增“2026-04-22 二次复核结论”与当前真实状态快照，明确本轮优先继续收口 Chat / Plant / Report / Annotation 的 local-first 不丢数闭环
- 单列多账号隔离风险：指出当前仍是“全局 key + owner 标记 + 事后清理”，并将 user-scoped persist / hydrate 前校验 / 禁止 unknown-owner 自动迁移放入下一阶段主线
- `docs/CURRENT_TASK.md` 同步更新 DATA_STORAGE_P1 待办顺序：先做原计划收口项，再独立处理账号数据隔离

### Improve: 会员购买弹窗统一与人气推荐逻辑收口

- `MembershipPurchaseModal` 新增按用户会员历史动态推荐逻辑：未试用用户将“免费试用（月度）”标为人气首选；已试用未购买用户将“月度”标为人气首选；已购买历史用户将“年度”标为人气首选
- Onboarding 第 7 步移除独立订阅 UI，改为直接复用 `MembershipPurchaseModal`，并透传所选方案到 `/upgrade` 页面，确保新手导览与正式购买页使用同一套购买界面
- `/upgrade` 支持接收 `initialPlanId`，从外部入口进入时可保持用户在前置弹窗中的方案选择

Validation:

- `npx tsc --noEmit` ✅

### Improve: 根系方向设置 local-first 合并 + telemetry

- `usePlantStore.loadTodayData()` 改为 local-first 合并方向偏好：云端无数据时保留本地；云端若仅返回默认顺序且本地已有非默认顺序，则继续使用本地自定义值
- `setDirectionOrder()` 改为在本地即时更新后等待云端结果，云端写入失败时会向 UI 抛出错误，避免“看起来保存成功但下次又回默认”
- profile 侧新增根系方向设置埋点：打开、修改槽位、恢复默认、保存成功、保存失败
- Telemetry Center 新增 `Profile Settings` 管理员看板与 `/api/live-input-telemetry?module=profile_settings` 聚合查询，用于查看根系方向设置的打开率、保存成功率、常改位置与最终保存布局

Validation:

- `npx vitest run "src/features/report/plant/soilLegend.test.ts"` ✅
- `npx tsc --noEmit` ✅

### Fix: Chat 连续活动记录发送失败

- 修复 `closePreviousActivityLocal()` 返回值与局部变量错误：连续发送活动时，上一条活动现在会正确结算 `duration/isActive`，不会再在第二条活动发送时抛错
- 新增 `useChatStore.integration.test.ts` 回归用例，覆盖 `activity -> activity`（如“吃饭”后立刻“睡觉”）连续发送链路

Validation:

- `npm run test:unit -- useChatStore.integration.test.ts` ✅

### Improve: DATA_STORAGE P1 A-2/A-3 annotation persist slimming + realtime channel split

- `useAnnotationStore` 新增持久化裁剪 helper：annotation 历史仅保留最近 30 天，`characterStateTracker` 仅保留最近 7 天和未过期 effect，hydration 时同步做防御性裁剪
- `useRealtimeSync` 从单通道拆为高频/低频双通道，`messages+moods` 独立于 todo/growth/report/annotation/focus/stardust，降低单点订阅抖动对聊天实时体验的影响
- 新增 `annotationPersistenceHelpers` 单测，覆盖 annotation 裁剪、event 截断、tracker 清理

Validation:

- `npx tsc --noEmit` ✅
- `npm run test:unit -- annotationPersistenceHelpers` ✅

### Refactor: DATA_STORAGE P1 B-1 persist key 统一与旧 key 迁移

- 新增 `src/store/persistKeys.ts` 与 `src/store/persistMigrationHelpers.ts`，将 chat/todo/growth/mood/report/annotation/focus/plant/timing/stardust/reminder 统一为 `seeday:v1:<domain>` 命名
- 各 domain store hydration 时会自动读取旧 persist key 并清理遗留 key，升级后无需用户手动清缓存
- `clearLocalDomainStores()` 统一按 key 集合清空持久化状态，减少跨账号残留导致的本地缓存串号

Validation:

- `npx tsc --noEmit` ✅
- `npm run test:unit -- annotationPersistenceHelpers` ✅

### Improve: DATA_STORAGE P1 C-1 initialize 新鲜度门控

- chat/todo/growth/mood/report/annotation/focus/stardust store 新增 `lastFetchedAt`，成功拉云后记录时间戳并持久化
- `useAuthStore.initialize()` 与 `SIGNED_IN` 冷启动恢复路径按 60 秒 freshness gate 跳过热缓存重复拉取，只保留必要的本地恢复、pending push 与增量同步
- `clearLocalDomainStores()` 同步清空各域 `lastFetchedAt` 与关键缓存，避免跨账号切换时沿用旧鲜度状态

Validation:

- `npx tsc --noEmit` ✅
- `npm run build` ✅

### Improve: DATA_STORAGE P1 D-1/D-2/D-3 outbox skeleton + core store wiring

- 新增 `src/store/useOutboxStore.ts` 与单测，定义 `mood.upsert` / `focus.insert` / `report.upsert` / `annotation.insert` 四类 outbox entry，持久化到 `seeday:v1:outbox`
- `useMoodStore`、`useFocusStore`、`reportActions.ts`、`useAnnotationStore` 的核心写路径在重试耗尽后会自动 enqueue 到 outbox，保留本地乐观状态
- `useAuthStore.initialize()`、`useNetworkSync`、`useAppForegroundRefresh` 已接入 outbox flush，联网/回前台/恢复 session 后会自动补推队列

Validation:

- `npx tsc --noEmit` ✅
- `npm run test:unit -- useOutboxStore` ✅
- `npm run build` ✅

## 2026-04-21

### Refactor: DATA_STORAGE P1 A-1 Reminder store persist 化

- `useReminderStore` 从裸 localStorage 迁移为 Zustand persist，key 统一为 `seeday:v1:reminder`
- `merge` 保留跨日自动重置逻辑，并兼容迁移旧 key（`reminder_confirmed_today` / `reminder_confirmed_date`）
- `clearLocalDomainStores` 新增 reminder 清理，确保登出时该域状态同步清空

Validation:

- `npx tsc --noEmit` ✅

### Fix: Growth 待办取消完成的星星/打卡对称回滚

- `useGrowthStore` 新增扣星 action，支持取消完成时状态与打卡对称回退
- `useTodoStore` 新增奖励映射，记录每条待办实际加星值，供取消时精确回滚
- `GrowthTodoSection` / `FocusMode` / `useChatStore` 打通奖励记录与回滚链路

Validation:

- `npx tsc --noEmit` ✅
- `npm run build` ✅

### Fix: Growth 待办重复生成与删除复活（第一轮）

- `useTodoStore` 统一 recurring 日期口径为本地日历日
- 增加 `suppressedTemplateDateMap` 与 pending-delete tombstone，降低“删了又回来”
- `useRealtimeSync` 对 todos `deleted_at` 事件即时本地清理

Validation:

- `npx tsc --noEmit` ✅

### Improve: Growth iOS 手势误触与拖拽重排稳定性

- `GrowthTodoCard` 关键按钮改为 pointer-first 并吞并 click，降低 WebView ghost click 误触
- `GrowthTodoCard` 新增显式拖拽手柄（Grip）
- `GrowthTodoSection` 拖拽入口支持“手柄立即激活 + 卡片长按兜底”双模式

Validation:

- `npx tsc --noEmit` ✅
- `npm run build` ✅

### Fix: Growth 待办编辑命中错位（编辑到下一条）

- `GrowthTodoCard` 增加编辑目标 id 锁定（开始编辑时记录目标 todoId，提交时按锁定 id 更新）
- `GrowthTodoCard` 新增 `onEditingChange` 回调，编辑结束/组件卸载时统一释放编辑态
- `GrowthTodoSection` 新增 `editingTodoId` 状态，编辑进行中禁用卡片长按拖拽，减少编辑期间重排导致的目标错位

Validation:

- `npx tsc --noEmit` ✅
- `npm run build` ✅

### Fix: 全局存储审计 P0 收口

- 修复 plant timezone 异常、mood 覆盖策略、auth metadata 并发写、realtime 污染历史视图
- annotation/focus/timing 持久化与合并逻辑补齐

Validation:

- `npx tsc --noEmit` ✅

### Refactor: Chat dateCache 统一为对象并持久化

- `Map` -> `Record<string, Message[]>`，删除双副本 `persistedDateCache`
- 聊天、report、realtime 全链路统一对象访问

Validation:

- `npx tsc --noEmit` ✅
- `npm run lint:all` ✅

## 2026-04-20

### Onboarding / Report / Profile 多项稳定性与交互优化

- Onboarding：语言与文案链路修复、心情/活动回路修复、真实卡片交互接线
- Report：日期入口卡片结构与视觉多轮微调
- Profile：作息面板密度与移动端可用性优化
- Diary 书架：日期搜索与热度配色可读性优化

Validation:

- `npx tsc --noEmit` ✅

### Fix: reminder system 合约收口

- `useReminderSystem` 返回契约显式类型化，`App` 调用回到标准解构

Validation:

- `npx tsc --noEmit` ✅

## 2026-04-19

### Feat: Stripe Web Checkout 首版闭环（不影响 iOS IAP）

- `/api/subscription` 新增 `stripe_checkout/stripe_finalize` 分支
- 前端 `payment/stripe` 接入创建 checkout + 回跳 finalize
- 文档与环境变量同步（Stripe keys / price ids）

Validation:

- `npx tsc --noEmit` ✅

### Fix: 日报/日记统计口径对齐

- DiaryBookViewer 饼图优先复用报告 stats 快照
- 报告页心情分布对齐 `customMoodLabel/customMoodApplied` 口径

Validation:

- `npx tsc --noEmit` ✅

---

## Archive Policy

- 2026-04-18 及更早的已收口历史已从本文件移除。
- 如需追溯旧实现，请以 Git 历史为准（`git log -- docs/CHANGELOG.md`）。
