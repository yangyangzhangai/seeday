# CURRENT TASK (Session Resume Anchor)

Last Updated: 2026-05-01
Owner: current working session

Session Notes:

- 2026-05-05: 日记长度与 Agnes 输出结构收口：`/api/diary` 新增长度最高优先规则（随语言限制正文长度）并在服务端增加超长兜底裁剪（保留落款）；Agnes 三语 diary prompt 删除“正文后【】小标题板块”要求，改为单段正文；Report 日记观察区补滚动兜底避免长文被裁切
- 2026-05-05: Magic Pen 时间冲突规则回调：允许与已完成活动重叠写入（交给 `insertActivity` 自动切分），禁止与进行中活动重叠；batch 内重叠仅标记后一条，修复“与其他条目时间重叠”导致频繁写入失败
- 2026-05-04: 日记生成提示文案修正（三语）：修复“生成日记”流程误复用 `plant_generate_already/plant_generate_success` 导致出现“今日植物已生成”；新增 `report_generate_already/report_generate_success` 并同步 ZH/EN/IT，中文已按产品文案更新为“日记已经生成，去日记本里看看吧~”
- 2026-05-01: 日记展示与摘要修复：保留 AI 日记原始换行（修复【】小标题前换行丢失）、优化 `/api/diary` 落款识别避免 Van 双落款、`generateMoodSummary` 增加总时长为 0 兜底避免 `NaN%`
- 2026-05-01: 植物卡片下载导出修复：保存图片改为使用 front export 专用节点（移除“轻点翻转”提示文案、增加底部留白），修复导出图最底行文案被遮挡问题；UI 端保留翻转提示
- 2026-05-01: 帮助与支持底部灰字文案更新（三语）：改为“如需支持请发邮件至 …”；移除邮箱下划线样式；FAQ“取消订阅”改为双入口（App Store 头像→订阅 / 设置→姓名→订阅）
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
- 2026-05-01: iOS Review（ASR/NR）Round 1.6：补审 `4.5.4`（Push 合规）与 `5.1.2`（数据使用/共享）；确认通知权限非主功能强依赖且权限请求由用户触发，新增提审前人工核对项（ASC 隐私标签与第三方共享披露一致性）
- 2026-05-01: iOS Review（ASR/NR）交接基线更新：`docs/IOS_REVIEW_ASR_NR_AUDIT_SPEC.md` 新增“当前风险状态 + 下个会话接手清单”；明确优先收敛 `R-ASR-005`（`isInspectable` 发布包默认开启）
- 2026-05-01: iOS Review（ASR/NR）Round 1.7：完成 `R-ASR-005` 修复，`ios/App/App/AppDelegate.swift` 中 `webView.isInspectable` 改为仅 DEBUG 开启，发布包默认关闭；主台账 `2.5.1` 结论同步更新为符合
- 2026-05-01: iOS Review（ASR/NR）Round 1.8：继续收敛 `R-ASR-007`，`api/subscription.ts` 新增 `SUBSCRIPTION_VERBOSE_LOGS` 开关并收口详细 IAP/server `console.log`，生产默认关闭详细轨迹日志
- 2026-05-01: iOS Review（ASR/NR）Round 1.9：完成剩余 `ASR & NR` 条款逐条代码审计（清单待审 0）；新增 28 条审计结论与证据路径，提审前人工核对项聚焦 ASC 分类/年龄分级/隐私标签/开发者身份一致性；代码侧剩余风险继续聚焦 `R-ASR-007`（生产日志收口）
- 2026-05-01: iOS Review（ASR/NR）R-ASR-007 前端日志进一步收口：移除非必要前端 `console.log`（chat/magic-pen/store/parser/api-client debug 等），当前 `src/**` 仅保留 server 路径日志待继续复核
- 2026-05-01: iOS Review（ASR/NR）R-ASR-007 server 日志继续收口：移除 `src/server/annotation-handler.ts`、`src/server/annotation-handler-utils.ts`、`src/server/todo-decompose-service.ts` 非必要 `console.log`；当前 `src/**` 已无 `console.log` 残留
- 2026-05-01: iOS Review（ASR/NR）R-ASR-007 持续收口：前端 `useChatStore/useTodoStore` 将生产路径 `console.error` 与 `catch(console.error)` 改为 DEV-only；服务端 `api/report.ts`、`api/classify.ts`、`api/diary.ts`、`api/magic-pen-parse.ts` 错误日志改为结构化摘要（长度/状态码），不再输出原始文本预览
- 2026-05-01: iOS Review（ASR/NR）R-ASR-007 Round 1.12：继续收口前端 store 日志，将 `reportActions`、`authStoreRuntimeHelpers`、`useReportStore`、`useAnnotationStore`、`useStardustStore`、`authDataSyncHelpers`、`authPreferenceHelpers` 的生产路径 `console.warn/error` 改为 DEV-only，减少用户端可见错误对象
- 2026-05-01: iOS Review（ASR/NR）Round 1.13：`src/App.tsx` 路由切换为 `HashRouter`（Capacitor 场景稳定性）；`src/components/feedback/ErrorBoundary.tsx` 日志改为 DEV-only；`api/subscription.ts` 增加生产环境 `APPLE_IAP_VERIFY_BYPASS=true` 的硬阻断
- 2026-05-01: iOS 本地持久化最小迁移（第一批关键项）：新增 `src/services/native/storageService.ts`（native 使用 `@capacitor/preferences`，web 保持 localStorage，并自动迁移 legacy key）；`src/api/supabase.ts` auth session 存储改走统一适配器；`src/services/reminder/reminderScheduler.ts` 关键调度键（`freeDay_*` / `reminder_scheduled_date` / `reminder_today_count`）改走统一持久化适配器
- 2026-05-02: iCloud Sync 审计修复（F1-F4）：偏好设置改走 outbox（`preference.upsert`）消灭内存队列崩溃丢失；`useNetworkSync` 新增 `visibilitychange` 触发 `refreshSession` 跨设备同步偏好；`reminderScheduler` 调度键从 Preferences 迁移至 localStorage（WebKit 层，已排除 iCloud 备份）；`isMultiAccountIsolationV2Enabled` 改为默认启用防账户数据泄露
- 2026-05-01: iOS Review（ASR/NR）Round 1.14：通知 action 文案改走 i18n（中/英/意）；`NSUserNotificationsUsageDescription` 改为本地化 `InfoPlist.strings`（`en/it/zh-Hans`）并将 Info.plist 默认文案改为英文基线
- 2026-05-01: 隐私政策补齐供应商披露：设置页中文隐私政策更新 AI 供应商名单（OpenAI/DeepSeek/Qwen/智谱/Gemini）并按 iOS 提审口径仅保留 IAP，不写 Stripe；新增提审填写模板 `docs/ASC_SUBMISSION_CODE_BASED_FILL_TEMPLATE.md` 供 ASC 后台对照
- 2026-05-01: Report 链路下线收口：`/api/report` 移除 Chutes 外部调用与 `CHUTES_API_KEY` 读取，改为占位返回；同步清理 `CHUTES_API_KEY` 文档/配置残留
- 2026-05-01: Report 功能整体下线：删除 `api/report.ts` API 端点 + 前端 `runReportAIAnalysis` + `triggerAIAnalysis` action + `callReportAPI` 及类型定义；Report 基础功能（日报/月报生成、Diary 日记、AI日记）不受影响
- 2026-05-02: 偏好 outbox 收口：`preference.upsert` 入队改为同类去重（仅保留最后一条快照），并在 `queuePreferenceSnapshot` 后立即触发一次非阻塞 `outbox.flush()`，减少队列冗余与跨设备偏好生效延迟

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
