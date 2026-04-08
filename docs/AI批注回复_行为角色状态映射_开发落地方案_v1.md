# Timeshine AI批注回复：行为-角色状态映射开发落地方案（可直接实施）

- 版本：v1.0
- 日期：2026-04-08
- 依据文档：`docs/Timeshine_用户行为角色状态映射_PRD_v1_2.docx`
- 适用目标：把 PRD 中 B01-B21 行为映射规则稳定接入现有 `/api/annotation` 批注链路

---

## 1. 目标与成功标准

### 1.1 目标

在不破坏现有 AI 批注与 suggestion 输出稳定性的前提下，把“用户行为 -> 角色状态文本（U3）”完整接入，让模型能自然融入“活人感”状态，而不是机械复述。

### 1.2 成功标准（上线验收）

1. 支持 B01-B21 行为识别（中英意）并能产出对应角色状态文本。
2. 支持即时触发、连续触发、延迟触发、7天密度衰减、同日去重、并发上限2条。
3. `/api/annotation` 与 suggestion 模式（含 `forceSuggestion=true`）稳定，JSON 解析成功率不下降。
4. 有完整单测 + 集成测试 + 回归命令通过。
5. 有灰度与回滚策略，可快速停用新逻辑。

---

## 2. 范围定义

### 2.1 本期范围（In Scope）

1. 新增行为识别器、映射资产、事件追踪器、状态构建器。
2. 在 `useAnnotationStore -> callAnnotationAPI -> annotation-handler -> prompt builder` 链路注入 U3 角色状态文本。
3. 支持 PRD 定义的规则与优先级。
4. 补齐测试、日志、灰度开关、文档。

### 2.2 非本期范围（Out of Scope）

1. LLM 语义分类替代关键词规则（保留为后续升级）。
2. 新增 UI 页面（本方案只改状态与服务端 prompt 链路）。
3. 重构现有 suggestion 漏斗埋点（show/click/close/timeout）本身逻辑，仅保证兼容。

---

## 3. 现状与接入点

### 3.1 当前批注主链路

1. `src/store/useAnnotationStore.ts` 触发并组装 `AnnotationRequest`。
2. `src/api/client.ts` 调用 `/api/annotation`。
3. `src/server/annotation-handler.ts` 组装 prompt package。
4. `src/server/annotation-prompt-builder.ts` + `src/server/annotation-prompts.user.ts` 生成 user prompt。
5. LLM 输出文本（或 suggestion JSON）返回前端展示。

### 3.2 最佳接入策略

新增 `characterStateText`（U3 文本）作为 `AnnotationRequest.userContext` 的一个字段，从 store 透传到 server prompt 层；行为规则计算尽量放在纯逻辑模块（`src/lib` 或 `src/services`），避免污染 UI/store 结构。

---

## 4. 角色映射与规则冻结

### 4.1 PRD 角色到现有 aiMode 映射（必须固定）

| PRD角色 | 物种 | 现有 aiMode |
|---|---|---|
| Van | 喇叭花 | `van` |
| Momo | 蘑菇 | `momo` |
| 龙血树 | 龙血树 | `agnes` |
| 鹈鹕 | 鹈鹕 | `zep` |

说明：`agnes` 在现有产品中是“龙血树人格位”，本方案按角色语义映射，不改用户可见命名。

### 4.2 待确认项默认值（先冻结为实现默认）

1. 连续触发按“活跃日”计数（有记录的天）。
2. B05 久坐阈值：单次记录 `duration >= 120` 分钟。
3. 并发优先级：情绪类 > 身体类 > 饮食类 > 环境类（同级按 PRD 事件优先级）。
4. 连续触发中断一天后清零。
5. 延迟与即时同天并发：可同时注入，总上限2条。
6. B06 多茶种冲突：花草茶 > 发酵茶 > 叶茶 > 清茶。
7. B20 与 B21 同时命中时：B21 优先。

---

## 5. 总体架构设计

## 5.1 模块分层

### 规则引擎层（纯逻辑）

建议新增目录：`src/lib/characterState/`

1. `behavior-map.ts`：B01-B21 全量数据资产。
2. `behavior-matcher.ts`：关键词/时长匹配，输出命中行为列表。
3. `event-tracker.ts`：连续天数、7天密度、延迟事件到期、去重。
4. `character-state-builder.ts`：综合规则，输出最终 U3 文本。

### 编排接入层

1. `src/store/useAnnotationStore.ts`：调用 builder，注入 `userContext.characterStateText`。
2. `src/types/annotation.ts`：扩展请求类型。
3. `src/server/annotation-prompt-builder.ts`：透传字段。
4. `src/server/annotation-prompts.user.ts`：拼装 U3 文本段。

### 可观测层

1. 在 `ANNOTATION_VERBOSE_LOGS=true` 时记录命中行为、衰减路径、裁剪原因。
2. 默认不输出敏感正文，不破坏现有隐私日志约束。

---

## 6. 数据结构与契约

## 6.1 行为资产结构

```ts
type CharacterId = 'van' | 'momo' | 'dragon' | 'pelican';
type Timing = 'instant' | 'delay-1' | 'delay-2';
type DecayType = 'high' | 'mid' | 'none';

interface BehaviorEntry {
  id: string;                     // B01..B21
  name: string;
  timing: Timing;
  delayDays?: 1 | 2;
  decayType: DecayType;
  targets: CharacterId[];
  category: 'emotion' | 'body' | 'diet' | 'environment' | 'habit';
  priority: number;               // 数值越大优先级越高
  instant: Partial<Record<CharacterId, string>>;
  trend: Partial<Record<CharacterId, string>>;
  lite?: Partial<Record<CharacterId, string>>;
}
```

## 6.2 追踪器状态结构

```ts
interface BehaviorHitEvent {
  behaviorId: string;
  date: string;      // YYYY-MM-DD
  timestamp: number;
}

interface DelayedEvent {
  behaviorId: string;
  characterId: CharacterId;
  dueDate: string;   // YYYY-MM-DD
  expiresInDays: number;
  sourceDate: string;
}

interface CharacterStateTracker {
  history: BehaviorHitEvent[];
  delayedQueue: DelayedEvent[];
  injectedByDate: Record<string, string[]>; // 当天已注入过的 behaviorId 列表
}
```

## 6.3 Annotation 请求扩展

在 `src/types/annotation.ts` 的 `AnnotationRequest.userContext` 中新增：

```ts
characterStateText?: string;
characterStateMeta?: {
  matchedBehaviorIds: string[];
  injectedBehaviorIds: string[];
  usedTrendIds: string[];
  usedLiteIds: string[];
};
```

`characterStateMeta` 用于调试和 telemetry，prompt 实际只注入 `characterStateText`。

---

## 7. 核心算法细节

## 7.1 行为识别（Matcher）

1. 先做文本标准化（小写、空白压缩、标点清洗、全角半角统一）。
2. 按行为词典扫描中英意关键词。
3. 处理特殊规则：
   - B05：`duration >= 120` 才命中。
   - B06：匹配多个茶种时按优先级只保留一个子类型。
4. 返回有序行为列表（先按行为优先级，再按文本出现顺序）。

## 7.2 连续触发（Streak）

1. 基于“活跃日”而非自然日。
2. 只统计该 `behaviorId` 在最近活跃记录中的连续命中。
3. `streak >= 3` 使用 `trend` 文案，且不叠加 `instant`。

## 7.3 延迟触发（Delay）

1. `delay-1`：当日命中写入队列，次日可消费。
2. `delay-2`：影响可覆盖后续2天，队列存 `expiresInDays`。
3. 每次构建 U3 前先消费 `dueDate <= today` 的条目。

## 7.4 7天密度衰减（Decay）

1. `high`：7天内出现 `>=4` 次，直接不触发。
2. `mid`：7天内出现 `>=3` 次，改用 `lite`（仅环境句）。
3. `none`：不衰减。

## 7.5 并发裁剪与去重

1. 同日同 `behaviorId` 若已注入过，跳过。
2. 即时+延迟可并存，但总注入上限2条。
3. 超过2条按 `priority` 裁剪，保留前2。

---

## 8. Prompt 注入设计

## 8.1 注入位置

在 `src/server/annotation-prompts.user.ts` 中，U3 文本放在“today context”附近，作为独立段：

```text
Character current state:
<characterStateText or none>
```

中文/意大利语分别本地化标题。

## 8.2 注入规则

1. `characterStateText` 为空时显示 `none/无/nessuno`。
2. suggestion 模式与 annotation 模式都注入该段。
3. 不改变 suggestion JSON 输出协议，只增加上下文，不新增格式约束。

---

## 9. 开关、灰度与回滚

## 9.1 功能开关

新增环境开关（server 读取，store 透传）：

- `ANNOTATION_CHARACTER_STATE_ENABLED=true|false`

策略：

1. `false`：完全跳过新逻辑，行为与当前线上一致。
2. `true`：执行完整规则并注入 U3。

## 9.2 灰度策略

1. 第1阶段：10% 用户。
2. 第2阶段：30% 用户。
3. 第3阶段：100% 全量。

灰度观测指标：

1. suggestion JSON 解析失败率。
2. 默认兜底批注比例（`source=default`）。
3. 用户侧“重复感”反馈。

## 9.3 回滚策略

1. 软回滚：开关置 `false`，立即恢复旧行为。
2. 硬回滚：回退本次提交，保留测试与文档变更可选。

---

## 10. 实施任务分解（按阶段）

## Phase A：规则引擎实现（P0）

### A1. 角色与规则常量

- 文件：`src/lib/characterState/constants.ts`
- 任务：角色映射、行为分类优先级、默认阈值。
- 完成标准：导出常量可被 matcher/tracker/builder 复用。

### A2. 行为映射资产录入

- 文件：`src/lib/characterState/behavior-map.ts`
- 任务：录入 B01-B21 全文案（instant/trend/lite + timing/decay/targets）。
- 完成标准：类型通过；每个 ID 唯一且连续。

### A3. 行为识别器

- 文件：`src/lib/characterState/behavior-matcher.ts`
- 任务：关键词匹配、多语支持、B05 时长、B06 路由。
- 完成标准：输出稳定且可复测。

### A4. 事件追踪器

- 文件：`src/lib/characterState/event-tracker.ts`
- 任务：history、streak、density、delay queue、today dedupe。
- 完成标准：核心接口纯函数可测试。

### A5. 状态构建器

- 文件：`src/lib/characterState/character-state-builder.ts`
- 任务：串联 matcher + tracker + map，输出最多2条 U3 文本。
- 完成标准：规则全覆盖，返回 `text + meta + updatedTracker`。

## Phase B：主链路接入（P1）

### B1. 类型扩展

- 文件：`src/types/annotation.ts`
- 任务：扩展 `userContext.characterStateText/meta`。

### B2. 前端 store 编排

- 文件：`src/store/useAnnotationStore.ts`
- 任务：在触发 annotation 前计算状态文本并透传；更新 tracker 持久化。
- 注意：只在 annotation 链路增加，不影响 chat/todo 原有流程。

### B3. server prompt 透传

- 文件：`src/server/annotation-prompt-builder.ts`
- 任务：接收 `characterStateText` 参数并传给 prompt 生成。

### B4. prompt 模板注入

- 文件：`src/server/annotation-prompts.user.ts`
- 任务：三语注入 U3 段，annotation 与 suggestion 共用。

### B5. handler 兼容与开关

- 文件：`src/server/annotation-handler.ts`
- 任务：处理开关、日志、异常兜底。

## Phase C：测试与质量门禁（P1.5）

### C1. 单元测试

- `src/lib/characterState/behavior-matcher.test.ts`
- `src/lib/characterState/event-tracker.test.ts`
- `src/lib/characterState/character-state-builder.test.ts`

覆盖点：

1. B01/B20/B21 等关键行为命中。
2. B06 多茶种优先级。
3. B05 时长阈值。
4. streak>=3 使用 trend。
5. delay 到期注入。
6. density high/mid/none。
7. 并发上限2条。
8. 同日去重。

### C2. 集成测试

- `src/server/annotation-handler.test.ts`
- `src/server/annotation-prompts.user.test.ts`

覆盖点：

1. prompt 包含 U3 段。
2. `forceSuggestion=true` 仍返回可解析 JSON。
3. 未命中行为时 U3 为 none。

### C3. 回环命令

```bash
npx tsc --noEmit
npm run test:unit
npm run build
npm run lint:all
```

## Phase D：灰度上线（P2）

1. 打开开关到10%，观察24小时。
2. 无异常扩到30%，再观察48小时。
3. 全量发布，保留开关7天。

---

## 11. 任务排期建议（参考 5 天）

### Day 1

1. A1-A2（常量 + 行为资产）
2. A3（matcher）

### Day 2

1. A4（event tracker）
2. A5（state builder）
3. matcher/tracker 单测首版

### Day 3

1. B1-B2（types + store 接入）
2. B3-B4（prompt 注入）

### Day 4

1. B5（handler 开关 + 日志）
2. C1-C2（单测/集成补齐）

### Day 5

1. C3 回环
2. 文档同步
3. 灰度发布

---

## 12. 风险清单与应对

### 风险1：suggestion JSON 被污染

- 原因：U3 文本注入导致模型偏离 JSON-only 约束。
- 应对：保持 `forceSuggestion` 规则优先级最高；集成测试覆盖。

### 风险2：文案重复感上升

- 原因：高频行为无衰减或去重失效。
- 应对：密度衰减 + 同日去重 + 并发上限2条强约束。

### 风险3：状态机复杂导致回归

- 原因：streak/delay/density 组合路径多。
- 应对：追踪器纯函数化 + 参数化单测矩阵。

### 风险4：性能开销增加

- 原因：每次触发都执行 matcher + tracker 计算。
- 应对：全部本地纯计算，避免远程依赖；复杂度保持 O(n)。

---

## 13. 可观测与埋点建议

## 13.1 日志字段（verbose 模式）

1. `matched_behavior_ids`
2. `selected_behavior_ids`
3. `dropped_by_density`
4. `dropped_by_dedupe`
5. `used_trend_ids`
6. `used_lite_ids`

## 13.2 可选云端埋点（后续）

可在 `annotations` 表新增 jsonb 字段（后续迭代）：

- `character_state_meta`

用于离线分析“哪些行为最影响批注效果”。

---

## 14. 验收清单（DoD）

1. B01-B21 在测试数据中可命中且返回预期角色文本。
2. streak/delay/density/dedupe/并发上限规则全部通过用例。
3. suggestion 与普通 annotation 输出格式稳定。
4. 开关关闭后可恢复旧逻辑。
5. `lint:all`、`test:unit`、`build` 全通过。
6. 文档更新完成：`api/README.md`、`src/api/README.md`、`src/store/README.md`、`docs/ARCHITECTURE.md`、`docs/CURRENT_TASK.md`、`docs/CHANGELOG.md`。

---

## 15. 实施顺序（建议按 commit 粒度）

1. `feat(annotation): add behavior map and matcher for B01-B21`
2. `feat(annotation): add event tracker for streak density and delay`
3. `feat(annotation): add character state builder and output meta`
4. `feat(annotation): wire character state into annotation request context`
5. `feat(annotation): inject character state U3 block into user prompt`
6. `test(annotation): cover matcher tracker builder and prompt integration`
7. `docs(annotation): sync architecture api store and current task`

---

## 16. 后续可演进方向（不阻塞本期）

1. 行为识别从关键词升级到 LLM 语义分类（保留关键词兜底）。
2. 基于用户历史偏好做行为优先级个性化。
3. U3 文本做“角色语气二次润色层”，进一步降低模板感。
4. 增加 A/B 实验：有/无 U3 的用户留存与互动差异。

---

## 17. 结论

该方案在当前代码架构中可低风险接入，重点在于：

1. 把复杂规则封装为可测的纯逻辑模块。
2. 把 U3 作为 prompt 上下文注入，不直接改 suggestion 协议。
3. 用功能开关与灰度保障可控上线。

按本方案执行，可直接进入开发实施阶段。
