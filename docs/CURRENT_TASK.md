# CURRENT TASK (Session Resume Anchor)

Last Updated: 2026-04-22
Owner: current working session

---

## 当前主线 A：Growth 待办 × 瓶子 iOS 套壳稳定性（TODO_BOTTLE_IOS_P0）

Status: 实施中（高优先）

### 已完成（本轮）

- [x] Telemetry Center 新增根系方向设置看板入口与聚合接口，可在管理员后台直接观察打开/修改/重置/保存结果
- [x] 日期口径统一为本地日历日（修复 recurring 判定偏移）
- [x] 删除一致性第一轮：pending delete tombstone + fetch 合并保护
- [x] 星星回滚链路补齐（完成加星/取消完成扣星对称）
- [x] iOS 手势/拖拽稳定性收口（按钮 pointer-first + click 吞并；新增拖拽手柄并保留长按兜底）
- [x] 编辑命中稳定性收口（编辑目标 id 锁定 + 编辑态禁拖拽，避免错位到下一条）

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

## 当前主线 B：存储系统 P1 优化（DATA_STORAGE_P1）

Status: 实施中（Sprint A 已完成）
规格文档：`docs/DATA_STORAGE_AUDIT_REPORT.md`

### 待完成（按建议顺序）

- [x] **P1-3** `useReminderStore` 迁移到 persist（`seeday:v1:reminder`）
- [x] **P1-6** Annotation persist 进一步裁剪（30 天 prune + tracker 7 天裁剪）
- [x] **P1-7** Realtime 高频/低频双通道拆分
- [x] **P1-4** Zustand persist key 统一为 `seeday:v1:<domain>`
- [x] **P1-2** `useAuthStore.initialize` 新鲜度门控（60s）
- [ ] **P1-1a/b/c** Outbox（骨架 -> 四 store 接入 -> flush 触发点）
- [ ] **P1-1'** Outbox 失败 UI（需先与 Young 对齐方案）
- [ ] **P1-5** Chat `syncState` + outbox 联动

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

- [ ] **D-4 / P1-5 Chat syncState 联动**
  - 触达：`src/store/useChatStore.ts`（及关联类型）
  - 动作：`sendMessage` 失败标记 `syncState: 'pending'` 并入 outbox；`_refreshDateSilently` 用 `syncState` 区分离线与删除
  - 验收：离线发消息重连后不重不漏；被删除消息不复活

- [ ] **D-5 / P1-1' Outbox 失败 UI（阻塞）**
  - 前置：必须先与 Young 对齐方案（小红点 / 横幅 / 悬浮 badge）
  - 备注：方案未确认前不实现 UI，仅保留 failed 状态与重试能力

### 回环检查（每个 Sprint 最少执行）

- [ ] `npx tsc --noEmit`
- [ ] `npm run build`（A-3/B/C/D 必跑）
- [x] Outbox 改动执行 `npm run test:unit`

---

## 当前主线 C：AI 建议模式（P7 收口）

Status: P0-P6 已完成，剩联调与运营化

- [ ] 联调验收：建议出现 -> 点击去做 -> 自动凝结 -> 超时/X 不凝结
- [ ] 事件漏斗埋点：show/click/close/timeout
- [ ] 数据库核对：`annotations.suggestion_accepted` 字段存在性与 migration

---

## 当前主线 D：日记功能重建（DIARY_REBUILD_PLAN）

Status: 主链路可用，剩余增强项

- [ ] V3：MoodEnergyTimeline（补时间轴结构）
- [ ] D5（剩余）：历史趋势补 mood key 跨日分布
- [ ] V5（可选）：TodoCompletionCard 组件化视觉升级
- [ ] A7（低优先）：`getDateRange` title 多语言写入 reports

---

## 早期遗留（需决策或补收口）

- [ ] `user_metadata` 并发写策略统一（避免与 `long_term_profile_enabled/login_days/lateral_association_state_v1` 互相覆盖）
- [ ] User Profile：关闭长期画像后的数据治理与清除交互细节
- [ ] 低叙事密度能力（Doc1/P1）的线上 DoD 验收与 2 周运营复盘尚未完成

---

## 近期完成（仅保留 2 条）

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
