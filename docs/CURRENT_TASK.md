# CURRENT TASK (Session Resume Anchor)

Last Updated: 2026-04-08
Owner: current working session

---

## 当前主线 1：AI 建议模式（P7 收口）

Status: P0-P6 已完成；P7 仅剩联调、事件漏斗和库字段核对。

### 本轮已完成

- [x] Today Context（今日上下文）P0 最小闭环：关键词识别（health/special_day/major_event）→ 当日缓存 → annotation/suggestion 双链路 prompt 注入
- [x] Today Context 云端落库：`AIAnnotation.todayContext` 映射到 `annotations.today_context`，补充 Supabase SQL 与索引，支持回放和分析
- [x] 单测补齐：门控窗口边界、0 点重置、suggestion 自动凝结分支
- [x] 全量回环：`npm run lint:all`
- [x] 显式求建议直通：中文意图识别（如"帮我规划/帮我选择/该怎么办"）可绕过触发门槛并强制 suggestion 输出；命中后仍计入 suggestion 配额与冷却
- [x] suggestion 意图识别补充自然表达覆盖：新增"能不能给点建议/我该先 A 还是 B/请直接告诉我下一步/接下来我应该先做哪个"等用例，并修正规则漏判
- [x] suggestion prompt 多语言补强：新增「生病/难受 -> 具体休息建议且不推工作学习任务」与「难过/低落 -> 先共情再给低负担建议」规则（zh/en/it 同步）
- [x] today context 词库多语言补强（zh/en/it）：补充生病与重大事件表达、否定句拦截（如“没感冒” / “not sick”）、并降低歧义词误判（如 `cold plunge`）
- [x] today context 追加高频自然表达与女性经期语义：支持“来例假/经期/痛经”及 `on my period` / `ho il ciclo` 等跨语言命中
- [x] today context 补充细粒度生活病症场景：牙痛/智齿发炎/口腔溃疡/肠胃不适/反酸等，并按各语言自然表达覆盖（非直译）
- [x] 天气与季节最小上下文接入（v2）：注入 `temperatureC + conditions[] + season`，支持复合天气（如 rain+wind）与业务预警（strong_wind_watch/haze_watch）

### 当前待办（按优先级）

- [x] P0：suggestion 接受链路可靠性改造（主链路改为 store 持久化待消费意图；`window` 事件仅保留 fallback）
- [x] P0：文档对齐（`docs/PROJECT_MAP.md` / `docs/ARCHITECTURE.md` / `api/README.md` / `src/api/README.md` 与真实路由、真实端点保持一致）
- [ ] 联调验收：真实走通「建议出现 -> 点击去做 -> 自动凝结 -> 超时/X 不凝结」
- [ ] 事件级埋点扩展：从 `annotations.suggestion_accepted` 最小闭环升级为 show/click/close/timeout 四事件漏斗
- [ ] 数据库核对：确认目标环境存在 `annotations.suggestion_accepted`，缺失则补 migration
- [x] P1：suggestion JSON 解析改为 schema 强约束（zod `safeParse`），替换脆弱正则解析
- [x] P1：annotation 模块分拆（`annotation-prompts.ts` 按 defaults/user 分拆；handler 下沉 suggestion/similarity 子模块）
- [x] P1：AnnotationRequest/Response 收敛为 `src/types/annotation.ts` 单一来源，`src/api/client.ts` 复用类型
- [x] P2：日志与隐私收敛（移除 prompt 明文日志与提取后正文日志，新增 `ANNOTATION_VERBOSE_LOGS=true` 才输出详细元数据）

### 冻结决策（继续沿用）

- suggestion 配额：`06:00-13:00` 2 条、`13:00-19:00` 2 条、`19:00-次日06:00` 2 条；日上限 4 条
- suggestion 与普通批注分流：配额仅限制 suggestion，不限制普通文字批注
- 点击建议按钮视为自动凝结；未点击/超时/X 关闭不凝结

---

## 当前主线 2：日记功能重建（DIARY_REBUILD_PLAN）

Status: 主链路可用，剩余增强项待推进。

### 当前待办

- [ ] V3：MoodEnergyTimeline（补时间轴数据结构）
- [ ] D5（剩余）：历史趋势补充 mood key 维度（happy/anxious 等跨日分布）
- [ ] V5（可选）：TodoCompletionCard 组件化视觉升级
- [ ] A7（剩余，低优先）：`getDateRange` title 多语言化（写入 reports 表）

### 已确认无需再开分支

- [x] D4：`formatForDiaryAI` 已完整实现
- [x] D6：`api/classify.ts` prompt 与 `ClassifiedData` 对齐完成

---

## 当前主线 3：iOS 套壳登录与输入修复（CAPACITOR_IOS_AUTH_INPUT_FIX）

Status: 问题已复现并完成根因定位，进入修复实施阶段。

### 已确认现象

- [x] 套壳 iOS 点击 Google 登录后，跳到网页端 app 链接而非 Google 账号选择页
- [x] 从外部页面返回 app 后，登录按钮长期 loading（无兜底回收）
- [x] 日记区输入在 iOS 套壳内存在“不弹键盘”场景
- [x] 部分输入框聚焦时页面被 iOS 自动放大，缩回体验差

### 根因判断（当前结论）

- [x] 当前 OAuth 使用 `redirectTo: window.location.origin`，未使用 iOS deep link 回跳链路
- [x] iOS 工程未完成 scheme + Supabase Redirect URLs + `appUrlOpen` 的闭环
- [x] 当手机浏览器已存在 Google 登录态时，Google 可能静默 SSO，直接跳转到 `redirectTo`（因此会看到网页 app 链接，而非 Google 登录页）
- [x] 日记输入存在 `readOnly` + 异步 `focus()` 模式，在 iOS WebView 下可能丢失键盘触发
- [x] iOS 防缩放 CSS 仅覆盖局部容器，未覆盖页面级输入元素

### 当前待办（按优先级）

- [ ] OAuth 回跳链路修复：补齐 iOS scheme、Supabase Redirect URLs、前端 `appUrlOpen` 监听与会话恢复
- [ ] 登录 loading 兜底：Google/Apple 登录增加取消/超时/回跳失败复位
- [ ] 日记输入修复：移除“先只读再异步聚焦”路径，改为同手势链路进入可编辑
- [ ] 输入放大修复：iOS 下页面级 `input/textarea/select` 统一 `font-size >= 16px`
- [ ] 回归验收：真机验证「OAuth 自动回 app」「不再无限转圈」「日记必弹键盘」「输入不异常放大」

### 环境配置核对清单（执行前）

- [ ] Google Cloud OAuth（Web Client）redirect URI 包含 `https://<supabase-ref>.supabase.co/auth/v1/callback`
- [ ] Supabase Auth Redirect URLs 包含 `com.tshine.app://auth/callback`
- [ ] iOS `Info.plist` 已配置 `CFBundleURLTypes`（scheme: `com.tshine.app`）

---

## 近期完成（保留 2 条）

- [x] Annotation Prompt 统一组装入口：新增 `src/server/annotation-prompt-builder.ts`，将 annotation/suggestion 两条链路收敛为统一 `{model, instructions, input}` prompt package，`annotation-handler` 已接入并复用到 rewrite 分支。
- [x] AI 批注待办完成语义化透传：完成待办改为 `activity_completed` 并附带 `todoCompletionContext`；特殊待办（关联瓶子/重复任务 daily+weekly+monthly/创建>=3天）才附加紧凑 `summary + 90天统计`，普通一次性新待办维持轻量透传以控 token
- [x] Annotation 上下文补充结构化日期：`userContext.currentDate` 已透传（year/month/day/weekday/isoDate），并注入 annotation/suggestion prompt。
- [x] Annotation 节假日上下文接入：新增 `user_metadata.country_code`（ISO2）优先 + `timezone` 兜底国家解析，并注入法定/社会节日到 annotation/suggestion prompt。
- [x] 魔法笔提示词多语言对齐：已将 EN/IT prompt 同步到最新中文口径（activity 通常不超过一件；其余活动默认 activity_backfill；仅明确并行表达允许并行）
- [x] 魔法笔 mode-on 自动写入去二次分类：parser 返回的 `autoWriteItems.kind` 直接执行写入（activity->sendMessage / mood->sendMood），并移除 unparsed 本地提升自动写入，避免“活动被写成心情/补录漂移”为待办的二次判定误差
- [x] 修复 AI companion prompts 在 Node ESM 下的模块解析：`src/lib/aiCompanion/prompts/index.ts` 改为显式 `.js` 后缀导出，解决 Vercel `ERR_MODULE_NOT_FOUND`（`/prompts/van`）
- [x] 活动词库补强（zh/en/it）：新增查询/修改/提交/认证等 50+ 实用表达，并补充中英意分类与回归测试
- [x] 植物生成新增「本月同根系 plantId 不重复」约束：当月候选耗尽返回 `monthly_exhausted`，并在生成区提示下月重置。
- [x] 我的页 AI 选中态细调：绿色从过淡回调至轻鼠尾草质感，频率按钮金色同步微降饱和度
- [x] 我的页 AI 陪伴模式绿色选中态二次微调：降低饱和度与对比度，改为更淡更清新、轻盈清透的玻璃感
- [x] 我的页 AI 陪伴模式/陪伴频率选中态回退：移除新版蓝色高亮，恢复为上一版绿色选中视觉（含开关开启态）
- [x] Growth 待办新增长按拖拽换序：长按卡片后可上下拖动并与其他待办交换顺序
- [x] Growth 待办卡片交互微调：移除勾选前六点图标；右上角删除叉默认隐藏，点击对应待办卡片后显示
- [x] Growth 页面交互修正：点瓶子弹「生成待办」、点瓶子周围显示删除叉（桌面保持 hover），并下移瓶子列表整体位置
- [x] 修复 Live Input Telemetry 看板兼容性：`telemetry_events` / `plant_asset_events` 缺表（`PGRST205`）不再导致整页报错，并修正环境变量提示文案的内联间距
- [x] 日记贴纸埋点主链路完成：`diary_sticker_deleted` / `diary_sticker_reordered` 已接入 telemetry 与看板聚合（`restored` 类型已预留）
- [x] AI 建议模式 P7 自动化部分完成：新增测试 + 回环通过
- [x] 记录页日期圆点交互增强：顶部日期条改为可持续左滑并按需扩展历史日期，且滑动停止后自动吸附到最近日期圆点，便于回看历史消息
- [x] AI 批注气泡头像视觉更新：移除圆形头像框，放大人设头像并改为半悬浮超出弹窗的呈现
- [x] AI 建议模式新增「中断挽回」提醒：瓶子连续 3 天未完成或重复待办昨日断档时触发强提醒；提醒时间改为“按历史完成时段”窗口触发，若无历史统一中午 12 点窗口，且同一目标每天最多两次（间隔 >=4h）；用户点击建议并完成对应任务可获 2 颗星（一次性奖励）
- [x] 首页与我的页头像交互统一：点击头像先放大预览，右下角三点菜单更换头像，并提升放大图清晰度（640px/0.95）
- [x] Growth 待办卡片支持双击标题快速编辑：双击标题进入输入态，Enter/失焦保存，Esc 取消
- [x] 日记详情页 UI 对齐新稿：`ReportDetailModal` 改为双页 notebook 版式（第 1 页 activity/mood/to-do/habits，第 2 页 AI 观察 + my diary），并保留生成与保存主链路
- [x] 日记详情页植物图点击可打开植物翻转卡：在 `ReportDetailModal` 接入点击回调，`ReportPage` 挂载 `PlantCardModal`，可查看背面根系卡片
- [x] 待办拆解链路修正：`/api/todo-decompose` 改为 OpenAI (`gpt-4o-mini` 默认)，修复子步骤时长映射（`durationMinutes -> suggestedDuration`），并将按钮文案改为“分步完成 / Step by Step / Passo dopo passo”
- [x] 连续专注休息态关闭修复：`FocusMode` 在休息倒计时点击右上角叉会复用“结束专注”同一套确认文案与按钮；确认后退出整个专注模式（不再继续队列），取消则继续休息；并将“休息一下/跳过休息”接入 i18n（zh/en/it）
- [x] Growth 待办区标题多语言文案微调：`growth_todo_section` 从“今日要事”改为“近日要事”，并同步 EN/IT 为“Recent Tasks / Attivita recenti”

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

- 本文件已移除历史完成分支（旧 PR0-PR4、多语言词库阶段、植物系统 Phase 0-6 等）以降低恢复成本。
- 历史实现细节与验收记录统一查 `docs/CHANGELOG.md`。
