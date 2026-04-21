# 本地优先存储规范（Local-First Storage Spec）

- 版本: v1.0
- 创建: 2026-04-21
- 状态: 实施中

---

## 1. 问题背景

Seeday 是 Capacitor iOS 套壳 App。用户在使用聊天/时间流（`/chat`）时频繁遇到：

- 切换历史日期时出现 loading 转圈（每次切换都重新请求云端）
- 偶发"切换日期后界面不变"（仍显示今天的数据）
- App 从后台唤醒后数据重新加载（iOS WebView 重新执行 JS）
- 发出消息后时间流没有立即更新

对比：待办/成长模块体验丝滑，因为它们使用本地持久化 + 乐观更新。

---

## 2. 现状审查（as-is）

### 各 Store 存储策略

| Store | 持久化内容 | 历史数据 | 体验 |
|-------|-----------|---------|------|
| `useChatStore` | 仅今天的 `messages` | `dateCache`（Map，不持久化） | ❌ 切日期慢 |
| `useTodoStore` | 全量 todos | N/A（无日期维度） | ✅ 丝滑 |
| `useGrowthStore` | 全量 bottles | N/A | ✅ 丝滑 |
| `useMoodStore` | 部分心情标签 | 随消息一起加载 | ⚠️ 一般 |

### 根本问题：`dateCache` 是易失的内存 Map

```typescript
// useChatStore.ts persist.partialize（原注释）
// dateCache 是 Map，不能 JSON 序列化，排除持久化
```

- `dateCache: Map<string, Message[]>` 只存在内存，App 重启/后台恢复后清空
- 切换任何历史日期 = 必须重新请求 Supabase
- iOS App 从后台恢复 = JS 重新执行 = dateCache 清空

### Bug：`checkAndRefreshForNewDay` 竞争条件

`useChatStore.fetchMessagesByDate(dateStr)` 同时更新 `currentDateStr = dateStr`（历史日期）。随后：
- 5 分钟轮询 / `visibilitychange` 触发 `checkAndRefreshForNewDay()`
- 判断 `currentDateStr !== todayStr` → 调用 `fetchMessages()`（今天）
- 今天的数据覆盖用户正在看的历史日期 → **界面闪回今天**

### Todo 丝滑的原因

1. 全量 todos 持久化到 localStorage（`growth-todo-store`）
2. 所有操作立即更新本地状态（乐观更新），不等网络
3. Supabase 同步是后台静默 fire-and-forget
4. 失败有重试队列（`pending → synced → failed`）

---

## 3. 目标架构（to-be）

### 设计原则

```
用户操作 / App 冷启动
        ↓
读取本地 dateCache（localStorage，0ms）
        ↓
立即渲染，无网络等待
        ↓（后台静默）
拉取云端数据
        ↓
合并差异，更新本地缓存
        ↓
仅在数据有变时刷新 UI
```

### 缓存策略

单一缓存对象 `dateCache: Record<string, Message[]>`，同时承担内存访问和 localStorage 持久化两个角色：

| 介质 | 生命周期 | 说明 |
|------|---------|------|
| 内存（Zustand state） | 进程内 | 运行时直接读写 |
| localStorage（Zustand persist） | 跨进程（近 30 天） | App 重启/后台恢复后直接恢复 |
| Supabase | 永久 | 权威源，后台静默同步 |

> 不再维护 Map 和普通对象两份副本。`Record<string, Message[]>` 可直接 JSON 序列化，无需转换。

### 读取优先级

```
fetchMessagesByDate(dateStr):
  1. dateCache[dateStr] 命中 → 立即渲染 + 后台静默拉云端
  2. 未命中（本地真没有）→ 显示 loading + 请求云端 → 写入 dateCache
```

### 写入策略

| 操作 | dateCache 更新 | 云端同步 |
|------|--------------|---------|
| fetchMessages（今天初始化） | ✅ | 来源 |
| fetchMessagesByDate（L3 分支） | ✅ | 来源 |
| _refreshDateSilently（后台刷新） | ✅（有差异才写） | 来源 |
| Realtime INSERT/UPDATE/DELETE | ✅ | 来源 |

### 冲突合并规则

| 情况 | 处理 |
|------|------|
| 本地有 = 云端有（id 相同，内容相同） | 保留本地，不触发 UI 变化 |
| 本地有 ≠ 云端有（id 相同，内容不同） | **云端优先**，更新本地 |
| 本地有，云端无（离线创建） | 保留本地，标记 `syncStatus: pending` 后台补推 |
| 云端有，本地无（跨设备） | 写入本地缓存 |

### 缓存大小控制

- `dateCache` 最多保留 **30 天**的日期条目
- 超出时删除最旧的日期（按日期字符串排序）
- 每条日期数据量估算：50 条消息 × ~500 bytes ≈ 25KB；30 天 ≈ 750KB，在 localStorage 5MB 限制内

---

## 4. Bug 修复：checkAndRefreshForNewDay 竞争

**问题**：`fetchMessagesByDate` 更新了 `currentDateStr` 为历史日期，导致轮询误判为"跨日了"并重置为今天。

**修复**：`fetchMessagesByDate` 只更新 `activeViewDateStr`，不更新 `currentDateStr`。`currentDateStr` 专门用于跟踪"今天"的持久化日期（由 `fetchMessages` 维护）。

**修复后逻辑**：
- `currentDateStr` = 上次 fetchMessages（今天）时的日期
- `activeViewDateStr` = 用户当前正在查看的日期（可以是任意历史日期）
- `checkAndRefreshForNewDay` 只检查 `currentDateStr !== todayStr`，且只在 `activeViewDateStr === currentDateStr`（用户在看今天）时才 reset

---

## 5. iOS App 后台恢复策略

Capacitor `appStateChange` 监听：

```typescript
App.addListener('appStateChange', ({ isActive }) => {
  if (isActive) {
    // 重连 Supabase Realtime（iOS 后台断连）
    supabase.realtime.reconnect();
    // 补拉今天数据（后台静默，不 block UI）
    void useChatStore.getState().fetchMessages();
  }
});
```

---

## 6. 实施文件清单

| 文件 | 改动内容 |
|------|---------|
| `src/store/useChatStore.types.ts` | `dateCache` 类型从 `Map<string, Message[]>` 改为 `Record<string, Message[]>`；删除 `persistedDateCache`；新增 `_refreshDateSilently` 方法签名 |
| `src/store/useChatStore.ts` | `pruneDateCache` 工具（保留近 30 天）；初始化 `dateCache: {}`；`mergePersistedChatState` 直接恢复对象；`fetchMessages` 写回 `dateCache[today]`；`fetchMessagesByDate` 本地优先 + 后台刷新；新增 `_refreshDateSilently`（字段级合并 + 保留离线写入）；`checkAndRefreshForNewDay` 竞争 bug 修复；`partialize` 直接持久化 `dateCache` |
| `src/hooks/useRealtimeSync.ts` | 消息 INSERT/UPDATE/DELETE 同步更新 `dateCache` |
| `src/features/chat/ChatPage.tsx` | 日期切换判断使用 `dateCache[dateStr]` |
| `src/features/report/reportPageHelpers.ts` | `getMessagesForReport` 参数从 `Map` 改为 `Record` |
| `src/features/report/DiaryBookViewer.tsx` | `dateCache.get()` 改为 `dateCache[]` |
| `src/store/useChatStore.persistence-order.test.ts` | 初始化 `dateCache: {}` 替换 `new Map()` |

---

## 7. 验收标准（DoD）

- [ ] App 冷启动：0ms 内渲染今天数据（来自 localStorage）
- [ ] 切换历史日期（曾经访问过）：0ms 内渲染，无 loading
- [ ] 切换从未访问过的历史日期：显示 loading，拉取后写入本地
- [ ] 发出消息：立即出现在时间流，不等网络
- [ ] App 后台恢复：不闪回今天数据（不破坏用户正在看的历史日期）
- [ ] 多设备：Realtime 数据实时写入 `dateCache`
- [ ] 30 天缓存限制：`dateCache` 不超过 30 个日期键
- [ ] tsc --noEmit 通过

---

## 8. 已知遗留问题（本次不改）

- `useMoodStore` 心情标签持久化覆盖策略（与 `dateCache` 独立）
- 离线发消息重试队列（需要独立的 outbox 机制）
- Supabase `messages` 表缺少 `(user_id, timestamp)` 联合索引（数据量大时需要）
