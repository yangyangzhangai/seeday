# Changelog

All notable effective changes are documented here.

> Note: 仅保留近期变更；更早且已收口的历史记录已清理，避免维护噪音。

## 2026-04-29

### Fix: Telemetry 看板默认时间窗口统一为 7 天

- `src/features/telemetry/LiveInputTelemetryPage.tsx`、`src/features/telemetry/AiAnnotationTelemetryPage.tsx`、`src/features/telemetry/TodoDecomposeTelemetryPage.tsx`、`src/features/telemetry/ProfileSettingsTelemetryPage.tsx`、`src/features/telemetry/UserAnalyticsDashboardPage.tsx`：默认 `days` 从 14/30 调整为 7，首次进入即展示 7 天口径
- `src/api/client.ts`：`callLiveInputTelemetryDashboardAPI`、`callUserAnalyticsDashboardAPI`、`callProfileSettingsTelemetryDashboardAPI` 默认参数统一为 7，避免调用端未传参时口径不一致

Validation:

- Not run (telemetry default-window update + docs sync)

### Fix: 日记页恢复“生成日记”入口并补齐当日实时统计

- `src/features/report/ReportDetailModal.tsx`：今日日记页面新增常驻“生成日记”按钮（白天也显示）；20:00 前点击展示 `report_early_tip`，20:00 后调用 `generateAIDiary(reportId)`（Plus 生成完整 AI 观察日记，Free 生成 teaser）
- 按钮样式复用植物卡片历史版本口径（圆角胶囊、浅绿色半透明背景、轻阴影），与原“植物卡片下方生成按钮”视觉一致
- 今日日记页面的待办/习惯/目标统计改为实时重算：接入 `useTodoStore` 与 `useGrowthStore`，并使用 `computeDailyTodoStats(...)` 覆盖当日报告快照，确保环形图旁摘要与统计在白天持续更新
- `src/features/report/DiaryBookViewer.tsx`：放开“今天”页双击打开详情限制（未来日期仍不可打开），支持从日记本翻到今天后直接进入详情并触发生成日记入口
- `src/features/report/plant/PlantFlipCard.tsx` + `src/features/report/plant/PlantRootSection.tsx`：恢复历史双按钮布局（保存卡片 + 生成日记）；生成日记按钮支持 20:00 前提示与 20:00 后触发日记生成

Validation:

- `npx tsc --noEmit` ✅

### Update: Telemetry 埋点审计落地 + 看板 PM 注释补齐

- 新增审计报告 `docs/Telemetry_Audit_Report_2026-04-29.doc`，覆盖全量埋点来源、事件口径、业务意义、看板位置与缺口规划
- `src/features/telemetry/LiveInputTelemetryPage.tsx` 新增“会员分类路径”分区，基于 `topReasons` 聚合展示 `user_plan`、`classification_path`、`ai_called`、`bottle_match_source`
- `src/features/telemetry/LiveInputTelemetryPage.tsx` 为实时输入核心指标补齐“1-2 句”小字解释，明确统计含义与高低决策方向
- `src/features/telemetry/UserAnalyticsDashboardPage.tsx` 增加看板说明与核心 KPI 注释，提升 PM 对增长/转化/活跃的解读一致性
- `src/features/telemetry/FeedbackTelemetryPage.tsx` 增加阅读指南与反馈指标注释，支持按问题类型占比做产品优先级排序
- `src/features/telemetry/AiAnnotationTelemetryPage.tsx` 为 AI 批注核心 KPI（触发率/样本量/触发事件/平均分/平均概率）补齐小字解释，统一 PM 决策阅读体验
- `src/i18n/locales/{zh,en,it}.ts` 同步新增上述看板文案键，保持三语一致

Validation:

- Not run (requested report + dashboard copy/readability update)

### Fix: 全量文案三语一致性巡检收口（含 onboarding）

- `src/i18n/locales/{zh,en,it}.ts` 完成三语键位与占位符巡检：三套 key 集合一致（1211 个），并修复 `report_ai_diary_waiting`、`report_generating` 在 `en/it` 缺失 `{{companion}}` 占位符的问题
- `src/components/layout/Header.tsx` 移除硬编码中文按钮文案“更换头像”，改为 `t('auth_change_avatar')`；头像 `alt` 改为 `t('avatar_alt')`
- `src/components/QuickActivityPicker.tsx` 将中文前缀模板 `你结束...了` 改为 i18n key `quick_activity_prefix_ended`，统一 zh/en/it
- `src/i18n/locales/zh.ts`、`src/i18n/locales/en.ts`、`src/i18n/locales/it.ts` 新增 `avatar_alt`、`quick_activity_prefix_ended` 三语词条

### Fix: 可变日历日期/周标签三语对齐

- `src/features/growth/GrowthTodoCard.tsx`：截止时间展示从 `toLocaleString(undefined, ...)` 改为 `toLocaleString(i18n.language, ...)`，确保随应用语言切换
- `src/features/growth/GrowthTodoCard.tsx`、`src/features/growth/AddGrowthTodoModal.tsx`：每周重复的周几标签从中文硬编码改为 i18n（`weekday_short_sun`~`weekday_short_sat`）
- `src/i18n/locales/zh.ts`、`src/i18n/locales/en.ts`、`src/i18n/locales/it.ts` 新增 `weekday_short_*` 三语词条

Validation:

- `npx tsc --noEmit` ✅
- `npm run -s lint:docs-sync` ✅

### Update: Prompt 三语对齐补齐（Magic Pen + Diary Insight）

- `src/server/magic-pen-prompts.ts` 重写 `MAGIC_PEN_PROMPT_EN` 与 `MAGIC_PEN_PROMPT_IT`，补齐与中文主提示一致的结构与约束：角色定位、上下文输入、严格 JSON schema、kind 语义、时间推断、锚点回填策略、混合句拆分规则、长序列“全提取”规则
- `api/diary.ts` 的 insight 分支新增意大利语 prompt 组装（`topic map` + `behavior rule` + `systemMsg`），避免 `lang=it` 走英文提示，保证 `zh/en/it` 三语规则一致

Validation:

- Not run (prompt text update only)

### Fix: AI 日记输入链路补齐全量意大利语文案

- `src/store/reportActions.ts` 为日记输入构建补齐 `it` 分支：今日目标/时间记录/心情与能量/习惯打卡/目标进展/待办总览/完成事项/历史摘要等标签全部意大利语化
- `src/store/reportActions.ts` 新增 mood key 到意大利语标签映射（如 `happy -> felice`、`anxious -> ansioso`），避免意语链路混入英文情绪词
- `src/lib/report-calculator/formatter.ts` 为结构化数据格式化补齐 `it` 分支（标题、总时长、专注时长、todo 汇总、事件清单、省略项、未标注时段、心情日志）

Validation:

- Not run (requested code-only update)

### Update: 四个 AI 人设日记 prompt 的 en/it 向中文语义对齐

- `src/lib/aiCompanion/prompts/van.ts` 重写 `VAN_DIARY_PROMPT_EN` 与 `VAN_DIARY_PROMPT_IT`，按中文版本同步输出结构、写作步骤、素材挖掘项、护短检查与【】段落要求，语气更自然口语化
- `src/lib/aiCompanion/prompts/agnes.ts` 重写 `AGNES_DIARY_PROMPT_EN` 与 `AGNES_DIARY_PROMPT_IT`，对齐中文版本的“克制+洞察”叙事路径、步骤约束与落款规则
- `src/lib/aiCompanion/prompts/zep.ts` 重写 `ZEP_DIARY_PROMPT_EN` 与 `ZEP_DIARY_PROMPT_IT`，对齐中文版本的“先扫描分量、再落真话”结构与护短边界
- `src/lib/aiCompanion/prompts/momo.ts` 重写 `MOMO_DIARY_PROMPT_EN` 与 `MOMO_DIARY_PROMPT_IT`，对齐中文版本的散文诗/微童话写法、三步内化流程与蘑菇视角约束
- 根据产品文案要求，四个人设 prompt（zh/en/it）中涉及旧品牌名的表述统一替换为“时光温室 / time greenhouse / serra del tempo”
- 按规则调整称呼注入：移除 system prompt 中 `__ADDRESSEE__` 占位符依赖，改为仅在 `api/diary.ts` 的 user prompt `[Addressee rule - highest priority]` 中强约束称呼
- `src/lib/aiCompanion/prompts/{van,agnes,zep,momo}.ts` 日记 prompt 同步移除 `__ADDRESSEE__` 文本，改为引用 user prompt 的称呼规则
- `src/lib/aiCompanion.ts` 新增统一语言硬约束后缀：`zh=en=it` 分别附加“必须使用中文输出 / You must output in English / Devi rispondere in italiano”，覆盖 diary + annotation（含所有人设与轮换版本）

Validation:

- Not run (prompt text update only)

### Fix: 日记全链路三语文案收口（移除单语硬编码）

- `src/features/report/DiaryBookViewerExpandedView.tsx` 改为全量使用 `t(...)` 文案键，并按当前语言切换日期 locale（`zh/en/it`）；移除仅中文的标题、占位和空态提示
- `src/features/report/DiaryBookViewer.tsx` 移除封面副标题硬编码 `Diary`，改为 i18n；星星计数改为 `diary_star_count` 三语模板
- `src/features/report/ReportDetailModal.tsx` 星星计数文案改为 i18n（不再固定英文 `stars`）
- `api/diary.ts` 失败提示按 `lang` 返回三语文案（zh/en/it），避免服务端错误信息固定中文
- `src/i18n/locales/zh.ts`、`src/i18n/locales/en.ts`、`src/i18n/locales/it.ts` 新增 diary 扩展页相关 key（expanded view + cover subtitle + star count）

Validation:

- `npx tsc --noEmit` ✅

### Fix: Growth 待办子步骤长文本不再单行截断

- `src/features/growth/SubTodoList.tsx` 将子步骤标题从单行 `truncate` 改为最多两行展示（`WebkitLineClamp: 2`），并保留 `min-w-0`，确保在移动端窄屏下优先显示更多步骤语义
- 保持右侧时长（`5分钟`）与专注按钮区域为 `flex-shrink-0`，避免因标题变长导致操作区被压缩或错位

Validation:

- Not run (UI style-only change)

### Fix: onboarding 试用会员改为点击 CTA 后才激活

- `src/features/onboarding/OnboardingFlow.tsx` 移除 `StepTrialIntro` 挂载即触发的 `callActivateTrialAPI()`，改为用户点击 `onboarding_trial_cta`（Start my experience / 开始体验 / 对应意语文案）后再调用
- 增加点击防抖状态 `activating`，避免重复点击导致重复请求；接口失败时不阻塞引导流程，仍继续下一步

Validation:

- Not run (frontend interaction flow change)

### Fix: 跨天自动日记空统计（活动/心情/待办）

- `src/hooks/useMidnightAutoGenerate.ts` 在执行“昨日日报 + 植物 + Plus 日记”前新增 domain warmup：确保 chat/todo/mood/growth 至少完成首轮加载，减少“刚登录即补偿”读取到空内存态
- 新增“稀疏 stats 自动修复”逻辑：若昨日报告 `stats` 近空且昨日存在消息，自动重算昨日报告后再继续 Plus 日记生成，避免出现“有 AI 日记但活动/心情/待办为空”

Validation:

- Not run (pending)

### Fix: iOS TestFlight 下聊天编辑弹窗“底部被截断”视觉问题

- `src/features/chat/EditInsertModal.tsx` 将移动端弹窗卡片从 `rounded-t-3xl`（贴底 sheet 形态）调整为 `rounded-3xl`，并新增 `mb-[max(8px,env(safe-area-inset-bottom,0px))]` 底部留缝
- 保留现有 safe-area 底部内边距，确保保存按钮在 iOS Home Indicator 上方稳定可见，同时移除“底部直角贴边像被裁切”的视觉错觉

Validation:

- Not run (UI spacing/style-only change)

### Fix: 跨天自动补生成收口（植物 + 日记）

- `src/hooks/useMidnightAutoGenerate.ts` 新增“次日补偿”执行路径：登录后立即执行一次，且在 App 恢复前台（`visibilitychange=visible`）时再次检查，避免 iOS 后台挂起导致错过 0 点定时
- 自动补偿链路统一为：先确保昨日 `daily report` 存在，再补生成昨日植物；Plus 用户在同链路下补生成昨日日记（Free 保持现有策略）
- `src/features/report/ReportPage.tsx` 移除页面内重复的午夜定时生成逻辑，避免与全局 hook 双定时器并发触发
- `src/hooks/useMidnightAutoGenerate.ts` 新增最小重试冷却（60s）与运行中互斥，减少前后台频繁切换时的重复请求

Validation:

- `npx tsc --noEmit` ✅

### Fix: classify 瓶子关联去阈值并增强上位-下位映射

- `api/classify.ts` 删除 `matched_bottle` “语义相关度 >= 60% 才返回”的规则提示（zh/en/it 三语）
- `api/classify.ts` 在基础 prompt 与 `buildBottleMatchSection` 中补充上位-下位匹配约束：`跑步->运动`、`看书/读完一个章节->阅读`
- 保持既有安全约束不变：最多返回一个 `matched_bottle`、`stars=1`、禁止臆造候选外 id

Validation:

- Not run (prompt-only change)

### Fix: profile 地区设置保存后回填输入框

- `src/features/profile/components/RegionSettingsPanel.tsx` 读取 `useAuthStore.user.user_metadata` 的已保存地区值（优先 `location_label`，兜底 `country_code`），并将其作为输入框初始值
- 修复“地区保存成功后重新打开弹窗输入框为空”的问题，改为始终显示当前已保存地区

Validation:

- `npx tsc --noEmit` ✅

## 2026-04-28

### Feat: todo 卡片置顶功能 + 移除拖拽把手

- `src/features/growth/GrowthTodoCard.tsx` 移除不可靠的 `GripVertical` 拖拽把手；新增 `onTogglePin` prop，在展开面板底部加置顶/取消置顶按钮，已置顶时按钮高亮蓝色
- `src/features/growth/GrowthTodoSection.tsx` 接入 `togglePin`；排序逻辑新增：未完成项中置顶（`isPinned=true`）始终排在最前，Smart Sort 模式下同样生效

Validation:

- `npx tsc --noEmit` ✅

## 2026-04-27

### Fix: align static edge stacks during diary page flip

- `src/features/report/DiaryBookViewer.tsx` 将翻页阶段（live drag + snap 动画）两侧装饰堆叠层改为复用静止态同一套几何口径：`offset=vis*sideGap`、`layerShrink=(vis-1)*heightShrink`、`top/height` 与 `stackZ` 同步
- 装饰堆叠层数由固定 `3` 调整为 `MAX_VIS`，与静止态可见层级一致，减少翻页中“厚度突变”
- 边缘层颜色从独立渐变改为 `PAPER_COLOR + 轻边线`，使翻页期两侧静止页堆叠观感对齐正常静止状态
- 进一步将翻页期两侧堆叠从“窄纸边条”升级为“整页 ghost sheet”轮廓（含 `clipPath + borderRadius + boxShadow`），与正常静止态的整页堆叠体积和阴影一致
- 修复翻页期 ghost sheet 阴影不可见：将阴影从被 `clipPath` 裁切的同层 `boxShadow` 改为外层 `filter: drop-shadow(...)`，并提升阴影强度，确保两侧堆叠在翻页中可见
- 视觉微调：按反馈降低翻页期两侧堆叠阴影强度（更淡），并将 ghost sheet 左右圆角改为与正常静止态一致（左堆叠 `R-0-0-R`，右堆叠 `0-R-R-0`）
- 视觉微调：按反馈将翻页期堆叠阴影小幅回调（`drop-shadow` 半径与 alpha 略增），在保持轻阴影的前提下补回层次感
- 逻辑修正：翻页期 ghost 堆叠由固定 `MAX_VIS` 改为“按真实可见 stack level 缺口补齐”；临近封底/封面时会随真实剩余页数同步递减，避免尾页阶段伪装堆叠过量

Validation:

- `npx tsc --noEmit` ✅

### Fix: reminder popup confirm no longer loses timeline activity state

- `src/store/useChatStore.ts` 修复 reminder ✓ 触发记录链路的时间线竞态：`sendMessage()`/`sendMood()` 现在按同一份最新消息源同时回写 `messages + dateCache`，确保“自动结束上一条活动”后的 `duration/isActive` 不会只更新内存列表而遗漏缓存
- `src/store/useChatStore.ts` 移除消息写库成功后的即时 `syncState='synced'` 回写，改为等待云端回拉/实时同步统一归并，避免短窗口内被 `_refreshDateSilently` 当成“本地 synced 且云端缺失”而闪现消失
- `src/store/useChatStore.integration.test.ts` 新增断言：连续两条活动发送后，`dateCache` 与 `messages` 的 closed/open 状态保持一致，防回归“两个活动都进行中”
- 文档同步：`src/store/README.md`、`docs/CURRENT_TASK.md`

Validation:

- `npx vitest run src/store/useChatStore.integration.test.ts src/store/chatSyncHelpers.test.ts` ✅
- `npx tsc --noEmit` ✅

### Build: switch signup to email-code verification (remove phone alias path)

- `src/store/authStoreAccountActions.ts` 新增 `verifySignUpCode(email, code)` 与 `resendSignUpCode(email)`，通过 Supabase `verifyOtp(type='signup')` / `resend(type='signup')` 完成验证码确认链路
- `src/store/authStoreTypes.ts` 同步补齐 `verifySignUpCode`、`resendSignUpCode` 类型签名
- `src/features/auth/AuthPage.tsx` 与 `src/features/onboarding/OnboardingFlow.tsx` 的 `StepAuth` 统一改为邮箱注册流程：移除手机号伪邮箱（`@phone.local`）映射；注册后进入验证码输入态并完成校验后登录
- `src/i18n/locales/zh.ts`、`src/i18n/locales/en.ts`、`src/i18n/locales/it.ts` 同步清理 auth 文案中的“手机号/phone/telefono”表述，统一为邮箱注册提示
- 文档同步：`src/features/auth/README.md`、`src/store/README.md`、`docs/CURRENT_TASK.md`

Validation:

- `npx tsc --noEmit` ✅
- `npx vitest run src/store/useAuthStore.test.ts` ✅

### Fix: keep Hobby deployment under 12 Serverless functions

- 删除 `api/classify.test.ts`，避免被 Vercel 识别为额外 serverless function
- 不再保留该接口的独立 serverless 层测试文件，优先保证 Hobby 计划部署可用
- 该调整后 `api/` 目录仅保留实际线上函数入口（含 `api/supabase-proxy/[...path].ts`），避免触发 Hobby 计划函数数上限报错

Validation:

- `api/**/*.ts` 统计为 12 个函数入口 ✅

### Chore: restore max-lines hard limit and split oversized file

- `scripts/check-max-lines.mjs` 将 `ERROR_LIMIT` 从 `1200` 恢复为 `1000`
- 将 `src/features/report/DiaryBookViewer.tsx` 的页面数据构建与多语言文案拆分到新文件 `src/features/report/diaryBookViewerData.ts`
- 拆分后 `DiaryBookViewer.tsx` 行数降到 1000 以下，满足 hard limit

Validation:

- `npm run lint:max-lines` ✅

## 2026-04-26

### Fix: sign-out no longer falls back to onboarding

- 新增 `src/features/auth/AuthPage.tsx` 作为独立登录/注册入口，并挂载 `/auth` 路由
- `src/App.tsx` 路由守卫调整：未登录统一跳转 `/auth`；`/onboarding` 改为仅允许已登录用户访问
- 保持 onboarding 触发条件不变（账号 < 72h 且 profile 缺失），因此新注册且未完成引导的账号仍会继续 onboarding
- `src/features/auth/README.md` 同步模块边界与 onboarding gate 规则

Validation:

- `npx tsc --noEmit` ✅

### Fix: iOS 套壳下 Profile 弹窗保存按钮丢失

- `src/features/profile/components/RoutineSettingsPanel.tsx`：弹窗卡片加 `min-h-0`，滚动内容区加 `min-h-0`，并将弹窗最大高度口径从 `100dvh` 调整为 `100vh` + safe-area 兜底，避免 iOS WebView 下 footer 被裁切
- `src/features/profile/components/DirectionSettingsPanel.tsx`：改为 `flex` 列布局（header/content/footer），中间内容区改 `min-h-0 flex-1 overflow-y-auto`，并统一 `100vh` + safe-area 高度口径，确保底部保存区始终可见

Validation:

- `npx tsc --noEmit` ✅

### Refactor: split `useAuthStore` to resolve max-lines hard limit

- `src/store/useAuthStore.ts` 拆分为“初始化/鉴权主链路”入口，行数从 1000+ 降至 400 以下 warning 线以内
- 新增 `src/store/authStoreRuntimeHelpers.ts` 承载作用域切换、membership 解析、domain 刷新、迁移判定等运行时 helper
- 新增 `src/store/authStoreAccountActions.ts` 承载登录/登出、资料更新、语言切换等账号动作；`useAuthStore` 通过 `...createAuthAccountActions(set, get)` 组合
- `src/store/authStoreTypes.ts` 补齐 `updateDisplayName` 方法签名，和现有 `UserInfoCard` 调用保持一致
- `src/store/README.md` 同步 store 拆分约定（`authStoreRuntimeHelpers.ts` / `authStoreAccountActions.ts`）

Validation:

- `npm run lint:max-lines` ✅（`useAuthStore.ts` 不再触发超限）
- `npx tsc --noEmit` ✅

### Fix: iOS 订阅错误透传与 IAP restore 过滤收口

- `src/services/payment/iap/index.ts` 不再把所有异常统一吞成 `subscription_failed`；新增分型透传 `auth_required` / `already_subscribed` / `user_cancelled` / `purchase_pending` / `iap_client_not_ready`，前端可直接显示真实失败原因
- `src/services/payment/iap/index.ts` 的 restore 结果改为仅接受 Seeday 订阅商品（`seeday.pro.monthly(.intro)` / `seeday.pro.annual` 及环境别名），避免误拾取其他 App entitlement 导致后续校验失败
- `src/features/profile/UpgradePage.tsx` 与 `src/features/profile/components/MembershipCard.tsx` 在购买失败时优先展示原始 `result.message`（若可用），不再一律回退到泛化文案“订阅请求失败”

Validation:

- `npx tsc --noEmit` ✅
- `npm run lint:all` ⚠️ 未通过（仓库既有 `src/store/useAuthStore.ts` 超过 max-lines 硬限，与本次改动无关）

### Fix: Diary book flip perspective follows paper geometry

- `src/features/report/DiaryBookViewer.tsx` 新增 VP（消失点）驱动的页面目标点生成：以“中线水平 + 左右页向中缝收敛”为约束，生成左右页四角投影后再求解同平面 `matrix3d`（8 元线性方程）
- `PageContent` 左右页内容统一应用该投影，确保文字、分隔线、图形与页边裁切线在同一视线组，不再出现同页内斜度反向
- 修复翻页过程中“前一页内容斜度/透视与纸面边缘不一致”的视觉错位
- `src/features/report/DiaryBookViewer.tsx` 调整拖拽松手回弹：最短补间时长由 `60ms` 提升到 `180ms`，并补齐 sheet 容器 `top/height/left` 与 `transform` 同步 transition，避免翻页完成瞬间斜度突变

Validation:

- `npx tsc --noEmit` ✅

### Fix: Diary flip reveal page now locks to static spread geometry

- `src/features/report/DiaryBookViewer.tsx` 将 live drag 期间的 reveal sheet 强制对齐静止摊开页几何（`top=0`、`height=pageH`、同款 clip 规则），不再沿用堆叠层的缩高/上移形态
- 翻页渲染新增 `liveFlip.side` 与 reveal/companion 判定：拖拽时只保留“翻动页 + reveal 下一页 + 对侧当前页”，其余 stack sheet 暂时隐藏，书脊厚度仅保留边缘层
- 修复翻页中下一页初始斜率过大、主阅读面出现异形白块的视觉问题，翻后下一页起始态与静止态一致

Validation:

- `npx tsc --noEmit` ✅

### Fix: Diary flip keeps visible edge page stacks

- `src/features/report/DiaryBookViewer.tsx` 在翻页进行中（live drag 与 snap 动画阶段）新增左右两侧装饰性纸边堆叠层，恢复“书页厚度”视觉线索
- 新堆叠层仅为边缘装饰（`pointerEvents: none`），不参与翻页几何计算，不改变主阅读面 `keepDuringDrag` 策略与既有透视/裁切收口

Validation:

- `npx tsc --noEmit` ✅

### Build: Membership AI classification phase-2 closure

- `src/store/chatClassificationHelpers.ts` 扩展 classify 结果消费：在单条消息单次 classify 结果中补齐 `kind/moodType/classificationPath/aiCalled`，并保持 `membership_required` 与超时失败回退本地规则
- `src/store/useChatStore.ts` 收敛 Free/Plus 星星判定策略：`todo_link` 优先；Free 仅关键词兜底；Plus 优先消费 AI `matched_bottle`，未命中再关键词兜底
- `src/store/useChatStore.ts` 在 Plus classify 成功时复用 `mood_type` 回写 mood store（仅自动情绪，无手动覆盖时生效），统一 activity/mood/bottle 三类消费口径
- `src/services/input/liveInputTelemetryCloud.ts` 新增会员分类最小埋点上报（复用 `/api/live-input-telemetry` classification 事件，`reasons[]` 携带 `user_plan/classification_path/ai_called/ai_result_kind/bottle_match_source`）
- 新增测试：`src/store/chatClassificationHelpers.test.ts`（Free=0 调用、Plus=单条单次、membership_required 与失败降级）；`api/classify.test.ts`（非 Plus 403 防绕过）
- 新增 50 条回归脚本：`src/store/useChatStore.membership-classification.test.ts`，覆盖 Free 50 条=0 调用、Plus 50 条=50 调用、`sendMessage+endActivity` 单条去重=1 次
- 文档同步：`docs/CURRENT_TASK.md`、`src/store/README.md`、`src/api/README.md`、`api/README.md`

Validation:

- `npx vitest run src/store/chatClassificationHelpers.test.ts api/classify.test.ts` ✅
- `npx vitest run src/store/chatClassificationHelpers.test.ts api/classify.test.ts src/store/useChatStore.membership-classification.test.ts` ✅
- `npx tsc --noEmit` ✅

## 2026-04-25

### Fix: Supabase auth path uses real origin instead of proxy URL

- `src/server/supabase-request-auth.ts` 新增 Supabase URL 归一化：当 `SUPABASE_URL`/`VITE_SUPABASE_URL` 被配置为 `/supabase-proxy` 时，服务端会基于 `SUPABASE_ANON_KEY` 自动解析项目 `ref` 并改为直连 `https://<ref>.supabase.co`
- `src/server/plant-shared.ts` 改为复用 `supabase-request-auth` 的 `getSupabaseUrl/getSupabaseAnonKey`，统一所有植物接口鉴权链路 URL 解析口径，避免 proxy rewrite 未命中时 `auth.getUser` 误验失败返回 `401 Unauthorized`

Validation:

- `npx tsc --noEmit` ✅

## 2026-04-24

### Build: Membership AI classification tiering phase-1

- `/api/classify` 接入 `requireSupabaseRequestAuth`，并在服务端强制 Plus 校验；非 Plus 统一返回 `403 { error: 'membership_required' }`（包含 classify 与 todo_decompose 分支）
- `src/api/client.ts` 的 `callClassifierAPI()` 开始透传 Supabase `Authorization` 头，统一走鉴权 classify
- `src/store/useChatStore.ts` 完成 Free/Plus 分流与 classify 去重：
  - Free 仅本地规则，不触发 classify
  - Plus 按 `messageId` 复用单次 classify promise，避免 `sendMessage/endActivity` 重复调用
  - 星星判定改为 Plus 优先消费 AI `matched_bottle`，未命中再关键词兜底
  - AI 失败自动回退本地分类，不阻断记录链路
- `src/store/useTodoStore.ts` 的 `refineTodoCategoryWithAI()` 增加 Plus 门控，Free 不再触发该 AI 精修
- `src/api/client.ts` 的 `callTodoDecomposeAPI()` 补齐 Supabase `Authorization` 透传，和 `/api/classify` 的 Plus 鉴权策略保持一致，避免会员请求因缺少 token 被误判为 401
- `src/api/client.ts` 新增标准化 `ApiClientError`（`code/status/details/path/requestId`）与 `isMembershipRequiredError()`，统一承接 `membership_required` / `unauthorized` / `network_error` 等错误分支
- `src/store/chatClassificationHelpers.ts` 对 `membership_required` 显式回退 `local_rule` 路径（`aiCalled=false`），避免会员状态漂移时重复走 AI 失败降级
- `src/features/growth/SubTodoList.tsx` 在 todo 拆解失败分支使用 `isMembershipRequiredError()` 稳定识别会员权限错误并跳转升级页
- 文档同步：`docs/MEMBERSHIP_AI_CLASSIFICATION_TECH_DESIGN.md` 增加可持续打勾执行看板；`docs/CURRENT_TASK.md` 新增主线 E；`api/README.md`、`src/api/README.md`、`src/store/README.md` 同步策略口径

Validation:

- `npx tsc --noEmit` ✅
- `npx vitest run "src/store/useChatStore.integration.test.ts"` ✅

### Build: Membership AI classification prompt/schema realignment

- `api/classify.ts` 将旧“时间流水解析”prompt替换为单条输入 unified classify prompt（kind/activity_type/mood_type/matched_bottle/confidence），并明确 `kind` 必须在 `activity|mood` 二选一
- `api/classify.ts` 新增 classify 结果归一化：强制校正非法 kind/activity_type，限制 mood 枚举，confidence 归一到 0~1，并校验 `matched_bottle` 只能命中现有 habits/goals
- `api/classify.ts` 保留关键词兜底匹配作为 `matched_bottle` fallback，避免 AI 未命中时星星链路降级
- `src/api/client.ts` 更新 `callClassifierAPI` 返回结构类型到 unified classify schema（移除旧 `items/todos/energy_log`）
- `src/store/chatClassificationHelpers.ts` 与 `src/store/useTodoStore.ts` 改为直接消费 `data.activity_type` 与 `data.matched_bottle`，并移除旧 category 映射依赖
- `src/store/useTodoStore.ts` 新建 todo 分类改为 Plus 全量 AI 路径（由 `isPlus` 决定是否触发 classify），不再仅限低置信度场景

Validation:

- `npm run -s tsc -- --noEmit` ✅
- `npx vitest run src/store/useChatStore.integration.test.ts src/store/chatActions.test.ts` ✅

### Improve: DATA_STORAGE_P2 phase-5 owner-trusted migration guard

- 新增 `src/store/authLocalMigrationPolicy.ts`，收敛本地数据迁移决策：`sync_local_to_cloud / clear_local / block_unknown_owner / noop`
- `src/store/useAuthStore.ts` 在 `initialize` 与 `SIGNED_IN` 路径统一复用迁移策略：
  - owner 跨账号时清理当前 scope 本地域数据，阻断串号
  - v2 开启 + owner=unknown + 有本地数据时进入安全模式并记录 `unknown_owner_migration_blocked`
  - 仅 owner 可信（`anonymous` / `user(current)`）时自动执行 legacy `seeday:v1:* -> seeday:v2:*` 迁移
- `src/store/useAuthStore.ts` 在 unknown-owner 安全模式下停止 `syncLocalAnnotations(...)` 自动上云，避免旧本地数据误传当前账号
- 新增 `src/store/authLocalMigrationPolicy.test.ts`，覆盖 owner-trusted 迁移准入、unknown-owner v2 阻断、v1 兼容迁移与跨账号清理决策

Validation:

- `npx vitest run "src/store/authLocalMigrationPolicy.test.ts" "src/store/storageScope.test.ts" "src/services/reminder/reminderScheduler.scope.test.ts" "src/services/reminder/reminderScheduler.account-switch.test.ts"` ✅
- `npx tsc --noEmit` ✅
- `npm run build` ✅

### Improve: DATA_STORAGE_P2 phase-4.2 freeDay scoped policy finalized

- `src/services/reminder/reminderScheduler.ts` 将 `freeDay_<date>` 明确纳入 user-scoped key（`seeday:v2:*:local:freeDay_<date>`），避免同设备多账号共用节假日缓存
- `src/services/reminder/reminderScheduler.ts` 与 `src/services/notifications/localNotificationService.ts` 统一复用 `src/store/storageScope.ts` 的 `getScopedClientStorageKey()/resolveStorageScopeForUser()`，移除重复 scoped key 拼接逻辑
- 新增 `src/services/reminder/reminderScheduler.scope.test.ts`，覆盖 `freeDay_<date>` 在 A/B 账号下分桶缓存不串读，以及 v2 关闭时 legacy key 兼容
- 新增 `src/services/reminder/reminderScheduler.account-switch.test.ts`，覆盖 A/B 账号切换下 `reminder_scheduled_date` / `reminder_today_count` 按 user scope 隔离
- `src/services/reminder/reminderScheduler.ts` 增加 `freeDay_<date>` legacy key 迁移：v2 开启且命中旧全局 key 时，自动迁移到 scoped key 并删除旧 key
- `src/store/todoStoreHelpers.ts` 将 `todo-storage` 明确标注为 legacy 迁移键常量，保留兼容读取并在迁移后删除
- `docs/CURRENT_TASK.md` 将 `P2-4.2` / `P2-4.3` 标记为完成；`docs/DATA_STORAGE_AUDIT_REPORT.md` 同步扩展非 domain key 全量分类清单（user/global/待淘汰）
- `docs/CURRENT_TASK.md` 将 `P2-4.4` 标记为完成，并补充遗留 key 清理记录
- `docs/PROACTIVE_REMINDER_SPEC.md` 同步 `freeDay` 缓存示例为 scoped key 版本，避免规格与实现偏差

Validation:

- `npx tsc --noEmit` ✅
- `npx vitest run "src/store/storageScope.test.ts"` ✅
- `npx vitest run "src/store/storageScope.test.ts" "src/services/reminder/reminderScheduler.scope.test.ts"` ✅
- `npx vitest run "src/store/storageScope.test.ts" "src/services/reminder/reminderScheduler.scope.test.ts" "src/services/reminder/reminderScheduler.account-switch.test.ts"` ✅
- `npm run build` ✅

## 2026-04-23

### Improve: DATA_STORAGE_P2 phase-4 second batch scoped local keys

- `src/features/report/plant/PlantImage.tsx` 将植物图片缓存 key 从全局 `plant_img_v1_<plantId>` 改为 scope-aware key，避免多账号切换后读取到其他账号缓存
- `src/services/notifications/localNotificationService.ts` 的 `idle_nudge_scheduled_at` 改为 scope-aware key，并调整 `scheduleIdleNudge/cancelIdleNudge` 支持按 userId 分桶
- `src/hooks/useReminderSystem.ts` 前后台切换链路透传 userId 给 idle nudge 调度/取消
- `docs/DATA_STORAGE_AUDIT_REPORT.md` 新增 P2-4.1 非 domain key 分类清单，并将 `P2-4.1` 在 `docs/CURRENT_TASK.md` 标记为完成

Validation:

- `npx tsc --noEmit` ✅
- `npx vitest run "src/store/storageScope.test.ts"` ✅
- `npm run build` ✅

### Improve: DATA_STORAGE_P2 phase-4 first batch non-domain key scoping

- `storageScope.ts` 新增 `getScopedClientStorageKey()`，用于非 domain local/session key 的 scope-aware 命名（`seeday:v2:user:<userId>:local:<key>` / `seeday:v2:anon:local:<key>`）
- 首批用户行为 key 改为 user-scoped：
  - `chat_input_draft`（`src/features/chat/ChatPage.tsx`，并在 v2 开关开启时做 legacy key 迁移）
  - `yesterday_popup_date`（`src/features/chat/components/YesterdaySummaryPopup.tsx`）
  - `night_reminder_dismissed_date`（`src/hooks/useNightReminder.ts`）
  - `pending_notification_confirm_action`（`src/hooks/useReminderSystem.ts`）
  - `reminder_today_count` / `reminder_scheduled_date`（`src/services/reminder/reminderScheduler.ts` + `src/features/profile/components/RoutineSettingsPanel.tsx`）
- `src/store/storageScope.test.ts` 增补非 domain scoped key 断言

Validation:

- `npx tsc --noEmit` ✅
- `npx vitest run "src/store/storageScope.test.ts"` ✅
- `npm run build` ✅

### Build: DATA_STORAGE_P2 phase-2/3 scope-first auth + scoped persist rollout

- 新增 `src/store/scopedPersistStorage.ts`，将 Zustand persist storage 统一切到 scope-aware key 解析：`VITE_MULTI_ACCOUNT_ISOLATION_V2=true` 时读写 `seeday:v2:user:<userId>:<domain>` / `seeday:v2:anon:<domain>`，关闭开关时兼容回退 `seeday:v1:<domain>`
- 12 个 persisted domain store 全量接入 `storage: createScopedJSONStorage(...) + skipHydration: true`，由 `domainPersistHydration.ts` 统一手动 rehydrate
- `useAuthStore.initialize()` / `SIGNED_IN` / `SIGNED_OUT` / `signOut()` 改为 scope-first：先切 scope，再 rehydrate，再执行迁移判定与 sync/fetch；`clearLocalDomainStores` 改为 scope-aware 清理
- `useOutboxStore.flush()` 新增 active scope guard，v2 模式下仅允许当前 scope 的 userId 触发补推，避免切号串 flush
- 新增 `src/store/storageScope.test.ts` 与 `docs/MULTI_ACCOUNT_ISOLATION_E2E.md`，补齐 P2-0.3 最小测试基座（单测骨架 + 手工 e2e 脚本）

Validation:

- `npx tsc --noEmit` ✅
- `npx vitest run "src/store/useAuthStore.test.ts" "src/store/useOutboxStore.test.ts"` ✅
- `npm run build` ✅

### Build: DATA_STORAGE_P2 phase-0/1 scaffolding

- 新增 `src/store/storageScope.ts`：提供 `VITE_MULTI_ACCOUNT_ISOLATION_V2` 特性开关、active scope 读写、v2 scoped key 生成与 scoped key 清理能力
- 新增 `src/store/scopedPersistMigration.ts`：提供 legacy `seeday:v1:*` -> scoped v2 的 dry-run 迁移工具（默认不写入）
- 新增 `src/store/domainPersistHydration.ts`：提供 12 个 persisted store 的批量 rehydrate orchestrator
- `src/store/persistKeys.ts` 补充 domain 枚举与 `getV1PersistKey()`，为 v2 key 迁移工具统一 domain 源
- `src/store/useAuthStore.ts` 接入 scope 设置与 DEV 结构化日志；当 `VITE_MULTI_ACCOUNT_ISOLATION_V2` 开启时，阻断 `unknown-owner + hasLocalData` 自动迁移

Validation:

- `npx tsc --noEmit` ✅
- `npm run build` ✅

### Improve: Outbox failed UI simplified to cloud-retry action

- 按 Young 对齐结果，将 outbox 失败提示实现为极简「小云朵 + 重试」按钮：不展示技术日志，不展示复杂失败清单
- 新增 `CloudRetryButton` 统一样式；主布局（非 Growth 页）与 Growth 页顶部重试入口对齐到同一视觉语言
- `useOutboxStore` 新增 `retryNow()`：手动点击后会将 `failed/cooldown` 项立即转入 pending 并触发一次 flush

Validation:

- `npx tsc --noEmit` ✅
- `npm run build` ✅

### Improve: 地区设置严格匹配 + 国家兜底

- `RegionSettingsPanel` 继续保持“仅匹配结果可保存”的严格模式：城市/地区检索命中后才会提交，不支持自由文本直存
- 当地区检索未命中时，新增国家级候选兜底提示；用户可一键确认“保存国家”，并继续写入标准化的 `country_code + latitude + longitude`
- `geocode.ts` 新增国家检索分支（优先识别国家级 feature code），降低“小地名搜不到”时的卡住率
- 补充中/英/意 i18n 文案：国家兜底提示与“保存国家”动作文案

Validation:

- `npx tsc --noEmit` ✅

## 2026-04-22

### Improve: Profile save flicker reduction

- `useAuthStore.updateLongTermProfileEnabled()` 与 `useAuthStore.updateLanguagePreference()` 改为先更新本地 UI / user metadata，再静默走后台 metadata 同步，避免 profile 区域把云端 patch 当成前台保存流程
- `src/features/profile/components/UserProfilePanel.tsx` 去掉会被瞬时 local-first 保存触发的 `Saving...` 按钮闪现
- `src/features/profile/components/RoutineSettingsPanel.tsx` 保存按钮改为稳定文案，避免关闭弹层自动保存时闪出瞬时 saving 文案

Validation:

- `npx tsc --noEmit` ✅

### Improve: Outbox cooldown to reduce autosave flicker

- `useOutboxStore` 自动重试策略从“连续失败一路打到 failed”调整为“连续失败 3 次进入 1 小时 cooldown”，冷却结束后再恢复后台重试，避免自动保存在弱网下反复闪现
- 保留总尝试上限作为最终兜底，但短期失败不再持续高频触发上传
- `useOutboxStore.test.ts` 增加 cooldown 与延时恢复重试用例

Validation:

- `npx vitest run "src/store/useOutboxStore.test.ts"` ✅
- `npx tsc --noEmit` ✅

### Improve: Annotation suggestion outcome durable fallback

- `useAnnotationStore.recordSuggestionOutcome()` 保持本地即时更新，但在“无 session”或 `annotations.update({ suggestion_accepted })` 失败时，改为将结果写入 `annotation.outcome` outbox，避免建议接受/拒绝反馈丢失
- `useOutboxStore` 新增 `annotation.outcome` executor，负责重放 `suggestion_accepted` 更新
- 新增 `useAnnotationStore.test.ts` 用例，覆盖“离线接受建议后本地态保留且入 outbox”路径

Validation:

- `npx vitest run "src/store/useAnnotationStore.test.ts" "src/store/useOutboxStore.test.ts"` ✅
- `npx tsc --noEmit` ✅

### Improve: Report 次级更新 durable fallback

- `useReportStore.updateReport()` 保持本地乐观更新，但在“无 session”或 `reports.update(...)` 失败时，改为将完整 report 写入 `report.upsert` outbox，避免标题、正文、统计、用户备注、AI 结果等次级编辑因网络抖动丢失
- 新增 `useReportStore.test.ts` 用例，覆盖“离线更新 report 后入 outbox”路径

Validation:

- `npx vitest run "src/store/useReportStore.test.ts" "src/store/useOutboxStore.test.ts"` ✅
- `npx tsc --noEmit` ✅

### Improve: Plant direction order durable local-first sync

- `usePlantStore.setDirectionOrder()` 继续保留本地即时更新与根系预览刷新，但云端写失败时不再直接把保存流程判定为失败，而是将最新方向配置写入 `plant.directionOrder` outbox 等待补推
- `useOutboxStore` 新增 `plant.directionOrder` executor，重放时按“先删旧配置，再写入完整 5 槽顺序”同步 `plant_direction_config`
- 新增 `usePlantStore.direction-sync.test.ts`，覆盖“失败入队且本地不回滚”与“成功不入队”两条关键路径

Validation:

- `npx vitest run "src/store/usePlantStore.direction-sync.test.ts" "src/store/useOutboxStore.test.ts"` ✅
- `npx tsc --noEmit` ✅

### Improve: Chat local-first syncState + outbox 闭环

- `useChatStore` 为新发 activity/mood message 增加显式 `syncState`：本地新消息先标记 `pending` 并立即渲染，首次写库成功后回写 `synced`
- `useOutboxStore` 新增 `chat.upsert`，离线或首轮写库失败时自动承接聊天消息补推；flush 成功/失败会同步回写本地消息的 `synced` / `pending` / `failed` 状态
- `fetchMessages()` 与 `_refreshDateSilently()` 改为只保留本地 `pending/failed` 且云端缺失的消息，避免把已被删除的云端消息继续误保留在本地
- 新增 `chatSyncHelpers.test.ts` 与离线发送集成用例，覆盖本地保留规则与离线发送 outbox 入队

Validation:

- `npx vitest run "src/store/chatSyncHelpers.test.ts" "src/store/useChatStore.integration.test.ts" "src/store/useOutboxStore.test.ts"` ✅
- `npx tsc --noEmit` ✅

### Docs: 存储审计报告二次复核对齐

- `docs/DATA_STORAGE_AUDIT_REPORT.md` 升级为 v1.2：按真实代码状态标注 P0/P1 已落地项，移除对 Reminder/persist key/realtime 双通道/outbox 骨架等已完成事项的“未完成”口径
- 新增“2026-04-22 二次复核结论”与当前真实状态快照，明确本轮优先继续收口 Chat / Plant / Report / Annotation 的 local-first 不丢数闭环
- 单列多账号隔离风险：指出当前仍是“全局 key + owner 标记 + 事后清理”，并将 user-scoped persist / hydrate 前校验 / 禁止 unknown-owner 自动迁移放入下一阶段主线
- `docs/CURRENT_TASK.md` 同步更新 DATA_STORAGE_P1 待办顺序：先做原计划收口项，再独立处理账号数据隔离

### Improve: 会员购买弹窗统一与人气推荐逻辑收口

- `MembershipPurchaseModal` 新增按用户会员历史动态推荐逻辑：未试用用户将“免费试用（月度）”标为人气首选；已试用未购买用户将“月度”标为人气首选；已购买历史用户将“年度”标为人气首选
- Onboarding 第 7 步移除独立订阅 UI，改为直接复用 `MembershipPurchaseModal`，并透传所选方案到 `/upgrade` 页面，确保新手导览与正式购买页使用同一套购买界面
- `/upgrade` 支持接收 `initialPlanId`，从外部入口进入时可保持用户在前置弹窗中的方案选择

Validation:

- `npx tsc --noEmit` ✅

### Improve: 根系方向设置 local-first 合并 + telemetry

- `usePlantStore.loadTodayData()` 改为 local-first 合并方向偏好：云端无数据时保留本地；云端若仅返回默认顺序且本地已有非默认顺序，则继续使用本地自定义值
- `setDirectionOrder()` 改为在本地即时更新后等待云端结果，云端写入失败时会向 UI 抛出错误，避免“看起来保存成功但下次又回默认”
- profile 侧新增根系方向设置埋点：打开、修改槽位、恢复默认、保存成功、保存失败
- Telemetry Center 新增 `Profile Settings` 管理员看板与 `/api/live-input-telemetry?module=profile_settings` 聚合查询，用于查看根系方向设置的打开率、保存成功率、常改位置与最终保存布局

Validation:

- `npx vitest run "src/features/report/plant/soilLegend.test.ts"` ✅
- `npx tsc --noEmit` ✅

### Fix: Chat 连续活动记录发送失败

- 修复 `closePreviousActivityLocal()` 返回值与局部变量错误：连续发送活动时，上一条活动现在会正确结算 `duration/isActive`，不会再在第二条活动发送时抛错
- 新增 `useChatStore.integration.test.ts` 回归用例，覆盖 `activity -> activity`（如“吃饭”后立刻“睡觉”）连续发送链路

Validation:

- `npm run test:unit -- useChatStore.integration.test.ts` ✅

### Improve: DATA_STORAGE P1 A-2/A-3 annotation persist slimming + realtime channel split

- `useAnnotationStore` 新增持久化裁剪 helper：annotation 历史仅保留最近 30 天，`characterStateTracker` 仅保留最近 7 天和未过期 effect，hydration 时同步做防御性裁剪
- `useRealtimeSync` 从单通道拆为高频/低频双通道，`messages+moods` 独立于 todo/growth/report/annotation/focus/stardust，降低单点订阅抖动对聊天实时体验的影响
- 新增 `annotationPersistenceHelpers` 单测，覆盖 annotation 裁剪、event 截断、tracker 清理

Validation:

- `npx tsc --noEmit` ✅
- `npm run test:unit -- annotationPersistenceHelpers` ✅

### Refactor: DATA_STORAGE P1 B-1 persist key 统一与旧 key 迁移

- 新增 `src/store/persistKeys.ts` 与 `src/store/persistMigrationHelpers.ts`，将 chat/todo/growth/mood/report/annotation/focus/plant/timing/stardust/reminder 统一为 `seeday:v1:<domain>` 命名
- 各 domain store hydration 时会自动读取旧 persist key 并清理遗留 key，升级后无需用户手动清缓存
- `clearLocalDomainStores()` 统一按 key 集合清空持久化状态，减少跨账号残留导致的本地缓存串号

Validation:

- `npx tsc --noEmit` ✅
- `npm run test:unit -- annotationPersistenceHelpers` ✅

### Improve: DATA_STORAGE P1 C-1 initialize 新鲜度门控

- chat/todo/growth/mood/report/annotation/focus/stardust store 新增 `lastFetchedAt`，成功拉云后记录时间戳并持久化
- `useAuthStore.initialize()` 与 `SIGNED_IN` 冷启动恢复路径按 60 秒 freshness gate 跳过热缓存重复拉取，只保留必要的本地恢复、pending push 与增量同步
- `clearLocalDomainStores()` 同步清空各域 `lastFetchedAt` 与关键缓存，避免跨账号切换时沿用旧鲜度状态

Validation:

- `npx tsc --noEmit` ✅
- `npm run build` ✅

### Improve: DATA_STORAGE P1 D-1/D-2/D-3 outbox skeleton + core store wiring

- 新增 `src/store/useOutboxStore.ts` 与单测，定义 `mood.upsert` / `focus.insert` / `report.upsert` / `annotation.insert` 四类 outbox entry，持久化到 `seeday:v1:outbox`
- `useMoodStore`、`useFocusStore`、`reportActions.ts`、`useAnnotationStore` 的核心写路径在重试耗尽后会自动 enqueue 到 outbox，保留本地乐观状态
- `useAuthStore.initialize()`、`useNetworkSync`、`useAppForegroundRefresh` 已接入 outbox flush，联网/回前台/恢复 session 后会自动补推队列

Validation:

- `npx tsc --noEmit` ✅
- `npm run test:unit -- useOutboxStore` ✅
- `npm run build` ✅

## 2026-04-21

### Refactor: DATA_STORAGE P1 A-1 Reminder store persist 化

- `useReminderStore` 从裸 localStorage 迁移为 Zustand persist，key 统一为 `seeday:v1:reminder`
- `merge` 保留跨日自动重置逻辑，并兼容迁移旧 key（`reminder_confirmed_today` / `reminder_confirmed_date`）
- `clearLocalDomainStores` 新增 reminder 清理，确保登出时该域状态同步清空

Validation:

- `npx tsc --noEmit` ✅

### Fix: Growth 待办取消完成的星星/打卡对称回滚

- `useGrowthStore` 新增扣星 action，支持取消完成时状态与打卡对称回退
- `useTodoStore` 新增奖励映射，记录每条待办实际加星值，供取消时精确回滚
- `GrowthTodoSection` / `FocusMode` / `useChatStore` 打通奖励记录与回滚链路

Validation:

- `npx tsc --noEmit` ✅
- `npm run build` ✅

### Fix: Growth 待办重复生成与删除复活（第一轮）

- `useTodoStore` 统一 recurring 日期口径为本地日历日
- 增加 `suppressedTemplateDateMap` 与 pending-delete tombstone，降低“删了又回来”
- `useRealtimeSync` 对 todos `deleted_at` 事件即时本地清理

Validation:

- `npx tsc --noEmit` ✅

### Improve: Growth iOS 手势误触与拖拽重排稳定性

- `GrowthTodoCard` 关键按钮改为 pointer-first 并吞并 click，降低 WebView ghost click 误触
- `GrowthTodoCard` 新增显式拖拽手柄（Grip）
- `GrowthTodoSection` 拖拽入口支持“手柄立即激活 + 卡片长按兜底”双模式

Validation:

- `npx tsc --noEmit` ✅
- `npm run build` ✅

### Fix: Growth 待办编辑命中错位（编辑到下一条）

- `GrowthTodoCard` 增加编辑目标 id 锁定（开始编辑时记录目标 todoId，提交时按锁定 id 更新）
- `GrowthTodoCard` 新增 `onEditingChange` 回调，编辑结束/组件卸载时统一释放编辑态
- `GrowthTodoSection` 新增 `editingTodoId` 状态，编辑进行中禁用卡片长按拖拽，减少编辑期间重排导致的目标错位

Validation:

- `npx tsc --noEmit` ✅
- `npm run build` ✅

### Fix: 全局存储审计 P0 收口

- 修复 plant timezone 异常、mood 覆盖策略、auth metadata 并发写、realtime 污染历史视图
- annotation/focus/timing 持久化与合并逻辑补齐

Validation:

- `npx tsc --noEmit` ✅

### Refactor: Chat dateCache 统一为对象并持久化

- `Map` -> `Record<string, Message[]>`，删除双副本 `persistedDateCache`
- 聊天、report、realtime 全链路统一对象访问

Validation:

- `npx tsc --noEmit` ✅
- `npm run lint:all` ✅

## 2026-04-20

### Onboarding / Report / Profile 多项稳定性与交互优化

- Onboarding：语言与文案链路修复、心情/活动回路修复、真实卡片交互接线
- Report：日期入口卡片结构与视觉多轮微调
- Profile：作息面板密度与移动端可用性优化
- Diary 书架：日期搜索与热度配色可读性优化

Validation:

- `npx tsc --noEmit` ✅

### Fix: reminder system 合约收口

- `useReminderSystem` 返回契约显式类型化，`App` 调用回到标准解构

Validation:

- `npx tsc --noEmit` ✅

## 2026-04-19

### Feat: Stripe Web Checkout 首版闭环（不影响 iOS IAP）

- `/api/subscription` 新增 `stripe_checkout/stripe_finalize` 分支
- 前端 `payment/stripe` 接入创建 checkout + 回跳 finalize
- 文档与环境变量同步（Stripe keys / price ids）

Validation:

- `npx tsc --noEmit` ✅

### Fix: 日报/日记统计口径对齐

- DiaryBookViewer 饼图优先复用报告 stats 快照
- 报告页心情分布对齐 `customMoodLabel/customMoodApplied` 口径

Validation:

- `npx tsc --noEmit` ✅

---

## Archive Policy

- 2026-04-18 及更早的已收口历史已从本文件移除。
- 如需追溯旧实现，请以 Git 历史为准（`git log -- docs/CHANGELOG.md`）。
