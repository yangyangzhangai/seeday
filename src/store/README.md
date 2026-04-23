# Store Layer Guide

`src/store/*` 是 Zustand 状态层，负责页面状态、数据同步编排、以及本地持久化策略。

## 当前 store 列表

| Store | Responsibility | Persist |
| --- | --- | --- |
| `useAuthStore.ts` | 登录/注册/会话初始化 | No |
| `useChatStore.ts` | 消息流、记录模式、活动编辑 | Yes |
| `useTodoStore.ts` | Growth 页内的 Todo CRUD、计时、分类、消息联动 | Yes |
| `useGrowthStore.ts` | 成长瓶（Bottle）、每日目标与弹窗状态 | Yes |
| `useFocusStore.ts` | Focus session、活动关联、时长持久化 | Yes |
| `useReportStore.ts` | 报告生成、报告列表、AI 日记 | Yes |
| `usePlantStore.ts` | 植物根系片段、当日植物、方向配置与历史读取 | Yes |
| `useMoodStore.ts` | 心情映射、自定义标签（含裁剪） | Yes |
| `useAnnotationStore.ts` | AI 批注触发与展示 | Yes |
| `useStardustStore.ts` | 星尘生成与同步 | Yes |
| `useReminderStore.ts` | 主动提醒当日确认态、前台弹窗与快捷记录上下文 | Yes |

## 组织约定

1. `useXxxStore.ts`: state 与 action 的主入口。
2. `xxxActions.ts`: 多步骤副作用逻辑（例如 API 调用 + 写库 + 状态回写）。
3. `xxxHelpers.ts`: 可复用纯函数，避免在 store 内堆叠长函数。
4. `useXxxStore.types.ts`: 当 store 入口过长时，抽离类型与接口定义。
5. `xxxLegacy.ts`: 历史数据兼容/回填逻辑，避免污染主 store 可读性。

## 代码约束

1. 前端 AI 能力统一走 `src/api/client.ts`，不要在 store 里直连第三方 Key。
2. 保持 action 单一职责；复杂流程优先下沉到 `*Actions`。
3. 新增持久化字段要考虑清理策略，避免 localStorage 无限增长。
4. 跨 store 调用优先使用 `useXxxStore.getState()`，避免循环依赖。

## Annotation Store Notes

- `useAnnotationStore.ts` 现包含 suggestion 专用频率门控（分时段配额 + 日上限 + 动态最小间隔），不会限制普通文字批注。
- suggestion 反馈通过 `recordSuggestionOutcome(annotationId, accepted)` 记录，写回本地状态与 `annotations.suggestion_accepted`。
- today context（今日上下文）已接入：基于关键词识别 `health/special_day/major_event` 写入日级缓存，并在 annotation 请求时透传 `userContext.todayContext`；批注落库时同步写入 `annotations.today_context` 便于回放和分析。
- annotation 时间/节日上下文已接入：透传 `userContext.currentDate`，并优先读取 `user_metadata.country_code` 作为 `userContext.countryCode`（无值时服务端用 timezone 兜底解析）。
- 行为-角色状态映射已接入：`useAnnotationStore` 在触发前构建 `userContext.characterStateText/meta`，状态来源于 `src/lib/characterState/*` 的 matcher + tracker + builder（支持延迟触发/streak/密度衰减/同日去重）。
- 新增 recovery nudge（中断挽回提醒）：仅当瓶子连续 3 天无完成时，`useAnnotationStore` 会透传 `userContext.recoveryNudge` 强制建议（2 星奖励不再对未关联瓶子的重复待办触发）。
- recovery nudge 触发时段：优先使用目标历史完成时段；无历史时默认中午 12 点窗口（±2h）；同一 key 每天最多提醒 2 次，二次提醒最小间隔 4 小时。
- 新增一次性 2 星奖励状态：点击中断挽回建议后激活，完成匹配 todo/bottle 时由 `consumeRecoveryBonusForCompletion()` 消费并返回奖励星数。
- 新增“长期未完成待办预拆解”透传：suggestion 命中 stale todo 时，payload 可携带 `decomposeSteps`；点击建议后通过 `pendingSuggestionIntent` 跨页传递给 Growth 页并落地子待办（已存在子待办时跳过重复创建）。
- 新增横向联想中间层透传：`useAnnotationStore` 会在 `userContext` 附带 `userId`（若存在），供服务端按 user+aiMode 维护联想采样去重状态，并将采样指令注入 prompt U4（服务端优先持久化到 `user_metadata.lateral_association_state_v1`）。
- 新增低叙事密度触发透传：`useAnnotationStore` 会接收 `/api/annotation` 返回的 `narrativeEvent` 元数据（`eventType/eventId/instruction/isTriggeredReply`），用于识别本次回复是否来自低密度事件注入。
- 待办完成事件已与普通记录分流：`GrowthTodoSection`/`FocusMode` 在完成待办时触发 `activity_completed`，普通输入仍走 `activity_recorded`。
- 待办完成会透传 `eventData.todoCompletionContext`（importance/recurrence/createdAt/ageDays/bottle/threeMonth），用于让 annotation 感知“这是待办完成”。
- token 控制策略：仅“特殊待办”附加 `eventData.summary`（单行摘要 + 近 90 天统计）。特殊判定为任一命中：关联瓶子、重复任务（daily/weekly/monthly）、创建 >= 3 天；其余一次性新建轻量待办不附加 summary。
- 用户画像 v1.1 基建已接入：`useAuthStore` 新增 `longTermProfileEnabled` + `userProfileV2` 状态，并提供 `updateLongTermProfileEnabled()` / `updateUserProfile()`（统一按 `read -> merge -> write` 更新 `user_metadata`，避免覆盖 `login_days`、`lateral_association_state_v1` 等并行字段）。
- 作息与 AI 专属记忆已拆分：作息字段（`wakeTime/sleepTime/mealTimes`）保持普通功能可编辑，AI 专属记忆（`manual.freeText` + prompt 注入）按 Plus 功能门控。
- 语言偏好已接入云端同步：`useAuthStore.updateLanguagePreference()` 会将 UI 语言写入 `user_metadata.i18nextLng`；登录初始化与 `SIGNED_IN` 时若云端缺失该 key 会自动回填，若存在则优先云端值并同步到 i18n。
- suggestion 画像门控已接入：`useAnnotationStore` 在 `isPlus && longTermProfileEnabled=true` 时构建并透传 `userContext.userProfileSnapshot`，并将 declared/observed 饭点注入建议上下文提示检测。
- 周报触发画像提取已接入：`useReportStore.generateReport('weekly', ...)` 会在 `isPlus && longTermProfileEnabled=true` 时并行调用 `/api/extract-profile`（携带最近消息），并在成功后通过 `useAuthStore.updateUserProfile(...)` 合并写回 `observed/dynamicSignals/anniversariesVisible/hiddenMoments/lastExtractedAt`。
- suggestion 反馈埋点扩展：当用户接受且该条批注 `narrativeEvent.isTriggeredReply=true` 时，会额外写入 `telemetry_events.event_condensed`（携带 `eventType/eventId`）供低叙事密度质量复盘。
- `useReportStore.generateAIDiary()` now branches by membership: Plus -> full AI diary (`aiAnalysis`), Free -> teaser copy (`teaserText`) for blur-lock upgrade UI.
- metadata 并发写已串行化：新增 `authMetadataQueue.ts`，`updateLanguagePreference/updateUserProfile/updateLongTermProfileEnabled/updateAvatar/updatePreferences` 及迁移写入统一走 `patchUserMetadata(...)`，避免 `user_metadata` 覆盖竞争。
- `useMoodStore.fetchMoods()` 改为 cloud + local merge（云端覆盖同 ID，本地独有保留），避免前后台拉取覆盖在途心情写入。
- `useAnnotationStore.fetchAnnotations()` 改为 cloud + local pending 合并，且 `todayStats.events` 上限从 400 下调到 150。
- `useAnnotationStore` 持久化新增双重裁剪：`annotations` 仅保留最近 30 天（本地未同步项例外），`characterStateTracker` 仅保留最近 7 天/未过期效果，hydration 时也会再次防御性裁剪。
- `useFocusStore` 现持久化 `currentSession/queue`，并在 hydration 后自动回收超时会话；`useTimingStore` 已接入 persist，冷启动可直接恢复当日计时状态。
- `useReminderStore` 已从裸 localStorage 迁移为 Zustand persist（`seeday:v1:reminder`），并在 merge 中保留跨日自动重置 confirmed 状态。
- `useRealtimeSync` 已按高频/低频拆为双通道：`messages+moods` 走 `user-sync-hf-*`，其余 domain 走 `user-sync-lf-*`，降低单通道故障对聊天实时感的影响。
- 全域 persist key 已统一收口到 `src/store/persistKeys.ts` 的 `seeday:v1:<domain>`，各 store 在 hydration 时会一次性迁移旧 key，并在 `clearLocalDomainStores()` 中统一清理，降低跨账号残留风险。
- `useAuthStore.initialize()` 现按各 domain store 的 `lastFetchedAt` 做 60 秒新鲜度门控；本地缓存足够新时跳过重复拉云，仅保留本地恢复、pending push 与 realtime 增量更新。
- `useOutboxStore` 已作为全局 write-behind 队列落地：持久化 key 为 `seeday:v1:outbox`，当前承接 `chat.upsert` / `mood.upsert` / `focus.insert` / `report.upsert` / `annotation.insert` / `annotation.outcome` / `plant.directionOrder` 七类写失败补推；自动重试改为“连续失败 3 次进入 1 小时 cooldown”，避免前台反复出现保存闪烁。
- `useChatStore` 现为新发消息接入显式 `syncState`：本地新消息先标记 `pending` 并立即展示，首次写库失败时进入 `chat.upsert` outbox；云端回拉/flush 成功后回写为 `synced`，本地仅在 `pending/failed` 时保留“云端不存在”的条目，避免把已被删除的消息误当成离线数据复活。
- `usePlantStore.setDirectionOrder()` 现改为真正 local-first durable：方向配置先本地生效并刷新根系预览，云端写失败时自动进入 `plant.directionOrder` outbox，待联网/前台恢复/重新初始化时补推，不再因为首次写失败而回退本地选择。
- `useReportStore.updateReport()` 现也接入 durable fallback：本地仍先乐观更新；若当前无 session 或 `reports.update(...)` 失败，则将完整 report 作为 `report.upsert` 入队，确保 title/content/stats/userNote/AI 结果类二次编辑不会因为瞬时网络问题丢失。
- `useAnnotationStore.recordSuggestionOutcome()` 现也接入 durable fallback：用户点“接受/拒绝建议”时本地状态先更新；若当前无 session 或 `suggestion_accepted` 更新失败，则把结果写入 `annotation.outcome` outbox，避免建议反馈丢失。
- `useAuthStore` 的长期画像开关与语言切换也改成 local-first：先更新本地 user metadata / UI，再静默走 `patchUserMetadata()`；Profile 面板不再因为后台 metadata 同步而闪出“Saving...”。
- Outbox flush 触发点已接入 `useAuthStore.initialize()`、`useNetworkSync` 的 `online` 事件、以及 `useAppForegroundRefresh` 的前台恢复，断网后的核心写操作可在重连后自动补推。
- Outbox 失败 UI 已按 Young 极简方案落地：统一“右上角小云朵 + `重试` 文案”按钮（`CloudRetryButton`），仅在需要手动补推时展示；点击即触发 `useOutboxStore.retryNow()`，不向用户暴露技术级错误详情。
- `usePlantStore.loadTodayData()` 对根系方向配置改为 local-first 合并：云端无数据时保留本地；云端若仅返回默认顺序且本地已有非默认自定义顺序，则保留本地，避免自定义方向被旧云端值回滚。
- `DATA_STORAGE_P2` Phase 2/3 已接入：新增 `scopedPersistStorage.ts` 并将 12 个 persisted domain store 统一改为 `skipHydration + 手动 rehydrate`，在 `VITE_MULTI_ACCOUNT_ISOLATION_V2` 开启时按 active scope 读写 `seeday:v2:user:<userId>:<domain>` / `seeday:v2:anon:<domain>`；关闭开关时保持 `seeday:v1:<domain>` 兼容行为。
- `useAuthStore.initialize()` / `SIGNED_IN` / `SIGNED_OUT` 已改为 scope-first 顺序：先切换 scope，再 `rehydrateAllDomainPersistStores()`，最后执行 sync/fetch；`clearLocalDomainStores` 改为 scope-aware 清理，避免全域盲清。
- `useOutboxStore.flush()` 已增加 active scope 校验：在 v2 模式下仅当 `activeScope.userId === resolvedUserId` 时才执行 flush，避免切号后串账号补推。
- `storageScope.ts` 新增 `getScopedClientStorageKey()` 供非 domain key 使用；首批用户行为 key（聊天草稿、昨日日志弹窗去重、提醒确认 pending、night reminder dismiss、提醒调度计数）已改为 scope-aware 命名。
- 非 domain key 第二批已接入：植物图片 URL 缓存（`PlantImage`）与 idle nudge 调度时间戳（`localNotificationService`）现按 user scope 分桶，避免切号后读取到其他账号本地痕迹。

## 变更自检

- `useGrowthStore.ts`（2026-04）：Bottle 新增 `checkinDates`（按 `YYYY-MM-DD` 去重）用于 Growth 瓶子详情面板统计：近 7 天打卡天数、当前连续天数、历史最长连续天数。
- `useTodoStore.ts`（2026-04）：`fetchTodos()` 同步改为“父待办先推、子待办后推”，并增加 `parent_id` 外键冲突恢复（父任务补推 + 孤儿 `parentId` 去引用兜底），避免重试循环失败。
- `useTodoStore.ts` + `dbMappers.ts`（2026-04）：新增待办 `sortOrder` 及 bigint 字段写库夹紧，避免异常极值导致 Supabase `22003 bigint out of range`。
- `useTodoStore.ts` + `useGrowthStore.ts`（2026-04）：新增待办完成奖励星数映射（`todoCompletionRewardStarsMap`）与 `decrementBottleStars()` 回滚 action；取消完成时按历史奖励值对称扣星，并在当日无其他同瓶完成时回滚 `checkinDates`。

```bash
npx tsc --noEmit
npm run build
```
