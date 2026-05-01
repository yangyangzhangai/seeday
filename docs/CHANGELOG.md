# Changelog

All notable effective changes are documented here.

> Note: 仅保留近期变更；更早且已收口记录已归档清理，避免维护噪音。

## 2026-05-01

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
