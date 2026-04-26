# CURRENT TASK (Session Resume Anchor)

Last Updated: 2026-04-26
Owner: current working session

---

## 当前主线 A：Growth 待办 × 瓶子 iOS 套壳稳定性（TODO_BOTTLE_IOS_P0）

Status: 实施中（高优先）

### 已完成（本轮）

- [x] `useAuthStore` 超长文件拆分：初始化主链路保留在 `useAuthStore.ts`，账号动作与运行时 helper 下沉到 `authStoreAccountActions.ts` / `authStoreRuntimeHelpers.ts`
- [x] Telemetry Center 新增根系方向设置看板入口与聚合接口，可在管理员后台直接观察打开/修改/重置/保存结果
- [x] 日期口径统一为本地日历日（修复 recurring 判定偏移）
- [x] 删除一致性第一轮：pending delete tombstone + fetch 合并保护
- [x] 星星回滚链路补齐（完成加星/取消完成扣星对称）
- [x] iOS 手势/拖拽稳定性收口（按钮 pointer-first + click 吞并；新增拖拽手柄并保留长按兜底）
- [x] 编辑命中稳定性收口（编辑目标 id 锁定 + 编辑态禁拖拽，避免错位到下一条）
- [x] Profile 作息/根系方向弹窗在 iOS 套壳下保存按钮可见性修复（弹窗容器改 `min-h-0` + 滚动区收缩 + `100vh` 高度兜底）

### 待完成（本线核心）

- [ ] **P0-1 复现与可观测增强**：补齐 toggle/delete/recur 结构化日志与 iOS 复现脚本
- [x] **P1-2 iOS 手势与拖拽优化**：pointer-first 收口、显式 drag handle、减少滚动冲突
- [x] **P1-3 编辑命中稳定性**：稳定 key 与编辑目标 id，消除“编辑错位到下一条”

### 验收标准（DoD）

- [ ] 同模板同日最多 1 条未完成实例，完成后取消不会再生重复实例
- [ ] “只删今天”当天不复活；“以后都删”模板与未来实例不再出现
- [ ] 删除后 UI 立即移除，前后台切换/网络抖动后不复活
- [ ] 编辑哪条改哪条，连续 20 次无错位
- [ ] iOS 拖拽重排稳定可用（长按或拖拽手柄手测通过）

---

## 当前主线 E：会员 AI 分类分层（MEMBERSHIP_AI_CLASSIFICATION）

Status: 实施中（第二阶段收口中）
执行前必读：`docs/MEMBERSHIP_AI_CLASSIFICATION_PRD.md`、`docs/MEMBERSHIP_AI_CLASSIFICATION_TECH_DESIGN.md`

### 开发前阅读清单（必须）

- [ ] 阅读需求文档：`docs/MEMBERSHIP_AI_CLASSIFICATION_PRD.md`
- [ ] 阅读技术文档：`docs/MEMBERSHIP_AI_CLASSIFICATION_TECH_DESIGN.md`
- [ ] 对照现有代码入口：`src/store/useChatStore.ts`、`src/store/useTodoStore.ts`、`src/api/client.ts`、`api/classify.ts`、`src/store/useAuthStore.ts`

### 开发任务规划（按顺序执行）

1) **后端鉴权与会员门控**
- [x] `api/classify.ts` 接入 Supabase 鉴权与 Plus 校验
- [x] 非 Plus 返回 `403 membership_required`，并保持错误结构稳定

2) **前端 classify 调用改造**
- [x] `src/api/client.ts` 的 `callClassifierAPI` 透传 Authorization
- [x] `src/api/client.ts` 的 `callTodoDecomposeAPI` 透传 Authorization（与 classify 会员门控一致）
- [x] 统一处理 `membership_required` 错误分支（`ApiClientError` + `isMembershipRequiredError`）

3) **聊天主链路分流（Free/Plus）**
- [x] `src/store/useChatStore.ts`：Free 完全不触发 classify
- [x] `src/store/useChatStore.ts`：Plus 每条消息仅调用一次 classify（去重多调用点）
- [x] Plus 将 AI 结果统一用于 activity/mood/bottle 三类判定

4) **星星判定策略收敛**
- [x] Free：仅 todo 绑定 + 关键词命中，不做 AI 语义兜底
- [x] Plus：优先 `matched_bottle`，必要时关键词兜底

5) **Todo 分类策略对齐**
- [x] `src/store/useTodoStore.ts` 增加 Plus 门控（Free 不调 AI）
- [x] 明确 todo 是否执行“Plus 全量 AI”或“Plus 低置信度 AI”（按 PRD 决策记录；本轮确认采用 Plus 全量 AI，并同步改造 classify prompt/schema）

6) **降级与可观测**
- [x] AI 失败回退本地规则，不阻断主链路
- [x] 增加最小埋点：`user_plan/classification_path/ai_called/ai_result_kind/bottle_match_source`

7) **测试与验收**
- [x] 单元测试：Free=0 调用、Plus=每条 1 次、失败降级
- [x] 集成测试：非 Plus 直调 classify 返回 403
- [ ] 手测 50 条回归：Free 0 调用、Plus 50 调用

补充验收记录（2026-04-26）：
- [x] 脚本回归（`useChatStore.membership-classification.test.ts`）：Free 50 条调用数=0、Plus 50 条调用数=50、send+endActivity 去重=1 次

### 下一步待完成

- [x] 文档同步：更新 `api/README.md`、`src/api/README.md`、`src/store/README.md`
- [x] 回环检查：`npm run lint:all` + `npx tsc --noEmit` + `npm run build`

---

## 当前主线 B：存储系统 P1 优化（DATA_STORAGE_P1）

Status: 实施中（Sprint A-D 主体已完成，剩余收口项与失败可见性）
规格文档：`docs/DATA_STORAGE_AUDIT_REPORT.md`

### 待完成（按建议顺序）

- [x] **P1-3** `useReminderStore` 迁移到 persist（`seeday:v1:reminder`）
- [x] **P1-6** Annotation persist 进一步裁剪（30 天 prune + tracker 7 天裁剪）
- [x] **P1-7** Realtime 高频/低频双通道拆分
- [x] **P1-4** Zustand persist key 统一为 `seeday:v1:<domain>`
- [x] **P1-2** `useAuthStore.initialize` 新鲜度门控（60s）
- [x] **P1-1a/b/c** Outbox（骨架 -> 四 store 接入 -> flush 触发点）
- [x] **P1-5 / C-1** Chat `syncState` + outbox 联动
- [x] **C-2** Plant 写路径 durable 化（local-first + cloud fail 不丢）
- [x] **C-3** Report 次级更新写路径并入 outbox
- [x] **C-4** Annotation `suggestion_accepted` durable 化
- [ ] **P1-1' / C-5** Outbox 失败 UI（需先与 Young 对齐方案；底层已新增 3 次失败后进入 1 小时 cooldown，避免自动保存闪现）

### 2026-04-22 补充收口

- [x] Profile 面板 saving 闪现排查：`updateLongTermProfileEnabled()` / `updateLanguagePreference()` 改为 local-first background sync；`UserProfilePanel` / `RoutineSettingsPanel` 去掉会被瞬时后台同步触发的 `Saving...` 文案闪现
- [x] 地区设置改为严格匹配保存：地区未命中时新增“保存国家”兜底确认（仍保持标准化 `country_code + lat/lng`，不落自由文本）

### 执行拆解（已同步为可落地清单）

#### Sprint A（低耦合，先清）

- [x] **A-1 / P1-3 Reminder persist 化**
  - 触达：`src/store/useReminderStore.ts`、`src/store/useAuthStore.ts`
  - 动作：改为 `create(persist(...))`；key 用 `seeday:v1:reminder`；`merge` 保留跨日自动重置；并兼容迁移旧 key（`reminder_confirmed_today/date`）
  - 验收：跨日后 `confirmedToday` 自动重置；登出后 reminder 本地状态被清空

- [x] **A-2 / P1-6 Annotation persist 裁剪（剩余）**
  - 触达：`src/store/useAnnotationStore.ts`
  - 动作：`annotations` 做 30 天 prune；`characterStateTracker` 仅保留最近 7 天键；持久化前后都做防御性裁剪
  - 验收：重度账号下 annotation 持久化体积受控；annotation/suggestion/todayContext 正常

- [x] **A-3 / P1-7 Realtime 双通道**
  - 触达：`src/hooks/useRealtimeSync.ts`
  - 动作：`user-sync-hf-${userId}` 订阅 `messages+moods`；`user-sync-lf-${userId}` 订阅其余 6 表；分别 subscribe/remove
  - 验收：低频通道故障不影响消息/心情实时；`npx tsc --noEmit` 通过

#### Sprint B（A 稳定后）

- [x] **B-1 / P1-4 persist key 统一**
  - 触达：`src/store/persistKeys.ts`（新增）+ 各 `use*Store.ts`
  - 动作：统一 `seeday:v1:<domain>`；每个 store 的 `name` 改常量；`merge` 中一次性旧 key 迁移（读旧 -> 写新 -> 删旧）
  - 验收：旧设备升级数据不丢；新安装只写新 key；`clearLocalDomainStores` 对齐

#### Sprint C（可与 B 并行）

- [x] **C-1 / P1-2 initialize 新鲜度门控**
  - 触达：`src/store/useAuthStore.ts` + 7 个 domain store
  - 动作：各 store 增 `lastFetchedAt`；`fetchX` 成功后更新；`initialize()` 按 60s gate 跳过热启动重复拉取
  - 验收：热启动（<=30s）不重复拉云；冷启动（>60s）正常拉取

#### Sprint D（最大改动，分批落地）

- [x] **D-1 / P1-1a Outbox 骨架**
  - 触达：`src/store/useOutboxStore.ts`（新增）+ 单测（新增）
  - 动作：定义 `OutboxEntry` 与 4 个 `kind`；persist key `seeday:v1:outbox`；实现 `enqueue/flush/markFailed/clearSucceeded`
  - 验收：覆盖 enqueue / flush 成功 / flush 重试 / >5 次 failed

- [x] **D-2 / P1-1b 四 store接入（核心写路径）**
  - 触达：`src/store/useMoodStore.ts`、`src/store/useFocusStore.ts`、`src/store/useReportStore.ts`、`src/store/useAnnotationStore.ts`
  - 动作：核心写库失败统一 enqueue；保留现有本地乐观更新
  - 验收：断网写入后，重连自动补推

- [x] **D-3 / P1-1c flush 触发点**
  - 触达：`src/hooks/useNetworkSync.ts`、`src/hooks/useAppForegroundRefresh.ts`、`src/store/useAuthStore.ts`
  - 动作：`online` / `foreground` / `initialize` 后触发 `useOutboxStore.getState().flush(userId)`
  - 验收：断网 -> 操作 -> 联网，无需重启可补推

- [x] **D-4 / P1-5 Chat syncState 联动**
  - 触达：`src/store/useChatStore.ts`（及关联类型）
  - 动作：`sendMessage` / `sendMood` 新消息本地先标记 `syncState`；首次写库失败进入 `chat.upsert` outbox；`_refreshDateSilently` 与 `fetchMessages` 用 `syncState` 区分离线未同步与云端删除
  - 验收：离线发消息重连后不重不漏；被删除消息不再因旧“本地有云端无”规则错误复活

- [x] **D-6 / C-2 Plant 写路径 durable 化**
  - 触达：`src/store/usePlantStore.ts`
  - 动作：保留本地即时更新；`setDirectionOrder()` 云端失败改为进入 `plant.directionOrder` outbox，而不是仅抛错
  - 验收：断网修改方向设置后，UI 保持本地结果；联网后自动补推；不会静默回滚

- [x] **D-7 / C-3 Report 次级更新并入 outbox**
  - 触达：`src/store/useReportStore.ts`
  - 动作：`updateReport()` 无 session 或直写失败时，改为 enqueue 完整 `report.upsert`；本地仍保留乐观结果
  - 验收：断网修改 report title/content/userNote 后，联网自动补推

- [x] **D-8 / C-4 Annotation suggestion outcome durable 化**
  - 触达：`src/store/useAnnotationStore.ts`
  - 动作：`recordSuggestionOutcome()` 无 session 或更新失败时进入 `annotation.outcome` outbox
  - 验收：断网点击“接受建议”后，本地态不丢；联网自动补推

- [x] **D-5 / P1-1' Outbox 失败 UI（已对齐 Young 极简方案）**
  - 触达：`src/components/feedback/CloudRetryButton.tsx`、`src/App.tsx`、`src/features/growth/GrowthPage.tsx`、`src/store/useOutboxStore.ts`
  - 动作：采用“右上角小云朵 + `重试/Retry/Riprova` 文案”极简方案；失败时显示、点击即触发 outbox 立即重试；Growth 页重试按钮样式同步对齐
  - 验收：用户仅感知“失败可重试”，不展示技术日志细节

### 回环检查（每个 Sprint 最少执行）

- [ ] `npx tsc --noEmit`
- [ ] `npm run build`（A-3/B/C/D 必跑）
- [x] Outbox 改动执行 `npm run test:unit`

### 下一主线（已启动规划）：DATA_STORAGE_P2 多账号本地隔离（完整版）

Status: 实施中（Phase 0/1 基础设施已起步，Phase 2 起）

#### 背景与问题定义（为什么必须做）

- 当前本地持久化仍以全局 key 为主（`seeday:v1:<domain>`），同设备多账号共享同一批 localStorage 空间；依赖切号/登出时清理补救，而非天然隔离
- 当前流程是“先 hydrate，再 owner 校验再清理”，启动瞬间存在短暂串号窗口（可读到上一个账号缓存）
- 当前存在 `owner.type === 'unknown' && hasLocalData` 自动迁移路径，owner 丢失/损坏时有误迁移到新账号云端的风险
- 非 domain key（如语言、提醒调度、输入草稿等）尚未形成统一隔离策略，导致行为不一致

#### 目标（本主线必须达成）

- [ ] 用户域数据改为 **user-scoped namespace**（按 `userId` 分桶），不再依赖全局 key + 事后清理
- [ ] 将 owner/session 校验前置到 hydrate 前，消除启动瞬时串号窗口
- [ ] 禁止 unknown-owner 自动迁移（改为安全模式：不自动上传）
- [ ] 形成“domain key + 非 domain key”隔离矩阵与统一治理规则
- [ ] 给出可回滚的迁移路径，保证老用户升级可控

#### 非目标（本主线不做）

- 不做 Supabase 分表重构（profiles/memberships 结构治理仍属后续架构线）
- 不重写 domain 业务逻辑（todo/growth/report 业务规则不在本线改动）
- 不改变现有 outbox 语义（仅改存储命名空间与触发时机）

#### 设计基线（统一约束）

- 数据分类：
  - 用户域（必须 user-scoped）：`chat/todo/growth/mood/report/annotation/focus/plant/timing/stardust/outbox`（`reminder` 默认纳入 user-scoped）
  - 设备域（保持全局）：`dev_preview`、`seeday_onboarded`、`i18nextLng`（默认设备级偏好）
- key 规范：
  - 用户域：`seeday:v2:user:<userId>:<domain>`
  - 匿名域：`seeday:v2:anon:<domain>`
  - owner 记录：保留 `seeday:local-data-owner:v1`（仅用于迁移判定与风控）
- hydrate 规范：domain store 改为 `skipHydration: true`，由 auth bootstrap 在 scope 确认后统一手动 `rehydrate`

#### 实施分期（完整版执行清单）

##### Phase 0（防回归护栏，先上）

- [x] P2-0.1 基础观测：为 scope 切换、owner 判定、rehydrate、迁移决策补 DEV 结构化日志（不落生产日志）
- [x] P2-0.2 安全开关：新增 `MULTI_ACCOUNT_ISOLATION_V2` 特性开关，支持灰度启停
- [x] P2-0.3 测试基座：新增多账号切换 e2e 手工脚本与最小单测骨架

##### Phase 1（存储命名空间基础设施）

- [x] P2-1.1 新增 scope 管理器（active scope / resolve scope / set scope）
- [x] P2-1.2 新增 scoped key helper（统一生成 v2 key）
- [x] P2-1.3 新增 domain 批量 rehydrate orchestrator（按 scope 手动 hydrate）
- [x] P2-1.4 新增 scoped 清理工具（按 scope 清，不再默认全局清空）
- [x] P2-1.5 新增迁移工具（legacy v1 -> v2 scoped），支持 dry-run

触达（预期）：`src/store/persistKeys.ts`、`src/store/persistMigrationHelpers.ts`、`src/store/*scope*.ts`（新增）

##### Phase 2（Auth 启动/切号顺序重排）

- [x] P2-2.1 `initialize()` 改为：session/owner 判定 -> 设 scope -> rehydrate -> sync/fetch
- [x] P2-2.2 `SIGNED_IN` 改为先切 scope 再读 domain store，避免读旧账号缓存
- [x] P2-2.3 `SIGNED_OUT` 改为切匿名 scope + 按策略清理，不做“全域盲清”
- [x] P2-2.4 禁止 `unknown-owner` 自动迁移（改为隔离待处理，不自动上传）

触达（预期）：`src/store/useAuthStore.ts`、`src/store/authLocalOwnerHelpers.ts`

##### Phase 3（11 个 persisted domain store 接入 scoped persist）

- [x] P2-3.1 批量改造 persist `name` 到 scoped key（v2）
- [x] P2-3.2 批量接入 `skipHydration + 手动 rehydrate` 流程
- [x] P2-3.3 outbox scoped 化，确保只 flush 当前账号命名空间
- [x] P2-3.4 `clearLocalDomainStores` 改为 scope-aware 版本

触达（预期）：
- `src/store/useChatStore.ts`
- `src/store/useTodoStore.ts`
- `src/store/useGrowthStore.ts`
- `src/store/useMoodStore.ts`
- `src/store/useReportStore.ts`
- `src/store/useAnnotationStore.ts`
- `src/store/useFocusStore.ts`
- `src/store/usePlantStore.ts`
- `src/store/useTimingStore.ts`
- `src/store/useStardustStore.ts`
- `src/store/useReminderStore.ts`
- `src/store/useOutboxStore.ts`

##### Phase 4（非 domain key 治理与策略固化）

- 2026-04-23（续）首批已接入 user-scoped：`chat_input_draft`、`yesterday_popup_date`、`night_reminder_dismissed_date`、`pending_notification_confirm_action`、`reminder_today_count`、`reminder_scheduled_date`（均通过 active scope 生成 `seeday:v2:*:local:*` key；开关关闭时回退旧 key）
- 2026-04-24：`freeDay_<date>` 策略定稿并落地为 user-scoped，提醒调度链路统一复用 `storageScope.getScopedClientStorageKey()` 生成 scoped local key
- 2026-04-24：补齐非 domain key 全量归档（新增 `seeday_pending_profile_v2_<userId>`、`streakDate_/streakValue_`、`seeday:active-storage-scope:v2`、`seeday:local-data-owner:v1`、`todo-storage` legacy）
- 2026-04-24：完成 Phase 4 收尾清理：`freeDay_<date>` 增加 legacy key 迁移（命中旧全局 key 时写回 scoped 并移除旧 key）；`todo-storage` 标记为 legacy 迁移专用常量并补注释
- 2026-04-24：新增提醒调度账号切换隔离测试，覆盖 A/B 账号下 `reminder_scheduled_date` / `reminder_today_count` 不串读

- [x] P2-4.1 建立 key 分类清单（user-scoped / global / 待淘汰）
- [x] P2-4.2 将用户行为类 key（如聊天草稿、提醒确认等）按规则 user-scoped 化
- [x] P2-4.3 保持设备偏好类 key 全局（语言、dev preview、onboarded）并文档固化
- [x] P2-4.4 清理遗留不可达 key，补迁移脚本与注释

触达（预期）：`src/features/**`、`src/hooks/**`、`src/services/**` 中直接 localStorage/sessionStorage 使用点

##### Phase 5（迁移、灰度、验收）

- 2026-04-24：`useAuthStore` 新增 owner-trusted 迁移决策收口（`authLocalMigrationPolicy`），并在 v2 开启时仅允许 `owner=anonymous` 或 `owner=user(current)` 自动执行 legacy `seeday:v1:* -> scoped v2` 迁移
- 2026-04-24：unknown-owner 安全模式收敛：迁移决策统一返回 `block_unknown_owner`，登录切换链路下停止 `syncLocalAnnotations` 自动上云；新增策略单测覆盖

- [ ] P2-5.1 老用户迁移策略上线（仅 owner 可信时自动迁移）
- [ ] P2-5.2 unknown-owner 进入安全模式（只读本地，不自动上云）
- [ ] P2-5.3 灰度发布：先 DEV -> TestFlight 小流量 -> 全量
- [ ] P2-5.4 完成回归与监控验收后移除开关（或保留紧急回滚开关）

#### 核心验收标准（DoD）

- [ ] 同设备 A/B 账号切换，启动与切换过程中不出现 A 数据短暂渲染到 B
- [ ] unknown-owner 场景下，不会自动把旧本地数据上传到当前登录账号
- [ ] outbox 仅处理当前 scope；切号后不会 flush 其他账号待同步项
- [ ] 升级用户（v1 -> v2）数据迁移可控：不丢当前账号数据、不跨账号污染
- [ ] 关键路径回归通过：`npx tsc --noEmit`、`npm run test:unit`、`npm run build`

#### 风险与缓解

- 风险 R1：启动空白态变长 -> 缓解：分阶段 rehydrate + skeleton 占位 + 埋点观察首屏耗时
- 风险 R2：迁移误判导致“看似丢数据” -> 缓解：dry-run 日志 + owner 可信才自动迁移 + 手动恢复预案
- 风险 R3：切号后 outbox 串 flush -> 缓解：outbox 强制 scope 校验 + flush 前 userId 二次校验
- 风险 R4：改动面广引发回归 -> 缓解：按 Phase 分 PR，小步发布，保留特性开关

#### 文档同步要求（实施时强制）

- [ ] `src/store/README.md`：更新 scoped persist / hydrate 顺序 / owner 策略
- [ ] `docs/DATA_STORAGE_AUDIT_REPORT.md`：将 A-1~A-4 风险改为已治理项并补迁移说明
- [ ] `docs/CHANGELOG.md`：按 Phase 记录变更与回滚点
- [ ] `docs/PROJECT_MAP.md`：若新增 store 基础设施目录/文件，更新索引

---

## 当前主线 C：AI 建议模式（P7 收口）

Status: P0-P6 已完成，剩联调与运营化

- [ ] 联调验收：建议出现 -> 点击去做 -> 自动凝结 -> 超时/X 不凝结
- [ ] 事件漏斗埋点：show/click/close/timeout
- [ ] 数据库核对：`annotations.suggestion_accepted` 字段存在性与 migration

---

## 当前主线 D：日记功能重建（DIARY_REBUILD_PLAN）

Status: 主链路可用，剩余增强项

- [x] 2026-04-26：`DiaryBookViewer` 翻页透视收口——按“中缝消失点 + 中线水平”重建页内投影，左右页统一向中缝收敛并保持同平面 `matrix3d`，修复斜度反向与边线不共视线问题
- [x] 2026-04-26：`DiaryBookViewer` 翻页松手跳变收口——拖拽回弹最短时长从 60ms 提升至 180ms，并让 `top/height/left` 与 `transform` 同步补间，修复“翻到下一页后斜度瞬跳回正”
- [x] 2026-04-26：`DiaryBookViewer` 下一页静止态对齐——翻页进行中将 reveal sheet 强制对齐静止摊开几何（`top=0` / `height=pageH` / 同款裁切），并在拖拽时仅保留“翻动页 + 下一页 + 对侧当前页”，避免堆叠层侵入主阅读面导致的畸形白边

- [ ] V3：MoodEnergyTimeline（补时间轴结构）
- [ ] D5（剩余）：历史趋势补 mood key 跨日分布
- [ ] V5（可选）：TodoCompletionCard 组件化视觉升级
- [ ] A7（低优先）：`getDateRange` title 多语言写入 reports

---

## 早期遗留（需决策或补收口）

- [x] `user_metadata` 并发写策略统一（已通过 `authMetadataQueue.ts` 串行化落地）
- [ ] User Profile：关闭长期画像后的数据治理与清除交互细节
- [ ] 低叙事密度能力（Doc1/P1）的线上 DoD 验收与 2 周运营复盘尚未完成
- [x] 多账号本地数据隔离二阶段治理已立项并完成完整版规划（见主线 B：`DATA_STORAGE_P2`），待按 Phase 0-5 分批实施

---

## 近期完成（仅保留 2 条）

- [x] iOS 订阅错误可观测性收口：`@payment iap` 不再把所有失败统一映射为 `subscription_failed`，前端购买弹窗优先显示真实错误信息；并在 restore 侧增加 Seeday 商品 ID 过滤，避免误取非本应用 entitlement
- [x] Supabase 鉴权链路回退真实域名：服务端在 `SUPABASE_URL` 配置为 `/supabase-proxy` 时自动解析 anon key 的项目 ref 并直连 `https://<ref>.supabase.co`，修复 `/api/plant-generate` 被 rewrite 漏接后 `401 Unauthorized`
- [x] 会员购买界面统一：Onboarding 第 7 步改为复用 `MembershipPurchaseModal`，与 `/upgrade` 共用同一套购买弹窗；并按用户试用/购买历史动态切换“人气首选”（未试用→试用档、已试用未购→月度、已购老用户→年度）
- [x] 根系方向设置收口：`usePlantStore` 改为 local-first 合并方向配置（云端空值/默认值不再覆盖本地自定义），并补齐 profile 侧打开/修改/重置/保存 telemetry
- [x] Chat 连续活动记录修复：修复 `closePreviousActivityLocal()` 变量/return 缺失，恢复“吃饭 -> 睡觉”连续发送，并补回归测试
- [x] EcoSphere 漂浮规则增强：随机时长、随机方向、随机冲量脉冲

---

## 会话恢复顺序

1. `LLM.md`
2. `docs/CURRENT_TASK.md`（本文件）
3. `docs/PROJECT_MAP.md`
4. `docs/SEEDAY_DEV_SPEC.md`
5. 按任务读取模块 README / 规格文档

---

## 归档说明

- 本文件仅保留进行中与未收口事项。
- 已完成的历史细节统一查 `docs/CHANGELOG.md`。
