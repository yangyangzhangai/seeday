# 日记功能重建任务清单

> 创建时间：2026-03-24
> 目标：梳理旧日报功能现状，对齐当前数据结构，规划新日记的可视化呈现与 AI 日记数据管线

---

## 一、现状审计结论

### 1.1 后端逻辑层：完整保留，但存在对齐风险

| 模块 | 状态 | 文件路径 | 说明 |
|------|------|----------|------|
| Report Store | ✅ 完整 | `src/store/useReportStore.ts` | Report / ReportStats 接口定义完整，generateReport / generateTimeshineDiary 流程可用 |
| Report Actions | ✅ 完整 | `src/store/reportActions.ts` | createGeneratedReport / runTimeshineDiary / buildRawInput 三步走流程均在 |
| Report Helpers | ✅ 完整 | `src/store/reportHelpers.ts` | classifyActivities / computeMoodDistribution / computeDailyTodoStats 均在 |
| Report Calculator | ✅ 完整 | `src/lib/report-calculator/` | computeSpectrum / computeLightQuality / detectGravityMismatch / formatForDiaryAI 均在 |
| Classifier API | ✅ 完整 | `api/classify.ts` | AI 分类器端点 |
| Diary API | ✅ 完整 | `api/diary.ts` | Timeshine 观察手记生成端点，含中英文系统 prompt |
| Report API | ✅ 完整 | `api/report.ts` | 旧版 AI 分析端点 |
| DB Sync | ✅ 完整 | `syncReportToSupabase` | reports 表同步逻辑在 |

### 1.2 前端 UI 层：保留但已过时

| 组件 | 状态 | 文件路径 | 问题 |
|------|------|----------|------|
| ReportPage | ⚠️ 过时 | `src/features/report/ReportPage.tsx` | 硬编码中文（"查看日记本""生成日记"），依赖旧 PlantRootSection 布局 |
| ReportDetailModal | ⚠️ 未检查 | `src/features/report/ReportDetailModal.tsx` | 需要确认展示逻辑是否匹配当前 ReportStats |
| ReportStatsView | ⚠️ 未检查 | `src/features/report/ReportStatsView.tsx` | 需要确认字段是否对齐 |
| MoodPieChart | ⚠️ 过时 | `src/features/report/MoodPieChart.tsx` | SVG 饼图在，但可能需要更新为新设计 |
| ActivityRecordsView | ⚠️ 过时 | `src/features/report/ActivityRecordsView.tsx` | 需检查 |
| DiaryBookShelf | ⚠️ 过时 | `src/features/report/DiaryBookShelf.tsx` | 3D 翻页日记本，可能保留也可能废弃 |
| DiaryBookViewer | ⚠️ 过时 | `src/features/report/DiaryBookViewer.tsx` | 同上 |
| TaskListModal | ⚠️ 过时 | `src/features/report/TaskListModal.tsx` | 需检查 |

### 1.3 数据源全景（当前项目中所有可用的原始数据）

| 数据源 | Store | 关键字段 | 说明 |
|--------|-------|----------|------|
| 活动记录 | `useChatStore.messages` | content, timestamp, duration, activityType, mode='record', isMood | 用户通过聊天输入的活动 |
| 心情记录 | `useChatStore.messages` (isMood=true) | content, timestamp | 独立心情记录消息 |
| 心情关联 | `useMoodStore` | activityMood[msgId], customMoodLabel[msgId], moodNote[msgId] | 每条活动关联的心情 |
| 待办事项 | `useTodoStore.todos` | title, completed, priority, dueAt, recurrence, bottleId, category, scope | 日/周/月待办 |
| 成长瓶 | `useGrowthStore.bottles` | name, type(habit/goal), stars(0-21), status | 习惯和目标跟踪 |
| 植物数据 | `usePlantStore` | 日植物记录 | 与日报关联的植物生长 |
| 计算历史 | `useReportStore.computedHistory` | ComputedResult[] | 最近 7 天的计算结果，用于趋势对比 |

### 1.4 已知的两套分类体系

1. **ActivityRecordType**（6 类，前端本地分类）：`study | work | social | life | entertainment | health`
   - 文件：`src/lib/activityType.ts`
   - 用途：reportHelpers.classifyActivities() 统计活动分布

2. **DiaryClassifierCategory**（8 类，AI 分类器输出）：`deep_focus | recharge | body | necessary | social_duty | self_talk | dopamine | dissolved`
   - 文件：`src/lib/report-calculator/types.ts`
   - 用途：Timeshine 日记的光谱分布

3. **适配层**：`src/lib/categoryAdapters.ts` 负责两套体系的映射

---

## 二、数据对齐与代码清理任务

### 任务 A1：审计 ReportStats 接口与实际数据的对齐情况
- **具体操作**：逐字段检查 `ReportStats`（useReportStore.ts:22-69）与 `createGeneratedReport`（reportActions.ts:52-144）的产出是否一一匹配
- **需读文件**：
  - `src/store/useReportStore.ts`（ReportStats 定义）
  - `src/store/reportActions.ts`（createGeneratedReport 逻辑）
  - `src/store/reportHelpers.ts`（computeDailyTodoStats、classifyActivities、computeMoodDistribution）
- **完成标准**：列出所有字段的填充来源，标注哪些字段可能为空、哪些字段已废弃

### 任务 A2：审计 Message 类型字段是否都被正确使用
- **具体操作**：检查 `Message.activityType`、`Message.duration`、`Message.isMood`、`Message.mode` 这几个字段在日报管线中的使用方式是否与 useChatStore 的实际写入一致
- **需读文件**：
  - `src/store/useChatStore.types.ts`（Message 接口）
  - `src/store/useChatStore.ts`（sendMessage 实现，看写入了哪些字段）
  - `src/store/reportHelpers.ts`（filterActivities 如何过滤）
- **完成标准**：确认没有遗漏字段、没有读取了已删除的字段

### 任务 A3：审计 MoodStore 在日报中的使用方式
- **具体操作**：确认 `activityMood`、`customMoodLabel`、`customMoodApplied`、`moodNote` 四个 map 在报告计算中是否被正确消费
- **需读文件**：
  - `src/store/useMoodStore.ts`
  - `src/store/reportHelpers.ts`（computeMoodDistribution）
  - `src/store/reportActions.ts`（buildRawInput 中对 moodNote 的使用）
- **完成标准**：确认数据流完整无断裂

### 任务 A4：审计 Todo 数据在日报中的消费方式
- **具体操作**：检查 `useTodoStore.todos` 的字段（特别是 `bottleId`、`scope`、`recurrence`、`priority`、`isTemplate`）在 reportHelpers 中的使用是否与当前 Todo 接口匹配
- **需读文件**：
  - `src/store/useTodoStore.ts`（Todo 接口定义）
  - `src/store/reportHelpers.ts`（filterRelevantTodos、computeDailyTodoStats）
- **完成标准**：确认 Todo 字段全部对齐，priority 映射正确

### 任务 A5：审计 GrowthStore（Bottles）在日报中的消费方式
- **具体操作**：确认 `bottles` 数据的 `type`、`stars`、`status` 字段在 reportActions/reportHelpers 中被正确读取
- **需读文件**：
  - `src/store/useGrowthStore.ts`（Bottle 接口）
  - `src/store/reportActions.ts`（BottleSnapshot 接口、activeBottles 过滤）
  - `src/store/reportHelpers.ts`（computeDailyTodoStats 中 BottleInfo）
- **完成标准**：确认 BottleSnapshot/BottleInfo 与 Bottle 接口对齐

### 任务 A6：审计前端 Report 组件中的硬编码中文
- **具体操作**：扫描 `src/features/report/` 下所有组件，找出硬编码中文字符串，改为 i18n key
- **需读文件**：`src/features/report/*.tsx`、`src/i18n/locales/zh.ts`
- **完成标准**：所有用户可见文本通过 `t()` 引用

### 任务 A7：清理 reportHelpers 中的硬编码中文
- **具体操作**：`reportHelpers.ts` 中的 `ACTION_CATEGORY_LABELS`、`ACTION_CATEGORY_ENCOURAGEMENT`、`FALLBACK_SUMMARY`、`generateMoodSummary` 等都有硬编码中文，需要决定是改成 i18n 还是这些只作为内部数据不对用户展示
- **需读文件**：`src/store/reportHelpers.ts`
- **完成标准**：明确每段中文的用途（AI 输入 vs 用户展示），分别处理

---

## 三、可视化规划

### 3.1 推荐的日记界面可视化模块

基于现有数据，以下是建议在新日记界面中展示的可视化模块：

#### 模块 V1：活动分类圆环图（Activity Category Donut）
- **数据来源**：`reportHelpers.classifyActivities()` → 6 类活动的 minutes 和 percent
- **可视化形式**：圆环图 / 甜甜圈图
- **交互**：点击某类别可展开该类别的活动列表
- **颜色映射**：每个 ActivityRecordType 一个固定颜色

#### 模块 V2：心情能量曲线（Mood Energy Timeline）
- **数据来源**：
  - `computeMoodDistribution()` → mood-minutes 分布
  - `useMoodStore.activityMood` → 每条活动的心情标记
  - `useChatStore.messages`（isMood=true）→ 独立心情记录带时间戳
- **可视化形式**：时间轴曲线（X 轴 = 时间 0:00-24:00，Y 轴 = 能量/心情分值）
- **心情分值映射**（建议）：
  - 高能量正面：happy(5), focused(4.5), satisfied(4)
  - 中性：calm(3)
  - 低能量/负面：tired(2), bored(1.5), anxious(1.5), down(1)
- **叠加信息**：在曲线上标注关键活动节点

#### 模块 V3：光谱分布条形图（Spectrum Bar Chart）
- **数据来源**：`computeSpectrum()` → 8 类光谱的 duration_min 和 ratio
- **可视化形式**：水平条形图，每条带 emoji 和颜色
- **说明**：这是 AI 分类器的 8 类分布，展示用户时间的"光谱"

#### 模块 V4：待办完成卡片（Todo Completion Card）
- **数据来源**：`computeDailyTodoStats()` → habitCheckin, goalProgress, independentRecurring, oneTimeTasks
- **可视化形式**：紧凑卡片
  - 顶部：总完成率圆形进度条
  - 下方分组：习惯打卡（✓/✗列表）、目标进展（星星进度）、独立循环任务、一次性任务（按优先级分高/中/低）
- **交互**：点击展开完整任务列表

#### 模块 V5：光质读数仪表盘（Light Quality Dashboard）
- **数据来源**：`computeLightQuality()` → focus_ratio, active_ratio, todo_ratio
- **可视化形式**：三组对比条
  - 专注聚光 vs 碎片散光
  - 主动燃烧 vs 被动响应
  - 待办着陆率
- **颜色**：渐变色条，左蓝右灰

#### 模块 V6：每日心情分布饼图（已有组件可复用）
- **数据来源**：`computeMoodDistribution()` → mood-minutes 数组
- **可视化形式**：现有 `MoodPieChart.tsx` 的 SVG 饼图，可能需要样式更新
- **颜色**：复用 `src/lib/moodColor.ts` 中的 8 色心情映射

### 3.2 可视化实现任务

#### 任务 V1：设计新日记页面布局
- **具体操作**：确定新日记页面的整体结构、模块排列、滚动方式
- **需读文件**：
  - `src/features/report/ReportPage.tsx`（现有布局参考）
  - `src/features/report/ReportDetailModal.tsx`（现有详情展示）
  - `docs/TSHINE_DEV_SPEC.md`（iOS UI 规范）
- **完成标准**：产出 wireframe 或组件树结构

#### 任务 V2：实现活动分类圆环图组件
- **具体操作**：基于 classifyActivities() 的输出，用 SVG 或 Canvas 实现圆环图
- **需读文件**：`src/store/reportHelpers.ts`（classifyActivities）
- **完成标准**：接收 `{ category, minutes, percent }[]` 渲染圆环

#### 任务 V3：实现心情能量曲线组件
- **具体操作**：基于心情数据 + 时间戳，绘制日内能量变化曲线
- **需读文件**：
  - `src/store/useMoodStore.ts`（心情数据结构）
  - `src/lib/moodOptions.ts`（8 种心情定义）
  - `src/lib/moodColor.ts`（颜色）
- **完成标准**：接收一天的心情记录数组，渲染平滑曲线

#### 任务 V4：更新/重构光谱条形图组件
- **具体操作**：将 formatForDiaryAI 中纯文本的光谱展示改为可视化条形图组件
- **需读文件**：`src/lib/report-calculator/types.ts`（SpectrumItem）
- **完成标准**：接收 SpectrumItem[] 渲染水平条形图

#### 任务 V5：实现待办完成卡片组件
- **具体操作**：将 DailyTodoStats 渲染为紧凑卡片
- **需读文件**：`src/store/reportHelpers.ts`（DailyTodoStats 接口）
- **完成标准**：展示习惯、目标、循环、一次性任务四组数据

#### 任务 V6：实现光质读数组件
- **具体操作**：将 LightQuality 渲染为三组对比条
- **需读文件**：`src/lib/report-calculator/types.ts`（LightQuality 接口）

#### 任务 V7：整合新日记页面
- **具体操作**：将上述可视化组件整合到新日记页面，替换或重构 ReportPage
- **需读文件**：`src/features/report/ReportPage.tsx`

---

## 四、AI 观察日记数据管线规划

### 4.1 当前管线（已有，三步走）

```
用户活动/心情/待办 → buildRawInput() → callClassifierAPI() → computeAll() → formatForDiaryAI() → callDiaryAPI() → Timeshine 观察手记
```

### 4.2 传递给 AI 的数据清单

#### 原始数据（直接传递，不经计算）
| 数据 | 来源 | 传递方式 | 当前状态 |
|------|------|----------|----------|
| 活动列表（内容+时间+时长） | useChatStore.messages | buildRawInput() 格式化为文本 | ✅ 已实现 |
| 心情记录（独立心情消息） | useChatStore.messages (isMood) | buildRawInput() 格式化 | ✅ 已实现 |
| 心情备注 | useMoodStore.moodNote | buildRawInput() 附加到活动后 | ✅ 已实现 |
| 习惯打卡 | computeDailyTodoStats.habitCheckin | buildRawInput() 格式化 | ✅ 已实现 |
| 目标进展 | computeDailyTodoStats.goalProgress | buildRawInput() 格式化 | ✅ 已实现 |
| 待办完成总览 | computeDailyTodoStats 汇总 | buildRawInput() 格式化 | ✅ 已实现 |
| 用户昵称 | useAuthStore.user.user_metadata.display_name | 传给 callDiaryAPI | ✅ 已实现 |
| 历史上下文 | computedHistory (最近3天) | buildHistoryContext() 格式化 | ✅ 已实现 |

#### 经过处理/计算的数据
| 数据 | 计算逻辑 | 传递方式 | 当前状态 |
|------|----------|----------|----------|
| 8 类光谱分布 | AI 分类器 → computeSpectrum() | formatForDiaryAI() 格式化为结构化文本 | ✅ 已实现 |
| 光质读数（专注/散光/主动/被动） | computeLightQuality() | formatForDiaryAI() | ✅ 已实现 |
| 能量曲线（上午/下午/晚间） | AI 分类器返回 energy_log | formatForDiaryAI() | ✅ 已实现 |
| 引力错位检测 | detectGravityMismatch() | formatForDiaryAI() | ✅ 已实现 |
| 历史趋势信号 | computeHistoryTrend() | formatForDiaryAI() | ✅ 已实现 |

#### 当前缺失/可增强的数据
| 缺失数据 | 来源 | 增强价值 | 优先级 |
|-----------|------|----------|--------|
| 每条活动的关联心情（mood per activity） | useMoodStore.activityMood | 让 AI 知道用户做某事时的心情 | 🔴 高 |
| 自定义心情标签 | useMoodStore.customMoodLabel | 更精准的心情描述 | 🟡 中 |
| 一次性待办的具体完成项 | oneTimeTasks.completedTitles | 让 AI 可以提到具体完成了什么 | ✅ 已有 |
| 瓶子（习惯/目标）的描述上下文 | useGrowthStore.bottles.name | 让 AI 理解习惯/目标的含义 | 🟡 中 |
| 专注总时长统计 | 从 classifyActivities 的 study+work 分钟数 | 让 AI 精确提到 "你今天专注了 X 小时" | 🟡 中 |
| 活动间隔/休息时间 | 从活动时间戳计算空白间隔 | 让 AI 观察用户的节奏是否有足够休息 | 🟢 低 |
| 每日目标（dailyGoal） | useGrowthStore.dailyGoal | 让 AI 对比目标与实际 | 🟡 中 |

### 4.3 如何让 AI 写出更好的日记

**核心原则**：给 AI 的数据应该是 **有情感温度的事实**，而非冰冷的数字。

1. **心情与活动关联**（高优先级）：
   - 当前 buildRawInput 只列出活动和独立心情，没有把 `activityMood[msgId]` 关联上去
   - 改进：在每条活动后面附加 `[心情：开心]` 这样的标记
   - 效果：AI 可以写出 "ta 做了 XX 时是开心的" 这种有温度的观察

2. **完成事项高亮**（已部分实现）：
   - `oneTimeTasks.completedTitles` 已经传了
   - 可增强：将高优先级任务的完成用特殊标记

3. **每日目标对比**（中优先级）：
   - 将 `useGrowthStore.dailyGoal` 传给 AI
   - 效果：AI 可以写出 "ta 今天的目标是 XX，实际上做到了..."

4. **历史趋势叙事化**（已实现但可增强）：
   - 当前只传了专注时长和待办率的趋势
   - 可增强：加入心情趋势（连续几天焦虑/开心等）

### 4.4 AI 数据管线任务

#### 任务 D1：增强 buildRawInput - 关联活动心情
- **具体操作**：在 `buildRawInput()` 中，为每条活动附加 `activityMood[msg.id]` 信息
- **需读文件**：
  - `src/store/reportActions.ts`（buildRawInput 函数）
  - `src/store/useMoodStore.ts`（activityMood 结构）
- **需改文件**：`src/store/reportActions.ts`
- **完成标准**：rawInput 中每条活动带上心情标记（如果有的话）

#### 任务 D2：增强 buildRawInput - 纳入每日目标
- **具体操作**：将 `useGrowthStore.dailyGoal` 加入 rawInput
- **需读文件**：`src/store/useGrowthStore.ts`
- **需改文件**：`src/store/reportActions.ts`（buildRawInput 签名需增加 dailyGoal 参数）、调用处 `runTimeshineDiary`
- **完成标准**：rawInput 中包含 "今日目标：XXX"

#### 任务 D3：增强 buildRawInput - 多语言支持审查
- **具体操作**：确认 buildRawInput 中所有文案都正确支持 zh/en/it，当前 `isZh` 二元判断可能遗漏意大利语
- **需读文件**：`src/store/reportActions.ts`
- **完成标准**：所有文案三语覆盖

#### 任务 D4：增强 formatForDiaryAI - 优化传递给 AI 的数据格式
- **具体操作**：审查 `formatForDiaryAI()` 是否充分利用了所有可用数据
- **需读文件**：`src/lib/report-calculator/formatter.ts`
- **完成标准**：确认格式化输出信息完整、清晰

#### 任务 D5：增强历史趋势 - 纳入心情趋势
- **具体操作**：在 `computeHistoryTrend()` 中增加心情维度的趋势分析
- **需读文件**：`src/lib/report-calculator/core.ts`（computeHistoryTrend）
- **需改文件**：`src/lib/report-calculator/core.ts`、`types.ts`（可能需要 ComputedResult 增加 mood 字段）
- **完成标准**：趋势信号中包含心情变化方向

#### 任务 D6：确认分类器 API prompt 与当前数据结构对齐
- **具体操作**：审查 `api/classify.ts` 中的 prompt 是否反映了当前所有数据字段
- **需读文件**：`api/classify.ts`
- **完成标准**：确认分类器输入/输出格式与 ClassifiedData 类型完全匹配

---

## 五、执行顺序建议

### Phase 1：数据对齐（必须先完成）
```
A1 → A2 → A3 → A4 → A5（按依赖关系串行，约 2-3 小时）
```

### Phase 2：代码清理（可与 Phase 3 并行）
```
A6 + A7（i18n 清理）
```

### Phase 3：AI 数据管线增强
```
D1 → D2 → D3 → D6 → D4 → D5（D1 优先级最高）
```

### Phase 4：可视化组件开发
```
V1（布局设计）→ V2 + V3 + V4 + V5 + V6（可并行开发）→ V7（整合）
```

---

## 六、关键注意事项

1. **不要删除旧组件**：旧的 Report 组件全部保留，新组件在旁边新建或渐进替换
2. **两套分类体系共存**：ActivityRecordType（6 类）和 DiaryClassifierCategory（8 类）各有各的用途，不要合并
3. **测试覆盖**：每个 Phase 完成后执行 `npm run lint:all` + 相关单测
4. **i18n 约束**：所有新增用户可见文本必须通过 `t()` 引用
5. **文件行数约束**：新文件不超过 400 行
