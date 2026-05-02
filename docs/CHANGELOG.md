# Changelog

All notable effective changes are documented here.

> Note: 仅保留近期变更；更早且已收口记录已归档清理，避免维护噪音。

## 2026-05-02

### Fix: iCloud Sync 审计修复（Apple SynchronizingAppPreferencesWithICloud 规范对齐）

- **F1 — 偏好设置持久化**：`src/store/authPreferenceHelpers.ts` 移除模块级内存队列 (`queuedPreferenceSnapshot` / `flushQueuedPreferences`)，改为调用 `useOutboxStore.enqueue({ kind: 'preference.upsert', ... })`；`src/store/useOutboxStore.ts` 新增 `PreferenceUpsertOutboxEntry` 类型与 `executePreferenceUpsertEntry` 执行器（动态 import `authMetadataQueue`），纳入统一 outbox retry/cooldown 机制
- **F2 — 前台元数据刷新**：`src/hooks/useNetworkSync.ts` 新增 `visibilitychange` 监听，应用从后台切换至前台时触发 `supabase.auth.refreshSession()`，通过现有 `onAuthStateChange → TOKEN_REFRESHED` 链路将其他设备最新偏好同步写入本地 auth store
- **F3/F5 — 调度器 localStorage 迁移**：`src/services/reminder/reminderScheduler.ts` 将全部 `getPersistentItem`/`setPersistentItem`/`removePersistentItem` 调用改为 `localStorage.getItem/setItem/removeItem`，移除 storageService 依赖；调度器运维键（`freeDay_*` / `reminder_scheduled_date` / `reminder_today_count`）均已通过 `getScopedClientStorageKey` 按用户隔离，存入 WebKit 层（已配置排除 iCloud 备份）
- **F4 — 多账户隔离 V2 默认开启**：`src/store/storageScope.ts` `isMultiAccountIsolationV2Enabled()` 逻辑反转为默认启用，仅当 `VITE_MULTI_ACCOUNT_ISOLATION_V2=0|false|off` 时关闭；防止账户切换时 V1 key 泄露其他用户数据

Validation:
- `npx tsc --noEmit` → 通过（无类型错误）
- `npm run lint:all` → 通过（secrets / max-lines / docs-sync / tsc 全部通过）

## 2026-05-01

### Fix: Van 日记格式与情绪摘要 NaN 修复

- `src/features/report/ReportDetailModal.tsx`：移除观察日记文案的全局空白折叠（`replace(/\s+/g, ' ')`），保留 AI 输出原始换行，修复 `【】` 小标题前空行被吞掉导致整段粘连
- `api/diary.ts`：增强落款识别规则，新增“`Van ——` / `Agnes ——`”等尾部签名形态检测，避免模型已落款时再次追加 fallback 造成双落款
- `src/store/reportHelpers.ts`：`generateMoodSummary(...)` 增加 `totalMinutes <= 0` 兜底，避免情绪占比文案出现 `NaN%`

Validation:

- Not run (targeted formatting + summary guard fix)

### Fix: 植物卡片下载图遮挡修复（移除导出“轻点翻转”）

- `src/features/report/plant/PlantFlipCard.tsx`：下载正面卡片改为抓取 export-only 节点，不再复用交互态 UI 节点
- export-only 正面节点移除 `plant_tap_to_flip` 提示文案，避免“轻点翻转”进入下载图
- export-only 正面节点底部留白从交互态分离并加大，修复下载图最底行文案被遮挡/压线
- `html2canvas` 增加 `useCORS: true`，降低图片导出在 iOS/WebView 场景下的偶发渲染差异

Validation:

- Not run (targeted UI export fix)

### Copy: 帮助与支持文案更新（取消订阅路径 + 联系支持表达）

- `src/i18n/locales/zh.ts`、`src/i18n/locales/en.ts`、`src/i18n/locales/it.ts`：
  - `help_a9` 统一为双入口说明：`App Store（头像→订阅）` 或 `iPhone 设置（姓名→订阅）`
  - `help_contact_desc` 统一改为“如需支持请发邮件至”语义，避免仅“联系我们：”的生硬表达
- `src/features/profile/components/HelpSupportPanel.tsx`：移除支持邮箱链接下划线样式，保留 `mailto:` 点击能力与底部灰字展示

Validation:

- Not run (copy/style update only)

### Docs+Copy: 隐私政策供应商披露补齐 + ASC 提审填写模板

- `src/i18n/locales/zh.ts`：更新设置页隐私政策中文文案
  - `privacy_updated` 更新为 `2026 年 5 月 1 日`
  - `privacy_s3_body` 补齐 AI 供应商名单：OpenAI、DeepSeek、Qwen、智谱 AI、Google Gemini
  - `privacy_s4_body` 补齐第三方服务披露：Open-Meteo（天气+空气质量）并与 AI 供应商列表对齐
- 新增 `docs/ASC_SUBMISSION_CODE_BASED_FILL_TEMPLATE.md`：基于当前代码的 App Store Connect 提审填写模板（供应商、数据类型、用途、人工核对项）
- `docs/CURRENT_TASK.md`：同步会话锚点与本轮隐私披露更新记录

### Fix+Docs: Report 功能整体下线（前端链路 + API 端点）

- 删除 `api/report.ts`（Vercel Serverless endpoint）
- 删除前端调用：
  - `src/store/reportActions.ts`：`runReportAIAnalysis` 函数（调用 `/api/report`）
  - `src/store/useReportStore.ts`：`triggerAIAnalysis` action
  - `src/api/client.ts`：`callReportAPI` + `ReportRequest/ReportResponse` 类型
  - `src/features/profile/components/HelpSupportPanel.tsx`：`help_q10` 等 report 相关 FAQ 文案待后续清理
- 遗留：Report 基础功能（日报/月报生成、Diary 日记、AI日记）不受影响，仍正常使用 Supabase + `/api/diary`
- 关联清理：同步移除隐私政策中的 Chutes 表述（已在上一轮完成）

Validation:

- `npx tsc --noEmit` ✅

### Fix+Docs: 下线 Report 外部模型链路并清理 Chutes 残留

- `api/report.ts`：移除 `CHUTES_API_KEY` 读取与 `llm.chutes.ai` 外部请求链路，改为占位返回（生产简版、非生产附带 debug context）
- `src/types/annotation.ts`：删除未使用的 `Chutes*` 类型定义
- 配置与文档清理：`.env`、`.env.example`、`README.md`、`DEPLOY.md`、`docs/PROJECT_MAP.md`、`docs/ARCHITECTURE.md`、`PROJECT_CONTEXT.md`、`docs/SEEDAY_DEV_SPEC.md`、`docs/AI_USAGE_INVENTORY.md`、`api/README.md`、`docs/COMPLIANCE_AND_REVIEW_PLAN.md`、`LLM.md`、`CLAUDE.md` 去除 `CHUTES_API_KEY`/Chutes 相关表述
- `src/i18n/locales/zh.ts`、`docs/ASC_SUBMISSION_CODE_BASED_FILL_TEMPLATE.md`：同步移除 Chutes 供应商表述；隐私文案维持 iOS 提审口径（不写 Stripe）

Validation:

- Not run (copy/docs update only)

### Fix: iOS 关键本地缓存最小迁移（Auth Session + Reminder Scheduler）

- 新增 `src/services/native/storageService.ts`：统一持久化适配层（native: `@capacitor/preferences`，web: `localStorage`），并在 native 路径对同名 legacy localStorage key 做一次性迁移
- `src/api/supabase.ts`：Supabase Auth `storage` 改为统一适配器，避免 iOS WKWebView 下会话仅依赖 localStorage
- `src/services/reminder/reminderScheduler.ts`：`freeDay_<date>`、`reminder_scheduled_date`、`reminder_today_count` 改为通过统一适配层读写，降低调度状态在 iOS 被回收后的丢失风险
- `package.json` / `package-lock.json`：新增 `@capacitor/preferences@^7.0.0`

Validation:

- `npx tsc --noEmit` ✅

### Fix: 提审高风险项收口（Router/IAP/ErrorBoundary）

- `src/App.tsx`：将 `BrowserRouter` 切换为 `HashRouter`，降低 Capacitor 套壳深链/刷新边缘异常风险
- `api/subscription.ts`：新增生产环境防呆；当 `APPLE_IAP_VERIFY_BYPASS=true` 且 `NODE_ENV/VERCEL_ENV` 为 production 时直接抛错阻断，避免误绕过 Apple 校验
- `src/components/feedback/ErrorBoundary.tsx`：错误日志改为 DEV-only，避免生产设备暴露原始异常对象
- `src/services/notifications/localNotificationService.ts`：通知操作按钮文案改为 i18n key（中/英/意），移除中文硬编码
- `src/i18n/locales/en.ts`、`src/i18n/locales/zh.ts`、`src/i18n/locales/it.ts`：补充通知 action 文案翻译键
- `ios/App/App/Info.plist` + `ios/App/App/{en,it,zh-Hans}.lproj/InfoPlist.strings`：通知权限说明改为本地化资源，默认文案改为英文基线

Validation:

- Not run (targeted risk fixes + docs sync)

### Fix: 前端 store 生产日志进一步收口（R-ASR-007 Round 1.12）

- `src/store/reportActions.ts`、`src/store/authStoreRuntimeHelpers.ts`、`src/store/useReportStore.ts`：生产路径 `console.warn/error` 改为 DEV-only
- `src/store/useAnnotationStore.ts`、`src/store/useStardustStore.ts`、`src/store/authDataSyncHelpers.ts`、`src/store/authPreferenceHelpers.ts`：生产路径 `console.warn/error` 改为 DEV-only，避免在用户设备暴露错误对象细节

Validation:

- `npm run lint:all` ✅

### Fix: 生产日志最小化（R-ASR-007 Round 1.11）

- 前端日志收口：`src/store/useChatStore.ts`、`src/store/useTodoStore.ts` 将生产路径 `console.error` 与 `catch(console.error)` 改为 DEV-only，避免用户设备暴露运行时错误对象
- 服务端日志脱敏：`api/report.ts`、`api/classify.ts`、`api/diary.ts`、`api/magic-pen-parse.ts` 错误日志改为结构化摘要（`status` / `statusText` / `errorLength`），移除原始文本预览
- 文档回填：`docs/APP_REVIEW_ASR_NR_AUDIT_TRACKER.md` 新增 Round 1.11 审计记录，`docs/CURRENT_TASK.md` 同步会话锚点

Validation:

- `npm run lint:all` ✅

### Fix: 清理前端非必要日志（R-ASR-007）

- 移除前端主链路非必要 `console.log`：`src/features/chat/chatPageActions.ts`、`src/services/input/magicPenParser.ts`、`src/store/useAuthStore.ts`、`src/store/annotationHelpers.ts`、`src/store/useAnnotationStore.ts`、`src/store/authDataSyncHelpers.ts`、`src/store/useChatStore.ts`、`src/store/useReportStore.ts`、`src/store/reportActions.ts`、`src/store/useStardustStore.ts`、`src/lib/aiParser.ts`、`src/lib/imageCompressor.ts`、`src/services/timing/timingSessionService.ts`
- `src/api/client.ts`：前端 debug logger 改为空实现，不再输出 request/response `console.log`
- `src/store/storageScope.ts`：保留 DEV 分支但移除具体输出，避免前端运行时日志噪音
- server 侧继续收口：`src/server/annotation-handler.ts`、`src/server/annotation-handler-utils.ts`、`src/server/todo-decompose-service.ts` 删除非必要 `console.log`（保留 `console.warn/error` 诊断）

Validation:

- `npx tsc --noEmit` ✅

### Docs: ASR/NR Round 1.9 全量条款补审完成（代码证据驱动）

- `docs/APP_REVIEW_ASR_NR_AUDIT_TRACKER.md`：补齐剩余 28 条 `ASR & NR` 条款逐条审计，进度更新为 52/52（待审 0）；新增 Round 1.9 结论、风险与证据路径
- `docs/APP_REVIEW_ASR_NR_AUDIT_TRACKER.md`：`ASR/NR 全量条款清单` 全部由“待审”更新为“已审（Round 1.9）”
- `docs/CURRENT_TASK.md`：回填 Round 1.9 会话锚点，明确提审前人工核对项与剩余代码风险聚焦 `R-ASR-007`

Validation:

- Not run (docs audit sync only)

### Fix: 收口订阅服务端详细日志（ASR/NR R-ASR-007）

- `api/subscription.ts`：新增 `SUBSCRIPTION_VERBOSE_LOGS` 开关；将 IAP 校验与订阅请求链路的详细 `console.log` 统一改为受控 debug 日志，生产默认不输出详细轨迹
- `docs/APP_REVIEW_ASR_NR_AUDIT_TRACKER.md`：`R-ASR-007` 更新为“修复中（server 侧继续收口）”，补充 Round 1.8 进展与证据
- `docs/CURRENT_TASK.md`：补充 Round 1.8 会话锚点

Validation:

- Not run (server logging policy + docs update)

### Fix: 收口 WKWebView `isInspectable` 发布配置（ASR/NR R-ASR-005）

- `ios/App/App/AppDelegate.swift`：将 `webView.isInspectable = true` 改为仅在 `#if DEBUG` 条件下开启，确保发布包默认关闭
- `docs/APP_REVIEW_ASR_NR_AUDIT_TRACKER.md`：`R-ASR-005` 标记为已修复；`2.5.1` 结论更新为符合并补充 Round 1.7 审核日志
- `docs/CURRENT_TASK.md`：新增 Round 1.7 会话记录，作为下一会话恢复锚点

Validation:

- Not run (iOS native config + docs update)

### Docs: iOS Review ASR/NR 交接基线补全

- `docs/IOS_REVIEW_ASR_NR_AUDIT_SPEC.md`：
  - 更新为 Round 1.6 handoff 版本
  - 新增「6.1 当前风险状态」：明确 `R-ASR-004/006` 已修复、`R-ASR-005` 未收敛、`R-ASR-007` 修复中
  - 新增「6.2 下一个会话接手清单」：约定下一位执行顺序与回填要求
- `docs/CURRENT_TASK.md`：新增交接锚点，指向 ASR/NR 规范文档中的接手清单

Validation:

- Not run (docs update only)

### Docs: ASR/NR 审计台账 Round 1.6 更新（代码证据口径）

- `docs/APP_REVIEW_ASR_NR_AUDIT_TRACKER.md`：
  - 审核进度更新为 28/52（待审 28）
  - 新增已审核条款：`4.5.4`（Push 规则）、`5.1.2`（数据使用/共享）
  - 回填代码证据：通知权限请求入口、提醒开关、隐私面板入口、API 访问边界
  - 新增提审前人工核对项：App Store Connect 隐私标签与第三方共享披露一致性
- `docs/CURRENT_TASK.md`：补充 Round 1.6 会话记录，作为后续会话恢复锚点

Validation:

- Not run (docs update only)

### Docs: 新增 ASR/NR 审计执行规范模板

- 新增 `docs/IOS_REVIEW_ASR_NR_AUDIT_SPEC.md`：
  - 明确以 `docs/ios review.txt` 作为 ASR/NR 规则基准
  - 固化代码证据驱动审计流程（条款抽取、逐条核验、风险分级、修复回填）
  - 提供可复用的轮次结论输出模板，便于新人接手与持续审计

Validation:

- Not run (docs only)

### Fix: 清理前端可见日志并统一 DEV 保护

- `src/store/useAuthStore.ts`：登出时日志改为 DEV-only
- `src/store/useReportStore.ts`：AI 日记完成日志改为 DEV-only
- `src/store/useAnnotationStore.ts`：批注触发/跳过/生成人设等前端日志改为 DEV-only
- `src/store/useStardustStore.ts`：珍藏重复与拉取数量日志改为 DEV-only
- `src/store/authDataSyncHelpers.ts`：本地数据同步成功日志改为 DEV-only
- `src/store/annotationHelpers.ts`：批注概率与冷却日志改为 DEV-only
- `src/lib/aiParser.ts`：提取策略与失败日志改为 DEV-only
- `docs/APP_REVIEW_ASR_NR_AUDIT_TRACKER.md`、`docs/CURRENT_TASK.md`：同步 Round 1.5 审计进展（`R-ASR-007` 更新为修复中）

Validation:

- Not run (frontend log gating + docs update)

### Fix: 删除账号文案统一为“立即删除” + 补齐 iOS 隐私清单

- `src/i18n/locales/{zh,en,it}.ts`：
  - 删除账号按钮文案统一为“立即删除”（`delete_account_button`）
  - 隐私政策数据留存口径统一改为“账号删除后立即永久删除”（`privacy_s5_body`）
- `ios/App/App/PrivacyInfo.xcprivacy`：新增 iOS 隐私清单（当前声明无追踪、无收集项，包含 `UserDefaults` 访问类别与 reason code）
- `ios/App/App.xcodeproj/project.pbxproj`：将 `PrivacyInfo.xcprivacy` 加入 App target 的 Resources
- `docs/APP_REVIEW_ASR_NR_AUDIT_TRACKER.md`、`docs/CURRENT_TASK.md`：同步 Round 1.4 审计状态，`R-ASR-006` 标记为已修复

Validation:

- Not run (copy + iOS manifest wiring)

### Fix: 移除 force onboarding 覆盖逻辑

- `src/App.tsx`：删除 `forceOnboarding=1`（query）与 `VITE_FORCE_ONBOARDING`（env）强制进入 onboarding 的全部分支，恢复为仅真实新用户进入 onboarding
- `docs/APP_REVIEW_ASR_NR_AUDIT_TRACKER.md`：将 `R-ASR-004` 更新为已修复，并记录 Round 1.3
- `docs/CURRENT_TASK.md`：补充本次修复记录

Validation:

- Not run (logic removal + docs update)

### Docs: ASR/NR 审计台账 Round 1.2 更新（代码证据口径）

- `docs/APP_REVIEW_ASR_NR_AUDIT_TRACKER.md`：
  - 审核进度更新为 26/52（待审 30）
  - 新增已审核条款：`2.4.2`、`2.5.3`、`2.5.4`、`2.5.6`、`2.5.9`、`2.5.11`、`2.5.12`、`2.5.13`、`2.5.16`、`2.5.17`、`2.5.18`
  - 回填已修复项：`2.1(a)`（Apple 登录占位 URI 已移除）、`5.1.1(v)`（删除账号改为直接硬删除链路）
  - 新增风险项：`R-ASR-004~007`（生产可触发 onboarding 覆盖开关、`isInspectable` 发布包开启、缺少 `PrivacyInfo.xcprivacy`、生产 `console.log`）
- `docs/CURRENT_TASK.md`：补充本轮审计结论与高风险待整改清单，作为会话恢复锚点

Validation:

- Not run (docs update only)

### Fix: 登录与新手引导登录使用统一吉祥物图片

- `src/features/auth/AuthPage.tsx`：将登录头部树苗图标从 `Sprout` 替换为图片资源 `/assets/auth-login-mascot.png`
- `src/features/onboarding/OnboardingFlow.tsx`：`StepAuth` 同步替换为同一图片资源，确保新用户/老用户登录界面一致

Validation:

- Not run (UI asset wiring only)

### Fix: 日记按钮“生成中”文案缩短并保留人设名

- `src/i18n/locales/zh.ts`：`report_generating` 改为 `{{companion}} 正在写日记...`，减少按钮占位宽度
- `src/i18n/locales/en.ts`：`report_generating` 改为 `{{companion}} is writing...`
- `src/i18n/locales/it.ts`：`report_generating` 改为 `{{companion}} sta scrivendo...`
- 影响范围：`ReportDetailModal` 与 `PlantFlipCard` 两处按钮继续复用同一 key，按当前人设显示 `Van/Agnes/Zep/Momo`

Validation:

- Not run (copy update only)

### Fix: 帮助与支持 FAQ 文案与真实交互对齐

- `src/i18n/locales/zh.ts`：将“AI 伴侣”统一为“AI 伙伴”；将“编辑/删除记录”改为分入口说明（消息点击删除、时间轴编辑活动时间与内容）；将“报告实时生成”改为“每日植物与今日日记 20:00 后可见/可生成”
- `src/features/profile/components/HelpSupportPanel.tsx`：Growth 分组新增 3 条 FAQ，补充“如何添加/编辑待办”“待办按钮作用（置顶/开始/专注/会员分步拆解）”“点击瓶子可查看打卡数据、生成待办、删除瓶子”
- `src/i18n/locales/en.ts`、`src/i18n/locales/it.ts`：补齐新增 FAQ keys（`help_q11~help_q13`）以保持三语 key 集一致
- `src/features/profile/components/HelpSupportPanel.tsx`：新增“联系我们”信息卡，显示支持邮箱并提供 `mailto:` 点击入口

Validation:

- Not run (copy update only)

### Fix: Onboarding 地区占位示例本地化并移除英文多余逗号感

- `src/i18n/locales/en.ts`：`onboarding2_routine_region_placeholder` 从 `e.g., Milan` 改为 `e.g. New York or London`，更贴近英文用户常见地区示例并去除 `e.g.` 后逗号
- `src/i18n/locales/it.ts`：`onboarding2_routine_region_placeholder` 从 `es. Roma` 改为 `es. Milano`

Validation:

- Not run (copy update only)

### Fix: 帮助与支持中文 FAQ 二次润色与去重

- `src/i18n/locales/zh.ts`：
  - `help_a1` 去除破折号，改为更连贯口语表述
  - `help_a4` 改为“点击消息卡片”可删除
  - `help_a11` 明确“可设置每天或每周重复”
  - `help_a12` 置顶文案改为“点击置顶按钮，可以把这一条待办置顶”
  - `help_a5` 去掉与瓶子问答重复的信息
- `src/features/profile/components/HelpSupportPanel.tsx`：Growth 分组移除“支持重复任务吗”与“瓶子里还可以做什么”两条显示项，避免重复

Validation:

- Not run (copy update only)

### Fix: 帮助与支持待办按钮文案定稿（分号节奏 + 分步完成 + 连续专注）

- `src/i18n/locales/zh.ts`：`help_a12` 调整为用户确认版本，统一使用分号连接动作说明，并将会员能力描述更新为“分步完成”+“点击闹钟开启按步骤连续专注模式”

Validation:

- Not run (copy update only)

### Fix: 帮助与支持“瓶子是什么”文案改为后续能力表达

- `src/i18n/locales/zh.ts`：`help_a5` 调整为单行文案，改为“后续将开放满瓶浇灌周报与月报植物能力，敬请期待”

Validation:

- Not run (copy update only)

### Fix: 帮助与支持三语文案对齐 + 联系方式降级为单行灰字

- `src/i18n/locales/en.ts`、`src/i18n/locales/it.ts`：FAQ 文案同步中文现状口径（AI 伙伴命名、消息卡片删除入口、20:00 可见规则、待办按钮说明、会员分步与连续专注）
- `src/i18n/locales/{zh,en,it}.ts`：联系文案改为仅“联系我们/Contact us/Contattaci + 邮箱”，移除“几个工作日回复”承诺
- `src/features/profile/components/HelpSupportPanel.tsx`：将联系方式从高显眼卡片改为底部一行灰色小字（含 `mailto:` 邮箱链接）

Validation:

- Not run (copy + style update)

### Fix: Onboarding 记录步骤 iOS 键盘弹出时输入区跟随上移

- `src/features/onboarding/components/StepJournal.tsx`：底部输入区容器新增 `padding-bottom: calc(env(safe-area-inset-bottom, 0px) + var(--keyboard-height, 0px))`，复用原生键盘高度变量，在 iOS 套壳键盘弹出时将输入框整体抬升，避免发送区被遮挡

Validation:

- Not run (UI behavior tweak; verify on iOS TestFlight)

### Fix: 日记按钮改为“当日仅一次”并在生成后置灰

- `src/features/report/plant/PlantRootSection.tsx`：植物翻卡“生成日记”入口增加统一可点击条件（20:00 后 + 当日未生成 + 非生成中），当日已生成时按钮置灰并阻止重复触发
- `src/features/report/plant/PlantFlipCard.tsx`：将“生成中”与“禁用”拆分为两个状态，避免禁用时误显示“生成中”文案
- `src/features/report/ReportDetailModal.tsx`：日记详情页现有“生成日记”按钮改为同一规则，20:00 前与已生成后均不可再次点击
- `src/store/useReportStore.ts`：`generateAIDiary` 增加幂等早退；已有 `aiAnalysis` 或 `teaserText` 时直接返回，防止重复生成

Validation:

- `npx tsc --noEmit` ✅

### Fix: 个人画像输入框提示文字字号下调至 10px

- `src/features/profile/components/UserProfilePanel.tsx`：为长期画像自由输入框新增 `placeholder:text-[10px]`，仅调整 placeholder 视觉字号，不影响已输入内容字号
- 补充：同一输入框实际输入文字字号同步下调为 `text-[10px]`

Validation:

- Not run (UI style tweak only)

## 2026-04-30

### Fix: 聊天编辑弹窗时间选择器支持 zh/en/it 日期显示

- `src/features/chat/EditInsertModal.tsx`：`datetime-local` 输入新增 `lang` 绑定，随 i18n 切换为 `zh-CN` / `en-US` / `it-IT`
- 增加 `normalizeUiLanguage(i18n.language)` 归一化，避免区域值导致英文回退

Validation:

- Not run (UI locale binding update)

### Fix: Apple 登录回调移除 placeholder URI

- `src/store/authStoreAccountActions.ts`：Apple OAuth 回调从硬编码 placeholder 改为 `resolveOAuthRedirectUrl()`
- 新增防御校验：空值或 placeholder 直接返回 `Invalid Apple OAuth redirect URI`

Validation:

- Not run (auth config + runtime guard update)

### Fix: 删除账号改为立即执行服务端硬删除

- `src/features/profile/components/DeleteAccountModal.tsx`：确认后直接调用 `callDeleteAccountAPI()`，不再仅标记 pending
- `src/store/useAuthStore.ts`：修复 pending 删除分支（未到期不清标记；到期失败保留重试）
- `src/i18n/locales/{zh,en,it}.ts`：删除账号文案改为“立即永久删除且不可恢复”

Validation:

- Not run (account deletion flow update)

### Fix: Magic Pen 活动重叠校验改为“允许 ongoing、拦截 ended”

- `src/services/input/magicPenDraftBuilder.ts`：移除 ongoing 冲突拦截；新增 ended 冲突拦截
- `src/store/magicPenActions.test.ts`、`src/services/input/magicPenDraftBuilder.test.ts`：同步回归覆盖

Validation:

- `npx vitest run src/store/magicPenActions.test.ts` ✅
- `npx vitest run src/services/input/magicPenDraftBuilder.test.ts` ⚠️（仓库既有时区断言问题）

## 2026-04-29

### Fix: 日记入口与当日实时统计恢复

- `src/features/report/ReportDetailModal.tsx`：恢复“生成日记”入口，20:00 前提示、20:00 后可生成
- `src/features/report/DiaryBookViewer.tsx`：放开今日日历页双击进入详情
- `src/features/report/plant/{PlantFlipCard,PlantRootSection}.tsx`：恢复“保存卡片 + 生成日记”双按钮
- 今日日记页统计改为实时口径：接入 `useTodoStore`、`useGrowthStore` 和 `computeDailyTodoStats(...)`

Validation:

- `npx tsc --noEmit` ✅

### Fix: Telemetry 默认时间窗口统一为 7 天

- `src/features/telemetry/*TelemetryPage.tsx`：默认 `days` 统一为 7
- `src/api/client.ts`：telemetry dashboard 默认参数统一改为 7

Validation:

- Not run (default-window update)

### Update: Telemetry 审计与看板注释补齐

- 新增审计报告：`docs/Telemetry_Audit_Report_2026-04-29.doc`
- `LiveInputTelemetryPage`、`UserAnalyticsDashboardPage`、`FeedbackTelemetryPage`、`AiAnnotationTelemetryPage` 补齐 PM 注释与解释文案
- `src/i18n/locales/{zh,en,it}.ts` 同步新增对应三语词条

Validation:

- Not run (report + dashboard copy update)

### Fix: 三语一致性与 Prompt 对齐收口

- `src/i18n/locales/{zh,en,it}.ts`：完成 key/占位符一致性巡检并修复差异
- `src/server/magic-pen-prompts.ts`、`api/diary.ts`：补齐 en/it prompt 与中文约束对齐
- `src/lib/aiCompanion/prompts/{van,agnes,zep,momo}.ts`：四人设日记 prompt 三语语义对齐
- `src/lib/aiCompanion.ts`：统一追加语言硬约束，覆盖 diary + annotation

Validation:

- `npx tsc --noEmit` ✅

### Fix: 会员分类与跨天补偿相关收口

- `api/classify.ts`：去除 matched_bottle 阈值提示，补上位-下位映射规则
- `src/hooks/useMidnightAutoGenerate.ts`：补登录后与前台恢复补偿，新增 warmup 与稀疏 stats 修复
- `src/features/onboarding/OnboardingFlow.tsx`：试用会员改为点击 CTA 后激活

Validation:

- `npx tsc --noEmit` ✅

### Fix: iOS 体验与稳定性收口

- `src/features/chat/EditInsertModal.tsx`：移动端弹窗改四角圆角浮层并补 safe-area 底部留缝
- `src/features/profile/components/RegionSettingsPanel.tsx`：地区保存后回填输入框（优先 `location_label`）
- `src/features/growth/SubTodoList.tsx`：子步骤长文案支持两行 + 点击查看全文

Validation:

- `npx tsc --noEmit` ✅
