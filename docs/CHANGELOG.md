# Changelog

All notable effective changes are documented here.

> Note: 仅保留近期变更；更早且已收口的历史记录已清理，避免维护噪音。

## 2026-04-22

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
