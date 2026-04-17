# CURRENT TASK (Session Resume Anchor)

Last Updated: 2026-04-17
Owner: current working session

---

## 会话更新（2026-04-17）

- [x] 聊天时间线消息卡片交互收口：活动卡与心情卡删除 `X` 改为仅在点击激活卡片后显示，未激活时隐藏；行为与相机上传按钮保持一致。
- [x] Profile「作息/AI专属记忆」能力拆分：新增独立作息编辑面板（起床/睡觉/三餐）并保持 Free 可用；AI 专属记忆改为 Plus 功能，Free 侧显示会员升级引导。
- [x] AI 专属记忆会员门控收口：`useAnnotationStore` 与周报画像提取链路改为 `isPlus && longTermProfileEnabled` 双门控，避免 Free 继续注入/提取长期画像。
- [x] 会员权益与规格文档同步：`MembershipCard/UpgradePage` 权益列表新增“AI 专属记忆”，并在 `docs/MEMBERSHIP_SPEC.md` 明确“作息 Free、AI 专属记忆 Plus”。
- [x] 新增会员项目现状文档：`docs/MEMBERSHIP_PROJECT_STATUS.md`，沉淀“规格 vs 当前实现”对照、支付链路状态、Free/Plus 手测清单与已知差异，便于新同学快速接手。
- [x] 管理员 Telemetry 看板国际化补齐：`TelemetryHubPage`、`LiveInputTelemetryPage`、`AiAnnotationTelemetryPage`、`TodoDecomposeTelemetryPage` 改为使用 i18n key，支持 `zh/en/it` 跟随全局语言切换。
- [x] Profile 设置页管理员入口文案收口：`Telemetry Center` 改为 i18n key（`telemetry_hub_title`），避免中英文混显。
- [x] 新增三语词条：在 `src/i18n/locales/{zh,en,it}.ts` 增补 Telemetry Hub / Live Input / AI Annotation / Todo Decompose 全量文案键。
- [x] Vercel Hobby 函数配额收口：将 User Analytics 从独立 `api/user-analytics.ts` 合并到 `GET /api/live-input-telemetry?module=user_analytics`，并保留 `type=user_lookup` 查询分支。
- [x] 前端 User Analytics API 改道：`callUserAnalyticsDashboardAPI/callUserAnalyticsLookupAPI` 统一改为调用 `/api/live-input-telemetry`（带 `module=user_analytics` 参数）。
- [x] 删除独立 serverless 入口 `api/user-analytics.ts`，将函数总数压回 Hobby 上限以内。
- [x] Growth 待办标题编辑交互收口：仅在待办卡片处于展开态时允许双击标题进入编辑；未展开态双击不再触发标题编辑。
- [x] 聊天魔法笔会员门控弹窗收口：Free 点击魔法笔改为弹出统一风格会员引导弹窗；右上角关闭/稍后按钮只关闭弹窗不跳转，明确由“去开通 Plus”按钮触发 `/upgrade`。

---

## 会话更新（2026-04-11）

- [x] 修复「拆解子待办 -> 连续专注」默认时长显示错误：Focus 弹层初始时长与未开始状态下的时长同步，改为优先使用首个/当前子任务 `suggestedDuration`，不再固定 25min。
- [x] 魔法笔发送路由收口：本地快路径改为仅 8 字以内短句可触发；新增“待办/清单”意图拦截与多动作拦截，命中时强制走 parser，避免误直写活动。
- [x] 修复 recovery 建议“正文与按钮目标错位”：recovery 场景切到 recovery-only prompt，仅提供 recovery 目标上下文；服务端统一校验并强制 suggestion 与 recovery todo 对齐。
- [x] 修复 todo-decompose 在 Gemini `gemini-2.0-flash` 下线导致 404：默认模型升级为 `gemini-2.5-flash`，并增加 404 自动降级重试（`TODO_DECOMPOSE_GEMINI_FALLBACK_MODEL`）。
- [x] `/api/todo-decompose` 增加服务端调试日志与失败结构化日志，支持 `TODO_DECOMPOSE_VERBOSE_LOGS=true` 快速定位 DashScope/Gemini 调用异常。
- [x] annotation 中文模型切换为 `deepseek-chat`，并接入 `deepseek` provider 运行时（`DEEPSEEK_API_KEY` + `ANNOTATION_DEEPSEEK_BASE_URL`）。
- [x] 修复 annotation 在 DeepSeek 下错误调用 `/v1/responses` 导致 404：改为 deepseek provider 走 `chat.completions`。
- [x] 修复 annotation 在 Gemini 下 404：改为 Gemini 原生 `generateContent` 请求，不再走 OpenAI `responses` 路径。
- [x] 待办拆解 provider 路由调整：`zh -> qwen`，`en/it -> gemini-2.5-flash`（不再走 OpenAI）。
- [x] 同步文档与环境变量清单（`api/README.md`、`DEPLOY.md`、`.env.example`、`docs/AI_USAGE_INVENTORY.md`）。
- [x] annotation 可观测补全：`ANNOTATION_VERBOSE_LOGS=true` 时在 Vercel Logs 结构化输出完整请求体、system/user prompt、LLM 原始输出、最终响应，以及横向联想/低叙事触发详情。

## 会话更新（2026-04-13）

- [x] 语言偏好上云：`LanguageSwitcher` 切换语言时改为调用 `useAuthStore.updateLanguagePreference()`，写入 Supabase Auth metadata `i18nextLng`，不再仅依赖 localStorage。
- [x] 云端语言回填：登录初始化与 `SIGNED_IN` 事件新增语言 metadata 自愈；若云端缺失 `i18nextLng`，自动将当前 i18n 语言写回云端。
- [x] todo-decompose 详细排障日志增强：`TODO_DECOMPOSE_VERBOSE_LOGS=true` 时输出 provider `finishReason`、usage、完整 `rawFull` 及上游错误原文（`responseRaw`），便于定位“回复说一半/解析失败”。
- [x] annotation 调试链路补齐 Gemini 完整返回：`ANNOTATION_VERBOSE_LOGS=true` 时输出 Gemini `finishReason`、`usageMetadata` 与完整 `rawFull`；同时在 suggestion/annotation/rewrite 日志中透传 `finishReason`。

## 会话更新（2026-04-15）

- [x] 修复日记详情页「活动/情绪总结被截断」：根因是 `generateActionSummary/generateMoodSummary` 在 `reportHelpers.ts` 内被硬截断为前 50 字符（无省略号），非 AI 返回截断。
- [x] 回填历史兼容：`ReportDetailModal` 新增 legacy 截断检测，命中时使用 `stats.actionAnalysis/moodDistribution` 重新生成完整总结，避免旧报告继续显示半句。
- [x] 显示层兜底：`SectionRow` 右侧文本列增加 `minWidth:0` 与 `overflowWrap:anywhere`，防止极端长词/长串导致布局裁切。
- [x] 修复 Growth「添加待办」弹层在移动端过高且不可顺畅下拉：改为头/内容/底部按钮三段式布局，内容区独立滚动（含 iOS 惯性滚动），底部确认按钮固定可见，避免被底部区域遮挡；并对齐其他弹窗样式收窄为居中卡片（`min(92vw,420px)`）避免“弹窗过大”。
- [x] 修复聊天时间线编辑弹窗「点击确定后不自动关闭」边界：`handleSave` 改为 `try/finally` 收口，编辑/插入成功执行后统一关闭弹窗，避免持久化阶段异常时弹窗卡住。
- [x] 修复重复待办“每天新增一条”堆积：`generateRecurringTodos` 新增“同模板存在未完成实例则跳过生成”门控，改为同一模板同一时刻只保留一条未完成实例。
- [x] 修复 monthly 重复待办生成频率：新增/自动生成都收敛为仅每月 1 号生成，避免按天误生成。
- [x] Growth 瓶子交互改版：点击瓶子统一改为详情弹层（替代原“仅生成待办确认框”），将删除入口合并进弹层并保留达成态操作（浇灌/继续追踪）。
- [x] Growth 瓶子新增轻量打卡统计：`Bottle.checkinDates`（`YYYY-MM-DD` 去重）在 `incrementBottleStars` 统一写入，详情弹层展示“近7天打卡天数（含今天）/当前连续/最长连续”。
- [x] 日记输入数据收口：移除 `formatForDiaryAI` 中“光谱分布/光质读数/能量曲线/引力错位/历史趋势”区块，改为仅保留事件清单、心情记录、专注时长和待办完成概览。
- [x] 旧结构清理：删除 `SpectrumBarChart` / `LightQualityDashboard` 组件与相关 i18n key，`ComputedResult` 与 `ReportStats` 同步去除 `spectrum/lightQuality` 字段，避免旧世界观术语继续渗入日记链路。
- [x] 日记落款兜底：`api/diary.ts` 新增签名检测与按人设补签名（Van/Agnes/Zep/Momo），避免模型漏写落款。
- [x] 日记称呼防线升级：`api/diary.ts` 新增称呼 fallback（ZH=`园主` / EN=`Gardener` / IT=`Custode`）+ 生成后质检重写 + 末端硬替换，降低“用户/ta/the user”残留概率。
- [x] 修复 TypeScript 构建阻断（annotation/extract-profile）：`decomposeTodoWithAI` 参数改为 `geminiApiKey`；移除 Gemini OpenAI 兼容调用中的无效 `reasoning_effort` 字段；`extract-profile-service` 增加置信信号标准化，确保输出符合 `UserProfileObserved/UserProfileDynamicSignals` 类型。
- [x] 修复 Growth 待办同步“重试仍失败”循环：`useTodoStore.fetchTodos()` 推送改为父待办优先、子待办后推，并对 `todos_parent_id_fkey (23503)` 增加父任务补推与去父引用兜底，避免子待办先写导致反复 400/409。
- [x] 修复 Growth 待办同步 `22003 bigint out of range`：`toDbTodo/toDbTodoUpdates` 新增 bigint 字段安全归一化（`created_at/due_date/started_at/completed_at/sort_order`），并在新增待办时对 `sortOrder` 做安全夹紧，避免异常极值穿透到 Supabase。

## 会话更新（2026-04-16）

- [x] 会员升级页首版落地：新增 `/upgrade` 页面（方案切换、权益对比、支付按钮占位、iOS 恢复入口占位），并将 Profile/Report 侧升级入口统一跳转到 `/upgrade`。
- [x] 支付构建隔离基建：新增 `@payment` alias（`VITE_PAYMENT_MODE=iap|stripe`）与双实现占位模块（`src/services/payment/iap|stripe` 同签名导出），并补 `build:ios` / `build:web` 构建脚本。
- [x] 会员试用期逻辑接入：`signUp` 写入 `trial_started_at`，`resolveMembershipState()` 增加 7 天试用判定（source=`trial`），并补充边界单测。
- [x] 日记 Teaser 首版工程化：`/api/diary` 增加 `mode='teaser'`（模板分桶，零 LLM 成本）；前端 `useReportStore.generateAIDiary()` 按会员分流（Plus 写 `aiAnalysis`，Free 写 `teaserText`）。
- [x] Free 日记解锁引导 UI：报告详情页与日记本观察区增加“渐变模糊 + 解锁按钮”，点击跳转 `/upgrade`。
- [x] 新增 `/api/subscription`：接入鉴权 + `auth.users.user_metadata` 会员写回（`membership_plan/membership_expires_at/...`），支持 `activate/restore/cancel` 与 `source='iap'`。
- [x] iOS 支付适配层接线：`src/services/payment/iap/index.ts` 新增“原生桥交易凭证 -> `/api/subscription`”调用链（含 productId/planType 映射）；未接原生插件时返回显式错误码。
- [x] 升级页支付反馈闭环：`UpgradePage` 对购买/恢复结果做错误码映射与提示，成功后触发 `useAuthStore.initialize()` 刷新会员状态。
- [x] P5d 收口：魔法笔模式与待办拆解入口新增 `isPlus` 门控，Free 点击后统一提示并跳转 `/upgrade`。
- [x] P6 提前执行：`MEMBERSHIP_TEMPORARY_UNLOCK_ENABLED` 已改为 `false`，默认不再给全员 Plus；会员态仅由 metadata 或 trial 判定。
- [x] 聊天「活动/心情记录」可读性微调：放大时间轴时间戳、活动/心情卡标题、心情标签与时长信息字号，降低“字体过小”阅读负担。
- [x] 日记入口按钮字号微调：报告页头部「查看日记本」与植物卡片「生成日记」字体上调，移动端点击前可读性更稳定。

---

## 当前主线 1：AI 建议模式（P7 收口）

Status: P0-P6 已完成；P7 仅剩联调、漏斗埋点、数据库字段核对。

### 当前待办（按优先级）

- [ ] 联调验收：真实走通「建议出现 -> 点击去做 -> 自动凝结 -> 超时/X 不凝结」
- [ ] 事件级埋点扩展：从 `annotations.suggestion_accepted` 升级为 show/click/close/timeout 四事件漏斗
- [ ] 数据库核对：确认目标环境存在 `annotations.suggestion_accepted`，缺失则补 migration

### 冻结决策（继续沿用）

- suggestion 配额：`06:00-13:00` 2 条、`13:00-19:00` 2 条、`19:00-次日06:00` 2 条；日上限 4 条
- suggestion 与普通批注分流：配额仅限制 suggestion，不限制普通文字批注
- 点击建议按钮视为自动凝结；未点击/超时/X 关闭不凝结
- recovery 2 星规则收口：仅允许瓶子关联目标触发中断挽回，不再对未关联瓶子的 recurring 断档触发 2 星建议

---

## 当前主线 2：日记功能重建（DIARY_REBUILD_PLAN）

Status: 主链路可用，剩余增强项待推进。

### 当前待办

- [ ] V3：MoodEnergyTimeline（补时间轴数据结构）
- [ ] D5（剩余）：历史趋势补充 mood key 维度（happy/anxious 等跨日分布）
- [ ] V5（可选）：TodoCompletionCard 组件化视觉升级
- [ ] A7（低优先）：`getDateRange` title 多语言化（写入 reports 表）

---

## 当前主线 3：横向联想中间层（Lateral Association）

Status: 需求已读完并完成技术拆解；待按阶段开发。

### 冻结决策（本轮新增）

- [x] 联想/出发点权重以需求文档第 3 章表格为准；若与第 5.3 代码常量冲突，统一修正代码常量到表格值。
- [x] 已修正文档中的冲突常量：`agnes.user_emotion=25`、`agnes.user_body=5`、`momo.origin.user_first=65`、`momo.origin.self_led=25`。
- [x] 本模块走服务端实现（`src/server/*` + `api/annotation.ts` 链路），不在前端 store 做采样。

### 当前待办（按优先级）

- [x] P0 规格落地对齐：补齐 `AssociationType/OriginType/CharacterId` 类型、权重常量、受限类型集合与语言枚举。
- [x] P1 采样器实现：新增 `LateralAssociationSampler`（权重调整、上次去重、daily 限制、tone tag 近3次去重、归一化与加权采样）。
- [x] P2 信号检测实现：新增 `detectInputSignals`（zh/en/it 关键词首版），并明确词库来源（独立常量 vs 复用现有输入词库）。
- [x] P3 状态读写接入：已落地 `get/saveLateralAssociationState(userId, characterId)`，优先持久化到 Supabase Auth `user_metadata.lateral_association_state_v1`（无 service role 时回退内存态），含 `dailyDate` 自动换日重置。
- [x] P4 Prompt 集成：已在 annotation 主流程注入 `associationInstruction` 到 U4（角色状态后），覆盖 suggestion 与普通 annotation 双链路。
- [x] P5 测试与验收：已补单测（去重/daily 限制/多语言注入）与统计验收（Momo self_led 采样分布接近 25%，在容差范围内）。
- [x] P6 可观测性：新增 debug 日志字段（associationType/originType/toneTag/instruction），便于线上调优与回归排查。
- [ ] P7 文档同步：同步 `src/store/README.md`、`src/api/README.md`、`api/README.md`、`docs/CHANGELOG.md`。

### 风险与待决策

- [x] 关键词维护策略：首版采用模块内三语关键词常量（低耦合快速落地）；后续迭代再评估与 `src/services/input/` 词库收敛。
- [x] 状态持久化落点：已复用 `user_metadata`（`lateral_association_state_v1`），暂不新增表；若后续出现并发覆盖/容量问题再迁移到独立表。

---

## 当前主线 4：用户画像模块（User Profile v1.1）

Status: P0-0 ~ P0-5 + P3（周报触发提取）已落地；本轮聚焦提取质量与误判治理（不做新手引导）。

### 冻结决策（本轮新增）

- [x] 长期画像总开关：放在“我的”页面；仅开关开启时才启动整套长期画像链路。
- [x] 链路门控范围：周提取、记忆写入、prompt 画像注入、历史召回在开关关闭时全部短路停用。
- [x] metadata 键风格对齐：长期画像开关使用扁平 key `long_term_profile_enabled`，不新增嵌套 `preferences` 结构。
- [x] 吃饭提醒规则保留并个性化：`isMealTime` 同时支持 manual/observed 饭点，未配置时 fallback `11-13 / 18-20`。
- [x] 纪念与记忆双轨：A 类可见纪念日（AI 可自动写入、用户可管理）+ B 类隐性事件记忆（仅 AI 可见，用于回忆召回）。
- [x] 记忆治理：事实事件长期保留不衰减；偏好/关系/状态信号按 30/60/90 天衰减。
- [x] 画像边界：不主动收集年龄/伴侣/家庭关系；仅用户主动表露时后台记录关系线索，不前台展示。
- [x] 新手引导改造：移除性格直问，新增“近期目标/人生目标”和“早午晚饭点”采集，并与待办人生目标联动。
- [x] prompt 注入改造入口明确：实现落点为 `annotation-prompt-builder.ts` + `annotation-prompts.user.ts`，非 `annotation-prompts.ts` 出口文件。
- [x] 周提取触发口径：改为“用户点击生成周报时并行触发画像提取”，每次点击都执行；不再使用“最近 7 天 >= 5 条日记”自动触发门槛。

### 当前待办（按优先级）

- [x] P0-0 元数据基建前置：`useAuthStore` 已补 `user_profile_v2` 读写封装与 merge 写策略（避免覆盖 `login_days/lateral_association_state_v1`）。
- [x] P0-1 类型与快照：已新增 `src/types/userProfile.ts`（`UserProfileV2`）与 `src/lib/buildUserProfileSnapshot.ts`，落地 manual/observed/dynamic/hidden 四层结构。
- [x] P0-2 开关接入：已在“我的”页面增加长期画像开关，并写入 `user_metadata.long_term_profile_enabled`。
- [x] P0-3 链路门控：已在现有 annotation/suggestion 入口接入门控；未上线入口保留后续 gate hook。
- [x] P0-4 建议链路接入：已打通 `triggerAnnotation -> callAnnotationAPI -> api/annotation.ts -> annotation-handler.ts -> annotation-prompt-builder.ts` 的 `userProfileSnapshot` 透传。
- [x] P0-5 吃饭提醒个性化：已改造 `src/lib/suggestionDetector.ts` 的 `isMealTime(hour, declared?, observed?)`，并补 fallback/边界测试。
- [ ] P1 新手引导改版：按产品决策暂缓，本轮不开发。
- [x] P2 我的画像页：补强保存校验（脏检查/部分纪念日校验）、长期画像开关保存反馈、画像快照卡展示（饭点/纪念日/回忆素材）。
- [x] P2++ Profile 记忆体验简化：文案统一为“专属记忆”；移除前台纪念日编辑入口；作息与个性化画像合并为单页编辑并一键保存。
- [x] P2+ 人生目标管理双向同步：Growth 新增 `LifeGoalPanel`，与 Profile `manual.lifeGoal` 双向同步（共享 `updateUserProfile` 写入链路）。
- [x] P3 周提取与记忆：已新增 `api/extract-profile.ts` + `src/server/extract-profile-service.ts`，周报生成时并行提取 observed/dynamicSignals + A/B 候选记忆并经 `updateUserProfile` merge 写回。
- [x] P3+ 周提取增强：`/api/extract-profile` 已支持 `lang(zh/en/it)` prompt 分流，并新增 7 天状态总结 + top3 高频活动 + top3 高频心情提取字段（注入 `observed.weeklyStateSummary/topActivities/topMoods`）。

### 风险与待决策

- [ ] `user_metadata` 并发写入冲突：需统一合并写策略（避免与 `long_term_profile_enabled/login_days/lateral_association_state_v1` 互相覆盖）。
- [x] 周提取触发口径：已定为“周报点击触发、每次执行”。
- [ ] A 类自动入库误判回滚：是否在“我的”页增加“最近 AI 新增纪念日”轻提示与一键撤销。
- [ ] 关闭长期画像后的数据治理：默认冷存不使用已冻结；“清除长期画像数据”入口的交互细节待定。

---

## 当前主线 5：低叙事密度判定 + 事件注入（Doc1 / P1）

Status: P0-P9 已首版落地（服务端评分/触发/注入 + 前端凝结埋点 + 文档同步）；待真实流量校准阈值与事件库扩展。

### 冻结决策（本轮新增）

- [x] 判定逻辑仅在服务端执行（`api/annotation.ts` -> `src/server/annotation-handler.ts` 链路），前端不承担评分与抽样。
- [x] 首期严格按文档一实现纯规则评分（4 维加权）+ 阈值修正，不引入额外 LLM 调用。
- [x] 当日缓存与 `todayContext` 职责分离：新增独立 `todayNarrativeCache` 读写，不混入健康/心情状态缓存。
- [x] 注入文案统一采用 `[今日小事] ...` 自然语言单句，单次请求最多注入 1 条，禁止技术术语暴露。
- [x] P1 仅上线 `natural_event` + `character_mention`；`derived_event` 保留字段与权重接口，默认权重 0。
- [x] 默认触发概率先用 0.15；通过埋点观察 2 周后再评估上调至 0.20。

### 当前待办（按优先级）

- [x] P0 类型与常量落地：新增 `src/server/narrative-density-types.ts`（cache/type/limit/telemetry payload），`src/server/narrative-density-constants.ts`（四维权重、阈值公式系数、概率与上限、类型权重）。
- [x] P1 事件归类与维度评分器：新增 `src/server/narrative-density-scorer.ts`，实现 `freshness/density/emotion/vocab` 四维规则评分、`currentScore` 计算、极短文本兜底（1 字按 0.1）。
- [x] P2 日级缓存存取：新增 `get/saveTodayNarrativeCache(userId, aiMode)`，优先持久化 `auth.users.user_metadata.today_narrative_cache_v1`（无 service role 时回退进程内缓存），内置跨日重置与滚动平均更新。
- [x] P3 触发决策引擎：新增 `src/server/narrative-density-trigger.ts`，实现首条跳过、`adjustedThreshold=0.40-(todayRichness*0.15)`、每日总上限/类型上限、类型权重归一化抽样。
- [x] P4 事件内容装配：新增 `src/server/narrative-event-library.ts`（按 `aiMode + eventType` 取文案，支持空库兜底），并在抽中后返回注入片段。
- [x] P5 Prompt 注入接线：在 `src/server/annotation-prompt-builder.ts` 增加 `narrativeEventInstruction` 注入位（位于角色状态/横向联想之后），确保 suggestion 与普通 annotation 双链路一致生效。
- [x] P6 埋点与可观测性：落地 `density_scored`、`trigger_blocked`、`event_triggered`、`event_condensed` 事件字段；先接入现有 telemetry 落库通道，至少保证日志可查询与按角色/类型聚合。
- [x] P7 前端凝结回传对齐：补齐 `event_condensed` 回传字段（`eventType/eventId/isTriggeredReply`）到现有 suggestion 凝结链路，避免只记录 `suggestion_accepted` 无法区分低密度触发来源。
- [x] P8 测试与验收：补单测（评分边界、阈值、上限拦截、权重抽样、跨日重置、空事件库兜底）+ 联调验收（首条不触发/低密触发/上限拦截/注入格式）。
- [x] P9 文档同步：更新 `api/README.md`、`src/api/README.md`、`src/store/README.md`、`docs/CHANGELOG.md`，补充配置项与埋点定义。
- [x] P10 可观测升级：新增 `lateral_sampled` 埋点（含 `narrativeScore/finalProbability/triggered/associationType`），并扩展 `/telemetry` 入口 + `AI Annotation` 子看板，支持按业务查看横向联想触发与评分分桶。
- [x] P10 触发策略升级：四维权重调整为 `freshness=0.30 / density=0.30 / emotion=0.25 / vocab=0.15`；触发从“阈值门控 + 固定概率”升级为“分数驱动连续概率”；横向联想概率改为由叙事分连续调制（`base=0.5, delta=0.2, range=0.3-0.7`）。
- [x] P11 权限收口：Telemetry 入口与路由都改为严格管理员校验（DEV/PROD 一致），普通用户不显示入口且不可直接访问 `/telemetry*`。
- [x] P12 角色互提文档二落地：`character_mention` 从固定句子改为“关系说明 + A/B/C/D 组指引 + 禁止项 + few-shot”注入，三语言（zh/en/it）等价维护。
- [x] P13 注入文案收口：移除 `今日小事` 标签字样（保留低密度触发逻辑）；互提长度规则更新为 zh 约 20 字上限 40、en 约 10-16 words 上限 24、it 约 11-18 parole 上限 26。
- [x] P14 互提长度口径调优：按现有三语言例句分布上调区间，zh 调整为 20-28 字上限 40、en 调整为 16-22 words 上限 30、it 调整为 16-24 parole 上限 32。
- [x] P15 批注模型分语种路由：`getModel(lang)` 调整为 zh 使用 `qwen-plus`，en/it 使用 `gemini2.0-flash`。
- [x] P16 annotation provider 接线：`/api/annotation` 按 model 自动路由 provider/key/baseURL（zh 走 `QWEN_API_KEY`，en/it 走 `GEMINI_API_KEY`），并补齐 `ANNOTATION_QWEN_BASE_URL` / `ANNOTATION_GEMINI_BASE_URL` 文档与 `.env.example`。

### 验收口径（DoD）

- [ ] 功能正确：首条输入不触发；低密度命中后在上限与概率条件满足时可注入且单次仅 1 条。
- [ ] 数据正确：`todayNarrativeCache` 能按天重置、滚动更新 `today_richness`，并正确累计 `trigger_count`。
- [ ] 体验正确：注入文本为自然语言，不出现“系统触发/事件类型”等技术词；回复时延无明显退化。
- [ ] 可运营：可按角色/类型查看触发率、拦截率、凝结率，支持 2 周内调参复盘。

### 风险与待决策

- [x] 事件库来源：文档二中的“角色互提”已接入（prompt 指引式注入）；`natural_event` 仍为内置最小库，后续可配置化。
- [ ] `user_metadata` 并发写冲突：需与 `long_term_profile_enabled/login_days/lateral_association_state_v1` 共存，统一 merge-write 工具避免互相覆盖。
- [ ] 埋点落库成本：若 telemetry 表写放大明显，需降采样或拆异步队列，避免影响 annotation 主链路时延。

---

## 近期完成（仅保留 2 条）

- [x] EcoSphere 漂浮规则增强：加入随机时长 + 随机方向的游走目标切换，并新增随机冲量脉冲，移除固定竖向偏置，让气泡更接近无规则自由漂浮。
- [x] 日报植物区交互简化：移除心情气泡点击后的「心情能量曲线」展开面板，保留夜间提示与双气泡自由漂浮展示。

---

## 会话恢复顺序

1. `LLM.md`
2. `docs/CURRENT_TASK.md`（本文件）
3. `docs/PROJECT_MAP.md`
4. `docs/TSHINE_DEV_SPEC.md`
5. 按任务读取模块 README / 规格文档：
   - AI 建议模式：`src/store/README.md`、`src/api/README.md`、`api/README.md`
   - 日记重建：`docs/DIARY_REBUILD_PLAN.md`、`src/features/report/README.md`

---

## 归档说明

- 本文件只保留当前未完成事项与极少量最新完成项，历史明细统一查 `docs/CHANGELOG.md`。
