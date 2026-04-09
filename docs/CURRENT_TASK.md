# CURRENT TASK (Session Resume Anchor)

Last Updated: 2026-04-09
Owner: current working session

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
- [ ] P3 状态读写接入：当前先落地服务端内存态 `get/saveLateralAssociationState(userId, characterId)` + `dailyDate` 自动换日重置；下一步切到可持久化存储。
- [x] P4 Prompt 集成：已在 annotation 主流程注入 `associationInstruction` 到 U4（角色状态后），覆盖 suggestion 与普通 annotation 双链路。
- [ ] P5 测试与验收：已补单测（去重/daily 限制/多语言注入）；待补统计验收（Momo self_led 约 25%，允许误差范围）。
- [x] P6 可观测性：新增 debug 日志字段（associationType/originType/toneTag/instruction），便于线上调优与回归排查。
- [ ] P7 文档同步：同步 `src/store/README.md`、`src/api/README.md`、`api/README.md`、`docs/CHANGELOG.md`。

### 风险与待决策

- [ ] 关键词维护策略待定：`detectInputSignals` 先硬编码首版，还是复用 `src/services/input/` 现有词库；需结合现有词库覆盖率与耦合成本确认。
- [ ] 状态持久化落点待核对：优先复用当前用户配置表/metadata，避免新增表；若字段容量或并发更新风险高，再补轻量 migration。

---

## 近期完成（仅保留 2 条）

- [x] 修复 suggestion 待办跨页落地时序：`GrowthPage` 改为在 `todos` hydrate 且父待办已存在后再消费 `pendingSuggestionIntent`，避免提前清空导致不高亮/不落地。
- [x] 修复 stale todo 判定鲁棒性：补齐 todo 时间字段字符串解析与服务端 fallback（基于 `createdAt` 推断长期未完成），恢复“长期待办先拆解后建议”触发稳定性。

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
