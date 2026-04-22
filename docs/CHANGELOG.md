# Changelog

All notable effective changes are documented here.

> Note: 仅保留近期变更；更早且已收口的历史记录已清理，避免维护噪音。

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
