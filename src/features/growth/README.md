# Growth Module

## Entry

- Page entry: `src/features/growth/GrowthPage.tsx`

## Public Interface

- Route: `/growth`
- Main user flows:
  - 查看成长瓶子列表（BottleList）
  - 添加/管理成长 Todo（GrowthTodoSection）
  - 专注模式计时器（FocusMode / FocusTimer）
  - AI 匹配瓶子（BottleCard）

## Key Files

- `GrowthPage.tsx` - 页面入口
- `BottleList.tsx` - 瓶子列表展示
- `BottleCard.tsx` - 单个瓶子卡片
- `AddBottleModal.tsx` - 新增瓶子弹窗
- `GrowthTodoSection.tsx` - Todo 列表
- `GrowthTodoCard.tsx` - 单个 Todo 卡片
- `AddGrowthTodoModal.tsx` - 新增 Todo 弹窗
- `FocusMode.tsx` - 专注模式入口
- `FocusTimer.tsx` - 专注计时器
- `DailyGoalPopup.tsx` - 每日目标弹窗

## Store

Uses `src/store/useTodoStore.ts` for todo state management.
