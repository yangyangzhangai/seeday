# Plantime 新手引导完整方案 v1.4

> 更新：2026-04-09（按《用户画像模块 需求与技术文档 v1.1》同步）

---

## 1. 设计理念

Plantime 的核心体验是 **记录 → 成长 → 回顾** 的闭环。导览目标不是逐一讲完所有功能，而是让用户在 **45 秒内**轻松理解这个循环，并愿意马上开始使用。

首次导览为：
- **保留 5 步结构**
- **全程只要求 1 次输入**
- **Step 3 只看不做**
- **心情自动归入不要求现场演示**，只做一句轻提示，剩余认知交给真实使用过程或功能发现层承接

### 精简后的目标体验

| 步骤 | 内容 | 用户操作 | 预估耗时 |
|------|------|---------|---------|
| 1 | 欢迎 + 选 AI 伙伴 | 点选 | ~15s |
| 2 | 输入第一条活动 | **打字（唯一一次）** | ~15s |
| 3 | 卡片能力提示 | 点“下一步” | ~5s |
| 4 | 成长闭环预览 | 点“下一步” | ~5s |
| 5 | 日记与植物预告 | 点“开始” | ~5s |

**总计约 45 秒**。核心感受是：轻、快、没有被教学打断。

### 核心原则

| 原则 | 做法 |
|------|------|
| **少做一次，就是少很多阻力** | 首次导览只保留一次必要输入 |
| **做，而非连续考试** | 只在最关键处让用户真实操作一次，其余步骤以轻提示完成 |
| **5 步以内** | 首次导览严格 5 步，其余靠功能发现 |
| **不阻塞核心路径** | 任何时候都能跳过 |
| **iOS 原生感** | Bottom Sheet、聚光灯、slide 动画、44pt 触控区 |
| **i18n 就绪** | 所有文案走 `t('onboarding.*')`，中/英/意三语同步 |
| **不重复打扰** | 每个提示只出现一次，persist 到本地存储 |

---

## 2. 引导分层架构

```
引导系统分三段：

第一层：首次登录导览（Welcome Tour）
  - 首次进入 /chat 时触发，5 步 coach marks
  - 目标是用最少操作讲清主闭环：
    AI 伙伴 → 第一条活动 → 卡片可编辑/心情会自动归入 → 目标瓶成长 → 日记与植物

第二层：认识你（Profile Tour）
  - Welcome Tour 完成后延迟 1 秒触发
  - 5 步轻问答：使用目的 → 作息+饭点 → 近期目标 → 人生目标（可选）→ 重要日期（可选）
  - 目标是建立最小可用用户画像（与 `user_profile_v2.manual` 对齐）

第三层：功能发现提示（Feature Discovery）
  - 惰性触发，满足条件时首次出现
  - 必须在 Profile Tour 完成后才开始触发
  - 覆盖进阶功能：魔法笔、心情卡片转换、营养液浇灌、日记本、日历选日期等
```

**分层原则**：
- 首次导览只负责“让用户开始用”
- 画像收集只负责“让 AI 更懂你”，不夹在功能教学里
- 不在画像流程中直接问“你是什么性格”，避免问卷感
- 不在首次导览里展开所有细节
- 能在真实使用里自然学会的，不强行现场演示

---

## 3. 功能现状速查（基于最新代码）

> 导览方案依据以下已实现的功能设计，确保不介绍尚未上线的能力。

### 3.1 记录页 `/chat` — 活动与心情

**活动记录**：用户在输入栏键入文字 → `classifyLiveInput()` 自动判断是“活动”还是“心情” → 分别调用 `sendMessage()` 或 `sendMood()`。

**心情双路径**：
1. **MoodPicker 选择**：点击活动卡片右侧心情图标，从 8 种预设心情（happy/calm/focused/satisfied/tired/anxious/bored/down）中选择，直接附着到该活动卡。
2. **输入栏输入心情文字**：被分类为 mood 后调用 `sendMood()` → 自动查找当日最近的活动卡 → 作为 `MoodDescription` 附着到该活动卡上。若跨天则标记为 `detached: true`，显示为独立心情卡片。

**心情卡片转换**（已实现）：
- **从活动卡中拆出心情** → `detachMoodFromEvent()` → 心情变为独立心情卡片（`detached: true`）
- **心情卡片归还到事件** → `reattachMoodToEvent()` → 重新附着到最近活动卡
- **心情卡片转成活动卡** → `convertMoodToEvent()` → `isMood` 变为 `false`，变成普通活动

**魔法笔**（`MagicPenSheet`）：高级批量输入模式，一次解析多条活动/心情/待办。

### 3.2 成长页 `/growth` — 目标瓶与待办

**目标瓶（Bottle）**：
- 类型：`habit`（习惯）或 `goal`（目标）
- 星星：0–21 颗，通过完成待办或活动自动匹配获得
- **满瓶（21 颗星）** → 状态变为 `achieved`
- **浇灌植物**：满瓶后可以“制作成营养液浇灌植物”（`markBottleIrrigated()`），归档该瓶子（本地移除，云端标记 `irrigated` 保留历史）
- **继续追踪**：或选择 `continueBottle()` 重置星星、进入下一轮

**待办（Todo）**：支持优先级、周期（单次/每日/每周/每月）、关联目标瓶。完成待办可为关联瓶子增加星星。

**专注模式**：番茄钟计时器，完成后自动结算待办 + 创建活动卡 + 给关联瓶子加星。

### 3.3 日记页 `/report` — 植物、日报与日记本

**植物根系**：每日活动按 5 个类别（工作学习/运动/社交/娱乐/生活）映射到植物根系的 5 个方向，活动时长决定根系长度。

**日记生成**：每天晚上 8 点后可生成 AI 日记（Timeshine Diary），包含活动分析、心情洞察、AI 伙伴个性化点评。

**日记本书架**（`DiaryBookShelf`）：按月展示生成过的日记，可翻页浏览。

**日历选日期**：点击页面上方日历图标打开日历弹窗，选择历史日期查看/生成该日日记与报告。

### 3.4 我的页 `/profile` — AI 伙伴与设置

**4 个 AI 伙伴**：Van（治愈花语）、Agnes（温柔引导）、Zep（犀利观察）、Momo/春雷（从容温吞，PLUS 专属）。影响批注语气、日记生成风格、植物日记 prompt。

**其他设置**：批注频率（低/中/高）、每日目标开关、植物方向自定义、语言切换、会员状态。

---

## 4. 第一层：首次登录导览（Welcome Tour）

### 触发与退出

- **触发条件**：注册完成 → 首次进入 `/chat` 页面时自动启动
- **退出方式**：任意步骤可点“跳过全部”退出，标记为已完成
- **存储**：`useOnboardingStore` 中的 `tourCompleted: boolean`
- **导览节奏**：除 Step 2 外，其余步骤都不要求用户输入内容

---

### Step 1 — 欢迎 + 选择 AI 伙伴

**展现形式**：全屏底部弹出 Bottom Sheet

```
┌─────────────────────────────────────┐
│                                     │
│  👋 欢迎来到 Plantime               │
│                                     │
│  先选一位 AI 伙伴陪你记录每一天：     │
│                                     │
│  ┌────────┐ ┌────────┐ ┌────────┐  │
│  │  Van   │ │ Agnes  │ │  Zep   │  │
│  │ 治愈花语│ │ 温柔引导│ │ 犀利观察│  │
│  └────────┘ └────────┘ └────────┘  │
│                                     │
│  ┌────────────────────────────────┐ │
│  │  Momo  🔒 PLUS                 │ │
│  │  从容温吞                       │ │
│  └────────────────────────────────┘ │
│                                     │
│       [ 选好了，下一步 → ]           │
│                                     │
│            跳过全部                  │
└─────────────────────────────────────┘
```

**设计要点**：
- 默认选中 Van（治愈系，最通用）
- Momo 显示 PLUS 锁标，点击弹出简短 PLUS 说明
- 选择结果直接写入 `useAuthStore.preferences.companionMode`
- 动画：Bottom Sheet 从底部 slide up（Framer Motion）

**i18n keys**：
- `onboarding.welcome_title` → “欢迎来到 Plantime” / “Welcome to Plantime” / “Benvenuto su Plantime”
- `onboarding.choose_companion` → “先选一位 AI 伙伴陪你记录每一天”
- `onboarding.companion_van` → “治愈花语”
- `onboarding.companion_agnes` → “温柔引导”
- `onboarding.companion_zep` → “犀利观察”
- `onboarding.companion_momo` → “从容温吞”
- `onboarding.next_step` → “选好了，下一步”
- `onboarding.skip_all` → “跳过全部”

---

### Step 2 — 记录你的第一条活动

**展现形式**：聚光灯高亮底部输入栏 + 上方提示气泡

```
┌─────────────────────────────────────┐
│                                     │
│         （页面整体变暗）              │
│                                     │
│    ┌───────────────────────┐        │
│    │  试试输入你正在做的事   │        │
│    │  比如“吃早餐”或“开会”  │        │
│    │          ▼             │        │
│    └───────────────────────┘        │
│                                     │
│  ╔═══════════════════════════════╗  │
│  ║  输入你正在做的事...    [发送] ║  │  ← 聚光灯高亮
│  ╚═══════════════════════════════╝  │
│                                     │
│              跳过全部                │
└─────────────────────────────────────┘
```

**设计要点**：
- 这是首次导览里**唯一一次真实输入**
- 用户**真正输入并发送**后，timeline 出现第一张活动卡片，自动进入 Step 3
- 如果用户点“跳过”，系统插入一条示例活动（内容为 `t('onboarding.sample_activity')`，如“☕ 喝咖啡”）
- 聚光灯遮罩 `pointer-events: none`，仅输入栏区域可交互

**i18n keys**：
- `onboarding.try_input` → “试试输入你正在做的事”
- `onboarding.input_example` → “比如‘吃早餐’或‘开会’”
- `onboarding.sample_activity` → “☕ 喝咖啡”

---

### Step 3 — 你的第一张时间卡片

**展现形式**：聚光灯高亮 timeline 上刚创建的卡片

```
┌─────────────────────────────────────┐
│                                     │
│         （页面整体变暗）              │
│                                     │
│  ╔═══════════════════════════════╗  │
│  ║  09:30  ☕ 喝咖啡         😊  ║  │  ← 聚光灯高亮
│  ╚═══════════════════════════════╝  │
│                                     │
│    ┌───────────────────────────┐   │
│    │  ✨ 你的第一条记录！        │   │
│    │                           │   │
│    │  · 输入心情会自动关联到    │   │
│    │    这条活动上              │   │
│    │  · 点击卡片可以编辑        │   │
│    │                           │   │
│    │       [ 下一步 → ]        │   │
│    └───────────────────────────┘   │
│                                     │
│              跳过全部                │
└─────────────────────────────────────┘
```

**设计要点**：
- Step 3 **只看不做**，不要求用户第二次输入
- 只保留两个最值得记住的能力：
  1. **输入心情会自动归到这条活动上**
  2. **点击卡片可以编辑**
- 不在这里展开 MoodPicker、拆分心情卡、重新归还等细节
- 点击“下一步”后直接进入 Step 4

**设计取舍**：
- 心情自动归入保留为一句提示，但不强制演示
- 让用户在后续真实记录中自然验证这一点
- 复杂交互交给功能发现层，不在首次导览里教学完毕

**i18n keys**：
- `onboarding.first_record_title` → “你的第一条记录！”
- `onboarding.card_mood_auto_short` → “输入心情会自动关联到这条活动上”
- `onboarding.card_edit_short` → “点击卡片可以编辑”
- `onboarding.next` → “下一步”

---

### Step 4 — 成长闭环预览

**展现形式**：聚光灯高亮底部导航“成长”tab

```
┌─────────────────────────────────────┐
│                                     │
│         （页面整体变暗）              │
│                                     │
│    ┌───────────────────────────┐    │
│    │  🌱 创建目标瓶 → 收集星星   │    │
│    │     → 浇灌植物              │    │
│    │                            │    │
│    │       [ 下一步 → ]         │    │
│    └───────────────────────────┘    │
│              ▼                      │
│  ───────────────────────────────── │
│   记录    [🌱成长]   日记    我的   │  ← “成长”高亮
│  ───────────────────────────────── │
└─────────────────────────────────────┘
```

**设计要点**：
- 只用一句话传达成长逻辑，不再拆成 4 行说明
- 用户只需要理解成长页的大方向，不需要在首次导览里记住所有术语
- 点击“下一步”后进入 Step 5，不跳转页面

**i18n keys**：
- `onboarding.growth_loop` → “创建目标瓶 → 收集星星 → 浇灌植物 🌱”
- `onboarding.next` → “下一步”

---

### Step 5 — 日记、植物与收藏预告

**展现形式**：聚光灯高亮底部导航“日记”tab

```
┌─────────────────────────────────────┐
│                                     │
│         （页面整体变暗）              │
│                                     │
│    ┌───────────────────────────┐    │
│    │  🌳 每天晚上 8 点后        │    │
│    │  可以生成专属日记和植物     │    │
│    │                            │    │
│    │  日记会收藏进你的日记本 📖  │    │
│    │                            │    │
│    │   [ 开始使用 Plantime! ]   │    │
│    └───────────────────────────┘    │
│              ▼                      │
│  ───────────────────────────────── │
│   记录    成长    [📖日记]   我的   │  ← “日记”高亮
│  ───────────────────────────────── │
└─────────────────────────────────────┘
```

**设计要点**：
- 点击“开始使用 Plantime!”后，回到 `/chat` 页面
- 标记 `tourCompleted = true`
- 结束动画：全屏轻微 sparkle 效果（可选，0.5 秒）
- “植物形态由活动类型决定”这类次级说明不再放首次导览里，避免最后一步信息继续变重

**i18n keys**：
- `onboarding.report_title` → “每天晚上 8 点后可以生成专属日记和植物”
- `onboarding.report_diary` → “日记会收藏进你的日记本”
- `onboarding.start_app` → “开始使用 Plantime!”

---

## 5. 第二层：认识你（Profile Tour）

### 触发与退出

- **触发条件**：`tourCompleted === true` 后延迟 1 秒触发
- **退出方式**：每一步都可单独跳过，也可“跳过全部”；跳过即写默认值
- **完成标记**：`profileTourCompleted = true`（等价于 onboardingCompleted）
- **总耗时**：约 40 秒（P1~P5）

### P1 — 使用目的

**展现形式**：Bottom Sheet（伴侣头像 + 对话气泡 + 四宫格选项）

- 动态话术（按当前 AI 伙伴切换）：
  - Van: `onboarding.profile_p1_van`
  - Agnes: `onboarding.profile_p1_agnes`
  - Zep: `onboarding.profile_p1_zep`
  - Momo: `onboarding.profile_p1_momo`
- 选项（点选即进入 P2）：
  - `onboarding.profile_life_record` -> `life_record`
  - `onboarding.profile_organize_thoughts` -> `organize_thoughts`
  - `onboarding.profile_emotion_management` -> `emotion_management`
  - `onboarding.profile_habit_building` -> `habit_building`

### P2 — 作息 + 早午晚饭点

**展现形式**：同一 Bottom Sheet 内容切换（slide）

- 文案：`onboarding.profile_p2_default`
- 时间选择：起床/睡觉/早餐/午餐/晚餐共 5 个滚轮，30 分钟精度
- 默认值：`07:30` / `23:00` / `08:00` / `12:30` / `18:30`
- 字段：
  - `onboarding.profile_wake_label`
  - `onboarding.profile_sleep_label`
  - `onboarding.profile_breakfast_label`
  - `onboarding.profile_lunch_label`
  - `onboarding.profile_dinner_label`
- 点击 `onboarding.next` 进入 P3，或 `onboarding.profile_skip_step` 跳过

### P3 — 近期目标

**展现形式**：同一 Bottom Sheet 内容切换

- 文案：`onboarding.profile_p3_prompt`
- 常用选项（点选后可直接下一步）：
  - `onboarding.profile_goal_exam`（如备考）
  - `onboarding.profile_goal_interview`（如求职/面试）
  - `onboarding.profile_goal_fitness`（如减脂/运动）
  - `onboarding.profile_goal_balance`（如稳定作息/情绪）
- 支持自填：`onboarding.profile_goal_custom_placeholder`
- 点击 `onboarding.next` 进入 P4，或 `onboarding.profile_skip_step` 跳过

### P4 — 人生目标（可选）

**展现形式**：同一 Bottom Sheet（单段文本输入）

- 文案：`onboarding.profile_p4_prompt`
- 输入框：`onboarding.profile_life_goal_placeholder`
- 辅助文案：`onboarding.profile_p4_hint`
- 点击 `onboarding.next` 进入 P5，或 `onboarding.profile_skip_step` 跳过

### P5 — 重要日期（可选）

**展现形式**：同一 Bottom Sheet（最多 3 个日期表单）

- 文案：`onboarding.profile_p5_prompt`
- 字段：`onboarding.profile_anni_label` / `onboarding.profile_anni_repeat`
- 操作：`onboarding.profile_anni_add`（再加一个）
- 完成按钮：`onboarding.profile_start`（点后完成引导）
- 可跳过：`onboarding.profile_skip_step`

**完成反馈（Toast，1.5s）**：
- Van: `onboarding.profile_done_van`
- Agnes: `onboarding.profile_done_agnes`
- Zep: `onboarding.profile_done_zep`
- Momo: `onboarding.profile_done_momo`

### Profile Tour 写入结构

Profile Tour 完成后写入 `user_metadata.user_profile_v2`（第一阶段只写 `manual` + 可见纪念日）：

```typescript
{
  manual: {
    primaryUse,
    wakeTime,
    sleepTime,
    mealTimes,
    currentGoal,
    lifeGoal,
  },
  anniversariesVisible,
  onboardingCompleted: true,
  updatedAt: nowIso,
}
```

---

## 6. 第三层：功能发现提示（Feature Discovery）

### 触发规则

- 每条提示**仅出现一次**，展示后标记为已完成
- 必须 `profileTourCompleted === true` 后才开始触发（不和前两段引导冲突）
- 同一时刻最多显示 1 条功能发现，多条排队

### 展现形式

统一使用**轻量 tooltip + 聚光灯**，不使用全屏遮罩：

```
┌───────────────────────────────┐
│  💡 提示文案                   │
│     详细说明                   │
│              [ 知道了 ]        │
└───────────────────────────────┘
         ▼ （箭头指向目标元素）
```

- 点击“知道了”或点击目标元素均可关闭
- 5 秒后未操作自动淡出（但仍标记为已展示）

### 完整功能发现清单

| # | 功能 | 触发条件 | 提示内容 | key |
|---|------|---------|---------|-----|
| 1 | 魔法笔 | 用户当日累计输入 ≥ 3 条活动 | “输入多了？试试魔法笔 ✏️ 一次录入多条活动” → 指向魔法笔按钮 | `discovery_magic_pen` |
| 2 | 心情卡片转换 | 用户首次有心情附着到活动卡上 | “长按心情标签可以拆出来变成独立心情卡 💭” → 指向活动卡上的心情标签 | `discovery_mood_detach` |
| 3 | 目标瓶 | 首次进入 `/growth` 且无 bottle | “创建你的第一个目标瓶，收集 21 颗星就能达成！” → 指向“+”按钮 | `discovery_first_bottle` |
| 4 | 待办关联瓶 | 首次创建 todo | “试试关联一个习惯瓶，完成待办自动获得星星” → 指向瓶关联选项 | `discovery_todo_bottle_link` |
| 5 | 营养液浇灌 | 首次有瓶子达成 `achieved` 状态 | “满瓶了！可以制作成营养液浇灌你的植物 🌱” → 指向达成的瓶子 | `discovery_bottle_irrigate` |
| 6 | 批注/星尘 | 首次收到 AI annotation | “这是 {companionName} 给你的批注，点击可以收为星尘 ✨” → 指向 annotation 气泡 | `discovery_annotation` |
| 7 | 日记本 | 首次成功生成 Timeshine 日记 | “你的第一篇日记已收入日记本 📖 随时可以回顾” → 指向日记本入口 | `discovery_diary_book` |
| 8 | 日历选日期 | 进入日记页，且用户已有 ≥ 2 天的日记 | “点击上方日历 📅 可以查看任意一天的日记” → 指向日历图标 | `discovery_diary_calendar` |
| 9 | 个人设置 | 首次进入 `/profile` | “在这里可以切换 AI 伙伴和调整批注频率” → 指向 AI 伙伴卡片 | `discovery_profile_settings` |

### 功能发现链条关系

某些发现之间存在前后依赖，后者仅在前者已触发后才能触发：

```
独立触发：
  ├── #1 魔法笔（仅依赖活动数量）
  ├── #2 心情卡片转换（仅依赖心情附着行为）
  ├── #3 目标瓶（仅依赖 Growth 页状态）
  ├── #4 待办关联瓶（仅依赖 todo 创建）
  ├── #6 批注/星尘（仅依赖 annotation 出现）
  └── #9 个人设置（仅依赖 Profile 页访问）

链式触发：
  #3 目标瓶 → #5 营养液浇灌
  （#5 要求瓶子达成 achieved 状态）

  #7 日记本 → #8 日历选日期
  （#8 要求 #7 已完成 且 日记数 ≥ 2）
```

---

## 7. 技术方案

### 7.1 新增文件清单

```
src/
├── store/
│   └── useOnboardingStore.ts            # Welcome/Profile/Discovery 状态管理
├── features/
│   └── onboarding/
│       ├── OnboardingTour.tsx           # 首次导览主控组件（5 步流程）
│       ├── ProfileTour.tsx              # 画像收集主控组件（P1-P5）
│       ├── ProfileTourStepCard.tsx      # 画像流程通用容器（头像+气泡+动作区）
│       ├── CoachMark.tsx                # 聚光灯 + 提示气泡（可复用）
│       ├── CompanionPicker.tsx          # Step 1 AI 伙伴选择 Bottom Sheet
│       └── FeatureDiscovery.tsx         # 功能发现提示组件
└── i18n/locales/
    ├── zh.ts                            # 新增 onboarding.* 命名空间
    ├── en.ts                            # 同上
    └── it.ts                            # 同上
```

### 7.2 Store 设计

```typescript
// src/store/useOnboardingStore.ts

interface OnboardingState {
  // 首次导览
  tourCompleted: boolean;
  tourStep: number;           // 0-4，对应 Step 1-5
  tourActive: boolean;

  // 画像收集
  profileTourCompleted: boolean;
  profileTourStep: number;    // 0-4，对应 P1-P5
  profileTourActive: boolean;

  // 功能发现
  discoveries: Record<string, boolean>;
  // e.g. { discovery_magic_pen: true, discovery_first_bottle: false, ... }

  // Actions
  startTour: () => void;
  nextStep: () => void;
  skipTour: () => void;
  completeTour: () => void;

  startProfileTour: () => void;
  nextProfileStep: () => void;
  skipProfileTour: () => void;
  completeProfileTour: () => void;

  markDiscovery: (key: string) => void;
  shouldShowDiscovery: (key: string) => boolean;
}
```

**persist 配置**：使用 `capacitorStorage` 适配器（遵守项目规范，不直接用 localStorage）。

**与 Auth 数据同步**：
- `completeProfileTour()` 调 `useAuthStore.updateUserProfile(...)` 写入 `user_metadata.user_profile_v2`
- Profile Tour 全跳过也要写 `onboardingCompleted: true`

### 7.3 CoachMark 组件

```typescript
// src/features/onboarding/CoachMark.tsx

interface CoachMarkProps {
  targetRef: RefObject<HTMLElement>;    // 高亮目标元素的 ref
  title: string;                        // i18n 后的标题
  description: string;                  // i18n 后的描述
  buttonText: string;                   // 操作按钮文案
  position: 'top' | 'bottom';           // 气泡相对目标的位置
  onNext: () => void;                   // 点击按钮回调
  onSkip?: () => void;                  // 跳过回调（首次导览有，功能发现无）
  showSkip?: boolean;                   // 是否显示“跳过全部”
}
```

**实现细节**：
- 全屏半透明黑色遮罩（`rgba(0,0,0,0.6)`）
- 目标元素区域用 `box-shadow: 0 0 0 9999px rgba(0,0,0,0.6)` 打孔
- 打孔区域带 `border-radius: 12px` 圆角
- 提示气泡用 Framer Motion `animate={{ opacity: 1, y: 0 }}` 淡入
- 气泡指向箭头用 CSS `::after` 三角形
- 所有可点击区域 ≥ 44×44pt（Apple HIG）
- 遮罩 `z-index: 9999`

### 7.4 集成方式

```typescript
// 在 App.tsx 或 ChatPage.tsx 中

const {
  tourCompleted,
  tourActive,
  profileTourCompleted,
  profileTourActive,
  startTour,
  startProfileTour,
} = useOnboardingStore();
const { user } = useAuthStore();

useEffect(() => {
  if (user && !tourCompleted && !tourActive) {
    startTour();
  }
}, [user, tourCompleted, tourActive]);

useEffect(() => {
  if (user && tourCompleted && !profileTourCompleted && !profileTourActive) {
    const timer = setTimeout(() => startProfileTour(), 1000);
    return () => clearTimeout(timer);
  }
}, [user, tourCompleted, profileTourCompleted, profileTourActive, startProfileTour]);

return (
  <>
    <RouterOutlet />
    {tourActive && <OnboardingTour />}
    {profileTourActive && <ProfileTour />}
    {profileTourCompleted && <FeatureDiscovery />}
  </>
);
```

**FeatureDiscovery** 组件内部：
- 监听各 store 的状态变化（活动数量、bottle 状态、annotation 出现等）
- 满足条件时调用 `shouldShowDiscovery(key)`，为 true 则展示对应 tooltip
- 展示后调用 `markDiscovery(key)`

### 7.5 架构层遵守

| 规则 | 遵守方式 |
|------|---------|
| UI 层不写业务逻辑 | `OnboardingTour.tsx` / `ProfileTour.tsx` 只调用 store/action，不直接读写 Supabase |
| Store 不写数据库操作 | store 仅编排状态，用户画像持久化经 `useAuthStore` 封装 |
| i18n 无硬编码中文 | 所有文案走 `t('onboarding.*')` |
| 文件 ≤ 400 行 | CoachMark / OnboardingTour / FeatureDiscovery 各自独立文件 |
| iOS 原生感 | Bottom Sheet、slide 动画、44pt 触控区、active:scale-95 |

---

## 8. 用户流程总览

```
注册完成
  │
  ▼
┌───────────────────────────────────────────────┐
│  Step 1: 欢迎 + 选 AI 伙伴（Bottom Sheet）     │
│  Step 2: 输入第一条活动（唯一一次输入）         │
│  Step 3: 卡片能力提示（只看不做）              │
│  Step 4: 成长闭环预览：目标瓶→星星→植物         │
│  Step 5: 日记/植物/日记本预告                  │
└───────────────────────────────────────────────┘
  │
  ▼
┌───────────────────────────────────────────────┐
│  P1: 使用目的（4 选 1）                        │
│  P2: 作息 + 饭点（起床/睡觉/早午晚）           │
│  P3: 近期目标（选项 + 自填）                   │
│  P4: 人生目标（可选）                          │
│  P5: 重要日期（可选，最多 3 条）               │
└───────────────────────────────────────────────┘
  │
  ▼
正常使用 /chat
  │
  ├── 当日 ≥ 3 条活动 ──────→ 💡 魔法笔提示
  ├── 首次心情附着到活动卡 ──→ 💡 心情卡片转换提示
  ├── 首次进 /growth ────────→ 💡 目标瓶提示
  ├── 首次创建 todo ─────────→ 💡 待办关联瓶提示
  ├── 首次瓶子满星 ──────────→ 💡 营养液浇灌提示
  ├── 首次收到 annotation ───→ 💡 批注/星尘提示
  ├── 首次生成日记 ──────────→ 💡 日记本提示
  │                                │
  │                    已有 ≥ 2 天日记
  │                                │
  │                                ▼
  │                          💡 日历选日期提示
  └── 首次进 /profile ───────→ 💡 个人设置提示
```

---

## 9. i18n 完整 Key 清单

```typescript
onboarding: {
  // Step 1
  welcome_title: '欢迎来到 Plantime',
  choose_companion: '先选一位 AI 伙伴陪你记录每一天',
  companion_van: '治愈花语',
  companion_agnes: '温柔引导',
  companion_zep: '犀利观察',
  companion_momo: '从容温吞',
  companion_plus_only: '仅 PLUS 会员',
  next_step: '选好了，下一步',
  skip_all: '跳过全部',

  // 通用
  next: '下一步',

  // Step 2
  try_input: '试试输入你正在做的事',
  input_example: '比如“吃早餐”或“开会”',
  sample_activity: '☕ 喝咖啡',

  // Step 3
  first_record_title: '你的第一条记录！',
  card_mood_auto_short: '输入心情会自动关联到这条活动上',
  card_edit_short: '点击卡片可以编辑',

  // Step 4
  growth_loop: '创建目标瓶 → 收集星星 → 浇灌植物 🌱',

  // Step 5
  report_title: '每天晚上 8 点后可以生成专属日记和植物',
  report_diary: '日记会收藏进你的日记本',
  start_app: '开始使用 Plantime!',

  // Profile Tour
  profile_p1_van: '你好！在我们开始之前，你主要想用 Tshine 来做什么？',
  profile_p1_agnes: '嗨，很高兴认识你～先告诉我你来这里最想做什么？',
  profile_p1_zep: '直说吧，你来这里主要为了什么？',
  profile_p1_momo: '嗯……你想用 Tshine 主要来做什么呢。',
  profile_life_record: '记录生活',
  profile_organize_thoughts: '整理思路',
  profile_emotion_management: '情绪管理',
  profile_habit_building: '养成习惯',
  profile_p2_default: '了解了～你通常几点起床、几点睡？也告诉我你的早午晚饭点，我会更贴合你的节奏。',
  profile_wake_label: '起床时间',
  profile_sleep_label: '睡觉时间',
  profile_breakfast_label: '早餐时间',
  profile_lunch_label: '午餐时间',
  profile_dinner_label: '晚餐时间',
  profile_p3_prompt: '你最近最想推进的目标是什么？',
  profile_goal_exam: '备考/学习计划',
  profile_goal_interview: '求职/面试',
  profile_goal_fitness: '运动/减脂',
  profile_goal_balance: '稳定作息与情绪',
  profile_goal_custom_placeholder: '也可以自己写一个近期目标',
  profile_p4_prompt: '如果愿意，也可以写一个人生目标。我会在你低落或迷茫时提醒你为什么出发。',
  profile_life_goal_placeholder: '例如：两年内完成转行；成为更稳定的自己',
  profile_p4_hint: '可跳过，后续可在“我的画像”随时修改',
  profile_p5_prompt: '有没有你想让我记住的重要日期？比如生日、纪念日～我会在日期临近时悄悄提你一下',
  profile_anni_label: '日期名称',
  profile_anni_repeat: '每年重复',
  profile_anni_add: '再加一个',
  profile_start: '记好了，开始吧！',
  profile_skip_step: '跳过',
  profile_done_van: '记住了，我们开始吧 🌸',
  profile_done_agnes: '太好了，我记下来了～',
  profile_done_zep: '好，信息够了。',
  profile_done_momo: '嗯……记下来了。',

  // Feature Discovery
  discovery_magic_pen: '输入多了？试试魔法笔 ✏️\n一次录入多条活动',
  discovery_mood_detach: '长按心情标签可以拆出来\n变成独立心情卡 💭',
  discovery_first_bottle: '创建你的第一个目标瓶\n收集 21 颗星就能达成！',
  discovery_todo_bottle_link: '试试关联一个目标瓶\n完成待办自动获得星星',
  discovery_bottle_irrigate: '满瓶了！可以制作成营养液\n浇灌你的植物 🌱',
  discovery_annotation: '{companionName} 给你写了批注\n点击可以收为星尘 ✨',
  discovery_diary_book: '你的第一篇日记已收入日记本 📖\n随时可以回顾',
  discovery_diary_calendar: '点击上方日历 📅\n可以查看任意一天的日记',
  discovery_profile_settings: '在这里可以切换 AI 伙伴\n和调整批注频率',
  discovery_dismiss: '知道了',
}
```

---

## 10. 已确认的方案结论

| # | 结论 | 说明 |
|---|------|------|
| 1 | Step 2 + Step 3 不做物理合并 | 仍保留 5 步结构，但 Step 3 改成只看不做，达到“只输入一次”的效果 |
| 2 | 首次导览只保留一次输入 | Step 2 输入活动；Step 3 不再要求输入心情 |
| 3 | 心情自动归入不做现场演示 | 仅用一句话提示，剩余靠真实使用和功能发现层承接 |
| 4 | Step 4 改成一句话 | 用“目标瓶 → 星星 → 植物”表达成长闭环，降低认知负担 |
| 5 | 首次导览目标时长定为 45 秒 | 以轻快完成为优先，不追求一次讲全 |
| 6 | 画像收集独立为第二段流程 | 不插入 45 秒功能导览，避免首段过重 |
| 7 | 画像收集总时长控制在 40 秒 | P1~P5 可跳过，跳过也写默认并标记完成 |
| 8 | 功能发现延后到画像完成后触发 | 以 `profileTourCompleted` 作为 Discovery 启动门槛 |
| 9 | 引导结束后仍建议保留重看入口 | 建议在 Profile 页底部加“重看新手引导”按钮 |

---

*文档版本 v1.4 | 2026-04-09*
