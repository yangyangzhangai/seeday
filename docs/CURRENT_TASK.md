# CURRENT TASK (Session Resume Anchor)

Last Updated: 2026-05-01
Owner: current working session

Session Notes:

- 2026-05-01: 日记生成按钮 loading 文案缩短并保留人设名（`report_generating` -> `{{companion}} 正在写日记...`），同步 EN/IT
- 2026-05-01: Onboarding StepJournal iOS 键盘抬升修复：输入区底部增加 `var(--keyboard-height)`，键盘弹出时输入框随之上移，避免被 WKWebView 键盘遮挡
- 2026-05-01: 日记按钮规则收口：沿用现有按钮，不新增入口；改为 20:00 后且当日未生成才可点，生成后按钮置灰不可再点（植物翻卡 + 日记详情双入口统一）
- 2026-05-01: Profile 长期画像输入框 placeholder 字号微调为 10px（`UserProfilePanel`）
- 2026-05-01: Profile 长期画像输入框内容字号同步微调为 10px（与 placeholder 一致）
- 2026-05-01: 帮助与支持 FAQ 文案校正：统一“AI 伙伴”称呼；补充编辑/删除分入口说明；补充待办操作、按钮说明、瓶子入口说明；明确每日植物与今日日记 20:00 后可见
- 2026-05-01: 帮助与支持新增“联系我们”展示：面板内直接显示支持邮箱，点击后通过 `mailto:` 打开邮件客户端
- 2026-05-01: Onboarding 地区占位示例按语言本地化：英文改为 `New York or London`，意大利语改为 `Milano`，并移除英文 `e.g.` 后的逗号样式
- 2026-05-01: 帮助与支持文案二次润色：去除生硬破折号、补“消息卡片”措辞、删除重复任务独立条目与瓶子重复问答入口、置顶按钮改为明确动作文案
- 2026-05-01: 帮助与支持待办按钮文案终稿：统一分号节奏，会员能力改为“分步完成”，补充“点击闹钟开启按步骤连续专注模式”
- 2026-05-01: 帮助与支持“瓶子是什么”文案更新为单行：调整为“后续将开放满瓶浇灌周报与月报植物能力，敬请期待”
- 2026-05-01: 帮助与支持三语对齐：英文/意大利文 FAQ 同步中文现状口径（AI 伙伴、消息卡片删除、20:00 规则、待办按钮与连续专注）；联系信息改为底部一行灰色小字，仅保留联系邮箱
- 2026-05-01: 登录页与新手引导登录步骤的树苗图标改为统一图片入口（`/assets/auth-login-mascot.png`），两处视觉保持一致
- 2026-05-01: iOS Review（ASR/NR）代码审计 Round 1.2 完成并回填主台账：新增 10 条已审条款（`2.4.2`、`2.5.3/2.5.4/2.5.6/2.5.9/2.5.11/2.5.12/2.5.13/2.5.16/2.5.17/2.5.18`）；确认 Apple 登录占位 URI 与删除账号主链路已修复；新增高风险项 `R-ASR-004~007`（`forceOnboarding` 生产可触发、`isInspectable` 生产开启、缺少 `PrivacyInfo.xcprivacy`、生产 `console.log`）
- 2026-05-01: iOS Review（ASR/NR）Round 1.3：按产品决策删除 `forceOnboarding` 全部覆盖逻辑（query/env），`R-ASR-004` 标记为已修复
- 2026-05-01: iOS Review（ASR/NR）Round 1.4：删除账号相关文案统一为“立即删除”（中/英/意），隐私政策数据留存口径同步改为“删除后立即永久删除”；新增 `ios/App/App/PrivacyInfo.xcprivacy` 并加入 iOS target resources，`R-ASR-006` 标记为已修复
- 2026-05-01: iOS Review（ASR/NR）Round 1.5：按产品决策暂不调整 `isInspectable`；已清理前端可见日志并统一 `import.meta.env.DEV` 保护（auth/report/annotation/stardust/sync/parser 等路径）

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
