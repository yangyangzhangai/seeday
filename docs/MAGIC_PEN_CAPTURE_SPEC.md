# DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> docs/TSHINE_DEV_SPEC.md -> docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md -> src/features/chat/README.md -> src/features/todo/README.md -> src/features/report/README.md
# 魔法笔实施规格

- 文档版本: v3.1
- 状态: Ready for implementation
- 最后更新: 2026-03-11
- 适用范围: `/chat` 页面内显式进入的魔法笔整理入口
- 目标读者: 前端开发、状态层开发、测试、产品
- 变更记录:
  - v3.1 -- 根据产品 review 修正 6 项实施细节（restoreInput 用 useRef、重叠校验标记规则、时段词 UI 提示、未识别片段引导、scope 锁定 daily、时段词解析测试）
  - v3.0 -- 基于代码审计结果修正技术细节、补充真实签名与约束

## 1. 文档目标

本文档是直接给开发执行的实施规格，不是产品脑暴稿。

V1 的魔法笔只做两件事：

1. 把"今天已经发生、但主输入没有及时记录"的活动补录进时间线。
2. 从自然语言中提取待办，写入现有 Todo 系统。

V1 明确不做：

1. 纯心情记录。
2. 主输入框后台静默调用魔法笔。
3. 跨天补录。
4. 新增"日程 / 计划"数据模型。
5. 默认 AI 解析。

## 2. 必须对齐的项目现状

> [!IMPORTANT]
> 以下是当前仓库的**真实代码审计结果**（2026-03-11），魔法笔方案必须建立在这些约束之上。每条均指明代码位置，开发者可直接查证。

### 2.1 ChatInputBar（`src/features/chat/ChatInputBar.tsx`，45 行）

- 当前只有单行 `<input>` + 发送 `<button>`，左侧没有任何入口位。
- Props 接口：`input, isLoading, onInputChange, onSend, onKeyDown`。
- 魔法笔需要新增 `onOpenMagicPen` prop 和左侧按钮。

### 2.2 ChatPage（`src/features/chat/ChatPage.tsx`，478 行）

- **已超过 400 行警告线**。魔法笔新增代码必须控制在 15 行以内，仅做状态声明和 props 透传。
- 已管理 4 个弹层状态（`editingId`, `insertingAfterId`, `moodPickerFor`, `selectedStardust`），魔法笔加入只需新增 `isMagicPenOpen` 布尔值。
- 主发送入口通过 `handleSend()` → `sendAutoRecognizedInput(input)` 完成，魔法笔**不得走这条链路**。

### 2.3 主输入统一入口

- `useChatStore.sendAutoRecognizedInput(content)` 内部调用 `sendAutoRecognizedInputFlow()`，只处理 `activity` / `mood` 两类。
- 该函数内部依赖 `classifyLiveInput()`（`src/services/input/liveInputClassifier.ts`），规则在 `liveInputRules.zh.ts` / `en.ts` / `it.ts` 中。
- **魔法笔不得复用或扩展此链路**。

### 2.4 历史活动插入能力

`useChatStore.insertActivity` 的**真实签名和行为**：

```ts
insertActivity: async (prevId, nextId, content, startTime, endTime) => {
  // ⚠️ prevId 和 nextId 完全未使用！
  // 实际委托给：
  buildInsertedActivityResult(state.messages, content, startTime, endTime);
  // 然后 persist 到 Supabase
}
```

`buildInsertedActivityResult`（`src/store/chatActions.ts:370-445`）的真实行为：

1. 创建新 Message：`{ id: uuid, content, timestamp: startTime, duration: (endTime-startTime)/60000, activityType: '待分类', mode: 'record' }`
2. 遍历现有 messages，对重叠的已完成活动执行自动切分（头部裁剪、尾部裁剪、插入切片）
3. 最终按 timestamp 排序

**关键结论**：
- 调用方传 `prevId=null, nextId=null` 即可，不需要任何排序逻辑。
- 插入的活动 `activityType` 固定为 `'待分类'`，不需要额外分类。
- 已完成活动重叠时会被自动切分，无需调用方处理。

### 2.5 sendMessage 不适合补录

`sendMessage(content, customTimestamp?, forcedMode?, options?)` 会关闭上一条进行中的 activity 并创建实时记录（新活动 `duration=undefined` 表示进行中）。历史补录必须绕过此函数。

### 2.6 Todo 写入入口

`useTodoStore.addTodo` 的**真实签名**（`src/store/useTodoStore.ts:77-98`）：

```ts
addTodo: async (
  content: string,
  priority: Priority,
  category: string,
  scope: TodoScope,
  dueDate?: number,          // 可选，不传则默认 Date.now()
  recurrence: Recurrence = 'none'
) => void
```

真实类型定义（同文件）：

```ts
type Priority = 'urgent-important' | 'urgent-not-important' | 'important-not-urgent' | 'not-important-not-urgent';
type TodoScope = 'daily' | 'weekly' | 'monthly';
type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';
```

V1 必须沿用这些类型，不发明新字段。

### 2.7 报告页约束

报告页将 `mode === 'record' && !isMood && duration !== undefined` 视为有效活动时长。
`buildInsertedActivityResult` 创建的 Message 自带 `duration` 计算值，因此魔法笔补录活动天然满足报告统计条件。

### 2.8 进行中活动检测

ChatPage 中的 `activeRecord` 检测逻辑（`ChatPage.tsx:148-156`）：

```ts
const activeRecord = useMemo(() => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.mode === 'record' && !message.isMood && message.duration === undefined) {
      return message;
    }
  }
  return undefined;
}, [messages]);
```

**魔法笔校验"与进行中活动重叠"时，必须用同样的 `duration === undefined` 条件**定位 ongoing activity。

### 2.9 现有 Todo 筛选

`scope` 决定 Todo 在页面的显示分组，`dueDate` 会影响报告统计但不决定 Todo 页是否显示在"今日/本周/本月"。

### 2.10 当前仓库无 Magic Pen 代码

不存在任何 Magic Pen 代码，不存在 `/api/magic-pen-parse` 接口。V1 纯前端实现。

### 2.11 结论

1. 活动补录必须绕过 `sendAutoRecognizedInput()` 和 `sendMessage()`。
2. 活动补录直接调用 `insertActivity(null, null, content, startTime, endTime)`。
3. Todo 提取必须沿用现有 Todo 模型，不发明新字段。
4. V1 全部在前端完成，不需要新增 serverless endpoint，不需要新增 Supabase 字段。

## 3. 最终产品定义

魔法笔是聊天页里的一个显式整理工具，不是主输入模式。

### 3.1 用户入口

1. 在 `ChatInputBar.tsx` 左侧新增一个魔法笔按钮（建议用 `lucide-react` 的 `Wand2` 或 `Sparkles` 图标）。
2. 点击后打开 `MagicPenSheet.tsx`。
3. 不新增 `/magic-pen` 路由，不新增 tab，不抢占主输入发送链路。

### 3.2 与主输入的关系

1. 主输入继续只做"活动 / 心情"自动识别（`sendAutoRecognizedInput`）。
2. 魔法笔只在用户显式点击按钮后进入。
3. V1 不做"主输入建议转魔法笔"的联动。
4. 若未来做会员化，也只能保留显式进入，不能强制跳转。

### 3.3 魔法笔输出类型

```ts
type MagicPenDraftKind = 'activity_backfill' | 'todo_add';
```

V1 不允许输出：

1. `mood`
2. `schedule`
3. `report_hint`
4. 任何直接写库且不经过预览确认的结果

## 4. 交互流程

### 4.1 打开与关闭

#### 打开

1. 用户点击输入栏左侧魔法笔按钮。
2. 如果主输入框当前有未发送文本，则把该文本迁移到魔法笔输入框，并暂时清空主输入框。
3. 用 `useRef` 记录一份 `restoreInputRef` 快照，供取消时恢复。

#### 关闭

1. 点击取消或遮罩关闭时，如果本次未成功提交，则把 `restoreInputRef.current` 恢复回主输入框。
2. 如果本次已成功提交，则不恢复主输入文本。

> [!IMPORTANT]
> `restoreInput` 必须用 `useRef` 而非 `useState`：它不需要触发重渲染，且 `useState` 快照在魔法笔打开期间如果 `input` 被其他 handler 修改会产生不一致。
> 这个规则必须实现，否则用户会在"主输入"和"魔法笔输入"之间丢内容或重复内容。

### 4.2 弹层形态

复用当前项目已有 modal 样式（参考 `TodoEditorModal.tsx` 的 CSS 类）：

```tsx
// 外层遮罩
<div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
  // 内容区
  <div className="bg-white w-full max-w-md rounded-2xl p-6 space-y-4 animate-in slide-in-from-bottom-10 fade-in">
    ...
  </div>
</div>
```

关键：
- 移动端：`items-end` 实现底部弹出 sheet。
- 桌面端：`sm:items-center` 实现居中 modal。
- 动画类名对齐已有组件。

> [!WARNING]
> `animate-in`、`slide-in-from-bottom-10`、`fade-in` 来自 `tailwindcss-animate` 插件，不是 Tailwind 核心类。开发前必须确认 `tailwind.config` 中已有 `require('tailwindcss-animate')`。若未安装，降级为手写 CSS transition（如 `@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`）。

### 4.3 Sheet 内部结构

`MagicPenSheet.tsx` 固定包含 4 个区域：

1. **顶部标题区**：标题 + 关闭按钮 + 简短说明文案
2. **原始文本输入区**：多行 `textarea` + `解析` 按钮
3. **解析结果区**：按 `活动补录` → `待办新增` → `未识别片段` 分组展示
4. **底部操作区**：`取消` + `确认写入`

#### 原始文本输入区

1. 使用多行 `<textarea>`，不是单行 `<input>`。
2. 占位文案：`t('chat_magic_pen_placeholder')`
3. 解析按钮文案：`t('chat_magic_pen_parse')`
4. V1 不做输入时实时解析，只在点击 `解析` 后执行

#### 底部操作区

`确认写入` 按钮在以下情况必须禁用：

1. 没有任何 draft
2. 存在选中 draft 的校验错误（`errors.length > 0`）
3. 正在提交

### 4.4 Draft 卡片交互

每条草稿必须支持：

1. 编辑内容
2. 删除
3. 切换类型（`activity_backfill` ↔ `todo_add`）
4. 展示置信度（`high` / `medium` / `low`）
5. 展示校验错误

#### 活动草稿额外字段

活动草稿必须展示并允许编辑：

1. `开始时间`：使用 `<input type="datetime-local">`，对齐 `EditInsertModal` 中的时间选择器样式
2. `结束时间`：同上

#### 活动草稿的时间确认状态（`needsUserConfirmation` UI 呈现）

当 `timeResolution === 'period'`（时段词推测时间）或 `timeResolution === 'exact'`（精确时间但结束时间为默认 +30 分钟）时，时间字段必须有视觉区分：

1. 时间输入框使用**虚线边框 + 橙色高亮**（如 `border-dashed border-orange-400`），与正常输入框的实线灰色边框形成对比
2. 在时间区域下方展示提示文案：`t('chat_magic_pen_estimated_time')`（如 "⏰ 估算时间，请确认"）
3. 当用户手动修改过时间后，去掉虚线边框和提示文案

这样可以防止用户不看时间就直接提交，避免时间线上出现假精确记录。

#### Todo 草稿额外字段

Todo 草稿必须展示：

1. `scope`：只读展示 `daily`（V1 锁定，不允许用户切换）
2. `默认优先级`：只读展示 `important-not-urgent`
3. `默认分类`：只读展示 `life`

V1 中：

1. `priority` 固定 `important-not-urgent`（只读）
2. `category` 固定 `life`（只读）
3. `scope` 固定 `daily`（只读）
4. `recurrence` 固定 `none`（只读）

> [!NOTE]
> V1 将 `scope` 锁定为 `daily` 而非允许切换，原因是当前 Todo 架构中 `scope` 只决定分组，不影响"今日是否显示"。如果用户把 scope 改成 `weekly` 却发现 Todo 仍然出现在今日列表，会产生困惑。V2 若有精确日程能力后再开放 scope 切换。

### 4.5 提交后的反馈

#### 提交成功

1. 关闭弹层
2. 刷新聊天页时间线（`insertActivity` 会直接更新 `useChatStore.messages`）和 Todo 列表（`addTodo` 会直接更新 `useTodoStore.todos`）
3. 给出简短成功提示：`t('chat_magic_pen_success_summary', { activityCount, todoCount })`

#### 部分失败

1. 弹层不关闭
2. 已成功项标记为 success（禁用，不可重复提交）
3. 失败项保留在列表里，允许修正后重试

> [!WARNING]
> 不能要求跨 store 事务回滚，当前项目没有跨 store 事务能力。

## 5. 数据结构

### 5.1 类型定义

新增独立类型文件：`src/services/input/magicPenTypes.ts`

不要复用或覆盖现有 `src/services/input/types.ts`，因为该文件已服务于主输入自动识别（定义了 `LiveInputKind`, `LiveInputClassification` 等类型）。

```ts
// src/services/input/magicPenTypes.ts
import type { Priority, TodoScope } from '../../store/useTodoStore';

export type MagicPenDraftKind = 'activity_backfill' | 'todo_add';
export type MagicPenDraftConfidence = 'high' | 'medium' | 'low';
export type MagicPenDraftErrorCode =
  | 'missing_time'
  | 'invalid_time_range'
  | 'future_time'
  | 'cross_day'
  | 'overlap_in_batch'
  | 'overlap_with_ongoing_activity';

export interface MagicPenActivityFields {
  startAt?: number;   // epoch ms
  endAt?: number;     // epoch ms
  timeResolution: 'exact' | 'period' | 'missing';
  suggestedTimeLabel?: string;  // 原始时段词，如"上午"、"下午3点"
}

export interface MagicPenTodoFields {
  priority: Priority;   // V1 固定为 'important-not-urgent'
  category: string;     // V1 固定为 'life'
  scope: TodoScope;     // V1 固定为 'daily'（只读）
  dueDate?: number;     // 可选 epoch ms
}

export interface MagicPenDraftItem {
  id: string;           // uuid
  kind: MagicPenDraftKind;
  content: string;      // 用户可编辑的内容
  sourceText: string;   // 原始拆段文本（不可编辑，用于展示来源）
  confidence: MagicPenDraftConfidence;
  needsUserConfirmation: boolean;
  errors: MagicPenDraftErrorCode[];
  activity?: MagicPenActivityFields;
  todo?: MagicPenTodoFields;
}

export interface MagicPenParseResult {
  drafts: MagicPenDraftItem[];
  unparsedSegments: string[];
}
```

### 5.2 本地提交状态

`MagicPenSheet` 内部维护每条 draft 的 UI 提交态：

```ts
type MagicPenCommitState = 'idle' | 'submitting' | 'success' | 'error';

// Sheet 内部用 Map 管理：
const [commitStates, setCommitStates] = useState<Map<string, MagicPenCommitState>>(new Map());
```

该状态只存在于前端组件本地，不进 store，不落库。

## 6. 解析规则

### 6.1 语言范围

V1 解析规则只要求覆盖中文输入。

说明：

1. UI 文案仍然要补齐 `zh/en/it` 三套翻译（参照现有 `src/i18n/locales/` 的 `en.ts` / `zh.ts` / `it.ts`）。
2. 解析规则先落中文，与当前项目"规则优先、逐语言扩展"的做法一致（参考 `liveInputRules.zh.ts` / `en.ts` / `it.ts` 的拆分模式）。
3. 英文和意大利文解析不在本期验收范围内。

### 6.2 解析步骤

解析流程固定为 5 步：

1. 标准化文本
2. 拆段
3. 逐段分类
4. 组装 draft
5. 统一校验

文件拆分（对齐现有 `services/input/` 的命名风格）：

| 文件 | 职责 |
|------|------|
| `src/services/input/magicPenRules.zh.ts` | 中文关键词、正则、信号词列表（类比 `liveInputRules.zh.ts`）|
| `src/services/input/magicPenParser.ts` | 标准化 + 拆段 + 分类主流程（类比 `liveInputClassifier.ts`）|
| `src/services/input/magicPenDraftBuilder.ts` | 从分类结果组装标准 draft + 默认值 + 校验 |

### 6.3 文本标准化

规则（对齐现有 `normalizeLiveInput` 行为）：

1. `trim()` 去首尾空白
2. `replace(/\s+/g, ' ')` 合并连续空格
3. 中文标点参与拆段（见 6.4）
4. 空段直接丢弃

### 6.4 拆段规则

先按以下分隔符切段：

1. `，`
2. `。`
3. `；`
4. `、`
5. 换行符（`\n`）

再按连接词拆子句：

1. `然后`
2. `后来`
3. `顺便`
4. `以及`
5. `还要`
6. `记得`

> [!NOTE]
> `记得` 既是连接词也是 Todo 强信号。拆段后保留原始片段文本用于 `sourceText` 和未识别展示。

### 6.5 活动补录信号

一个片段判为 `activity_backfill`，至少同时满足：

1. 有"今天已发生"的证据
2. 有活动动作词
3. 没有明显未来义务表达

#### 已发生证据词

| 序号 | 关键词 |
|------|--------|
| 1 | `今天` |
| 2 | `今早` |
| 3 | `早上` |
| 4 | `上午` |
| 5 | `中午` |
| 6 | `下午` |
| 7 | `晚上` |
| 8 | `刚刚` |
| 9 | `刚才` |

#### 动作词

| 序号 | 关键词 |
|------|--------|
| 1 | `开会` |
| 2 | `吃饭` |
| 3 | `买菜` |
| 4 | `学习` |
| 5 | `写方案` |
| 6 | `改方案` |
| 7 | `散步` |
| 8 | `健身` |
| 9 | `通勤` |
| 10 | `做家务` |

> [!TIP]
> 可复用现有 `liveInputRules.zh.ts` 中已定义的 `ZH_ACTIVITY_VERBS` 和 `ZH_ACTIVITY_STRONG_PHRASES` 等词表，避免重复维护。新增魔法笔专用词放在 `magicPenRules.zh.ts` 中。

### 6.6 Todo 信号

一个片段判为 `todo_add`，满足任一强信号即可。

#### 未来词

`待会` / `一会` / `稍后` / `晚点` / `之后` / `明天` / `这周` / `本周` / `本月`

#### 义务词

`记得` / `提醒我` / `要` / `得` / `需要` / `别忘了`

### 6.7 明确不生成 draft 的片段

以下内容直接进入 `unparsedSegments`：

1. 纯心情句，例如 `今天有点烦`
2. 纯评价句，例如 `做得还不错`
3. 纯模糊句，例如 `今天做了很多事`
4. 跨天补录句，例如 `昨天开会`
5. 未来计划但超出当前 Todo 粗粒度模型的句子，例如 `下个月12号记得...`

#### `unparsedSegments` 的 UI 展示规则

未识别片段分组是**只读区域**，用户不能从这里拖拽或一键转换为 draft。

但必须提供引导文案：`t('chat_magic_pen_unparsed_hint')`（如"以下内容无法自动识别，你可以在主输入中手动新增"），避免用户困惑"这段话被扔掉了怎么办"。

样式建议：灰色背景 + 较小字体，视觉权重低于活动和 Todo 分组。

### 6.8 冲突优先级

固定优先级如下：

1. 明显未来 + 义务表达 → `todo_add`
2. 明显今天已发生 + 动作表达 → `activity_backfill`
3. 两类证据同时都强且无法拆开 → 生成低置信度 draft，`confidence: 'low'` + `needsUserConfirmation: true`
4. 没有足够证据 → `unparsedSegments`

## 7. 时间规则

### 7.1 活动补录必须拿到完整时间区间

原因是当前实现的硬性要求：

1. `buildInsertedActivityResult()` 创建的 Message 需要 `timestamp: startTime` 和 `duration: (endTime - startTime) / 60000`
2. 报告页依赖 `duration !== undefined` 来判定有效活动
3. 时间线排序依赖 `timestamp`

因此，活动草稿提交前必须拥有：

1. `startAt`（epoch ms）
2. `endAt`（epoch ms）
3. `startAt < endAt`

### 7.2 时间解析策略

#### 精确时间

例如：`10点开会`、`10:30 买菜`、`下午3点改方案`

处理：

1. 解析出 `startAt`
2. 默认 `endAt = startAt + 30 * 60 * 1000`（30 分钟，只是可编辑起点）
3. `timeResolution: 'exact'`
4. `errors: []`
5. `needsUserConfirmation: true`

#### 时段词

例如：`上午改方案`、`下午买菜`、`晚上散步`

建议时间窗口：

| 时段词 | 默认 startAt | 默认 endAt |
|--------|-------------|------------|
| `今早` / `早上` / `上午` | 09:00 | 11:00 |
| `中午` | 12:00 | 13:00 |
| `下午` | 15:00 | 17:00 |
| `晚上` | 20:00 | 21:00 |

处理：

1. 填入当天对应时间的 epoch ms
2. `timeResolution: 'period'`
3. `suggestedTimeLabel` 保留原始时段词
4. `needsUserConfirmation: true`

#### 缺少时间

例如：`今天开会`、`刚刚去买菜`

处理：

1. 允许生成活动 draft
2. `startAt` 和 `endAt` 为 `undefined`
3. `timeResolution: 'missing'`
4. `errors: ['missing_time']`
5. 提交前必须由用户补齐

### 7.3 时间合法性校验

所有活动 draft 在提交前统一校验（在 `magicPenDraftBuilder.ts` 中实现为纯函数）：

| 序号 | 校验规则 | 错误码 | 标记规则 |
|------|----------|--------|----------|
| 1 | `startAt` 和 `endAt` 都必须存在 | `missing_time` | 标记在当前 draft |
| 2 | `startAt < endAt` | `invalid_time_range` | 标记在当前 draft |
| 3 | `endAt <= Date.now()` | `future_time` | 标记在当前 draft |
| 4 | `startAt` 和 `endAt` 必须在同一天（本地日期） | `cross_day` | 标记在当前 draft |
| 5 | 本批次活动 draft 之间不能重叠 | `overlap_in_batch` | **只标记 `startAt` 更晚的那条**（见下方说明） |
| 6 | 不能与进行中活动（`duration === undefined`）重叠 | `overlap_with_ongoing_activity` | 标记在当前 draft |

#### `overlap_in_batch` 的标记规则

当批次内两条活动 draft 时间重叠时，**只在 `startAt` 更晚（或相等时 id 排序靠后）的那条上标记 `overlap_in_batch`**，另一条不标记。

原因：如果两条都报红，用户看到两个错误卡片不知道该改哪个。只标记后面那条，用户清楚知道"这条和上面某条冲突，改这条的时间就行"。

错误提示文案：`t('chat_magic_pen_overlap_hint', { activity: '前一条活动名' })`（如"与'改方案'时间冲突，请调整"）。

#### 关于与已完成活动的重叠

V1 **允许**与已完成活动重叠。原因：`buildInsertedActivityResult` 已内建自动切分逻辑（对重叠区间执行头部裁剪 / 尾部裁剪 / 整体挪移）。

总结：

- 与已完成活动重叠 → 允许提交，由 `insertActivity` 内部切分处理
- 与进行中活动重叠 → 禁止提交，因为 ongoing activity 没有稳定结束时间

## 8. Todo 映射规则

### 8.1 默认字段

Todo draft 默认值固定为：

```ts
{
  priority: 'important-not-urgent',
  category: 'life',
  recurrence: 'none',
}
```

### 8.2 Scope 规则

V1 中 `scope` **固定为 `daily`**，不做推导，不允许用户切换。

原因：当前 Todo 架构中 `scope` 只影响分组展示，不影响"今日是否显示"。如果根据时间词推导出 `weekly` 或 `monthly`，用户会误以为"这条 Todo 不会出现在今日列表"，但实际还是会出现，造成预期落差。

> [!NOTE]
> V2 若 Todo 系统增加精确日程能力（按 dueDate 过滤），再开放 scope 推导和用户切换。

V1 规则：

1. 能解析出明确日期/时间时，写入解析后的 `dueDate`（epoch ms）
2. 只能解析出粗粒度范围时，传 `undefined`（`addTodo` 会默认为 `Date.now()`）
3. 不为了解决"明天任务不该出现在今日列表"而新增模型或 UI 分支

> [!NOTE]
> 这是当前 Todo 架构的真实限制。V1 不做精确日程。

## 9. 技术方案

### 9.1 新增与修改文件清单

#### 必改（5 个文件）

| 文件 | 改动说明 |
|------|----------|
| `src/features/chat/ChatInputBar.tsx` | 新增 `onOpenMagicPen` prop + 左侧按钮 |
| `src/features/chat/ChatPage.tsx` | 新增 `isMagicPenOpen` + `restoreInputRef` 状态，渲染 `MagicPenSheet`（≤15 行新增） |
| `src/i18n/locales/en.ts` | 新增魔法笔 i18n key（见第 11 节） |
| `src/i18n/locales/zh.ts` | 同步新增中文翻译 |
| `src/i18n/locales/it.ts` | 同步新增意大利文翻译 |

#### 必增（7 个文件）

| 文件 | 职责 |
|------|------|
| `src/features/chat/MagicPenSheet.tsx` | Sheet 组件：输入、解析、编辑、提交 |
| `src/services/input/magicPenTypes.ts` | 类型定义 |
| `src/services/input/magicPenRules.zh.ts` | 中文规则词表 |
| `src/services/input/magicPenParser.ts` | 解析主流程 |
| `src/services/input/magicPenDraftBuilder.ts` | draft 组装 + 校验纯函数 |
| `src/store/magicPenActions.ts` | 跨 store 提交编排 |
| `src/services/input/magicPenParser.test.ts` | 解析单元测试 |

#### 可选新增

| 文件 | 条件 |
|------|------|
| `src/features/chat/magicPenSheetHelpers.ts` | 当 `MagicPenSheet.tsx` 行数接近 400 时，抽出 UI helper |
| `src/store/magicPenActions.test.ts` | 提交流程单元测试 |

### 9.2 页面层职责

#### `ChatInputBar.tsx`

只负责：

1. 渲染魔法笔按钮
2. 透传 `onOpenMagicPen` 回调

不得在这里放解析逻辑或提交逻辑。

新增 Props 示例：

```ts
interface ChatInputBarProps {
  input: string;
  isLoading: boolean;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onOpenMagicPen: () => void;  // 新增
}
```

#### `ChatPage.tsx`

只负责（新增 ≤15 行代码）：

```ts
// 状态声明
const [isMagicPenOpen, setIsMagicPenOpen] = useState(false);
const restoreInputRef = useRef('');  // ⚠️ 用 useRef，不用 useState

// 打开回调
const handleOpenMagicPen = () => {
  restoreInputRef.current = input;   // 快照当前 input
  setIsMagicPenOpen(true);
  setInput('');
};

// 关闭回调
const handleCloseMagicPen = (submitted: boolean) => {
  setIsMagicPenOpen(false);
  if (!submitted) setInput(restoreInputRef.current);
  restoreInputRef.current = '';
};
```

> [!NOTE]
> `restoreInputRef` 用 `useRef` 而非 `useState`：它不需要触发重渲染，也避免 `useState` 闭包捕获旧值的风险。

不得把 draft 编辑、规则解析、写库细节堆进 `ChatPage.tsx`。

#### `MagicPenSheet.tsx`

负责：

1. 收集原始文本
2. 调用 `parseMagicPenInput()`
3. 展示并编辑 drafts
4. 调用 `commitMagicPenDrafts()`
5. 处理部分成功 / 失败态
6. 回调 `onClose(submitted)`

### 9.3 服务层职责

#### `magicPenParser.ts`

```ts
import type { MagicPenParseResult } from './magicPenTypes';

export function parseMagicPenInput(rawText: string): MagicPenParseResult;
```

负责：标准化 → 拆段 → 分类 → 返回 `MagicPenParseResult`。

#### `magicPenDraftBuilder.ts`

```ts
import type { MagicPenDraftItem, MagicPenDraftErrorCode } from './magicPenTypes';
import type { Message } from '../../store/useChatStore';

/** 基于当前 messages 和 ongoing activity 对 drafts 执行校验 */
export function validateDrafts(
  drafts: MagicPenDraftItem[],
  messages: Message[],
): MagicPenDraftItem[];

/** 生成活动的默认建议时间窗口 */
export function buildSuggestedTimeWindow(
  periodKeyword: string,
  today: Date,
): { startAt: number; endAt: number };
```

负责：组装标准 draft、生成默认 Todo 字段、生成建议时间窗口、执行纯函数校验。

### 9.4 Store 编排职责

新增 `src/store/magicPenActions.ts`，只做跨 store 编排，不新增独立 Zustand store。

```ts
import type { MagicPenDraftItem } from '../services/input/magicPenTypes';

export interface MagicPenCommitResult {
  successActivityCount: number;
  successTodoCount: number;
  failedDraftIds: string[];
}

export async function commitMagicPenDrafts(
  drafts: MagicPenDraftItem[],
): Promise<MagicPenCommitResult>;
```

实现要求：

1. 通过 `useChatStore.getState().insertActivity(null, null, ...)` 写活动
2. 通过 `useTodoStore.getState().addTodo(...)` 写待办
3. 不创建新的 Supabase 直写层
4. 不绕开现有 store action
5. `insertActivity` 的 `prevId` 和 `nextId` 均传 `null`（当前实现忽略这两个参数）

## 10. 提交流程

### 10.1 提交前校验

`确认写入` 前执行（调用 `validateDrafts()`）：

1. 过滤空内容 draft
2. 校验所有活动时间（6 项规则，见 7.3）
3. 校验批次内活动重叠
4. 校验与 ongoing activity 的冲突（使用 `duration === undefined` 条件定位）

若失败：

1. 标记 draft `errors` 数组
2. 不触发任何写库
3. 禁用 `确认写入` 按钮

### 10.2 实际提交顺序

固定顺序：

1. 先按 `startAt` 升序提交活动草稿
2. 再提交 Todo 草稿

原因：

1. 活动补录对时间线的影响更大
2. 先稳定活动时间线再写 Todo，更容易排查问题
3. `buildInsertedActivityResult` 基于当前 `messages` 做切分，顺序提交保证每次切分时 messages 已包含前序补录结果

### 10.3 活动提交实现

活动提交必须直接调用：

```ts
await useChatStore.getState().insertActivity(
  null,           // prevId（未使用，传 null）
  null,           // nextId（未使用，传 null）
  draft.content,
  draft.activity!.startAt!,
  draft.activity!.endAt!,
);
```

禁止路径：

- ❌ `sendMessage()`
- ❌ `sendAutoRecognizedInput()`
- ❌ 任何 AI 分类调用

> [!IMPORTANT]
> `insertActivity` 会在内部调用 `buildInsertedActivityResult`，新建的 Message 的 `activityType` 固定为 `'待分类'`。V1 不需要额外做分类，不需要传 activityType 参数。

### 10.4 Todo 提交实现

Todo 草稿直接调用：

```ts
await useTodoStore.getState().addTodo(
  draft.content,
  draft.todo!.priority,     // 'important-not-urgent'
  draft.todo!.category,     // 'life'
  draft.todo!.scope,        // 用户可改
  draft.todo!.dueDate,      // 可选
  'none',                   // recurrence
);
```

### 10.5 失败处理

由于当前没有跨表事务，必须按"逐项提交 + 记录结果"处理：

1. 成功项标记 `commitState = 'success'`
2. 失败项标记 `commitState = 'error'`
3. 返回失败 draft id 列表
4. 允许用户只重试失败项

> [!CAUTION]
> 不得在失败后盲目重跑全部 drafts，否则会产生重复待办或重复补录。

## 11. i18n 要求

新增魔法笔 UI 时，所有新文案必须走 i18n。以 `src/i18n/locales/en.ts` 为 key 基线。

建议新增 key（15 个）：

```ts
// en.ts 中示例
chat_magic_pen_open: 'Magic Pen',
chat_magic_pen_title: 'Magic Pen',
chat_magic_pen_subtitle: 'Backfill missed activities or extract to-dos',
chat_magic_pen_placeholder: 'Backfill today\'s missed activities, or organize to-dos from a note',
chat_magic_pen_parse: 'Parse',
chat_magic_pen_confirm: 'Write All',
chat_magic_pen_cancel: 'Cancel',
chat_magic_pen_group_activity: 'Activity Backfill',
chat_magic_pen_group_todo: 'New To-dos',
chat_magic_pen_group_unparsed: 'Unrecognized',
chat_magic_pen_missing_time: 'Start & end time required',
chat_magic_pen_invalid_time: 'Invalid time range',
chat_magic_pen_overlap: 'Time overlaps with another item',
chat_magic_pen_partial_success: 'Some items failed, you can retry',
chat_magic_pen_success_summary: 'Backfilled {{activityCount}} activities, added {{todoCount}} to-dos',
```

同步补齐 `zh.ts` 和 `it.ts`。

## 12. 测试要求

### 12.1 单元测试

`src/services/input/magicPenParser.test.ts` 至少覆盖：

| 序号 | 用例分类 | 最少数量 |
|------|----------|----------|
| 1 | 纯活动补录 | 5 条 |
| 2 | 纯 Todo 提取 | 5 条 |
| 3 | 混合输入（活动 + 待办） | 4 条 |
| 4 | 模糊句进入 `unparsedSegments` | 3 条 |
| 5 | 跨天输入被拒绝 | 2 条 |
| 6 | 时间缺失生成 `missing_time` | 2 条 |
| **合计** | | **≥ 21 条** |

### 12.2 提交流程测试

`src/store/magicPenActions.test.ts` 至少覆盖：

1. 活动按 `startAt` 升序提交
2. Todo 复用 `addTodo`
3. 有活动校验错误时整体不提交
4. 部分提交失败时返回失败 draft id
5. ongoing activity 冲突时阻止提交

### 12.3 手工验收样例

至少跑以下用例：

| 序号 | 输入 | 预期结果 |
|------|------|----------|
| 1 | `今天上午改方案，晚上记得整理发票` | 1 个活动 draft（上午 09:00-11:00）+ 1 个 todo draft |
| 2 | `晚点给妈妈回电话` | 1 个 todo draft（scope: daily） |
| 3 | `今天做了很多事` | 进入 unparsedSegments |
| 4 | `昨天开会` | 进入 unparsedSegments（跨天拒绝） |
| 5 | `上午改方案，上午又去买菜` | 2 个活动 draft（需用户手动调整时间避免重叠） |
| 6 | 主输入已有文本 → 点击魔法笔 → 取消关闭 | 主输入文本恢复 |

## 13. 验收标准

### 13.1 功能验收

1. 用户可以从聊天页显式打开魔法笔。
2. 魔法笔不会接管主输入的活动/心情识别链路。
3. 输入混合文本后，可以同时得到活动草稿和 Todo 草稿。
4. 活动草稿缺时间时不能提交。
5. 活动提交后出现在聊天记录时间线中（`activityType: '待分类'`）。
6. Todo 提交后出现在 Todo 页中。
7. 取消关闭时，主输入原文能恢复。
8. 部分失败时，不会重复提交已成功项。

### 13.2 工程验收

1. 不新增数据库字段。
2. 不新增 API endpoint。
3. 不把解析逻辑写进 `ChatPage.tsx`。
4. 不把历史补录走到 `sendMessage()`。
5. 不破坏报告页对活动时长的统计逻辑。
6. 所有新文案接入 i18n。
7. `ChatPage.tsx` 新增代码 ≤ 15 行。
8. 所有新文件 ≤ 400 行。

## 14. Phase 划分

### Phase 1（本期）

1. 聊天页入口（`ChatInputBar` 按钮 + `ChatPage` 状态）
2. `MagicPenSheet` 完整交互
3. 中文规则解析（`magicPenParser.ts` + `magicPenRules.zh.ts`）
4. 活动草稿编辑与时间补全
5. Todo 草稿提交
6. 活动草稿提交（通过 `insertActivity`）
7. 单元测试（≥ 21 条解析测试 + 提交流程测试）

### Phase 2

1. 更丰富的时间表达（如 `从10点到12点`）
2. 更细的冲突提示（如提示具体哪条活动被切分）
3. 更完整的部分失败重试体验

### Phase 3

1. en / it 规则
2. 可选 telemetry
3. 必要时评估 AI fallback

## 15. 明确不在本期处理的事项

1. 会员 gating 逻辑
2. 主输入建议跳转魔法笔
3. 英文 / 意大利文解析完整覆盖
4. `/api/magic-pen-parse`
5. 新的日历 / 日程数据模型
6. 跨天补录

## 16. 实施结论

对当前仓库最稳妥的落地方式是：

1. 在聊天页输入栏新增一个显式魔法笔按钮。
2. 用独立 `MagicPenSheet` 承接输入、解析、编辑和提交。
3. 活动补录直接调用 `insertActivity(null, null, content, startAt, endAt)`，绝不复用主输入发送链路。
4. Todo 提取复用 `useTodoStore.addTodo()`。
5. V1 全部以前端规则完成，不加新接口，不改数据库。
6. `ChatPage.tsx` 改动控制在 15 行以内，遵守 400 行编码规范。

只要按本文档执行，开发可以直接开始拆任务和编码，不需要再反复补产品口径。
