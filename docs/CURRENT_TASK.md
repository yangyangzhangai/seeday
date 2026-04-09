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

Status: 需求文档已按讨论结论升级为 v1.1；待按新分层方案进入 Phase 0 开发。

### 冻结决策（本轮新增）

- [x] 长期画像总开关：放在“我的”页面；仅开关开启时才启动整套长期画像链路。
- [x] 链路门控范围：周提取、记忆写入、prompt 画像注入、历史召回在开关关闭时全部短路停用。
- [x] 吃饭提醒规则保留并个性化：`isMealTime` 同时支持 manual/observed 饭点，未配置时 fallback `11-13 / 18-20`。
- [x] 纪念与记忆双轨：A 类可见纪念日（AI 可自动写入、用户可管理）+ B 类隐性事件记忆（仅 AI 可见，用于回忆召回）。
- [x] 记忆治理：事实事件长期保留不衰减；偏好/关系/状态信号按 30/60/90 天衰减。
- [x] 画像边界：不主动收集年龄/伴侣/家庭关系；仅用户主动表露时后台记录关系线索，不前台展示。
- [x] 新手引导改造：移除性格直问，新增“近期目标/人生目标”和“早午晚饭点”采集，并与待办人生目标联动。

### 当前待办（按优先级）

- [ ] P0-1 类型与快照：新增 `src/types/userProfile.ts`（`UserProfileV2`）与 `src/lib/buildUserProfileSnapshot.ts`，落地 manual/observed/dynamic/hidden 四层结构。
- [ ] P0-2 开关接入：在“我的”页面新增 `longTermProfileEnabled`，并写入 `preferences`。
- [ ] P0-3 链路门控：在周提取、记忆写入、prompt 注入、历史召回四个入口统一接入 `isLongTermProfileEnabled`。
- [ ] P0-4 建议链路接入：`triggerAnnotation -> callAnnotationAPI -> api/annotation.ts -> annotation-prompts.ts` 透传 `userProfileSnapshot`（含 declared/observed 并存信息）。
- [ ] P0-5 吃饭提醒个性化：改造 `src/lib/suggestionDetector.ts` 的 `isMealTime(hour, declared?, observed?)`，补 fallback 与边界测试。
- [ ] P1 新手引导改版：落地 P1-P5（使用目的、作息+饭点、近期目标、人生目标、纪念日），移除性格直问，补齐 i18n（zh/en/it）。
- [ ] P2 我的画像页：支持作息、目标、A 类纪念日管理，并与待办“人生目标管理”双向同步。
- [ ] P3 周提取与记忆：新增 `api/extract-profile.ts`，产出 observed/dynamicSignals + A/B 候选记忆并写回。

### 风险与待决策

- [ ] `user_metadata` 并发写入冲突：需统一合并写策略（避免与 `preferences/login_days/lateral_association_state_v1` 互相覆盖）。
- [ ] 周提取触发口径："最近 7 天且 >=5 条日记"的数据来源（messages / reports）需定案并与埋点一致。
- [ ] A 类自动入库误判回滚：是否在“我的”页增加“最近 AI 新增纪念日”轻提示与一键撤销。
- [ ] 关闭长期画像后的数据治理：默认冷存不使用已冻结；“清除长期画像数据”入口的交互细节待定。

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
