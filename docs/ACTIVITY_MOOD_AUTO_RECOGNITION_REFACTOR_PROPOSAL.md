# DOC-DEPS: LLM.md -> docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md -> src/features/chat/README.md
# 活动 / 心情自动识别重构讨论稿

- 文档版本: v0.2
- 状态: Discussion Draft
- 最后更新: 2026-03-10
- 适用范围: `src/services/input`、`src/store/chatActions.ts`、`src/store/useChatStore.ts`
- 目标读者: 产品、前端、状态层开发

## 1. 结论摘要

当前自动识别问题的主要来源不是单一词典不足，而是三层问题叠加：

1. 约 60% 是写入链路设计问题
2. 约 30% 是活动识别结构过弱
3. 约 10% 才是词典覆盖不足

因此正确的重构顺序应为：

1. 先修写入链路，保证分类结果不会在落库时被压扁或误关联
2. 再补活动识别结构，优先补完成态、进行态、社交/生活活动
3. 再收紧 mood 规则，去掉过宽前缀
4. 再补“未来 / 计划 / 未发生事件”拦截层
5. 最后收紧 `mood_about_last_activity`，从“推测性关联”改为“证据性关联”

这个顺序的原因很简单：

- 如果链路层还会把 `standalone_mood` 错挂到最近活动上，那么前面的分类再准，最后也会写错
- 当前 gold 评估里，主要错配是 `new_activity -> standalone_mood` 和 `activity_with_mood -> standalone_mood`
- 这说明现在首要任务是“避免错误写入”和“补强活动识别”，不是继续往词典里堆词

## 2. 当前实现的问题

### 2.1 分类层和写入层没有打通

当前分类器已经能区分四类结果：

- `new_activity`
- `activity_with_mood`
- `standalone_mood`
- `mood_about_last_activity`

但写入层没有按这四类分流。

当前主链路大致是：

```ts
classification = classifyLiveInput(content, context)

if (classification.kind === 'mood') {
  sendMood(content)
} else {
  sendMessage(content, { mode: 'record' })
}
```

这会导致：

1. `standalone_mood` 和 `mood_about_last_activity` 都走同一个 `sendMood()`
2. `sendMood()` 内部又会把 mood 默认关联到“今天最后一条活动”
3. 最终结果是：就算前面判对了 `standalone_mood`，后面依然可能污染最近活动

典型例子：

- 用户输入: `好累`
- 分类器结果: `standalone_mood`
- 当前写入行为: 新建 mood 消息，同时把 `好累` 写进今天最后一条活动的 `moodNote`

这个问题属于架构闭环缺失，不是词典问题。

### 2.2 活动识别过度依赖静态词典

当前活动识别主要依赖：

- `ZH_ACTIVITY_STRONG_PHRASES`
- `ZH_ACTIVITY_VERBS`
- `ZH_ACTIVITY_SINGLE_VERB_PATTERNS`
- `ZH_ACTIVITY_OBJECTS`

这套规则对“标准活动短语”有效，但对真实输入中的变体不够强，尤其漏掉：

1. 完成态
2. 进行态
3. 社交/生活活动
4. 口语化活动表达
5. 中英混合活动表达

所以很多真实活动被错判成 `standalone_mood`。

### 2.3 mood 规则里存在过宽吸附

当前以下规则过宽：

- `^好.+`
- `^很.+`
- `真.+`
- `心情.+`
- mood 词表里的单字 `难`

这些规则会把很多并不是纯情绪表达的句子也拉进 mood。

### 2.4 `mood_about_last_activity` 现在太激进

当前存在一条捷径：

```ts
!hasActivity && hasEvaluation && text.length <= 5
```

只要最近存在活动，短句里有情绪/评价，就可能直接挂到上一条活动。

这会把以下全局状态误解释成“对上一条活动的评价”：

- `好累`
- `真烦`
- `崩溃`
- `无语`

这里缺的是“证据”，而不是“推测”。

### 2.5 最新纠错后的情绪残留会污染报表

当前链路里，mood 消息在某些路径下会把 `moodNote`，甚至 `activityMood`，写回最近 activity。

但“最新消息 `mood -> activity` 纠错”如果只改消息本身，而没有同步清理那条 activity 上由该 mood 消息派生出来的：

- `activityMood`
- `moodNote`
- 对应的 source / origin 元信息

那么用户虽然在时间线上看见纠错成功，报表层仍然会继续读取旧的 `activityMood`，最终形成脏统计。

这个问题属于写入一致性问题，优先级应高于继续调词典。

### 2.6 需要清理的是 `isMoodMode`，不是 `message.isMood`

这里必须明确区分两件事：

- `isMoodMode`：旧输入框的全局手动模式状态
- `message.isMood`：单条消息本身是否为 mood 记录的语义字段

本轮要退出主发送链路的是前者，不是后者。
`message.isMood` 仍然必须保留给列表渲染、报表过滤和纠错语义使用。

## 3. 当前基线

2026-03-10 本地 gold 评估基线：

- `kind_accuracy = 77.98%`
- `internal_accuracy = 76.19%`
- `new_activity recall = 58.49%`
- `activity_with_mood recall = 42.31%`
- `standalone_mood recall = 97.37%`
- `mood_about_last_activity recall = 92.31%`

当前主要错配：

1. `new_activity -> standalone_mood`
2. `activity_with_mood -> standalone_mood`

这说明系统当前不是“心情判得不准”，而是“活动漏得太多”。

## 4. 重构原则

### 4.1 分类结果必须原样传到写入层

分类器输出不能在 dispatch 阶段被压扁成 `activity / mood` 两类。

写入层必须保留以下语义：

- 纯 mood，但不关联 activity
- mood，且明确关联某条 activity
- activity，且附带 mood
- 纯 activity

### 4.2 关联必须基于证据

只有在存在明确证据时，才允许把一句 mood 绑定到最近活动。

允许的证据包括：

1. 明确提到上一条活动
2. 明确使用完成态短语
3. 明确评价上一活动的结果或过程

不允许再使用“短句 + 有情绪 + 最近有活动”这种弱证据直接挂载。

### 4.3 规则要结构化，而不是只扩词典

优先增加“结构化检测函数”，而不是继续把所有变体塞进一个大词表。

目标是：

- completion detector
- ongoing detector
- social/life detector
- planned/future detector

### 4.4 默认宁可少关联，不要误关联

如果系统拿不准一句 mood 是否在评价某条 activity，默认当作 `standalone_mood` 处理。

误少挂一次，用户损失较小。
误挂到错误 activity，会直接污染时间线和 mood 统计。

## 5. 目标写入契约

### 5.1 推荐保留的分类结果

```ts
type InternalLiveInputKind =
  | 'new_activity'
  | 'activity_with_mood'
  | 'standalone_mood'
  | 'mood_about_last_activity'
```

这四类仍然可以作为 V1 主结果，不必为了本轮重构马上新增更多持久化类型。

### 5.2 写入层必须按 internalKind 分流

推荐改为：

```ts
switch (classification.internalKind) {
  case 'standalone_mood':
    return createStandaloneMoodMessage(content, resolveOngoingActivityId(context))

  case 'mood_about_last_activity':
    return createMoodMessageLinkedToActivity(content, classification.relatedActivityId)

  case 'activity_with_mood':
    return createActivityWithMood(content, classification.extractedMood, classification.moodNote)

  case 'new_activity':
    return createActivity(content)
}
```

### 5.3 `sendMood()` 不应再隐式挂到“今天最后一条活动”

推荐把现有 `sendMood()` 改成显式 API：

```ts
type SendMoodOptions = {
  relatedActivityId?: string
}

sendMood(content: string, options?: SendMoodOptions)
```

语义要求：

1. `options.relatedActivityId` 为空时，只创建 mood 消息，不关联任何 activity
2. `options.relatedActivityId` 存在时，才把 mood 写到指定 activity
3. dispatch 层如果发现最近 activity 仍在进行中，可以把这个 ongoing activity id 显式传进来；写入层本身不再猜“今天最后一条活动”
4. 不再使用“今天最后一条活动”作为默认挂载对象

这是本轮重构的第一优先级。

### 5.4 `mood_about_last_activity` 只允许定向挂载

`mood_about_last_activity` 的关联目标必须来自分类器给出的 `relatedActivityId`。

禁止在写入层再次自行猜测：

- 不允许 fallback 到“最新 activity”
- 不允许 fallback 到“今天最后一条 activity”
- 不允许忽略 `relatedActivityId`

### 5.5 `standalone_mood` 在 ongoing context 下允许显式挂载

这里要区分“进行中的 activity”与“已经结束的 activity”：

1. 如果 `recentActivity.isOngoing === true`，则 `standalone_mood` 允许作为一条独立 mood 消息创建，同时显式把 `relatedActivityId = recentActivity.id` 传给 `sendMood()`，表示“活动进行中的心情”。
2. 如果最近 activity 已经结束，`standalone_mood` 不允许 fallback 挂到历史 activity；这时只有 `mood_about_last_activity` 才允许挂载。
3. 这是写入层规则，不改变 `internalKind`；消息本身仍然是 mood 消息，仍然依赖 `message.isMood`。
4. ongoing activity 的隐式挂载不等于恢复旧的 `isMoodMode`；它只是 store / service 层依据上下文做出的显式写入决策。

### 5.6 mood 附着元信息必须可追溯

仅新增一个 `MoodSource = 'auto' | 'manual'` 并不够。
写入层还必须能回答两个问题：

1. 当前 activity 上的 `activityMood` / `moodNote` 是自动还是手动产生的？
2. 它们是由哪一条 mood 消息写进去的？

最小建议状态：

```ts
type MoodSource = 'auto' | 'manual'

type MoodAttachmentMeta = {
  source: MoodSource
  linkedMoodMessageId?: string
}

activityMoodMeta[activityId]?: MoodAttachmentMeta
moodNoteMeta[activityId]?: MoodAttachmentMeta
```

最小行为要求：

1. 用户通过 mood picker 手动修改 tag / note 时，source 必须改为 `manual`。
2. 系统通过 `activity_with_mood`、`standalone_mood` 挂载、`mood_about_last_activity` 挂载自动写入时，source 必须为 `auto`；若写入来源是一条 mood 消息，还必须记录 `linkedMoodMessageId`。
3. 最新消息 `mood -> activity` 纠错时，如果某条 activity 上的 tag / note 是由这条 mood 消息自动写入的，则必须一起清理。
4. 后续自动重算只允许覆盖 `source === 'auto'` 的值，不能覆盖 `manual`。

## 6. 分类器的目标顺序

这里要区分两个顺序：

1. 实现优先级
2. 运行时判定顺序

实现优先级见第 10 节。
运行时建议顺序如下：

```ts
normalize(text)

if (isFutureOrPlannedActivity(text)) {
  return standalone_mood_like_result
}

if (isMoodAboutLastActivity(text, context)) {
  return mood_about_last_activity
}

if (isActivityWithMood(text)) {
  return activity_with_mood
}

if (isActivity(text)) {
  return new_activity
}

return standalone_mood
```

注意：

- “未来 / 计划 / 未发生”在运行时应该先拦
- 但在工程实施优先级上，链路修复仍然先做

## 7. 活动识别应改为结构化检测

### 7.1 完成态检测

应新增独立函数：

```ts
detectActivityCompletion(text): ActivityEvidence | null
```

主要目标是识别：

- 刚吃完饭
- 刚刚开完会
- 已经写完周报了
- 下课了
- 做完了
- 忙完了

建议识别思路：

1. 先检测完成态壳子
2. 再检测活动主体
3. 再判断是否带有 mood/evaluation

建议模式示例：

- `刚.*完`
- `刚刚.*完`
- `已经.*完`
- `.*完了`
- `.*结束了`
- `.*下课了`
- `.*开完了`
- `.*写完了`

但这些模式不能裸跑全句，必须和活动主体联合判断，否则会引入大量误判。

建议返回结构：

```ts
type ActivityEvidence = {
  source: 'completion' | 'ongoing' | 'social' | 'life' | 'lexicon'
  activityCue?: string
  hasMoodSignal: boolean
  extractedMood?: MoodKey
  evidenceTokens: string[]
}
```

### 7.2 进行态检测

应新增独立函数：

```ts
detectActivityOngoing(text): ActivityEvidence | null
```

主要目标是识别：

- 视频通话中
- 开会中
- 学习中
- 正在写报告
- 在开会
- 刚在搞

建议模式示例：

- `正在X`
- `在X`
- `X中`
- `刚在X`

这里的关键不是单条 regex，而是把“进行态壳子”和“活动主体”分开。

### 7.3 社交 / 生活活动检测

应新增两个域：

- `SOCIAL_ACTIVITY_PATTERNS`
- `LIFE_ACTIVITY_PATTERNS`

优先覆盖：

- 和朋友聚餐
- 跟同学聊天
- 打电话
- 视频通话
- 见客户
- 约饭
- 逛街
- 出门
- 到公司
- 回家
- 睡觉

这类句子目前被严重低估，但它们是真实高频活动，不应继续混在“学习 / 工作活动词典”里零碎补词。

### 7.4 推荐的活动检测层次

建议 `isActivity(text)` 由多层 evidence 组成：

```ts
detectActivityCompletion(text)
?? detectActivityOngoing(text)
?? detectSocialActivity(text)
?? detectLifeActivity(text)
?? detectLexiconActivity(text)
```

只有最后一层才是当前这种词典/短语匹配。

## 8. mood 规则要从“宽前缀”改成“明确情绪表达”

### 8.1 建议移除或降权的规则

以下规则建议删除或至少不再单独作为强 mood 证据：

- `^好.+`
- `^很.+`
- `真.+`
- `心情.+`
- 单字 `难`

原因：

- 中文里这些前缀太泛
- 它们既可能表达情绪，也可能表达意图、评价、计划、叙述

### 8.2 推荐改法

把“宽前缀规则”换成“明确情绪短语规则”。

例如保留这类模式：

- `好累`
- `好烦`
- `好爽`
- `好焦虑`
- `好难受`
- `很焦虑`
- `很烦`
- `真烦`
- `真难受`
- `状态很差`
- `没精神`

也就是说：

- 不再用“前缀像情绪”来推断 mood
- 改成“表达本身就是情绪短语”才算强 mood 信号

### 8.3 `心情` 类表达也应收紧

`心情.+` 过宽。

建议改成更明确的表达，例如：

- `心情很差`
- `心情不好`
- `心情低落`
- `心情不错`

而不是只要出现 `心情` 就直接加分。

## 9. 未来 / 计划 / 未发生事件应单独拦截

### 9.1 问题定义

当前 `去` 被视为强新活动切换词，但系统没有单独的“未发生事件层”。

所以像下面这些句子会误进活动：

- 等下去吃饭
- 待会去开会
- 一会儿学习
- 晚点做作业
- 明天去上课
- 准备去跑步
- 想去健身

### 9.2 建议新增判断层

新增：

```ts
isFutureOrPlannedActivity(text): boolean
```

建议优先识别：

- `等下`
- `待会`
- `一会儿`
- `晚点`
- `明天`
- `准备`
- `想去`
- `要去`

### 9.3 V1 处理建议

本轮为了不扩大数据模型，建议先把这类输入拦出“真实活动”判定链。

V1 可选策略：

1. 暂时归为 `standalone_mood` 风格处理，不关联任何 activity
2. 或保留为后续扩展点，未来新增 `planned_or_future_activity`

会议建议：

- 本轮先不引入新的持久化类型
- 先把它们从“真实活动写入”里挡掉

## 10. `mood_about_last_activity` 应改成证据性关联

### 10.1 当前问题

当前逻辑里，短句只要：

- 没有活动信号
- 有评价/情绪
- 长度 <= 5

在存在 recent activity 时就可能被挂到上一条活动。

这个条件过弱。

### 10.2 建议的新判定原则

`mood_about_last_activity` 必须至少满足以下之一：

1. 明确提到了上一条活动
2. 明确使用完成态短语
3. 明确在评价上一活动结果

建议将判定改成：

```ts
hasRecentContext
&& hasEvaluation
&& hasEvidenceReferencingLastActivity
&& !hasFutureOrPlannedSignal
&& !hasStrongNewActivity
```

其中：

```ts
hasEvidenceReferencingLastActivity =
  mentionsRecentActivityKeyword
  || hasCompletionReference
  || hasExplicitDeicticReference
```

### 10.3 应移除的捷径

建议删除：

```ts
!hasActivity && hasEvaluation && text.length <= 5
```

因为它本质上是“推测性关联”，不是“证据性关联”。

### 10.4 示例

应判为 `mood_about_last_activity`：

- `吃饭好开心`，最近活动为 `吃饭`
- `刚才那个会真烦`，最近活动为 `开会`
- `终于做完这件事情了，好开心`

应判为 `standalone_mood`：

- `好累`
- `真烦`
- `崩溃`
- `无语`

即使最近有 activity，也不能仅凭“最近有 activity”就自动挂到已结束的历史 activity。
如果 `recentActivity.isOngoing === true`，则允许在写入层把这条 `standalone_mood` 显式挂到这条进行中的 activity，但分类结果本身仍然保持 `standalone_mood`。

## 11. 推荐实施顺序

### Phase 1: 修写入链路

目标：

1. 按 `internalKind` 显式分流
2. `standalone_mood` 在 ongoing activity 存在时允许显式挂到该 activity；如果没有 ongoing activity，则必须保持独立 mood 记录
3. `mood_about_last_activity` 只定向关联 `relatedActivityId`
4. `sendMood()` 改为接受可选的 `relatedActivityId` 参数：`sendMood(content, { relatedActivityId?: string })`。写入层不再隐式 fallback 到“今天最后一条 activity”
5. mood 纠错回退时，必须同步清理由该消息派生出来的 `activityMood` / `moodNote` / source 元信息

这是第一优先级，也是上线前必须先完成的一步。它从底层阻断了“错误 fallback 挂历史 activity”和“纠错后仍残留脏 mood 统计”这两类问题。

### Phase 2: 补活动识别结构

目标：

1. 新增 `detectActivityCompletion`
2. 新增 `detectActivityOngoing`
3. 新增社交/生活活动域
4. 把活动识别从“堆词典”改成“结构化 evidence”

预期收益：

- 优先提高 `new_activity`
- 同时提升 `activity_with_mood`

### Phase 3: 收紧 mood 规则

目标：

1. 删除过宽前缀
2. 改成明确情绪短语
3. 去掉单字级高风险 mood 信号

预期收益：

- 降低活动句被心情吸走
- 降低非情绪句误判

### Phase 4: 增加未来 / 计划拦截层

目标：

1. 在活动判定前先挡掉未发生事件
2. 防止 `去` / `要` / `等下` 这类句式误记为真实活动

### Phase 5: 收紧 `mood_about_last_activity`

目标：

1. **废弃短句推测性挂载捷径**：删除代码中的 `(!hasActivity && hasEvaluation && text.length <= 5)` 判断逻辑。
2. **明确 ongoing attach 只是写入层规则，不是 `mood_about_last_activity` 的分类证据**：进行中的 activity 可以吸收 `standalone_mood`，但这不应把该输入改判为 `mood_about_last_activity`。
3. **改用“证据性关联”作为已结束 activity 的挂载标准**：如果上一条活动已经结束，只有在用户输入中存在明确提及上个活动的证据（包含 `referencesLastActivity` 等信号）时，系统才允许将其挂载过去。否则，均记为独立的 `standalone_mood`。

预期收益：

- 完美处理“上一条活动还在进行中，我顺口发句好累”的直觉场景（正确关联）。
- 彻底解决“上一条活动早就结了，我发句好累竟然成了那个活动好累”的污染灾难（拦截为纯心情）。
- 降低从其他渠道溢出的错误 moodNote 绑定。

## 12. 测试与验收建议

### 12.1 Phase 1 必测

1. `standalone_mood` + ongoing activity 时，只允许挂到这条 ongoing activity
2. `standalone_mood` + 无 ongoing activity 时，不关联任何 activity
3. `mood_about_last_activity` 只挂到 `relatedActivityId`
4. `relatedActivityId` 缺失时，不允许 fallback 到最新 activity
5. `activity_with_mood` 会创建 activity，并同步写入 mood
6. `new_activity` 仍走正常 activity 链路
7. 最新消息 `mood -> activity` 纠错时，会同步清理由该 mood 消息自动写入的 `activityMood` / `moodNote` / source 元信息

### 12.2 分类回归样例

活动完成态：

- `刚吃完饭`
- `刚刚开完会`
- `已经写完周报了`
- `下课了`
- `忙完了`

活动进行态：

- `视频通话中`
- `开会中`
- `正在写报告`
- `在开会`

社交 / 生活活动：

- `和朋友聚餐`
- `跟同学聊天`
- `打电话`
- `见客户`
- `约饭`
- `出门了`
- `到公司了`
- `睡觉了`

活动 + 情绪：

- `开了两小时会好累`
- `背了两小时单词好烦`
- `跑了5公里感觉不错`
- `和朋友逛街很开心`

未来 / 计划：

- `等下去吃饭`
- `待会去开会`
- `明天去上课`
- `准备去跑步`
- `想去健身`

最近活动评价：

- `吃饭好开心`
- `刚才那个会真烦`
- `终于做完这件事情了，好开心`
- `这种感觉好久没有了`

纯 mood：

- `好累`
- `真烦`
- `崩溃`
- `无语`
- `没精神`

写入层关联回归：

- 最近 activity `开会` 仍在进行中，输入 `好累`
- 最近 activity `开会` 已结束，输入 `好累`
- 最近 activity `写方案` 仍在进行中，输入 `真烦`
- 把一条刚刚挂到 activity 上的 mood 消息改回 activity

### 12.3 验收指标建议

重构完成后，建议至少达到：

1. 不再出现 `standalone_mood` 自动污染已结束 activity 的链路错误
2. `new_activity recall` 显著高于当前 58.49%
3. `activity_with_mood recall` 显著高于当前 42.31%
4. `mood_about_last_activity` 的挂载必须全部可解释
5. 最新消息纠错后，report 统计不再读取已失效的 `activityMood`

## 13. 会议待决策问题

1. 本轮是否只修链路和分类结构，不新增新的持久化类型
2. “未来 / 计划句”本轮是否暂时落为不关联 activity 的自由文本
3. `sendMood()` 是否允许继续保留兼容层，还是直接改成显式关联 API
4. `mood_about_last_activity` 的时间窗口是否仍然保持 30 分钟
5. 是否把社交/生活活动单独维护为独立词域，而不是混入现有 activity 词典
6. 是否把 mood 附着的 source / `linkedMoodMessageId` 明确建模为独立本地状态

## 14. 推荐决议

如果明天会议只希望形成一个可执行结论，我建议直接拍板以下五点：

1. 先修写入链路：`standalone_mood` 只允许挂 ongoing activity，禁止自动挂已结束的最近 activity
2. dispatch 必须按 `internalKind` 分流，不能只按 `kind`
3. 活动识别下一轮按“完成态 / 进行态 / 社交生活活动”三个结构补
4. mood 规则从“宽前缀”改为“明确情绪短语”
5. `mood_about_last_activity` 删除“短句推测性挂载”，改成“证据性关联”，同时保留“进行中 activity 可吸收 standalone mood”的写入层规则

这五点确定后，后续实现顺序和测试拆分会比较清晰，不容易再陷入“继续堆词典”的局部修补。
