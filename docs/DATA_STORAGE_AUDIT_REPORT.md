# Seeday 全局数据存储审计报告

- 版本: v1.2
- 创建: 2026-04-21
- 更新: 2026-04-22（按代码现状完成二次复核，对齐已落地项与剩余风险）
- 范围: 所有 `src/store/*`、`src/hooks/*`（同步相关）、`src/api/supabase.ts`、`src/lib/dbRetry.ts`、相关 Realtime 链路
- 目标: iOS 上架前，核查"本地优先 + 数据完整性"两条主线
- 执行状态: **P0-1 ~ P0-8 已落地；P1 已完成 Reminder/persist key/freshness gate/realtime 双通道/outbox 骨架与 4 store 接入；剩余收口聚焦 Chat / Plant / Report / Annotation 的最后几条链路，以及下一阶段的多账号隔离治理**

## 决策摘要（Young 已拍板）

| 编号 | 问题 | 决策 |
|------|------|------|
| Q1 | 离线写失败是否暴露给用户？ | ✅ **要暴露**（原则同意"数据不丢 > 界面干净"）。**UI 形式待做到那一步时再单独讨论**（小红点 / 重试按钮 / 整屏提示三种方案） |
| Q2 | 所有表加软删除 | ✅ 做，可放 v1.0 之后的小版本 |
| Q3 | 拆独立 `profiles` 表 | ✅ 做，留 v1.1 |
| Q4 | `login_days` 等挪到独立表 | ✅ 跟 Q3 一起做 |
| Q5 | Annotation `todayStats.events` 上限 | ✅ 从 400 **降到 150**，**升级为 P0**（上架前做） |
| Q6 | Realtime 通道按数据域拆分 | ✅ 做，v1.0.x |
| Q7 | Plant / Annotation 大改造 | ✅ **v1.0 只修必要 Bug**，大改留 v1.1 |

## 2026-04-22 二次复核结论（本次新增）

这次按真实代码重新做了一轮全局审计，结论如下：

1. **本地优先主路径已经成立**：原报告中的多个 P0/P1 已经落地，不应继续按“未修复现状”理解。
2. **“数据不丢”主路径已明显改善但还未全域统一**：Mood / Focus / Report / Annotation 已有 outbox 或本地 pending 保护；但 Chat、Plant、部分 Report/Annotation 次级写路径仍未统一接入 durable queue。
3. **多账号隔离仍未结构性完成**：当前依赖 `clearLocalDomainStores()` 与 `seeday:local-data-owner:v1` 做补救，而不是“按账号天然隔离的本地存储”。建议先完成原计划收口，再独立处理这条主线。

### 本次复核后，对原报告结论的纠偏

- 以下问题已落地修复，不应再按“当前未完成风险”表述：
  - `usePlantStore.loadTodayData` 的 `timezone` 引用错误
  - `useMoodStore.fetchMoods` 云端整体覆盖本地
  - `useAnnotationStore.fetchAnnotations` 覆盖本地未同步项
  - `user_metadata` 并发写覆盖竞争
  - Realtime `messages` 污染历史日期当前视图
  - Focus `currentSession` 未持久化
  - `useTimingStore` 完全不持久化
  - Reminder 裸 `localStorage`
  - persist key 命名不统一
  - Realtime 单通道 8 表
- 原报告里“withDbRetry 失败后 Mood / Focus / Report / Annotation 主写路径会直接丢”的描述，现阶段只对**尚未接入 outbox 的剩余次级写路径**成立，不能再笼统视为全域现状。
- 本次复核新增的最高优先级事实：**persist 仍是设备级全局 key，不是 user-scoped key；owner 标记丢失时仍存在错误账号迁移风险。**

### 当前真实状态快照（以此覆盖 Part 1 中已过时条目）

#### A. 已落地项

| 项 | 当前状态 | 代码锚点 |
|------|------|------|
| Mood fetch 合并保护 | ✅ 已完成 | `src/store/useMoodStore.ts` |
| Annotation fetch 保留本地 pending | ✅ 已完成 | `src/store/useAnnotationStore.ts` |
| metadata 写入串行化 | ✅ 已完成 | `src/store/authMetadataQueue.ts` |
| Realtime messages 仅更新当前视图日 | ✅ 已完成 | `src/hooks/useRealtimeSync.ts` |
| Focus `currentSession/queue` persist + 恢复 | ✅ 已完成 | `src/store/useFocusStore.ts` |
| Timing persist | ✅ 已完成 | `src/store/useTimingStore.ts` |
| Reminder persist | ✅ 已完成 | `src/store/useReminderStore.ts` |
| persist key 统一 | ✅ 已完成 | `src/store/persistKeys.ts` |
| initialize freshness gate（60s） | ✅ 已完成 | `src/store/useAuthStore.ts` |
| Realtime 高频/低频双通道 | ✅ 已完成 | `src/hooks/useRealtimeSync.ts` |
| Outbox 骨架 + 4 store 接入 | ✅ 已完成 | `src/store/useOutboxStore.ts` |

#### B. 仍需收口的 local-first / 不丢数闭环

| 编号 | 项 | 当前状态 | 说明 |
|------|------|------|------|
| C-1 | Chat `syncState` + outbox 联动 | ✅ 已完成 | 新发 chat message 已显式标记 `pending/synced/failed`，并由 `chat.upsert` outbox 承接失败补推 |
| C-2 | Plant 写路径 durable 化 | ✅ 已完成 | `setDirectionOrder()` 保留本地即时更新，失败时改入 `plant.directionOrder` outbox 等待补推 |
| C-3 | Report 次级更新写路径并入 outbox | ✅ 已完成 | `updateReport()` 无 session 或直写失败时改入 `report.upsert` outbox |
| C-4 | Annotation `suggestion_accepted` 写路径 durable 化 | ❌ 未完成 | 当前为直接 update，失败只打印日志 |
| C-5 | Outbox failed UI | ❌ 未完成 | 骨架和 failed 状态已在，用户可见层仍未设计落地 |

#### C. 新确认的多账号隔离风险（建议下一主线独立处理）

| 编号 | 风险 | 当前状态 | 影响 |
|------|------|------|------|
| A-1 | persist key 非 user-scoped | ⚠️ 存在 | 同设备不同账号共享同一批本地 key，靠登出/切号时清理补救 |
| A-2 | hydrate 后才做 owner 校验 | ⚠️ 存在 | 启动瞬间可能短暂读到上一个账号的本地数据 |
| A-3 | `owner.type === 'unknown' && hasLocalData` 可迁移到新账号 | ⚠️ 存在 | owner 标记丢失/损坏时，旧本地数据可能被上传到新账号云端 |
| A-4 | 非 domain local key 未统一纳管 | ⚠️ 存在 | 如 `i18nextLng` 会跨账号沿用；其他 local key 也未统一纳入隔离策略 |

### 本次复核建议的阶段划分

- **阶段 1（先收口原计划）**：继续完成原文档里剩余的 local-first / 不丢数 / 合并闭环项，不先动多账号隔离大改。
- **阶段 2（下一主线）**：把本地缓存从“全局 key + 事后清理”升级为“按 userId 分桶 + hydrate 前校验”，再处理历史污染与迁移策略。

---

## Part 1 — 现状清单（as-is）

### 1.1 存储介质总览

| 介质 | 用途 | 容量/寿命 |
|------|------|----------|
| Zustand in-memory state | 进程内读写 | 进程寿命 |
| Zustand `persist` (localStorage) | 跨进程缓存 | 浏览器/WebView 5MB 上限 |
| `localStorage` 直连 | 少量简单 flag | 同上 |
| Supabase `public.*` 表 | 权威源 | 永久 |
| Supabase Auth `user_metadata` | "设置型"数据 | 永久，无独立表 |

### 1.2 Store 现状矩阵

| Store | persist | 权威表 | 软删除 | sync 标记 | 冷启动立即可用 | Realtime 订阅 |
|-------|---------|--------|--------|-----------|----------------|---------------|
| useChatStore | ✅ `messages` + `dateCache`(30d) + 若干元数据 | `messages` | ❌ 硬删 | ❌ | ✅ | ✅ |
| useTodoStore | ✅ 全量 todos | `todos` | ✅ `deleted_at` | ✅ `syncState` | ✅ | ✅ |
| useGrowthStore | ✅ 全量 bottles + 打卡 | `bottles` | ✅ `deleted_at` / `irrigated` | ✅ `syncState` | ✅ | ✅ |
| useStardustStore | ✅ `memories` | `stardust_memories` | ❌ | ✅ `syncStatus` | ✅ | ✅ |
| useMoodStore | ✅ `activityMood` 等 Map | `moods` | ❌ | ❌ | ✅ | ✅ |
| useReportStore | ✅ `reports` + `computedHistory` | `reports` | ❌ | ❌（有 bgSync） | ✅ | ✅ |
| useAnnotationStore | ✅ 大量字段（annotations / todayStats / context / 配额 / character tracker 等） | `annotations` + 部分 `user_metadata` | ❌ | ⚠️ 部分字段有 `syncLocalAnnotations` | ✅ | ✅ |
| useFocusStore | ✅ `sessions`（current/queue **不持久化**） | `focus_sessions` | ❌ | ❌（withDbRetry） | ✅ sessions，❌ 正在进行的会话 | ✅ |
| usePlantStore | ✅ `todayPlant` / `directionOrder` / `lastAutoBackfillAttemptDate` | `daily_plant_records` / `plant_direction_config` | ❌ | ❌ | ✅ 静态部分，❌ 今日最新段 | ❌（靠 `fetchMessages` 再推 refresh） |
| useTimingStore | ❌ **完全不持久化** | `timing_sessions` | ❌ | ❌ | ❌ | ❌ |
| useReminderStore | ❌（用裸 `localStorage.getItem` 手写） | 无（纯本地） | — | — | ✅ | — |
| useAuthStore | ❌（Supabase 自己管 session） | `auth.users.user_metadata` | — | ⚠️ `queuePreferenceSnapshot` 延时写 | 由 Supabase 恢复 session | — |

### 1.3 "设置型"数据的存储方式

全部塞在 `auth.user_metadata` 一个 JSON 对象里，没有专门的 `profiles` 表：

| 字段 | 写入入口 |
|------|--------|
| `i18nextLng` | `updateLanguagePreference` |
| `avatar_url` | `updateAvatar` |
| `country_code` / `lat` / `lng` | `updateLocationMetadata` |
| `login_days`（最近 90 天数组） | `ensureTodayLoginDay` |
| `daily_goal` | `updateDailyGoal` |
| `long_term_profile_enabled` | `updateLongTermProfileEnabled` |
| `preferences`（多字段） | `queuePreferenceSnapshot`（防抖） |
| `[USER_PROFILE_METADATA_KEY]`（Profile V2 大对象） | `updateUserProfile`（读-改-写 + localStorage 兜底） |
| `membership` 相关 | 服务端写为主 |
| `lateral_association_state_v1` | 标注系统写入 |
| `trial_started_at` | 服务端 |

所有字段 **共享同一 JSON blob**，任何 `updateX` 都是 `read → merge → write`。

### 1.4 同步入口盘点

| 入口 | 触发 | 动作 |
|------|------|------|
| `useAuthStore.initialize()` | App 启动 / onAuthStateChange | `Promise.all` 并行拉 7 个 domain store（chat/todo/growth/stardust/annotation/focus/report）|
| `useRealtimeSync` | 登录后常驻 | 单通道订阅 8 表的 `postgres_changes` |
| `useAppForegroundRefresh` | iOS/Android 回前台 | 只拉 `fetchMessages` / `fetchMoods` / `fetchReports` |
| `useNetworkSync` | `window.online` 事件 | 回拉 chat/todo/growth/stardust |
| `useMidnightAutoGenerate` | 本地过零点 | 触发日报等 |
| `checkAndRefreshForNewDay` | chat 5 分钟轮询 + `visibilitychange` | 跨日时 reset 到今天 |
| `useTodoStore.fetchTodos` 内部 | 首拉前 | 先 push pending/failed，再拉云 |
| `syncPendingStardusts` | 登录后、回线时 | push pending |
| `queuePreferenceSnapshot` | `updatePreferences` | 防抖后 merge + write `user_metadata` |

### 1.5 写入策略矩阵

| Store | 本地写 | 云端写 | 失败处理 |
|-------|--------|--------|---------|
| Chat | set state + dateCache | `persistMessageToSupabase`(upsert) | 抛错直接 throw，无 outbox |
| Todo | set state + `syncState=pending` | `bgSyncInsert/Update/Delete` | 失败→`failed`，下次 `fetchTodos` 重推 |
| Growth | set state + `syncState=pending` | `withDbRetry` + 列缺失 fallback | 失败→`failed`，下次重推 |
| Stardust | set state + `syncStatus=pending_sync` | `syncPendingStardusts` | 本地保留，下次重推 |
| Mood | set state（Map 级） | `persistMoodRow`(upsert) 走 `withDbRetry` | withDbRetry 重试 3 次后吞掉 ❌ 无持久 outbox |
| Focus | set state | `withDbRetry` | 同上，无 outbox |
| Report | 乐观 set state | `bgSyncReport` | withDbRetry 吞掉 |
| Annotation | set state | `insertAnnotation` / `upsertCharacterState` 等 | 部分走本地队列 `syncLocalAnnotations`，部分吞掉 |
| Plant | set state | `callPlantGenerateAPI` | try/catch 只 DEV 打印 |
| Timing | 无本地写（全依赖服务） | 直接服务调用 | 无 |
| Auth (`user_metadata`) | `supabase.auth.updateUser` 或服务端路由 | 直接写 | `updateUserProfile` 有 localStorage 兜底；其余字段失败即丢 |

### 1.6 Realtime 通道

`useRealtimeSync` 订阅 8 表 × 3 事件（messages/todos/moods/bottles/reports/annotations/focus_sessions/stardust_memories），单通道 `user-sync-${userId}`。消息 INSERT 时：

- 同时写入 `state.messages`（当前视图日）与 `state.dateCache[dateStr]`（按日期归档）

### 1.7 localStorage 体积估算（满载）

- chat `dateCache` 30 天 × 50 条 × ~500B ≈ **750KB**
- annotation（annotations + todayStats.events(400) + context + tracker）≈ **300–800KB**
- todos / bottles / stardust / reports / moods 合计 ≈ **300–500KB**
- 合计估 **1.5–2.2MB**，WebView 5MB 上限下有冗余但不宽裕

---

## Part 2 — 问题与不一致

按严重程度分级：**P0** = 影响数据正确性 / 用户信任；**P1** = 显著影响体验；**P2** = 长期维护债。

### P0-1 `usePlantStore.loadTodayData` 存在 `ReferenceError`

`src/store/usePlantStore.ts:168` 只解构 `{ date }`，但 `:226` 处引用了 `timezone`。在 JS 严格模式下一旦进入 auto-backfill 分支（`lastAutoBackfillAttemptDate !== date` 且云端无昨天记录）会直接抛 `ReferenceError`。

- **影响**：每个用户每天第一次冷启动时，如果昨天没有植物记录，植物模块初始化抛错。UI 表现：根系空白或 loading 状态卡住。
- **验证**：`getTodayDateAndRange` 返回 `{ date, timezone, dayStartMs, dayEndMs }`，而消费方只解构了 `date`。

### P0-2 `useMoodStore.fetchMoods` 整体覆盖本地，丢失在途写入

`fetchMoods` 每次用云端结果 **重建** `activityMood / customMoodLabel / moodNote` 等 Map。若此时本地有：

- 乐观写过、但 `persistMoodRow` 还在重试途中的条目
- 刚被 `autoDetectMood` 打上的自动 mood，还没 upsert 上去

都会被云端覆盖消失。**`useAppForegroundRefresh` 每次回前台都调一次 `fetchMoods`**，所以这条路径被频繁触发。

### P0-3 `user_metadata` 并发读-改-写无乐观锁

`updateLanguagePreference / updateAvatar / updateDailyGoal / updateUserProfile / ensureTodayLoginDay / queuePreferenceSnapshot` 全部遵循：

```
const { data } = await supabase.auth.getUser();
const baseMeta = data.user?.user_metadata ?? {};
await supabase.auth.updateUser({ data: { ...baseMeta, [k]: v } });
```

当以下场景同时发生（App 冷启动很常见）：

- i18n 初始化写 `i18nextLng`
- `ensureTodayLoginDay` 追加今日
- `queuePreferenceSnapshot` 防抖触发
- Profile V2 写入

最后一个写入胜出，中间的字段可能被回滚到读取时的旧值。**现象**：语言切换偶发回退、登录天数偶发少一天、偏好配置偶发丢失。

### P0-4 Realtime `messages` INSERT 污染当前视图

`useRealtimeSync` 收到 INSERT 时无条件 `messages: [...state.messages, msg]`，但 `state.messages` 代表"当前用户正在看的日期"。若：

- 用户正在查看历史日期（`activeViewDateStr ≠ currentDateStr`）
- 另一设备此刻往今天写了一条

→ 今天的这条消息会被追加到用户正在看的历史时间流里，按时间戳排序后可能插进奇怪的位置。UPDATE 路径也有同样问题。

**判断条件缺失**：应该只在 `getLocalDateString(new Date(msg.timestamp)) === state.activeViewDateStr` 时才动 `state.messages`。`dateCache` 部分是对的。

### P0-5 `useAnnotationStore.fetchAnnotations` 覆盖本地未同步项

`fetchAnnotations` 直接用云端结果替换 `annotations: [...]`。登录后的 SIGNED_IN 路径会先跑 `syncLocalAnnotations` 保护本地，但：

- `useAuthStore.initialize()` 初始化路径（冷启动 session 恢复）**没有**这层保护
- iOS 后台恢复、`useNetworkSync` 未覆盖 annotation

→ 断网期间生成的 annotation 尚未上传时，若先触发 fetch，会被擦除。

### P0-6 Focus `currentSession` 非持久化

`useFocusStore` 的 `currentSession` 和 `queue` 故意不在 `partialize` 里。iOS 后台被 kill 或 WebView 刷新 → 正在进行的专注会话消失，但云端可能已经有 `started_at` 的记录，会变成"孤儿会话"无法 `endSession`。

### P0-7 `useTimingStore` 冷启动空白

`useTimingStore` 完全不持久化。每次冷启动/前台恢复，今日计时数据要等 `loadTodaySessions` 网络请求完成。**违反了本次本地优先的总目标**，且网络差时体验和 chat 以前切日期一样差。

### P1-1 `withDbRetry` 仅重试 2 次就静默吞错（范围已缩小）

`src/lib/dbRetry.ts`：延迟 `[1000, 3000]`，最多 3 次尝试，失败后 `console.error` 然后返回。没有写入任何 outbox、没有标记 `failed`、没有触发全局错误通知。

- 该问题在 **Mood / Focus / Report 主 upsert / Annotation 主 insert** 路径上已被 outbox 明显缓解。
- 但 **Chat / Plant / Report 次级更新 / Annotation suggestion outcome** 等残余写路径仍未统一接入 durable queue，因此“静默吞错导致最终丢数”的风险依然存在，只是不再是全域现状。

### P1-2 `useAuthStore.initialize` 全量并行拉云，忽略本地缓存新鲜度

`initialize()` 每次登录/恢复 session 都 `Promise.all` 拉 7 个 store，完全不看本地 persist 的时间戳。即使本地 30 秒前刚拉过，也会再拉一次。

- iOS 冷启动体感：本地 0ms 渲染 → 300–1500ms 后网络返回，触发大量 re-render
- 会放大 P0-2、P0-5 这类"覆盖本地"Bug 的触发概率

### P1-3 Reminder 用裸 localStorage，不统一（已完成，保留为历史问题）

`useReminderStore` 用 `localStorage.getItem('reminder_confirmed_today')` + `'reminder_confirmed_date'` 手写分片，和其它 10 个 store 的 `persist` 中间件范式不一致。

- 后续做"登出清空本地"（`clearLocalDomainStores`）时极易漏掉
- key 命名没有命名空间（应和其它 store 一样 `growth-todo-store` 这样前缀）

### P1-4 持久化键命名不统一（已完成，保留为历史问题）

- `growth-todo-store`、`growth-bottle-store`：有前缀
- `chat-storage`、`report-storage`、`stardust-storage`、`annotation-storage`：有 `-storage` 后缀
- `useMoodStore` / `useFocusStore` / `usePlantStore`：看起来用的是默认名（`name` 未声明或差异）
- Reminder：`reminder_confirmed_*` 裸 key

这给"整体清空""版本迁移""调试"都埋坑。

### P1-5 dateCache 合并保留离线条目的"认定规则"脆弱

`_refreshDateSilently` 判断"本地有云端无"为"离线创建"保留。但如果消息被另一设备真的**硬删除**了，本地也会当成离线条目保留 → 复活已删除消息。需要结合 syncState 或软删除表才能安全区分。

### ~~P1-6~~ → **P0-8** annotation 持久化体积过大（已升级）

> **决策（Q5）**：`todayStats.events` 上限从 400 **降到 150**，升级为 P0。其余裁剪项（30 天 prune、`characterStateTracker` 窗口）维持 P1。

`useAnnotationStore` 在 `partialize` 里持久化的字段包含：

- `annotations`（全量）
- `todayStats.events`（上限 400 条 → **上架前改 150**）
- `todayContext`、`characterStateTracker`、`currentAnnotation`
- 多个配额计数

数据量大时单次 localStorage 写入可达几十 KB，iOS WebView 对持久化阻塞敏感；且没有类似 chat 的"30 天 prune"。

### P2-1 `dateCache` 与 `messages` 双份内存副本

迁移后 `dateCache[todayStr]` 基本是 `state.messages` 的副本。每次 setState 两边都要更新，容易漏（目前已见 realtime INSERT 两边都更新是对的，但任何新入口只改一侧就会产生不一致）。

### P2-2 软删除策略不统一

Todo / Growth 用 `deleted_at` 软删；Chat / Mood / Stardust / Report / Annotation 全是硬删。后果：

- 多设备场景一侧删除，另一侧 `fetchX` 时因为"本地有云端无"被当成离线创建保留 → 被删除的数据复活
- Realtime DELETE 丢包时无从检测

### P2-3 `deleted_at` 只在部分查询里过滤

`fetchTodos / fetchBottles` 加了 `.is('deleted_at', null)`，但 Realtime 订阅不会自动过滤 — 依赖应用层每次收到 UPDATE 再判断。

### P2-4 `user_metadata` 作为"设置表"混杂增长型数据

`login_days` 是数组（最近 90 天），每次登录都要重写整份 `user_metadata`。数据量虽小，但：

- 每次读-改-写都把整份 JSON 发回服务端
- Supabase 没有 `user_metadata` 的行级原子 patch
- 扩展性差：后续若要加"最近 30 天活跃时段"这类聚合，会把 blob 越养越大

### P2-5 Chat 离线发送不是真正"离线可用"

`sendMessage` 本地 set state 后 `persistMessageToSupabase` 抛错就 throw。消息本身在 UI 上是留着的，但没有 `syncState`，没法判断"这条到底发出去没"，下次 `fetchMessages` 时由 `_refreshDateSilently` 保留本地 → 实际上是"隐式 pending"，但没人知道它 pending，也没人重推。

### P2-6 `useRealtimeSync` 单通道 8 表，失败恢复粗（已完成高频/低频拆分，保留为历史问题）

订阅全堆在一个 channel 上。任一表订阅失败会拖累全局。iOS 后台恢复时应 `supabase.realtime.reconnect()`，但代码里没有，是靠 `useAppForegroundRefresh` 用 HTTP 重拉来兜底（所以才导致 P0-2 高频触发）。

### P2-7 `useAuthStore.updateUserProfile` localStorage fallback 只管 Profile V2

`updateUserProfile` 失败时会把 Profile V2 blob 写进 `localStorage` 做 pending；但 `updateLanguagePreference`、`updateDailyGoal`、`updateAvatar` 都没有这层 fallback。一致性差。

### P0-9 多账号隔离仍依赖“全局 key + owner 标记 + 事后清理”

这是本次二次复核新增、且优先级应高于大多数 P1/P2 的问题。

- 所有 domain persist key 仍是设备级全局 key（如 `seeday:v1:chat`、`seeday:v1:outbox`），不是按 `userId` 分桶。
- `initialize()` / `SIGNED_IN` 路径是先让 store hydrate 并设置当前用户，再根据 owner 判断是否清空本地，因此存在“短暂串号窗口”。
- 当 `seeday:local-data-owner:v1` 缺失或损坏时，`owner.type === 'unknown' && hasLocalData` 会被当成“可迁移旧本地数据”，随后 `syncLocalDataToSupabase()` 会把本地 messages/moods/todos/bottles/focus/reports 上传给当前登录账号。

> 结论：当前版本对“同设备双账号不污染”还不能下最终通过结论；它是已降风险但未结构性闭环。

### P1-8 非 domain 本地 key 未统一纳管

除了 Zustand persist 外，仍存在数类 `localStorage` key：

- `i18nextLng`
- `seeday_pending_profile_v2_<userId>`
- `growth:first-login-date:<userId>`
- `streakDate_<userId>` / `streakValue_<userId>`
- `seeday:local-data-owner:v1`

其中一部分按 `userId` 隔离，一部分是全局 key；且并不都归入 `clearLocalDomainStores()`。这会让“登出清理”“切号隔离”“迁移策略”难以形成单一真相源。

### 维度整理（你问的"是否应该统一"）

| 维度 | 现状 | 建议 |
|------|------|------|
| persist 中间件 | 9 用 ✅，Reminder 裸 localStorage ❌，Timing 不持久化 | **统一用 persist**；Timing 必须加持久化 |
| syncState 标记 | Todo/Growth/Stardust ✅，Chat/Mood/Focus/Report/Annotation/Plant ❌ | **统一加 `syncState` 字段** — 这是离线队列的前提 |
| 软删除 | Todo/Growth ✅，其余 ❌ | **统一软删**（或 Chat/Mood/Report/Stardust 至少加 tombstone 表） |
| Fetch 合并策略 | Chat/Report/Focus/Stardust 做了合并，Mood/Annotation 直接覆盖 | **统一"push pending → pull cloud → 合并"** |
| localStorage key 命名 | 混乱 | **统一前缀 `seeday:<domain>:`** + 版本号 |
| 设置型数据位置 | 全进 `user_metadata` | **拆出 profile 表**（见 Part 3） |

---

## Part 3 — 建议

### 3.1 必须做（P0，iOS 上架前 — 共 8 项）

**① 修 `usePlantStore` 的 `ReferenceError`**（P0-1）

`src/store/usePlantStore.ts:168` 改为 `const { date, timezone } = getTodayDateAndRange();`。一行修复，影响面极小但阻断功能。

**② Mood / Annotation 的 fetch 改成合并而非覆盖**（P0-2、P0-5）

参考 `useChatStore._refreshDateSilently` 模式：

```ts
// useMoodStore.fetchMoods
const cloud = await supabase.from('moods').select('*').eq('user_id', uid);
const localOnly = Object.keys(state.activityMood).filter(mid => !cloud.some(r => r.message_id === mid));
// merge: cloud 覆盖同 id，local-only 保留
```

在加 `syncState` 前，至少用"message_id 不在云端结果里 → 本地保留"做最小保护。

**③ `user_metadata` 写入串行化 + 字段级 patch**（P0-3）

建议新增 `src/store/authMetadataQueue.ts`：

```ts
let chain = Promise.resolve();
export function patchUserMetadata(patch: Record<string, unknown>) {
  chain = chain.then(async () => {
    const { data } = await supabase.auth.getUser();
    const merged = { ...(data.user?.user_metadata ?? {}), ...patch };
    await supabase.auth.updateUser({ data: merged });
  });
  return chain;
}
```

让所有 `updateX` 走它。一行实现 Mutex 效果，彻底消灭 P0-3。**不需要**上乐观锁或 CAS。

**④ Realtime messages INSERT/UPDATE 加日期判断**（P0-4）

```ts
const shouldTouchMessages = dateStr === state.activeViewDateStr;
return {
  messages: shouldTouchMessages ? [...state.messages, msg] : state.messages,
  dateCache: { ...state.dateCache, [dateStr]: updatedForDate },
};
```

**⑤ Focus `currentSession` 持久化**（P0-6）

加入 `partialize` 的白名单，并在冷启动时校验 `endedAt === undefined && startedAt + 24h > now`，否则认为是孤儿，补写 `ended_at = started_at + set_duration` 结束掉。

**⑥ `useTimingStore` 加 persist**（P0-7）

即使只是 `todaySessions` 最近 1 天，也能避免冷启动空白。和 Chat 一样用日期 key 缓存。

**⑦ Annotation `todayStats.events` 降到 150**（P0-8）

只改 `useAnnotationStore` 里一个常量：`MAX_TODAY_EVENTS = 400 → 150`。改完后老数据在下次 persist 写入时自动截断，无需迁移脚本。

> **⚠️ 验收**：在一台用了 App 一段时间的设备上打开，检查 localStorage 里 annotation 键的体积是否下降；并确认"今日回顾 / 今日上下文"等依赖 events 的 UI 没有因截断出现空白。

### 3.2 强烈建议（P1，上架后紧接着做）

**⑧ 引入全局 Outbox + UI 暴露失败**（对应 Q1 决策）

新建 `src/store/useOutboxStore.ts`，成为"write-behind"队列：

```ts
type OutboxEntry<T = unknown> =
  | { kind: 'mood.upsert'; payload: T; attempts: number; lastError?: string }
  | { kind: 'focus.end'; payload: T; attempts: number }
  | { kind: 'report.update'; payload: T; attempts: number }
  | …
```

- 所有走 `withDbRetry` 但没有 syncState 的 store 改成"先进 outbox"
- outbox 持久化到 localStorage
- `online`、`appStateChange`、登录时 flush
- 超过 5 次失败标记 `failed` → **暴露给用户**

> **🟡 待讨论（Young 要求）**：Q1 原则已定（失败要暴露），但 **UI 呈现方式另行讨论**：
> - 方案 A：消息/记录条目旁加"同步失败"小红点（类似微信气泡），点击重试。轻量但每条都标。
> - 方案 B：页面顶部出现全局横幅 / 整屏重试按钮。直接但可能遮挡内容。
> - 方案 C：右下角小悬浮 badge（"3 条未同步"），点开看清单。折中。
>
> Young 的意见："UI 显示同步失败太丑了，等做到这一步再详细讨论"。
> **Action**：等 outbox 骨架写完、到接 UI 这一步时，必须先找 Young 对齐视觉，再写组件。**不要擅自选方案**。

这样 P1-1、P2-5 一起解掉，而且给 Mood / Focus / Report / Plant / Annotation 一个统一的离线兜底。

**⑨ `useAuthStore.initialize` 引入"本地新鲜度"门控**

在 `persist` 里多存一个 `lastFetchedAt` per-store，initialize 时：

- `lastFetchedAt < 60s ago` → 不重拉（Realtime 本来就会带增量）
- 否则才 `Promise.all` 拉

减少 P1-2 带来的覆盖风险 + 启动流量。

**⑩ 持久化 key 统一命名**

新增 `src/store/persistKeys.ts`：

```ts
export const PERSIST_KEYS = {
  chat: 'seeday:v1:chat',
  todo: 'seeday:v1:todo',
  growth: 'seeday:v1:growth',
  stardust: 'seeday:v1:stardust',
  mood: 'seeday:v1:mood',
  report: 'seeday:v1:report',
  annotation: 'seeday:v1:annotation',
  focus: 'seeday:v1:focus',
  plant: 'seeday:v1:plant',
  timing: 'seeday:v1:timing',
  reminder: 'seeday:v1:reminder',
} as const;
```

旧 key 写一次性 migrate。以后调试 / 清空 / bump 版本都可控。顺便把 Reminder 迁成 persist 中间件。

**⑪ Annotation persist 进一步裁剪**（P0-8 已处理 events 上限 150；剩余为 P1）

- `annotations` 参考 chat 做 30 天上限
- `characterStateTracker` 只保留最近 7 天窗口
- `todayStats.events` 跨日自动归零（当前是靠日期键判断，可以更激进）

### 3.3 中长期（P2，架构性改动）

**⑫ 引入 `profiles` 表，拆出增长型数据**（Q3 + Q4 合并）

`user_metadata` 只保留真正的"设置"（language / avatar / country / preferences），增长型的 `login_days`、`long_term_profile` 大对象、`lateral_association_state_v1` 全部挪到独立表：

```sql
create table profiles (
  user_id uuid primary key references auth.users,
  login_days date[] default '{}',
  daily_goal int,
  profile_v2 jsonb,
  association_state jsonb,
  updated_at timestamptz default now()
);
```

好处：

- 每个字段独立 UPDATE，天然无并发冲突
- 可以加索引、做分析
- 不再每次写回整个 JSON blob
- `user_metadata` 体积收敛

**⑬ 所有 domain 表统一加软删除**（Q2）

Chat / Mood / Report / Stardust / Annotation 全加 `deleted_at` 列；Realtime 保持收所有事件，应用层按 `deleted_at` 过滤。这样能彻底解决 P1-5「被删数据复活」。

**⑭ 把 `dateCache` 作为 chat 的唯一 in-memory 真相，`state.messages` 降级为 derived**

当前 `messages` 和 `dateCache[activeViewDateStr]` 双份，长期一定会漂。改成：

```ts
get messages() {
  return this.dateCache[this.activeViewDateStr] ?? [];
}
```

或用 selector。彻底消灭 P2-1。

**⑮ Realtime 重连策略对齐 iOS 生命周期 + 按数据域拆分通道**（Q6）

通道按"高频 / 低频"拆成两条：
- 高频：`messages / moods`
- 低频：`todos / bottles / reports / annotations / focus_sessions / stardust_memories`

两条通道独立订阅、独立失败重连，互不拖累。

`useAppForegroundRefresh` 里加 `supabase.realtime.reconnect()`；`offline`→`online` 时也触发一次；这样就不需要每次回前台用 HTTP 大批量重拉来兜底，P0-2/P0-5 的触发面进一步缩小。

**⑯ Build a small test harness for offline behavior**

整理一组场景，写 Playwright + 网络节流脚本：

1. 离线发 5 条消息 → 上线 → 全部进云 + 无重复
2. 断网状态下切换心情 → 上线 → 心情不丢
3. A 设备删除一条消息 → B 设备 Realtime 接收 → 切回历史日不出现
4. 跨日期轮询时用户在看历史 → 不闪回今天
5. iOS 后台 15 分钟后回前台 → 本地立即展示，云端数据静默 merge

上架前至少跑前 4 个。

### 3.4 开放问题（已决策 / 待二次讨论）

| 编号 | 问题 | 状态 | 决策 |
|------|------|------|------|
| Q1 | Outbox 的 UI 可见度 | 🟡 **原则已定，UI 方案待议** | 原则：失败必须暴露。UI 具体是"小红点 / 重试按钮 / 悬浮 badge"待做到 Outbox 接 UI 这一步时单独讨论，**禁止擅自定方案** |
| Q2 | 所有表加 `deleted_at` 软删除 | ✅ 已定 | v1.0 之后的小版本做 |
| Q3 | 拆 `profiles` 表 | ✅ 已定 | 留 v1.1 |
| Q4 | `login_days` 等挪到独立表 | ✅ 已定 | 跟 Q3 一起做 |
| Q5 | Annotation `todayStats.events` 上限 | ✅ 已定 | **降到 150，升级 P0**（本次上架前做，已进 P0-8） |
| Q6 | Realtime 通道按数据域拆分 | ✅ 已定 | v1.0.x |
| Q7 | Plant & Annotation 大改造（引入 outbox + syncState） | ✅ 已定 | v1.0 只修必要 Bug，大改留 v1.1 |

---

## 附录 A — 文件索引（审计路径）

Chat: `src/store/useChatStore.ts`, `useChatStore.types.ts`, `chatActions.ts`, `chatTimelineActions.ts`, `chatDayBoundary.ts`, `chatHelpers.ts`, `chatStoreLegacy.ts`
Todo: `src/store/useTodoStore.ts`
Growth: `src/store/useGrowthStore.ts`
Mood: `src/store/useMoodStore.ts`
Focus: `src/store/useFocusStore.ts`
Report: `src/store/useReportStore.ts`
Stardust: `src/store/useStardustStore.ts`
Annotation: `src/store/useAnnotationStore.ts`
Plant: `src/store/usePlantStore.ts`
Timing: `src/store/useTimingStore.ts`
Reminder: `src/store/useReminderStore.ts`
Auth: `src/store/useAuthStore.ts` + `authDataSyncHelpers.ts` / `authPreferenceHelpers.ts` / `authProfileHelpers.ts` / `authLanguageHelpers.ts`
Sync hooks: `src/hooks/useRealtimeSync.ts`, `useAppForegroundRefresh.ts`, `useNetworkSync.ts`, `useMidnightAutoGenerate.ts`, `useNightReminder.ts`
DB 层: `src/api/supabase.ts`, `src/lib/dbRetry.ts`, `src/lib/dbMappers.ts`, `src/lib/supabase-utils.ts`
既有规格: `docs/LOCAL_FIRST_STORAGE_SPEC.md`

## 附录 B — 优先级一览（已根据决策更新）

### P0（上架前必须做）

| 编号 | 项 | 改动量 | 对应决策 |
|------|----|--------|---------|
| P0-1 | Plant `timezone` ReferenceError | 1 行 | — |
| P0-2 | Mood `fetchMoods` 改合并 | 小 | — |
| P0-3 | `user_metadata` 写入串行化（队列） | 小 | — |
| P0-4 | Realtime messages 加日期判断 | 小 | — |
| P0-5 | Annotation `fetchAnnotations` 改合并 | 小 | — |
| P0-6 | Focus `currentSession` 持久化 + 孤儿清理 | 中 | — |
| P0-7 | Timing 加 persist | 小 | — |
| P0-8 | **Annotation `todayStats.events` 上限 400 → 150** | 1 行 | **Q5** |

> 执行回填（2026-04-21）：以上 P0-1 ~ P0-8 已全部完成，详见 `docs/CURRENT_TASK.md`（主线 0.1）与 `docs/CHANGELOG.md` 同日条目。

### P1（当前建议先做的收口项）

| 编号 | 项 | 改动量 | 对应决策 |
|------|----|--------|---------|
| P1-1 | Chat `syncState` + outbox 联动 | 已完成 | 2026-04-22 已落地 |
| P1-1' | **Outbox 失败 UI** | 小（但要先对齐视觉） | **Q1 UI 待议** |
| P1-2 | Plant 写路径 durable 化 | 已完成 | 2026-04-22 已落地 |
| P1-3 | Report 次级更新写路径并入 outbox | 已完成 | 2026-04-22 已落地 |
| P1-4 | Annotation `suggestion_accepted` durable 化 | 小 | 补齐 local-first 不丢数 |
| P1-5 | Chat dateCache 合并与删除语义继续配合 `syncState` 收口 | 中 | 配合 P1-1 |

### P2（下一主线：多账号隔离与结构治理）

| 编号 | 项 | 改动量 | 对应决策 |
|------|----|--------|---------|
| P2-1 | **本地存储改为 user-scoped key / namespace** | 大 | 本次复核新增 |
| P2-2 | **hydrate 前 owner 校验，禁用 unknown-owner 自动迁移** | 中-大 | 本次复核新增 |
| P2-3 | **拆 `profiles` 表**（含 `login_days` 挪出 `user_metadata`） | 大（DB 迁移） | **Q3 + Q4** |
| P2-4 | **所有 domain 表统一 `deleted_at` 软删** | 大（DB 迁移） | **Q2** |
| P2-5 | `dateCache` 作为 chat 唯一 in-memory 真相，`state.messages` 降 derived | 中 | — |
| P2-6 | **Plant / Annotation 全面引入 syncState + outbox** | 大 | **Q7** |
| P2-7 | 离线行为 Playwright 测试 harness | 中 | — |

### 关键注意事项（写给后续接手的人）

- **P0-3 必须在 P0 里做**（即使 Q3 拆 profiles 表留给了 v1.1）：`user_metadata` 的并发竞争是今天就会发生的数据丢失 Bug，不能等到 v1.1 表结构重构才解决；先用"排队写入"兜住，等 profiles 表上线后自然消解。
- **P0-8（events 降 150）是 Q5 决策升级的产物**：不要漏做，它既是 localStorage 瘦身也是 iOS WebView 性能保护。
- **P1-1' 的 UI 方案必须先找 Young 对齐**：Outbox 后端骨架可以写，但失败提示的 UI 形式（小红点 / 横幅 / 悬浮 badge）是产品决定，不是技术决定。
- **当前建议执行顺序**：先把 Chat / Plant / Report / Annotation 残余写路径收口，确保“本地优先 + 不丢数 + 合并保护”完整闭环；然后再独立处理多账号隔离主线，避免两条主线交叉改动放大回归面。
