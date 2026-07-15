# CURRENT TASK (Session Resume Anchor)

Last Updated: 2026-07-15
Owner: current working session

Session Notes:

- 2026-07-15: Fixed Diary Book occasional future-blank landing: report calendar now disables today/future daily cells instead of allowing accidental future `daily` report generation, and Diary Book initial open now resolves to the latest non-future daily report with real diary signals before falling back to the latest non-future placeholder; added `reportPageHelpers` regression coverage for future-date blocking and initial-target selection.
- 2026-07-15: Growth 瓶子横向列表隐藏系统粗滚动条，改为居中的短款半透明圆角滑动指示器；指示器跟随横向进度并在停止滑动 650ms 后淡出，不改变瓶子尺寸、间距和原生滚动行为。
- 2026-07-15: Growth 目标瓶与习惯瓶视觉区分：新增 `src/assets/growth/bottle_goal.png`，仅 `type === 'goal'` 的瓶子使用新瓶身；习惯瓶及瓶内星星图片、散布逻辑保持不变。
- 2026-07-15: Diary 详情双页页头调整：日期横线下新增两点分页指示器，当前页显示实心；第一页右边缘显示低透明度 `›`，第二页左边缘显示低透明度 `‹`，统一放大为 `32px`，无圆形背景并垂直居中；首次进入第一页时内容与箭头共同轻微左移回弹一次，顶部导航及横向滑动逻辑不变。
- 2026-07-14: Report 根系画布修复宽屏错位：土壤左右改为与标题一致的 `16px` 留白；根系保持原始 `360 x 520` 比例，不再随宽屏横向拉伸，并通过响应式坐标计算将根系起点持续锚定在土壤表面中央。根系角度、长度与活动数据未改动。
- 2026-07-14: 修复线上 Growth 页面渲染失败：`useReminderSystem` 在保留今日计时加载逻辑时漏掉了 `useTimingStore` import，Safari 运行到该 effect 时抛出 `Can't find variable: useTimingStore`；现已补回导入，不改提醒逻辑或页面样式。
- 2026-07-13: Completed an as-is audit of activity/mood classification and GitHub OSS research in `docs/ACTIVITY_MOOD_CLASSIFICATION_CURRENT_STATE.md`: documented the local rule/evidence/write pipeline, traced `get up` to the zero-evidence `ambiguous_default_to_mood` fallback, separated intent routing from activity-category and mood-tag classification, and shortlisted commercially usable NLP/lexical/classifier projects with recommended integration stages.
- 2026-07-15: Fixed chat manual time-edit end-state drift: ongoing activities now stay ongoing when users only adjust the start time, but become explicitly ended once users edit the end time; `updateActivity()` now syncs both `dateCache` and cloud `is_active` so the next activity no longer rewrites a manually set end time, and the edit modal now defaults an ongoing card's end time to the current moment instead of mirroring the start time.
- 2026-07-13: Auth signup OTP feedback strengthened: email-code signup now keeps a stable sent-code card tied to `pendingSignUpEmail`, shows the concrete target email in both `AuthPage` and onboarding `StepAuth`, preserves the reminder across verify failures, and aligns OTP UI details (6-digit input clamp, verify CTA, resend entry, placeholder) to reduce the “code sent but no reminder” confusion.
- 2026-07-14: Growth `Add Task` 弹窗的重要程度选项已与待办卡片展开态共用同一份选中颜色映射：High 粉色、Medium 黄色、Low 绿色；新增 `growthTodoPriorityStyles.ts` 作为两处唯一样式来源，Repeat 频率按钮继续保持蓝色。
- 2026-07-14: Chat 活动卡片内心情备注右侧的转换按钮已改为复用拍照按钮的 `showActionButtons` 显示条件：点击卡片后出现，点击卡片外空白处消失；转换逻辑、按钮样式及只读状态保持不变。
- 2026-07-13: 全应用公共玻璃 base 已改为显式视觉外壳接入：`src/index.css` 仅对 `.app-glass-button` 提供双层渐变、透明细边框、外阴影和无磨砂默认值，弹窗公共按钮与心情标签等有圆形/圆角矩形外壳的按钮接入该类；月份标题、无框图片、纯文字与纯图标触发器不再因原生 `<button>` 标签被误套外壳。
- 2026-07-13: 公共玻璃按钮 base 已按确认版更新：移除白色 `inset` 内高光与 `blur/saturate` 磨砂滤镜，新增可由 `--app-glass-*` CSS 变量换色的双层渐变背景结构；现有按钮可保留各自背景覆盖，不固定为单一颜色。同步清理两个 Profile 派生玻璃样式中重新写入的内高光。
- 2026-07-13: Profile 页 AI 角色选择按钮新增局部视觉预览：只调整 `AIModeSection` 选中态，改为日历选中态结构的绿色双层渐变，去掉内高光与磨砂滤镜；公共玻璃 base、其他 Profile 按钮、按钮颜色和圆角均未改动。
- 2026-07-13: Chat 心情标签再次统一：`MoodPickerModal`、`EventCard` 与旧列表 `MessageItem` 现在共用同一个按钮 class 与 `getMoodGlassStyle()`；移除活动卡片残留的旧手写渐变。`calm/down` 与 `bored/tired` 色组进一步拉开，并参考首页日历选中态，将左上纯白高光改为浅化后的心情色，保留公共玻璃 base 的边框、阴影与磨砂参数。
- 2026-07-13: 心情标签玻璃样式继续微调：`src/lib/moodColor.ts` 中左上主高光白色透明度已下调，减弱 mood pill 左上发亮感；同时 mood 色板重新拉开到更明显的马卡龙区分，避免 `calm/down` 与 `bored/tired` 等档位过于接近。
- 2026-07-13: 继续修正首页心情弹窗“选中态始终同一色”问题：确认 `MoodPickerModal` 已切到 `getMoodGlassStyle()` 后，又补齐 `src/lib/moodColor.ts` 中缺失的 `getMoodGlassStyle()` / `getMoodTextColor()` / `anxious` 固定色，避免弹窗拿到旧版单色逻辑。
- 2026-07-13: 修正首页心情弹窗残留旧版统一蓝色选中态：`src/features/chat/MoodPickerModal.tsx` 已移除 `APP_SELECTED_GLOW_*`，改为按 `getMoodGlassStyle()` 为不同 mood 分配颜色，并与外层活动卡片 mood 标签共用同一套颜色来源。
- 2026-07-13: 首页活动流右侧心情标签按钮壳子继续对齐到心情弹窗选中按钮：`src/features/chat/MessageItem.tsx` 已直接改用与 `MoodPickerModal` 同级的 `rounded-full border px-3 py-1.5 text-xs shadow-sm transition-colors` 结构，并把字体族放到按钮本体上，减少肉眼观感差异。
- 2026-07-13: 首页活动流右侧心情标签继续收口：`src/features/chat/MessageItem.tsx` 中列表态 mood 按钮已改为直接复用 `getMoodGlassStyle()`，与心情弹窗选中按钮保持同一套质感、边框和阴影，不再使用简化纯底色版本。
- 2026-07-13: 公共玻璃按钮壳子继续扩展到四个导航页与次级页面：将 `APP_GLASS_BUTTON_BASE_STYLE` 真正接入 Growth 新建瓶/瓶子详情/待办弹窗/每日目标弹窗/专注结束按钮、Report 植物生成与日记相关按钮、Diary shelf/viewer 顶部按钮、Profile 信息页关闭按钮与删除账号弹窗，并让 `APP_GREEN_GLASS_BUTTON_STYLE`、`APP_PROFILE_JELLY_BUTTON_STYLE`、`APP_PROFILE_JELLY_TOGGLE_ON_STYLE` 统一直接继承同一套 base 参数，保持原颜色与圆角不变。
- 2026-07-13: 根系方向设置弹窗右侧选择框语言宽度微调：中文从 `100px` 调整为 `110px`，意大利语从 `160px` 调整为 `155px`，其他语言仍为 `140px`。
- 2026-07-13: 根系方向设置弹窗右侧选择框改为按语言适配固定宽度：中文 `100px`、意大利语 `160px`、其余语言保留 `140px`。
- 2026-07-13: 按用户明确指定，根系方向设置弹窗右侧选择框固定宽度已改为 `140px`。
- 2026-07-13: 根系方向设置弹窗右侧选择框继续缩短：在上一轮基础上再次下调固定宽度，进一步压缩 `Entertainment` 后的空余留白。
- 2026-07-13: 根系方向设置弹窗右侧选择框宽度再次明显收短：固定宽度进一步下调到接近 `Entertainment` 文案占用长度，避免用户侧“看不出变化”。
- 2026-07-13: 根系方向设置弹窗右侧选择框宽度已从偏长版本继续收短，固定宽度下调到更接近最长选项文案的适配长度，避免英文/意大利语版本视觉过长。
- 2026-07-13: 根系方向设置弹窗中，英文/意大利语版本右侧选择框宽度已固定为统一长度，避免因 `Entertainment` / `Work & Study` / 意大利语长词导致不同项宽度忽长忽短。
- 2026-07-13: 根系方向设置弹层中，右侧下拉选择胶囊的文字样式已对齐外侧方向标签：从 `text-xs font-semibold` 调整为 `text-[13px] font-medium`，与“左 / 中偏右 / 右”等文案保持一致。
- 2026-07-13: 按用户要求单独回调 Profile 页“选择陪伴伙伴”按钮圆弧：该组按钮恢复原来的较小圆角（约 `rounded-lg`），不再跟随 Profile 其余按钮的 `50px` 圆弧；其他按钮保持现状。
- 2026-07-13: Profile 页按钮圆弧按用户要求统一收口到 `50px`：已覆盖 AI 角色按钮、陪伴频率按钮、Routine 页按钮、保存/反馈/地区/会员/密码/删除账号等主要按钮；卡片与输入框圆角暂未跟随此轮调整。
- 2026-07-13: 修正 Profile 果冻按钮“颜色被洗浅”问题：保留 `APP_PROFILE_JELLY_BUTTON_STYLE` / `APP_PROFILE_JELLY_TOGGLE_ON_STYLE` 的果冻壳子结构，但将底色恢复到 Profile 原先绿色体系（按钮底色回用 `APP_GREEN_GLASS_BG`，开关开启态回用 `APP_GREEN_TOGGLE_ON_STYLE` 的绿色）。
- 2026-07-13: 按用户确认，将 Chat 心情按钮那套“果冻质感”壳子移植到 Profile 页现有绿色按钮：新增 `APP_PROFILE_JELLY_BUTTON_STYLE` / `APP_PROFILE_JELLY_TOGGLE_ON_STYLE`，并接入 AI 角色、陪伴频率、Profile 内保存按钮、反馈/帮助/地区按钮及相关绿色开关；除颜色外沿用同一套边框、blur/saturate、阴影与渐变结构。
- 2026-07-13: Chat 首页活动卡片右上角相机按钮与心情标签按钮已按用户要求改为“除颜色外，直接套用公共玻璃按钮壳子代码”：边框、阴影、blur/saturate 参数不再做近似微调，仅保留各自蓝色/心情色彩。
- 2026-07-13: Chat 首页活动卡片右上角相机按钮与心情标签按钮已继续向公共玻璃按钮壳子收口：统一更强的边框高光、20px 级 blur/saturate 与内侧高光阴影，保留各自原有蓝色/心情色彩区分，不改右侧关闭按钮。
- 2026-07-13: 按用户确认扩展到全应用范围：现有绿色主按钮、绿色选中态按钮与 Profile 内绿色开关已统一收口到同一套共享参数，核心公共源集中到 `src/lib/modalTheme.ts`（绿色玻璃背景/边框/阴影/文字/开关开启态）。
- 2026-07-13: Profile 页 AI 角色选择按钮选中态外壳已进一步对齐 `Companion frequency` 的 `High` 按钮：保留头像/名称内容不变，仅将选中态渐变、边框与阴影切换到同一套按钮参数，缩小两组控件的视觉差异。
- 2026-07-13: Profile 页 AI 角色选择按钮外层结构已按用户给定按钮模板替换：统一为 `rounded-lg border py-1.5 text-xs font-medium transition-all` 这一组壳子，同时保留头像/名称/锁图标内容。
- 2026-07-13: 按用户收窄范围，仅调整 Profile 页两个开关与 `High` 按钮颜色到 `#D0E6A1` 参考绿色；其余样式结构保持不变。
- 2026-07-13: 继续按设计统一绿色按钮到 `#D0E6A1` 系列：补齐 Profile AI 角色选择按钮选中态，以及 Report/Diary 页下方绿色按钮（`Generate Plan` / 早提示确认 / 日记保存）到同一组绿色玻璃参数。
- 2026-07-13: 按用户要求回引入按钮公共“底层壳子” base：将 `border / boxShadow / backdropFilter / WebkitBackdropFilter` 抽到 `src/lib/modalTheme.ts` 的 `APP_GLASS_BUTTON_BASE_STYLE`，并接入现有主按钮、关闭按钮、次按钮及已落地的顶部玻璃按钮；外形和颜色保持各自原样。
- 2026-07-13: Profile 页 AI 角色选择按钮已回调为“只换色、不加亮”版本：保留原选中态高光结构与阴影强度，仅将绿色替换到 `#D0E6A1` 参考色系。
- 2026-07-13: Profile 页 AI 角色选择按钮选中态已切换到参考绿 `#D0E6A1` 系列，玻璃渐变与阴影同步换成该色阶。
- 2026-07-13: Growth 展开半卡片中的重要程度 `medium` 选中态黄色已切换到参考色 `#FEFFAF` 系列，对应玻璃渐变与阴影同步改为该色阶。
- 2026-07-13: Diary 页右上角两颗按钮左侧主高光透明度已从 `0.92` 下调到 `0.80`，仅收弱表层左端亮度，其余渐变/磨砂参数保持不变。
- 2026-07-13: Diary 页左侧日历按钮现已追平右侧 `Diary Book` 按钮：绿色、渐变停靠点、边框高光、阴影与轻磨砂参数统一，右上角两颗按钮当前为同款样式。
- 2026-07-13: Diary 页 `Diary Book` 顶部按钮参数再次收口：保留当前 `#D0E6A1` 绿色与轻磨砂 `blur/saturate` 设置，仅将渐变停靠点、边框高光和主体阴影回调到用户确认版 `greenGlassStyle` 数据。
- 2026-07-13: Diary 页 `Diary Book` 顶部按钮继续微调：减弱左侧高光（左端浅色与边框亮层透明度下调），同时提升轻磨砂质感（blur 提高、saturate 收低，并加入更淡的内侧高光）。
- 2026-07-13: Diary 页 `Diary Book` 顶部按钮颜色单独回切到设计指定绿 `#D0E6A1`，保持与左侧日历按钮同类玻璃外壳，但右侧按钮绿色层次恢复为参考图色阶。
- 2026-07-13: Diary 页 `Diary Book` 顶部按钮已与左侧日历按钮统一外观样式：当前两者共用同一套 header button 玻璃外壳，仅保留图标/文案差异。
- 2026-07-13: `Diary Book` 顶部按钮视觉再次细调：绿色基准改为 `#D0E6A1`，并加入轻微磨砂质感（更柔的 blur/saturate + 更淡的内侧高光），保留原有绿色玻璃按钮方向但雾感更轻。
- 2026-07-13: Diary 页右上角日历/日记本按钮颜色进一步校准到统计环绿色系，当前改为和 activity donut 主绿 `#D5E8CE` 同档的浅绿玻璃渐变，而不是沿用 growth CTA 的偏黄绿。
- 2026-07-13: Chat 活动卡片心情标签也已补齐玻璃化：标签本体从半透明纯底改为带边缘高光、色调渐变与轻阴影的玻璃胶囊样式，和右上角功能按钮质感统一。
- 2026-07-13: Chat/Diary 按钮玻璃质感补齐：`EventCard` 右上角照片上传与转心情按钮改为带浅色边缘高光的彩色玻璃圆按钮；`ReportPage` 顶部日历/日记本按钮统一到共享绿色玻璃 CTA 风格。
- 2026-07-13: Growth 页面绿色玻璃 CTA 统一继续扩展到 `AddGrowthTodoModal` 与 `DailyGoalPopup` 的主确认按钮；当前 growth 内常用确认动作基本都已对齐到同一套 `#D0E6A1` 玻璃参数。
- 2026-07-13: Growth 新建 habit 后的自动建待办确认弹窗主按钮也已并入确认版绿色玻璃 CTA，和瓶子详情、新建瓶弹窗、发送按钮保持一致。
- 2026-07-13: Growth/Chat 绿色玻璃 CTA 样式继续统一：将确认版 `#D0E6A1` 按钮参数抽到 `src/lib/modalTheme.ts` 公共常量，并同步应用到瓶子详情弹层主按钮与首页输入框发送按钮，保证瓶子/发送主动作视觉语言一致。
- 2026-07-13: Growth 习惯目标瓶右侧增加按钮已对齐新建养液瓶弹窗确认版绿色玻璃参数：沿用 `#D0E6A1` 主色与同一套双层渐变/边框高光/阴影数据，统一页面内瓶子相关 CTA 视觉语言。
- 2026-07-13: Growth 新建养液瓶弹窗按钮样式继续对齐：`AddBottleModal` 中 `Type` 选中态与 `Save` 主按钮统一改为 `#D0E6A1` 档绿色玻璃质感，保留原有轻透渐变层次，仅调整色阶与按钮一致性。
- 2026-07-13: Growth 顶部“习惯目标”副标题改为按需提示：默认不再常驻显示 `growth_bottle_section_hint`，改为点击标题后在标题右侧弹出小浮层，3 秒未操作自动消失，点击空白区域也会关闭。
- 2026-07-10: Chat 首页活动卡手动结束按钮新增 3 秒误触撤销窗口：首次点击仅进入 `pendingManualEnds` 灰态缓冲，3 秒内再次点击可取消并继续沿用原计时；超时后才真正调用 `endActivity()`，避免 todo 完成/星星发放/annotation 等副作用过早落地。
- 2026-07-13: Fixed overlapping active activity cards across chat/todo/focus/reminder entry points: `sendMessage()` now closes all ongoing activities before opening a new one, timeline manual insert/edit blocks ranges that conflict with an ongoing activity, and reminder confirm/manual-input flows now share one timing+chat helper so cold-start notification confirms and deny->custom-input both keep timing sessions and chat cards in sync.
- 2026-07-10: Fixed AI diary English word splitting in report diary surfaces: `ReportDetailModal` observation text no longer uses `wordBreak: break-all`, and `DiaryBookViewerPageContent` now keeps Chinese justified while EN/IT use left-aligned wrapping to avoid narrow-column word fragmentation.
- 2026-07-10: Split `DiaryBookViewer` page-content/render constants into `DiaryBookViewerPageContent.tsx` and `diaryBookViewerTheme.ts`, bringing `src/features/report/DiaryBookViewer.tsx` back under the max-lines pre-commit hard limit without changing viewer behavior.
- 2026-07-10: Updated report plant->diary flow: after today's plant card appears, tapping the card CTA now reuses `ReportPage`'s existing today-diary open path so the app opens the diary detail page/modal directly instead of generating in place without navigation.
- 2026-07-13: Updated report diary-return flow: once today's AI diary finishes generating from the plant CTA, the modal pauses on page 2 for 2 seconds and auto-slides back to page 1; after a diary exists, the bottom-nav report button now deep-links straight into today's page-1 diary detail instead of reopening the plant root surface.
- 2026-07-10: Fixed recurring todo "Delete all future" from a completed instance: the action now removes the recurrence template and the currently selected completed instance, while preserving older completed history.
- 2026-07-10: Fixed chat activity card image reflow: when image 1 is deleted, any remaining image 2 now shifts into the first visible position instead of staying stranded on the right.
- 2026-07-10: Fixed chat activity card image-slot rendering: removing image 1 no longer hides image 2; added `eventCardImages` regression coverage for the second-image-only state.
- 2026-07-10: Fixed English diary activity/mood copy fallback: diary book/detail views now recompute localized activity and mood summaries when stored summaries are from another language, and `/api/diary` now localizes raw-input/date/history prompt labels for EN/IT.
- 2026-07-10: Chat neutral placeholder English copy polish: `chat_placeholder_neutral` now uses "Capture this moment, the tree will remember it" in `src/i18n/locales/en.ts`; ZH/IT were left unchanged.
- 2026-07-07: Supabase/iOS startup diagnostics round 1: app initialization now opens after session restore + storage scope + local cache rehydrate, while cloud refresh, local-to-cloud sync, outbox flush, streak, and deletion checks run in background with per-stage diagnostics. Added request timing/requestId logging for Supabase and `/api/*`, detailed auth/outbox/payment/chat diagnostics, and user-visible failure messages for startup/error-boundary/retry surfaces. Next step: extend the same requestId + structured logs to remaining Vercel endpoints and add business-level logs to Todo/Growth/Report/Mood stores plus native iOS WebView startup logs.
- 2026-07-07: Auth metadata shrink follow-up: added SQL and frontend support to move growing `login_days`, `user_profile_v2`, and `long_term_profile_enabled` out of JWT-backed Auth metadata into `user_login_days` and `user_profiles`. Frontend now writes these tables first, uses metadata only as migration fallback, and keeps local-first profile UX.

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
