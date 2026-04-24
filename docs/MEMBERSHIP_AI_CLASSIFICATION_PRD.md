<!-- DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/PROJECT_MAP.md -> docs/MEMBERSHIP_SPEC.md -->

# 会员 AI 分类分层策略 PRD（Free 规则 / Plus 全量 AI）

## 1. 背景与目标

当前活动分类、心情分类、星星瓶子匹配存在多条分支，AI 调用路径分散，导致：
- 成本不可控（免费用户也可能触发 AI）
- 产品口径不清晰（不同入口策略不一致）
- 研发与测试缺少统一验收标准

本次产品决策：
- **Free 用户：完全不调用 AI**，全部走本地规则/关键词。
- **Plus 用户：每条记录都走 AI 分类**，统一产出结构化结果。

目标：
1. Free 侧 AI 成本归零。
2. Plus 侧分类体验统一且准确。
3. 星星判定、活动分类、心情分类口径一致。

---

## 2. 范围定义

### 2.1 In Scope
- 聊天记录链路（记录活动/心情）
- 星星瓶子关联判定
- 活动类型分类（study/work/social/life/entertainment/health）
- 心情类型分类（沿用现有 mood 枚举，或输出正中负后做映射）
- Free/Plus 分流策略

### 2.2 Out of Scope
- 新会员体系规则（沿用现有 `isPlus`）
- 日报/周报/月报页面改版
- 瓶子动画样式改造

---

## 3. 用户分层行为定义（最终口径）

## 3.1 Free 用户
- 不调用 `/api/classify`。
- 活动分类：本地规则（词库/关键词/规则逻辑）。
- 心情分类：本地规则。
- 星星判定：
  - todo 已绑定 bottle -> 直接加星；
  - 瓶子关键词命中 -> 加星；
  - 不做 AI 语义兜底。

### 3.2 Plus 用户
- 每条记录进行一次 AI 分类（不可重复调用）。
- AI 输出四个方向结果：
  1) 记录类型：`activity | mood`
  2) 瓶子关联：`matched_bottle`（是否命中、命中哪一个）
  3) 活动分类：`study/work/social/life/entertainment/health`
  4) 心情分类：项目 mood 口径（可由 AI 主标签映射）
- 星星判定优先使用 AI `matched_bottle` 结果。

---

## 4. 关键产品规则

1. **单条记录单次 AI**（Plus）
   - 禁止同一条记录在 `sendMessage`、`endActivity` 等多个环节重复请求。

2. **服务端强约束**
   - Free 用户绕过前端直接调 classify 必须失败（403）。

3. **分类口径稳定**
   - 存储层继续沿用活动六类；
   - 若前端需要“四象限展示”，在展示层聚合，不改底层历史数据结构。

4. **失败降级策略**
   - Plus 用户 AI 超时/失败时，回退本地规则并记录失败日志，不阻断记录流程。

---

## 5. 成本与收益预期

- Free：AI 成本约等于 0。
- Plus：AI 成本与 Plus 活跃规模线性相关。
- 通过“会员独享高精度分类”形成付费价值锚点。

---

## 6. 验收标准（产品验收）

1. Free 用户记录 50 条活动：AI 调用次数 = 0。
2. Plus 用户记录 50 条活动：AI 调用次数 = 50，且每条仅 1 次。
3. Free 星星来源仅限 todo 绑定/关键词，不出现 AI 语义命中。
4. 非 Plus 用户直调 classify 返回 403（或业务码 `membership_required`）。
5. 记录成功率不下降（AI 失败不阻断记录）。

---

## 7. 数据与埋点（最小必需）

建议埋点字段：
- `user_plan`: free | plus
- `classification_path`: local_rule | ai | ai_fallback_local
- `ai_called`: boolean
- `ai_result_kind`: activity | mood | unknown
- `bottle_match_source`: todo_link | keyword | ai | none

用于验证分层策略是否按预期执行，并评估 Plus 体验收益。

---

## 8. 上线策略

1. 先灰度（内部账号）验证 1~2 天。
2. 再全量开启。
3. 出现异常时可通过开关回退到“全部本地规则”保底。

---

## 9. 开发任务规划（可直接拆给研发）

1. **后端鉴权改造**：`/api/classify` 增加 Supabase 鉴权与会员校验；非 Plus 返回 403。
2. **前端 API 改造**：`callClassifierAPI` 增加 Authorization 头传递，统一错误码处理。
3. **聊天链路分流**：在消息处理主路径按 `isPlus` 分支；Free 永不触发 classify。
4. **去重调用治理**：合并多处 classify 触发点，确保 Plus 每条记录仅调用一次。
5. **星星判定重排**：Free 仅 todo/关键词；Plus 优先 AI matched_bottle。
6. **心情/活动映射统一**：落地 AI 返回字段到现有 store 结构，补齐映射函数。
7. **降级与容错**：Plus AI 失败回退本地规则，不影响写入与 UI 流程。
8. **埋点与日志**：补 plan/path/ai_called 等最小埋点，便于验收与复盘。
9. **测试与回归**：补单元+集成用例，覆盖 Free/Plus、成功/失败、星星命中路径。
