# Changelog

All notable effective changes are documented here.

> Note: 仅保留近期变更；更早且已收口记录已归档清理，避免维护噪音。

## 2026-05-01

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
