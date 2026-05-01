# CURRENT TASK (Session Resume Anchor)

Last Updated: 2026-05-01
Owner: current working session

Session Notes:

- 2026-05-01: Onboarding StepJournal iOS 键盘抬升修复：输入区底部增加 `var(--keyboard-height)`，键盘弹出时输入框随之上移，避免被 WKWebView 键盘遮挡
- 2026-05-01: 日记按钮规则收口：沿用现有按钮，不新增入口；改为 20:00 后且当日未生成才可点，生成后按钮置灰不可再点（植物翻卡 + 日记详情双入口统一）
- 2026-05-01: Profile 长期画像输入框 placeholder 字号微调为 10px（`UserProfilePanel`）
- 2026-05-01: Profile 长期画像输入框内容字号同步微调为 10px（与 placeholder 一致）

---

## 当前主线 A：Growth 待办 × 瓶子 iOS 套壳稳定性（TODO_BOTTLE_IOS_P0）

Status: 实施中（高优先）

### 待完成（本线核心）

- [ ] **P0-1 复现与可观测增强**：补齐 toggle/delete/recur 结构化日志与 iOS 复现脚本

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

### 待完成

- [ ] 手测 50 条回归：Free 0 调用、Plus 50 调用

---

## 当前主线 B：存储系统 P1/P2 收口

Status: 实施中（剩余验收与文档收口）
规格文档：`docs/DATA_STORAGE_AUDIT_REPORT.md`

### DATA_STORAGE_P1

- [ ] **P1-1' / C-5** Outbox 失败 UI（底层 cooldown 已有，需最终验收闭环）

### DATA_STORAGE_P2

- [ ] P2-5.4 完成回归与监控验收后移除开关（或保留紧急回滚开关）

### 文档同步要求

- [ ] `src/store/README.md`：更新 scoped persist / hydrate 顺序 / owner 策略
- [ ] `docs/DATA_STORAGE_AUDIT_REPORT.md`：将历史风险改为已治理项并补迁移说明
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

- [ ] V3：MoodEnergyTimeline（补时间轴结构）
- [ ] D5（剩余）：历史趋势补 mood key 跨日分布
- [ ] V5（可选）：TodoCompletionCard 组件化视觉升级
- [ ] A7（低优先）：`getDateRange` title 多语言写入 reports

---

## 早期遗留（需决策或补收口）

- [ ] User Profile：关闭长期画像后的数据治理与清除交互细节
- [ ] 低叙事密度能力（Doc1/P1）的线上 DoD 验收与 2 周运营复盘

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
- 已完成历史细节统一查 `docs/CHANGELOG.md`。
