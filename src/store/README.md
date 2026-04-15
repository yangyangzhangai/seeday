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
- 语言偏好已接入云端同步：`useAuthStore.updateLanguagePreference()` 会将 UI 语言写入 `user_metadata.i18nextLng`；登录初始化与 `SIGNED_IN` 时若云端缺失该 key 会自动回填，若存在则优先云端值并同步到 i18n。
- suggestion 画像门控已接入：`useAnnotationStore` 在 `longTermProfileEnabled=true` 时构建并透传 `userContext.userProfileSnapshot`，并将 declared/observed 饭点注入建议上下文提示检测。
- 周报触发画像提取已接入：`useReportStore.generateReport('weekly', ...)` 会并行调用 `/api/extract-profile`（携带最近消息），并在成功后通过 `useAuthStore.updateUserProfile(...)` 合并写回 `observed/dynamicSignals/anniversariesVisible/hiddenMoments/lastExtractedAt`。
- suggestion 反馈埋点扩展：当用户接受且该条批注 `narrativeEvent.isTriggeredReply=true` 时，会额外写入 `telemetry_events.event_condensed`（携带 `eventType/eventId`）供低叙事密度质量复盘。

## 变更自检

- `useGrowthStore.ts`（2026-04）：Bottle 新增 `checkinDates`（按 `YYYY-MM-DD` 去重）用于 Growth 瓶子详情面板统计：近 7 天打卡天数、当前连续天数、历史最长连续天数。
- `useTodoStore.ts`（2026-04）：`fetchTodos()` 同步改为“父待办先推、子待办后推”，并增加 `parent_id` 外键冲突恢复（父任务补推 + 孤儿 `parentId` 去引用兜底），避免重试循环失败。
- `useTodoStore.ts` + `dbMappers.ts`（2026-04）：新增待办 `sortOrder` 及 bigint 字段写库夹紧，避免异常极值导致 Supabase `22003 bigint out of range`。

```bash
npx tsc --noEmit
npm run build
```
