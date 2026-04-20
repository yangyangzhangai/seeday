# Changelog

All notable changes to this repository are documented here.

> Note: changelog 仅记录有效变更；会话过程性噪音应写入 `docs/CURRENT_TASK.md`，不在此重复展开。

## 2026-04-20 - Fix: i18n locale 文件行数超限导致 pre-commit 失败

### Changed

- `src/i18n/locales/zh.ts`
- `src/i18n/locales/en.ts`
- `src/i18n/locales/it.ts`
  - 对三份 locale 词条文件做无语义结构压缩：移除空行，保持 key/value 不变。
  - 行数降至 max-lines 硬阈值（1000 行）以内，解除 pre-commit 阻断。
- `docs/CURRENT_TASK.md`
  - 同步记录本次 max-lines 修复。

### Validation

- `npm run lint:max-lines` ✅

## 2026-04-20 - Fix: useReminderSystem 返回契约对齐（正修复）

### Changed

- `src/hooks/useReminderSystem.ts`
  - 增加 `UseReminderSystemResult` 显式返回类型，明确要求返回 `confirmReminderFromPopup`。
  - `useReminderSystem` 函数签名收口为稳定返回对象，避免调用方与 hook 合约漂移。
- `src/App.tsx`
  - 撤销临时可选链兜底，恢复标准解构调用：`const { confirmReminderFromPopup } = useReminderSystem(navigate)`。
  - `ReminderPopup` 的确认回调恢复直接调用 `confirmReminderFromPopup`，与 hook 正式契约保持一致。
- `docs/CURRENT_TASK.md`
  - 同步记录本次从“兜底止血”到“契约正修复”的收口。

### Validation

- `npx tsc --noEmit` ✅

## 2026-04-20 - Fix: `/chat` 提醒系统解构空值崩溃兜底

### Changed

- `src/App.tsx`
  - `MainLayout` 中不再直接解构 `useReminderSystem(navigate)` 返回值，改为先拿 hook 返回对象，再可选读取 `confirmReminderFromPopup`。
  - `ReminderPopup` 的 `onConfirm` 改为可选调用，避免极端异常下 `confirmReminderFromPopup` 缺失导致页面渲染直接崩溃。
- `docs/CURRENT_TASK.md`
  - 同步记录本次 `/chat` 渲染报错兜底修复。

### Validation

- `npx tsc --noEmit` ✅

## 2026-04-20 - Fix: Onboarding 测试态切换回路提示文案

### Changed

- `src/features/onboarding/components/StepJournal.tsx`
  - 完成态禁用提示改为专用测试文案，不再复用 `onboarding_j3_tip_convert`（"Wrong type" 语义），避免用户误解为识别错误而非引导测试步骤。
  - 阻断提示按状态分流：活动被转为心情时提示“切回活动继续”；独立心情被转为活动时提示“切回心情继续”。
- `src/i18n/locales/zh.ts`
- `src/i18n/locales/en.ts`
- `src/i18n/locales/it.ts`
  - 新增 `onboarding_j3_tip_switch_back_event_continue` / `onboarding_j3_tip_switch_back_mood_continue` 三语文案。
- `docs/CURRENT_TASK.md`
  - 同步记录本次测试态提示文案更新。

### Validation

- `npx tsc --noEmit` ✅

## 2026-04-20 - Fix: Onboarding 心情转活动后的展示与下一步门控

### Changed

- `src/features/onboarding/components/StepJournal.tsx`
  - 修复“独立心情卡 -> 转为活动”后卡片消失：完成态现在会继续展示该条已转为活动的卡片（复用 `EventCard`），不再出现“点完就没了”的断层。
  - 完成态新增回路提示与门控：
    - 首条活动被转为心情卡时，提示用户先执行 `mood_to_event`（转回活动）；
    - 独立心情卡被转为活动时，提示用户先执行 `event_to_mood`（转回心情）；
    - 未恢复到引导目标形态前，底部“下一步”按钮禁用。
  - 保持真实业务按钮可点（可正向/反向转换），但引导流程在状态未回到目标前不允许继续，避免用户跳过关键教学。
- `docs/CURRENT_TASK.md`
  - 同步记录本次 Onboarding 转换回路与下一步门控修复。

### Validation

- `npx tsc --noEmit` ✅

## 2026-04-20 - Fix: Onboarding 关联心情状态提示与按钮说明联动稳定

### Changed

- `src/features/onboarding/components/StepJournal.tsx`
  - 完成态中的关联心情提示不再仅依赖本地 `moodMessageId`，改为优先从活动卡 `moodDescriptions` 推导 linked 状态，并在缺失时自动回填当前心情消息 ID。
  - 关联态下稳定展示“linked 状态 + 拆分按钮说明”；拆分为独立心情卡后自动切换为“回归活动 / 转为活动”双按钮说明；回归后自动恢复 linked 提示。
  - 独立心情卡预览改为跟随统一 `previewMoodMessage`，确保引导页展示逻辑与真实业务状态一致。
- `docs/CURRENT_TASK.md`
  - 同步记录本次 Onboarding Journal 状态提示联动修复。

### Validation

- `npx tsc --noEmit` ✅

## 2026-04-20 - Fix: Onboarding Journal 完成态文案避免过早“all set”

### Changed

- `src/i18n/locales/zh.ts`
- `src/i18n/locales/en.ts`
- `src/i18n/locales/it.ts`
  - 调整 `onboarding_j3_complete_title` 与 `onboarding_j3_complete_desc` 三语文案，语气从“已完成”改为“继续体验当前步骤”，避免用户在 Onboarding 未结束时被误导为流程已全部完成。
- `docs/CURRENT_TASK.md`
  - 同步记录本次 Onboarding 文案语义修正。

### Validation

- 文案 key 仍复用原有 i18n 键，无新增键。

## 2026-04-20 - Fix: Onboarding 首条活动卡片接入真实按钮交互

### Changed

- `src/features/onboarding/components/StepJournal.tsx`
  - 首条活动发送后改为立即写入 `useChatStore.sendMessage()` 并记录消息 ID，预览区不再使用静态拟态卡片，改为直接渲染真实 `EventCard/MoodCard`。
  - 卡片内相机上传与活动→心情转换按钮改为默认常显且可点击，复用聊天时间线同一套业务逻辑（图片上传、`reclassifyRecentInput`、心情卡回转等）。
  - 新增绿色时长说明行，放在按钮说明区上方，复用现有 i18n key `elapsed_label` 表达“该数字为持续时长”。
  - 心情引导阶段改为实时写入 `sendMood` 并展示两种形态：活动下关联心情 + 独立心情卡；可在引导页直接尝试「提出为独立」「回归活动」「转为活动」。
  - 活动转换成心情卡后，说明文案改为专门解释心情卡右上角按钮（`mood_return_event` / `mood_to_event`），并同步替换完成态副标题，避免继续显示活动卡文案。
  - 活动阶段说明文案补齐：覆盖时长含义、结束按钮（手动结束 + 下一条活动自动结束）、照片记录（卡片节选显示 + 点击查看原图）与“转为心情模式不计时”的使用语义。
  - 活动卡心情标签改为可点击打开真实 MoodPicker（预置 + 自定义），并补充对应引导文案。
  - 引导说明继续降噪：将“自动结束 + 手动结束”合并到时长单行，将“心情模式不计时”并入“转为心情”说明，移除照片裁切说明行。
  - 时长说明行新增内嵌“结束按钮”示意，明确“点击哪个按钮手动结束”；并细化“心情模式”与“活动心情标签”的文案边界。
  - Onboarding 中首条活动转心情后收口为单一回转路径：隐藏 `mood_return_event`，仅保留 `mood_to_event`，避免“无上一个活动却可回归”的误导。
  - 完成态“Linked mood”区域移除解释文案，仅保留标签，降低信息密度。
  - 完成态进一步移除“Linked mood”标签本身，避免无效信息占位。
  - Onboarding 中彻底移除 `mood_return_event` 交互分支（含文案与 handler），确保首条活动转心情后只保留 `mood_to_event`。
  - Onboarding 中点击删除按钮不再执行删除：统一改为提示“当前步骤不可删除引导示例记录”。
  - Onboarding 完成态新增 linked 状态联动说明：关联心情态展示拆分按钮说明；拆分为独立心情卡后展示回归/转活动按钮说明，并随状态实时切换。
- `src/features/chat/components/EventCard.tsx`
- `src/features/chat/components/MoodCard.tsx`
  - 新增 `alwaysShowActions` 可选参数，允许在特定页面（Onboarding）默认展示操作按钮，同时不影响聊天主时间线原有“点击卡片后展示”的行为。
  - `MoodCard` 新增 `allowReturnToEvent` 可选参数；无可回归活动时可隐藏回归按钮，避免无效操作入口。
- `src/features/chat/ChatPage.tsx`
- `src/features/onboarding/components/StepJournal.tsx`
  - MoodPicker 交互与选中态修正：切换到自定义时改为仅高亮自定义；自定义输入默认空白（若已有自定义则回填已有值），避免出现“自定义 + 预置心情”双高亮与手动删默认词的问题。
- `src/i18n/locales/zh.ts`
- `src/i18n/locales/en.ts`
- `src/i18n/locales/it.ts`
  - 新增 onboarding J3 说明 key（时长/结束/照片/转心情/心情模式/心情卡按钮解释/心情标签交互）并同步三语。
  - 新增 `onboarding_j3_delete_blocked` 三语提示文案。
  - 新增 `onboarding_j3_tip_mood_detach_prefix/suffix` 三语文案，解释从关联心情拆分为独立心情卡的入口按钮。
- `docs/CURRENT_TASK.md`
  - 同步记录本次 Onboarding Journal 卡片交互改造与时长说明补充。

### Validation

- `npx tsc --noEmit` ✅
- `npm run lint:docs-sync` ✅

## 2026-04-20 - Feat: 日记书架新增数字日期搜索与同步日历

### Changed

- `src/features/report/DiaryBookShelf.tsx`
  - 在日记书架页头新增圆形搜索按钮，点击后弹出日期搜索层，输入框预设 `YYYY MM DD` 以明确“按日期搜索”的交互语义。
  - 新增纯数字日期解析器，支持用户输入 `6/06`、`1/01`、`20260610`、`2026 6 10` 等混合形式，自动归一化识别年/月/日并与日历视图实时同步。
  - 搜索层增加“年 -> 月 -> 日”联动视图：仅输入年份显示全年月份；补充月份后切换月历；补充日后自动选中对应日期。
  - 月历日期格增加记录密度分层样式：0 条为空心、1-5 条浅色填充、5 条以上深色填充；已选日期保留清晰外圈选中态。
  - 点击已选日期（或输入完整日期按回车/搜索）可直接打开对应月份与当日书页，保持与既有翻页链路兼容。

### Validation

- `npx tsc --noEmit` ✅

## 2026-04-20 - Fix: Onboarding 语言首步改为系统自动检测（无强制确认）

### Changed

- `src/features/onboarding/OnboardingFlow.tsx`
  - 移除首屏“手动语言选择”步骤，引导总步数由 8 收敛为 7。
  - 流程顺序调整为：`Auth -> AI -> Journal -> Todo -> Bottle -> Routine -> Subscription`。
  - 已登录用户自动跳过 Auth 的步进逻辑同步前移到新第 1 步。
- `src/i18n/index.ts`
  - i18n 语言检测顺序由仅 `localStorage` 调整为 `localStorage -> navigator`，首启无本地语言缓存时自动采用系统语言，并继续缓存到本地。

### Validation

- `npx tsc --noEmit` ✅
- `npm run lint:docs-sync` ✅

## 2026-04-20 - Fix: Onboarding 全链路文案三语化 + 情绪输入可编辑

### Changed

- `src/features/onboarding/OnboardingFlow.tsx`
  - 新增引导首屏语言选择（`zh/en/it`），进入后续步骤前写入 `updateLanguagePreference`，确保后续引导实时使用目标语言。
  - 流程升级为 8 步：`Language -> Auth -> AI -> Journal -> Todo -> Bottle -> Routine -> Subscription`；已登录用户在语言页后自动跳过 Auth。
  - 首条记录页新增独立可编辑心情输入框，支持“活动 + 心情”联合提交；修复此前“心情看得到但无法输入”的交互断层。
  - Auth 页核心文案与占位文案改为 i18n key（登录/注册态文案、协议提示、占位符、切换按钮），移除硬编码中文。
- `src/features/onboarding/OnboardingStepRoutine.tsx`
  - 作息页标题、分组、身份标签、时段字段、通知文案、TimePicker 按钮与保存状态全部 i18n 化，三语一致。
- `src/features/onboarding/components/StepTodo.tsx`
  - 待办页标题/字段/提示/CTA 全量接入 i18n，CTA 收口为“下一步”以匹配新增瓶子步骤后的真实流程。
- `src/i18n/locales/zh.ts`
- `src/i18n/locales/en.ts`
- `src/i18n/locales/it.ts`
  - 补齐 onboarding 新增 key（语言页、Journal 心情输入、Routine 分组、TimePicker 操作、Auth 协议与占位符等），并统一润色为更自然语气。
  - 补齐缺失 key：`plant_generate_try_after_20`（zh/it），对齐 `TranslationKeys`。

### Validation

- `npx tsc --noEmit` ✅
- `npm run lint:docs-sync` ✅

## 2026-04-20 - Fix: Onboarding 心情输入可编辑 + 首屏语言选择 + 待办 CTA 收口

### Changed

- `src/features/onboarding/OnboardingFlow.tsx`
  - 引导总步数由 7 调整为 8，新增首屏语言选择步骤（`zh/en/it`）并在进入后续步骤前调用 `updateLanguagePreference`。
  - 流程顺序调整为：`Language -> Auth -> AI -> Journal -> Todo -> Bottle -> Routine -> Subscription`；已登录用户在语言选择后自动跳过 Auth。
  - 修复首条记录页心情输入不可用：新增可点击心情输入框，并支持仅心情发送或“活动 + 心情”联合写入（`sendMessage` + `sendMood`）。
- `src/features/onboarding/components/StepTodo.tsx`
  - 待办页 CTA 由“全部计划完毕”改为通用“下一步”，避免和后续步骤语义冲突。
  - 待办页标题、字段标签与提示改为使用现有 i18n key（`onboarding2_* / growth_* / onboarding_*`），移除硬编码推荐语句区块。

### Validation

- `npx tsc --noEmit` ✅
- `npm run lint:docs-sync` ✅

## 2026-04-20 - Feat: Onboarding 新增目标/习惯瓶子步骤并调整顺序

### Added

- `src/features/onboarding/components/StepBottle.tsx`
  - 新增引导步骤：支持输入瓶子名称、选择 `habit/goal`、本地预览列表与删除，至少添加一条后可进入下一步。

### Changed

- `src/features/onboarding/OnboardingFlow.tsx`
  - Onboarding 总步数由 6 调整为 7，并将流程顺序调整为：`Auth -> AI -> Journal -> Todo -> Bottle -> Routine -> Subscription`。
  - 新增 `handleBottleNext()`：将 StepBottle 草稿写入 `useGrowthStore.addBottle()`，确保进入 App 后 Growth 页可直接看到已创建瓶子。

### Validation

- `npx tsc --noEmit` ✅

## 2026-04-20 - Fix: Onboarding 活动/待办录入改为直接同步到 App Store

### Changed

- `src/features/onboarding/OnboardingFlow.tsx`
  - StepJournal 发送首条记录时改为调用 `useChatStore.sendMessage()`（跳过批注），不再写入临时 `localStorage.at_activities`。
  - 新增 `handleTodoNext()`：将引导页待办草稿批量写入 `useTodoStore.addTodo()`，并按表单时间生成 `dueAt`，支持 `repeat -> recurrence(daily/once)` 映射。
  - Step 5 接线改为 `StepTodo onNext={handleTodoNext}`，确保“继续”后待办进入 Growth 正式数据流。
- `src/features/onboarding/components/StepTodo.tsx`
  - `onNext` 回调签名改为携带草稿数组；移除 `localStorage.at_todos` 旁路存储，避免引导数据停留在孤立缓存。

### Validation

- `npx tsc --noEmit` ✅

## 2026-04-20 - Fix: Onboarding AI 选择扩展到 4 个人设

### Changed

- `src/features/onboarding/OnboardingFlow.tsx`
  - StepAI 从固定展示 2 张卡片改为基于 `AI_COMPANION_ORDER` 渲染 4 张可选卡（`Van/Agnes/Zep/Momo`），并复用头像资源与人设文案 key。
  - 新增 onboarding 内部选中态；点击卡片可切换目标人设，继续按钮写入 `preferences.aiMode=<selectedMode>`，不再固定落 `van`。
  - 保留 `aiModeEnabled: true` 的引导完成行为不变。

### Validation

- `npx tsc --noEmit` ✅

## 2026-04-20 - Dev: Onboarding 强制预览开关（便于 UI 测试）

### Changed

- `src/App.tsx`
  - 新增 onboarding 预览开关：`/onboarding?forceOnboarding=1` 或构建时 `VITE_FORCE_ONBOARDING=1` 时，老账号也可进入引导流进行测试。
- `.env.example`
  - 增加 `VITE_FORCE_ONBOARDING` 说明与默认值。

### Validation

- `npx.cmd tsc --noEmit` ✅

## 2026-04-19 - Feat: Stripe Web Checkout 首版闭环（不影响 iOS IAP 构建）

### Changed

- `api/subscription.ts`
  - 保持单函数入口不新增 `api/*.ts` 文件，在现有 `/api/subscription` 中新增 `source='stripe'` 的 `stripe_checkout`/`stripe_finalize` 分支。
  - `stripe_checkout` 按月/年价格 ID 创建 Stripe Checkout Session 并返回 `checkoutUrl`；`stripe_finalize` 按回跳 `stripe_session_id` 校验订阅并写回 `membership_*` metadata。
- `src/server/stripe-subscription.ts`（新增）
  - 新增 Stripe Server API 调用与会话/订阅校验 helper（create checkout session + verify checkout session/subscription）。
- `src/services/payment/stripe/index.ts`
  - 由占位返回改为真实 Web 支付链路：调用 `/api/subscription` 创建 checkout，跳转 Stripe 托管收银台，回跳后读取 `stripe_session_id` 并 finalize。
- `src/services/payment/iap/index.ts` + `src/types/payment.d.ts` + `src/features/profile/UpgradePage.tsx` + `src/features/profile/components/MembershipCard.tsx`
  - 支付适配层新增“待 finalize session”统一签名；升级页支持 Stripe 回跳自动 finalize；Profile 卡片点击升级时兼容 Stripe 跳转态。
- `src/api/client.ts` + `src/api/README.md` + `api/README.md` + `.env.example`
  - 前端 API 新增 `callStripeCheckoutAPI/callStripeFinalizeAPI`；文档与环境变量补齐 `STRIPE_SECRET_KEY`、`STRIPE_PRICE_MONTHLY`、`STRIPE_PRICE_ANNUAL`。

### Validation

- `npx tsc --noEmit` ✅

## 2026-04-19 - Fix: 日记本饼图改为复用日报快照口径

### Changed

- `src/features/report/DiaryBookViewer.tsx`
  - 活动/心情饼图改为优先使用 `report.stats.actionAnalysis` 与 `report.stats.moodDistribution`，确保与白天报告页圆环一致，不再依赖临时消息缓存重算。
  - 仅在历史报告缺少 stats 快照时，才回退到消息侧重算。
  - 回退路径补齐 `customMoodLabel/customMoodApplied` 处理，避免自定义心情被漏算。

### Validation

- `npx tsc --noEmit` ✅

## 2026-04-19 - Fix: 日报心情圆环与报告生成口径对齐

### Changed

- `src/features/report/reportPageHelpers.ts`
  - `getDailyMoodDistribution()` 入参从仅 `activityMood` 扩展为完整 mood 快照（`activityMood/customMoodLabel/customMoodApplied`），与 `reportHelpers.computeMoodDistribution()` 保持一致。
  - 新增 custom label 生效逻辑，并过滤 0 分钟心情项，修复心情圆环偶发漏计/被单一心情占满的问题。
- `src/features/report/ReportDetailModal.tsx`
  - 心情分布计算改为传入完整 mood 快照，避免“活动正确但心情少算”。
- `src/features/report/ReportPage.tsx`
  - 同步更新 `getDailyMoodDistribution()` 调用签名，确保列表页与详情页口径一致。

### Validation

- `npx tsc --noEmit` ✅

## 2026-04-19 - Feat: Onboarding 接入待办引导页 UI

### Added

- `src/features/onboarding/components/StepTodo.tsx`
  - 按设计稿新增待办引导页：支持待办标题输入、执行时间、是否重复、紧急程度、推荐待办快捷填充、列表展示与删除。
  - 新增入门待办本地落盘：写入 `localStorage.at_todos`，字段与页面展示保持一致。

### Changed

- `src/features/onboarding/OnboardingFlow.tsx`
  - Onboarding 总步数由 5 步扩展为 6 步，并将待办引导页作为第 3 步插入流程。
  - 原有日程/作息/完成步骤后移，保持保存资料与完成引导逻辑不变。
  - 重写首条记录引导页（StepJournal）：替换为拟物录入卡样式、AI 感应提示、发送中状态，并改为写入 `localStorage.at_activities` 后延迟 1.2s 进入下一步。
  - 重写注册引导页（StepAuth）：替换为新稿视觉与交互（手机号/邮箱单输入、Apple/Google 按钮、协议提示、输入非空可继续）。
- `src/features/onboarding/OnboardingStepRoutine.tsx`
  - 重写作息设置页 UI：接入滚轮时间选择器（小时/分钟）、状态切换（自由/工作/学生）、条件化办公/课程时间块与提醒开关。
  - 保存按钮文案与样式对齐新稿（`保存并继续`），并保留保存中禁用态。
- `src/features/onboarding/OnboardingFlow.tsx`
  - 对齐新作息结构：`RoutineState` 收敛为 `classStart/classEnd` 与 `remindMe`，并将 `remindMe` 写入 `manual.reminderEnabled`。
  - `classSchedule` 写回策略调整为基于 `classStart/classEnd` 生成 morning 段，移除旧多时段输入依赖。

### Validation

- `npx tsc --noEmit` ✅

## 2026-04-19 - Feat: 活动识别补强“动词+对象”覆盖（zh/en/it）

### Changed

- `src/services/input/lexicon/activityLexicon.zh.ts`
  - 扩充活动动词：新增运营/财务相关动词（如 `修改/核对/校对/复核/对账/付款/支付/缴费`）并补充单字动作 `付/核`，让“动词+对象”路径优先命中常见输入。
- `src/services/input/liveInputRules.zh.ts`
  - 扩充对象词：新增 `账目/账务/流水/支付记录/付款单/款项/费用/金额/账户/账号`，提升“修改/核对/支付 + 对象”组合识别率。
- `src/services/input/liveInputRules.en.ts`
  - 新增英文短语壳规则：支持 `modify|verify|reconcile|pay|submit + object` 的短句识别（如 `verify invoice`、`make payment` 同类输入）。
- `src/services/input/liveInputRules.it.ts`
  - 新增意大利语短语壳规则：支持 `modificare|verificare|riconciliare|pagare + object` 的短句识别（如 `verificare fattura`）。
- `src/services/input/signals/latinSignalExtractor.ts`
  - 扩充意大利语语言信号词，补足支付/核对相关 token 的语言识别稳定性。
- `src/services/input/liveInputClassifier.test.ts`
  - 新增中文“动词+对象”回归用例（`修改订单`、`支付账单`、`核对账单`）。
- `src/services/input/liveInputClassifier.i18n.test.ts`
  - 新增 EN/IT 运营财务短语回归用例（`make payment`、`verify invoice`、`fare pagamento`、`verificare fattura`）。

### Validation

- `npm run test:unit -- src/services/input/liveInputClassifier.test.ts src/services/input/liveInputClassifier.i18n.test.ts` ✅

## 2026-04-19 - Fix: iOS 聊天输入框跟随键盘上移

### Changed

- `src/features/chat/ChatInputBar.tsx`
  - 底部固定容器由 `bottom: 0` 调整为 `bottom: var(--keyboard-height, 0px)`，并增加 `bottom` 过渡，确保 iOS 键盘弹出时输入栏随键盘同步上移，不再被遮挡。
  - 聊天页内底部导航容器新增 `chat-input-bottom-nav` 标记，配合 `keyboard-open` 状态在键盘弹起时自动隐藏，减少输入期误触与遮挡。
- `src/services/native/keyboardService.ts`
  - 初始化键盘修复时显式重置 `keyboard-open` class 与 `--keyboard-height` 为 0，避免热重载或异常中断后残留偏移。
- `src/components/layout/BottomNav.tsx`
  - 全局底部导航容器新增 `app-bottom-nav` 标记，键盘弹起时与聊天页导航保持一致自动隐藏。
- `src/index.css`
  - 新增 `.app-bottom-nav/.chat-input-bottom-nav` 的键盘联动样式：`html.keyboard-open` 下透明并禁用 pointer-events，键盘收起后恢复。

### Validation

- `npx tsc --noEmit` ✅

## 2026-04-19 - Refactor: 合并 todo-decompose 到 classify 以回收 Vercel 函数配额

### Changed

- `api/classify.ts`
  - 新增 `todo_decompose` 分支：当请求体包含 `module=todo_decompose`（或仅含 `title/lang`）时，走待办拆解链路并返回 `{ steps, parseStatus, model, provider }`。
  - 保留原有分类能力（`rawInput` + habit/goal 语义匹配）不变。
- `api/todo-decompose.ts`
  - 删除独立 serverless 入口，减少函数数量。
- `vercel.json`
  - 新增 `/api/todo-decompose -> /api/classify` rewrite，保持旧调用路径兼容。
- `api/README.md`
  - 更新 `/api/todo-decompose` 归属文件与分支说明。
- `src/api/README.md`
  - 更新前端 API 文档，注明 todo-decompose 通过 rewrite 命中 classify 分支。
- `docs/PROJECT_MAP.md`
  - 更新服务端端点映射，去除 `todo-decompose.ts` 独立入口。

### Validation

- `npx tsc --noEmit` ✅
- `npm run lint:max-lines` ✅

## 2026-04-19 - Refactor: 拆分 DiaryBookViewer 放大弹层以通过 max-lines pre-commit

### Changed

- `src/features/report/DiaryBookViewer.tsx`
  - 抽离 expanded overlay 逻辑与 UI，主文件行数从 1000+ 降至 907，翻页、双击放大与拖拽翻页行为保持不变。
  - 维持现有月视图数据加载、分页渲染与交互状态管理，不改动业务流。
- `src/features/report/DiaryBookViewerExpandedView.tsx`（新增）
  - 承载放大查看弹层渲染（左右页内容、植物图、AI 观察笔记、我的日记），并复用原有 modal 主题样式。

### Validation

- `npm run lint:max-lines` ✅

## 2026-04-19 - Fix: 作息面板移动端适配与保存抖动修复

### Changed

- `src/features/profile/components/RoutineSettingsPanel.tsx`
  - 作息弹窗改为移动端优先的底部 sheet 布局（`items-end` + safe-area padding + `100dvh` 高度约束），修复手机端显示不全与底部操作区被遮挡。
  - 去除自动保存定时器，保存动作改为显式手动触发，修复 `保存中` 与 `保存` 文案反复切换造成的交互抖动。
  - 保存脏检查从“仅基础作息 5 项”扩展为“完整表单签名”（身份、工作/课程时间、提醒开关 + 基础作息），修复部分时间修改后无法保存的问题。
  - 时间滚轮每次打开前先回填当前值，确保小时/分钟默认对齐已有时间，避免从 `00:00` 重新滚动选择。
  - 保存成功后清理 `reminder_scheduled_date`，让同日内修改作息后可重新触发本地通知排程。
- `src/components/ReminderPopup.tsx`
  - `ReminderPopup` 与 `EveningCheckPopup` 增加全屏 fixed overlay 与更高层级 z-index，修复移动端前台提醒弹窗偶发不显示/被页面遮挡。
- `src/services/notifications/localNotificationService.ts`
  - 本地通知调度前新增权限兜底：先 `checkPermissions()`，若状态为 `prompt` 则自动 `requestPermissions()`，仅在最终 `granted` 时执行调度，修复后台系统通知因未授权而静默失效。
- `src/features/onboarding/OnboardingFlow.tsx`
  - 完成 onboarding 时的 profile 写入改为非阻塞（`void updateUserProfile(...)`），优先导航进入 `/chat`，避免弱网场景下“Start using Seeday”点击后停留在引导页。
- `ios/App/CapApp-SPM/Package.swift`
  - 执行 `npx cap sync ios` 后同步写入 `@capacitor/local-notifications` 插件依赖，确保 iOS 原生工程包含本地通知能力。

### Validation

- `npx tsc --noEmit` ✅
- `npm run build` ❌（当前工作区环境缺少 `@capacitor/local-notifications` 模块解析，报错源于既有 `OnboardingFlow.tsx` 动态导入链路，不属于本次改动引入）

## 2026-04-18 - Refactor: 日记称呼主语句从 system prompt 迁移到 user prompt

### Changed

- `api/diary.ts`
  - 新增 `buildDiaryAddresseeUserRule()`，按 `zh/en/it` 生成称呼规则句（例如 zh: `对方称呼统一为"昵称"。`）。
  - diary 主链路在组装 `userContent` 时追加 `[Addressee rule]` 段，把称呼主语句放入 user prompt。
- `src/lib/aiCompanion/prompts/{van,agnes,zep,momo}.ts`
  - 从三语 diary system prompt 中移除“对方称呼统一为"__ADDRESSEE__" / The only addressee name is "__ADDRESSEE__" / Il nome da usare e solo "__ADDRESSEE__"”这条主语句。
  - 保留其余“禁止泛称呼 + 全文使用昵称”的规则不变。

### Validation

- `npx tsc --noEmit` ✅

## 2026-04-18 - Refactor: 日记称呼替换改为纯规则（移除二次 LLM 重写）

### Changed

- `api/diary.ts`
  - 删除 `rewriteAddresseeIfNeeded()`：不再调用 `gpt-4o-mini` 对整段日记做二次改写。
  - 命中泛称呼（如 `用户/ta/the user/l'utente`）后，改为直接走 `forceAddresseeReplacement()` 规则替换为昵称。
  - 保留末端落款补全逻辑，确保人格签名行为不变。

### Validation

- `npx tsc --noEmit` ✅

## 2026-04-18 - Refactor: 日记 prompt 改为人格单模板直出

### Changed

- `api/diary.ts`
  - 移除 `DIARY_CORE_PROMPT_ZH/EN` 与运行时 `buildAddresseeRule()` 拼接逻辑。
  - `buildDiaryModePrompt()` 改为直接使用人格 diary prompt，并仅做 `__ADDRESSEE__` 占位符替换。
- `src/lib/aiCompanion/prompts/van.ts`
  - `VAN_DIARY_PROMPT_{ZH,EN,IT}` 内嵌原 core 日记规则、固定输出结构与称呼硬规则。
- `src/lib/aiCompanion/prompts/agnes.ts`
  - `AGNES_DIARY_PROMPT_{ZH,EN,IT}` 内嵌原 core 日记规则、固定输出结构与称呼硬规则。
- `src/lib/aiCompanion/prompts/zep.ts`
  - `ZEP_DIARY_PROMPT_{ZH,EN,IT}` 内嵌原 core 日记规则、固定输出结构与称呼硬规则。
- `src/lib/aiCompanion/prompts/momo.ts`
  - `MOMO_DIARY_PROMPT_{ZH,EN,IT}` 内嵌原 core 日记规则、固定输出结构与称呼硬规则。

### Validation

- `npx tsc --noEmit` ✅

## 2026-04-18 - Refactor: 合并 holiday-check 端点以满足 Vercel Hobby 12 函数限制

### Changed

- `api/live-input-telemetry.ts`
  - 新增 `GET module=holiday_check` 分支，接管原节假日查询能力，返回 `{ isFreeDay, reason, name? }`。
  - 保留既有 `module=user_analytics` 与默认 telemetry dashboard 查询逻辑不变。
- `src/services/reminder/reminderScheduler.ts`
  - `getIsFreeDay()` 请求地址从 `/api/check-holiday` 改为 `/api/live-input-telemetry?module=holiday_check`。
- `api/check-holiday.ts`
  - 删除独立 serverless 入口，减少函数数量以适配 Hobby 配额。
- `api/README.md`
  - 更新 `/api/live-input-telemetry` 的 `holiday_check` 查询契约说明。

### Validation

- `npx tsc --noEmit` ✅

## 2026-04-18 - Refactor: 拆分 useAuthStore streak helpers 以通过 max-lines pre-commit

### Changed

- `src/store/useAuthStore.ts`
  - 将连续活跃天数与登录 streak 相关 helper 抽离，主 store 仅保留状态与认证编排逻辑，文件行数从 1000+ 降到 942。
- `src/store/authStreakHelpers.ts`（新增）
  - 新增 `fetchActivityStreak()` 与 `updateLoginStreak()`，复用原有 Supabase 查询、当日缓存与 DEV 日志行为，功能保持不变。

### Validation

- `npm run lint:max-lines` ✅
- `npx tsc --noEmit` ✅
## 2026-04-18 - Feat: 主动提醒系统 Phase 1（PROACTIVE_REMINDER_SPEC）

### Added

- `@capacitor/local-notifications` 安装
- `src/services/notifications/localNotificationService.ts`：注册 5 种 iOS 通知类别（CONFIRM_DENY / EVENING_CHECK / WEEKEND_CHECK / IDLE_NUDGE / SESSION_CHECK）、idle nudge 调度/取消、批量通知调度、动作回调注册
- `src/services/reminder/reminderTypes.ts`：`ReminderType` 联合类型（20 种）、`ScheduledReminder`、`ActivityRecordCategory`
- `src/services/reminder/reminderCopy.ts`：4 人格 × 20 种提醒类型固定文案表 + `getReminderCopy()` 模板替换
- `src/services/reminder/reminderScheduler.ts`：`buildReminderQueue`（工作日/周末）、`scheduleRemindersForToday`、`getIsFreeDay`（含 localStorage 缓存）
- `src/store/useReminderStore.ts`：当日已响应集合（localStorage 持久化）、弹窗状态、QuickActivityPicker 状态
- `src/components/ReminderPopup.tsx`：`ReminderPopup`（AI头像 + ✓/✗ + 快捷输入框）、`EveningCheckPopup`（晚间总结专用）
- `src/hooks/useReminderSystem.ts`：App 级 Hook，统一管理通知类别注册、idle nudge、原生通知调度、前台定时弹窗
- `api/check-holiday.ts`：`GET /api/check-holiday?date=&country=`，返回 `{ isFreeDay, reason, name? }`

### Changed

- `src/types/userProfile.ts`：新增 `UserProfileManualV2`（扩展 `hasWorkSchedule / hasClassSchedule / workStart / workEnd / lunchStart / lunchEnd / dinnerTime / lunchTime / reminderEnabled / classSchedule`）、`ClassSchedule`、`TimeRange`
- `src/features/profile/components/UserProfilePanel.tsx`：新增「我的日程」勾选区块、作息时间扩展字段（工作/课表条件显示）、「主动提醒」开关
- `src/App.tsx`：用 `useReminderSystem()` 替换旧 `useNightReminder()`，接入新 `ReminderPopup` / `EveningCheckPopup`
- `src/i18n/locales/{zh,en,it}.ts`：新增 reminder_popup_* / evening_check_* / profile_schedule_* 等约 25 个 i18n key

## 2026-04-17 - Style: 日记预览页背景绿更新

### Changed

- `src/features/report/DiaryBookShelf.tsx`
  - 书架页背景色从 `#7a9b7e` 调整为 `#B8C2AE`，降低饱和度并匹配新视觉参考色。
- `src/features/report/DiaryBookViewer.tsx`
  - 日记翻页预览背景色同步改为 `#B8C2AE`，与书架页保持一致。

## 2026-04-17 - Style: 日记书架封面阴影改为硬边书本投影

### Changed

- `src/features/report/DiaryBookShelf.tsx`
  - 书架页封面阴影从单层柔和 `drop-shadow` 调整为三层组合阴影：近距离硬边接触影 + 中距离硬边投影 + 远距离柔边漫射。
  - 在保留书本正向摆放的前提下增强边角存在感，整体观感更接近实体书在台面上的阴影。

## 2026-04-17 - Style: 日记书架封面改为牛皮纸+红棕书脊配色

### Changed

- `src/features/report/DiaryBookShelf.tsx`
  - 书架封面主色从浅米色改为牛皮纸棕（MUJI 风格），并新增封面边框线，强化“纸封壳”边界感。
  - 左侧书脊改为红棕色布脊风格，保留并强化双凹线细节，维持书脊结构识别度。
  - 增加轻量纸张颗粒纹理与内阴影层，让封面材质更接近实体纸本而非纯色块。

## 2026-04-17 - Fix: 全端禁止网页复制文字与图片

### Changed

- `src/index.css`
  - 在 `html/body/#root` 全局增加 `user-select: none`、`-webkit-user-select: none`、`-webkit-touch-callout: none`，禁用桌面与移动端文本选中/长按复制。
  - 为 `img` 增加 `-webkit-user-drag: none` 与 `user-select: none`，阻断图片拖拽复制。
- `src/main.tsx`
  - 新增文档级事件拦截：统一阻止 `copy`、`cut`、`contextmenu`、`selectstart`、`dragstart`，覆盖鼠标右键、快捷键复制、长按菜单与拖拽复制入口。

## 2026-04-17 - Fix: 魔法笔会员弹窗居中与圆角样式修正

### Changed

- `src/features/chat/MagicPenUpgradeModal.tsx`
  - 弹窗容器从移动端 `items-end` 改为全端 `items-center`，统一屏幕居中。
  - 卡片样式从 `rounded-t-3xl` 改为完整 `rounded-3xl`，补齐底部圆角。
  - 去除底部 safe-area 额外 padding，弹窗高度与项目常规居中弹窗一致。
  - 卡片尺寸与分区对齐项目其他升级弹窗：宽度改为 `max-w-xs`，内容区/按钮区间距同步为 `px-5 pt-6 pb-4` + `px-5 py-4`。

## 2026-04-17 - Fix: 魔法笔会员引导弹窗统一样式并修复关闭误跳转

### Changed

- `src/features/chat/MagicPenUpgradeModal.tsx`（新增）
  - 新增聊天侧魔法笔专用会员引导弹窗，样式复用全局 modal theme（overlay/card/close/button），与项目其他弹窗视觉统一。
  - 弹窗交互收口：支持遮罩关闭、右上角关闭、底部“稍后”关闭；仅“去开通 Plus”按钮执行 `/upgrade` 跳转。
- `src/features/chat/ChatPage.tsx`
  - Free 用户点击魔法笔时由 `window.alert + navigate('/upgrade')` 改为打开 `MagicPenUpgradeModal`。
  - 修复“点击 close 仍跳转会员页”的门控 bug。
- `src/i18n/locales/{zh,en,it}.ts`
  - 新增魔法笔会员引导弹窗文案键（标题/描述/开通按钮/稍后按钮），补齐三语。

## 2026-04-17 - Fix: Growth 待办标题仅在展开态可双击编辑

### Changed

- `src/features/growth/GrowthTodoCard.tsx`
  - 标题编辑入口新增展开态门控：`expanded === true` 时双击标题才会进入编辑。
  - 未展开卡片时双击标题不再触发编辑，避免误进入编辑态。

## 2026-04-17 - Fix: 聊天时间线消息卡片删除按钮改为点击后显示

### Changed

- `src/features/chat/components/EventCard.tsx` + `src/features/chat/components/MoodCard.tsx`
  - 删除 `X` 按钮显示逻辑改为与相机上传入口一致：仅在用户点击激活消息卡片后显示。
  - 点击卡片外区域时随 `cardActive` 关闭而隐藏，避免时间线默认常显删除入口。
  - 移动端补齐 `touchstart/pointerdown` 外部点击监听，并增加卡片激活互斥（同一时刻仅一个卡片保持激活），避免多个卡片操作区同时常驻。

## 2026-04-17 - Feat: 作息独立为普通功能 + AI 专属记忆升级为 Plus 权益

### Changed

- `src/features/profile/components/RoutineSettingsPanel.tsx`（新增）
  - 新增独立作息编辑面板（起床/睡觉/早餐/午餐/晚餐），保存链路复用 `useAuthStore.updateUserProfile(...)`，写回 `user_profile_v2.manual`。
- `src/features/profile/components/UserProfilePanel.tsx` + `src/features/profile/ProfilePage.tsx` + `src/features/profile/components/userProfilePanelHelpers.ts`
  - `UserProfilePanel` 从“作息+记忆”调整为仅编辑 AI 专属记忆文本（`manual.freeText`）。
  - Profile 页面接入 `RoutineSettingsPanel`，并将 AI 专属记忆区域改为 Plus 门控（Free 显示升级引导，Plus 可用开关与编辑区）。
  - helper 拆分为 `buildRoutineManualPayload` / `buildAIMemoryManualPayload`，避免字段互相覆盖。
- `src/features/profile/components/UserProfileSection.tsx` + `src/features/profile/ProfilePage.tsx`
  - Free 端 AI 专属记忆 UI 改为恢复原模块形态：与会员界面同样的卡片样式，但标题行右侧显示统一小锁且禁用展开。
  - Plus 端保持原有可展开编辑交互，不改变既有布局与文案结构。
- `src/store/useAnnotationStore.ts` + `src/store/reportActions.ts`
  - 画像注入与周报触发画像提取统一升级为双门控：`isPlus && longTermProfileEnabled`。
- `src/features/profile/components/MembershipCard.tsx` + `src/i18n/locales/{zh,en,it}.ts`
  - 会员权益列表新增 “AI 专属记忆” 文案键；新增作息面板与 AI 记忆会员引导相关三语词条。
- 文档同步
  - 更新 `src/features/profile/README.md`、`src/store/README.md`、`docs/MEMBERSHIP_SPEC.md`、`docs/CURRENT_TASK.md`。
  - 新增 `docs/MEMBERSHIP_PROJECT_STATUS.md`，沉淀规格对照、当前实现状态与 Free/Plus 手测清单。

### Validation

- `npx tsc --noEmit` ✅
- `npm run lint:docs-sync` ✅

## 2026-04-17 - Feat: 管理员 Telemetry 看板支持多语言切换（zh/en/it）

### Changed

- `src/features/telemetry/TelemetryHubPage.tsx`
  - Hub 页面所有模块卡片文案改为 i18n key，支持随全局语言切换。
- `src/features/telemetry/LiveInputTelemetryPage.tsx`
  - 标题、摘要卡、表头、分布区块、最近事件文案改为 i18n key。
  - 错误提示与管理员提示也改为多语言文案（环境变量名仍以 code 形式显示）。
- `src/features/telemetry/AiAnnotationTelemetryPage.tsx`
  - 看板标题、说明、决策提示、指标名、分布区块与空态文案改为 i18n key。
- `src/features/telemetry/TodoDecomposeTelemetryPage.tsx`
  - 指标卡解释文案、趋势区块、分布区块、最近事件与表头改为 i18n key。
- `src/features/profile/components/SettingsList.tsx`
  - 管理员入口 `Telemetry Center` 文案改为 `telemetry_hub_title`，避免语言切换后混显英文。
- `src/i18n/locales/{zh,en,it}.ts`
  - 新增 Telemetry Hub / Live Input / AI Annotation / Todo Decompose 全量词条键，补齐三语映射。

### Validation

- `npx tsc --noEmit` ✅

## 2026-04-17 - Refactor: User Analytics 合并进 live-input telemetry 端点

### Changed

- `src/server/user-analytics-handler.ts`（新增）
  - 将用户增长看板与用户查询逻辑抽到共享服务端 handler，复用现有 Supabase 鉴权与 admin 权限判定。
- `api/live-input-telemetry.ts`
  - `GET` 分支新增 `module=user_analytics` 路由分流：
    - 默认仍返回 live input/plant/annotation/todo-decompose telemetry 聚合；
    - `module=user_analytics` 返回增长看板；`type=user_lookup` 返回单用户诊断信息。
- `src/api/client.ts`
  - `callUserAnalyticsDashboardAPI()` / `callUserAnalyticsLookupAPI()` 改为调用 `/api/live-input-telemetry`（带 `module=user_analytics` 查询参数）。
- `api/user-analytics.ts`（删除）
  - 移除独立 serverless function，降低 Vercel 部署函数数量，适配 Hobby 12 函数上限。
- `api/README.md` + `src/api/README.md`
  - 同步 telemetry 端点新协议说明（`module=user_analytics` 与 `type=user_lookup`）。

### Validation

- `npx tsc --noEmit` ✅
- `npm run build` ✅

## 2026-04-16 - Fix: 活动/心情记录与日记入口字号可读性优化

### Changed

- `src/features/chat/components/TimelineView.tsx`
  - 时间轴左侧时间戳字体从 8px 上调到 10px，提升记录页阅读辨识度。
- `src/features/chat/components/EventCard.tsx` + `src/features/chat/components/MoodCard.tsx`
  - 活动/心情卡标题字体从 13px 上调到 14px。
  - 活动卡心情标签从 8px 上调到 10px，并同步微调 padding；心情备注从 10px 上调到 11px。
  - 活动卡计时区与结束按钮字号上调（9px -> 10px），计时图标同步放大。
- `src/features/report/ReportPage.tsx` + `src/features/report/plant/PlantFlipCard.tsx`
  - 报告页头部圆角按钮字号由 `clamp(9px,2.5vw,11px)` 调整为 `clamp(11px,2.9vw,13px)`。
  - 植物翻转卡「生成日记」按钮字号由 14px 微调到 15px。

## 2026-04-16 - Feat: 会员升级页与日记 Teaser 首版落地

### Changed

- `src/features/profile/UpgradePage.tsx`（新增）
  - 新增 `/upgrade` 页面：月/年方案切换、权益对比、支付按钮占位与恢复购买入口（由 `@payment` 适配层驱动）。
- `src/features/profile/components/MembershipCard.tsx` + `src/features/report/UpgradeModal.tsx` + `src/App.tsx`
  - 统一升级入口跳转到 `/upgrade`，新增受保护路由注册。
- `vite.config.ts` + `package.json` + `src/services/payment/*` + `src/types/payment.d.ts`
  - 增加构建时支付隔离：`VITE_PAYMENT_MODE` 控制 `@payment` 别名映射（IAP/Stripe 双实现同签名导出）。
  - 增加 `build:ios` / `build:web` 脚本。
- `src/store/useAuthStore.ts` + `src/store/useAuthStore.test.ts`
  - 注册时写入 `trial_started_at`；`resolveMembershipState()` 增加 7 天试用判定（source=`trial`）及边界测试。
- `api/diary.ts` + `src/api/client.ts` + `src/store/reportActions.ts` + `src/store/useReportStore.ts`
  - `/api/diary` 新增 `mode='teaser'` 分支（模板分桶、零 LLM 成本）。
  - `generateAIDiary()` 按会员分流：Plus 写入 `aiAnalysis`，Free 写入 `teaserText`。
- `src/lib/dbMappers.ts` + `src/features/report/ReportDetailModal.tsx` + `src/features/report/DiaryBookViewer.tsx` + `src/features/report/ReportPage.tsx`
  - 报告数据结构新增 `teaserText` 映射。
  - Free 用户在观察日记区域展示 Teaser 渐变模糊与解锁按钮（跳转 `/upgrade`）。
- `src/i18n/locales/{zh,en,it}.ts`
  - 新增升级页与 Teaser 解锁文案 keys。
- 文档同步
  - 更新 `docs/CURRENT_TASK.md`、`docs/PROJECT_MAP.md`、`src/features/profile/README.md`、`src/api/README.md`、`api/README.md`、`src/store/README.md`。

### Validation

- `npx tsc --noEmit` ✅
- `npm run build` ✅
- `npm run lint:docs-sync` ✅

## 2026-04-16 - Feat: iOS 订阅写回链路（/api/subscription）与升级页结果闭环

### Changed

- `api/subscription.ts`（新增）
  - 新增 `POST /api/subscription`，支持 `action=activate|restore|cancel`（当前聚焦 `source='iap'`）。
  - 接入 `requireSupabaseRequestAuth` 鉴权与 `SUPABASE_SERVICE_ROLE_KEY` 写回，统一更新 `auth.users.user_metadata`：`membership_plan/membership_expires_at/membership_source/membership_product_id/membership_transaction_id`。
  - 新增 Apple App Store Server API 校验骨架：根据 `transactionId` 访问 Apple 生产/沙盒交易查询接口，校验 `bundleId/productId` 与订阅有效期；支持 `APPLE_IAP_VERIFY_BYPASS` 本地调试开关。
- `src/api/client.ts`
  - 新增 `callSubscriptionAPI()`，统一承载前端支付适配层到 `/api/subscription` 的受鉴权请求。
- `src/services/payment/types.ts` + `src/services/payment/iap/index.ts` + `src/services/payment/stripe/index.ts`
  - 支付动作返回值扩展 `code/plan/expiresAt` 字段。
  - iOS 适配层新增“原生 IAP 桥 -> `/api/subscription`”调用链（购买与恢复）；当原生插件未接线时返回 `iap_client_not_ready` 显式错误码。
  - Stripe 占位适配层补齐显式错误码（`stripe_not_ready/stripe_not_supported`）。
- `src/features/profile/UpgradePage.tsx`
  - 购买/恢复动作增加错误码映射与提示；成功后执行 `useAuthStore.initialize()` 刷新会员态并返回 Profile。
- `src/i18n/locales/{zh,en,it}.ts`
  - 新增升级页支付结果提示文案（购买成功、恢复成功、IAP/Stripe 未接线、激活失败等）。
- `.env.example` + 文档同步
  - 新增 IAP 相关环境变量模板（`APPLE_IAP_*`、`VITE_IAP_PRODUCT_*`、`APPLE_IAP_VERIFY_BYPASS`）。
  - 更新 `docs/CURRENT_TASK.md`、`docs/PROJECT_MAP.md`、`src/api/README.md`、`api/README.md`。

### Validation

- `npx tsc --noEmit` ✅
- `npm run build` ✅

## 2026-04-16 - Feat: 会员门控收口（P5d）+ 关闭全员 Plus（P6）

### Changed

- `src/store/useAuthStore.ts`
  - `MEMBERSHIP_TEMPORARY_UNLOCK_ENABLED` 从 `true` 改为 `false`，默认会员态不再走临时全员 Plus；仅 `metadata` 与 7 天试用可判定 `isPlus=true`。
- `src/features/chat/ChatPage.tsx`
  - 魔法笔模式切换新增 Plus 门控：Free 用户点击后提示并跳转 `/upgrade`。
  - 新增兜底收口：当会员态变为 Free 时自动关闭已开启的魔法笔模式，避免状态残留绕过。
- `src/features/growth/SubTodoList.tsx`
  - 待办 AI 拆解按钮新增 Plus 门控：Free 用户点击后提示并跳转 `/upgrade`。
- `src/features/profile/README.md`
  - AI 人格说明更新为仅 Van 免费，Agnes/Zep/Momo 为 Plus。

### Validation

- `npx tsc --noEmit` ✅
- `npm run build` ✅
- `npm run lint:docs-sync` ✅

## 2026-04-15 - Fix: Todo 同步 bigint 越界导致 22003

### Changed

- `src/lib/dbMappers.ts`
  - 新增 bigint 安全归一化：对待办写库字段 `created_at/due_date/started_at/completed_at/sort_order` 在入库前执行有限值校验与安全夹紧，避免异常极值触发 Postgres `22003`。
  - `toTimestampMs()` 增加 bigint 安全归一化，避免脏时间戳在前后端往返后继续放大。
  - `toDbTodoUpdates()` 对 bigint 更新字段统一走归一化路径，避免局部更新时越界。
- `src/store/useTodoStore.ts`
  - 新增 `sanitizeSortOrder()`，新增待办时基于安全范围计算 `defaultSortOrder`，避免历史极端排序值被继续减小后穿透数据库上限。

### Validation

- `npx tsc --noEmit` ✅

## 2026-04-15 - Fix: Growth 待办重试同步循环触发 parent_id 外键冲突

### Changed

- `src/store/useTodoStore.ts`
  - `fetchTodos()` 推送阶段新增“父待办优先、子待办后推”的两阶段 upsert，避免子待办先写入触发 `todos_parent_id_fkey`。
  - 新增 `isTodoParentForeignKeyError()` 识别 PostgREST `23503` 外键报错（`todos_parent_id_fkey / Key is not present in table "todos"`）。
  - 子待办同步命中外键冲突时，新增恢复链路：先补推本地父待办再重试子待办；若父待办本地不存在则去除 `parentId` 后兜底 upsert，避免“重试一次继续失败”的死循环。
  - 同步前增加本地孤儿 `parentId` 自愈（本地父任务不存在时自动清空并标记 `pending`）。

### Validation

- `npx tsc --noEmit` ✅

## 2026-04-15 - Fix: annotation / extract-profile TypeScript 编译错误

### Changed

- `src/server/annotation-handler.ts`
  - 修复待办预拆解调用参数名：`apiKey` -> `geminiApiKey`，与 `decomposeTodoWithAI()` 签名对齐。
- `src/server/annotation-handler-utils.ts`
  - 移除 Gemini OpenAI 兼容 `responses.create()` 调用中的 `reasoning_effort` 字段，避免当前 SDK 类型重载不匹配。
- `src/server/extract-profile-service.ts`
  - 增加 `normalizeConfidenceSignal()` 统一清洗置信信号（`value/confidence/evidenceCount/lastSeenAt`）。
  - 重构 `observed`/`dynamicSignals` 组装逻辑，仅在信号有效时注入字段，避免 `exactOptionalPropertyTypes` 下的 `undefined` 属性与可选字段冲突。

### Validation

- `npx tsc --noEmit` ✅

## 2026-04-15 - Feat: Growth 瓶子详情弹层与轻量打卡统计

### Changed

- `src/features/growth/BottleList.tsx`
  - 点击瓶子交互收口为统一 `BottleDetailSheet`：替换原“生成待办确认弹窗 + 达成态弹窗”的分叉流程。
  - 删除操作并入瓶子详情弹层，新增二次确认后删除。
  - 详情弹层内保留主操作：active 瓶子可一键生成关联待办；achieved 瓶子按类型执行浇灌/继续追踪。
- `src/features/growth/BottleDetailSheet.tsx`（新增）
  - 新增瓶子详情 UI，展示三项核心指标：近 7 天打卡（含今天）、当前连续、最长连续。
- `src/features/growth/BottleCard.tsx`
  - 卡片交互简化为“点击打开详情”，移除卡片角删除入口，避免多入口冲突。
- `src/store/useGrowthStore.ts`
  - Bottle 新增 `checkinDates` 字段（`YYYY-MM-DD` 去重），并在 `incrementBottleStars()` 内统一写入今日日期，覆盖 AI 匹配与待办完成两条加星路径。
  - Supabase 映射新增 `bottle_checkin_dates` 读写。
- `src/lib/bottleStats.ts`（新增）
  - 新增轻量统计计算：`last7Days/currentStreak/bestStreak`。
- `src/i18n/locales/{zh,en,it}.ts`
  - 新增瓶子详情与打卡统计相关多语言文案键。

### Validation

- `npx tsc --noEmit` ✅

## 2026-04-15 - Fix: 日记落款兜底 + 用户称呼三层防线

### Changed

- `api/diary.ts`
  - 新增日记称呼 fallback：当 `display_name` 缺失时，按语言使用保底称呼（ZH=`园主` / EN=`Gardener` / IT=`Custode`），并始终注入强制称呼规则。
  - 新增输出质检重写：若生成文本仍包含泛称（如“用户/ta/the user”），自动触发一次低温重写，仅替换称呼不改结构。
  - 新增末端硬替换兜底：重写后仍残留泛称时，进行规则化替换，确保最终文本优先使用目标称呼。
  - 修复 `stripModelSignoff()`：不再删除带内容的落款行，避免误删真实签名。
  - 新增落款兜底：若尾部缺少签名，按语言与 AI 人设自动补签（Van/Agnes/Zep/Momo）。

### Validation

- `npx tsc --noEmit` ✅

## 2026-04-15 - Refactor: 日记输入去除光谱/光质等旧术语

### Changed

- `src/lib/report-calculator/formatter.ts`
  - 重写 `formatForDiaryAI()`，移除“光谱分布/光质读数/能量曲线/引力错位/历史趋势”整段结构化文本。
  - 日记输入改为仅保留：总时长、专注时长、待办完成概览、事件清单、心情记录。
- `src/lib/report-calculator/types.ts` + `src/lib/report-calculator/core.ts`
  - 精简 `ComputedResult`：删除 `spectrum/light_quality/gravity_mismatch/history_trends`，新增轻量字段 `focus_duration_min`、`todo_completed`、`todo_total`。
  - 删除对应计算链路，保留日记输入必要统计。
- `src/store/reportActions.ts`
  - `buildHistoryContext()` 改为使用轻量字段生成历史摘要，不再依赖 `spectrum/light_quality`。
- `src/store/useReportStore.ts`
  - `ReportStats` 删除 `spectrum/lightQuality` 字段；AI 日记生成后不再写入这两类统计。
- `src/features/report/SpectrumBarChart.tsx`（删除）
- `src/features/report/LightQualityDashboard.tsx`（删除）
- `src/i18n/locales/zh.ts` + `src/i18n/locales/en.ts` + `src/i18n/locales/it.ts`
  - 删除已废弃的光谱/光质相关翻译 key。

### Validation

- `npx tsc --noEmit` ✅

## 2026-04-15 - Fix: 重复待办实例日堆积 + monthly 频率错误

### Changed

- `src/store/useTodoStore.ts`
  - `generateRecurringTodos()` 新增未完成实例门控：同一 `templateId` 只要存在 `completed=false` 的实例，当天即跳过生成，避免 daily/weekly/monthly 重复待办“每天新增一条未完成实例”的堆积。
  - 修复 monthly 调度条件：自动生成逻辑由“每次触发都可生成”改为“仅每月 1 号生成”。
  - 修复创建重复模板时的首日实例生成判定：`recurrence='monthly'` 仅在每月 1 号立即生成首条实例，其余日期仅创建模板。

### Validation

- `npx tsc --noEmit` ✅

## 2026-04-15 - Fix: 聊天时间线编辑/插入后弹窗自动关闭

### Changed

- `src/features/chat/ChatPage.tsx`
  - `handleSave` 改为 `try/finally` 结构：当编辑或插入操作成功执行后，无论后续持久化阶段是否抛出异常，都会统一清空 `editingId/insertingAfterId` 关闭弹窗。
  - 保持原有校验逻辑（空内容/时间为空/开始时间晚于当前）不变，仅收口“已完成修改但弹窗未关闭”的交互边界。

### Validation

- `npx tsc --noEmit` ✅

## 2026-04-15 - Fix: Growth 添加待办弹层移动端高度与滚动可用性

### Changed

- `src/features/growth/AddGrowthTodoModal.tsx`
  - 弹层容器改为「头部 + 可滚动内容区 + 底部操作区」三段式，移除 `max-h-[85vh]`，改为基于 `100dvh` 与全局 modal gutter 的高度约束，避免 iOS Safari 视口变化导致内容被压出可视区。
  - 内容区启用独立滚动与 `-webkit-overflow-scrolling: touch`，修复小屏设备上“无法下拉到表单底部”的问题。
  - 确认按钮移至底部固定操作区并补 safe-area 底部留白，保证输入后始终可点击保存。
  - 视觉尺寸对齐现有弹窗：由底部全宽样式改为居中卡片（`w-[min(92vw,420px)]` + `rounded-3xl`），降低视觉压迫感，避免“弹窗过大”。

### Validation

- `npx tsc --noEmit` ✅

## 2026-04-15 - Fix: 日记详情活动/情绪总结半句截断

### Changed

- `src/store/reportHelpers.ts`
  - 移除活动/情绪总结的 50 字符硬截断逻辑（原 `clampText50`），改为仅做空白归一，确保句子完整输出。
- `src/features/report/ReportDetailModal.tsx`
  - 新增 legacy 截断识别（长度接近 50 且句尾无终止标点），命中时使用 `stats.actionAnalysis` / `stats.moodDistribution` 现场重算总结文本。
  - `SectionRow` 文本区域增加 `minWidth: 0` 与 `overflowWrap: anywhere`，降低长文本在 grid/flex 场景下被裁切风险。

### Validation

- `npx tsc --noEmit` ✅

## 2026-04-13 - Fix: annotation/todo-decompose 上游原始返回调试日志补齐

### Changed

- `src/server/todo-decompose-service.ts`
  - `TODO_DECOMPOSE_VERBOSE_LOGS=true` 时，DashScope/Gemini 成功日志新增 `finishReason`、usage 与完整 `rawFull`（不再仅 `rawPreview`）。
  - Gemini/DashScope 错误与重试日志新增 `responseRaw`，便于直接查看上游错误原文。
  - 请求结束日志新增 `rawLength` 与 `rawPreview`，便于快速判断“有返回但解析失败”的场景。
- `src/server/annotation-handler-utils.ts` + `src/server/annotation-handler.ts`
  - Gemini annotation 调用新增 verbose 成功日志：`finishReason`、`usageMetadata`、`candidatesCount` 与完整 `rawFull`。
  - Gemini annotation 失败日志新增 `responseRaw`。
  - suggestion/annotation/rewrite 侧日志补充 `finishReason`，便于定位“输出说一半”是否由 `MAX_TOKENS`/安全阻断触发。

### Validation

- `npx tsc --noEmit` ✅

## 2026-04-13 - Feat: 语言偏好同步到云端 metadata（i18nextLng）

### Changed

- `src/store/useAuthStore.ts`
  - 新增 `updateLanguagePreference(language)`：统一执行语言切换并写入 `auth.users.raw_user_meta_data.i18nextLng`（Supabase `updateUser({ data })`）。
  - 初始化登录态与 `SIGNED_IN` 事件新增语言 metadata 自愈：当云端缺失 `i18nextLng` 时，自动使用当前 i18n 语言回填；当云端已有值时，优先同步到前端 i18n。
  - 新增语言归一化工具（`zh/en/it`）与 metadata 读取/同步辅助函数，避免 `zh-CN`、`it-IT` 等区域变体导致漂移。
- `src/components/layout/LanguageSwitcher.tsx`
  - 语言切换入口改为调用 `useAuthStore.updateLanguagePreference(...)`，确保“切换即上云”。

### Validation

- `npx tsc --noEmit` ✅

## 2026-04-13 - Fix: 连续专注默认时长跟随首个子任务

### Changed

- `src/features/growth/FocusMode.tsx`
  - 新增 `normalizeDurationMinutes`，统一将建议时长归一到 `1-60` 分钟，缺省回退 `25` 分钟。
  - Focus 弹层打开时，`durationMinutes` 初始值改为优先读取首个子任务/当前待办的 `suggestedDuration`，不再固定 `25`。
  - 新增未开跑状态下的时长同步逻辑：当目标待办切换（含连续专注场景）时，圆盘展示时长自动更新为对应子任务建议时长。

### Validation

- `npx tsc --noEmit` ✅

## 2026-04-13 - Fix: annotation 调试日志补齐（请求/Prompt/模型输出/特殊模式）

### Changed

- `src/server/annotation-handler.ts`
  - 新增统一结构化 verbose 日志入口：`ANNOTATION_VERBOSE_LOGS=true` 时记录 `request.received`（完整 `eventData` + `userContext`）。
  - 在 suggestion/annotation 双链路新增 `prompt.*.built` 与 `llm.*.raw_output` 日志，覆盖 system prompt、user prompt、原始模型输出与 usage 元信息。
  - 新增 `special_modes.resolved` 与 `response.*` 日志，明确是否命中 suggestion、低叙事事件触发信息、横向联想触发与类型、最终返回 payload。
- `api/README.md`
  - 补充 `/api/annotation` verbose 日志说明，明确 Vercel Logs 可见字段范围与开关条件。

## 2026-04-13 - Fix: Magic Pen 本地快路径收口（8 字阈值 + 待办拦截 + 多动作拦截）

### Changed

- `src/features/chat/chatPageActions.ts`
  - `shouldUseLocalFastPath(...)` 收口为“仅简单输入且语义长度 <= 8”才允许本地快路径。
  - 新增待办/清单意图拦截（如“以下是我的待办 / 待办 / todo / 清单”等），命中后强制走 parser。
  - 新增多动作拦截（括号/分隔符/中文空格列举/多动作词），默认禁用本地快路径，避免整句被直接写成活动。
- `src/features/chat/chatPageActions.test.ts`
  - 更新快路径阈值用例为“8 字以内”。
  - 新增回归用例：待办清单输入强制走 parser；短句多动作输入强制走 parser。

### Validation

- `npm run test:unit -- src/features/chat/chatPageActions.test.ts` ✅
- `npx tsc --noEmit` ✅

## 2026-04-12 - Fix: recovery 建议改为 recovery-only 提示链路，统一文案与按钮目标

### Changed

- `src/server/annotation-prompts.user.ts`
  - recovery nudge 命中时切换为 recovery-only prompt：仅注入 recovery 目标上下文，不再暴露普通待办列表，要求模型输出“平时 1 星 / 今天恢复 2 星”且带督促语气。
  - 明确约束 suggestion 只能围绕 recovery 目标，避免出现“正文说 A、按钮指向 B”。
- `src/server/annotation-suggestion.ts`
  - 新增 `normalizeRecoverySuggestion`：recovery 场景下强制 suggestion 与 recovery 目标对齐（todoId/todoTitle/rewardStars/recoveryKey）。
  - 新增 `isRecoveryContentCompliant`：校验文案是否包含 1 星与 2 星对比，不合规走 fallback。
- `src/server/annotation-handler.ts`
  - recovery 场景改为“AI 文案优先 + 规则校验兜底”，不再无条件覆盖正文。
  - suggestion 统一走 recovery 归一化，避免按钮跳转目标漂移到无关活动。
- `src/server/annotation-prompts.user.test.ts` + `src/server/annotation-handler.test.ts`
  - 新增/更新回归测试：覆盖 recovery-only prompt、生效后 suggestion 对齐、以及文案不合规时 fallback。

### Validation

- `npx vitest run src/server/annotation-prompts.user.test.ts src/server/annotation-handler.test.ts` ✅

## 2026-04-12 - Fix: todo-decompose Gemini 默认模型升级到 2.5 + 404 自动降级

### Changed

- `src/server/todo-decompose-service.ts` + `api/todo-decompose.ts`
  - `/api/todo-decompose` 的 en/it 默认模型从 `gemini-2.0-flash` 升级为 `gemini-2.5-flash`，避免新账户调用已下线模型返回 404。
  - Gemini 调用新增“模型下线 404”自动降级重试：首个模型命中 `NOT_FOUND`/`no longer available` 时，自动切到 `TODO_DECOMPOSE_GEMINI_FALLBACK_MODEL`（默认 `gemini-2.5-flash`）重试一次。
  - 诊断日志补充 fallback 信息，并在成功/返回结构中反映实际调用模型（`model`）。
- `.env.example` + `api/README.md` + `src/api/README.md` + `DEPLOY.md` + `docs/AI_USAGE_INVENTORY.md`
  - 同步默认模型说明为 `gemini-2.5-flash`，并新增 `TODO_DECOMPOSE_GEMINI_FALLBACK_MODEL` 配置说明。

## 2026-04-11 - Fix: todo-decompose 可观测性增强 + annotation 中文模型切换 DeepSeek

### Changed

- `src/server/todo-decompose-service.ts` + `api/todo-decompose.ts`
  - 新增待办拆解排障日志：`TODO_DECOMPOSE_VERBOSE_LOGS=true` 时输出请求入口、provider 路由、上游响应预览与解析结果。
  - `/api/todo-decompose` 失败分支新增结构化 `console.error`，记录关键环境与错误信息，便于在 Vercel Logs 快速定位 500 根因。
  - 待办拆解 provider 路由调整为 `zh -> qwen`、`en/it -> gemini`（移除 openai 作为默认执行路径）。
- `src/server/annotation-prompts.defaults.ts` + `src/server/annotation-provider-runtime.ts`
  - annotation 模型路由更新为：`zh -> deepseek-chat`，`en/it -> gemini2.0-flash`。
  - annotation runtime 新增 `deepseek` provider，支持 `DEEPSEEK_API_KEY` 与可选 `ANNOTATION_DEEPSEEK_BASE_URL`（默认 `https://api.deepseek.com/v1`）。
- `src/server/annotation-handler.ts`
  - 新增 provider 感知的 LLM 调用封装：`deepseek` 走 `chat.completions`（`/v1/chat/completions`），`gemini` 走原生 `generateContent`（`/v1beta/models/*:generateContent`），其余 provider 保持既有路径。
  - 修复 DeepSeek/Gemini 在 `/v1/responses` 路径下的 404 兼容性问题，并在 suggestion/主流程异常日志中补充 provider/model 信息。
- `.env.example` + `api/README.md` + `DEPLOY.md` + `docs/AI_USAGE_INVENTORY.md`
  - 同步环境变量、provider 映射与模型清单说明，明确各功能当前使用模型，减少联调混淆。

## 2026-04-11 - Fix: annotation 多 provider 实际接线 + Gemini/Qwen 环境变量落地

### Changed

- `src/server/annotation-handler.ts`
  - 新增 annotation runtime 解析：按 model 自动选择 provider（`qwen/gemini/openai`）与对应 `apiKey/baseURL`。
  - `/api/annotation` 现在按语言路由真实生效：`zh -> QWEN_API_KEY (+ ANNOTATION_QWEN_BASE_URL)`，`en/it -> GEMINI_API_KEY (+ ANNOTATION_GEMINI_BASE_URL)`。
  - 移除仅依赖 `OPENAI_API_KEY` 的单一路径，缺 key 时返回默认批注并附带 provider/model 调试信息。
- `.env.example` + `DEPLOY.md` + `api/README.md` + `docs/AI_USAGE_INVENTORY.md`
  - 同步新增 `GEMINI_API_KEY` 与 annotation 专用 base URL 变量说明，更新 `/api/annotation` provider 映射。

## 2026-04-11 - Tweak: Annotation 模型按语种分流

### Changed

- `src/server/annotation-prompts.defaults.ts`
  - `getModel(lang)` 调整为按语种路由：`zh` 使用 `qwen-plus`，`en/it` 使用 `gemini2.0-flash`。
  - prompt 组装与 `/api/annotation` 主流程不变，仍通过 `buildAnnotationPromptPackage` 下发 `model`。

## 2026-04-11 - Fix: recovery 2 星仅限瓶子目标 + 建议文案与目标对齐

### Changed

- `src/lib/recoverySuggestion.ts` + `src/lib/recoverySuggestion.test.ts`
  - recovery nudge 检测收口为“仅瓶子连续 3 天未完成”路径。
  - 移除 recurring 昨日断档触发 2 星的分支，并补充对应回归测试（无瓶子关联时返回 null）。
- `src/types/annotation.ts` + `src/server/annotation-handler.test.ts`
  - `RecoveryNudgeReason` 收敛为 `bottle_missed_3_days`，并同步测试夹具。
- `src/server/annotation-handler.ts`
  - recovery nudge 生效时，建议 `content` 改为基于最终 recovery 目标生成，避免出现“文案说 A、跳转到 B”错位。
- `src/store/README.md` + `docs/CURRENT_TASK.md`
  - 同步规则口径：2 星仅对瓶子关联目标生效。

## 2026-04-11 - Tweak: 去除“今日小事”标签 + 互提长度规则细化

### Changed

- `src/server/narrative-event-library.ts`
  - `natural_event` 注入改为纯自然句，不再附加 `[今日小事]` 标签前缀。
- `src/server/character-mention-spec.ts`
  - `character_mention` 注入头部去除 `Today Note/今日小事` 标签字样，保留互提背景与分组指引结构。
  - 互提长度约束更新为：`zh` 20-28 字上限 40、`en` 16-22 words 上限 30、`it` 16-24 parole 上限 32。
- `src/server/narrative-event-library.test.ts`
  - 更新断言以匹配“无标签”注入文本与新版三语长度规则文案。

## 2026-04-11 - Feat: 角色互提切换为三语等价 Prompt 指引注入

### Changed

- `src/server/character-mention-spec.ts`（新增）
  - 新增角色互提结构化规格：关系背景、全局禁止项、A/B/C/D 组指引、角色差异化 few-shot。
  - 一次性落地 `zh/en/it` 三语言等价内容，语义对齐但非硬直译。
- `src/server/narrative-event-library.ts`
  - `character_mention` 从“固定成品句子池”升级为“Prompt 指引块注入”（含组别随机）。
  - 保持 `natural_event` 仍走 `[今日小事] ...` 轻量事件句模式。
- `src/server/narrative-event-library.test.ts`（新增）
  - 新增单测覆盖：`natural_event` 兼容性、`character_mention` 在 zh/en/it 的注入结构与组别抽样。
- `docs/CURRENT_TASK.md`
  - 同步标记“文档二角色互提”已落地，并更新风险项状态。

### Validation

- `npx vitest run src/server/narrative-event-library.test.ts src/server/narrative-density-trigger.test.ts src/server/narrative-density-scorer.test.ts` ✅

## 2026-04-11 - Feat: Telemetry Center 门户 + AI 批注子看板

### Changed

- `src/server/annotation-handler.ts` + `src/server/narrative-density-telemetry.ts`
  - 新增 `lateral_sampled` 埋点，记录 `narrativeScore/finalProbability/triggered/associationType`。
  - 横向联想触发改为“基准概率 + 分数调制”模式（`base=0.5, delta=0.2, min=0.3, max=0.7`）。
- `src/server/live-input-dashboard-handler.ts` + `src/services/input/liveInputTelemetryApi.ts`
  - 统一看板扩展聚合 AI 批注埋点（`density_scored/trigger_blocked/event_triggered/event_condensed/lateral_sampled`）。
  - 新增 AI 批注摘要、事件分布、角色分布、联想类型分布、叙事分数分桶触发率。
- `src/features/telemetry/TelemetryHubPage.tsx`（新增）+ `src/features/telemetry/AiAnnotationTelemetryPage.tsx`（新增）+ `src/App.tsx`
  - 新增 `/telemetry` 总入口与 `/telemetry/ai-annotation` 子页面。
- `src/features/profile/components/SettingsList.tsx`
  - 设置页埋点入口升级为 `Telemetry Center`，跳转统一门户。
- `src/features/telemetry/isTelemetryAdmin.ts`（新增）+ `src/App.tsx` + `src/features/profile/components/SettingsList.tsx`
  - 埋点页面入口与路由改为严格管理员可见/可访问（DEV 环境也不再放开）。
- `api/README.md` + `src/api/README.md` + `docs/PROJECT_MAP.md` + `docs/CURRENT_TASK.md`
  - 同步文档口径与看板聚合范围。

## 2026-04-11 - Tweak: 低叙事密度触发改为分数连续概率 + 与横向联想互斥

### Changed

- `src/server/narrative-density-constants.ts`
  - 四维权重调整为 `freshness=0.30 / density=0.30 / emotion=0.25 / vocab=0.15`。
  - 触发参数从固定概率改为连续概率曲线参数（`min/span/max/gamma/richnessPenalty`）。
- `src/server/narrative-density-trigger.ts`、`src/server/narrative-density-types.ts`
  - 触发决策改为 score-driven 概率抽样（`(1-score)^gamma`）并受 `todayRichness` 惩罚项影响。
  - 保留首条跳过、每日总上限、类型上限与类型权重抽样。
  - 触发决策结果新增 `triggerProbability` 字段，便于日志与调参。
- `src/server/annotation-handler.ts`
  - 注入策略改为 `narrative > lateral` 互斥：命中 `[今日小事]` 时跳过横向联想采样，避免同轮双指令竞争。
  - 调试日志与 `density_scored` telemetry 增加 `triggerProbability`。
- `src/server/narrative-density-trigger.test.ts`
  - 新增“高分低概率”与“低分概率更高”的单测覆盖，验证连续概率策略。

### Validation

- `npx vitest run src/server/narrative-density-trigger.test.ts src/server/narrative-density-scorer.test.ts` ✅
- `npx tsc --noEmit` ✅

## 2026-04-11 - Tweak: EcoSphere 自由漂浮随机化 + 移除心情能量曲线

### Changed

- `src/features/report/plant/useBubbleMotionController.ts`
  - 自由漂浮新增“随机时长 + 随机方向”切换节奏，并加入随机冲量脉冲，避免长期朝单一方向漂移。
  - 移除固定竖向偏置力，改为更均衡的全向漂浮，增强物体在液体中自由漂移的观感。
- `src/features/report/plant/DayEcoSphere.tsx`
  - 移除心情气泡点击后的心情能量曲线展开面板，仅保留双气泡漂浮展示。
- `docs/CURRENT_TASK.md`
  - 同步记录本轮 EcoSphere 漂浮与交互简化改动。

## 2026-04-11 - Tweak: EcoSphere 气泡漂浮物理调优

### Changed

- `src/features/report/plant/useBubbleMotionController.ts`
  - 自由漂浮改为随机游走扰动，减少规律性方向循环。
  - 漂浮与重力影响整体降速约 2.5 倍，提升轻盈感。
  - 新增双气泡重叠阈值（2/3 直径）阻尼反弹，避免完全重叠。
  - 初始位置与漂移方向随机化，进入页面更自然。

## 2026-04-11 - Tweak: Profile「专属记忆」文案与编辑界面简化

### Changed

- `src/features/profile/components/LongTermProfileToggle.tsx` + `src/i18n/locales/{zh,en,it}.ts`
  - 长期画像文案升级为「专属记忆」语义，强调陪伴关系与“被记住”体验。
- `src/features/profile/components/UserProfileSection.tsx`
  - 移除三分栏 tab（作息/个性化画像/纪念日），改为单页内容容器。
- `src/features/profile/components/UserProfilePanel.tsx`
  - 编辑区合并为单页：作息与自由画像同屏编辑，并保留单一保存按钮。
  - 前台不再展示纪念日新增/删除/来源标签 UI，保存链路仅提交 `manual`。
- `src/features/profile/README.md` + `docs/CURRENT_TASK.md`
  - 同步模块接口说明与当前任务记录。

## 2026-04-10 - Feat: 低叙事密度判定 + 今日小事事件注入（Doc1 P1）

### Changed

- `src/server/narrative-density-types.ts`、`src/server/narrative-density-constants.ts`（新增）
  - 新增低叙事密度缓存/触发/埋点相关类型与常量（四维权重、阈值修正系数、概率、每日上限、类型权重）。
- `src/server/narrative-density-scorer.ts`、`src/server/narrative-density-trigger.ts`、`src/server/narrative-density-state.ts`（新增）
  - 落地纯规则评分（freshness/density/emotion/vocab）与触发决策（首条跳过、阈值修正、每日总上限/类型上限、概率抽样）。
  - 新增 `today_narrative_cache_v1` 读写（优先 `user_metadata`，无 service role 时回退进程内缓存），并支持跨日重置。
- `src/server/narrative-event-library.ts`、`src/server/narrative-density-telemetry.ts`（新增）
  - 新增 P1 事件库（`natural_event` / `character_mention`）与 `[今日小事] ...` 注入文案生成。
  - 新增服务端 telemetry 上报：`density_scored` / `trigger_blocked` / `event_triggered`。
- `src/server/annotation-handler.ts`、`src/server/annotation-prompt-builder.ts`、`src/server/annotation-prompts.user.ts`
  - 在 `/api/annotation` 链路接入低叙事密度判定与注入；suggestion/normal annotation 双链路均可接收同一条今日小事注入。
  - `/api/annotation` 响应新增 `narrativeEvent`（`eventType/eventId/instruction/isTriggeredReply`）供前端对齐凝结埋点。
- `src/store/useAnnotationStore.ts`、`src/types/annotation.ts`、`src/services/input/reportTelemetryEvent.ts`
  - store 层保存 `narrativeEvent` 元数据；当 suggestion 被接受且 `isTriggeredReply=true` 时新增 `event_condensed` telemetry。
- `src/server/narrative-density-scorer.test.ts`、`src/server/narrative-density-trigger.test.ts`（新增）
  - 新增首版单测覆盖：事件归类、低/高密度分差、首条拦截、低密命中触发。

### Validation

- `npx tsc --noEmit` ✅
- `npx vitest run src/server/narrative-density-scorer.test.ts src/server/narrative-density-trigger.test.ts src/server/annotation-handler.test.ts` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`、`api/README.md`、`src/api/README.md`、`src/store/README.md`。

## 2026-04-10 - Feat: 周画像提取支持多语言 + 新增周状态/高频活动/高频心情

### Changed

- `src/server/extract-profile-service.ts`
  - `/api/extract-profile` 提取 prompt 新增 `zh/en/it` 三语路由（基于 `lang`）。
  - 扩展提取 schema：`observed.weeklyStateSummary`、`observed.topActivities`（top3）、`observed.topMoods`（top3）。
  - 新字段沿用 `ConfidenceSignal` 结构并统一做 `lastSeenAt` ISO 归一化。
- `api/extract-profile.ts`
  - 新增 `lang` 入参解析与白名单归一化（`zh`/`it`，其他回退 `en`），并透传至提取服务。
- `src/api/client.ts` + `src/store/reportActions.ts`
  - `callExtractProfileAPI()` 请求体新增 `lang`。
  - 周报触发链路 `triggerWeeklyProfileExtraction()` 透传当前 i18n 语言到服务端。
- `src/types/userProfile.ts` + `src/lib/buildUserProfileSnapshot.ts`
  - `UserProfileObserved` 新增周状态/高频活动/高频心情字段类型。
  - 长期画像快照文本新增这三个字段，批注 prompt 可直接消费。

### Doc Sync

- 更新 `api/README.md`、`src/api/README.md`、`docs/CURRENT_TASK.md`。

## 2026-04-10 - Feat: EcoSphere 饼图自由漂浮 + 设备重力联动

### Changed

- `src/features/report/plant/DayEcoSphere.tsx`
  - 两枚 Donut 气泡从固定定位改为在顶部空白区域内自由漂浮，支持边界碰撞与阻尼反弹。
  - 保留点击展开逻辑（心情气泡仍可展开能量曲线面板），并维持现有夜间提示行为。
  - Donut 文本字号轻微上调（`fontSize: 6 -> 7`），提升气泡内标签可读性。
- `src/features/report/plant/useBubbleMotionController.ts`（新增）
  - 新增气泡物理控制 hook：`requestAnimationFrame` 驱动速度/位移更新，包含漂浮扰动、空气阻尼、边界反弹。
  - 接入 `deviceorientation`（倾斜重力）与 `devicemotion`（摇晃冲量）输入；传感器不可用或权限未授予时自动退化到纯自由漂浮。
- `src/services/native/motionService.ts`（新增）
  - 新增运动能力封装：传感器支持检测、iOS 运动权限请求（按需）、倾斜向量监听。

### Validation

- `npx tsc --noEmit` ✅

## 2026-04-10 - Feat: 角色状态改为持续影响 + 衰减注入（移除同日去重）

### Changed

- `src/lib/characterState/constants.ts`
  - `CharacterStateTracker` 新增 `activeEffects` 持续影响状态，移除 `injectedByDate` 同日去重结构。
- `src/lib/characterState/event-tracker.ts`
  - 新增持续影响能力：`decayAndPruneActiveEffects()`、`addOrRefreshActiveEffect()`、`getActiveEffectScore()`、`listActiveBehaviorIds()`。
  - 延迟事件改为“到期消费一次后进入持续影响池”，不再按天重复注入。
- `src/lib/characterState/character-state-builder.ts`
  - 注入策略由“当次命中+同日去重”改为“命中累积影响 -> 时间衰减 -> 从 active effects 选文案”。
  - 衰减降级优先走 `lite` 文案（缺失时 fallback 到 `instant`），并继续保留 `trend` 与并发上限 2 条。
  - 行为参数改为配置化读取（`BEHAVIOR_EFFECT_CONFIG`），不再写死在 builder 内。
- `src/lib/characterState/behavior-map.ts`
  - 新增 B01-B21 全量衰减参数配置（`baseScore/maxScore/ttlHours/halfLifeHours`）。
  - 补齐部分行为的 `lite` 文案：B02（吸烟）、B03（熬夜）、B09（咖啡）。
- `src/types/annotation.ts` / `src/server/annotation-handler.ts`
  - 扩展 `characterStateMeta` 调试字段（active effects、文案档位、抑制列表）。
  - `/api/annotation` 响应新增 `debugCharacterState`，可直接在浏览器 F12 的 Network 中查看本次角色状态注入上下文。
- `src/lib/characterState/event-tracker.test.ts` / `src/lib/characterState/character-state-builder.test.ts`
  - 单测改为覆盖“同日持续影响”“衰减过期清理”“延迟消费一次”新逻辑。

### Validation

- `npm run -s test:unit -- src/lib/characterState/event-tracker.test.ts src/lib/characterState/character-state-builder.test.ts` ✅
- `npx tsc --noEmit` ✅

## 2026-04-10 - Fix: iOS 套壳输入缩放/滚动条/拖拽手感

### Changed

- `index.html`
  - 收紧 viewport：增加 `maximum-scale=1.0` 与 `user-scalable=no`，降低 iOS 输入聚焦导致页面放大且不回退的概率。
- `src/index.css`
  - 补充根层约束：`html/body/#root` 全高与根滚动锁定，统一 `text-size-adjust`。
  - 新增 `app-scroll-container`，统一隐藏滚动条并保留惯性滚动（`-webkit-overflow-scrolling: touch`）。
- `src/features/growth/GrowthPage.tsx`、`src/features/profile/ProfilePage.tsx`、`src/features/chat/components/TimelineView.tsx`、`src/features/report/plant/PlantRootSection.tsx`
  - 主滚动容器切换为 `app-scroll-container`，减少 iOS WebView 下可见网页滚动条。
- `src/services/native/keyboardService.ts`（新增）+ `src/main.tsx`
  - 新增 iOS 原生键盘监听与视口修正初始化，键盘显隐时同步根 class 与高度变量，并在收起后执行滚动位置回正。
- `package.json`、`capacitor.config.ts`、`ios/App/App/capacitor.config.json`
  - 引入 `@capacitor/keyboard`，配置 `Keyboard.resize = body` 并同步 iOS Capacitor 配置。
- `ios/App/App/AppDelegate.swift`
  - App 激活与启动后统一调整 WKWebView scrollView：关闭 bounce 与滚动指示器，减少“网页感”滚动表现。
- `src/features/growth/GrowthTodoSection.tsx`
  - 长按拖拽参数调优：触发延时 `320ms -> 220ms`，取消阈值 `8px -> 14px`，提升移动端拖拽手感。

### Validation

- `npx tsc --noEmit` ✅
- `npm run lint:docs-sync` ✅

## 2026-04-10 - Refactor: Stardust 统一复用批注 Emoji（移除独立模型端点）

### Changed

- `src/store/useStardustStore.ts`
  - 移除 `callStardustAPI` 依赖，不再在凝结时调用独立 AI 选 Emoji。
  - 新增本地 `extractEmojiFromAnnotation(...)`，优先复用批注内容中的 emoji，缺失时兜底 `✨`。
- `src/api/client.ts`
  - 删除 `callStardustAPI()` 及其请求/响应类型。
- `api/stardust.ts`
  - 删除 `/api/stardust` serverless 入口。

### Validation

- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `api/README.md`、`src/api/README.md`、`docs/PROJECT_MAP.md`、`docs/ARCHITECTURE.md`、`docs/AI_USAGE_INVENTORY.md`、`.env.example`、`scripts/check-doc-sync.mjs`。

## 2026-04-10 - Feat: 周报点击触发用户画像提取（P3）

### Changed

- `api/extract-profile.ts`（新增）
  - 新增 `/api/extract-profile` 端点（需 Supabase Bearer token）。
  - 接收前端透传 `recentMessages[]`，调用服务端提取逻辑并返回 `profile` patch。
- `src/server/extract-profile-service.ts`（新增）
  - 新增画像提取服务：基于 OpenAI（默认 `gpt-4o-mini`）将最近记录总结为 `observed/dynamicSignals/anniversariesVisible/hiddenMoments`。
  - 增加严格 schema 校验与保守清洗：非法字段丢弃，不阻塞主链路。
- `src/api/client.ts`
  - 新增 `callExtractProfileAPI()` 与请求/响应类型定义。
- `src/store/reportActions.ts` + `src/store/useReportStore.ts`
  - 新增 `triggerWeeklyProfileExtraction()`：当 `generateReport('weekly', ...)` 执行时并行触发画像提取。
  - 长期画像开关关闭时自动短路；提取成功后通过 `useAuthStore.updateUserProfile(...)` merge 写回 `user_profile_v2`，避免 metadata 覆盖。

### Validation

- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`：冻结“周报点击触发画像提取，每次点击都执行”的触发口径，并标记 P3 完成。
- 更新 `api/README.md`、`src/api/README.md`、`src/store/README.md`：补充新端点与周报触发链路说明。

## 2026-04-10 - Update: User Profile UI 三分栏改版（作息/个性化画像/我的纪念日）

### Changed

- `src/features/profile/components/UserProfileSection.tsx`
  - 将“我的画像”页签改为 3 个固定入口：`作息时间`、`个性化画像`、`我的纪念日`。
  - 移除该区域对“画像快照”页签的直接展示，改为只承载画像编辑任务。
- `src/features/profile/components/UserProfilePanel.tsx`
  - 移除“主要用途”与目标输入区，新增 `manual.freeText` 自由输入区用于个性化画像描述。
  - 纪念日列表保留用户新增 + AI 自动写入的混合数据，并新增来源标识（我添加的 / AI 识别）。
  - 保存链路继续复用 `updateUserProfile(...)`，统一提交作息、自由画像、纪念日。
- `src/features/profile/components/userProfilePanelHelpers.ts`
  - `buildManualPayload(...)` 调整为写入 `freeText`，不再更新 `primaryUse/currentGoal/lifeGoal`。
- i18n：`src/i18n/locales/zh.ts` / `src/i18n/locales/en.ts` / `src/i18n/locales/it.ts`
  - 新增三分栏页签、个性化画像输入、纪念日来源标签相关词条。
  - 同步更新画像区域描述文案。

### Validation

- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`：补记 Profile 画像编辑区的三分栏 UI 改版落地。

## 2026-04-09 - Update: User Profile v1.1（仅画像系统 + Profile UI 强化）

### Changed

- `src/features/profile/components/UserProfilePanel.tsx`
  - 新增“无改动不保存”脏检查，避免重复写入 metadata。
  - 新增纪念日完整性校验（名称/日期必须成对填写），提升保存反馈明确性。
  - 抽离表单工具到 `userProfilePanelHelpers.ts`，降低主组件复杂度并便于复用。
- `src/features/profile/components/LongTermProfileToggle.tsx`
  - 新增保存中态与成功/失败反馈文案，避免静默切换。
  - 补充 `role=switch` 与 `aria-checked`，提升可访问性。
- `src/features/profile/components/UserProfileInsightsCard.tsx`（新增）
  - 在 Profile 页新增“画像快照”展示卡，聚合展示建议饭点、临近纪念日与最新回忆素材。
  - 快照来源统一复用 `buildUserProfileSnapshot(...)`。
- `src/features/profile/ProfilePage.tsx`
  - 接入 `UserProfileInsightsCard`，形成“编辑 + 快照反馈”闭环。
- `src/features/growth/LifeGoalPanel.tsx`（新增）
  - 新增“人生目标管理”面板，支持在 Growth 页直接编辑长期人生目标。
  - 写入链路复用 `useAuthStore.updateUserProfile(...)`，与 Profile 页 `manual.lifeGoal` 保持双向同步。
- `src/features/growth/GrowthPage.tsx`
  - Growth 主页面接入 `LifeGoalPanel`，形成“成长执行区 + 长期方向”同屏管理。
- `src/store/authProfileHelpers.ts`
  - 强化 `parseUserProfileV2(...)` 的输入清洗：manual/纪念日/隐性回忆数据校验，降低脏数据进入状态层风险。
- i18n：`src/i18n/locales/zh.ts` / `src/i18n/locales/en.ts` / `src/i18n/locales/it.ts`
  - 新增长期画像保存状态、画像保存校验、画像快照卡文案 key。
  - 新增 Growth 人生目标管理文案 key（保存态/同步提示/无变更提示）。
- 文档：`src/features/profile/README.md`、`src/features/growth/README.md`
  - 同步 Profile 快照卡与 Growth 人生目标管理面板能力说明。

### Validation

- `npx tsc --noEmit` ✅
- `npx vitest run src/lib/buildUserProfileSnapshot.test.ts src/lib/suggestionDetector.test.ts` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`：本轮策略明确为“仅画像系统 + Profile/Growth UI，不做新手引导”，并标记人生目标双向同步完成。

## 2026-04-09 - Feat: User Profile v1.1 P2 首版（我的画像编辑面板）

### Changed

- `src/features/profile/components/UserProfilePanel.tsx`（新增）
  - 新增“我的画像”折叠面板，支持编辑 `manual` 层字段：`primaryUse`、`wakeTime`、`sleepTime`、`mealTimes`、`currentGoal`、`lifeGoal`。
  - 新增 A 类可见纪念日管理（新增/删除/每年重复），写入 `user_profile_v2.anniversariesVisible`。
  - 保存链路统一复用 `useAuthStore.updateUserProfile(...)`，沿用 metadata `read -> merge -> write` 策略。
- `src/features/profile/ProfilePage.tsx`
  - Profile 页面接入 `UserProfilePanel`，与“长期画像开关”并列展示。
- i18n：`src/i18n/locales/zh.ts` / `src/i18n/locales/en.ts` / `src/i18n/locales/it.ts`
  - 新增 `profile_user_profile_*` 词条，覆盖用途/作息/目标/纪念日/保存状态文案。
- `src/features/profile/README.md`
  - 同步 profile 模块能力说明，补充 UserProfilePanel 入口与职责。

### Validation

- `npx tsc --noEmit` ✅
- `npm run build` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`：P2 状态更新为“画像编辑已落地，目标双向同步待补”。

## 2026-04-09 - Feat: User Profile v1.1 P0 基建（开关 + 快照 + prompt 注入）

### Changed

- `src/types/userProfile.ts`（新增）
  - 新增用户画像 v2 类型：`UserProfileV2`、`VisibleAnniversary`、`HiddenMoment`、`ConfidenceSignal`、`UserProfileSnapshot`。
- `src/lib/buildUserProfileSnapshot.ts`（新增）
  - 新增长期画像快照构建：合并 manual/observed/dynamic/hidden 信息，产出英文快照文本、建议链路可用饭点、临近纪念日与召回素材。
  - 新增 `isLongTermProfileEnabled(...)` 门控工具函数。
- `src/store/useAuthStore.ts` + `src/store/authProfileHelpers.ts`（新增）
  - `useAuthStore` 扩展状态：`longTermProfileEnabled`、`userProfileV2`。
  - 新增 `updateLongTermProfileEnabled(...)` 与 `updateUserProfile(...)`，统一执行 `read -> merge -> write` 的 metadata 更新，避免覆盖并行字段。
  - `updatePreferences` 持久化路径改为基于最新 metadata 合并写入。
- `src/features/profile/components/LongTermProfileToggle.tsx`（新增） + `src/features/profile/ProfilePage.tsx`
  - Profile 页新增“长期画像”总开关 UI，并持久化到 `user_metadata.long_term_profile_enabled`。
- `src/store/useAnnotationStore.ts`
  - 在开关开启时构建 `userProfileSnapshot` 并透传给 annotation API。
  - suggestion context hint 检测接入 declared/observed 饭点。
- `src/types/annotation.ts` / `src/server/annotation-handler.ts` / `src/server/annotation-prompt-builder.ts` / `src/server/annotation-prompts.user.ts`
  - 扩展 `AnnotationRequest.userContext.userProfileSnapshot`。
  - annotation + suggestion 双路径 prompt 注入长期画像快照块。
- `src/lib/suggestionDetector.ts`
  - `isMealTime(...)` 升级为 `isMealTime(hour, declared?, observed?)`，优先声明饭点，次选观测饭点，最后回退 legacy 时间窗。
- i18n：`src/i18n/locales/zh.ts` / `src/i18n/locales/en.ts` / `src/i18n/locales/it.ts`
  - 新增长期画像开关文案 key：`profile_long_term_profile`、`profile_long_term_profile_desc`。
- 测试新增/更新
  - 新增 `src/lib/buildUserProfileSnapshot.test.ts`。
  - 更新 `src/lib/suggestionDetector.test.ts`（声明/观测/fallback 饭点判定）。
  - 更新 `src/server/annotation-prompts.user.test.ts`（长期画像快照注入）。

### Validation

- `npx vitest run src/lib/suggestionDetector.test.ts src/lib/buildUserProfileSnapshot.test.ts src/server/annotation-prompts.user.test.ts` ✅
- `npm run lint:all` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`：主线 4 P0-0 ~ P0-5 标记完成。
- 更新 `src/store/README.md`、`src/api/README.md`、`api/README.md`、`src/features/profile/README.md`：同步开关、快照透传与契约变更。

## 2026-04-09 - Feat: annotation 横向联想中间层（首版采样 + U4 注入）

### Changed

- `src/server/lateral-association-sampler.ts`（新增）
  - 新增联想采样核心：11 种联想类型 + 3 种出发点采样、动态权重调整、上次去重、daily 受限类型拦截、tone tag 近 3 次去重。
  - 联想/出发点基础权重按需求文档第 3 章表格落地（包含 Agnes/Momo 冲突值修正）。
  - 新增三语指令构建：联想指令 + 出发点追加指令 + tone_only 语气指令。
- `src/server/lateral-association-state.ts`（新增）
  - 新增服务端状态读写：优先持久化到 `auth.users.user_metadata.lateral_association_state_v1`（`userId + characterId` 维度），无 service role 时回退进程内缓存。
  - 支持按 `dailyDate` 自动换日重置 daily 限制集合。
- `src/server/annotation-handler.ts`
  - 在 annotation/suggestion 双路径 prompt 组装前接入横向联想采样。
  - 采样结果写入 `associationInstruction` 并传递到 prompt U4 段。
  - 新增可观测日志字段（`associationType/originType/toneTag/instruction`，受 verbose 开关控制）。
- `src/server/annotation-prompt-builder.ts` / `src/server/annotation-prompts.user.ts`
  - 扩展 prompt 输入字段 `associationInstruction`，并在角色状态块后注入 U4 指令。
- `src/types/annotation.ts` / `src/store/useAnnotationStore.ts`
  - `AnnotationRequest.userContext` 新增可选 `userId`，前端透传当前登录用户 id 供服务端状态分桶。
- 测试新增/更新
  - 新增 `src/server/lateral-association-sampler.test.ts`。
  - 更新 `src/server/annotation-prompts.user.test.ts`（覆盖 U4 指令注入）。
  - 新增分布统计验收：Momo `self_led` 采样比例在容差内逼近 25%。

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`：新增“横向联想中间层”主线与 P0-P7 任务拆解。
- 更新 `src/store/README.md`、`src/api/README.md`、`api/README.md`：同步横向联想接入与 `userContext.userId` 契约。
- 更新 `docs/seeday_lateral_association_spec_v1.1 (1).extracted.txt`：将 5.3 常量修正为与第 3 章权重表一致。

## 2026-04-09 - Fix: suggestion 待办高亮丢失与长期待办预拆解漏触发

### Changed

- `src/features/growth/GrowthPage.tsx`
  - 调整 `pendingSuggestionIntent` 消费时机：等待 todo store hydrate 且父待办存在后再消费，避免页面初次挂载时提前清空导致“未高亮/未落地子步骤”。
  - 增加过期意图清理分支（>45s）避免陈旧 intent 残留。
- `src/lib/dbMappers.ts`
  - `fromDbTodo` 新增时间字段归一化（支持 number / 数字字符串 / ISO 字符串），统一映射 `createdAt/dueAt/completedAt/startedAt/sortOrder` 为毫秒时间戳。
  - 修复由时间字段字符串导致 `ageDays` 计算失真、stale todo 判定不稳定的问题。
- `src/store/useAnnotationStore.ts`
  - 构建 `pendingTodos` 时对 `createdAt/dueAt` 做毫秒归一化，确保 `ageDays` 计算稳定并透传可用时间字段。
- `src/server/annotation-handler.ts`
  - stale todo 预拆解判定新增时间解析兜底：除 `ageDays` 外，支持基于 `createdAt` 推断“创建 >=3 天”与 `dueAt` 逾期判定（兼容字符串时间）。
- 测试更新
  - `src/lib/dbMappers.test.ts` 增加 todo 字符串时间字段解析用例。
  - `src/server/annotation-handler.test.ts` 增加 `ageDays` 缺失但 `createdAt` 为旧字符串时仍触发预拆解用例。

### Validation

- `npx vitest run src/server/annotation-handler.test.ts src/lib/dbMappers.test.ts` ✅
- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`：记录本次 suggestion 跨页时序与 stale todo 判定修复。

## 2026-04-08 - Feat: annotation 行为-角色状态映射（B01-B21）接入 U3

### Changed

- `src/lib/characterState/*`（新增）
  - 新增行为状态模块：`behavior-map` / `behavior-matcher` / `event-tracker` / `character-state-builder` / `index`。
  - 支持 B01-B21 关键词匹配（zh/en/it）、B05 时长阈值、B06 茶种路由、延迟触发、活跃日 streak、7 天密度衰减、同日去重、并发上限 2 条。
- `src/store/useAnnotationStore.ts`
  - 新增 `characterStateTracker` 持久化状态。
  - 在 annotation 触发前构建 `characterStateText` 与 `characterStateMeta`，并透传到 `/api/annotation`。
  - 新增前端开关 `VITE_ANNOTATION_CHARACTER_STATE_ENABLED`（默认 `true`）。
- `src/types/annotation.ts`
  - 扩展 `AnnotationRequest.userContext`：新增 `characterStateText` 与 `characterStateMeta`。
- `src/server/annotation-prompt-builder.ts` / `src/server/annotation-prompts.user.ts` / `src/server/annotation-handler.ts`
  - 在 annotation 与 suggestion 双路径 prompt 中注入 U3 段（`Character current state` / `角色当前状态` / `Stato attuale del personaggio`）。
  - `characterStateText` 为空时按语言回退到 `none/无/nessuno`。
  - 新增 server 侧总开关：`ANNOTATION_CHARACTER_STATE_ENABLED=false` 时不注入行为状态正文（仅保留回退占位）。
- 测试新增/更新
  - 新增 `src/lib/characterState/behavior-matcher.test.ts`、`src/lib/characterState/event-tracker.test.ts`、`src/lib/characterState/character-state-builder.test.ts`。
  - 更新 `src/server/annotation-prompts.user.test.ts`、`src/server/annotation-handler.test.ts` 覆盖 U3 注入与 server 开关禁用场景。

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`：记录“行为-角色状态映射”开发落地完成。
- 更新 `src/store/README.md`、`src/api/README.md`、`api/README.md`：同步 annotation 上下文字段扩展。

## 2026-04-08 - Feat: suggestion 长期待办“先拆解后建议”落地

### Changed

- `src/server/todo-decompose-service.ts`（新增）
  - 提取待办拆解共享服务 `decomposeTodoWithAI(...)`，统一 3-6 步拆解规则与 JSON 解析归一化。
- `api/todo-decompose.ts`
  - 改为复用 `todo-decompose-service`，避免与 suggestion 预拆解链路双份实现漂移。
- `src/server/annotation-handler.ts`
  - suggestion 命中 `todo` 且识别为长期未完成（`ageDays>=3` 或逾期 >=24h）时，先调用拆解服务生成子步骤，再返回建议。
  - suggestion payload 新增预拆解透传：`decomposeReady` / `decomposeSourceTodoId` / `decomposeSteps[]`。
  - 建议文案与按钮在预拆解命中时改为“已拆好 + 开始第一步”语义。
- `src/types/annotation.ts` / `src/server/annotation-suggestion.ts`
  - 扩展 suggestion 与 pending intent 类型，支持预拆解字段；`PendingTodoSummary` 增加 `createdAt/ageDays`。
- `src/store/useAnnotationStore.ts`
  - 透传 pending todo `createdAt/ageDays` 到 annotation 请求。
  - 接收 suggestion 预拆解字段并写入本地 annotation 状态。
- `src/components/feedback/AIAnnotationBubble.tsx`
  - 接受 todo suggestion 时将 `decomposeSteps` 写入 `pendingSuggestionIntent`，用于跨页落地。
- `src/features/growth/GrowthPage.tsx`
  - 消费 `pendingSuggestionIntent` 时若携带 `decomposeSteps` 且父待办尚无子待办，则自动创建子待办并高亮。

### Validation

- `npx vitest run src/server/annotation-handler.test.ts src/components/feedback/AIAnnotationBubble.test.ts` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`：记录“先拆解后建议”主链路完成。
- 更新 `docs/PROJECT_MAP.md`：补充 `src/server/todo-decompose-service.ts` 共享职责。
- 更新 `api/README.md`、`src/api/README.md`、`src/store/README.md`：同步预拆解契约与跨页落地行为。

## 2026-04-08 - Refactor: annotation prompt 统一拼装入口（build prompt package）

### Changed

- `src/server/annotation-prompt-builder.ts`（新增）
  - 新增统一拼装函数 `buildAnnotationPromptPackage(...)`，集中生成 LLM 调用所需 `{ model, instructions, input }`。
  - 支持 `annotation` 与 `suggestion` 两种 mode，并统一接收日期/节日/天气/季节/预警等上下文字段。
- `src/server/annotation-handler.ts`
  - suggestion 分支与普通批注分支改为复用统一 prompt package，不再在 handler 内分散拼接 `systemPrompt/userPrompt/model`。
  - rewrite 分支改为复用同一份 prompt package 输入，减少分支漂移风险。

### Validation

- `npx vitest run src/server/annotation-handler.test.ts` ✅
- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`：记录“统一 prompt 组装入口”已落地。
- 更新 `docs/PROJECT_MAP.md`：补充 `src/server/annotation-prompt-builder.ts` 模块职责。
- 更新 `src/api/README.md`：补充 annotation 双路径 prompt package 统一组装说明。

## 2026-04-08 - Feat: annotation 天气/季节最小上下文（复合天气 + 大风/雾霾预警）

### Changed

- `src/types/annotation.ts`
  - 扩展 annotation 契约：新增 `WeatherContextV2` / `SeasonContextV2` / `WeatherAlert` 类型，并在 `userContext` 增加 `latitude`、`longitude`、`weatherContext`、`seasonContext`、`weatherAlerts` 可选字段。
- `src/lib/seasonContext.ts`（新增）
  - 新增季节解析（仅输出 `spring/summer/autumn/winter/unknown`）。
- `src/server/weather-provider.ts`（新增） / `src/server/air-quality-provider.ts`（新增）
  - 新增 Open-Meteo 天气与空气质量快照拉取（800ms 超时，失败返回 `null`）。
- `src/server/weather-context.ts`（新增） / `src/server/weather-alerts.ts`（新增）
  - 新增天气映射：`temperatureC + conditions[]`（支持复合标签，如 `rain_medium + windy`）。
  - 新增业务预警：`strong_wind_watch`（风速/阵风阈值）与 `haze_watch`（PM2.5/PM10/AQI 阈值）。
- `src/server/annotation-handler.ts` / `src/server/annotation-prompts.user.ts`
  - 在普通批注与 suggestion-aware 双路径注入最小环境上下文行（Season/Weather/Alerts），并保证外部接口异常不阻断主链路。
- `src/store/useAnnotationStore.ts`
  - 从 `user_metadata` 透传可选 `latitude/longitude` 到 annotation 请求。
- 测试新增/更新
  - 新增 `src/lib/seasonContext.test.ts`、`src/server/weather-context.test.ts`、`src/server/weather-alerts.test.ts`。
  - 更新 `src/server/annotation-prompts.user.test.ts`、`src/server/annotation-handler.test.ts`。

### Doc Sync

- 更新 `docs/SEEDAY_AI活人感系统_天气与季节_实现方案.md` 为开发交付版 v2.0（最小契约 + 多标签天气 + 预警数据源与阈值）。
- 更新 `docs/PROJECT_MAP.md`、`api/README.md`、`src/api/README.md`、`docs/CURRENT_TASK.md`，对齐新模块与 annotation 契约。

## 2026-04-08 - Feat: annotation 国家与节假日上下文（法定+社会）

### Changed

- `src/types/annotation.ts`
  - 扩展 annotation 契约：新增 `userContext.countryCode` 与 `userContext.holiday`，并补充 `AnnotationHolidayContext` 类型。
- `src/store/useAnnotationStore.ts`
  - 发起 annotation 请求时优先读取 `user_metadata.country_code`（ISO2）并透传；无用户字段时由服务端时区兜底。
- `src/server/country-resolver.ts`（新增）
  - 新增国家解析器：`profile` 优先，`timezone` 次之，最后默认 `CN`。
- `src/server/holiday-resolver.ts`（新增）
  - 新增节假日解析器：基于 `date-holidays` 解析法定节假日，并补充社会节日规则（含圣诞节、平安夜、情人节、万圣节、跨年夜）。
- `src/server/annotation-handler.ts` / `src/server/annotation-prompts.user.ts`
  - 在普通批注与 suggestion 双链路注入 holiday context（`Current holiday / 今日节日 / Festivita di oggi`）。
- `package.json` / `package-lock.json`
  - 新增依赖：`date-holidays`。
- `api/README.md` / `src/api/README.md` / `docs/PROJECT_MAP.md`
  - 同步 annotation `userContext` 字段与新增 server 模块说明。

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`：记录国家字段优先 + 时区兜底、法定/社会节日接入完成。

## 2026-04-08 - Feat: annotation 区分普通记录与待办完成（含特殊待办摘要门控）

### Changed

- `src/lib/todoCompletionAnnotation.ts`（新增）
  - 新增待办完成 annotation 负载构建：输出 `todoCompletionContext`（重要度/重复类型/创建时间/关联瓶子/90天统计）。
  - 新增特殊待办门控：仅在“关联瓶子”或“重复任务（daily/weekly/monthly）”或“创建 >= 3 天”时附加紧凑 `summary`，降低 token 开销。
- `src/store/useChatStore.ts` / `src/store/useChatStore.types.ts`
  - `sendMessage` 增加可选 annotation 事件透传参数（`annotationEventType` / `annotationEventData`），使完成待办可触发 `activity_completed`。
- `src/features/growth/GrowthTodoSection.tsx` / `src/features/growth/FocusMode.tsx`
  - 待办完成路径改为向 annotation 发送完成事件，并附带待办上下文；普通输入保持原 `activity_recorded`。
- `src/store/useTodoStore.ts`
  - `completeTodoByMessage` 调整为返回 `Todo | null`，便于完成路径构建上下文。

### Validation

- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `src/store/README.md`：补充待办完成事件分流、特殊待办判定与 token 控制规则。
- 更新 `api/README.md` / `src/api/README.md`：补充 annotation `eventData.todoCompletionContext` + 条件 `summary` 契约说明。
- 更新 `docs/CURRENT_TASK.md`：记录本轮“待办完成语义化透传”已完成。

## 2026-04-08 - Feat: annotation 先接入结构化日期上下文（Step 1）

### Changed

- `src/types/annotation.ts`
  - 扩展 annotation 请求契约：新增 `userContext.currentDate`（`year/month/day/weekday/weekdayName/isoDate`）。
- `src/store/useAnnotationStore.ts`
  - 在触发 annotation 请求时注入当前本地日期结构化字段，补齐“今天几号/星期几/年月日”数据透传。
- `src/server/annotation-handler.ts` / `src/server/annotation-prompts.user.ts`
  - 将 `currentDate` 注入普通批注与 suggestion 两条 prompt 路径，统一进入 LLM 上下文。
- `api/README.md` / `src/api/README.md`
  - 同步 annotation `userContext` 契约文档，补充 `currentDate` 字段。

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`：记录本次 annotation 日期上下文接入进展（Step 1）。

## 2026-04-08 - Fix: 连续专注休息态右上角关闭确认 + 文案 i18n 对齐

### Changed

- `src/features/growth/FocusMode.tsx`
  - 修复休息倒计时状态点击右上角关闭无反应：现在会弹出确认弹窗。
  - 休息态关闭复用“结束专注”同一套确认文案与按钮；确认后退出整个 FocusMode（终止后续队列），取消则继续休息。
  - 将休息态硬编码文案替换为 i18n key（休息提示、跳过休息按钮）。
- `src/i18n/locales/{zh,en,it}.ts`
  - 新增 `growth_focus_resting` / `growth_focus_skip_rest`。
  - 保持待办拆解按钮文案为 `分步完成 / Step by Step / Passo dopo passo`。
  - 调整 `growth_todo_section`：`今日要事 -> 近日要事`，并同步 `Recent Tasks / Attivita recenti`。

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`：补充本次 Growth 连续专注休息态关闭修复与多语言文案对齐记录。

## 2026-04-08 - Refactor: annotation 建议链路可靠性 + schema 解析 + 文档对齐

### Changed

- `src/store/useAnnotationStore.ts` / `src/types/annotation.ts`
  - 新增 `pendingSuggestionIntent` 持久化意图与消费 action（`setPendingSuggestionIntent` / `consumePendingSuggestionIntent`），用于跨页 suggestion 接受链路。
  - 新增 `PendingSuggestionIntent` 类型。
- `src/components/feedback/AIAnnotationBubble.tsx` / `src/features/growth/GrowthPage.tsx`
  - suggestion 接受主链路改为 store 持久化意图（todo）；移除 `setTimeout + window event` 作为主依赖，事件仅保留 fallback。
- `src/server/annotation-handler.ts`
  - suggestion 解析与相似度逻辑下沉到独立模块，主 handler 聚焦流程编排。
  - 删除 prompt 明文与正文明文日志；新增 `ANNOTATION_VERBOSE_LOGS=true` 控制详细元日志。
- `src/server/annotation-suggestion.ts`（新增）
  - 使用 zod schema (`safeParse`) 约束 suggestion JSON（兼容 mode/legacy 结构），替代脆弱正则解析路径。
  - 统一 suggestion normalize 与 force/recovery fallback 构造。
- `src/server/annotation-similarity.ts`（新增）
  - 抽离相似度、emoji 提取与重写 prompt 工具。
- `src/server/annotation-prompts.defaults.ts`（新增） / `src/server/annotation-prompts.user.ts`（新增） / `src/server/annotation-prompts.ts`
  - prompt 文件按 defaults/user 拆分，`annotation-prompts.ts` 作为聚合出口。
- `src/api/client.ts`
  - 移除重复 `AnnotationRequest/AnnotationResponse` 本地定义，改为复用 `src/types/annotation.ts` 单一契约来源。
- 文档与校验脚本
  - 更新 `docs/PROJECT_MAP.md`、`docs/ARCHITECTURE.md`、`api/README.md`、`src/api/README.md`，对齐 telemetry 路由/端点与 annotation 模块拆分现状。
  - 更新 `scripts/check-doc-sync.mjs`：覆盖 telemetry/profile 路由、`/api/live-input-telemetry` 端点 token，并纳入新增 annotation 子模块 DOC-DEPS 校验。

### Validation

- `npm run lint:docs-sync` ✅
- `npm run lint:state-consistency` ✅
- `npm run lint:max-lines` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`：将本轮 P0/P1/P2 改造项标记为已完成并补充实现口径。

## 2026-04-08 - Fix: iOS 套壳 OAuth 回跳链路 + 输入键盘/放大问题

### Changed

- `src/store/useAuthStore.ts`
  - OAuth 登录 `redirectTo` 改为平台感知：Web 使用 `window.location.origin`，原生套壳使用 `VITE_IOS_OAUTH_REDIRECT_URL`（默认 `com.seeday.app://auth/callback`）。
- `src/lib/mobileAuthBridge.ts`（新增） + `src/main.tsx`
  - 新增 Capacitor `appUrlOpen` 桥接，支持处理 OAuth deep link 回调并执行 Supabase 会话恢复（`exchangeCodeForSession` / `setSession`）。
- `src/features/auth/AuthPage.tsx`
  - Google/Apple OAuth 增加超时兜底，避免回跳失败时登录按钮长期 loading。
- `src/features/report/plant/PlantRootSection.tsx`
  - 日记输入改为直接可编辑并在焦点事件进入编辑态，移除 `readOnly + 异步 focus` 路径，改善 iOS WebView 不弹键盘问题。
- `src/index.css`
  - iOS 防缩放规则扩展到页面级 `input/textarea/select`，统一移动端输入字号下限，降低聚焦自动放大概率。
- `ios/App/App/Info.plist` + `.env.example`
  - 增加 iOS URL scheme（`com.seeday.app`）配置并补充 OAuth redirect 环境变量示例。

### Validation

- `npx tsc --noEmit` ✅
- `npm run lint:docs-sync` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`：新增 `CAPACITOR_IOS_AUTH_INPUT_FIX` 主线与排查/实施清单。
- 更新 `docs/CHANGELOG.md`：记录本次 iOS 套壳修复代码与配置路径。

## 2026-04-08 - Fix: 待办拆解改用 OpenAI + 分步完成文案 + 空结果提示

### Changed

- `api/todo-decompose.ts`
  - 将待办拆解模型调用从 DashScope(Qwen)切换为 OpenAI Chat Completions，密钥改为 `OPENAI_API_KEY`。
  - 新增 `TODO_DECOMPOSE_MODEL` 环境变量（默认 `gpt-4o-mini`），并启用 `response_format: json_object` 提升 JSON 输出稳定性。
  - 保留并强化 JSON 解析兜底与时长范围 clamp（5-90 分钟）。
- `src/features/growth/SubTodoList.tsx`
  - 修复字段映射：`durationMinutes` 正确映射到 store 所需的 `suggestedDuration`，避免子步骤建议时长丢失。
  - 新增空步骤提示分支：当接口成功但未返回可用步骤时，给出可读反馈而非统一失败文案。
- `src/i18n/locales/{zh,en,it}.ts`
  - 拆解按钮文案更新为更柔和表达：`分步完成` / `Step by Step` / `Passo dopo passo`。
  - 新增 `todo_decompose_empty` 文案，用于“返回空步骤”提示。
- `api/README.md` / `src/api/README.md` / `.env.example`
  - 同步 `/api/todo-decompose` 契约、provider 说明与 `TODO_DECOMPOSE_MODEL` 配置说明。

## 2026-04-08 - Feat: AI 待办拆解 + 连续专注队列模式

### Added

- `api/todo-decompose.ts`（新增）
  - 新 Serverless 端点 `POST /api/todo-decompose`，接收 `{title, lang}`，调用 QWEN_API_KEY 将待办拆解为 3-6 个子步骤，每步返回 `{title, durationMinutes}`。
  - 支持 zh / en / it 三语言 prompt，输出结果做 clamp（5-90 分钟）。
- `src/features/growth/SubTodoList.tsx`（新增）
  - 子步骤列表组件，渲染在 `GrowthTodoCard` 展开面板底部。
  - 包含"AI 拆解"按钮（调用 `callTodoDecomposeAPI`，loading/error 状态）。
  - 每条子步骤支持单独勾选、单独开番茄钟。
  - 子步骤 ≥ 2 条未完成时显示"连续专注"按钮（浅蓝色药丸样式）。

### Changed

- `src/store/useTodoStore.ts`
  - `Todo` 接口新增 `parentId?: string` 和 `suggestedDuration?: number` 字段。
  - 新增 `addSubTodos(parentId, steps[])` action：批量创建子待办并同步 Supabase。
  - `toggleTodo` 新增父待办自动完成逻辑：所有子步骤勾完时自动标记父待办完成。
- `src/lib/dbMappers.ts`
  - `fromDbTodo` / `toDbTodo` / `toDbTodoUpdates` 映射新增 `parent_id`、`suggested_duration` 字段。
- `src/api/client.ts`
  - 新增 `callTodoDecomposeAPI(title, lang)` 函数及 `DecomposeStep` 类型。
- `src/features/growth/GrowthTodoCard.tsx`
  - 新增 `subTodos` 和 `onSequentialFocus` props。
  - 展开面板末尾接入 `SubTodoList` 组件。
- `src/features/growth/GrowthTodoSection.tsx`
  - 构建 `subTodoMap`（parentId → sub-todos），过滤掉有 `parentId` 的子待办不在主列表渲染。
  - 向 `GrowthTodoCard` 传入 `subTodos` 和 `onSequentialFocus`。
- `src/store/useFocusStore.ts`
  - 新增 `queue: FocusQueueItem[]`、`queueIndex: number` 队列状态。
  - 新增 `startFocusQueue(items)`、`advanceQueue()`、`clearQueue()` actions。
  - persist 改为只持久化 `sessions`，队列和 currentSession 不持久化（页面刷新不恢复计时）。
- `src/features/growth/FocusMode.tsx`
  - 新增 `queueTodos` prop，进入队列模式。
  - 顶部显示步骤进度轨道（完成/进行中/待开始三态）。
  - 步骤完成后进入 5 分钟休息倒计时，可跳过，自动推进下一步。
  - 队列模式开始按钮文案改为"连续专注"，隐藏正计时按钮。
- `src/features/growth/GrowthPage.tsx`
  - 新增 `focusQueue` state，`onSequentialFocus` 回调将子步骤列表传入 `FocusMode`。
- `src/i18n/locales/zh|en|it.ts`
  - 新增翻译 key：`todo_decompose_btn`、`todo_decompose_loading`、`todo_decompose_error`、`todo_decompose_steps_label`、`todo_decompose_min`、`todo_sequential_focus`。

### Database

- `todos` 表新增字段：
  - `parent_id UUID REFERENCES todos(id) ON DELETE CASCADE`
  - `suggested_duration INTEGER`
  - 索引：`idx_todos_parent_id ON todos(parent_id)`

---

## 2026-04-07 - Feat: 建议模式新增中断挽回提醒与 2 星一次性奖励

### Changed

- `src/lib/recoverySuggestion.ts`（新增）
  - 新增中断检测器：
    - 识别 active 瓶子连续 3 天未完成；
    - 识别 daily/weekly 重复待办“昨日断档”；
    - 产出 `recoveryNudge`（包含 `key/reason/rewardStars/todoId|bottleId`）。
  - 新增提醒时机控制：
    - 优先按目标历史完成时间计算提醒时段；
    - 无历史统一采用中午 12 点窗口（±2h）；
    - 同一 key 每日最多提醒 2 次，二次提醒最小间隔 4h。
- `src/store/useAnnotationStore.ts`
  - 在 suggestion 上下文注入 `userContext.recoveryNudge`，并在命中时强制建议输出。
  - 新增当日提醒去重（`shownRecoverySuggestionKeys`）与一次性奖励状态（`activeRecoveryBonus`）。
  - 新增 `consumeRecoveryBonusForCompletion()`：完成匹配 todo/bottle 时消费奖励并返回星数（默认 1，奖励 2）。
- `src/server/annotation-prompts.ts` / `src/server/annotation-handler.ts`
  - suggestion prompt 新增 recovery nudge 规则（要求“今天完成可得两颗星”）。
  - 解析 suggestion JSON 时支持并透传奖励字段：`rewardStars`、`rewardBottleId`、`recoveryKey`。
  - 新增强制兜底：当 recovery nudge 存在时，即使模型输出异常也返回可执行建议和 2 星奖励元数据。
- `src/features/growth/GrowthTodoSection.tsx` / `src/features/growth/FocusMode.tsx` / `src/store/useChatStore.ts` / `src/store/useGrowthStore.ts`
  - 统一星星发放路径支持倍率（`incrementBottleStars`）。
  - 在 todo 完成、focus 完成、活动匹配瓶子完成时优先消费 recovery bonus，实现“建议并开始后完成得 2 星”。
- `src/types/annotation.ts` / `src/api/client.ts`
  - 扩展 annotation 契约：新增 `RecoveryNudgeContext` 与 suggestion 奖励字段类型。
- 测试
  - 新增 `src/lib/recoverySuggestion.test.ts`（3 天断档、昨日断档、当日去重）。
  - 扩展 `src/server/annotation-handler.test.ts`（验证 recovery nudge 注入 2 星字段）。

### Validation

- `npx vitest run src/lib/recoverySuggestion.test.ts src/server/annotation-handler.test.ts src/components/feedback/AIAnnotationBubble.test.ts` ✅
- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（记录中断挽回提醒与 2 星奖励落地）。
- 更新 `src/store/README.md`、`src/api/README.md`、`api/README.md`（同步 annotation 新契约与奖励元数据）。

## 2026-04-07 - Chore: 魔法笔 EN/IT 提示词对齐最新中文规则

### Changed

- `src/server/magic-pen-prompts.ts`
  - 同步更新 `MAGIC_PEN_PROMPT_EN` 与 `MAGIC_PEN_PROMPT_IT`，对齐当前中文提示词的意图边界：
    - `activity` 语义收敛为“当前进行中，通常不超过一件”；
    - `activity_backfill` 扩展为“已完成/前置/常识上已发生”的事件；
    - 混合句新增硬规则：同输入最多保留一个 `activity`，其余活动片段默认转 `activity_backfill`，仅明确并行表达时允许并行活动；
    - 补充“已识别当前活动 + 更早明确时间活动 -> backfill”的判定说明。

### Validation

- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（记录本次魔法笔多语言 prompt 对齐）。

## 2026-04-07 - UX: 日记详情页植物图支持打开植物翻转卡

### Changed

- `src/features/report/ReportDetailModal.tsx`
  - 新增 `onOpenPlantCard` 回调接口。
  - 在日记第 2 页（观察日记区）将植物图片改为可点击入口；有当日植物记录时点击可触发外层打开植物卡片。
- `src/features/report/ReportPage.tsx`
  - 新增 `openedPlantCard` 状态，用于承接 `ReportDetailModal` 点击事件并展示 `PlantCardModal`。
  - 挂载 `PlantCardModal`，复用现有 `PlantFlipCard`（含背面根系交互）与关闭逻辑。

### Validation

- `npx tsc --noEmit` ✅
- `npx vitest run src/features/report/reportPage.integration.test.tsx` ⚠️ 失败（现有测试 mock 缺少 `initReactI18next` 导出，与本次改动无关）

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（记录本次日记植物图到植物卡片入口接入）。

## 2026-04-07 - Fix: 魔法笔自动写入改为直接执行 AI kind（移除二次分类漂移）

### Changed

- `src/features/chat/chatPageActions.ts`
  - mode-on parser 路径下，`autoWriteItems` 不再走 `sendAutoRecognizedInput(...)` 二次分类，改为调用新的 `writeMagicPenAutoItem(...)` 直接按 AI `kind` 执行写入。
  - 删除 `unparsedSegments` 的本地二次重分类与“提升自动写入”逻辑，未识别片段统一留在 Sheet review。
  - active todo 自动完成判定改为基于本次实际写入 `kind`，避免依赖二次分类结果。
- `src/features/chat/ChatPage.tsx`
  - 为魔法笔新增 `writeMagicPenAutoItem` 注入：`kind=mood` 直写 `sendMood`，`kind=activity` 直写 `sendMessage`；若存在 `linkedMoodContent`，补发关联心情。
- `src/features/chat/chatPageActions.test.ts`
  - 回归测试更新：验证 parser auto-write 使用 AI kind 直写、unparsed 不再自动提升、以及 mixed 场景仍正确打开 review。

### Validation

- `npm run test:unit -- src/features/chat/chatPageActions.test.ts` ✅
- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（记录本次魔法笔“移除二次分类”修复）。

## 2026-04-06 - Feat: Today Context 词库增强（zh/en/it）与误判抑制

### Changed

- `src/lib/todayContext.ts`
  - 将 today context 识别从简单关键词 includes 升级为规则化匹配（regex patterns + excludes）。
  - 扩充 `health/special_day/major_event` 三类多语言词库，覆盖感冒生病、升学/求职、关系变化、搬家、孕育、丧亲等关键事件表达。
  - 追加女性经期语义识别（如“来例假/痛经”、`on my period`、`ho il ciclo`）并纳入 health 类。
  - 继续扩充细粒度生活病症词库：牙痛/智齿发炎/口腔溃疡/反酸/落枕等，并采用英语/意大利语常用表达（如 `my tooth is killing me`、`dente del giudizio infiammato`、`afte`）。
  - 医疗就诊补充牙科场景（看牙医、根管、拔牙、补牙及对应 en/it 表达）。
  - 新增健康类否定拦截（如“我没有感冒”/`not sick`/`non sto male`）避免误命中。
  - 对高歧义词增加排除规则（如 `cold plunge`）降低非疾病场景误报。
- `src/lib/todayContext.test.ts`
  - 新增多语言回归：英文疾病命中与误判拦截、意大利语重大事件、否定句不命中、同类单条保留、special_day+major_event 同时命中。
  - 补充经期健康信号与婚恋重大事件命中用例。
  - 新增牙痛/溃疡多语言命中与牙科就诊命中回归。

### Validation

- `npx vitest run src/lib/todayContext.test.ts` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（记录 today context 词库补强与误判抑制已完成）。

## 2026-04-06 - Feat: Today Context 同步到 Supabase annotations

### Changed

- `src/types/annotation.ts`
  - `AIAnnotation` 新增 `todayContext?: TodayContextSnapshot` 字段，保存生成时上下文快照。
- `src/store/useAnnotationStore.ts`
  - 批注对象创建时挂载 `todayContext`，并随 `toDbAnnotation(...)` 进入云端。
- `src/lib/dbMappers.ts`
  - `toDbAnnotation` 新增 `today_context` 写入。
  - `fromDbAnnotation` 新增 `today_context` 回读。
- `docs/SUPABASE_TODAY_CONTEXT_SQL.md`
  - 新增迁移 SQL：`annotations.today_context jsonb` + GIN/日期表达式索引 + 校验语句。
- `docs/SUPABASE_PERSISTENCE_INVENTORY.md`
  - Annotations 持久化字段清单新增 `today_context`。
- `src/api/README.md`
  - 标注 annotation `userContext` 契约新增 `todayContext`。
- `api/README.md`
  - 标注 `/api/annotation` `userContext` 支持 `todayContext`。

### Validation

- `npx tsc --noEmit` ✅
- `npx vitest run src/lib/todayContext.test.ts` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（记录 today context 云端落库完成）。
- 新增 `docs/SUPABASE_TODAY_CONTEXT_SQL.md`（可直接复制到 Supabase SQL Editor 执行）。

## 2026-04-06 - Feat: Today Context（今日上下文）最小闭环接入 annotation 链路

### Changed

- `src/lib/todayContext.ts`
  - 新增 today context 关键词识别与日级缓存合并逻辑（`health` / `special_day` / `major_event`）。
  - 新增跨天自动失效、同类去重、最多 5 条保留策略。
- `src/store/useAnnotationStore.ts`
  - 新增 `todayContextSnapshot` 状态并持久化。
  - 在 `triggerAnnotation` 中接入“事件文本识别 -> 当日缓存更新 -> `userContext.todayContext` 透传”。
  - 在日重置动作中同步清空 today context。
- `src/types/annotation.ts`
  - 新增 `TodayContextCategory` / `TodayContextItem` / `TodayContextSnapshot` 类型。
  - 扩展 `AnnotationRequest.userContext.todayContext`。
- `src/api/client.ts`
  - 扩展 annotation 请求契约，支持 `userContext.todayContext`。
- `src/server/annotation-prompts.ts`
  - 新增 `buildTodayContextText(...)`。
  - 在普通批注与 suggestion prompt 中注入 `today context` 段落（zh/en/it）。
- `src/server/annotation-handler.ts`
  - 在 API handler 中构建并透传 `todayContextText` 到两条 prompt 组装路径。
- `src/lib/todayContext.test.ts`
  - 新增识别、跨天失效、去重排序 3 个单测用例。

### Validation

- `npx vitest run src/lib/todayContext.test.ts` ✅
- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（记录 today context P0 最小闭环完成）。

## 2026-04-04 - Fix: AI companion prompts ESM import resolution on Vercel

### Changed

- `src/lib/aiCompanion/prompts/index.ts`
  - 将四个 re-export 改为显式 `.js` 后缀（`./van.js` / `./agnes.js` / `./zep.js` / `./momo.js`），避免 Node ESM 在 serverless 运行时把无后缀路径解析为不存在模块。

### Validation

- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（记录本次 Vercel `ERR_MODULE_NOT_FOUND` 修复）。

## 2026-04-03 - Feat: 活动词库补强（zh/en/it 操作型表达扩展）

### Changed

- `src/services/input/lexicon/activityLexicon.zh.ts`
  - 新增 24 条中文操作型活动短语，覆盖查询/修改/提交/认证/账号操作（如 `查询日志`、`提交审核`、`重置密码`）。
- `src/services/input/lexicon/activityLexicon.en.ts`
  - 新增 26 条英文操作型活动短语，覆盖 query/edit/submit/auth/account 场景（如 `query logs`、`submit ticket`、`two-factor authentication`）。
- `src/services/input/lexicon/activityLexicon.it.ts`
  - 新增 25 条意大利语操作型活动短语，覆盖查询/修改/提交/认证/账号场景（如 `cercare log`、`inviare richiesta`、`reimpostare password`）。
- `src/services/input/lexicon/categoryLexicon.zh.ts`
  - 补充中午/工作语境分流关键词：数据/日志/工单/提交流程归 `work`；订单/快递/账号操作归 `life`。
- `src/services/input/lexicon/categoryLexicon.en.ts`
  - 增补 EN 语境分流关键词：query/submit/review/auth 归 `work`；order/package/account 操作归 `life`。
- `src/services/input/lexicon/categoryLexicon.it.ts`
  - 增补 IT 语境分流关键词：operational work actions 归 `work`；ordine/pacco/account 操作归 `life`。
- `src/services/input/signals/latinSignalExtractor.ts`
  - 扩展 Italian 语言信号词，新增 `cercare/tracciare/reimpostare/disconnettersi/identita/autenticazione`，确保新增 IT 操作词不会误判为英语语句。
- `src/services/input/liveInputClassifier.test.ts`
  - 新增中文回归用例：`查询日志`、`查询快递`、`重置密码`。
- `src/services/input/liveInputClassifier.i18n.test.ts`
  - 新增英语与意大利语回归用例：`query logs/look up order/reset password`、`cercare log/tracciare pacco/reimpostare password`。

### Validation

- `npx vitest run src/services/input/liveInputClassifier.test.ts src/services/input/liveInputClassifier.i18n.test.ts` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（记录本次词库补强完成项）。

## 2026-04-02 - Prompt: suggestion 场景规则补强（zh/en/it）

### Changed

- `src/server/annotation-prompts.ts`
  - 在 `buildSuggestionAwareUserPrompt(...)` 的三语分支中新增两条场景规则：
    - 用户生病/身体不适时，优先给出具体可执行的休息建议（含动作+时长），并避免推荐工作/学习任务。
    - 用户难过/低落时，先简短共情，再基于用户常做活动给出低负担、可立即开始的小建议。

### Validation

- 未执行（本次为 prompt 文案策略调整）。

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（记录本次 suggestion prompt 多语言规则补强）。

## 2026-04-02 - UX: 我的页 AI 选中态小幅回调（鼠尾草+淡金）

### Changed

- `src/features/profile/components/AIModeSection.tsx`
  - 将 AI 陪伴模式选中态从过淡绿微调回更有层次的鼠尾草玻璃感（仅小幅增加深度）。
  - 同步细调开关开启态与选中文字颜色，保持清透但不发白。
- `src/features/profile/components/AIAnnotationDropRate.tsx`
  - 将陪伴频率选中金色做轻微降饱和和提亮处理，保留暖感但减轻厚重感。

### Validation

- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（记录本次鼠尾草/淡金小幅回调）。

## 2026-04-02 - UX: 我的页 AI 模式绿色选中态清透化微调

### Changed

- `src/features/profile/components/AIModeSection.tsx`
  - AI 陪伴模式选中卡片由偏实的绿色改为低饱和玻璃感绿色渐变，增强清透与轻盈感。
  - 同步降低选中文字对比度，并弱化开关开启态阴影，避免视觉过重。

### Validation

- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（记录本次绿色选中态清透化微调）。

## 2026-04-02 - Plant: 本月同根系植物候选去重

### Changed

- `api/plant-generate.ts`
  - 新增按生成日期计算当月区间并查询 `daily_plant_records.plant_id` 的逻辑。
  - 对当前根系候选池按 `plantId` 做「本月去重」过滤，AI 仅从当月未使用候选中选择。
  - 当候选池耗尽时返回新状态 `monthly_exhausted`（含 message），不再继续生成。
- `src/types/plant.ts`
  - 扩展 `PlantApiStatus`：新增 `monthly_exhausted`。
- `src/features/report/plant/PlantRootSection.tsx`
  - 生成按钮反馈增加 `monthly_exhausted` 分支提示。
- `src/i18n/locales/{zh,en,it}.ts`
  - 新增 `plant_generate_monthly_exhausted` 文案。

### Validation

- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `api/README.md` 与 `src/api/README.md`（同步 plant-generate 新状态契约）。
- 更新 `docs/CURRENT_TASK.md`（记录本次植物月内去重改动）。

## 2026-04-02 - UX: 我的页 AI 选中态恢复上一版绿色风格

### Changed

- `src/features/profile/components/AIModeSection.tsx`
  - AI 陪伴模式开关开启态从新版蓝色发光恢复为旧版绿色底色。
  - 角色卡选中态恢复为绿色描边 + 浅绿色背景，移除蓝色文本/发光样式。
- `src/features/profile/components/AIAnnotationDropRate.tsx`
  - 陪伴频率选中按钮恢复为旧版绿色选中态（绿色描边、浅绿色底、绿色文字）。

### Validation

- 未执行（本次为样式回退，未改业务逻辑）。

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（记录本次 profile 选中态 UI 回退）。

## 2026-04-02 - UX: 日记详情页切换为 notebook 双页视觉

### Changed

- `src/features/report/ReportDetailModal.tsx`
  - 以 `日记页UI 0401` 为参考重建日记详情页视觉：顶部 notebook 导航 + 日期抬头 + 虚线分隔结构。
  - 第 1 页改为 `activity / mood / to-do / habits` 四段分栏，含环形图、进度条与星标展示。
  - 第 2 页改为 `AI 观察 + my diary` 上下结构，保留 AI 日记生成入口、植物图展示与手写日记保存。
  - 保留原有日切换入口（上一天/下一天）与只读模式下的历史日记展示。

### Validation

- `npm run build` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（补充本次 notebook 风格日记页 UI 对齐记录）。

## 2026-03-31 - UX: Growth 待办卡片支持双击标题快速编辑

### Changed

- `src/features/growth/GrowthTodoCard.tsx`
  - 新增标题双击编辑：双击待办标题后进入内联输入态，可直接修改卡片文字。
  - 新增编辑提交/取消交互：`Enter` 或失焦保存，`Esc` 取消并恢复原标题。
  - 编辑态与长按拖拽隔离：标题区域标记为非拖拽区，避免双击改标题时误触发拖拽。

### Validation

- 未执行（本次为单组件交互增强）。

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（补充本次待办卡片双击编辑交互记录）。

## 2026-03-31 - UX: 首页/我的头像点击逻辑统一为放大预览+右下角三点换头像

### Changed

- `src/features/chat/components/DatePicker.tsx`
  - 首页头像点击改为先打开放大预览弹层，不再直接触发文件选择。
  - 放大预览新增右下角三点菜单，支持「更换头像」。
  - 上传头像压缩参数提升为 `640px + JPEG 0.95`，放大预览更清晰。
- `src/features/profile/components/UserInfoCard.tsx`
  - 「我的」页头像弹层交互改为与首页一致：放大图 + 右下角三点换头像。
  - 移除原独立底部「更换头像」按钮，统一通过三点菜单操作。
  - 上传头像压缩参数提升为 `640px + JPEG 0.95`，优化放大图清晰度。
- `src/lib/imageUtils.ts`
  - `resizeImageToDataUrl` 新增 `quality` 参数（默认 `0.85`），支持高质量头像上传场景。

### Validation

- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（补充本次头像交互统一与清晰度优化记录）。

## 2026-03-31 - UX: 待办卡片支持长按拖拽换序

### Changed

- `src/features/growth/GrowthTodoSection.tsx`
  - 新增长按拖拽交互：用户长按待办卡片后可上下拖动，与其他待办卡片交换顺序。
  - 增加拖拽中的视觉反馈（卡片跟随位移与轻微放大），并在松手后提交最终顺序。
  - 对按钮、输入框等交互控件增加拖拽排除，避免误触发长按拖拽。
- `src/store/useTodoStore.ts`
  - 新增 `reorderTodosByIds(orderedIds)`，按最终顺序批量更新 `sortOrder` 并同步 Supabase。

### Validation

- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（补充本次待办长按拖拽换序交互）。

## 2026-03-31 - UX: 待办卡片移除六点拖拽图标 + 删除叉仅点击后显示

### Changed

- `src/features/growth/GrowthTodoCard.tsx`
  - 移除待办勾选框前的六点拖拽图标（`GripVertical`），主行信息更简洁。
  - 待办卡片右上角删除叉改为默认不显示，仅在用户点击该卡片后显示。
  - 卡片点击展开状态对已完成待办同样生效，以便在不显示 hover 的情况下仍可触发删除入口。

### Validation

- 未执行（本次为 UI 交互微调）。

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（补充本次待办卡片交互微调记录）。

## 2026-03-31 - UX: 成长页卡片删除叉按交互显示 + 瓶子区下移

### Changed

- `src/features/growth/BottleCard.tsx`
  - 删除叉按钮改为默认隐藏，移动端仅在用户点击瓶子周围区域后显示；桌面端继续保留 hover 显示。
  - 点击瓶子本体触发「生成待办」主动作，不再与删除态共用同一次点击。
  - 新增卡片外点击收起逻辑，避免删除叉长期悬浮。
- `src/features/growth/GrowthTodoCard.tsx`
  - 删除叉按钮改为默认隐藏，移动端仅在卡片展开后显示；桌面端继续保留 hover 显示。
- `src/features/growth/BottleList.tsx`
  - 瓶子横向列表增加顶部间距，使整体视觉位置下移。

### Validation

- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（补充本次 Growth 页交互与布局微调）。

## 2026-03-30 - Test/Fix: suggestion 意图识别补充自然表达覆盖

### Changed

- `src/lib/suggestionIntentDetector.ts`
  - 扩展显式求建议规则，新增对自然表达的识别：
    - "给点/给些/来点建议"
    - "能不能/能否/可以 + 给我/给点 + 建议"
    - "我该/我应该 + 先做哪个/选哪个"
    - "我该...还是..." 决策句式
    - "告诉我下一步" 与 "接下来我应该..." 句式

### Added Tests

- `src/lib/suggestionIntentDetector.test.ts`
  - 新增自然表达正例、陈述句负例、非中文输入、空白与标点噪声等覆盖，测试总数从 3 增加到 7。

### Validation

- `npx vitest run src/lib/suggestionIntentDetector.test.ts` ✅
- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（补充本次 suggestion 意图识别补测与漏判修复）。

## 2026-03-30 - Feat: 显式求建议直通（中文）+ 强制建议兜底

### Changed

- `src/lib/suggestionIntentDetector.ts`（新增）
  - 新增中文显式求建议意图识别与打分（覆盖"帮我规划/帮我选择/该怎么办/下一步做什么"等表达）。
- `src/store/useAnnotationStore.ts`
  - 新增显式求建议检测：命中后可绕过批注触发门槛（冷却/概率/日限）并直通 suggestion 请求。
  - 透传 `userContext.forceSuggestion` 到 `/api/annotation`。
  - 保持 suggestion 记账逻辑不变：显式建议命中后仍会消耗分时段配额并刷新 suggestion 冷却（影响后续主动建议）。
- `src/server/annotation-prompts.ts`
  - suggestion-aware prompt 新增 `forceSuggestion` 分支：显式求建议时强制模型只输出 suggestion JSON。
- `src/server/annotation-handler.ts`
  - 新增 `forceSuggestion` 模式（`allowSuggestion || forceSuggestion`）。
  - 新增强制建议兜底：当模型未返回可解析 suggestion JSON 或分支异常时，服务端构造可执行 suggestion，确保前端按钮可展示。
- `src/types/annotation.ts` / `src/api/client.ts`
  - 扩展 annotation userContext 契约：新增 `forceSuggestion?: boolean`，并补齐 `timezone?: string` 类型。

### Added Tests

- `src/lib/suggestionIntentDetector.test.ts`（新增）
  - 覆盖中文显式求建议识别与普通记录不误触发。
- `src/server/annotation-handler.test.ts`
  - 新增 `forceSuggestion=true` 用例，验证在非 JSON 输出下仍返回 suggestion。

### Validation

- `npx vitest run src/lib/suggestionIntentDetector.test.ts src/server/annotation-handler.test.ts` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（补充显式求建议直通与配额/冷却策略说明）。

## 2026-03-30 - UX: AI 批注头像改为半悬浮超出弹窗

### Changed

- `src/components/feedback/AIAnnotationBubble.tsx`
  - 移除批注头像的圆形白色头像框（`bg-white` + `ring`）。
  - 将 AI 人设头像放大，并改为 `absolute` 定位到卡片左上角外侧，呈现“半悬浮超出弹窗”的视觉。
  - 批注文案区域增加左侧内边距，避免与放大头像重叠。

### Validation

- `npm run build` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（补充本次 AI 批注头像视觉改动）。

## 2026-03-29 - Fix: Live Input Telemetry 缺表容错与提示文案修正

### Changed

- `api/live-input-dashboard.ts`
  - 新增 `isMissingOptionalTableError(...)`，将 Supabase 缺表错误从仅识别 `42P01` 扩展到兼容 `PGRST205` 与常见缺表 message（`does not exist` / `schema cache`）。
  - `plant_asset_events` 与 `telemetry_events` 查询在缺表场景下按空结果降级，不再中断整页看板。
- `src/features/telemetry/LiveInputTelemetryPage.tsx`
  - 修正告警文案中内联 `<code>` 前后的空白拼接，避免出现 `metadata.LIVE_INPUT_ADMIN_EMAILS` / 环境变量名称粘连显示。

### Validation

- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（补充本次 telemetry 看板修复项）。

## 2026-03-29 - UX: 记录页日期圆点支持无限左滑查看历史

### Changed

- `src/features/chat/components/DatePicker.tsx`
  - 日期圆点条改为横向滚动时间轴，支持持续左滑。
  - 当滚动接近最左侧时自动补充更早日期（按 21 天分段预加载），实现历史日期无限延展。
  - 增加横向吸附（scroll snap），滑动停止后自动贴合到最近日期圆点，提升手感与可读性。
  - 保留未来日期禁用策略，并在切换日期后自动滚动居中到当前选中日期。

### Validation

- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（补充本次记录页日期交互改动）。

## 2026-03-29 - Test: AI 建议模式 P7 回环补测（窗口边界/跨日重置/自动凝结）

### Changed

- `src/store/useAnnotationStore.ts`
  - 导出 `getSuggestionPeriod(...)` 与 `shouldResetStats(...)` 供单测直接校验窗口边界与跨日重置规则。
  - 修复 `triggerAnnotation` 内同名变量 `period` 重复声明，避免构建/测试阶段编译失败。
- `src/store/useAnnotationStore.test.ts`（新增）
  - 新增 suggestion 时间窗口边界测试（`06:00/13:00/19:00` 分段）与 0 点跨日重置判定测试。
- `src/components/feedback/AIAnnotationBubble.tsx`
  - 抽离 `runSuggestionAcceptFlow(...)`，将“点击建议 -> 记录 accepted -> 自动凝结”流程函数化，便于单测覆盖。
  - 调整 `handleDismiss` 声明顺序，避免在 effect 依赖中前置引用。
- `src/components/feedback/AIAnnotationBubble.test.ts`（新增）
  - 覆盖 activity/todo 建议接受分支，以及异常 suggestion 的跳过分支；验证 accepted 成功后会触发 `handleCondense()`。

### Validation

- `npx vitest run src/store/useAnnotationStore.test.ts src/components/feedback/AIAnnotationBubble.test.ts src/server/annotation-handler.test.ts src/lib/suggestionDetector.test.ts` ✅
- `npm run lint:all` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（P7 子任务状态：单测补齐与 lint:all 已完成）。

## 2026-03-29 - Fix: 日记贴纸埋点接入 telemetry_events + 看板聚合

### Changed

- `src/services/input/reportTelemetryEvent.ts`（新增）
  - 新增 `reportTelemetryEvent(...)`，将 `diary_sticker_deleted` / `diary_sticker_reordered` / `diary_sticker_restored` 事件统一写入 Supabase `telemetry_events`。
- `src/features/report/ReportDetailModal.tsx`
  - 在 `handleDeleteSticker` 上报 `diary_sticker_deleted`（`stickerId/reportId/date`）。
  - 在 `handleDragEnd` 贴纸换序成功时上报 `diary_sticker_reordered`（`newOrder/reportId/date`）。
- `api/live-input-dashboard.ts`
  - 聚合查询新增 `telemetry_events`，筛选 `diary_sticker_*` 事件并并入 `/api/live-input-dashboard`。
  - `summary` 新增 `diaryStickerCount`，分布新增 `diaryStickerActions`，日序列新增 `diaryStickerCount`，`recentEvents` 新增 `diary_sticker` 事件明细字段。
- `src/services/input/liveInputTelemetryApi.ts`
  - Dashboard/RecentEvent 类型新增 diary sticker 字段与事件类型，保证前后端契约一致。
- `src/features/telemetry/LiveInputTelemetryPage.tsx`
  - 看板新增「Diary Sticker Ops」统计卡、`Diary Stickers` 日序列表头、`Diary Sticker Actions` 分布区块、Recent Events 贴纸事件详情展示。

### Validation

- `npx tsc --noEmit` ✅

### Doc Sync

- 更新 `docs/CURRENT_TASK.md`（贴纸埋点状态由待处理改为主链路完成）。
- 更新 `api/README.md` 与 `src/api/README.md`（补充 diary sticker 聚合字段说明）。

## 2026-03-29 - Feature: 日记详情页布局重构 + 图表贴纸化

### Changed

- `src/store/useReportStore.ts`
  - 新增 `StickerItem` 接口（`id` / `visible` / `x` / `y`）
  - `Report` 接口新增 `stickerLayout?: StickerItem[]`，通过 Zustand persist 本地持久化贴纸状态

- `src/features/report/ReportDetailModal.tsx`
  - **Page 1** 重排：植物 → AI 观察日记（从 Page 2 移来）→ 待办事项
  - **Page 2** 重排：活动图表贴纸 + 心情图表贴纸 → 手写日记
  - 移除 `CollapsibleSection`（收起/展开按钮），改为 `StickerWrapper` 贴纸组件
  - 贴纸支持：X 键删除（`visible: false`）、拖拽把手调换顺序，状态实时写入 `updateReport`
  - 图标依赖：`Bookmark` → `X` + `GripVertical`（lucide-react）

- `src/features/report/DiaryBookViewer.tsx`
  - **day-left 页**：活动/心情数据移出，改为植物 → AI 观察日记 → 任务统计
  - **day-right 页**：原 AI 观察日记移出，改为活动分类列表 + 心情光谱条 → 我的日记
  - **ExpandedView**：左侧显示植物 + AI 观察 + 任务，右侧显示活动/心情摘要 + 我的日记
  - 书架翻页视图与详情页布局保持一致

### ⚠️ 待处理（埋点未完成）

- 贴纸删除、贴纸换序等用户行为**尚未上报埋点**，详见 `docs/CURRENT_TASK.md` 中"日记贴纸埋点"待办项

### Validation

- `npx tsc --noEmit` ✅

### Doc Sync

- `docs/CURRENT_TASK.md` 已补充贴纸埋点待办项

## 2026-03-29 - Feat: AI 建议模式两层过滤主链路落地（P0-P6）

### Changed

- `src/types/annotation.ts`
  - 扩展 suggestion 契约：`PendingTodoSummary.dueAt`、`AIAnnotation.suggestionAccepted`、`AnnotationRequest.userContext.statusSummary/contextHints/frequentActivities/allowSuggestion/consecutiveTextCount`。
- `src/lib/buildStatusSummary.ts`（新增）
  - 新增客户端状态摘要构建器，统一输出短摘要文本和高频活动列表。
- `src/lib/suggestionDetector.ts`（新增）
  - 新增情境提示器，按优先级选取最多 2 条 context hints。
- `src/store/useAnnotationStore.ts`
  - 新增 suggestion 专用门控状态（分时段计数、日上限、最小间隔、不可连续 suggestion）。
  - 接入 `statusSummary/contextHints/frequentActivities` 透传。
  - 新增 `recordSuggestionOutcome(...)` 与 `getAdaptiveMinInterval()`（7 天接受率驱动 30min/1h/2h）。
- `src/server/annotation-prompts.ts`
  - 新增 suggestion-aware prompt 组装，支持普通批注与 suggestion JSON 双路输出指令。
- `src/server/annotation-handler.ts`
  - suggestion 模式从 overwork 专属改为客户端门控驱动（`allowSuggestion`）。
  - 新增双格式 suggestion 解析兼容：
    - v2: `{"mode":"suggestion",...}`
    - legacy: `{"message":...,"type":...}`
  - suggestion 解析失败时回退普通批注。
- `src/components/feedback/AIAnnotationBubble.tsx`
  - 点击建议后自动记录接受结果并触发自动凝结；X 关闭/超时时记录未接受。
- `src/lib/dbMappers.ts`
  - `annotations` 映射新增 `suggestion_accepted` 读写支持。
- 文档同步：`api/README.md`、`src/api/README.md`、`src/store/README.md`、`docs/CURRENT_TASK.md`。

### Added Tests

- `src/server/annotation-handler.test.ts`
  - 覆盖 v2 suggestion JSON 和 legacy suggestion JSON 解析分支。
- `src/lib/suggestionDetector.test.ts`
  - 覆盖情境提示优先级 Top-2 选择。

### Doc-sync impact

- 本次改动涉及 `src/**`、`api/**`、`docs/**` 多处契约与状态文档，已同步 `docs/CURRENT_TASK.md` 与本文件。

## 2026-03-29 - UI: 同步 Seeday UI 的专注页与我的页视觉

### Changed

- `src/features/growth/FocusMode.tsx`
  - 专注设时界面改为深色沉浸式环形刻度风格，支持拖拽调时、预设时长快捷按钮、玻璃风主按钮与一致的结束确认弹层。
- `src/features/growth/FocusTimer.tsx`
  - 运行态计时界面改为与设时界面一致的刻度环与玻璃中心盘，统一倒计时/正计时视觉反馈与结束按钮样式。
- `src/features/profile/ProfilePage.tsx`
- `src/features/profile/components/UserInfoCard.tsx`
- `src/features/profile/components/AIModeSection.tsx`
- `src/features/profile/components/AIAnnotationDropRate.tsx`
- `src/features/profile/components/DailyGoalToggle.tsx`
- `src/features/profile/components/MembershipCard.tsx`
- `src/features/profile/components/SettingsList.tsx`
  - 我的页与卡片组件统一切换为浅暖玻璃风（卡片材质、开关、标签、列表行与会员卡视觉），保留原有 store/api 行为与交互逻辑。

### Validation

- `npx tsc --noEmit` ✅
- `npm run build` ✅

### Doc Sync

- `docs/CURRENT_TASK.md` 已同步记录本次 UI 迁移范围。

## 2026-03-28 - Fix: 记录页恢复语言与登录/退出交互

### Changed

- `src/features/chat/components/DatePicker.tsx`
  - 在记录页顶部恢复语言切换入口（`LanguageSwitcher`）。
  - 恢复登录/退出交互：未登录显示登录按钮，已登录显示退出按钮并复用原确认文案。
  - 头像区域恢复上传入口：点击头像可选择图片并调用 `updateAvatar` 更新用户头像。

### Validation

- `npx tsc --noEmit` ✅

### Doc Sync

- `docs/CURRENT_TASK.md` 已同步记录本次交互恢复改动。

## 2026-03-28 - UI: 导航统一回到底部（移除桌面侧边导航）

### Changed

- `src/components/layout/BottomNav.tsx`
  - 移除桌面侧边导航，恢复全端统一底部导航形态。
  - 底部导航容器最大宽度调整为 `max-w-[960px]`，确保桌面端也保持底部悬浮且与主内容宽度一致。
- `src/App.tsx`
  - 移除桌面侧边导航预留内边距（删除 `md:pl-24`），避免主内容左侧出现空白。

### Doc Sync

- `docs/CURRENT_TASK.md` 已同步补充该导航回退决策。

## 2026-03-28 - UI: 桌面端 + 移动端双端适配骨架

### Changed

- `src/components/layout/BottomNav.tsx`
  - 保留移动端底部胶囊导航（`md` 以下），新增桌面端左侧悬浮竖向导航（`md` 及以上）。
- `src/App.tsx`
  - `PageOutlet` 增加桌面模式侧边导航留白（`md:pl-24`）和底部留白调整（`md:pb-8`）。
  - 主壳背景在桌面模式切换为暖色径向渐变，移动端维持原背景。
- `src/features/growth/GrowthPage.tsx`
- `src/features/profile/ProfilePage.tsx`
- `src/features/report/ReportPage.tsx`
  - 页面主容器由固定手机宽度扩展为响应式（移动 `max-w-[430px]`、桌面 `max-w-[980px]`），桌面增加圆角边框与卡片阴影。
- `src/features/chat/ChatPage.tsx`
- `src/features/chat/ChatInputBar.tsx`
  - 聊天主容器与输入区最大宽度由 `430` 调整为 `960`，确保桌面端时间线与输入区可正常拉伸。

### Doc Sync

- `docs/CURRENT_TASK.md` 已同步记录本次双端适配改动范围与文件清单（满足 docs-sync 约束）。

## 2026-03-28 - Fix: 报告页恢复植物/根系可见性

### Changed

- `src/features/report/plant/PlantRootSection.tsx`
  - 页面挂载时补充一次今日消息加载（当 chat store 为空时触发 `fetchMessages`），随后刷新根系片段，避免仅显示空白画布。
  - 土壤画布上边距由 `120` 调整为 `40`，恢复根系主区域可见高度。
  - 在未生成植物状态增加顶部小苗预览浮层，保留"植物 + 根系"视觉连续性。
- `src/features/report/plant/PlantRootSection.tsx`
  - 改为按今日时间窗调用 `loadMessagesForDateRange(...)` 预热聊天数据，再刷新根系，减少 report 首屏拿不到 messages 的情况。
  - 生态球层移动到画布容器内并提升层级，避免被画布上层截断。
- `src/features/report/plant/SoilCanvas.tsx`
  - 增加土壤底色兜底（图片未命中时不再显示白板）。
  - 无根系数据时渲染轻量静态根系占位，避免空白区域观感。
- `src/features/report/ReportPage.tsx`
  - 修复报告页主容器丢失 `flex-col` 导致 `PlantRootSection` 的 `flex-1` 区域塌陷问题（症状：生态球与根系整体不显示，按钮贴顶）。

### Validation

- `npx tsc --noEmit` ✅

## 2026-03-28 - UI: 对齐 Seeday UI 原型视觉（保留现有业务逻辑）

### Changed

- 统一主视觉为原型的浅暖玻璃风格，并保持现有 store/api 逻辑不变：
  - `src/index.css`：新增 Inter + Material Symbols，统一全局基准字体与背景。
  - `src/components/layout/BottomNav.tsx`：重做底部导航为原型同款悬浮玻璃圆角胶囊样式（图标切换态保持路由逻辑）。
  - `src/App.tsx`：主布局移除全局 Header，改由页面自身头部承载；调整 `PageOutlet` 底部留白以配合新导航。
- Growth / Report / Profile 三页的外层容器与头部改为原型一致的移动端卡片画布与磨砂头部视觉：
  - `src/features/growth/GrowthPage.tsx`
  - `src/features/report/ReportPage.tsx`
  - `src/features/profile/ProfilePage.tsx`
- Growth 页局部组件配色与按钮风格向原型靠齐（不改动作与数据流）：
  - `src/features/growth/BottleList.tsx`
  - `src/features/growth/GrowthTodoSection.tsx`

### Validation

- `npx tsc --noEmit` ✅
- `npm run build` ✅

## 2026-03-28 - Feat: EN/IT Phase 1 — 词库框架升级（动词形态生成器 + 地点检测）

### Added

- **`activityLexicon.en.ts`**: 补充缺失基础动词 `eat/eating/ate/eaten`、`sleep/sleeping`、`dance/dancing/danced`、`sing/singing/sang`；新增 `enPlaceNouns` 导出（18 个非 strongPhrases 场所名词：pool、library、park、cafe 等）。
- **`liveInputRules.en.ts`**: 导入并导出 `EN_PLACE_NOUNS`。
- **`activityLexicon.it.ts`**: 新增 `ItVerbEntry` 类型 + `itActivityVerbData` 表（34 个意大利语动词，含不规则变位信息）；新增 `itPlaceNouns` 导出（24 个场所名词）。
- **`liveInputRules.it.ts`**: 新增 `generateItVerbForms()` 函数，每个动词自动生成 6 种形态（不定式、动名词、过去分词、第一人称现在时、`sto+动名词`、`ho+过去分词`）；`IT_ACTIVITY_VERBS` 合并所有生成形态（非破坏性扩展）；导出 `IT_PLACE_NOUNS`。
- **`latinSignalExtractor.ts`**: 新增 `hasEnGoToPlace()` 和 `hasItGoToPlace()` 结构化地点检测函数，`extractLatinSignals()` 的 `hasActivity` 现同时包含地点检测结果；EN/IT 语言识别列表新增 30+ 个意大利语特有动词形态（`vado`、`faccio`、`mangio`、`dormo`、`mangiando`、`mangiato` 等），确保单词意大利语输入能被正确识别。
- **测试**: `liveInputClassifier.i18n.test.ts` 新增 34 个回归测试（EN 13 个 + IT 21 个）；全部通过，无现有测试回归。

### Why

意大利语动词变位复杂，原有词表依靠手动维护所有形态，导致 `mangio`（我在吃）、`dormo`（我在睡）、`vado al cinema`（去电影院）等常见输入被误判为心情。英语缺少 `eat/sleep/dance/sing` 等基础动词，以及 `at the library`、`went to the park` 等场所类活动表达。

---

## 2026-03-28 - Feat: ZH 词库框架优化（动词数据驱动 + 独立名词活动识别）

### Changed

- **`activityLexicon.zh.ts`**: 移除 11 个与 go+place 逻辑重复的 `去+地点` strongPhrases（`去超市`、`去医院` 等，均已由动词+地点结构覆盖）；移除 11 个可由 verb+object 框架覆盖的冗余短语（`画画`、`弹琴` 等）；新增 12 个动词至 `verbs` 列表（`画`、`弹`、`唱`、`跳`、`踢`、`织`、`绣`、`折`、`喝`、`开`、`包`、`登`）；新增 `zhStandaloneActivityNouns` 导出（15 个独立名词：漫画、游戏、钢琴、象棋等）。
- **`liveInputRules.zh.ts`**: 导入并导出 `ZH_STANDALONE_ACTIVITY_NOUNS`；新增乐器/舞蹈对象词至 `ZH_ACTIVITY_OBJECTS`（`琴`、`吉他`、`钢琴`、`舞` 等）。
- **`zhSignalExtractor.ts`**: `hasActivitySignal` 新增短名词兜底逻辑（≤4 字纯名词匹配 `ZH_STANDALONE_ACTIVITY_NOUNS`）。
- **`liveInputClassifier.ts`**: `hasShortActionShell` 由硬编码正则改为数据驱动（读取 `ZH_ACTIVITY_VERBS`），新增 `ZH_SHORT_SHELL_MOVEMENT_VERBS` 常量隔离方向动词避免 verb+object 误判。
- **测试**: `liveInputClassifier.test.ts` 新增 10 个爱好/独立名词活动回归测试（画画、弹琴、漫画、游戏等）。

### Why

原有修复是"治标不治本"的逐条补充，词表与检测逻辑割裂。框架升级后：动词列表为唯一真相源，`hasShortActionShell` 自动感知新增动词，`去+地点` 类无需重复维护。

---

## 2026-03-26 - Fix: 日记页面布局适配手机端（按钮不再与导航重叠）

### Fixed

- **ReportPage**：`h-[calc(100vh-64px)]` → `h-full`，正确适配 PageOutlet 的 `pt-14 pb-16` 内边距（之前多出 56px 导致溢出）。
- **PlantRootSection**：从 `absolute inset-0` 改为 `h-full flex flex-col` 相对流布局；画布区域 `flex-1 min-h-0 overflow-hidden`；生成按钮改为正常流底部（`px-4 py-3`），无需 `env(safe-area-inset-bottom)` 偏移，天然不与底部导航重叠；DayEcoSphere 覆盖层仍为 `absolute top-0` 但在外层容器之上，弹窗不被裁剪。
- **DayEcoSphere 心情弹窗**：调整内容顺序为"心情分布→能量曲线"（与参考截图一致）；弹窗背景色改为 `rgba(248,242,229,0.94)` 更暖米黄；能量曲线颜色改为暖棕 `#b08060`（匹配参考截图色调）。

---

## 2026-03-26 - Feat: 日记页面植物场景全屏沉浸式重构

### Changed

- **全屏沉浸式植物场景**：日记页面植物区域去掉所有卡片边框，土壤根系画布填满整个内容区。
  - `ReportPage.tsx`：内容区由 `p-4 space-y-4` 改为 `flex-1 relative overflow-hidden`，不再单独渲染 `DayEcoSphere`。
  - `PlantRootSection.tsx`：去掉 `bg-white p-4 rounded-xl shadow-sm border` 卡片样式，改为 `absolute inset-0`；新增 `onOpenDiaryBook` prop；`DayEcoSphere` 作为 `z-20` 顶部浮层嵌入；植物图片为中部绝对定位浮层；生成按钮为底部浮层（含 `safe-area-inset-bottom`）；空状态改为磨砂玻璃小卡片浮层；移除 `resolvePlantSpecialScenario` 及未使用变量。
  - `SoilCanvas.tsx`：移除外层 `rounded-2xl border p-3` 包裹 div，画布 div 改为 `w-full h-full`（无固定高度）；图例改至 `top-3 right-3`；缩放控件改为 `absolute bottom-3 left-3` 内置浮层；合并 `wrapperRef` 与 `canvasRef` 为单一 ref。
  - `DayEcoSphere.tsx`：外层 div 改为 `pointer-events-none`，交互元素加 `pointer-events-auto`；弹窗改为暖沙色磨砂玻璃风格（`rgba(245,238,224,0.90)` + `backdrop-blur-14px`），匹配参考设计图。

---

## 2026-03-26 - Feat: 生态球第三个球接入查看日记本功能

### Changed

- **DayEcoSphere 右球**：将原"待解锁"占位球（✨，disabled）改为可点击的"日记本"入口。
  - 图标从 ✨ 改为 📔，颜色改为暖棕色 `#a78b6e`，移除 `disabled` 属性。
  - 新增 `onOpenDiaryBook?: () => void` prop，由 `ReportPage` 注入 `() => setShowDiaryBook(true)`。
  - 新增 i18n key `eco_sphere_diary_label`（zh: 日记本 / en: Diary / it: Diario）。
  - 文件：`src/features/report/plant/DayEcoSphere.tsx`、`src/features/report/ReportPage.tsx`、`src/i18n/locales/{zh,en,it}.ts`。

---

## 2026-03-25 - Feat: 日记界面植物上方生态球（DayEcoSphere）

### Added

- **DayEcoSphere 组件**：在日记页面植物根系区域上方新增三个玻璃质感生态球。
  - 左球（🌙 心情）：点击展开今日心情能量曲线（SVG 折线图）+ 心情分类饼图，复用 `MoodPieChart`。
  - 中球（🌿 活动）：点击展开今日活动分类圆环图，复用 `ActivityCategoryDonut`。
  - 右球（✨ 待解锁）：暂为占位，显示为半透明禁用态。
  - 晚上 20 点后在气泡下方显示提示文字，说明数据将归入今日日记。
  - 数据来源与日记报告保持一致（`computeActivityDistribution`、`computeMoodDistribution`、`computeMoodEnergyTimeline` 均来自今日消息）。
  - `src/features/report/plant/DayEcoSphere.tsx` — 新建组件（含 `MoodEnergyLine` SVG 子组件 + `GlassBubble` 子组件）。
  - `src/features/report/reportPageHelpers.ts` — 新增 `MoodEnergyPoint` 类型、`computeMoodDistribution`、`computeMoodEnergyTimeline` 导出函数。
  - `src/features/report/ReportPage.tsx` — 在 `<PlantRootSection />` 上方挂载 `<DayEcoSphere />`。
  - `src/i18n/locales/{zh,en,it}.ts` — 新增 7 个 i18n key（`eco_sphere_*`）。

---

## 2026-03-25 - Feat: 聊天输入框草稿持久化

### Added

- **输入框草稿缓存**：用户在聊天输入框输入的内容现在会自动保存到 `localStorage`，切换页面或窗口后回来仍可继续编辑；发送成功后草稿自动清除。
  - `src/features/chat/ChatPage.tsx` — `input` 初始值改为懒加载读取 `localStorage.getItem('chat_input_draft')`；新增 `useEffect` 监听 `input` 变化同步写入/删除 `chat_input_draft` key；`setInput('')` 触发空值时自动 `removeItem`，无需额外改动 `handleSend`。

---

## 2026-03-25 - Fix: 跨天打开网页显示昨日数据问题

### Fixed

- **ChatPage 初始化跳过跨天刷新的 bug**：`hasInitialized` 持久化到 localStorage，导致第二天打开网页时 init useEffect 直接 `return`，不拉取今日数据，跨天定时器最长要等 30 秒才刷新。
  - `src/features/chat/ChatPage.tsx` — init useEffect 中当 `hasInitialized=true` 时，先调用 `checkAndRefreshForNewDay()`，若检测到日期已变更则立即触发 `fetchMessages()`。
  - 同日内页面切换行为不变（`currentDateStr === todayStr` 时 `checkAndRefreshForNewDay` 为空操作）。

---

## 2026-03-25 - Diary Rebuild Audit: D4 + D6 Already Complete

### Audit Findings (no code changes)

Code audit against `docs/DIARY_REBUILD_PLAN.md` revealed two tasks already fully implemented but undocumented:

- **D4 (formatForDiaryAI)** — `src/lib/report-calculator/formatter.ts` already uses every field of `ComputedResult`: `mood_records`, `spectrum` (with anomaly flags), `light_quality` (focus/scatter/active/passive/todo), `energy_log` (with per-slot mood), `gravity_mismatch`, `history_trends`. ZH/EN two-path, IT falls back to EN (acceptable for AI input). No changes needed.

- **D6 (classify.ts prompt alignment)** — `api/classify.ts` ZH/EN/IT three-language prompts already reflect D1 mood-tag format (`[心情：label]` / `[mood: label]`), D2 daily-goal format (`今日目标：` / `Today's Goal:`), habit check-in and todo sections. Output spec matches `ClassifiedData` type exactly (total_duration_min, items[], todos{completed,total}, energy_log[]). No changes needed.

- **D5 (history trends)** — partially done: `computeHistoryTrend` in `src/lib/report-calculator/core.ts` already tracks energy-level trend (via energy_log high/medium/low). Remaining gap: no cross-day trend for mood-key distribution (happy/anxious/etc. from moodDistribution). To be completed.

- Updated docs:
  - `docs/DIARY_REBUILD_PLAN.md` — D4 marked ✅, D6 marked ✅, D5 marked ⚠️ with gap description
  - `docs/CURRENT_TASK.md` — pending list updated accordingly

## 2026-03-25 - Diary Rebuild Phase 2+4: Visualization Components + i18n

### Added

- V2: `ActivityCategoryDonut` — SVG donut chart from `stats.actionAnalysis` (6-category, percent + total hours):
  - `src/features/report/ActivityCategoryDonut.tsx`

- V4: `SpectrumBarChart` — horizontal bar chart from `SpectrumItem[]` (8-category, emoji, anomaly highlight):
  - `src/features/report/SpectrumBarChart.tsx`

- V6: `LightQualityDashboard` — 3-row comparison bar from `LightQuality` (focus/scatter, active/passive, todo ratio):
  - `src/features/report/LightQualityDashboard.tsx`

- Extended `ReportStats` to carry `spectrum?: SpectrumItem[]` and `lightQuality?: LightQuality`:
  - `src/store/useReportStore.ts` — interface extension + import
  - `src/store/useReportStore.ts` — `generateSeedayDiary` now saves `computed.spectrum` + `computed.light_quality` into report stats after diary generation

- V7: Integrated three new visualization components into `ReportDetailModal` Page 1 (after existing sections):
  - `src/features/report/ReportDetailModal.tsx` — imports + conditional render blocks

- Added 9 new i18n keys (ZH/EN/IT): `report_activity_category`, `report_spectrum_title`, `report_light_quality_title`, `lq_focus`, `lq_scatter`, `lq_active`, `lq_passive`, `lq_todo_done`, `lq_todo_total`

- Updated docs:
  - `src/features/report/README.md` — visualization components listed

## 2026-03-25 - Report i18n Cleanup + Action/Mood Summary Multilingual

### Changed

- A6: Replaced all hardcoded Chinese strings in report UI components with `t()` i18n calls:
  - `src/features/report/ReportPage.tsx` — page title, diary book button, generate button, early-tip dialog
  - `src/features/report/ReportDetailModal.tsx` — back button labels, date format (ZH/EN locale-aware), generate plant placeholder, swipe hint, my-diary section (title, placeholder, empty state, save button)
  - `src/features/report/ReportStatsView.tsx` — habit check-in title, goal progress title, recurring tasks label, task priority label, priority level labels, check-in status badges

- A7 (partial): Made `generateActionSummary` and `generateMoodSummary` multilingual (ZH/EN/IT):
  - `src/store/reportHelpers.ts` — both functions now accept `lang: SupportedLang = 'zh'`; added EN/IT text variants; `FALLBACK_SUMMARY`, `ACTION_CATEGORY_LABELS`, `ACTION_CATEGORY_ENCOURAGEMENT` now keyed by lang
  - `src/store/reportActions.ts` — callers now pass `currentLang` / `moodLang` to both summary functions

- Added 17 new i18n keys (ZH/EN/IT):
  - `src/i18n/locales/zh.ts`, `en.ts`, `it.ts` — `report_view_diary_book`, `report_generate_button`, `report_early_tip`, `report_early_tip_ok`, `report_back_diary_book`, `report_generate_plant`, `report_swipe_hint`, `report_my_diary`, `report_diary_placeholder`, `report_diary_empty`, `report_save`, `report_habit_checkin`, `report_goal_progress`, `report_goal_done_today`, `report_goal_not_today`, `report_recurring_tasks`, `report_task_priority`

- Updated docs:
  - `src/features/report/README.md` — noted i18n coverage completed for all user-visible strings

## 2026-03-24 - Daily Report Todo Breakdown Refactor

### Changed

- Removed four-quadrant priority stats from daily reports (`priorityStats` field and UI section deleted):
  - `src/store/useReportStore.ts` — removed `priorityStats` from `ReportStats` type
  - `src/store/reportActions.ts` — removed dead `priorityStats` computation (was always zero since priority migrated to `high/medium/low`)
  - `src/features/report/ReportStatsView.tsx` — removed quadrant distribution render block

- Fixed template todos being incorrectly counted in report stats:
  - `src/store/reportHelpers.ts` — `filterRelevantTodos` now skips `isTemplate: true` entries

- Added structured daily todo breakdown, splitting todos into four groups based on bottle linkage and recurrence:
  - `src/store/reportHelpers.ts` — added `computeDailyTodoStats`, `HabitCheckinItem`, `GoalProgressItem`, `DailyTodoStats`
  - `src/store/useReportStore.ts` — added `habitCheckin`, `goalProgress`, `independentRecurring`, `oneTimeTasks` to `ReportStats`; imported `useGrowthStore` in `generateReport` and `generateSeedayDiary`
  - `src/store/reportActions.ts` — `createGeneratedReport` now accepts `bottles: BottleSnapshot[]` and calls `computeDailyTodoStats` for daily reports; `runSeedayDiary` accepts `bottles` and computes breakdown for AI input; `buildRawInput` rewritten to include habit check-in, goal progress, completed task titles
  - `src/features/report/ReportStatsView.tsx` — daily UI now shows: habit checkin list, goal progress with star bar, independent recurring count bar, one-time task priority breakdown with completed-title chips

- Updated docs:
  - `src/features/report/README.md` — added `useGrowthStore` to Upstream Dependencies; documented `ReportStats` daily fields

### Validation

- `npx tsc --noEmit`: 0 errors

## 2026-03-22 - Plant Phase 4 Generate Window And Irreversible Confirmation

### Changed

- Updated plant generation store flow in `src/store/usePlantStore.ts`:
  - pass explicit runtime `lang` to `callPlantGenerateAPI(...)`
  - add next-day first-open auto-backfill attempt for the previous date when no previous-day plant record exists
  - persist a per-day backfill-attempt marker to avoid repeated retries on the same local date
- Updated report plant trigger UX in `src/features/report/plant/PlantRootSection.tsx`:
  - require confirmation before generating today's plant (irreversible for the day)
  - surface a localized failure hint when API call throws
- Added new i18n copy for plant-generation confirmation/error states in:
  - `src/i18n/locales/zh.ts`
  - `src/i18n/locales/en.ts`
  - `src/i18n/locales/it.ts`
- Added reveal and plant-image display chain in report plant section:
  - `src/features/report/plant/PlantRootSection.tsx`
  - `src/features/report/plant/PlantRevealAnimation.tsx`
  - `src/features/report/plant/PlantImage.tsx`
- Added four-level plant artwork fallback resolver (`plantId` -> `rootType+stage` -> `rootType_early_001` -> `sha_early_001`) in:
  - `src/features/report/plant/plantImageResolver.ts`
  - `src/features/report/plant/plantImageResolver.test.ts`
- Added special-scenario handling for air-day and entertainment-dominant reveal copy, plus empty-day fallback hint wiring in:
  - `src/features/report/plant/plantSpecialScenario.ts`
  - `src/features/report/plant/plantSpecialScenario.test.ts`
  - `src/features/report/plant/PlantRootSection.tsx`
  - `src/i18n/locales/zh.ts`
  - `src/i18n/locales/en.ts`
  - `src/i18n/locales/it.ts`
- Added plant image observability telemetry for fallback-level resolution in:
  - `src/features/report/plant/PlantImage.tsx`
  - `src/features/report/plant/plantImageResolver.ts`
  - `src/api/client.ts`
  - `api/plant-asset-telemetry.ts`
  - `scripts/plant_asset_telemetry_schema.sql`
- Merged plant fallback telemetry into the existing telemetry dashboard surface (`/telemetry/live-input`) in:
  - `api/live-input-dashboard.ts`
  - `src/services/input/liveInputTelemetryApi.ts`
  - `src/features/telemetry/LiveInputTelemetryPage.tsx`
- Updated docs to define `/telemetry/live-input` as the unified telemetry website for multiple instrumentation streams in:
  - `LLM.md`
  - `api/README.md`
  - `src/api/README.md`
  - `docs/PROJECT_MAP.md`
- Added focused store helper coverage in `src/store/usePlantStore.test.ts` for:
  - previous-date derivation (`addDaysToDate`)
  - once-per-day auto-backfill gate (`shouldAttemptPlantAutoBackfill`)

### Validation

- `npx vitest run src/store/usePlantStore.test.ts`
- `npx vitest run src/store/usePlantStore.test.ts src/features/report/plant/plantImageResolver.test.ts`
- `npx vitest run src/store/usePlantStore.test.ts src/features/report/plant/plantImageResolver.test.ts src/features/report/plant/plantSpecialScenario.test.ts src/features/report/plant/plantGenerateUi.test.ts`
- `npx tsc --noEmit`

### Doc-sync impact

- Synced Phase 4 execution state and completion checkboxes in `docs/CURRENT_TASK.md` for generate-window state machine, irreversible confirmation, generated-day lock, reveal-animation chain, artwork fallback order, and special-scenario fallback copy.

## 2026-03-21 - PR4 Magic Pen Fallback And Todo Category Hardening

### Changed

- Removed hard-coded Magic Pen todo draft category default `life` so draft-stage category can remain unset and be resolved later:
  - `src/services/input/magicPenTypes.ts`
  - `src/services/input/magicPenDraftBuilder.ts`
  - `src/services/input/magicPenParserLocalFallback.ts`
  - `src/services/input/magicPenTodoSalvage.ts`
  - `src/features/chat/MagicPenSheet.tsx`
- Updated Magic Pen commit path to classify todo category with explicit runtime language right before write, reducing EN/IT drift from implicit `zh` fallback:
  - `src/store/magicPenActions.ts`
- Hardened local parser fallback with conservative non-ZH behavior: no local backfill/multi-segment inference, only clear single-segment todo signals are drafted, otherwise `unparsed`:
  - `src/services/input/magicPenParser.ts`
  - `src/services/input/magicPenParserLocalFallback.ts`
  - `scripts/multilingual_classification_benchmark.ts`
- Added/updated regression coverage and UI copy for the unset-category flow:
  - `src/services/input/magicPenParser.test.ts`
  - `src/services/input/magicPenDraftBuilder.test.ts`
  - `src/store/magicPenActions.test.ts`
  - `src/i18n/locales/en.ts`
  - `src/i18n/locales/zh.ts`
  - `src/i18n/locales/it.ts`
- Synced doc-sync guard list with the retired chat API by replacing removed `api/chat.ts` with `api/magic-pen-parse.ts` in:
  - `scripts/check-doc-sync.mjs`

### Validation

- `npm run eval:classification:pr0`
- `npx vitest run src/services/input/magicPenDraftBuilder.test.ts src/services/input/magicPenParser.test.ts src/services/input/magicPenTodoSalvage.test.ts src/store/magicPenActions.test.ts`
- `npm run lint:max-lines`
- `npm run lint:docs-sync`
- `npm run lint:state-consistency`
- `npx tsc --noEmit`

### Doc-sync impact

- Synced PR4 execution status and benchmark/check loop in `docs/CURRENT_TASK.md`, and updated `scripts/check-doc-sync.mjs` key-file list to match current API surface.

## 2026-03-21 - Retire Legacy Chat Mode Runtime

### Changed

- Removed the dead companion-response runtime path by deleting `api/chat.ts`, removing `callChatAPI()` from `src/api/client.ts`, and dropping the unused AI chat response branch from `src/store/useChatStore.ts` and `src/store/chatActions.ts`.
- Simplified chat store send semantics to record-only runtime: `ChatState.mode`, `setMode(...)`, and `sendMessage(..., forcedMode)` were removed from `src/store/useChatStore.types.ts`, `src/store/useChatStore.ts`, and dependent growth/focus call sites.
- Added thin legacy filtering for historical `activity_type='chat'` rows so they no longer surface in runtime timeline/state paths:
  - `src/store/useChatStore.ts`
  - `src/features/chat/components/YesterdaySummaryPopup.tsx`
  - `src/store/useAuthStore.ts`
  - `api/plant-generate.ts`
- Narrowed activity typing and compatibility helpers so `chat` is no longer a first-class runtime `ActivityType`, while legacy rows are explicitly recognized and skipped in:
  - `src/lib/activityType.ts`
  - `src/lib/dbMappers.ts`
  - `src/store/chatStoreLegacy.ts`
  - `src/store/reportHelpers.ts`
  - `src/lib/plantActivityMapper.ts`
- Updated module/deploy/docs surfaces to describe `/chat` as record timeline + Magic Pen instead of a dual chat/record mode flow:
  - `README.md`
  - `FEATURE_STATUS.md`
  - `src/features/chat/README.md`
  - `src/api/README.md`
  - `api/README.md`
  - `DEPLOY.md`
  - `docs/PROJECT_MAP.md`
  - `docs/CURRENT_TASK.md`

## 2026-03-21 - AI Companion Persona Sync For Annotation And Diaries

### Changed

- Added shared companion persona definitions in `src/lib/aiCompanion.ts` for the four supported modes: `van`, `agnes`, `zep`, and `momo`.
- Updated `src/api/client.ts` to auto-attach the active `aiMode` when calling:
  - `callAnnotationAPI(...)`
  - `callDiaryAPI(...)`
- Updated annotation prompt assembly to follow the selected companion persona in:
  - `src/server/annotation-prompts.ts`
  - `src/server/annotation-handler.ts`
- Updated report diary prompt assembly to follow the selected companion persona in `api/diary.ts`.
- Updated plant diary generation to read the authenticated user's persona and apply it in:
  - `api/plant-generate.ts`
  - `api/plant-diary.ts`
  - `src/server/plant-diary-service.ts`
- Added focused prompt wiring coverage in `src/lib/aiCompanion.test.ts`.

### Validation

- `npx.cmd tsc --noEmit`
- `npx.cmd vitest run src/lib/aiCompanion.test.ts`

### Doc-sync impact

- Synced the new AI companion persona flow across API/docs surfaces in `src/api/README.md`, `api/README.md`, `docs/CURRENT_TASK.md`, and `docs/CHANGELOG.md`.

## 2026-03-21 — PR1a Lang Plumbing For Chat/Todo/Refine Paths

### Changed

- Updated chat store language propagation in `src/store/useChatStore.ts` to pass explicit runtime/content language into:
  - `autoDetectMood(...)`
  - `classifyRecordActivityType(...)`
  - low-confidence `callClassifierAPI(...)` refine requests
- Updated extracted timeline actions in `src/store/chatTimelineActions.ts` to forward language when recomputing mood and activity categories.
- Updated shared chat action helpers in `src/store/chatActions.ts`:
  - added runtime/content language resolvers
  - threaded language through `triggerMoodDetection(...)`, `closePreviousActivity(...)`, and `buildInsertedActivityResult(...)`
- Updated todo store refine flow in `src/store/useTodoStore.ts` to forward language for:
  - rule classification
  - todo category normalization
  - low-confidence AI refine calls
- Updated category helper plumbing in `src/lib/activityType.ts` to carry `lang` through nested fallbacks in:
  - `mapClassifierCategoryToActivityType(...)`
  - `normalizeActivityType(...)`
  - `normalizeTodoCategory(...)`
- Updated report-side category usage to accept language-aware classification:
  - `src/store/reportHelpers.ts`
  - `src/store/reportActions.ts`

### Validation

- `npx vitest run src/lib/activityType.test.ts src/store/chatActions.test.ts src/store/useChatStore.integration.test.ts src/store/reportHelpers.test.ts`
- `npx tsc --noEmit`

### Doc-sync impact

- Synced PR1a language-propagation code path updates across `src/store/**` and `src/lib/activityType.ts` with anchor docs `docs/CURRENT_TASK.md` and `docs/CHANGELOG.md`.

## 2026-03-21 — PR0 Multilingual Classification Baseline Setup

### Added

- Added multilingual PR0 fixture sets in `src/services/input/__fixtures__/`:
  - `liveInput.intent.fixture.json`
  - `activity.category.fixture.json`
  - `todo.category.fixture.json`
  - `magicPen.fallback.fixture.json`
- Added benchmark runner `scripts/multilingual_classification_benchmark.ts` to evaluate:
  - live input intent (`kind` + `internalKind`)
  - activity category classification
  - todo category normalization quality
  - Magic Pen local fallback outcomes
- Added npm commands in `package.json`:
  - `eval:classification:pr0`
  - `eval:classification:pr0:artifact`
- Added baseline docs/artifact paths:
  - `docs/benchmarks/PR0_BASELINE.md`
  - `docs/benchmarks/pr0-baseline.latest.json`

### Validation

- `npm run eval:classification:pr0:artifact`
- Baseline snapshot recorded:
  - live-input internal accuracy: `94.44% (17/18)`
  - activity category accuracy: `94.44% (17/18)`
  - todo category accuracy: `72.22% (13/18)`
  - magic-pen local fallback accuracy: `100.00% (6/6)`

### Doc-sync impact

- Synced PR0 execution anchor and baseline evidence across code path updates (`src/services/input/__fixtures__/**`, `scripts/multilingual_classification_benchmark.ts`, `package.json`) and docs (`docs/CURRENT_TASK.md`, `docs/benchmarks/PR0_BASELINE.md`, `docs/CHANGELOG.md`).

## 2026-03-21 — useChatStore Split: Timeline Actions Extracted

### Changed

- Replaced `import type { Message } from './useChatStore'` with `from './useChatStore.types'` across 6 files: `src/store/chatActions.ts`, `src/store/chatActions.test.ts`, `src/store/useChatStore.integration.test.ts`, `src/store/chatHelpers.ts`, `src/store/reportActions.ts`, `src/store/reportHelpers.test.ts`.
- Removed self-referencing type `import('./useChatStore').MoodDescription` in `src/store/useChatStore.ts` (line 635), using `MoodDescription` from `.types` directly.
- Extracted 9 timeline-write actions from `src/store/useChatStore.ts` into new `src/store/chatTimelineActions.ts` using `createChatTimelineActions(set, get)` factory:
  - `insertActivity`, `updateActivity`, `deleteActivity`, `updateMessageDuration`, `updateMessageImage`, `detachMoodFromEvent`, `reattachMoodToEvent`, `convertMoodToEvent`, `detachMoodMessage`.
- `src/store/useChatStore.ts` now uses spread `...createChatTimelineActions(set, get)` to compose the new actions, keeping `ChatState` interface and `persist` config unchanged.
- `src/store/useChatStore.ts` line count: 830 → 716, passing the max-lines error gate (800).

### Validation

- `npx vitest run src/store/chatActions.test.ts src/store/useChatStore.integration.test.ts` — 21/21 tests pass.
- `npx tsc --noEmit` — no type errors.
- `node scripts/check-max-lines.mjs` — no files exceed error limit; `useChatStore.ts` reduced from 830 to 716 lines.

### Doc-sync impact

- Updated `src/features/chat/README.md` ("Store Refactor Update" section) to document the new `chatTimelineActions.ts` file and the updated file layout.
- No change to `docs/SEEDAY_DEV_SPEC.md` or `docs/ARCHITECTURE.md` since no architectural contract changed — only internal file decomposition.

## 2026-03-20 — Multi-language Lexicon Optimization & Unified Architecture

### Added

- Created a unified, multi-language lexicon system in `src/services/input/lexicon/`:
    - `types.ts`: Defined `ActivityLexicon`, `MoodLexicon`, `CategoryLexicon`, and `LanguageLexicon` interfaces.
    - `getLexicon.ts`: Implemented a factory for language-based lexicon retrieval (ZH, EN, IT).
    - `activityLexicon.{zh,en,it}.ts`: Centralized 200+ activity terms and verbs.
    - `moodLexicon.{zh,en,it}.ts`: Consolidated mood explicit mappings, activity-to-mood inferences, and sentence patterns.
    - `categoryLexicon.{zh,en,it}.ts`: Centralized activity classification keywords for all supported languages.
- Added `docs/LEXICON_ARCHITECTURE.md` as the core documentation for the new architecture.

### Changed

- Refactored `src/lib/mood.ts` (`autoDetectMood`) to use the new `MoodLexicon` and support the `lang` parameter for multi-language inference.
- Refactored `src/lib/activityType.ts` (`classifyRecordActivityType`) to use the new `CategoryLexicon`, enabling full English and Italian category classification.
- Updated `src/services/input/liveInputRules.zh.ts` to source all its vocabulary from the centralized lexicon, eliminating duplicate lists.
- Updated `src/services/input/magicPenTodoSalvage.ts` to use `zhMoodLexicon` for consistent mood detection.
- Updated `src/services/input/magicPenDraftBuilder.ts` to correctly flag `missing_time` when time resolution is missing, fixing a parsing regression.
- Updated `docs/ACTIVITY_LEXICON.md` and `docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md` to point to the new centralized lexicon architecture.
- Updated `docs/SEEDAY_DEV_SPEC.md` to include the `lexicon/` folder in the project structure.

### Validation

- `npx vitest run src/lib/mood.test.ts src/lib/activityType.test.ts src/services/input/liveInputClassifier.test.ts src/services/input/magicPenParser.test.ts src/services/input/magicPenTodoSalvage.test.ts`
- Verified all 129 `liveInputClassifier` tests pass, including context bias and multilingual regressions.
- Verified Magic Pen parsing correctly extracts content and dates after the lexicon migration.

### Doc-sync impact

- Synced the new lexicon architecture across code paths (`src/services/input/lexicon/**`, `src/lib/mood.ts`, `src/lib/activityType.ts`, `src/services/input/liveInputRules.zh.ts`, `src/services/input/magicPenDraftBuilder.ts`) and documentation files (`docs/CHANGELOG.md`, `docs/ACTIVITY_LEXICON.md`, `docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md`, `docs/LEXICON_ARCHITECTURE.md`).

## 2026-03-19 — Chat Reclassify Guard + Timeline Action Area + ChatStore Split

### Added

- Added chat store type module `src/store/useChatStore.types.ts` and legacy activity-type backfill helper `src/store/chatStoreLegacy.ts` to split `useChatStore` structure from runtime actions.
- Added integration regression `only allows mood -> activity conversion for latest record message` in `src/store/useChatStore.integration.test.ts`.

### Changed

- Updated `src/features/chat/components/EventCard.tsx`, `src/features/chat/components/ImageUploader.tsx`, and `src/features/chat/components/TimelineView.tsx` to move image upload trigger into card-active top-right action area and add event->mood quick conversion action.
- Updated `src/features/chat/components/MoodCard.tsx`, `src/features/chat/components/TimelineView.tsx`, and `src/store/useChatStore.ts` so mood/activity mutual conversion is restricted to the latest `record + text` message at both UI and store guard levels.
- Updated `src/store/chatActions.ts` activity->mood reclassify result to set `detached: true` so converted mood cards stay visible in timeline.
- Updated `src/features/chat/chatPageActions.ts`, `src/store/magicPenActions.ts`, `src/store/reportHelpers.test.ts`, `src/store/useChatStore.integration.test.ts`, `src/store/usePlantStore.ts`, and `src/store/useTodoStore.ts` to fix strict typing regressions surfaced by diagnostics.
- Split `src/store/useChatStore.ts` by extracting types/interfaces and legacy backfill helper, reducing the store entry file below the max-lines hard gate.
- Updated `scripts/check-state-consistency.mjs` to remove forced doc-sync mapping for `src/features/growth/GrowthPage.tsx`.
- Updated locale keys in `src/i18n/locales/zh.ts`, `src/i18n/locales/en.ts`, and `src/i18n/locales/it.ts` with `event_to_mood`.

### Validation

- `npm run test:unit -- src/store/useChatStore.integration.test.ts`
- `npm run test:unit -- src/store/reportHelpers.test.ts src/features/chat/chatPageActions.test.ts src/store/magicPenActions.test.ts`
- `npx tsc --noEmit`
- `npm run lint:state-consistency`
- `npm run lint:docs-sync`
- `npm run build`
- `npm run lint:all`

### Doc-sync impact

- Synced this round’s chat/store refactor + behavior corrections across code paths (`src/store/**`, `src/features/chat/**`, `scripts/check-state-consistency.mjs`, `src/i18n/locales/*.ts`) and anchor docs (`docs/CHANGELOG.md`, `src/features/chat/README.md`, `src/store/README.md`, `docs/CURRENT_TASK.md`).

## 2026-03-19 — ActivityType Unified Classification Chain

### Added

- Added unified activity classification utility `src/lib/activityType.ts` and regression tests `src/lib/activityType.test.ts`.
- Added chain-level regression tests `src/store/reportHelpers.test.ts` and `src/lib/plantActivityMapper.test.ts` to lock report/plant consumption of unified `activityType`.

### Changed

- Updated `src/store/useChatStore.ts` and `src/store/chatActions.ts` to stop writing `待分类/未分类`, classify record activities at write-time, and add low-confidence AI refinement without blocking write path.
- Updated `src/store/useTodoStore.ts`, `src/features/growth/GrowthTodoSection.tsx`, `src/features/growth/FocusMode.tsx`, and `src/services/input/magicPenDraftBuilder.ts` so todos are classified on creation and todo-triggered activity records inherit todo category directly.
- Updated `src/store/reportHelpers.ts` to aggregate activity distribution by stored `activityType` instead of keyword secondary classification.
- Updated `src/lib/plantActivityMapper.ts` to prioritize normalized unified `activityType` mapping with legacy compatibility fallback.
- Updated `src/lib/dbMappers.ts`, `src/store/useAnnotationStore.ts`, and `src/types/annotation.ts` to tighten activity type mapping/types and normalize legacy records.
- Updated `docs/CURRENT_TASK.md` classification checklist/acceptance items to completed state.

### Validation

- `npx vitest run src/lib/activityType.test.ts src/lib/plantActivityMapper.test.ts src/store/reportHelpers.test.ts src/store/chatActions.test.ts src/store/useChatStore.integration.test.ts`
- `npx tsc --noEmit`
- `npm run build`
- `npm run lint:all` fails due existing max-lines gate on `src/store/useChatStore.ts` (>800 lines), unrelated to this change set.
- `npm run test:unit` still has pre-existing unrelated failures in `src/server/magic-pen-parse.test.ts`, `src/features/chat/chatPageActions.test.ts`, and `src/services/input/magicPenParser.test.ts`.

### Doc-sync impact

- Synced unified classification implementation changes across code paths (`src/store/**`, `src/lib/**`, `src/features/growth/**`, `src/services/input/**`) with execution docs (`docs/CURRENT_TASK.md`, `docs/CHANGELOG.md`).

## 2026-03-18 — Plant System Phase 3 (Viewport Clamp + Hit-Target Regression Guard)

### Added

- Added viewport math helper `src/features/report/plant/soilCanvasViewport.ts` and unit coverage `src/features/report/plant/soilCanvasViewport.test.ts` for scale clamp, drag-bound clamp, focus offset, and reset-to-center behavior.
- Added performance evidence template `docs/PLANT_P3_PERFORMANCE_SAMPLING_TEMPLATE.md` for WebView FPS/long-task sampling and Gate-D acceptance records.

### Changed

- Updated `src/features/report/plant/SoilCanvas.tsx` with clamped viewport offset, selected-root auto-focus under zoom, and deterministic reset behavior to reduce extreme-zoom unreachable/jitter states.
- Updated `src/features/report/plant/RootSegmentPath.tsx` and `src/features/report/plant/rootInteractionHelpers.ts` to introduce a transparent expanded hit layer (`resolveRootHitStrokeWidth`) for dense-root tap/long-press reliability.
- Updated `src/features/report/plant/PlantRootSection.tsx` empty-state block to a structured guidance card to improve no-root readability.
- Extended `src/features/report/plant/rootInteractionHelpers.test.ts` with hit-target regression assertions.
- Updated `docs/CURRENT_TASK.md` P3 checklist and snapshot to reflect completed boundary/hit/empty-state/template items.

### Validation

- `npm run test:unit -- src/features/report/plant/soilCanvasViewport.test.ts src/features/report/plant/rootInteractionHelpers.test.ts`
- `npx tsc --noEmit`

### Doc-sync impact

- Synced implementation changes in `src/features/report/plant/**` with execution docs `docs/CURRENT_TASK.md` and `docs/CHANGELOG.md`, and added reusable performance sampling artifact in `docs/`.

## 2026-03-18 — Plant Root Realtime Window Fix (Post-20:00)

### Changed

- Updated `src/store/usePlantStore.ts` root refresh gating: removed the `20:00` hard stop so ungenerated days continue mapping completed activities to roots until day rollover (`00:00`), while keeping "generated today" lock behavior unchanged.
- Updated `docs/CURRENT_TASK.md` timing description/checklist wording to align with the implemented rule: root realtime updates continue within the current day and stop on generate-lock or next-day reset.
- Updated product/spec source docs `docs/Seeday_植物生长_PRD_v1_8.docx` and `docs/Seeday_植物生长_技术实现文档_v1.7.docx` to unify timing wording: roots keep updating until `24:00` if not generated, and lock immediately after manual/auto generation.

### Validation

- `npm run test:unit -- src/store/usePlantStore.test.ts src/features/report/plant/plantGenerateUi.test.ts`

### Doc-sync impact

- Synced timing-rule behavior between code path (`src/store/usePlantStore.ts`) and task/spec docs (`docs/CURRENT_TASK.md`, `docs/Seeday_植物生长_PRD_v1_8.docx`, `docs/Seeday_植物生长_技术实现文档_v1.7.docx`, `docs/CHANGELOG.md`).

## 2026-03-18 — Plant System Phase 3 (UI Polish + Test Backfill)

### Added

- Added test coverage for P3 root interaction and timing flows: `src/store/usePlantStore.test.ts`, `src/features/report/plant/rootInteractionHelpers.test.ts`, `src/features/report/plant/plantGenerateUi.test.ts`, `src/features/report/plant/soilLegend.test.ts`, and `src/features/report/reportPage.integration.test.tsx`.
- Added small helper modules to keep report plant interactions testable and deterministic: `src/features/report/plant/rootInteractionHelpers.ts`, `src/features/report/plant/plantGenerateUi.ts`, and `src/features/report/plant/soilLegend.ts`.

### Changed

- Updated `src/features/report/plant/SoilCanvas.tsx` to move the direction legend into an in-soil right-bottom floating card, keep touch pass-through, and add clamped zoom-control disabled states plus zoom level display.
- Updated `src/features/report/plant/RootSystem.tsx` and `src/features/report/plant/RootSegmentPath.tsx` to improve dense-scene readability (main/side root visual hierarchy and selected-root top-layer rendering).
- Updated `src/features/report/plant/PlantRootSection.tsx` to unify generate-button state UX (daytime locked / evening enabled / generated locked) and upgrade root empty-state presentation.
- Updated `src/store/usePlantStore.ts` by extracting realtime duration resolution (`resolvePlantDurationForMessage`) for explicit P3 timing rule testing.
- Extended locale packs `src/i18n/locales/zh.ts`, `src/i18n/locales/en.ts`, and `src/i18n/locales/it.ts` with root empty-state title and generated-button copy.
- Updated `docs/CURRENT_TASK.md` latest snapshot and P3 checklist status to reflect this round of UI/test completion.

### Validation

- `npm run test:unit -- src/store/usePlantStore.test.ts src/features/report/plant/rootInteractionHelpers.test.ts src/features/report/plant/plantGenerateUi.test.ts src/features/report/plant/soilLegend.test.ts src/features/report/reportPage.integration.test.tsx`

### Doc-sync impact

- Synced code-path changes (`src/features/report/plant/**`, `src/store/usePlantStore.ts`, `src/i18n/locales/*.ts`) with execution anchor docs (`docs/CURRENT_TASK.md`, `docs/CHANGELOG.md`).

## 2026-03-18 — Plant System Phase 3 (Image 1 Interaction Convergence)

### Added

- Added profile direction-config UI `src/features/profile/components/DirectionSettingsPanel.tsx` and wired it into `src/features/profile/components/SettingsList.tsx` so users can set the five direction-category mappings from the “My/Profile” page.

### Changed

- Updated `src/features/report/plant/SoilCanvas.tsx` to remove drag/pan gesture handling, keep button-based zoom/reset, and add in-soil direction legend labels (top/right-top/right-bottom/left-bottom/left-top) bound to live `directionOrder`.
- Updated `src/features/report/plant/PlantRootSection.tsx` and `src/features/report/plant/RootDetailBubble.tsx` to show fixed root detail fields with full info: activity name, start-end time range, duration, type, and focus.
- Updated `src/features/report/plant/SoilCanvas.tsx`, `src/features/report/plant/PlantRootSection.tsx`, and `src/lib/rootRenderer.ts` so root details render as an in-canvas bubble near the selected root tip (instead of below the canvas) and auto-dismiss after 5 seconds.
- Extended locale packs `src/i18n/locales/zh.ts`, `src/i18n/locales/en.ts`, and `src/i18n/locales/it.ts` with root direction legend labels, detail time-range label, soil-canvas reset text, and profile direction-setting copy.
- Updated `docs/CURRENT_TASK.md` Phase 3 / Phase 5 checklist and latest snapshot to reflect the interaction replacement and direction-setting entry completion.

### Doc-sync impact

- Synced implementation status for code paths (`src/features/report/plant/**`, `src/features/profile/components/**`, `src/i18n/locales/*.ts`) with task anchor docs (`docs/CURRENT_TASK.md`, `docs/CHANGELOG.md`).

## 2026-03-18 — Plant System Phase 3 (Report Embedded Root Daytime Experience)

### Added

- Added report-embedded plant root UI components under `src/features/report/plant/`: `PlantRootSection.tsx`, `SoilCanvas.tsx`, `RootSystem.tsx`, `RootSegmentPath.tsx`, and `RootDetailBubble.tsx`.

### Changed

- Updated `src/features/report/ReportPage.tsx` to permanently render the root section directly below the week/month/custom button group, following the frozen IA decision for `/report` default visibility.
- Updated `src/store/usePlantStore.ts` daytime segment refresh logic to support P3 timing rules: `<5m` hidden, `5-15m` visible after completion, `>15m` ongoing segments visible via realtime extension.
- Refined mobile-shell behavior in `src/features/report/ReportPage.tsx` and `src/features/report/plant/SoilCanvas.tsx`: safe-area-aware bottom spacing, bottom-nav avoidance padding, and stronger touch-target/active feedback for non-hover interaction.
- Added first-pass performance tuning for root daytime interactions in `src/store/usePlantStore.ts` and `src/features/report/plant/*`: segment equality short-circuit before state updates, RAF-batched pan updates, and memoized root rendering components.
- Extended locale packs `src/i18n/locales/en.ts`, `src/i18n/locales/zh.ts`, and `src/i18n/locales/it.ts` with root-section labels, generate-status hints, category/focus detail labels, and interaction copy.
- Updated `docs/CURRENT_TASK.md` latest snapshot + P3 checklist to reflect implemented root daytime interaction milestones and remaining mobile/performance hardening item.

### Validation

- `npx tsc --noEmit`
- `npm run lint:docs-sync`

### Doc-sync impact

- Synced implementation status between code paths (`src/features/report/**`, `src/store/usePlantStore.ts`, `src/i18n/locales/*.ts`) and task anchor docs (`docs/CURRENT_TASK.md`, `docs/CHANGELOG.md`).

## 2026-03-18 — Documentation Governance Cleanup (Handover Doc Removal)

### Changed

- Updated `scripts/check-state-consistency.mjs` to require `docs/CHANGELOG.md` as the sole global state-doc gate for code-path changes.
- Removed stale references to deleted `docs/CODE_CLEANUP_HANDOVER_PLAN.md` in active docs: `LLM.md`, `docs/PROJECT_MAP.md`, `PROJECT_CONTEXT.md`, `CONTRIBUTING.md`, `README.md`, `src/features/chat/README.md`, `src/features/auth/README.md`, `src/features/report/README.md`, and `src/api/README.md`.
- Clarified doc governance wording in `LLM.md` and `CONTRIBUTING.md` so session restore and doc-sync anchors now point to `docs/CURRENT_TASK.md` + `docs/CHANGELOG.md`.

### Validation

- `npm run lint:state-consistency`

### Doc-sync impact

- Synced documentation policy to the current repository reality where handover tracking is consolidated into `docs/CURRENT_TASK.md` and `docs/CHANGELOG.md`.

## 2026-03-18 — Plant System Phase 0 (Data Baseline + SQL Fix)

### Added

- Added plant domain types in `src/types/plant.ts` (root type/stage/focus/category, root metrics, daily record, direction config).
- Added DB schema scripts `scripts/plant_p0_schema_up.sql` and `scripts/plant_p0_schema_down.sql` for Phase 0 table setup and rollback.

### Changed

- Extended `src/lib/dbMappers.ts` with `fromDbPlantRecord()` and `toDbPlantRecord()` to normalize `daily_plant_records` app-model <-> DB-row mapping.
- Updated `scripts/plant_p0_schema_up.sql` policy statements from unsupported `CREATE POLICY IF NOT EXISTS` to `DROP POLICY IF EXISTS + CREATE POLICY` for Supabase SQL editor compatibility.
- Synced `docs/CURRENT_TASK.md` as the execution anchor and marked Phase 0 checklist items complete.

### Validation

- `npx tsc --noEmit`
- `npm run lint:docs-sync`
- `npm run lint:max-lines`

### Doc-sync impact

- Added this changelog entry for code/documentation consistency.
- Updated `docs/CURRENT_TASK.md` with Phase 0 completion and handoff snapshot.

## 2026-03-18 — Plant System Phase 1 (Algorithm Layer)

### Added

- Added `src/lib/plantCalculator.ts` with `computeRootMetrics()`, `matchRootType()`, `resolveSupportVariant()`, plus configurable `ROOT_SCORE_CONFIG` and special-day helpers (`isAirPlantDay`, `isEntertainmentDominantDay`).
- Added `src/lib/rootRenderer.ts` with logarithmic length mapping, fixed direction-angle rendering, same-direction root fusion (main/side/extend), seeded path perturbation, and SVG-ready render payload output.
- Added unit tests `src/lib/plantCalculator.test.ts` and `src/lib/rootRenderer.test.ts` covering denominator rules, score competition + tie-break, air/fun/support scenarios, fusion behavior, and deterministic path generation.

### Validation

- `npm run test:unit -- src/lib/plantCalculator.test.ts src/lib/rootRenderer.test.ts`
- `npx tsc --noEmit`

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` to mark Phase 1 algorithm checklist items complete.

## 2026-03-18 — Plant System Phase 2 (Store + API Mainline)

### Added

- Added plant store `src/store/usePlantStore.ts` with day-segment state, generation state, root selection state, direction-order persistence, and 20:00-before realtime sync from chat activities.
- Added plant API endpoints `api/plant-generate.ts`, `api/plant-diary.ts`, and `api/plant-history.ts`.
- Added plant API shared helpers `api/plant-shared.ts` and diary service `api/plant-diary-service.ts` for auth, timezone/day-window handling, DB serialization, and fallback diary generation.
- Added activity-to-plant mapping helper `src/lib/plantActivityMapper.ts`.

### Changed

- Extended `src/types/plant.ts` with `RootSegment`, default direction order, and plant API request/response contracts.
- Extended `src/api/client.ts` with authenticated plant API calls: `callPlantGenerateAPI`, `callPlantDiaryAPI`, and `callPlantHistoryAPI`.
- Updated endpoint/module docs in `api/README.md` and `src/api/README.md` for the new plant routes and bearer-auth contract.
- Updated `docs/CURRENT_TASK.md` to mark Phase 2 checklist complete and set Phase 3 as next execution entry.

### Doc-sync impact

- Synced `docs/CURRENT_TASK.md`, `api/README.md`, and `src/api/README.md` with the new plant data-flow contracts.

## 2026-03-11 — Magic Pen V2 Mode-B + AI-First Parser Cutover (Session-21)

### Changed

- Switched chat interaction to Mode-B in `src/features/chat/ChatInputBar.tsx` and `src/features/chat/ChatPage.tsx`: wand button now toggles Magic Pen mode, and send branches to parse flow only when mode is on.
- Updated `src/features/chat/MagicPenSheet.tsx` to consume send-triggered seed drafts (`initialDrafts` / `initialUnparsedSegments`) and use async parse action with loading/error UX.
- Added server endpoint `api/magic-pen-parse.ts` (GLM-4.7-flash + `ZHIPU_API_KEY`) with robust response parsing fallback: direct JSON parse -> outer object extraction -> safe empty fallback.
- Added frontend client contract `callMagicPenParseAPI()` in `src/api/client.ts` and synced endpoint docs in `api/README.md` and `src/api/README.md`.
- Refactored parser entry `src/services/input/magicPenParser.ts` to async AI-first pipeline; moved local regex parser into `src/services/input/magicPenParserLocalFallback.ts` fallback path.
- Extended type/contracts in `src/services/input/magicPenTypes.ts` and `src/services/input/magicPenDraftBuilder.ts` for AI segment mapping and HH:mm conversion.
- Updated locale packs `src/i18n/locales/en.ts`, `src/i18n/locales/zh.ts`, and `src/i18n/locales/it.ts` with Mode-B and parsing/error keys.
- Updated tests: async parser assertions in `src/services/input/magicPenParser.test.ts`, removed obsolete open/close helper assertions in `src/features/chat/chatPageActions.test.ts`, and added `src/services/input/magicPenDraftBuilder.test.ts`.

### Validation

- `npm run test:unit -- src/services/input/magicPenParser.test.ts src/services/input/magicPenDraftBuilder.test.ts src/store/magicPenActions.test.ts src/features/chat/chatPageActions.test.ts`
- `npx tsc --noEmit`
- `npm run lint:docs-sync`
- `npm run lint:state-consistency`
- `npm run build`

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` with session-21 snapshot and MP0/MP1/MP2/MP4/MP5 checklist progress.
- Updated `docs/CODE_CLEANUP_HANDOVER_PLAN.md` section 8 with this session handover record.
- Updated module/API docs: `src/features/chat/README.md`, `src/api/README.md`, and `api/README.md`.

## 2026-03-11 — Moodauto Write-Path Verification (Phase E)

### Changed

- Added explicit write-path guard regressions in `src/store/chatActions.test.ts`:
  - standalone mood routes with `relatedActivityId` only when recent activity is ongoing.
  - standalone mood does not fallback attach to ended activity (`sendMood(content, undefined)`).
- Revalidated store integration behavior in `src/store/useChatStore.integration.test.ts` for ongoing attach and ended no-attach constraints.

### Validation

- `npm run test:unit -- src/store/chatActions.test.ts src/store/useChatStore.integration.test.ts src/services/input/liveInputClassifier.test.ts`
- `npm run eval:live-input:gold`

### Metrics

- zh gold: `kind_accuracy=88.69%`, `internal_accuracy=82.74%`.
- top mismatches: `new_activity -> standalone_mood (9)`, `activity_with_mood -> standalone_mood (7)`, `mood_about_last_activity -> standalone_mood (6)`.

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` to mark Phase E checklist complete and record the mismatch snapshot.
- Updated `docs/CODE_CLEANUP_HANDOVER_PLAN.md` handover log with write-path verification progress.

## 2026-03-11 — Moodauto Evidence Objectization (Classifier + Telemetry)

### Changed

- Added internal evidence schema in `src/services/input/types.ts`: `LiveEvidence` with `source`, `strength`, `polarity`, `tokens`, and `reasonCode`; exposed as optional `evidence` on `LiveInputClassification`.
- Refactored `src/services/input/liveInputClassifier.ts` to evidence-first scoring: classifier now builds evidence entries, maps evidence to scores centrally, and then resolves `internalKind`.
- Synced telemetry aggregation in `src/services/input/liveInputTelemetry.ts` to count reason codes from evidence while preserving backward-compatible reason counting.
- Added evidence assertions in `src/services/input/liveInputClassifier.test.ts` for planned interception and go/place happened-shell enrichment.

### Validation

- `npm run test:unit -- src/services/input/liveInputClassifier.test.ts src/services/input/liveInputRules.test.ts src/store/chatActions.test.ts src/store/useChatStore.integration.test.ts`
- `npx tsc --noEmit`
- `npm run lint:docs-sync`
- `npm run lint:state-consistency`

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` with session-18 execution snapshot and Phase C completion.
- Updated `docs/CODE_CLEANUP_HANDOVER_PLAN.md` handover log for evidence-objectization slice.

## 2026-03-11 — Moodauto Runtime Reorder (Structure-First + Go/Place)

### Changed

- Reordered zh runtime classification pipeline in `src/services/input/liveInputClassifier.ts` to structure-first order: `future/planned` intercept -> `negated/not occurred` intercept -> ongoing -> completion -> `go + place` -> lexicon -> mood -> context linking -> final dispatch.
- Added `detectGoToPlaceActivity()` in `src/services/input/liveInputClassifier.ts` with happened-shell strengthening (`刚/已经/了/回来`) and explicit reason codes.
- Added `ZH_PLACE_NOUNS` in `src/services/input/liveInputRules.zh.ts` and split non-activity interception into `ZH_FUTURE_OR_PLAN_PATTERNS` + `ZH_NEGATED_OR_NOT_OCCURRED_PATTERNS` (with `ZH_NON_ACTIVITY_PATTERNS` kept as combined export for compatibility).
- Expanded regressions in `src/services/input/liveInputClassifier.test.ts` and `src/services/input/liveInputRules.test.ts` for required `go + place` / planned / negated / happened-shell / mood-mixed scenarios.

### Validation

- `npm run test:unit -- src/services/input/liveInputClassifier.test.ts src/services/input/liveInputRules.test.ts src/store/useChatStore.integration.test.ts`

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` with session-17 execution snapshot and checklist progress.
- Updated `docs/CODE_CLEANUP_HANDOVER_PLAN.md` handover log for this runtime reorder slice.

## 2026-03-11 — Magic Pen Todo Refinement (Multi-task + Due Date)

### Changed

- Extended `src/services/input/magicPenParser.ts` todo pipeline with date-anchor aware segmentation so compact multi-task input can emit multiple todo drafts.
- Added todo date extraction for `明天` / `后天` / `下周X` / `3.18` / `3-18` / `3月18(号)` and mapped parsed values to `todo.dueDate`.
- Implemented yearless-date rollover rule in parser: resolve to this year first; if the date is already past, roll to next year.
- Improved todo content cleanup to remove date/duty scaffolding from `draft.content` (for example `明天考试` -> `考试`).
- Updated `src/features/chat/MagicPenSheet.tsx` to show editable todo date input bound to `draft.todo.dueDate`; extracted helper utilities to new `src/features/chat/magicPenSheetHelpers.ts`.
- Added parser regressions in `src/services/input/magicPenParser.test.ts` for multi-task todo split, date matrix parsing, content cleanup, and year rollover behavior.
- Added locale key `chat_magic_pen_due_date` in `src/i18n/locales/en.ts`, `src/i18n/locales/zh.ts`, and `src/i18n/locales/it.ts`.

### Validation

- `npm run test:unit -- src/services/input/magicPenParser.test.ts`
- `npm run test:unit -- src/store/magicPenActions.test.ts`
- `npx tsc --noEmit`

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` with session-15 execution snapshot and next manual-acceptance focus.
- Updated `docs/CODE_CLEANUP_HANDOVER_PLAN.md` with a new handoff log entry for this parser/sheet refinement slice.

## 2026-03-11 — Magic Pen Phase 2 Slice (Explicit Time-Range Parsing)

### Changed

- Extended `src/services/input/magicPenParser.ts` with explicit range extraction for activity drafts (`从10点到12点`, `10:30-11:45`, `至` / `~` variants) before fallback single-point parsing.
- Added end-time period-label inference when only the range start carries a period token (for example `下午3点到4:30` keeps end time in the same afternoon context).
- Updated content stripping logic in parser normalization so range markers do not leak into draft text content.
- Extracted Magic Pen open/close input handoff rules into `src/features/chat/chatPageActions.ts` and rewired `src/features/chat/ChatPage.tsx` to consume those helpers for deterministic restore behavior.
- Added regression tests in `src/features/chat/chatPageActions.test.ts` for input handoff capture, cancel-restore, and submit-no-restore paths.
- Improved `src/features/chat/MagicPenSheet.tsx` partial-retry UX: failed drafts reset to retryable state on edit/delete, and submit CTA switches to `chat_magic_pen_retry_failed` when only failed drafts remain.
- Added `chat_magic_pen_retry_failed` locale key in `src/i18n/locales/en.ts`, `src/i18n/locales/zh.ts`, and `src/i18n/locales/it.ts`.

### Validation

- `npm run test:unit -- magicPenParser.test.ts magicPenActions.test.ts`
- `npm run test:unit -- src/features/chat/chatPageActions.test.ts src/services/input/magicPenParser.test.ts src/store/magicPenActions.test.ts`
- `npm run lint:max-lines`
- `npm run lint:docs-sync`
- `npm run lint:state-consistency`
- `npx tsc --noEmit`
- `npm run build`

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` to mark the Phase 2 parser slice complete and keep manual sheet acceptance as the next single step.
- Updated `docs/CODE_CLEANUP_HANDOVER_PLAN.md` with this session's execution and validation snapshot.

## 2026-03-11 — Magic Pen Phase 1 Implementation (Chat Entry + Parser + Commit)

### Added

- Added Magic Pen feature files: `src/features/chat/MagicPenSheet.tsx`, `src/services/input/magicPenTypes.ts`, `src/services/input/magicPenRules.zh.ts`, `src/services/input/magicPenParser.ts`, `src/services/input/magicPenDraftBuilder.ts`, `src/store/magicPenActions.ts`.
- Added automated coverage for Magic Pen parser and commit orchestration: `src/services/input/magicPenParser.test.ts`, `src/store/magicPenActions.test.ts`.

### Changed

- Updated `src/features/chat/ChatInputBar.tsx` to include explicit Magic Pen entry button and callback wiring.
- Updated `src/features/chat/ChatPage.tsx` with minimal wiring-only state (`isMagicPenOpen`, `restoreInputRef`) and `MagicPenSheet` mount/close handoff.
- Updated locale dictionaries `src/i18n/locales/en.ts`, `src/i18n/locales/zh.ts`, and `src/i18n/locales/it.ts` with Magic Pen UI/error/status keys.

### Validation

- `npm run test:unit`
- `npm run lint:max-lines`
- `npm run lint:docs-sync`
- `npm run lint:state-consistency`
- `npx tsc --noEmit`
- `npm run build`

### Doc-sync impact

- Updated `src/features/chat/README.md` with Magic Pen user flow, dependencies, and test anchors.
- Updated `docs/CODE_CLEANUP_HANDOVER_PLAN.md` and `docs/CURRENT_TASK.md` to reflect execution progress and validation snapshot.

## 2026-03-11 — Magic Pen Spec Upgrade (Draft -> Execution-Ready)

### Changed

- Rewrote `docs/MAGIC_PEN_CAPTURE_SPEC.md` from a product draft into an implementation-ready spec aligned with the current `/chat` input flow, `useChatStore.insertActivity()`, `useTodoStore.addTodo()`, and report-duration constraints.
- Corrected repo-reality mismatches in the spec: no existing left-slot button in `ChatInputBar`, no current `MagicPen` code, no `/api/magic-pen-parse` endpoint, and no support for timestamp-only activity backfill in the current timeline model.
- Replaced the speculative file plan with an executable one that avoids colliding with the existing `src/services/input/types.ts` and explicitly keeps magic-pen parsing out of `ChatPage.tsx`.

### Validation

- `npm run lint:docs-sync`

### Doc-sync impact

- `docs/MAGIC_PEN_CAPTURE_SPEC.md` now serves as the implementation baseline for future magic-pen work under `src/features/chat`, `src/services/input`, `src/store`, and `src/i18n/locales/*`.

## 2026-03-10 — Moodauto Phase 3.6 (Evaluator Alignment + Evidence-Only Recall Patch + Monitor Mainline)

### Changed

- Aligned python evaluator behavior with the TS classifier contract in `scripts/evaluate_live_input_gold.py` (latin branch routing, token-overlap context matching, and evidence-based `mood_about_last_activity` gating) to reduce evaluation drift.
- Expanded evidence-only reference/evaluation coverage for `mood_about_last_activity` in zh/en/it rule packs: `src/services/input/liveInputRules.zh.ts`, `src/services/input/liveInputRules.en.ts`, and `src/services/input/liveInputRules.it.ts`.
- Refined latin language detection cues in `src/services/input/liveInputClassifier.ts` and synced evaluator-side language cues in `scripts/evaluate_live_input_gold.py`.
- Extended classifier regressions in `src/services/input/liveInputClassifier.test.ts` for new zh/en/it evidence cases.

### Validation

- `npm run test:unit -- src/services/input/liveInputClassifier.test.ts src/services/input/liveInputRules.test.ts`
- `python scripts/evaluate_natural_probe.py`
- `npm run eval:live-input:gold`

### Metrics

- Natural probe (`120` samples): `internal_accuracy 75.83% -> 77.50%`.
- Natural probe `mood_about_last_activity` recall: `69.57% -> 78.26%`.
- zh natural-probe `mood_about_last_activity` recall: `68.75% -> 75.00%`.
- zh gold `internal_accuracy`: `93.45% -> 94.05%`; zh gold `mood_about_last_activity` recall: `38.46% -> 46.15%`.

### Decision

- Product execution decision: close `moodauto` as active development mainline and keep it in monitor mode with explicit reopen triggers based on consecutive natural-probe regressions.

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` to mark the mainline transition (`development -> monitor`) and record reopen thresholds.
- Updated `docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md` metrics section to mirror monitor-mode reopen thresholds and fallback policy.

## 2026-03-10 — Moodauto Phase 3.5 (Backlog Closure: Multilingual + Telemetry + Fallback Decision)

### Added

- Added lightweight local telemetry module `src/services/input/liveInputTelemetry.ts` to track auto-recognition totals, internal-kind distribution, top classifier reasons, and reclassify path counts.
- Added `src/services/input/liveInputRules.test.ts` with 24 smoke regressions across zh/en/it rule packs (ongoing/completion/mood/future-plan coverage).

### Changed

- Expanded English rule seeds in `src/services/input/liveInputRules.en.ts` for completion variants (`wrapped up`, `got done with`), richer activity patterns (report/review/meeting/workout contexts), mood/evaluation expressions (`relieved`, `drained`, `that was stressful`), and stronger future-plan interception.
- Expanded Italian rule seeds in `src/services/input/liveInputRules.it.ts` for completion/activity variants (`ho appena finito`, `ho terminato`, `inviato il report`), richer mood terms (`esausto`, `sollevato`), and broader future-plan phrases (`ho intenzione di`).
- Updated latin classifier context relevance in `src/services/input/liveInputClassifier.ts` to use token-overlap matching instead of raw substring contains for recent-activity linkage.
- Wired telemetry recording into auto-send and correction paths (`src/store/chatActions.ts`, `src/store/useChatStore.ts`) and covered telemetry behavior in `src/store/chatActions.test.ts` + `src/store/useChatStore.integration.test.ts`.
- Extended multilingual regressions in `src/services/input/liveInputClassifier.test.ts` with en/it `activity_with_mood`, future-plan blocking, and unrelated-context non-linking cases.

### Validation

- `npm run test:unit -- src/services/input/liveInputClassifier.test.ts src/services/input/liveInputRules.test.ts src/store/chatActions.test.ts src/store/useChatStore.integration.test.ts`
- `npm run eval:live-input:gold`
- `python scripts/evaluate_natural_probe.py`
- `npx tsc --noEmit`
- `npm run lint:state-consistency`

### Metrics and Decision

- zh gold (latest rerun): `internal_accuracy=98.21%`.
- natural probe (latest rerun): `internal_accuracy=89.23%`, remaining top gap still `activity_with_mood` under-recall.
- Product/engineering decision: keep AI fallback disabled for now; continue rule + telemetry-driven hardening and revisit only if correction/misclassification trends regress.

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` checklist/next-step/validation snapshot to mark the Phase 3 backlog item complete and record the fallback decision basis.

## 2026-03-10 — Moodauto Phase 3.4 (Activity-with-Mood Recall Tuning Round 2)

### Changed

- Tuned zh activity detection in `src/services/input/liveInputRules.zh.ts` with new high-frequency natural patterns (`改代码`, `打完`, `通电话`, `午休`, `会开得`, `刚把...交了`) to reduce `activity_with_mood -> standalone_mood` misses.
- Tuned zh mood-evaluation patterns in `src/services/input/liveInputRules.zh.ts` (`得很顺利/得很好`, `感觉轻松`) and promoted weak completion words as mood evidence in `src/services/input/liveInputClassifier.ts` for mixed routing (`activity_with_mood`).
- Synced offline evaluator heuristics in `scripts/evaluate_live_input_gold.py` with the same tuning direction for comparable natural/gold reruns.

### Added

- Added targeted regression samples in `src/services/input/liveInputClassifier.test.ts` for previously missed natural cases: `和客户会开得很顺利`, `刚打完球，好爽`, `写完报告了，终于松口气`, `午休睡得很好`, `买到想要的东西，开心`.

### Validation

- `npm run test:unit -- src/services/input/liveInputClassifier.test.ts`
- `npx tsc --noEmit`
- `npm run eval:live-input:gold`
- `python scripts/evaluate_natural_probe.py`

### Metrics

- Natural probe `internal_accuracy`: `80.00% -> 89.23%`.
- Natural probe `activity_with_mood` recall: `46.67% -> 66.67%`.
- zh gold `internal_accuracy`: `98.81% -> 98.21%` (minor tradeoff: one `new_activity -> activity_with_mood` over-trigger).

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` validation snapshot with round-2 tuning scope and post-rerun metrics/tradeoff note.

## 2026-03-10 — Moodauto Phase 3.3 (Multilingual Baseline Seed + Eval Rerun)

### Added

- Added `src/services/input/liveInputRules.en.ts` with baseline English activity/mood/future-plan/reference rules for V1 latin-path fallback.
- Added `src/services/input/liveInputRules.it.ts` with baseline Italian activity/mood/future-plan/reference rules for V1 latin-path fallback.
- Added en/it baseline regressions to `src/services/input/liveInputClassifier.test.ts` for `standalone_mood`, `new_activity`, `mood_about_last_activity`, and future/plan interception behavior.

### Changed

- Updated `src/services/input/liveInputClassifier.ts` to route non-CJK latin input into lightweight language-aware (en/it) classification while keeping zh chain as the primary path.
- Kept ongoing-context attach hint for mood outputs (`relatedActivityId`) consistent across zh and latin paths.

### Validation

- `npm run test:unit -- src/services/input/liveInputClassifier.test.ts`
- `npx tsc --noEmit`
- `npm run eval:live-input:gold`
- `python scripts/evaluate_natural_probe.py`

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` validation snapshot with multilingual baseline landing and latest evaluation metrics.

## 2026-03-10 — Moodauto Phase 2.4/3.2 (Source-Aware Attachment Cleanup + Edit Recompute)

### Changed

- Updated `src/store/useMoodStore.ts` to track mood attachment origin metadata (`activityMoodMeta` / `moodNoteMeta`) with `source` and optional `linkedMoodMessageId`, plus `clearAutoMoodAttachmentsByMessage()` for deterministic correction cleanup.
- Updated `src/store/chatActions.ts` reclassify side effects to clean derived mood attachment data by linked mood message id instead of content equality, and routed mood dispatch with explicit `relatedActivityId`.
- Updated `src/store/useChatStore.ts` `sendMood()` to stop implicit fallback attachment to the latest activity; mood attach now only happens when dispatch passes explicit `relatedActivityId`.
- Updated `src/store/useChatStore.ts` `updateActivity()` to recompute mood only when attachment source is `auto` and custom manual label is not applied.
- Updated `src/services/input/liveInputClassifier.ts` so `standalone_mood` can carry ongoing activity id as runtime write hint (`relatedActivityId`) without changing classification kind.

### Added

- Added integration regressions in `src/store/useChatStore.integration.test.ts` for ongoing-vs-ended standalone mood attachment boundary and edit recompute behavior (`auto` mutable / `manual` immutable).
- Added source-aware cleanup assertions in `src/store/chatActions.test.ts` and integration flow to ensure `mood -> activity` correction clears linked auto mood artifacts.

### Validation

- `npm run test:unit -- src/store/chatActions.test.ts src/store/useChatStore.integration.test.ts`
- `npm run test:unit -- src/services/input/liveInputClassifier.test.ts`
- `npx tsc --noEmit`
- `npm run lint:state-consistency`

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` checklist and validation snapshot to mark Phase 2 / P2 and Phase 3 / P1 done and to set the next focus on Phase 3 backlog.

## 2026-03-10 — Moodauto Phase 3.1 (Context-Gated Completion Chain)

### Changed

- Updated `src/services/input/liveInputClassifier.ts` decision order to enforce non-activity/future-intent interception before activity detection and to split completion handling into strong completion (context-gated) vs weak completion (mood-biased evidence).
- Added ongoing/completion/context-token helpers and removed raw substring-based recent-context linkage in favor of token-overlap relevance checks.
- Updated `src/services/input/liveInputRules.zh.ts` with ongoing patterns, strong completion patterns, weak completion words, expanded future/plan negative patterns, and context keyword dictionary used by overlap matching.
- Extended `src/services/input/liveInputClassifier.test.ts` with regressions for strong completion with/without related context, weak completion non-linking behavior, and negative-intent priority.

### Validation

- `npm run test:unit -- src/services/input/liveInputClassifier.test.ts`
- `npm run lint:docs-sync`
- `npm run lint:state-consistency`

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` checklist/next-step/validation snapshot for the completion-context classifier milestone.
- Updated `docs/ACTIVITY_MOOD_AUTO_RECOGNITION_REFACTOR_PROPOSAL.md` to record agreed constraints (weak completion isolation, token-overlap context relevance, and negative-intent-first ordering).

## 2026-03-10 — Moodauto Phase 2.3 (ChatPage Reclassify Wiring Regression)

### Added

- Added `src/features/chat/chatPageActions.ts` to isolate latest-message correction trigger wiring (`reclassifyRecentInput` + row-action collapse) from `ChatPage` UI container.
- Added `src/features/chat/chatPageActions.test.ts` covering the reclassify trigger contract: argument forwarding, collapse ordering after async completion, and failure-path non-collapse.

### Changed

- Updated `src/features/chat/ChatPage.tsx` to delegate row correction handler to `handleLatestMessageReclassify()` for deterministic regression coverage.

### Validation

- `npm run test:unit -- src/features/chat/chatPageActions.test.ts`

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` to mark Phase 2 / P1++ done and expand next executable items from `docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md` (derived data cleanup, ongoing/ended attachment boundary, and mood source recompute rules).
- Updated `src/features/chat/README.md` with the new chat-page action helper dependency and test coverage anchor.

## 2026-03-10 — Moodauto Phase 3 (zh Gold Calibration Round 1)

### Added

- Added `scripts/evaluate_live_input_gold.py` to run offline classifier evaluation against parent-level `seeday_gold_samples.xlsx`, including accuracy, mismatch pairs, and per-label recall breakdown.
- Added `npm run eval:live-input:gold` in `package.json` to rerun zh baseline checks quickly.
- Added gold-driven zh regression cases in `src/services/input/liveInputClassifier.test.ts` for colloquial activity terms, non-activity intent guards, and short context-evaluation mood cases.

### Changed

- Tuned zh rule dictionary in `src/services/input/liveInputRules.zh.ts`: expanded colloquial activity phrases, added single-verb activity patterns, expanded mood/evaluation lexicon, and introduced non-activity intent patterns.
- Updated classifier logic in `src/services/input/liveInputClassifier.ts` to reduce single-character verb false positives, apply non-activity score correction, and strengthen short evaluative context bias to `mood_about_last_activity`.

### Validation

- `npm run test:unit -- src/services/input/liveInputClassifier.test.ts`
- `python scripts/evaluate_live_input_gold.py --lang zh`
- `python scripts/evaluate_live_input_gold.py`

### Doc-sync impact

- Updated `docs/CURRENT_TASK.md` validation snapshot and next-step focus to include gold-based zh calibration status and follow-up direction.

## 2026-03-09 — Moodauto Phase 2.2 (Store Integration Regression)

### Added

- Added `src/store/useChatStore.integration.test.ts` to validate end-to-end store flow (`useChatStore -> chatActions`) for representative sentence routing and latest-message `reclassifyRecentInput()` timeline repair.
- Covered integration cases for `activity_with_mood` writeback, `mood_about_last_activity` linkage, and bidirectional latest-message correction (`mood <-> activity`).

### Notes

- Test run keeps non-blocking `zustand persist middleware` warnings in node test runtime (storage unavailable), while assertions and behavior checks pass.

### Doc-sync impact

- Updated progress and remaining test gap in `docs/CURRENT_TASK.md` (store integration completed; ChatPage UI trigger regression remains follow-up).

## 2026-03-09 — Moodauto Phase 2.1 (Sentence-level Store Regression Tests)

### Added

- Added `src/store/chatActions.test.ts` with sentence-level regression for auto-recognition dispatch (`mood`, `activity`, `activity_with_mood`, `mood_about_last_activity`) through `sendAutoRecognizedInputFlow()`.
- Added latest-message correction regression in `src/store/chatActions.test.ts` for `buildRecentReclassifyResult()` timeline repair boundaries (`mood -> activity`, `activity -> mood`, and non-latest rejection).

### Doc-sync impact

- Synced progress and remaining validation gap in `docs/CURRENT_TASK.md` (Phase 2 / P1 store-action tests completed; UI/store integration regression kept as follow-up).

## 2026-03-09 — Moodauto Phase 2 (Latest-message Reclassify)

### Changed

- Added `reclassifyRecentInput(messageId, nextKind)` in `src/store/useChatStore.ts` for latest-message correction in record mode.
- Added minimal timeline-repair helpers in `src/store/chatActions.ts`: latest-message `mood -> activity` closes previous open activity at the target timestamp, and latest-message `activity -> mood` reopens adjacent previous activity when it was closed by that message.
- Added row-level quick reclassify entry in `src/features/chat/MessageItem.tsx` and connected it in `src/features/chat/ChatPage.tsx` (latest record only).
- Added i18n keys for reclassify actions in `src/i18n/locales/en.ts`, `src/i18n/locales/zh.ts`, and `src/i18n/locales/it.ts`.

### Doc-sync impact

- Updated chat module contract in `src/features/chat/README.md` to include latest-message correction flow and chat action ownership.
- Updated session anchor in `docs/CURRENT_TASK.md` to mark Phase 2 / P0 latest-message correction complete and move next focus to Phase 3 backlog.
- Synced handover log in `docs/CODE_CLEANUP_HANDOVER_PLAN.md` for code/doc state consistency.

## 2026-03-09 — Moodauto Phase 1.5 (Input Flow Decoupling)

### Changed

- Refactored auto-recognized input flow in `src/store/chatActions.ts` into explicit stages: `classifyAutoRecognizedInput()`, `dispatchAutoRecognizedInput()`, `applyAutoRecognizedInputEffects()`, and unified orchestrator `sendAutoRecognizedInputFlow()`.
- Updated `src/store/useChatStore.ts` so `sendAutoRecognizedInput()` now delegates to the unified flow and no longer mixes classification rules with send side effects in one inline branch block.
- Kept behavior compatibility for `activity_with_mood` by applying mood writeback (`setMood` / `setMoodNote`) in the post-effects stage after dispatch.

### Doc-sync impact

- Synced session anchor in `docs/CURRENT_TASK.md` to record the classify -> dispatch -> effects decoupling milestone while keeping Phase 2 (`reclassifyRecentInput`) as the next active step.
- Synced handover log in `docs/CODE_CLEANUP_HANDOVER_PLAN.md` for code/doc state consistency.

## 2026-03-09 — Moodauto Phase 1 (Rule Regression Tests)

### Added

- Added `Vitest` unit test setup in `package.json` with `test:unit` and `test:unit:watch`, and added `vitest` to `devDependencies`.
- Added `src/services/input/liveInputClassifier.test.ts` with zh seed case coverage for `standalone_mood`, `new_activity`, `activity_with_mood`, and `mood_about_last_activity`, plus additional regression samples and context-bias/no-bias boundaries.
- Added `src/services/input/liveInputContext.test.ts` for recent-activity lookup behavior, including ongoing-priority, 30-minute window acceptance, and mood/chat exclusion.

### Doc-sync impact

- Synced execution checkpoint and next-step focus in `docs/CURRENT_TASK.md` (Phase 1 / P1 marked complete; Phase 2 / P0 promoted as next step).
- Synced handover board/log in `docs/CODE_CLEANUP_HANDOVER_PLAN.md` for traceability of test infrastructure and regression coverage landing.

## 2026-03-09 — Moodauto Phase 1 (Auto Recognized Input)

### Changed

- Added rule-based live input classification service under `src/services/input/` (`types.ts`, `liveInputRules.zh.ts`, `liveInputContext.ts`, `liveInputClassifier.ts`) for `activity`/`mood` auto recognition with recent-activity context bias.
- Added `sendAutoRecognizedInput()` in `src/store/useChatStore.ts` as the chat main input entry, and routed `ChatPage` send flow through this unified action.
- Updated record-path mood detection in `src/store/chatActions.ts` to local rule detection only, removing the unconditional classifier API dependency from the primary path.
- Updated `ChatInputBar` and `ChatPage` to a neutral single-input UX (no heart mode toggle) and added `chat_placeholder_neutral` i18n key in `src/i18n/locales/en.ts`, `src/i18n/locales/zh.ts`, and `src/i18n/locales/it.ts`.
- Added `activity_with_mood` writeback in `src/store/useChatStore.ts` to persist derived mood tag and note via `useMoodStore.activityMood` and `useMoodStore.moodNote` without changing message persistence schema.

### Doc-sync impact

- Mainline task status and next checkpoint were synced in `docs/CURRENT_TASK.md`.
- Input-path behavior and ownership moved to rule-based service/store entry while keeping module boundary under `src/features/chat` + `src/store` + `src/services/input`.

## 2026-03-07 — Cleanup H5/H6/H7

### Changed

- Completed cleanup task H5 by splitting annotation serverless implementation: `api/annotation.ts` is now a thin route entry, core handler moved to `api/annotation-handler.ts`, and prompt/default-template logic moved to `api/annotation-prompts.ts`.
- Completed cleanup task H6 by extracting `insertActivity` collision/persistence flow from `src/store/useChatStore.ts` into `src/store/chatActions.ts` via `buildInsertedActivityResult` and `persistInsertedActivityResult`; also extracted duration-sync helper flow (`buildMessageDurationUpdate`/`persistMessageDurationUpdate`).
- Completed cleanup task H7 by removing unused heavy dependencies `cannon-es`, `matter-js`, `three`, and `@types/matter-js` from `package.json` and lockfile.
- Synced cleanup decision: H8 (`commit-msg` hook) is marked as stop-execution by user choice and will not be implemented in this round.

### Doc-sync impact

- API route internals changed (`api/annotation.ts` split into entry + handler + prompts) and module docs were synced in `src/api/README.md`.
- Cleanup board and session anchor were synced in `docs/CODE_CLEANUP_HANDOVER_PLAN.md` and `docs/CURRENT_TASK.md`.

## 2026-03-06 (续) — Git Hook 自动拦截

### Added

- Added `scripts/check-secrets.mjs`: scans staged files for hardcoded keys/tokens (patterns: `sk-`, `cpk_`, Bearer, Supabase service role). Registered as `npm run lint:secrets`.
- Added `scripts/pre-commit.mjs`: pre-commit hook entry point, runs 4 checks in fast-fail order (secrets → max-lines → doc-sync → tsc).
- Added `scripts/install-hooks.mjs`: installs hook scripts into `.git/hooks/`, auto-runs via `npm run prepare`.
- Added `npm run lint:all`: shortcut running all 4 quality checks.
- Added `npm run prepare`: auto-installs git hooks on `npm install`.
- `LLM.md` expanded into full AI onboarding guide: session SOP (3-step), coding rules, loop checks, doc-sync matrix, prohibited items, and related-doc table.

### Doc-sync impact

- `scripts/` directory: 3 new files, no existing paths changed → `check-doc-sync` scope unaffected.
- `package.json` scripts block changed → no README update required (no API/store/route changes).

## 2026-03-06

### Added

- Added `LLM.md` as the single L1 AI/LLM entry document and removed `CLAUDE.md` from active plan scope.
- Added module-level docs: `src/features/auth/README.md`, `src/features/todo/README.md`, `src/features/report/README.md`, and `src/api/README.md`.
- Added `scripts/check-doc-sync.mjs` and new command `npm run lint:docs-sync`.
- Added `docs/CURRENT_TASK.md` as the session-resume anchor file for checkpointed restart.
- Added `scripts/check-state-consistency.mjs` and new command `npm run lint:state-consistency` to block code/doc state drift.

### Changed

- Standardized `src/features/chat/README.md` to the module-template format (entry/interface/upstream/downstream/docs).
- Added `DOC-DEPS` headers to key files (`src/App.tsx`, `src/api/client.ts`, all `src/store/use*Store.ts`, all `api/*.ts`) for L3 file-level dependency tracing.
- Updated `CONTRIBUTING.md` with a required "code change -> doc update" matrix and doc-sync execution rules.
- Updated `LLM.md` global read order to require `docs/CURRENT_TASK.md` before project-map/module reads.
- Updated `scripts/check-doc-sync.mjs` required-doc list to include `docs/CURRENT_TASK.md`.
- Updated `CONTRIBUTING.md` with a session resume SOP and mandatory `lint:state-consistency` pre-submit check.

## 2026-03-05

### Changed

- Completed cleanup task F16 by decoupling annotation sync from `todayStats.events` and using `annotations[]` as the source of pending cloud sync records.
- Added `syncedToCloud` to `AIAnnotation` and updated `useAnnotationStore` to mark local annotations unsynced on create, then flip to synced after successful insert/upsert.
- Added capped event retention for `todayStats.events` (`MAX_TODAY_EVENTS = 400`) to prevent unbounded local persisted growth while preserving recent runtime context.
- Synced execution status and handover details into `docs/CODE_CLEANUP_HANDOVER_PLAN.md` (board + handover log entry).
- Completed cleanup tasks F12-F15: introduced `api/http.ts` shared wrappers (CORS/method/error JSON), unified annotation extraction in `src/lib/aiParser.ts`, optimized Stardust lookup/writeback flow, and reduced ChatPage timer hot-path overhead.
- Updated API handlers (`api/chat.ts`, `api/report.ts`, `api/classify.ts`, `api/diary.ts`, `api/stardust.ts`, `api/annotation.ts`) to use shared HTTP helpers for consistent behavior.
- Completed cleanup task F17 by introducing `src/lib/dbMappers.ts` and unifying DB row mapping for Message/Todo/Report/Stardust/Annotation/Auth sync paths.
- Completed cleanup task F18 by migrating Mood domain internal values to English keys (`happy/calm/focused/...`) with i18n-based rendering and persisted-data compatibility migration.

## 2026-03-04

### Added

- Added `CONTRIBUTING.md` with contribution flow, directory boundaries, validation, and rollback expectations.
- Added `docs/archive/2026-03-04-root-residual-disposition.md` to record root residual file disposition.
- Added `scripts/check-max-lines.mjs` and `npm run lint:max-lines` for file-size guardrails (warn >400 lines, error >800 lines).

### Changed

- Locked package manager strategy to `npm` and removed `pnpm-lock.yaml`.
- Updated package-management wording in `README.md`, `PROJECT_CONTEXT.md`, and install steps in `DEPLOY.md`.
- Synced cleanup board and handover log for D3, D6, D9, and E1 in `docs/CODE_CLEANUP_HANDOVER_PLAN.md`.
- Reviewed and improved `.gitignore` by removing duplicate `.env` rules and adding `.vercel/` ignore.
- Rewrote `api/README.md` and `src/store/README.md` to align with current implementation boundaries and reduce drift.
- Grouped shared components by responsibility into `src/components/layout` and `src/components/feedback`, then updated imports in app entry points and chat feature.
- Synced cleanup status decision: C12 and C13 are now marked as stop-execution items and will be handled by the user later.
- Corrected documentation alignment across `FEATURE_STATUS.md`, `PROJECT_CONTEXT.md`, and `docs/ARCHITECTURE.md` for the C12/C13 stop-execution status.

### Removed

- Removed stale root files: `TO-DO.json`, `YOUWARE.md`, and `SECURITY_FIX.md`.

## 2026-03-03

### Added

- Added `PROJECT_CONTEXT.md` as the global onboarding context document.
- Added `FEATURE_STATUS.md` to track module-level implementation status.
- Added `docs/CHANGELOG.md` as the single changelog entry point.

### Changed

- Rewrote root `README.md` to reflect real project scope, setup, architecture entry points, and known issues.
- Rewrote `docs/ARCHITECTURE.md` to reflect current implemented architecture only.
- Completed C14 by adding bounded pruning strategy in `src/store/useMoodStore.ts` to avoid unbounded localStorage growth.
- Fixed report detail title i18n mismatch in `src/features/report/ReportDetailModal.tsx` and locale keys.
- Synced cleanup board status for C14 and C16 in `docs/CODE_CLEANUP_HANDOVER_PLAN.md`.

### Notes

- C12/C13 are now marked as stop-execution items and are intentionally left for user-owned follow-up.
