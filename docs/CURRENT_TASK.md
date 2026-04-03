# CURRENT TASK (Session Resume Anchor)

Last Updated: 2026-04-02
Owner: current working session

---

## 当前主线 1：AI 建议模式（P7 收口）

Status: P0-P6 已完成；P7 仅剩联调、事件漏斗和库字段核对。

### 本轮已完成

- [x] 单测补齐：门控窗口边界、0 点重置、suggestion 自动凝结分支
- [x] 全量回环：`npm run lint:all`
- [x] 显式求建议直通：中文意图识别（如"帮我规划/帮我选择/该怎么办"）可绕过触发门槛并强制 suggestion 输出；命中后仍计入 suggestion 配额与冷却
- [x] suggestion 意图识别补充自然表达覆盖：新增"能不能给点建议/我该先 A 还是 B/请直接告诉我下一步/接下来我应该先做哪个"等用例，并修正规则漏判
- [x] suggestion prompt 多语言补强：新增「生病/难受 -> 具体休息建议且不推工作学习任务」与「难过/低落 -> 先共情再给低负担建议」规则（zh/en/it 同步）

### 当前待办（按优先级）

- [ ] 联调验收：真实走通「建议出现 -> 点击去做 -> 自动凝结 -> 超时/X 不凝结」
- [ ] 事件级埋点扩展：从 `annotations.suggestion_accepted` 最小闭环升级为 show/click/close/timeout 四事件漏斗
- [ ] 数据库核对：确认目标环境存在 `annotations.suggestion_accepted`，缺失则补 migration

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

## 近期完成（保留 2 条）

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
- [x] 首页与我的页头像交互统一：点击头像先放大预览，右下角三点菜单更换头像，并提升放大图清晰度（640px/0.95）
- [x] Growth 待办卡片支持双击标题快速编辑：双击标题进入输入态，Enter/失焦保存，Esc 取消
- [x] 日记详情页 UI 对齐新稿：`ReportDetailModal` 改为双页 notebook 版式（第 1 页 activity/mood/to-do/habits，第 2 页 AI 观察 + my diary），并保留生成与保存主链路

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
