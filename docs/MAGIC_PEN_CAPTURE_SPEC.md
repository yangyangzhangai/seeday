# DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> docs/TSHINE_DEV_SPEC.md -> docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md -> src/features/chat/README.md -> src/features/todo/README.md -> src/features/report/README.md
# 魔法笔实施规格

- 文档版本: v4.0
- 状态: Ready for implementation (audited against repo baseline)
- 最后更新: 2026-03-11
- 适用范围: `/chat` 页面内显式进入的魔法笔整理入口
- 目标读者: 前端开发、状态层开发、测试、产品
- 变更记录:
  - v4.0 -- 解析层从纯前端正则重写为 AI 结构化提取 + 前端校验二层架构；新增 `/api/magic-pen-parse` serverless endpoint；删除 `magicPenRules.zh.ts`
  - v3.2 -- 结合真实仓库补充执行约束（ChatPage wiring 行数口径、连接词拆段保留、无全局 toast / 动画插件基线）
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

## 2. 必须对齐的项目现状

> [!IMPORTANT]
> 以下是当前仓库的**真实代码审计结果**（2026-03-11），魔法笔方案必须建立在这些约束之上。每条均指明代码位置，开发者可直接查证。

### 2.1 ChatInputBar（`src/features/chat/ChatInputBar.tsx`，45 行）

- 当前只有单行 `<input>` + 发送 `<button>`，左侧没有任何入口位。
- Props 接口：`input, isLoading, onInputChange, onSend, onKeyDown`。
- 魔法笔需要新增 `onOpenMagicPen` prop 和左侧按钮。

### 2.2 ChatPage（`src/features/chat/ChatPage.tsx`，478 行）

- **已超过 400 行警告线**。魔法笔新增代码必须只保留状态声明、open/close wiring 和组件挂载；业务逻辑目标 ≤ 15 行，`ChatPage.tsx` 总增量建议控制在约 30 行内，超出时抽到 `chatPageActions.ts` 或独立 helper。
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

不存在任何 Magic Pen 代码。V1 需新增 `/api/magic-pen-parse` serverless endpoint 做 AI 结构化提取。

### 2.11 现有 AI 基础设施（魔法笔必须复用）

项目已有完整的 serverless AI 调用链路：

| 层级 | 文件 | 说明 |
|------|------|------|
| Serverless | `api/classify.ts` | 用智谱 GLM-4.7-flash，OpenAI 兼容协议 |
| Serverless | `api/annotation-handler.ts` | 用 Chutes AI，OpenAI 兼容协议 |
| 前端 Client | `src/api/client.ts` | 统一 `postJson` 封装 |
| 共用基础 | `api/http.ts` | CORS、method 校验、`jsonError` 工具 |

**关键约束（`PROJECT_CONTEXT.md` §4）**：前端 `src/**` 不得直连带密钥的第三方 AI 服务，必须通过 `api/*` serverless 中转。

魔法笔 AI 调用必须遵守此约束，复用 `api/http.ts` 的 `applyCors / handlePreflight / requireMethod / jsonError`。

### 2.12 结论

1. 活动补录必须绕过 `sendAutoRecognizedInput()` 和 `sendMessage()`。
2. 活动补录直接调用 `insertActivity(null, null, content, startTime, endTime)`。
3. Todo 提取必须沿用现有 Todo 模型，不发明新字段。
4. 不新增 Supabase 字段。
5. 新增 `/api/magic-pen-parse` serverless endpoint 做 AI 结构化提取（复用现有 `api/http.ts` 基础设施和 `ZHIPU_API_KEY`）。

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
> 当前仓库的 `tailwind.config.js` 的 `plugins` 为空，`package.json` 里也没有 `tailwindcss-animate` 依赖；现有 modal 虽然复用了这些类名，但不能把“动画存在”当成既成事实。Magic Pen V1 不应为此单独引入新依赖。若实测无动画，允许静态展示；若必须补动画，只能在 `src/index.css` 中补最小本地 keyframes，不扩大全局 UI 改造范围。

### 4.3 Sheet 内部结构

`MagicPenSheet.tsx` 固定包含 3 个区域：

1. **顶部标题区**：标题 + 关闭按钮 + 简短说明文案
2. **解析结果区**：按 `活动补录` → `待办新增` → `未识别片段` 分组展示（由发送触发解析后直接注入）
3. **底部操作区**：`取消` + `确认写入`

> [!NOTE]
> 当前实现已取消 Sheet 内“原始文本输入 + 解析按钮”二次入口。解析触发点统一在聊天主输入 `mode-on + send`，Sheet 仅负责草稿编辑与确认写入。

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
3. 如需提示，优先在 Sheet 局部区域展示简短成功摘要：`t('chat_magic_pen_success_summary', { activityCount, todoCount })`

#### 部分失败

1. 弹层不关闭
2. 已成功项标记为 success（禁用，不可重复提交）
3. 失败项保留在列表里，允许修正后重试

> [!WARNING]
> 不能要求跨 store 事务回滚，当前项目没有跨 store 事务能力。

> [!NOTE]
> 当前仓库没有全局 toast / snackbar 基础设施。V1 不新增全局通知系统，也不把“关闭后立即全局浮层提示”作为阻塞验收项。成功或失败反馈默认放在 `MagicPenSheet` 内部的局部状态区完成。

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

## 6. 解析方案：AI 结构化提取 + 前端校验

### 6.1 架构概览

V1 采用 **AI 提取 + 前端校验** 二层架构，取代纯前端正则方案：

```
用户输入 → 前端文本预处理 → /api/magic-pen-parse（AI 结构化提取）→ 前端 magicPenDraftBuilder（校验 + 组装 draft）→ 用户编辑 → 提交
```

| 层 | 负责内容 | 不负责内容 |
|------|------|------|
| AI（serverless） | 拆段、分类、时间提取、内容提取 | 时间合法性校验、batch 重叠、ongoing 冲突 |
| 前端（draftBuilder） | 时间合法性校验、batch 重叠、ongoing 冲突、组装标准 draft、默认值 | 自然语言理解、多语言解析 |

### 6.2 为什么用 AI 而非正则

1. **复杂度不对等**：魔法笔面对的是多段混合文本（拆段 + 每段分类 + 时间提取），比主输入二分类复杂得多；纯正则预计 600+ 行且长尾覆盖差。
2. **频率极低**：用户一天最多 10 次，单次 AI 成本 < ¥0.003（智谱 GLM-4.7-flash），每月 < ¥1。
3. **天然多语言**：AI 无需为 en/it 单独写规则，V2 自动获得多语言支持。
4. **主输入不变**：主输入仍用现有 `classifyLiveInput()` 正则，高频（每天几十上百次）、简单二分类，正则是正确选择。

### 6.3 语言范围

V1 AI 提取支持中文输入（system prompt 用中文写）。

> [!NOTE]
> 因为 AI 天然具有多语言能力，V1 的 system prompt 虽以中文为主，但用户输入英文/意大利文时 AI 大概率也能正确处理。V2 可按需补充多语言 prompt。

UI 文案仍然要补齐 `zh/en/it` 三套翻译。

### 6.4 前端文本预处理

在调用 AI 之前，前端只做最小的文本清洗（在 `magicPenParser.ts` 中实现）：

1. `trim()` 去首尾空白
2. `replace(/\s+/g, ' ')` 合并连续空格
3. 空文本直接返回空 result，不调用 AI
4. 长度限制：超过 500 字符截断并提示用户

### 6.5 AI Serverless Endpoint

#### 端点

`POST /api/magic-pen-parse`

#### 文件

`api/magic-pen-parse.ts`

#### 请求体

```ts
interface MagicPenParseRequest {
  rawText: string;         // 用户原始输入（已预处理）
  lang?: 'zh' | 'en' | 'it';  // 界面语言，默认 'zh'
  todayDateStr: string;    // 当天日期字符串，如 "2026-03-11"
  currentHour: number;     // 当前小时（0-23），辅助 AI 判断时间
}
```

#### 响应体

```ts
interface MagicPenParseResponse {
  success: boolean;
  data: MagicPenAIResult;
  raw?: string;            // debug 用，AI 原始输出
}

interface MagicPenAIResult {
  segments: MagicPenAISegment[];
  unparsed: string[];      // AI 无法分类的片段原文
}

interface MagicPenAISegment {
  text: string;            // 提取的活动/待办内容（干净文本，去掉时间词后的核心内容）
  sourceText: string;      // 原始片段文本（保留时间词，用于 UI 展示来源）
  kind: 'activity_backfill' | 'todo_add';
  confidence: 'high' | 'medium' | 'low';

  // 仅 activity_backfill 时存在
  startTime?: string;      // "HH:mm" 格式，如 "09:00"
  endTime?: string;        // "HH:mm" 格式，如 "11:00"
  timeSource?: 'exact' | 'period' | 'missing';
  periodLabel?: string;    // 原始时段词，如 "上午"、"下午3点"
}
```

#### System Prompt

```
你是一个时间记录助手的文本解析器。用户会输入一段混合文本，你需要拆分并识别其中的内容。

【你的任务】
1. 将用户输入拆分成独立的语义片段
2. 判断每个片段属于哪种类型
3. 提取时间信息

【类型定义】
activity_backfill（活动补录）：今天已经发生过的活动。
  判断依据：有"已发生"证据（时段词如上午/下午/晚上/刚刚、完成态如"了"）+ 有具体动作
  例子：上午改方案、下午去超市买菜、刚刚开完会

todo_add（待办新增）：将来需要做的事情。
  判断依据：有未来/义务表达（记得、要、待会、明天、别忘了）
  例子：记得整理发票、明天交报告、晚点给妈妈回电话

unparsed（无法分类）：以下情况归入此类：
  - 纯情绪/心情表达（如"今天有点烦"）
  - 纯评价（如"做得还不错"）
  - 太模糊无法行动（如"今天做了很多事"）
  - 跨天回顾（如"昨天开会"）
  - 超出简单待办的长期计划（如"下个月12号记得..."）

【时间提取规则】
对 activity_backfill 类型，必须尝试提取时间：
  - exact：用户给出了精确时间 → 解析为 startTime，endTime 默认 +30分钟
    例: "10点开会" → startTime:"10:00", endTime:"10:30", timeSource:"exact"
    例: "下午3点改方案" → startTime:"15:00", endTime:"15:30", timeSource:"exact"
    例: "从10点到12点开会" → startTime:"10:00", endTime:"12:00", timeSource:"exact"
  - period：用户只给出时段词 → 使用默认时间窗口
    上午/早上/今早 → startTime:"09:00", endTime:"11:00"
    中午 → startTime:"12:00", endTime:"13:00"
    下午 → startTime:"15:00", endTime:"17:00"
    晚上 → startTime:"20:00", endTime:"21:00"
  - missing：用户没有给出任何时间信息
    例: "今天开会" → timeSource:"missing"（不填 startTime/endTime）

【输出格式】
严格输出 JSON，不要输出任何解释、前缀、后缀或 Markdown 代码块。

{
  "segments": [
    {
      "text": "活动或待办的核心内容",
      "sourceText": "用户原始片段文本",
      "kind": "activity_backfill 或 todo_add",
      "confidence": "high 或 medium 或 low",
      "startTime": "HH:mm 或 不填",
      "endTime": "HH:mm 或 不填",
      "timeSource": "exact 或 period 或 missing 或 不填",
      "periodLabel": "原始时段词 或 不填"
    }
  ],
  "unparsed": ["无法分类的片段原文"]
}

【重要约束】
1. text 字段应是干净的活动/待办描述，去掉时间词。如"上午改方案" → text:"改方案"
2. sourceText 字段保留原始片段文本，如"上午改方案" → sourceText:"上午改方案"
3. 一个输入可能包含多个片段，你需要全部拆出来
4. 如果无法确定类型，宁可放入 unparsed 也不要强行分类
5. confidence 规则：强证据匹配 → high，单一弱证据 → medium，模糊 → low
6. 今天日期是 {{todayDateStr}}，当前是 {{currentHour}} 点
```

> [!IMPORTANT]
> prompt 中的 `{{todayDateStr}}` 和 `{{currentHour}}` 在 serverless 函数中动态替换，从请求体中读取。这两个变量帮助 AI 判断"下午"是已发生还是未发生。

#### AI 模型选择

使用智谱 `glm-4.7-flash`（复用已有 `ZHIPU_API_KEY`），参数：

```ts
{
  model: 'glm-4.7-flash',
  temperature: 0.3,    // 低温度保证结构化输出稳定
  max_tokens: 1024,
  stream: false,
}
```

> [!NOTE]
> 选择 `glm-4.7-flash` 而非 Chutes AI 的原因：① 智谱 flash 模型延迟更低（~1-2s），② 价格更低，③ 结构化 JSON 输出更稳定，④ 项目 `api/classify.ts` 已验证该模型的 JSON 输出质量。

#### AI 响应解析与容错

`api/magic-pen-parse.ts` 内必须实现 `parseMagicPenAIResponse(raw: string): MagicPenAIResult`，复用 `api/classify.ts` 已验证的解析策略：

```ts
function parseMagicPenAIResponse(raw: string): MagicPenAIResult {
  // 策略1：直接 JSON.parse
  try { return validateAndReturn(JSON.parse(raw.trim())); } catch {}

  // 策略2：提取最外层 {} 块
  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try { return validateAndReturn(JSON.parse(match[0])); } catch {}
  }

  // 策略3：兜底，全部归入 unparsed
  console.warn('[magic-pen-parse] AI 响应解析失败，全部归入 unparsed');
  return { segments: [], unparsed: ['（AI 解析失败，请手动录入）'] };
}
```

`validateAndReturn` 必须校验：
1. `segments` 是数组
2. 每个 segment 的 `kind` 必须是 `'activity_backfill'` 或 `'todo_add'`
3. `startTime` / `endTime` 如果存在，必须匹配 `HH:mm` 格式
4. 不合法的 segment 静默过滤（不阻断整个请求）

### 6.6 前端调用与 Draft 组装

#### 前端 API Client 新增

在 `src/api/client.ts` 新增：

```ts
interface MagicPenParseRequest {
  rawText: string;
  lang?: 'zh' | 'en' | 'it';
  todayDateStr: string;
  currentHour: number;
}

interface MagicPenParseResponse {
  success: boolean;
  data: MagicPenAIResult;
}

export async function callMagicPenParseAPI(
  request: MagicPenParseRequest
): Promise<MagicPenParseResponse> {
  return postJson<MagicPenParseRequest, MagicPenParseResponse>(
    '/magic-pen-parse',
    request,
  );
}
```

#### 前端解析主入口

`src/services/input/magicPenParser.ts`（精简版，不再包含正则逻辑）：

```ts
import { callMagicPenParseAPI } from '../../api/client';
import type { MagicPenParseResult } from './magicPenTypes';

export async function parseMagicPenInput(rawText: string): Promise<MagicPenParseResult> {
  // 1. 预处理
  const cleaned = rawText.trim().replace(/\s+/g, ' ');
  if (!cleaned) return { drafts: [], unparsedSegments: [] };

  // 2. 调用 AI
  const now = new Date();
  const response = await callMagicPenParseAPI({
    rawText: cleaned,
    todayDateStr: now.toISOString().slice(0, 10),
    currentHour: now.getHours(),
  });

  // 3. 将 AI 结果转换为标准 draft（由 magicPenDraftBuilder 完成）
  return buildDraftsFromAIResult(response.data, now);
}
```

> [!IMPORTANT]
> `parseMagicPenInput` 现在是 **async 函数**（v3.x 是同步的）。调用发生在 `ChatPage.tsx` 的 send 分支（mode-on），而不是 `MagicPenSheet.tsx`。

#### `magicPenDraftBuilder.ts` 从 AI 结果组装 draft

```ts
export function buildDraftsFromAIResult(
  aiResult: MagicPenAIResult,
  today: Date,
): MagicPenParseResult {
  const drafts: MagicPenDraftItem[] = [];
  const unparsedSegments: string[] = [...aiResult.unparsed];

  for (const seg of aiResult.segments) {
    if (seg.kind === 'activity_backfill') {
      drafts.push(buildActivityDraft(seg, today));
    } else if (seg.kind === 'todo_add') {
      drafts.push(buildTodoDraft(seg));
    } else {
      unparsedSegments.push(seg.sourceText || seg.text);
    }
  }

  return { drafts, unparsedSegments };
}
```

各 `buildXxxDraft` 函数的职责：
- `buildActivityDraft`：将 AI 的 `HH:mm` 时间转为 epoch ms、设置 `timeResolution`、生成 uuid、设置 `needsUserConfirmation`
- `buildTodoDraft`：设置固定的 `priority/category/scope/recurrence` 默认值

### 6.7 `unparsedSegments` 的 UI 展示规则

未识别片段分组是**只读区域**，用户不能从这里拖拽或一键转换为 draft。

但必须提供引导文案：`t('chat_magic_pen_unparsed_hint')`（如"以下内容无法自动识别，你可以在主输入中手动新增"），避免用户困惑"这段话被扔掉了怎么办"。

样式建议：灰色背景 + 较小字体，视觉权重低于活动和 Todo 分组。

### 6.8 AI 调用错误处理

| 错误场景 | 前端行为 |
|------|------|
| 网络错误 / 超时 | 发送触发解析失败时走本地 fallback，仍打开 Sheet |
| AI 返回空 segments | 全部原文进入 `unparsedSegments`，提示用户"无法识别，请手动录入" |
| AI 返回格式异常 | `parseMagicPenAIResponse` 兜底处理，全部归入 `unparsedSegments` |
| API Key 缺失 | serverless 返回 500，前端提示"服务暂不可用" |

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

### 7.2 时间解析策略（AI 提取 → 前端转换）

AI 在 serverless 返回 `startTime` / `endTime`（`HH:mm` 字符串）和 `timeSource`。前端 `magicPenDraftBuilder.ts` 负责将其转为 epoch ms 并设置 draft 字段。

#### 精确时间（`timeSource: 'exact'`）

AI 返回示例：`{ startTime: "10:00", endTime: "10:30", timeSource: "exact" }`

前端处理：

1. 将 `HH:mm` + 当天日期转为 epoch ms → `startAt` / `endAt`
2. `timeResolution: 'exact'`
3. `errors: []`
4. `needsUserConfirmation: true`（endTime 可能是 AI 默认的 +30 分钟）

#### 时段词（`timeSource: 'period'`）

AI 返回示例：`{ startTime: "09:00", endTime: "11:00", timeSource: "period", periodLabel: "上午" }`

前端处理：

1. 将 `HH:mm` + 当天日期转为 epoch ms → `startAt` / `endAt`
2. `timeResolution: 'period'`
3. `suggestedTimeLabel` = AI 返回的 `periodLabel`
4. `needsUserConfirmation: true`

#### 缺少时间（`timeSource: 'missing'`）

AI 返回示例：`{ timeSource: "missing" }`（无 startTime / endTime）

前端处理：

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

#### 必改（6 个文件）

| 文件 | 改动说明 |
|------|----------|
| `src/features/chat/ChatInputBar.tsx` | 新增 `onOpenMagicPen` prop + 左侧按钮 |
| `src/features/chat/ChatPage.tsx` | 新增 `isMagicPenOpen` + `restoreInputRef` 状态，渲染 `MagicPenSheet`（≤15 行新增） |
| `src/api/client.ts` | 新增 `callMagicPenParseAPI()` 函数 |
| `src/i18n/locales/en.ts` | 新增魔法笔 i18n key（见第 11 节） |
| `src/i18n/locales/zh.ts` | 同步新增中文翻译 |
| `src/i18n/locales/it.ts` | 同步新增意大利文翻译 |

#### 必增（7 个文件）

| 文件 | 职责 |
|------|------|
| `api/magic-pen-parse.ts` | Serverless endpoint：接收原始文本 → 调用智谱 AI → 返回结构化 JSON |
| `src/features/chat/MagicPenSheet.tsx` | Sheet 组件：草稿展示、编辑、提交 |
| `src/services/input/magicPenTypes.ts` | 类型定义（前端 draft 类型 + AI 响应类型） |
| `src/services/input/magicPenParser.ts` | 前端解析入口：预处理 → 调用 API → 调用 draftBuilder |
| `src/services/input/magicPenDraftBuilder.ts` | 从 AI 结果组装标准 draft + HH:mm→epoch 转换 + 校验纯函数 |
| `src/store/magicPenActions.ts` | 跨 store 提交编排 |
| `src/services/input/magicPenDraftBuilder.test.ts` | draft 组装 + 校验单元测试 |

#### 可选新增

| 文件 | 条件 |
|------|------|
| `src/features/chat/magicPenSheetHelpers.ts` | 当 `MagicPenSheet.tsx` 行数接近 400 时，抽出 UI helper |
| `src/store/magicPenActions.test.ts` | 提交流程单元测试 |
| `api/magic-pen-parse.test.ts` | AI 响应解析 + 校验单元测试 |

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

1. 展示并编辑 drafts
2. 展示 `unparsedSegments` 引导
3. 调用 `commitMagicPenDrafts()`
4. 处理部分成功 / 失败态
5. 回调 `onClose(submitted)`

### 9.3 Serverless 层职责

#### `api/magic-pen-parse.ts`

新增 Vercel Serverless Function，复用现有 `api/http.ts` 基础设施：

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError, requireMethod } from './http.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res, ['POST']);
  if (handlePreflight(req, res)) return;
  if (!requireMethod(req, res, 'POST')) return;

  const { rawText, lang = 'zh', todayDateStr, currentHour } = req.body;

  // 参数校验...
  // 构建 prompt（替换 {{todayDateStr}} 和 {{currentHour}}）...
  // 调用智谱 AI（复用 ZHIPU_API_KEY）...
  // 解析响应 + 校验...
  // 返回 { success: true, data: MagicPenAIResult }
}
```

必须同步更新 `api/README.md` 的端点清单，新增一行：

```
| `/api/magic-pen-parse` | `magic-pen-parse.ts` | `{ success: true, data: { segments, unparsed } }` |
```

### 9.4 前端服务层职责

#### `magicPenParser.ts`

```ts
import type { MagicPenParseResult } from './magicPenTypes';

export async function parseMagicPenInput(rawText: string): Promise<MagicPenParseResult>;
```

负责：预处理 → 调用 `callMagicPenParseAPI()` → 调用 `buildDraftsFromAIResult()` → 返回 `MagicPenParseResult`。

> [!IMPORTANT]
> 这是 **async 函数**，与 v3.x 的同步版本不同。所有调用方必须 `await`。

#### `magicPenDraftBuilder.ts`

```ts
import type { MagicPenDraftItem, MagicPenDraftErrorCode } from './magicPenTypes';
import type { MagicPenAIResult } from './magicPenTypes';
import type { Message } from '../../store/useChatStore';

/** 将 AI 结果转换为标准 draft 列表 */
export function buildDraftsFromAIResult(
  aiResult: MagicPenAIResult,
  today: Date,
): MagicPenParseResult;

/** 将 HH:mm 字符串 + 日期转为 epoch ms */
export function timeStringToEpoch(timeStr: string, date: Date): number;

/** 基于当前 messages 和 ongoing activity 对 drafts 执行校验 */
export function validateDrafts(
  drafts: MagicPenDraftItem[],
  messages: Message[],
): MagicPenDraftItem[];
```

负责：从 AI 结构化结果组装标准 draft、HH:mm→epoch 时间转换、生成默认 Todo 字段、执行纯函数校验。

### 9.5 Store 编排职责

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

建议新增 key（当前版本不含 Sheet 内解析按钮相关 key）：

```ts
// en.ts 中示例
chat_magic_pen_open: 'Magic Pen',
chat_magic_pen_title: 'Magic Pen',
chat_magic_pen_subtitle: 'Backfill missed activities or extract to-dos',
chat_magic_pen_confirm: 'Write All',
chat_magic_pen_cancel: 'Cancel',
chat_magic_pen_group_activity: 'Activity Backfill',
chat_magic_pen_group_todo: 'New To-dos',
chat_magic_pen_group_unparsed: 'Unrecognized',
chat_magic_pen_unparsed_hint: 'These could not be auto-recognized. You can add them manually via the main input.',
chat_magic_pen_missing_time: 'Start & end time required',
chat_magic_pen_estimated_time: 'Estimated time - please confirm',
chat_magic_pen_invalid_time: 'Invalid time range',
chat_magic_pen_overlap: 'Time overlaps with another item',
chat_magic_pen_overlap_hint: 'Conflicts with "{{activity}}" - please adjust',
chat_magic_pen_partial_success: 'Some items failed, you can retry',
chat_magic_pen_success_summary: 'Backfilled {{activityCount}} activities, added {{todoCount}} to-dos',
chat_magic_pen_ai_error: 'Analysis failed, please try again',
chat_magic_pen_ai_retry: 'Retry',
chat_magic_pen_service_unavailable: 'Service temporarily unavailable',
```

同步补齐 `zh.ts` 和 `it.ts`。

## 12. 测试要求

> [!NOTE]
> 当前仓库已有 `Vitest` 的纯函数 / store 测试基线，但没有 `@testing-library/react` 这类组件测试依赖。V1 自动化测试以 draftBuilder（纯函数）/ store-orchestration 为主。AI 解析质量通过手工验收覆盖，不需要 mock AI 调用做端到端自动化。

### 12.1 draftBuilder 单元测试

`src/services/input/magicPenDraftBuilder.test.ts` 至少覆盖：

| 序号 | 用例分类 | 最少数量 |
|------|----------|----------|
| 1 | AI 返回活动 segment → 正确组装 activity draft | 5 条 |
| 2 | AI 返回 todo segment → 正确组装 todo draft | 3 条 |
| 3 | AI 返回混合 segments → 正确拆分 | 3 条 |
| 4 | AI 返回空 / unparsed → 正确处理 | 2 条 |
| 5 | HH:mm → epoch 转换精度 | 4 条 |
| 6 | timeSource: missing → 生成 missing_time error | 2 条 |
| 7 | batch 内重叠检测 | 3 条 |
| 8 | ongoing activity 冲突检测 | 2 条 |
| **合计** | | **≥ 24 条** |

#### HH:mm → epoch 转换精度专项（第 5 类）

| 序号 | AI 返回 | 预期 startAt | 预期 endAt | timeResolution |
|------|------|-------------|------------|----------------|
| 5.1 | `startTime:"09:00", endTime:"11:00", timeSource:"period"` | 当天 09:00 | 当天 11:00 | `period` |
| 5.2 | `startTime:"15:00", endTime:"17:00", timeSource:"period"` | 当天 15:00 | 当天 17:00 | `period` |
| 5.3 | `startTime:"20:00", endTime:"21:00", timeSource:"period"` | 当天 20:00 | 当天 21:00 | `period` |
| 5.4 | `startTime:"10:00", endTime:"10:30", timeSource:"exact"` | 当天 10:00 | 当天 10:30 | `exact` |

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
| 7 | `待会跑步` | 生成 todo draft 且日期默认为今天 |
| 8 | 断网状态发送（mode-on） | 走本地 fallback，仍打开 Sheet |

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
2. 新增 `/api/magic-pen-parse` endpoint（复用现有 serverless 基础设施和 `ZHIPU_API_KEY`）。
3. 不把解析逻辑写进 `ChatPage.tsx`。
4. 不把历史补录走到 `sendMessage()`。
5. 不破坏报告页对活动时长的统计逻辑。
6. 所有新文案接入 i18n。
7. `ChatPage.tsx` 不承载解析或提交业务逻辑；页面层改动保持在 wiring 级别，目标增量约 ≤ 30 行。
8. 所有新文件 ≤ 400 行。
9. 同步更新 `api/README.md` 端点清单。

## 14. Phase 划分

### Phase 1（本期）

1. 聊天页入口（`ChatInputBar` 按钮 + `ChatPage` 状态）
2. `MagicPenSheet` 完整交互（草稿编辑、冲突提示、部分失败重试）
3. `/api/magic-pen-parse` serverless endpoint（智谱 GLM-4.7-flash）
4. `src/api/client.ts` 新增 `callMagicPenParseAPI()`
5. `magicPenDraftBuilder.ts`：AI 结果 → 标准 draft + 校验
6. 活动草稿编辑与时间补全
7. 活动草稿提交（通过 `insertActivity`）
8. Todo 草稿提交
9. 单元测试（≥ 24 条 draftBuilder 测试 + 提交流程测试）

### Phase 2

1. 更细的冲突提示（如提示具体哪条活动被切分）
2. 更完整的部分失败重试体验
3. AI prompt 优化（基于实际使用反馈调整）

### Phase 3

1. [已完成] 多语言 prompt 增强（en / it 专用 prompt 路由）
2. 可选 telemetry（AI 解析质量监控）
3. 离线降级方案（可选：简单正则兜底）

## 15. 明确不在本期处理的事项

1. 会员 gating 逻辑
2. 主输入建议跳转魔法笔
3. 新的日历 / 日程数据模型
4. 跨天补录
5. 离线正则降级

## 16. 实施结论

对当前仓库最稳妥的落地方式是：

1. 在聊天页输入栏新增一个显式魔法笔按钮。
2. 用独立 `MagicPenSheet` 承接输入、解析、编辑和提交。
3. 解析层采用 AI 结构化提取（`/api/magic-pen-parse` → 智谱 GLM-4.7-flash），复用现有 serverless 基础设施和 `ZHIPU_API_KEY`。
4. 前端 `magicPenDraftBuilder.ts` 负责将 AI 结果转为标准 draft、做时间合法性校验和 batch 冲突检测——所有确定性逻辑不依赖 AI。
5. 活动补录直接调用 `insertActivity(null, null, content, startAt, endAt)`，绝不复用主输入发送链路。
6. Todo 提取复用 `useTodoStore.addTodo()`。
7. 主输入保持现有 `classifyLiveInput()` 正则方案不变（高频、简单二分类，正则是正确选择）。
8. `ChatPage.tsx` 改动保持在 wiring 级别；若页面层增量失控，必须继续外提 helper / action 文件，遵守 400 行编码规范。

只要按本文档执行，开发可以直接开始拆任务和编码，不需要再反复补产品口径。
