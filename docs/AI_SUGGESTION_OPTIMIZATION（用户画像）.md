# AI 批注与建议系统优化方案

> 状态：RFC（征求意见稿）
> 日期：2026-03-31

---

## 零、移动端紧急问题（新增）

### 0.1 症状与复现

- 现象 1：手机端 AI 批注出现建议时，点击“开始 xxx”按钮有按压变色，但经常不真正开始。
- 现象 2：手机端聊天页上下滑动不够顺畅，偶发“发涩”和轻微掉帧。
- 对比：桌面端基本正常，问题集中在移动端浏览器/WebView 场景。

### 0.2 根因定位（代码级）

| 问题 | 代码位置 | 根因 |
|------|---------|------|
| 建议按钮点了无反应（待办建议） | `src/components/feedback/AIAnnotationBubble.tsx`、`src/features/growth/GrowthPage.tsx` | 目前流程是 `navigate('/growth')` 后 `setTimeout(300ms)` 再发 `window` 事件。移动端页面切换慢时，Growth 页监听器尚未挂载，事件被丢弃。 |
| 建议按钮偶发“只变色不触发” | `src/components/feedback/AIAnnotationBubble.tsx` | 仅绑定 `onClick`。移动端在滚动中、手指轻微位移、或 WebView click 合成差异下，`click` 可能被取消。 |
| 聊天滚动不顺畅 | `src/features/chat/ChatPage.tsx`、`src/features/chat/components/TimelineView.tsx`、`src/features/chat/components/EventCard.tsx`、`src/features/chat/components/MoodCard.tsx` | 聊天区是多层固定容器 + 内部滚动，同时列表卡片大量使用 `backdrop-filter` 毛玻璃。移动端 GPU 合成压力高，滚动时更容易掉帧。 |

### 0.3 修复原则

1. **跨页状态不要依赖“短延时事件”**：使用 store 持久化“待处理建议意图”，页面挂载后消费。
2. **移动端交互必须多通道兜底**：在 `onClick` 之外增加 `onPointerUp/onTouchEnd`，并做幂等防重入。
3. **移动端优先流畅性**：聊天列表卡片在移动端降级高成本视觉效果（尤其是 `backdrop-filter`）。
4. **保证行为可观测**：建议链路加轻量 telemetry，记录“点击 → 跳转 → 消费成功/失败”。

### 0.4 最小可行改造（建议先做）

#### A. 建议跨页可靠传递（P0）

- 新增 annotation store 字段：`pendingSuggestedTodoId`（或等价结构，含时间戳）。
- 点击建议时：先写入 store，再路由跳转；Growth 页挂载后读取并消费（高亮并清空）。
- 保留 `window` 事件仅作为兼容 fallback，不再作为主链路。

#### B. 建议按钮触发兜底（P0）

- 建议按钮补充 `onPointerUp`（必要时 `onTouchEnd`）触发同一 accept flow。
- 使用本地锁（如 `isSubmittingRef`）避免双触发。
- 在 flow 内部统一 guard：已接受或进行中直接返回。

#### C. 聊天滚动性能降级（P1）

- 移动端（`(hover: none) and (pointer: coarse)`）关闭或减弱卡片级 `backdrop-filter`。
- 降低阴影层级，避免每条卡片都触发重绘/合成。
- 滚动容器增加移动端优化参数：`-webkit-overflow-scrolling: touch`、`overscroll-behavior`。

#### D. 验证矩阵（P0/P1）

- iOS Safari / iOS WebView / Android Chrome 实机验证。
- 场景：快速点击建议、边滚动边点击建议、弱网/低性能模式下跳转。
- 指标：建议点击成功率、事件消费率、聊天滚动帧稳定性（主观 + telemetry）。

---

## 一、现状诊断

### 当前建议系统的数据流

```
用户事件（记录活动/心情/空闲检测等）
  → shouldGenerateAnnotation()  概率门控
  → detectSuggestionContextHints()  规则匹配（10 条硬编码规则）
  → buildStatusSummary()  构建当日快照
  → callAnnotationAPI()  发送给 LLM
  → LLM 输出批注 or 建议 JSON
```

### 核心问题：建议"机械感"的根源

| 问题 | 具体表现 | 原因 |
|------|---------|------|
| **信息面太窄** | 建议来来回回就是"去做待办"或"喝水休息" | LLM 只能看到当天活动 + 待办列表，没有更丰富的用户画像 |
| **规则是死的** | `entertainmentMinutes >= 180` → "建议一个实际行动" | `suggestionDetector.ts` 的 10 条规则是硬编码阈值，无法适应个体差异 |
| **无记忆** | 每次建议都像第一天认识用户 | 只有 `suggestionOutcomes`（接受/拒绝）用来调节频率，不用来调节内容 |
| **无节奏感** | 任何时段的建议口吻和类型都一样 | 没有区分"早起唤醒""午后低谷""睡前回顾"等场景的建议策略 |
| **没有正反馈循环** | 用户接受/拒绝建议后，系统只调节间隔，不调节方向 | `getAdaptiveMinInterval()` 只改频率，不改内容策略 |

---

## 二、优化方案：轻量级用户画像（不需要新增数据库表）

### 核心思路：利用已有数据做"隐式画像"

不需要让用户填问卷、不需要新建 `user_profile` 表。**已有数据足够推导出有用的画像**，关键是在建议生成时把这些信号喂给 LLM。

### 2.1 画像信号来源（全部可从现有数据提取）

| 信号维度 | 数据来源 | 提取方式 | 示例输出 |
|---------|---------|---------|---------|
| **作息节奏** | `annotations` 表的 `created_at` | 统计近 7 天活动时间分布 | "用户通常 10:00 开始活跃，23:00 后仍有活动" |
| **活动偏好** | `todayActivitiesList` 历史 | 按 `activityType` 统计频次 | "work 占 60%，entertainment 占 25%" |
| **高频活动** | 活动 `content` 字段 | 文本聚类/频次统计 | "常做：写代码、看视频、跑步" |
| **情绪基线** | `recentMoodMessages` 历史 | 关键词统计 + 情绪分布 | "偏正面，偶尔焦虑，深夜容易低落" |
| **建议偏好** | `suggestionOutcomes` + `suggestion` 内容 | 关联分析：哪类建议被接受 | "运动类建议接受率 80%，待办类只有 20%" |
| **待办完成率** | `todos` 表 | completed / total | "完成率约 40%，偏低" |
| **连续使用天数** | `login_days` (user_metadata) | 计算连续天数 | "连续使用 12 天" |

### 2.2 实现方案：`buildUserProfile()` 函数

在现有的 `buildStatusSummary.ts` 旁边新增一个 `buildUserProfile.ts`，**每次生成建议时调用**，产出一段文本摘要喂给 LLM prompt。

```typescript
// src/lib/buildUserProfile.ts

interface UserProfileInput {
  // 从 annotations store 取
  recentAnnotations: AIAnnotation[];  // 最近 50 条
  suggestionOutcomes: Array<{ timestamp: number; accepted: boolean; suggestion?: AnnotationSuggestion }>;

  // 从 todo store 取
  todos: Todo[];

  // 从 auth store 取
  loginDays: string[];

  // 当前
  now: Date;
}

interface UserProfile {
  profileSummary: string;        // 喂给 LLM 的文本
  preferredSuggestionTypes: string[];  // 用于过滤建议方向
  avoidSuggestionTypes: string[];      // 用于排除
}

export function buildUserProfile(input: UserProfileInput): UserProfile {
  // 1. 分析作息节奏
  // 2. 分析活动偏好
  // 3. 分析建议接受/拒绝模式
  // 4. 分析情绪基线
  // 5. 生成文本摘要
}
```

**输出示例**：

```
User profile (last 7 days):
- Active hours: usually 10:00-23:00, often active after midnight
- Top activities: coding (45%), reading (20%), exercise (15%)
- Mood baseline: mostly calm, occasional anxiety in evening
- Suggestion preference: accepted 4/5 activity suggestions, rejected 3/4 todo suggestions
- Todo completion: 35% completion rate, tends to ignore low-priority items
- Streak: 12 consecutive days
```

### 2.3 Prompt 改造：让 LLM 看到画像

修改 `buildSuggestionAwareUserPrompt()`，新增 `userProfile` 字段：

```diff
  return [
    hourText ? `当前时间：${hourText}` : null,
    `今日时间线：${todayActivitiesText}`,
    `最近心情：${recentMoodText}`,
+   `用户画像：\n${userProfile}`,
    `刚刚发生：[${eventType}] ${eventSummary}`,
    `状态摘要：\n${statusSummary || '无'}`,
    `情境提示：\n${hintsText}`,
    ...
  ]
```

**这一步改动最小、收益最大**。LLM 有了画像信息后，建议质量会自然提升。

---

## 三、进阶优化：让规则活起来

### 3.1 动态阈值替代硬编码

当前 `suggestionDetector.ts` 的问题是阈值写死了：

```typescript
// 当前：一刀切
if (entertainmentMinutes >= 180) {
  candidates.push({ priority: 40, hint: '...' });
}
```

优化方向：**阈值应该基于用户画像动态调整**。

```typescript
// 优化后：基于用户画像
const userAvgEntertainment = profile.avgDailyEntertainmentMinutes; // 比如用户平均每天 120 分钟
const threshold = Math.max(userAvgEntertainment * 1.5, 120); // 超过个人平均值 50% 才触发

if (entertainmentMinutes >= threshold) {
  candidates.push({ priority: 40, hint: '...' });
}
```

### 3.2 时段感知建议策略

新增一个 `getSuggestionStrategy()` 函数，根据时段 + 用户状态返回不同的建议方向：

| 时段 | 用户状态 | 建议策略 |
|------|---------|---------|
| 早晨 (6-10) | 刚开始 | 温和唤醒，不推待办，可推一个轻启动活动 |
| 上午 (10-12) | 已有产出 | 可推具体待办，语气鼓励 |
| 午后 (13-15) | 低谷期 | 推休息/散步，不推高强度任务 |
| 下午 (15-18) | 还在工作 | 推待办冲刺，或提醒收尾 |
| 晚间 (18-22) | 放松中 | 推轻松活动，推日报回顾 |
| 深夜 (22+) | 还在用 | 推入睡准备，不推任务 |

这个策略表可以作为 context hint 的一部分传给 LLM，比硬编码在代码里更灵活。

### 3.3 建议内容反馈闭环

当前 `recordSuggestionOutcome()` 只记录 accepted/rejected，但不关联建议的具体内容。

优化：在 `suggestionOutcomes` 中保存建议类型，用于画像构建。

```typescript
// 当前
suggestionOutcomes: Array<{ timestamp: number; accepted: boolean }>

// 优化后
suggestionOutcomes: Array<{
  timestamp: number;
  accepted: boolean;
  suggestionType: 'activity' | 'todo';
  category?: string;        // todo 的 category 或 activity 的类型
  activityName?: string;    // 具体活动名
}>
```

这样 `buildUserProfile()` 就能分析出"用户更喜欢什么类型的建议"。

---

## 四、长期画像的成本评估

### 如果要做"真正的"长期画像

| 方案 | 复杂度 | 改动量 | 收益 |
|------|--------|-------|------|
| **A. 纯前端计算画像**（推荐） | 低 | 新增 1 个 `buildUserProfile.ts` + 改 prompt | 高。零后端改动，立即可用 |
| **B. 后端聚合画像** | 中 | 新增 Supabase Edge Function 做定时聚合 | 中。数据更准确，但需要新基础设施 |
| **C. 独立画像服务** | 高 | 新增微服务 + 数据管道 | 低（当前阶段过度设计） |
| **D. LLM 自主画像** | 中 | 在 diary API 中让 LLM 总结用户特征并存储 | 中。有创意但不可控 |

**推荐路径：先 A，再逐步演进到 B**。

### 方案 A 的具体实现步骤

1. **新增 `src/lib/buildUserProfile.ts`**（~100 行）
   - 从 `useAnnotationStore` 取最近 50 条批注
   - 从 `useTodoStore` 取待办完成率
   - 从 `suggestionOutcomes` 分析偏好
   - 输出文本摘要

2. **修改 `useAnnotationStore.ts`**（~15 行改动）
   - 在 `triggerAnnotation` 中调用 `buildUserProfile()`
   - 将画像摘要传入 `callAnnotationAPI` 的 `userContext`

3. **修改 `annotation-handler.ts`**（~5 行改动）
   - 将 `userProfile` 透传给 `buildSuggestionAwareUserPrompt()`

4. **修改 `annotation-prompts.ts`**（~10 行改动）
   - 在 prompt 模板中插入画像段落

5. **扩展 `suggestionOutcomes` 结构**（~20 行改动）
   - 记录建议类型和具体内容
   - 在 `recordSuggestionOutcome` 中保存更多字段

**总改动量：约 150 行新代码 + 50 行修改。不需要数据库迁移，不需要新 API。**

---

## 五、建议质量提升的其他快速优化

### 5.1 建议多样性：不只是"去做待办"

当前建议只有两种 type：`activity` 和 `todo`。可以扩展：

| 建议类型 | 示例 | 触发条件 |
|---------|------|---------|
| `todo` | "先把那个报告写了" | 有到期/逾期待办 |
| `activity` | "去散个步" | 久坐/overwork |
| `reflection` | "今天做了不少事，回头看看感觉如何？" | 晚间 + 活动较多 |
| `social` | "有没有想找人聊聊？" | 连续低情绪 |
| `celebration` | "今天完成了 5 件事，了不起！" | 完成数超过平均值 |
| `routine` | "按照你的习惯，这个时间通常会..." | 画像显示固定作息 |

前端不需要改 UI——这些仍然通过 `content` 文本呈现，只是 LLM 的建议方向更多样了。

### 5.2 Prompt 优化：给 LLM 更好的建议框架

当前 prompt 对建议的指导太弱，基本只说了"如果你觉得该建议就输出 JSON"。可以在 system prompt 中加入建议策略框架：

```
When generating a suggestion, follow this decision tree:
1. Is the user in emotional distress? → Offer comfort action, NOT a task
2. Is it near bedtime? → Suggest wind-down, NOT productivity
3. Has the user been idle 2+ hours? → Suggest a tiny restart, NOT a big task
4. Is there an overdue todo the user cares about? → Nudge gently
5. Has the user been very productive? → Celebrate, then suggest a break
6. Default: suggest something aligned with user's frequent activities
```

### 5.3 消除"空洞感"：建议要包含具体细节

当前的 fallback 建议是 `"先做一个两分钟的小动作：喝水并走一走 🌿"`——这很 generic。

优化方向：让建议引用用户的具体数据。

```
// 不好：
"休息一下吧 🌿"

// 好：
"写了 3 小时代码了，去阳台站 5 分钟？上次你跑步后心情不错 🌿"
```

实现方式：在 prompt 中告诉 LLM "引用用户画像中的具体活动和偏好"。

---

## 六、实施优先级

| 优先级 | 任务 | 预估工作量 | 预期效果 |
|--------|------|-----------|---------|
| **P0** | 移动端建议链路改为 store 消费（替代 `setTimeout+event` 主链路） | 1-2 小时 | 解决“点了没反应”主因，显著提升手机端成功率 |
| **P0** | 建议按钮增加 `pointer/touch` 兜底与防重入 | 0.5-1 小时 | 解决“按钮变色但不触发” |
| **P0** | 新增 `buildUserProfile.ts` + 改 prompt | 2-3 小时 | 建议立即变得更个性化 |
| **P0** | 扩展 `suggestionOutcomes` 记录建议类型 | 1 小时 | 为画像提供更精准的偏好数据 |
| **P1** | 聊天移动端视觉性能降级（减少 blur/shadow） | 1-2 小时 | 滑动更顺畅，减少掉帧 |
| **P1** | 时段感知建议策略 | 1-2 小时 | 消除"任何时段建议都一样"的问题 |
| **P1** | 优化 system prompt 建议决策框架 | 1 小时 | 减少不合时宜的建议 |
| **P2** | 动态阈值替代硬编码 | 2 小时 | 适应不同用户的行为模式 |
| **P2** | 扩展建议类型（reflection/celebration 等） | 1 小时 | 增加建议多样性 |
| **P3** | 后端聚合画像（方案 B） | 1-2 天 | 更准确的长期画像 |

---

## 七、总结

**核心观点**：不需要建一个复杂的用户画像系统。**把已有数据更好地组织成文本，喂给 LLM，就能大幅提升建议质量**。

关键改动：
1. 修复移动端建议执行链路 —— 去除“短延时事件”单点依赖，改为 store 可恢复消费
2. 为建议按钮增加移动端触发兜底 —— 避免仅有视觉反馈
3. 新增 `buildUserProfile()` —— 从已有数据提取画像信号
4. 改 prompt —— 让 LLM 能看到画像
5. 扩展 outcome 记录 —— 让画像越来越准
6. 加入时段策略 —— 让建议有节奏感

以上改动完成后，既能提升建议“内容质量”，也能修复移动端“能点但不生效”和“滑动不顺畅”的核心体验问题。

---

## 八、补充方案（第一层：先解决“机械建议”）

> 目标：2 周内把 suggestion 从“待办直推”升级为“场景化、可执行、不过度重复”。

### 8.1 设计原则（与本 RFC 的关系）

- 保留本 RFC 的核心方向（用户画像 + prompt 升级），但先把“建议决策”从 LLM 自由发挥改成“规则选候选 + LLM 润色”。
- 第一层不依赖长期画像表，不新增复杂基础设施；先用现有上下文和近 7 天反馈做轻量策略。
- LLM 在第一层只负责“怎么说”，不负责“推什么”。

### 8.2 新决策链路（替代现状）

当前：

```text
context -> buildSuggestionAwareUserPrompt -> LLM 决定是否建议 + 建议类型
```

第一层改为：

```text
context -> generateCandidates() -> rankCandidates() -> chooseTopOrFallback()
       -> buildSuggestionPolishPrompt(selected) -> LLM 只润色文案
```

### 8.3 候选池（固定 5 类，先不扩 UI）

- `todo_push`：推进一个待办（倾向“临近截止 + 可立即启动”）
- `micro_start`：2-5 分钟微启动（降低行动门槛）
- `recovery`：恢复类（喝水、起身、呼吸、眼休息）
- `emotion_regulate`：情绪调节（连续负面情绪时）
- `defer_plan`：延后决策（深夜/高压场景允许“先缓冲”）

建议候选结构：

```ts
type SuggestionCandidate = {
  id: string;
  type: 'todo_push' | 'micro_start' | 'recovery' | 'emotion_regulate' | 'defer_plan';
  actionLabel: string;
  activityName?: string;
  todoId?: string;
  todoTitle?: string;
  reasonTags: string[];
  effort: 'tiny' | 'small' | 'normal';
};
```

### 8.4 打分规则（反机械关键）

基础分（可调）：

- `recovery`: 40
- `todo_push`: 35
- `micro_start`: 34
- `emotion_regulate`: 38
- `defer_plan`: 30

场景加分：

- 连续负面情绪：`emotion_regulate +25`
- 连续 work/study 120 分钟以上：`recovery +20`
- 饭点 + 连续专注：`recovery +15`
- 待办 2 小时内到期：`todo_push +20`
- 深夜（23:00-05:59）：`recovery/defer +20`，`todo_push -15`

反重复惩罚：

- 最近 3 次 suggestion 同类型：`-25`
- 同 todoId 重复推荐：`-35`
- actionLabel 文案近似重复：`-15`

输出阈值：

- `Top1 < 45`：不出 suggestion，回落普通 annotation

### 8.5 Prompt 升级（LLM 仅润色）

新增 `buildSuggestionPolishPrompt()`（中/英/意），硬性要求：

- 不允许修改 `type/todoId/activityName`；
- 仅允许生成 `content` 和优化 `actionLabel`；
- `content` 仅 1 句，句末且仅 1 个 emoji；
- 非法 JSON 直接走模板兜底。

### 8.6 代码落点（对应现有结构）

- 新增：`src/server/suggestion-candidates.ts`
- 修改：`src/server/annotation-handler.ts`（suggestion 分支接入候选与打分）
- 修改：`src/server/annotation-prompts.ts`（新增 polish prompt）
- 复用：`src/lib/suggestionDetector.ts`（现有 hints 作为 `reasonTags`）
- 轻改：`src/store/useAnnotationStore.ts`（补传最近 suggestion 类型/todoId 供反重复）

### 8.7 第一层验收指标（7 天）

- suggestion 类型分布：`todo` 占比从高位回落到 < 50%
- 连续重复建议率下降 >= 40%
- 建议点击率不下降（理想是提升）
- `X/超时`关闭率下降（尤其夜间场景）

---

## 九、对本 RFC 的建议与观点

### 9.1 我认同的部分

- 方向正确：先做轻量画像，不急着上独立画像服务。
- 工程判断正确：先修移动端可靠性，再谈建议质量上限。
- 数据思路正确：`suggestionOutcomes` 不是只控频率，应进入内容决策。

### 9.2 建议调整的部分（避免“只改 prompt”）

1. **不要把“画像文本注入 prompt”当主解**
   - 只改 prompt 的收益不稳定，模型仍会走最省力路径（常回到 todo）。
   - 建议将“选什么建议”前置到代码侧决策，prompt 只润色表达。

2. **“不新增表”可作为阶段策略，不应是长期约束**
   - 第一层确实可不加表；
   - 但若要做可靠漏斗（show/click/close/timeout）和跨设备画像，后续建议至少补事件表或统一 telemetry 口径。

3. **建议类型扩展应先“内部类型”再“外部协议”**
   - 前端协议仍可保持 `activity|todo`；
   - 内部先引入 `todo_push/micro_start/recovery/...` 作为策略类型，降低改动风险。

4. **把“不给建议”明确成一等结果**
   - 低分场景应回落普通批注，避免“为了建议而建议”。

### 9.3 推荐实施顺序（与本文合并后的最终路径）

- **P0（本周）**：移动端链路修复 + 候选池与打分落地 + LLM 润色模式
- **P1（下周）**：轻量画像摘要接入 + 时段策略 + 反重复强化
- **P2（后续）**：完整漏斗埋点（show/click/close/timeout）+ 动态阈值个体化
- **P3（可选）**：后端聚合画像（跨设备一致）

### 9.4 最终观点

“机械感”本质不是文案问题，而是决策问题。先把建议决策从“LLM 直接拍板”改成“系统先选方向，LLM 再说人话”，再叠加用户画像，建议质量会稳定提升，且可控、可验证、可迭代。
