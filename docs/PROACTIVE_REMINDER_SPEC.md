# 主动提醒与被动记录 · 需求文档

> **DOC-DEPS**: LLM.md → CLAUDE.md → docs/PROJECT_MAP.md → docs/TSHINE_DEV_SPEC.md
>
> **状态**: Draft v0.1 · 待产品确认
> **创建日期**: 2026-04-17
> **作者**: Annie（需求） / Claude（撰稿）

---

## 1. 背景与动机

### 1.1 现状痛点

- **主动记录门槛高**：用户只在"情绪被触动"的少数时刻才会打开 App 记录，大量日常性事件（上班、午休、课程、通勤）被遗漏。
- **App 留存频次有限**：普通 App 每天 2~3 次打开已属高频。要求用户每天多次主动打开 Tshine 记录日程不现实。
- **日报/植物生成数据稀疏**：缺乏日常性事件填充时间线，AI 注释与月报分析可发挥的空间小。

### 1.2 核心思路

**从"用户主动记录" → "App 主动询问 + 一键确认"**

用户只需在关键时间节点点一下对勾（✓）或叉号（✗），App 自动完成背景计时与事件生成，将记录负担从"打字输入"降为"点按确认"。主动输入仍随时可打断。

### 1.3 一句话价值

> 让"懒人"也能拥有一份完整的每日时间线。

---

## 2. 产品目标

| 目标 | 指标 |
|---|---|
| 降低日常性事件记录门槛 | 用户日均事件数从 X 增至 Y（需埋点确认） |
| 提升 App 有效使用频次 | DAU · 日均弹窗交互次数 ≥ 3 |
| 为 AI 画像/日报提供稳定数据源 | 工作日日常事件覆盖率 ≥ 60% |
| 保留主动记录入口 | 弹窗不阻断现有 ChatPage 输入 |

---

## 3. 用户场景

### 场景 A：9:30 上班族 · 工作打卡

```
09:30 📱 (推送) 安妮，你今天开始上班了吗？
                    [ ✓ ]   [ ✗ ]
          ↓ 点击 ✓
        · 自动创建"工作"事件，起始时间 09:30
        · 后台持续计时
12:00 📱 上午的工作时间结束了，开始吃饭了吗？
                    [ ✓ ]   [ ✗ ]
          ↓ 点击 ✓
        · 工作事件结束（9:30-12:00，2.5h）
        · 自动创建"午餐"事件，起始时间 12:00
```

### 场景 B：主动记录打断

```
09:30 提醒确认 ✓ → 开始"工作"计时
10:15 用户打开 App，在 ChatPage 输入"和老板开了个会"
        · 立即结束"工作"计时（9:30-10:15，45min）
        · 开启新事件"会议"，起始时间 10:15
12:00 午休提醒触发（此时处于"会议"计时中）
        · 正常询问是否开始午餐
```

### 场景 C：学生导入课表

```
首次引导 → 选择身份"学生"
→ 选择"导入课表图片" → 拍照/上传
→ AI 解析：上午 8:00-10:00（整合所有第 1、2 节课）
          上午 10:30-12:00（第 3、4 节课）
          下午 14:00-17:00
→ 用户预览并手动调整 → 确认保存
```

### 场景 D：晚间总结

```
20:00 📱 安妮，今天过得怎么样？要来一株新的植物吗？
           [ 生成植物 ]   [ 看今日日报 ]   [ 稍后 ]
```

---

## 4. 功能需求

### 4.1 引导收集（Onboarding）

#### 4.1.1 触发时机

- **首次注册登录** → 进入首页前强制走完
- **已注册老用户** → 通过现有「我的 → 用户画像」面板（`UserProfilePanel`）增量完善
  - 不单独做"主动提醒"新板块
  - `UserProfilePanel` 顶部新增"日程与作息"区块（见 4.8）
  - 字段缺失时 Profile 页展示一个轻量提示气泡："补全日程和作息，让 Tshine 帮你记录日常"，点击后展开面板
- 字段：`UserProfileV2.onboardingCompleted`（已预留，未启用）

#### 4.1.2 步骤流程

| Step | 内容 | 必填 | 可跳过 |
|---|---|---|---|
| 1 | 欢迎页 + 简介 "Tshine 会帮你记录日常" | — | ✓ |
| 2 | 通知权限申请（系统弹窗） | — | 可稍后开启 |
| 3 | **日程设置**：勾选适用的日程类型（见 4.2） | — | ✓（可稍后在设置里补填） |
| 4 | 根据勾选类型收集对应作息时间 | — | 每字段可跳过 |
| 5 | 确认并进入首页 | — | — |

> **不询问"你是什么身份"**：Step 3 只问"你有哪些需要记录的日程"，用勾选框替代身份标签，避免对用户生活方式作分类或评判。勾选结果仅用于后台调度逻辑，**不在任何 UI 界面向用户展示**。

#### 4.1.3 交互规范

- 复用 `APP_MODAL_CARD_CLASS` 样式体系
- 进度指示：顶部 4/5 段进度条
- 返回：可回上一步，Step 3 可跳过（提醒功能降级为仅三餐/起睡提醒）
- 初次完成后：`onboardingCompleted = true`

---

### 4.2 日程类型与作息数据收集

#### 4.2.1 数据结构扩展（UserProfileV2.manual）

```ts
// src/types/userProfile.ts 扩展
interface UserProfileManualV2 extends UserProfileManual {
  // 内部调度用，不对外展示；true = 用户勾选了该日程类型
  hasWorkSchedule?: boolean;   // 有固定上班/工作时间
  hasClassSchedule?: boolean;  // 有固定上课时间
  // 注意：原 lifeStage 字段废弃，不再使用

  // 工作日程字段（hasWorkSchedule = true 时收集）
  workStart?: string;       // "09:30"
  workEnd?: string;         // "18:00"
  lunchStart?: string;      // "12:00"
  lunchEnd?: string;        // "13:00"

  // 课表字段（hasClassSchedule = true 时收集）
  classSchedule?: ClassSchedule;
  classScheduleSource?: 'image' | 'manual';

  // 通用作息（所有用户都收集）
  wakeTime?: string;        // "07:30"
  sleepTime?: string;       // "23:30"
  lunchTime?: string;       // "12:00"（无工作日程时用；有工作日程时用 lunchStart/lunchEnd）
  dinnerTime?: string;      // "19:00"
}

/**
 * 课表：整天划分为最多 3 段（上午/下午/晚上），每段只有一个起止时间。
 * 举例：上午 8:00-12:00，下午 14:00-17:30，晚上不填 → evening = undefined
 */
interface ClassSchedule {
  weekdays: number[];           // [1,2,3,4,5] = 周一至周五
  morning?: TimeRange;          // 上午 { start: "08:00", end: "12:00" }
  afternoon?: TimeRange;        // 下午 { start: "14:00", end: "17:30" }
  evening?: TimeRange;          // 晚上 { start: "19:00", end: "21:00" }
}

interface TimeRange {
  start: string;                // "HH:MM"
  end: string;                  // "HH:MM"
}
```

#### 4.2.2 日程组合对应字段

| 用户勾选 | 收集字段 | 默认提醒锚点 |
|---|---|---|
| **有工作时间** | `wakeTime`, `workStart`, `workEnd`, `lunchStart`, `lunchEnd`, `sleepTime` | 起床、上班、午休开始、午休结束、下班、睡前 |
| **有上课时间** | `classSchedule`（上/下/晚三段）+ `wakeTime`, `lunchTime`, `dinnerTime`, `sleepTime` | 上午课开始/结束、下午课开始/结束、晚自习开始/结束、起床、午餐、晚餐、睡前 |
| **两者都有** | 合并上两行所有字段 | 合并提醒（所有已填字段均生效） |
| **都不勾选** | `wakeTime`, `lunchTime`, `dinnerTime`, `sleepTime` | 起床、午餐、晚餐、睡前 |

所有时间字段：24 小时制 `HH:MM`，i18n key 统一走 `t('profile_schedule_*')`。

---

### 4.3 课表图片导入（hasClassSchedule = true 的用户）

#### 4.3.1 交互流程

1. 用户选择"导入课表"
2. 支持：拍照 / 从相册选择（复用 `resizeImageToDataUrl`）
3. 前端压缩至 ≤ 1.5MB，发送到 serverless `api/parse-schedule.ts`（新建）
4. 服务端调用 AI（沿用现有 magic-pen-parse 的 provider 架构）
5. 返回结构化 `ClassSchedule`（上/下/晚最多三段）
6. 前端进入**预览编辑页**：用户可修改上/下/晚各段起止时间，或清空某一段
7. 确认后写入 `userProfileV2.manual.classSchedule`
8. 紧接着引导用户填写 `wakeTime`, `lunchTime`, `dinnerTime`, `sleepTime`（课表不覆盖作息）

#### 4.3.2 AI 解析规则

**核心原则：整张课表被压缩为"上午一段、下午一段、晚上一段"，每段只有一个总起止时间，课间全部吃掉。**

- 输入：课表图片 + prompt
- Prompt 要点（给 AI 的指令）：
  - 识别所有课程的起止时间
  - 按 12:00 之前 / 12:00-18:00 / 18:00 之后 划分为 morning / afternoon / evening
  - 每个时段取"最早开始时间"作为 `start`、"最晚结束时间"作为 `end`
  - **课间休息（包括大课间、午休衔接）全部归入课程时段内，不单独列出**
- 解析示例：

  ```
  原始课表：
    上午：8:00-8:45（课1）、8:55-9:40（课2）、10:00-10:45（课3）、11:00-11:45（课4）
    下午：14:00-14:45（课5）、15:00-15:45（课6）
    晚上：无课

  解析结果：
    {
      weekdays: [1, 2, 3, 4, 5],
      morning:   { start: "08:00", end: "11:45" },
      afternoon: { start: "14:00", end: "15:45" },
      evening:   undefined
    }
  ```

- 不要求识别具体课程名（Tshine 不需要课名，只需时段）
- 若一周课表每天不同 → v1 简化为"取工作日并集"，v2 再支持按天分课表

#### 4.3.3 错误兜底

- AI 解析失败 / 识别不出任何时段 → 跳过图片解析，进入手动输入模式
  - 手动模式：3 个 `TimeRange` 选择器（上午/下午/晚上），每段可填/可留空
- 用户无论如何都能手动编辑覆盖 AI 结果

---

### 4.4 原生通知系统（iOS Local Notifications）

> **迁移说明**：现有 `src/hooks/useNightReminder.ts` 是纯前台 React 弹窗，App 被杀掉后失效。本节完整替换为 iOS 原生本地通知，App 关闭/锁屏状态下均可送达。

#### 4.4.1 技术集成

```bash
npm install @capacitor/local-notifications
npx cap sync ios
```

- 新建 `src/services/notifications/localNotificationService.ts`（权限申请、类别注册、调度、取消）
- iOS 原生通知无需单独配置 `Info.plist`，Capacitor 自动处理
- **Web/浏览器环境**：降级为 App 内弹窗（不报错，静默跳过）

#### 4.4.2 通知类别注册（App 启动时执行一次）

iOS"可操作通知"需在 App 启动时注册通知类别（`UNNotificationCategory`），之后每条通知引用对应 `actionTypeId`：

```ts
// src/services/notifications/localNotificationService.ts
import { LocalNotifications } from '@capacitor/local-notifications';

export async function registerNotificationCategories() {
  await LocalNotifications.registerActionTypes({
    types: [
      {
        id: 'CONFIRM_DENY',           // 通用确认类（作息提醒）
        actions: [
          { id: 'confirm', title: '✓ 确认'      },  // 静默写入预设活动，不打开 App
          { id: 'deny',    title: '我在做别的'   },  // 打开 App → QuickActivityPicker
        ],
      },
      {
        id: 'EVENING_CHECK',          // 晚间总结（两个跳转按钮）
        actions: [
          { id: 'view_report', title: '看日报' },
          { id: 'grow_plant',  title: '种植物' },
        ],
      },
      {
        id: 'WEEKEND_CHECK',          // 周末询问（确认 + 忽略）
        actions: [
          { id: 'confirm', title: '记一下' },
          { id: 'deny',    title: '忽略'   },
        ],
      },
      {
        id: 'IDLE_NUDGE',             // App 关闭 4h（§4.10.2）
        actions: [
          { id: 'open_chat', title: '打开聊天' },
        ],
      },
      {
        id: 'SESSION_CHECK',          // 3h 无新记录（全6种活动类型，§4.10.1）
        actions: [
          { id: 'still_yes', title: '✓ 还在'      },  // 重新安排 3h 后再检查
          { id: 'still_no',  title: '我在做别的'   },  // 打开 App → QuickActivityPicker
        ],
      },
    ],
  });
}
```

#### 4.4.3 通知送达路径（两路并行）

| 场景 | 送达方式 | 用户看到的 |
|---|---|---|
| **App 在前台** | 直接渲染 `ReminderPopup` 组件（不发原生通知） | App 内弹窗（含 AI 头像 + 快捷输入框，见 §4.5.2） |
| **App 在后台 / 被杀掉** | iOS 原生本地通知（`LocalNotifications.schedule`） | 手机顶部横幅 + 锁屏通知 |

> App 前台时 `@capacitor/app` 的 `appStateChange.isActive === true`，直接走弹窗路径，不重复发通知。

#### 4.4.4 iOS 原生通知视觉规范

```
── 默认横幅（不展开）─────────────────────────────────
  [App图标]  Tshine                  现在  [AI头像缩略图]
  Van：安妮，你今天开始上班了吗？
──────────────────────────────────────────────────────

── 用户长按 / 下滑展开（显示动作按钮）────────────────
  [App图标]  Tshine                  现在  [AI头像缩略图]
  Van：安妮，你今天开始上班了吗？
  ────────────────────────────────────────────────────
        ✓ 确认               ← confirm：静默写入预设活动，不打开 App
  ────────────────────────────────────────────────────
        我在做别的           ← deny：打开 App → QuickActivityPicker（可选类型按钮 + 自由输入）
──────────────────────────────────────────────────────
```

> **"我在做别的"的完整体验**：点击后打开 App，底部自动弹出 QuickActivityPicker。用户可以：
> - 点预设类型按钮（🍽 吃饭 / 😴 休息 / 🎮 娱乐 / 🏃 运动 / 💬 社交 / ✏️ 其他）
> - 或在输入框自由输入任何内容
>
> 无论选择哪种方式，今日此提醒类型均永久跳过。

**AI 头像缩略图实现**：
- 使用 `LocalNotifications.schedule` 的 `attachments` 字段
- 将 van/agnes/zep/momo 四张头像图打包进 app bundle（已有资产：`src/assets/ai-companions/*.png`）
- 运行时根据 `preferences.aiMode` 选对应图片路径
- 图片显示在通知右侧缩略图位置（iOS 标准位置，约 40×40px）
- body 文案前加人格名（"Van："），与头像配合明确发送方身份

> iOS 通知不支持"头像在左、文案在右"的微信聊天气泡样式，右侧缩略图是系统通知能做到的最接近方案。完整 AI 头像（48px 圆形左对齐）仅在用户点进 App 后的 `ReminderPopup` 弹窗中展示。

- **直接点横幅** → 打开 App → 显示完整 `ReminderPopup`（含 AI 头像 + 输入框）
- **长按后点按钮** → 后台处理（记录动作，不强制打开 App）
- 通知 body 文案 = `reminderCopy.ts` 固定文案（同人格），不调 AI 接口

#### 4.4.5 通知调度时序

```
App 启动
  └─ registerNotificationCategories()
  └─ scheduleRemindersForToday()        ← 每天执行一次，取消旧通知重新调度
       └─ getIsFreeDay() → 工作日队列 or 周末队列
       └─ LocalNotifications.schedule([...])

用户关闭 App（appStateChange.isActive = false）
  └─ scheduleIdleNudge(delay: 24h)     ← 安排 idle 通知（见 §4.10）

用户打开 App（appStateChange.isActive = true）
  └─ cancelIdleNudge()                 ← 取消 idle 通知
  └─ checkMissedReminders()            ← 检查错过的提醒，降级在 App 内补弹
```

#### 4.4.6 动作回调处理

```ts
LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
  const { actionId, notification } = event;
  const extra = notification.extra as {
    reminderType: ReminderType;
    activityType?: ActivityRecordType;
    content?: string;      // 预设的活动描述文字，如 "吃午饭"
  };

  if (actionId === 'confirm') {
    // 静默写入预设活动记录，不打开 App
    if (extra.content && extra.activityType) {
      silentQuickRecord({ content: extra.content, activityType: extra.activityType });
    } else {
      handleReminderConfirm(extra.reminderType);
    }
  }

  if (actionId === 'deny' || actionId === 'still_no') {
    // 打开 App 并自动展开 QuickActivityPicker 底部选择器
    router.push(`/chat?show_quick_picker=1&activity=${extra.activityType ?? ''}`);
  }

  if (actionId === 'still_yes')   rescheduleSessionCheck(extra.activityType);
  if (actionId === 'view_report') router.push('/report');
  if (actionId === 'grow_plant')  router.push('/growth');
  if (actionId === 'open_chat')   router.push('/chat');
});

// 点击通知 body 本身（非按钮）→ 打开 App 显示完整弹窗
LocalNotifications.addListener('localNotificationReceived', (notification) => {
  // 前台收到（理论上不应发生，AppStateChange 已拦截；兜底处理）
  showReminderPopup(notification.extra?.reminderType);
});
```

#### 4.4.7 权限申请

- **时机**：Onboarding Step 2（进入日程设置前）
- **文案**：`"Tshine 会在上下班、用餐时间轻轻提醒你，帮你自动记录日常。"`
- **拒绝处理**：仍可使用 App，所有提醒降级为"进入 App 时补弹窗"（`checkMissedReminders`）

#### 4.4.8 通知 ID 命名规范

```
reminder_<type>_<HHMM>
例：reminder_work_start_0930
    reminder_lunch_start_1200
    reminder_evening_check_2000
    reminder_idle_nudge           ← idle 专用，无时间戳（动态调度）
```

#### 4.4.9 现有 useNightReminder.ts 迁移

| 现状 | 迁移后 |
|---|---|
| 22:00 `setTimeout` 触发 React 弹窗 | 22:00 `LocalNotifications.schedule` 发原生通知 |
| App 被杀掉 = 失效 | App 关闭后仍能收到 |
| 触发条件：plant/diary 未生成 | **20:00 触发时实时检查**当日 plant+diary 是否均未生成（`!plantDone && !diaryDone`）；00:10 重调度时仅决定是否加入今日队列（乐观加入，触发时再实时判断） |

迁移后 `useNightReminder.ts` 可删除；逻辑合并进 `reminderScheduler.ts` 的 `evening_check` 类型处理。

---

### 4.5 主动提醒弹窗系统

#### 4.5.1 提醒项类型

每个提醒类型对应一组"人格化固定文案"（不调 AI 接口，全部预写入前端）。下表为**默认（Van 人格）文案**，其他人格文案见 § 4.5.4。

| 类型 | 触发时间 | 默认文案（Van） | 确认后动作 |
|---|---|---|---|
| `work_start` | `workStart` | "{name}，你今天开始上班了吗？" | 开启工作计时 |
| `lunch_start` | `lunchStart` | "{name}，上午辛苦啦，吃饭了吗？" | 结束上班计时，开启午餐计时 |
| `lunch_end` | `lunchEnd` | "{name}，午休结束，回到工作了吗？" | 结束午餐计时，开启下午工作 |
| `work_end` | `workEnd` | "{name}，辛苦啦，下班了吗？" | 结束工作计时 |
| `class_morning_start` | 上午段 `start` | "{name}，上午的课要开始了吗？" | 开启上午课程计时 |
| `class_morning_end` | 上午段 `end` | "{name}，上午的课结束了吗？" | 结束上午课程计时 |
| `class_afternoon_start` | 下午段 `start` | "{name}，下午的课开始了吗？" | 开启下午课程计时 |
| `class_afternoon_end` | 下午段 `end` | "{name}，下午的课结束了吗？" | 结束下午课程计时 |
| `class_evening_start` | 晚段 `start` | "{name}，要去上晚自习了吗？" | 开启晚间课程计时 |
| `class_evening_end` | 晚段 `end` | "{name}，晚自习结束了吗？" | 结束晚间计时 |
| `wake` | `wakeTime` | "{name}，早安，起床啦？" | 记录起床时间 |
| `sleep` | `sleepTime` | "{name}，准备睡觉了吗？" | 结束所有活跃计时 |
| `meal_lunch` | `lunchTime`（无工作日程的用户） | "{name}，要去吃午饭了吗？" | 开启午餐计时 |
| `meal_dinner` | `dinnerTime` | "{name}，晚饭时间到啦" | 开启晚餐计时 |
| `evening_check` | **20:00 固定** | "今天过得怎么样？看看日报或生成植物吧" | 跳转日报 / 植物生成 |
| `weekend_morning_check` | **周末/节假日 10:00 固定** | "周末上午好！在做什么呀？" | 记录用户输入（可选）|
| `weekend_afternoon_check` | **周末/节假日 16:00 固定** | "下午好，今天玩得开心吗？" | 记录用户输入（可选）|
| `weekend_evening_check` | **周末/节假日 20:00 固定** | "周末的晚上好！要看看今日日报吗？" | 跳转日报 / 植物生成 |

#### 4.5.2 弹窗交互（带 AI 头像 + 快捷输入）

> **弹窗形态总览**：本文档共涉及三种弹窗，定义位置如下。除 §4.5.2 外，其余章节均引用而不重复定义。
>
> | 形态 | 适用场景 | 定义位置 |
> |---|---|---|
> | **A. 标准提醒弹窗**（本节） | 所有作息/上课/吃饭类提醒 + session_check | §4.5.2 |
> | **B. 晚间总结弹窗** | 20:00 evening_check（植物/日报入口） | §4.7 |
> | iOS 原生通知横幅 | App 后台/关闭时的系统通知，非 App 弹窗 | §4.4.4 |

```
┌────────────────────────────────────┐
│  ┌────┐                            │
│  │AI  │  安妮，你今天开始上班了吗？  │
│  │头像│                            │
│  └────┘                            │
│                                    │
│           ┌───┐    ┌───┐           │
│           │ ✓ │    │ ✗ │           │
│           └───┘    └───┘           │
│  ────── 或者直接告诉我 ──────       │
│  ┌────────────────────────┐  ┌──┐ │
│  │ 写点什么...              │  │↑│ │
│  └────────────────────────┘  └──┘ │
│                                    │
└────────────────────────────────────┘
```

- **左侧 AI 头像**：根据用户在"我的"选择的 AI 人格（`preferences.aiMode`）对应显示
  - 图片源：`src/assets/ai-companions/{van|agnes|zep|momo}.png`
  - 通过常量 `AI_COMPANION_VISUALS[aiMode].avatar` 获取（已存在）
  - **与 AIAnnotationBubble 使用的是同一批头像**（体验统一）
  - 尺寸建议：48×48 圆形，与文案垂直居中对齐
- **右侧文案**：从固定文案表读取，根据 `preferences.aiMode` 匹配对应人格版本
  - 模板变量仅支持 `{name}`（用户 nickname）
  - 变量为空时降级（如未设昵称 → 直接省略"，"+"{name}，"）

##### 三种回应方式

| 操作 | 视觉 | 行为 | 对应业务 |
|---|---|---|---|
| 点对勾 | ✓ 圆形按钮（绿色系） | 按提醒类型默认动作执行（开始计时 / 结束计时） | 同 § 4.5.1 默认动作 |
| 点叉号 | ✗ 圆形按钮（中性灰） | **立即打开 QuickActivityPicker**，今日此提醒类型**永久跳过**（不重试） | 用户正在做别的事，记录实际活动后该提醒不再出现 |
| **输入文字 + 发送** | 输入框 + ↑ 发送键 | **等同于在 ChatPage 发送这条消息** | 见下方 |

> **✗ 按钮行为说明**：用户点 ✗ 表示"我没在做你说的那件事"，App 立刻弹出 QuickActivityPicker（底部 bottom sheet，见 §4.10.1）让用户选择实际在做什么。无论用户是否在 Picker 里选了选项，本次提醒类型当日均不再重推。**没有 10 分钟重试逻辑。**

**视觉规范**：
- 对勾/叉号均为**圆形图标按钮**，无文字标签
- 尺寸：40×40，图标 20×20（lucide-react `Check` / `X`）
- 对勾色：`#5F7A63`（sage green，与 AI 记录主题色一致）
- 叉号色：`#94A3B8`（slate-400，弱化以突出主动作）
- 交互：点击时轻触觉反馈 `triggerLightHaptic()`
- 无障碍：`aria-label="确认"` / `aria-label="我在做别的"`（走 i18n）


##### 弹窗内输入发送（核心新增）

- 弹窗底部有独立的**快捷输入区**：单行 input + 发送按钮（纸飞机图标）
- 用户可自由输入任何内容（如"今天稍微晚点开工，先去买了杯咖啡"）
- 点击发送后：
  1. 关闭本弹窗（视同已响应，今日此提醒类型不再推送）
  2. **完全等价于在 ChatPage 发送一条消息**：
     - 复用 `useChatStore` 的 `sendMessage` / `appendUserMessage` action
     - 走相同的分类、注释、植物生成、live input classification 等后续流程
     - 触发相同的"主动输入打断计时"逻辑（§ 4.6.3）
  3. 弹窗不需要自己处理业务逻辑，只负责把文本委托给 ChatStore
- **无需跳转到 ChatPage**：消息发送在背景完成，用户留在当前页面
- 输入框为空时发送按钮置灰；按 Enter 等同于点发送
- i18n 占位符：`t('reminder_popup_input_placeholder')`（如"写点什么..."）

##### 为什么这样设计

- **"✓/✗"是快捷路径**：覆盖 80% 场景（完全按作息表进行的日子）
- **输入框是兜底路径**：覆盖"没按计划/有意外/要补充信息"的 20% 场景
- 用户不必为了"今天情况特殊"而先关闭弹窗、再点开 App、再点输入框——一步完成

##### 其他交互

- **点击弹窗外** / 关闭按钮 → 等同 ✗
- 复用 `APP_MODAL_OVERLAY_CLASS` + `APP_MODAL_CARD_CLASS`
- 触发 `triggerLightHaptic()`
- 输入框 focus 时自动抬起不遮挡（iOS Safari 防自动放大，`font-size ≥ 16px`）

#### 4.5.3 固定文案的存储与加载

**前端硬编码，不走 API**：

```ts
// src/services/reminder/reminderCopy.ts（新建）
import type { AiCompanionMode } from '../../lib/aiCompanion';

export type ReminderType =
  | 'work_start' | 'work_end'
  | 'lunch_start' | 'lunch_end'
  | 'class_morning_start' | 'class_morning_end'
  | 'class_afternoon_start' | 'class_afternoon_end'
  | 'class_evening_start' | 'class_evening_end'
  | 'wake' | 'sleep'
  | 'meal_lunch' | 'meal_dinner'
  | 'evening_check'
  // 周末/节假日专用（工作日不触发）
  | 'weekend_morning_check'    // 10:00
  | 'weekend_afternoon_check'  // 16:00
  | 'weekend_evening_check';   // 20:00（替代 evening_check）

// 人格 × 提醒类型 → 固定文案（模板字符串，支持 {name}）
export const REMINDER_COPY: Record<AiCompanionMode, Record<ReminderType, string>> = {
  van: { /* ... 见 4.5.4 */ },
  agnes: { /* ... */ },
  zep: { /* ... */ },
  momo: { /* ... */ },
};

// {name} 使用规则：
// - 所有提醒文案均包含 {name} 占位符
// - 有昵称时："{name}，早安，起床啦？" → "安妮，早安，起床啦？"
// - 无昵称时：replace('{name}', '') + replace(/^[，,]\s*/, '') → "早安，起床啦？"
export function getReminderCopy(
  mode: AiCompanionMode,
  type: ReminderType,
  vars: { name?: string } = {},
): string {
  const template = REMINDER_COPY[mode]?.[type] ?? REMINDER_COPY.van[type];
  return template
    .replace('{name}', vars.name ?? '')
    .replace(/^[，,]\s*/, '');   // 无昵称时去掉开头的逗号和空格
}
```

**关键约束**：
- 文案由产品/运营在代码中直接写入，**不调用任何 AI 接口**
- 文案同步走 i18n：中文版硬编码在 `reminderCopy.ts`；英文/意大利语版通过 i18n key 承载（后续 i18n 覆盖）
- AI 人格切换 → 当日已推送的提醒保持原文案，未推送的使用新人格文案

#### 4.5.4 四种人格的文案差异（示例）

**原则**：保持核心信息（触发动作）不变，通过语气差异体现人格。

> **功能性提醒（上课/下课/吃饭/上班/下班类）语气约束**：这类提醒的核心是"是否开始/结束了某件事"，是功能性询问而非情绪表达。语气应保持**轻量中性**，避免对用户当前状态作假设性判断（如"下午课上完了，好好喘口气"——万一用户还在拖堂课，这类表达会让人反感）。人格差异主要体现在**句末语气助词和节奏感**，而非对事件结果的情绪化描述。idle_nudge、evening_check、weekend 类提醒可以有更丰富的情绪表达。

| 提醒 | Van（情绪治愈） | Agnes（引领指导） | Zep（生活真实） | Momo（从容温吞） |
|---|---|---|---|---|
| `work_start` | "{name}，你今天开始上班了吗？" | "{name}，又是开工的时间，做好准备了吗？" | "{name}，上班时间到，是时候开干啦。" | "{name}，上班啦～不急，慢慢进入状态～" |
| `lunch_start` | "{name}，上午辛苦啦，吃饭了吗？" | "{name}，午餐时间到，好好吃饭。" | "{name}，午饭了，别再死磕了。" | "{name}，吃饭啦～今天想吃什么～" |
| `lunch_end` | "{name}，午休结束，回去了吗？" | "{name}，午休结束，继续加油。" | "{name}，行吧，继续搬砖。" | "{name}，回去工作啦～慢慢来～" |
| `work_end` | "{name}，辛苦啦，下班了吗？" | "{name}，工作结束了，该收尾啦。" | "{name}，下班！今天就到这儿。" | "{name}，下班啦～今天也辛苦啦～" |
| `class_morning_start` | "{name}，上午的课要开始了吗？" | "{name}，上午的课即将开始，准备好了吗？" | "{name}，上课了，专心点。" | "{name}，要上课啦～带上小本本～" |
| `wake` | "{name}，早安，起床啦？" | "{name}，新的一天开始了，起床吧。" | "{name}，起床了，别赖床。" | "{name}，早安～慢慢睁眼睛～" |
| `sleep` | "{name}，准备睡觉了吗？" | "{name}，今天到这里，去休息吧。" | "{name}，睡觉去吧，别熬夜。" | "{name}，困了吧～盖好被子再睡～" |
| `evening_check` | "今天过得怎么样？看看日报或生成植物吧" | "今天的记录需要你来整理。" | "一天结束啦，看看今天做了啥。" | "今天也结束啦～来种颗小植物吧～" |
| `weekend_morning_check` | "周末上午好！在做什么呀？" | "周末了，上午有什么好计划？" | "周末了，上午干嘛呢？" | "周末早上好～悠闲地做什么呢～" |
| `weekend_afternoon_check` | "下午好，今天玩得开心吗？" | "周末下午，有没有好好放松？" | "下午好，周末怎么过的？" | "下午好～今天开心吗～" |
| `weekend_evening_check` | "周末的晚上好！要看看今日日报吗？" | "周末结束了，回顾一下今天吧。" | "周末过得咋样，看看日报不？" | "周末晚上好～来种颗小植物吧～" |

> 完整文案表见 `src/services/reminder/reminderCopy.ts` 实现（本文档仅列代表性样本）。

#### 4.5.5 去重与冲突规则

**规则一：当日已响应不重推**
- 同一 `reminder_type` 当天只会成功触发 1 次（用户点 ✓/✗ 或输入文字均视为"已响应"）

**规则二：活动记录智能静默（核心新增）**

提醒触发前，检查 `triggerTime ± 30 分钟` 窗口内，用户是否已通过 ChatPage 或弹窗输入框记录了**同类活动**。若已记录则**静默跳过**，不发通知也不弹弹窗。

**现有分类系统说明**：`src/lib/activityType.ts` 的 `classifyRecordActivityType()` 输出 6 类：`study / work / social / life / entertainment / health`。**没有独立的 `meal` / `sleep` 类型**，吃饭、起床、睡觉均归入 `life`（该类别还包括通勤、家务、购物等，太宽泛不可直接用于判断）。因此不同提醒类型采用不同的匹配策略：

| 提醒类型 | 匹配策略 | 具体条件 |
|---|---|---|
| `work_start` / `work_end` / `lunch_start` / `lunch_end` | `activityType` 字段 | `activityType === 'work'` |
| `class_morning_start/end` / `class_afternoon_start/end` / `class_evening_start/end` | `activityType` 字段 | `activityType === 'study'` |
| `meal_lunch` / `lunch_start` | 关键词匹配 `message.content` | 含 `['吃午饭','吃饭','午饭','午餐','干饭','点外卖','lunch','eat lunch']` 任一 |
| `meal_dinner` | 关键词匹配 `message.content` | 含 `['吃晚饭','晚饭','晚餐','干饭','点外卖','dinner','supper']` 任一 |
| `wake` | 关键词匹配 `message.content` | 含 `['起床','起来了','早安','起了','good morning','woke up']` 任一，或当日 04:00-10:00 内有任意消息 |
| `sleep` | 关键词匹配 `message.content` | 含 `['睡觉','睡了','晚安','准备睡','去睡','good night','going to sleep']` 任一 |

**数据来源**：`useChatStore` 中当日 user messages（`role === 'user'`），过滤 `createdAt` 在判定窗口内。`activityType` 字段已在消息入库时由 `normalizeActivityType()` 写入（`src/lib/activityType.ts`）。

**实现入口**：`useReminderStore.shouldSkipReminder(type, triggerTime)` 统一处理两条规则。

```ts
// src/store/useReminderStore.ts（示意）
function shouldSkipReminder(type: ReminderType, triggerTime: Date): boolean {
  // 规则一：当日已响应
  if (confirmedToday.has(type)) return true;
  // 规则二：活动记录静默
  const windowStart = new Date(triggerTime.getTime() - 30 * 60 * 1000);
  const windowEnd   = new Date(triggerTime.getTime() + 30 * 60 * 1000);
  const recentMsgs  = getTodayUserMessages().filter(m =>
    m.createdAt >= windowStart && m.createdAt <= windowEnd
  );
  if (matchesReminderActivity(type, recentMsgs)) return true;
  return false;
}
```

**规则三：活跃 session 静默（同类活动已在进行中）**

若用户在过去 **2 小时**内已记录同类活动且**此后没有新的记录**（即用户仍处于该活动的"持续状态"中），则跳过同类提醒——用户已经在做了，不需要再问。

| 提醒类型 | 匹配条件 |
|---|---|
| `work_start` | 过去 **2h** 内有 `activityType === 'work'` 的记录，且之后无任何新记录 |
| `class_*_start` | 过去 **2h** 内有 `activityType === 'study'` 的记录，且之后无任何新记录 |
| 吃饭/起床/睡觉类 | 不适用（三餐不存在"持续进行"状态，不做 session 静默） |

> **为什么是 2 小时**：2h 内刚记录过同类活动，几乎可以确定用户仍在进行中；超过 2h 则可能已结束，提醒才有意义。session_check（3h 无新记录）在此之后独立接管。

```ts
// 规则三判断（工作/上课类）
function isInActiveSession(type: ReminderType, now: Date): boolean {
  const category = SESSION_CATEGORY_MAP[type]; // 'work' | 'study' | null
  if (!category) return false;
  const cutoff = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const msgs = getTodayUserMessages().filter(m => m.createdAt >= cutoff);
  if (msgs.length === 0) return false;
  // 最新一条消息是同类活动，且之后没有任何新消息（仍在 session 中）
  const lastMsg = msgs[msgs.length - 1];
  return lastMsg.activityType === category;
}
```

**示例**：
- 用户 9:25 输入"开始写代码了"（`activityType='work'`）→ 9:30 的 `work_start` 静默（±30min 窗口命中）
- 用户 9:00 输入"上班了"，之后没有新记录 → 11:00 仍有 `work` session → 若触发工作类提醒静默跳过
- 用户 11:50 输入"去吃饭了"（content 含"吃饭"）→ 12:00 的 `lunch_start` 静默（±30min 命中）
- 用户 13:50 输入"下午课开始了"（`activityType='study'`）→ 14:00 的 `class_afternoon_start` 静默
- 用户 19:30 输入"出去逛街买东西"（content 不含晚饭关键词）→ `meal_dinner` **不**静默（正确）

---

### 4.6 自动计时逻辑

#### 4.6.1 计时事件模型（新建）

```ts
// src/services/reminder/timingSession.ts
interface TimingSession {
  id: string;
  userId: string;
  type: 'work' | 'lunch' | 'class' | 'dinner' | 'custom';
  startedAt: number;        // 时间戳
  endedAt?: number;         // 结束时打点
  source: 'reminder_confirm' | 'manual_input' | 'reminder_popup_input';
  date: string;             // 'YYYY-MM-DD'
}
```

- 存储：Supabase 新表 `timing_sessions` 或复用 `messages` 表 + 特殊 `activity_type='timing'`
- 同一时刻最多 1 个 active session（开启新 session 时自动结束旧的）

#### 4.6.2 结束条件（优先级从高到低）

1. **用户主动输入任何内容 → 立即结束当前 active session**
   - 入口 1：ChatPage 输入框发送
   - 入口 2：**提醒弹窗内的快捷输入框发送**（两者业务等价，见 § 4.5.2）
2. 下一个提醒类型的 ✓ 确认（如午休开始 → 工作结束）
3. `sleepTime` 触发 → 强制结束所有 active session
4. 次日 00:00 → 自动切分（跨日场景）

#### 4.6.3 主动输入直接打断计时

**核心原则：主动输入即视为当前活动的真实终点。**

- 用户在 ChatPage 输入任何内容 → **立即结束**当前 active session
- 输入的内容本身成为**新事件的起点**（新 session 开始计时）
- 新 session 的类型：由 AI 分类器判断（复用现有 `liveInputClassifier`）
- 时间线展示：前一段计时事件 + 用户主动记录事件 = 首尾相连的时间线

**示例**：
```
09:30 工作开始（提醒确认）
10:15 用户输入"开会"
      → 工作 session 在 10:15 结束（时长 45min）
      → 会议 session 从 10:15 开始
12:00 午休提醒弹出（此时处于"会议"计时中）
      → 用户点击 ✓ → 会议 session 结束，午餐开始
```

**为什么不做"嵌套事件"**：
- 数据模型简单（一个时刻最多 1 个 active session）
- 用户心智清晰（"当前在做什么" 永远只有一个答案）
- 符合"懒人记录"定位（不需要考虑是"打断"还是"并行"）

**边界情况**：
- 用户输入的是情绪/感受（如"好累"）：不视为新活动，不打断计时
  - 判断规则：`liveInputClassifier` 返回 `mood=true` 或 `activity_type=null` 时不打断
- 用户输入的是待办/未来事件（"明天要开会"）：不打断计时

---

### 4.7 晚间总结提醒（固定 20:00）

- 时间点：**每日 20:00 固定**（不受身份影响，所有用户生效）
- **触发前置条件**：当日植物**且**日记均未生成，才发通知/弹窗。任意一个已生成则当日不再提醒。（代码实现：`!plantDone && !diaryDone`，现有 `useNightReminder.ts` 已按此逻辑修复）
- 若 20:00 用户仍在"工作/上课"计时中 → 提醒文案带"你好像还在忙，休息时再看看"
- 弹窗内容：
  - 今日事件数（"你今天记录了 X 件事"）
  - 两个主按钮：
    - `[ 生成今日植物 ]` → 跳转 Growth 页
    - `[ 查看今日日报 ]` → 跳转 Report 页
  - 次按钮：`[ 稍后提醒 ]` → 21:00 再推一次，再拒则当天不再推

---

### 4.8 "我的"页面配置入口 —— 扩展 UserProfilePanel

#### 4.8.1 设计原则

**不新增独立卡片，而是扩展现有的 `UserProfilePanel`。**

现有 `UserProfilePanel` 已经覆盖了 `wakeTime / sleepTime / breakfastTime / lunchTime / dinnerTime / freeText` 等作息字段，这是天然的扩展点。在其基础上新增"日程类型"勾选和"提醒设置"区块即可。**日程类型（`hasWorkSchedule` / `hasClassSchedule`）只作为显示哪些时间字段的开关，不在任何 UI 界面向用户展示为"身份"标签。**

#### 4.8.2 Profile 页面整体不变

```
┌─ Profile ─────────────────┐
│  UserInfoCard             │
│  AIModeSection            │
│  AIAnnotationDropRate     │
│  DailyGoalToggle          │
│  LongTermProfileToggle    │
│  ★ UserProfilePanel（扩展）│ ← 现有组件，新增区块
│  MembershipCard           │
│  SettingsList             │
└───────────────────────────┘
```

- `UserProfilePanel` 默认已在 `LongTermProfileToggle` 开启时通过 `UserProfileSection` 渲染出来（参见 ProfilePage.tsx:61-64）
- 保留它的折叠/展开、保存按钮逻辑，增加新字段复用同一套保存流程（`updateUserProfile`）

#### 4.8.3 UserProfilePanel 展开后新结构

```
┌ UserProfilePanel ──────────────────────────┐
│ [A] 我的日程（新增）                          │
│     ☐ 有固定的上班 / 工作时间                 │
│     ☐ 有固定的上课时间                       │
│                                            │
│ [B] 作息时间（原有 + 按勾选扩展）             │
│     通用：🌅 起床 / 🌙 睡觉                  │
│           🍞 早餐 / 🍜 午餐 / 🍲 晚餐         │
│                                            │
│     【勾选"上班时间"后额外显示】               │
│           💼 上班开始 / 上班结束              │
│           🛋 午休开始 / 午休结束              │
│                                            │
│     【勾选"上课时间"后额外显示】               │
│           📚 上午课  start - end            │
│           📚 下午课  start - end            │
│           📚 晚自习  start - end            │
│           [ 导入课表图片 ]  [ 手动填写 ]       │
│                                            │
│ [C] 主动提醒（新增）                         │
│     🔔 开启定时提醒           [切换开关]      │
│     🔔 通知权限：已开启 / 去设置              │
│     ⏰ 已生成今日提醒 5 条    [查看详情]      │
│                                            │
│ [D] 个性化说明（原有 freeText）               │
│     [ 多行文本输入框 ]                       │
│                                            │
│ [保存]                                      │
└────────────────────────────────────────────┘
```

#### 4.8.4 字段展示规则

- **默认状态** → 只显示通用作息字段（起床/睡觉/三餐），勾选对应日程后扩展显示额外字段
- **取消勾选时** → 保留已填通用字段，清空对应专属字段（如取消"上课时间"时清空课表，弹确认）
- **课表导入按钮** → 点击后走 4.3 节流程，返回后填入 `morning/afternoon/evening` 三个时段
- **提醒开关关闭** → 所有系统通知取消调度，但字段保留

#### 4.8.5 i18n 新增 key

```
profile_user_profile_has_work_schedule    ← "有固定的上班 / 工作时间"
profile_user_profile_has_class_schedule   ← "有固定的上课时间"

profile_user_profile_work_start
profile_user_profile_work_end
profile_user_profile_lunch_start
profile_user_profile_lunch_end

profile_user_profile_class_morning
profile_user_profile_class_afternoon
profile_user_profile_class_evening
profile_user_profile_class_import_image
profile_user_profile_class_manual

profile_user_profile_reminder_enable
profile_user_profile_reminder_permission
profile_user_profile_reminder_today_count
```

- 字体规范：遵循 4.8 章前版本改造后的字体标准（`text-sm` 标签、`text-xs` 说明）
- 图标：lucide-react 统一 size={18}，颜色 `#5F7A63`

---

### 4.9 周末 / 节假日模式

#### 4.9.1 判定规则

**节假日检测复用现有 `holiday-resolver.ts` 能力**（`src/server/holiday-resolver.ts`，基于 `date-holidays` 包，已在 annotation 链路运行）。

由于 `holiday-resolver.ts` 仅能在 Node.js 服务端运行，前端通过已有 serverless 端点的查询分支来调用：

```ts
// api/live-input-telemetry.ts（GET module=holiday_check 分支）
// GET /api/live-input-telemetry?module=holiday_check&date=2026-05-01&country=CN
// Response: { isFreeDay: boolean, reason: 'weekend' | 'legal_holiday' | 'social_holiday' | null, name?: string }
import { resolveHoliday } from '../src/server/holiday-resolver.js';

export default async function handler(req, res) {
  const { date, country = 'CN' } = req.query;
  const isoDate = String(date);
  const d = new Date(isoDate);
  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
  if (isWeekend) return res.json({ isFreeDay: true, reason: 'weekend' });
  const holiday = resolveHoliday({ countryCode: String(country), lang: 'zh', currentDate: { isoDate, ... } });
  if (holiday.isHoliday && holiday.type === 'legal') {
    return res.json({ isFreeDay: true, reason: 'legal_holiday', name: holiday.name });
  }
  return res.json({ isFreeDay: false, reason: null });
}
```

前端 `reminderScheduler.ts` 在每日调度时（App 启动 / 00:10 定时）**调用一次** `module=holiday_check` 分支，缓存结果到 `localStorage` 当日有效，避免重复请求：

```ts
// src/services/reminder/reminderScheduler.ts
async function getIsFreeDay(date: Date, countryCode: string): Promise<boolean> {
  const key = `freeDay_${date.toISOString().slice(0, 10)}`;
  const cached = localStorage.getItem(key);
  if (cached !== null) return cached === 'true';
  const res = await fetch(`/api/live-input-telemetry?module=holiday_check&date=${date.toISOString().slice(0, 10)}&country=${countryCode}`);
  const { isFreeDay } = await res.json();
  localStorage.setItem(key, String(isFreeDay));
  return isFreeDay;
}
```

- **判定优先级**：周末（`Date.getDay() in [0,6]`） > 法定节假日（`type === 'legal'`） > 工作日
- **社交节日**（情人节/圣诞等）**不切换自由作息模式**，仅在 AI 批注文案中使用（原有行为不变）
- `countryCode` 来源：`useAuthStore.preferences.countryCode`（用户登录时按手机系统语言/时区推断，已有字段）
- 判定结果在**每日调度时**执行一次，当天队列固定不重判。

#### 4.9.2 工作日 vs 周末的提醒切换

| 维度 | 工作日 | 周末/节假日 |
|---|---|---|
| 作息提醒 | 按用户身份全量（`work_start/lunch_start/…`） | **全部静默，不触发** |
| 课表提醒 | 按 `classSchedule.weekdays` 决定 | **全部静默，不触发** |
| 起床/睡觉提醒 | 触发（`wake / sleep`） | **静默**（不打扰自由作息） |
| 三餐提醒 | 触发（`meal_lunch / meal_dinner`） | **静默** |
| 固定询问 | 无 | **10:00 / 16:00 / 20:00 各一次** |
| 晚间总结 | `evening_check`（20:00） | `weekend_evening_check`（20:00，替代） |

> **设计意图**：周末不主动干扰用户节奏；但用 3 个低频询问点覆盖"早/中/晚"三个时段，让懒得主动记录的用户仍有机会一键留下痕迹。

#### 4.9.3 静默条件（已主动记录则跳过）

对每个周末询问时段，若用户在以下窗口期内**已通过 ChatPage 或弹窗输入框发送过任意消息**，该时段的询问**静默跳过**：

| 询问时间 | 静默判定窗口 |
|---|---|
| `weekend_morning_check`（10:00） | 当日 06:00 ~ 10:00 有消息记录 |
| `weekend_afternoon_check`（16:00） | 当日 12:00 ~ 16:00 有消息记录 |
| `weekend_evening_check`（20:00） | 当日 17:00 ~ 20:00 有消息记录 |

**实现入口**：`useReminderStore.shouldSkipReminder(type, date)` — 复用工作日已有的"主动输入去重"逻辑（§ 4.5.5），判断条件窗口改为上表区间。

#### 4.9.4 弹窗内容（周末固定询问）

沿用 §4.5.2 的弹窗结构（AI头像 + 文案 + ✓/✗ + 快捷输入框），差异如下：

- **✓ 按钮文案**：`t('reminder_weekend_confirm')` → "好的，记一下"
- **✗ 按钮语义**：打开 QuickActivityPicker，当日该时段不再提醒（与工作日行为一致，均无重试）
- **输入框**：保持原有"直接告诉我"语义，发送后等同 ChatPage 发消息

#### 4.9.5 调度器实现要点

```ts
// src/services/reminder/reminderScheduler.ts
function buildReminderQueue(profile: UserProfileV2, date: Date): ScheduledReminder[] {
  if (isWeekend(date)) {
    // 周末：只调度 3 个固定询问
    return [
      { type: 'weekend_morning_check',   time: '10:00' },
      { type: 'weekend_afternoon_check', time: '16:00' },
      { type: 'weekend_evening_check',   time: '20:00' },
    ];
  }
  // 工作日：按原有逻辑构建队列
  return buildWeekdayReminderQueue(profile);
}
```

- 周末模式下 `ScheduledReminder[]` 固定 3 条，无需读取身份/作息字段
- 通知 ID 规范：`reminder_weekend_morning_check_1000` / `…_afternoon_check_1600` / `…_evening_check_2000`
- iOS 本地通知在每日 00:10 重新调度（复用工作日已有的"每日重调度"逻辑）

#### 4.9.6 与其他系统的交互

- **自动计时（§4.6）**：周末不触发任何计时，弹窗输入框发送的消息走普通 ChatStore 发送路径，不创建 `TimingSession`。
- **晚间总结（§4.7）**：工作日走 `evening_check`，周末走 `weekend_evening_check`；逻辑相同，文案不同。
- **提醒去重（§4.5.5）**：`weekend_*` 类型当日各触发 1 次，不与工作日类型共享去重 key。

---

### 4.10 Idle 系统（两种形态）

> 对应现有类型定义 `idle_detected`（`src/types/annotation.ts:18`），目前只有类型，从未被触发。本节补齐完整触发逻辑，并拆分为两种 idle 形态。

Idle 分为两个独立场景，触发条件不同：

| 形态 | 触发条件 | 行为 |
|---|---|---|
| **A. In-session idle**（`session_check`） | 任意 activityType 的消息后 3h 无新记录 | 50% 问"还在做 xxx 吗"（**提醒用户继续记录**） / 50% AI 主动问候 |
| **B. App-closure idle**（`idle_nudge`） | 用户关闭 App 超过 4h 未打开 | 始终走 AI 主动问候 |

> **session_check 设计意图**：核心目的是**提醒用户记录**，而不是检测 session 是否真的还在进行。"还在做X吗"只是引导用户确认/更新状态的问法，并非断言用户一定还在进行中。全6种活动类型都应触发——哪怕是"逛超市"这类短暂活动，3小时没有任何记录本身就是一个值得问的信号。

---

#### 4.10.1 In-session Idle（session_check）

**触发时序**：

```
用户发送任意 activityType（全6种）的消息
  └─ 取消旧 session_check / idle_nudge 通知（若有）
  └─ 随机决定本次形态：Math.random() < 0.5
       ├─ 50% → 安排 session_check 通知（now + 3h）
       │         actionTypeId: 'SESSION_CHECK'
       │         extra: { reminderType: 'session_check', activityType, content: DISPLAY_LABEL[activityType] }
       │         body: getReminderCopy(aiMode, 'session_check', { activity: DISPLAY_LABEL[activityType] })
       └─ 50% → 安排 idle_nudge 通知（now + 3h）
                actionTypeId: 'IDLE_NUDGE'
                body: getReminderCopy(aiMode, 'idle_nudge', { name })
  └─ 写入 lastActivityRecord = { content, activityType, timestamp }（localStorage）

用户发送任意新消息
  └─ 取消 session_check / idle_nudge 通知并重新安排（同上流程）
```

**触发限制**：
- 全6种活动类型均触发（场景是防止用户**忘记记录**，不是判断 session 是否持续）
- 静默窗口：22:00 ~ 08:00，推迟到次日 08:00
- 每日合计（session_check + idle_nudge）最多 2 条

**session_check 通知视觉**：

```
── 默认横幅 ──────────────────────────────────────────
  [App图标]  Tshine         [时间]  [AI头像缩略图]
  Van：你上次记录运动是 3 小时前，还在继续吗？
── 长按展开 ──────────────────────────────────────────
        ✓ 还在             ← still_yes：重新安排 3h 后再检查，不打开 App
  ──────────────────────────────────────────────────
        我在做别的         ← still_no：打开 App → QuickActivityPicker
──────────────────────────────────────────────────────
```

**session_check 文案模板**（`{activity}` = 固定类别词，**不使用原始输入**）：

```ts
// activityType → 显示词映射（全6种）
const ACTIVITY_DISPLAY_LABEL: Record<ActivityRecordType, string> = {
  work:          '工作',
  study:         '学习',
  social:        '社交活动',
  life:          '日常活动',
  entertainment: '娱乐',
  health:        '运动',
};
// body 文案模板：统一用"上次记录"句式，避免动词搭配问题
const activity = ACTIVITY_DISPLAY_LABEL[lastActivityRecord.activityType];
// → "你上次记录{activity}是 3 小时前，还在继续吗？"
```

> ✗ 不用"你已经社交了3小时" / "你已经生活了3小时"——这类句式动词搭配奇怪。改用"上次记录X是N小时前"，任何类别都自然。

| 人格 | session_check 文案（{activity} 见上表） |
|---|---|
| Van | "你上次记录{activity}是 3 小时前，还在继续吗？" |
| Agnes | "{activity}的进展怎么样了？3 小时没更新啦。" |
| Zep | "嘿，{activity}还在搞吗？3 小时没动静了。" |
| Momo | "上次记录{activity}已经过了 3 小时，还在吗～" |

**用户响应**：

| 操作 | 结果 |
|---|---|
| **点 ✓ 还在继续** | 重新安排 3h 后的下一次检查（再次 50/50 随机） |
| **点 我在做别的（通知按钮）** | 打开 App → 停留在 ChatPage → **底部自动弹出 QuickActivityPicker** |
| **点 我在做别的（应用内弹窗 ✗）** | 当前页面底部滑入 QuickActivityPicker，不跳转 ChatPage |
| **直接点横幅** | 打开 App → 显示 `ReminderPopup`（标准提醒弹窗，含 ✓/✗ + 输入框，见 §4.5.2） |

##### QuickActivityPicker（底部 bottom sheet）

点"我在做别的"后弹出：

```
╔══════════════════════════════════════════════════╗
║  你结束工作了，现在在做什么？                       ║  ← {activity} 用固定词
║                                                  ║
║  [🍽 吃饭]  [😴 休息]  [🎮 娱乐]                  ║
║  [🏃 运动]  [💬 社交]  [✏️ 其他]                  ║
║                                                  ║
║  ┌──────────────────────────────┐  ┌──┐          ║
║  │ 或者直接告诉我...              │  │↑│          ║
║  └──────────────────────────────┘  └──┘          ║
╚══════════════════════════════════════════════════╝
```

- **形态**：ChatPage 底部 bottom sheet，从底部滑入，不遮挡聊天内容，可下滑关闭
- **快捷按钮** → `useChatStore.sendMessage()` 直接发对应文字，走正常 annotation 流程
  - 🍽 吃饭 → `t('quick_activity_meal')`
  - 😴 休息 → `t('quick_activity_rest')`
  - 🎮 娱乐 → `t('quick_activity_entertainment')`
  - 🏃 运动 → `t('quick_activity_health')`
  - 💬 社交 → `t('quick_activity_social')`
  - ✏️ 其他 → focus 输入框
- **关闭（下滑/点遮罩）** → 不发消息，用户之后自己输入
- **组件**：约 50 行，纯展示，数据来自 `useReminderStore.lastSessionActivity`
- **触发**：`router.push('/chat?show_quick_picker=1&activity=work')`，ChatPage 读取 query param

---

#### 4.10.2 App-closure Idle（idle_nudge）

**触发时序**：

```
用户关闭 App（appStateChange.isActive = false）
  └─ 记录 lastActiveAt = Date.now()（localStorage）
  └─ 取消旧 idle_nudge 通知（若有）
  └─ 安排 idle_nudge 通知（triggerTime = lastActiveAt + 4h）
       若触发时间在 22:00-08:00 → 推迟到次日 08:00

用户打开 App（appStateChange.isActive = true）
  └─ cancelIdleNudge()
  └─ 更新 lastActiveAt = Date.now()
```

- 每日最多 1 条（独立于 session_check 计数）
- 不做 50/50，始终走固定文案

**idle_nudge 文案**：

| 人格 | 文案 |
|---|---|
| Van | "好久不见～今天有什么想聊的吗？" |
| Agnes | "你已经有一段时间没有记录了，要来看看吗？" |
| Zep | "嘿，还活着吗？来说说话。" |
| Momo | "好久没见到你啦～有想和我说的吗～" |

**点击行为**：进入 ChatPage → 触发 `triggerAnnotation('idle_detected')` → AI 生成主动问候消息

---

#### 4.10.3 通知类别注册

已合并至 §4.4.2（`SESSION_CHECK` 类别），此处不重复。

回调已合并至 §4.4.6（`still_yes` / `still_no` / `pause_today`），此处不重复。

---

#### 4.10.4 新增 ReminderType

```ts
| 'idle_nudge'     // App 关闭 4h，AI 主动问候
| 'session_check'; // 任意活动类型 3h 无新记录，询问是否还在进行
```

---

## 4.11 iOS Widget 设计规格（桌面组件）

> **待决策**：Widget 涉及原生 Swift/SwiftUI 开发，需要在 Capacitor 原生层实现，排期独立于 JS 功能迭代。本节为设计规格存档，待 App 功能稳定后单独立项。

### 4.11.1 Widget 是什么

iOS Widget 是显示在主屏幕或锁屏上的**原生 Swift/SwiftUI 组件**，与 Capacitor WebView 完全独立运行。

- 不是 Web 页面，不能嵌入 React 组件
- 不能实时联网，只能读取 **App Group 共享 UserDefaults**（App 主进程写入，Widget 读取）
- 用户点击 Widget → 通过 URL Scheme（`tshine://widget-tap?action=xxx`）唤起主 App 并跳转
- 系统定时刷新（最小间隔 ~15min，不可精确控制）

### 4.11.2 Widget 展示内容规格

**小尺寸（2×2）**
```
┌──────────────────────┐
│  🌿 今日已记录 3 条    │
│  14:23 上次更新       │
│  [+ 快速记录]         │
└──────────────────────┘
```

**中尺寸（4×2）**
```
┌──────────────────────────────────────┐
│  本周状态：稳定高效 ✦               │
│  ─────────────────────────────────── │
│  今日：工作 2h · 运动 30min · 3 条  │
│  [+ 快速记录]   [查看日报]           │
└──────────────────────────────────────┘
```

数据来源（App Group UserDefaults key）：

| Key | 内容 | 更新时机 |
|-----|------|---------|
| `widget_today_count` | 今日记录条数 | 每次成功提交 message |
| `widget_last_update` | 上次更新时间戳 | 同上 |
| `widget_weekly_summary` | `weeklyStateSummary.value`（≤20字）| 周报生成后 |
| `widget_today_activities` | 今日活动类型列表（JSON）| 每次提交 |

### 4.11.3 Widget 与通知的功能分配

| 功能 | 通知 | Widget |
|------|------|--------|
| 主动提醒（时间敏感）| ✅ 有时效性，可操作 | ✗ 刷新不可控 |
| 静态状态展示 | ✗ 不适合 | ✅ 持久可见 |
| 快速记录入口 | ✗ | ✅ 点击跳转 ChatPage |
| ✓/✗ 确认操作 | ✅ 长按展开 | ✗ Widget 无交互按钮 |
| 今日进度鼓励 | ✗ | ✅ 每日激励文案 |

**结论**：通知负责时间触发 + 用户操作确认，Widget 负责常驻状态展示 + 快速入口。两者互补，Widget 上线后通知频率可适当降低（用户有了被动感知渠道）。

### 4.11.4 前端 Bridge 接口（JS → Native）

```ts
// src/services/native/widgetBridge.ts（待新建）
export function updateWidgetData(data: {
  todayCount: number;
  lastUpdate: string;      // ISO
  weeklySummary?: string;  // ≤20 chars
  todayActivities?: string[];
}): void {
  // Capacitor Plugin → App Group UserDefaults
  // 实现：调用 Capacitor.Plugins.WidgetBridge.updateData(data)
  // Native 层：iOS AppGroupUserDefaults.write(...)
}
```

> **待决策**：需要决定是使用现有 `@capacitor-community/sqlite` 的 App Group 能力，还是自定义 Capacitor Plugin。推荐后者，插件约 50 行 Swift。

### 4.11.5 第一次收到通知长按提示

> **待决策**：触发时机和提示 UI 样式，待 UX 评审后定稿。

**背景**：iOS 通知默认不显示操作按钮，用户需要长按（或从通知栏下拉展开）才能看到 ✓/✗ 按钮。大多数用户不知道这个操作。

**方案**：
- 触发时机：用户**第一次**收到带操作按钮的通知（`CONFIRM_DENY` 类别）后，下次打开 App 时
- 存储标记：`localStorage.getItem('notification_tip_shown')` — 展示后写 `'1'`，永不再显示
- UI 形式：底部 Toast（非模态），显示 3s 自动消失

```
┌─────────────────────────────────────────┐
│  💡 小技巧：长按通知可以直接确认或跳过  │
│                              [我知道了] │
└─────────────────────────────────────────┘
```

- 检测逻辑：`LocalNotifications.addListener('localNotificationReceived', ...)` 首次触发时，在 App Group / localStorage 写入 `first_action_notification_received = true`，下次 App resume 时检查并显示

---

## 5. 数据模型总览

### 5.1 扩展位置

| 字段 | 存储位置 | 类型 |
|---|---|---|
| `lifeStage` | `auth.user.user_metadata.life_stage` | string |
| `workStart / workEnd / lunchStart / lunchEnd` | `user_metadata.schedule.*` | string(HH:MM) |
| `wakeTime / sleepTime / dinnerTime` | `user_metadata.schedule.*` | string(HH:MM) |
| `classSchedule` | `user_metadata.class_schedule` | JSON Array |
| `reminderEnabled` | `user_metadata.reminder_enabled` | boolean |
| `onboardingCompleted` | `userProfileV2.onboardingCompleted` | boolean（已存在） |
| `timing_sessions` | 新 Supabase 表 / messages 复用 | 见 4.6.1 |

### 5.2 本地镜像

- `useAuthStore.preferences` 新增 `schedule` 子对象
- `useAuthStore.updatePreferences` 复用即可，无需新 action

---

## 6. 可复用现有资产

| 资产 | 用途 |
|---|---|
| `lib/modalTheme.ts` | 弹窗样式统一 |
| `YesterdaySummaryPopup` | Toast 型提醒的交互参考 |
| `DailyGoalPopup` | 中央弹窗 + 长按禁用模式参考 |
| `AI_COMPANION_VISUALS` (`src/constants/aiCompanionVisuals.ts`) | 提醒弹窗左侧头像来源（与批注气泡一致） |
| `AIAnnotationBubble` | 头像 + 文本左右排布的样式参考 |
| `UserProfilePanel` | **直接扩展**：作息字段的保存/表单基础，新字段附加在此组件内 |
| `userProfilePanelHelpers.ts` | `buildManualPayload` 需扩展以支持新字段 |
| `useAuthStore.updateUserProfile` | 批量写入 user_metadata |
| `lib/imageUtils.resizeImageToDataUrl` | 课表图片压缩 |
| `api/magic-pen-parse` | AI 解析 serverless 架构参考 |
| `hooks/useNightReminder` | 前台提醒的时间触发逻辑参考 |
| `triggerLightHaptic()` | 交互触觉反馈 |
| i18n 体系（`t('key')`） | 所有文案必须走 i18n |

---

## 7. 需新建模块

### 7.1 Capacitor 集成
- 安装 `@capacitor/local-notifications`（`npm install @capacitor/local-notifications && npx cap sync ios`）
- `src/services/notifications/localNotificationService.ts`：
  - `registerNotificationCategories()`：注册 `CONFIRM_DENY / EVENING_CHECK / WEEKEND_CHECK / IDLE_NUDGE` 四类动作
  - `scheduleRemindersForToday()`：每日重建通知队列
  - `scheduleIdleNudge()` / `cancelIdleNudge()`：idle 检测调度（见 §4.10）
  - `checkMissedReminders()`：App 启动时补弹错过的提醒
  - `handleActionPerformed()`：统一回调处理（confirm/deny/view_report/grow_plant/open_chat）
- **迁移**：`src/hooks/useNightReminder.ts` 逻辑合并入 `reminderScheduler.ts`，原文件可删除

### 7.2 Onboarding 流程
- `src/features/onboarding/OnboardingFlow.tsx`（多步骤容器）
- `src/features/onboarding/steps/*.tsx`（欢迎/权限/身份/作息/确认）
- 路由守卫：App 启动时检查 `onboardingCompleted`，否则重定向

### 7.3 课表解析
- `api/parse-schedule.ts`（serverless AI 图片解析）
- `src/features/onboarding/ClassScheduleEditor.tsx`（预览+编辑）
- `src/services/schedule/scheduleParser.ts`（合并课间逻辑）

### 7.4 提醒系统
- `api/live-input-telemetry.ts`（扩展 `GET module=holiday_check` 分支；`?date=&country=` → `{ isFreeDay, reason, name? }`）
- `src/services/reminder/reminderScheduler.ts`（根据作息生成每日提醒队列；调用 `module=holiday_check` 判断是否自由作息日）
- `src/services/reminder/reminderTypes.ts`（`ReminderType` 枚举）
- `src/services/reminder/reminderCopy.ts`（**4 人格 × 18 种提醒类型**的固定文案表 + `getReminderCopy()`，含3种周末专用类型）
- `src/components/ReminderPopup.tsx`（统一弹窗组件，**左侧显示 AI 头像**）
  - 头像来源：复用 `src/constants/aiCompanionVisuals.ts` 的 `AI_COMPANION_VISUALS[aiMode].avatar`
  - 与 `AIAnnotationBubble` 使用同一批头像
- `src/store/useReminderStore.ts`（当日提醒状态、冲突去重）

### 7.5 计时系统
- `src/services/timing/timingSessionService.ts`（CRUD + 冲突处理）
- `src/store/useTimingStore.ts`（当前 active session、今日会话列表）
- Supabase migration：`timing_sessions` 表（或复用 messages）

### 7.6 Profile 配置入口（不新建独立组件）
- **直接扩展** `src/features/profile/components/UserProfilePanel.tsx`
- 新增区块：身份选择、按身份条件渲染作息字段、课表导入按钮、提醒开关
- 扩展 `userProfilePanelHelpers.ts` 的 `buildManualPayload` 支持新字段
- 不新建 `ScheduleReminderCard.tsx`（避免功能分散）

---

## 8. 边界情况与异常处理

| 场景 | 处理 |
|---|---|
| 用户未授予通知权限 | 降级为 App 前台弹窗（进入 App 后检查是否错过提醒） |
| 设备关机/App 被杀 | 依赖 iOS 本地通知持久化（Capacitor 已支持） |
| 用户作息跨日（如夜班 22:00 上班） | 支持 `workStart > workEnd`，视为次日结束 |
| 时区切换（出差） | 跟随设备时区，不强制用户配置 |
| 提醒时 App 在前台 | 直接显示 App 内弹窗（不推送系统通知） |
| 用户修改作息 | 次日生效，当日已调度的提醒不重排 |
| 节假日/周末 | 自动识别（`Date.getDay() in [0,6]`）切入"自由作息"模式：停止所有作息/课表提醒，改为 10:00/16:00/20:00 三次轻询问；有主动记录则静默（见 §4.9） |

---

## 9. 可扩展 / 后续版本（v2+）

> 以下为 **Claude 补充建议**，需产品再评估优先级。

1. **智能学习**：连续 7 天用户都在 9:15 就开始工作 → 建议将 `workStart` 前移
2. **事件类型细分**：工作时段细分"专注/会议/摸鱼"（通过主动输入关键词推断）
3. **通勤时段**：工作党身份下，`workStart - 30min` 自动插入"通勤"计时
4. ~~**周末/节假日模式**~~：**已纳入 v1，见 §4.9**
5. **提醒延后学习**：用户连续 3 天点击 ✗ → 询问是否需要调整时间/关闭该提醒
6. ~~**陪伴人格融入**~~ **（已在 v1 纳入，见 § 4.5.2 ~ 4.5.4）**
7. **聚合日报**：晚间 20:00 提醒中直接预览"今日时间饼图"，增强反馈感
8. **情绪关联**：结束计时时弹一个轻量情绪选择器（3 秒可跳过）
9. **Apple Watch 快捷操作**：iOS 端后续支持手表端 ✓/✗ 确认
10. **隐私开关**：用户可关闭"自动计时"但保留"提醒询问"，仅用于日程触发

---

## 10. 待确认问题

1. ~~**节假日处理**：v1 是否要区分工作日/周末？~~ **已决策：v1 复用现有 `holiday-resolver.ts`（`date-holidays`），通过 `/api/live-input-telemetry?module=holiday_check` 桥接到前端调度器；周末 + 法定节假日均切自由作息，社交节日不切换。见 §4.9。**
2. **多 session 冲突**：用户 10:00 开始工作，10:30 又确认"开始上课" → 如何处理？
3. **提醒最小间隔**：两个相邻提醒间距应 ≥ 多少分钟才合理？（避免 08:00 起床 + 08:15 上班过于密集）
4. **计时精度**：最小单位到"分钟"还是"5 分钟"？
5. **历史数据迁移**：现有老用户是否需要强制走一次 onboarding？
6. **取消/修改权限**：用户是否可随时在设置里关闭单个提醒类型？
7. **海外用户**：提醒是否需要配合 `i18next` 多语言文案？（应该要）
8. **Plus 会员绑定**：是否把"智能学习"（v2.1）做成 Plus 专属？
9. **人格文案补全**：4 × 15 = 60 条固定文案由谁撰写？产品/运营 or Claude 草拟后人工校对？
10. **人格未选/未启用**：如果用户关闭了 `aiModeEnabled`，提醒头像用默认哪个？（建议：仍显示 `aiMode` 最近一次选中的，或降级为应用 Logo）
11. **系统通知中的头像**：iOS 本地通知的 attachment 能否携带头像？若不能，头像仅在 App 前台弹窗展示。

---

## 11. 非目标（v1 不做）

- ✗ 用户之间共享作息
- ✗ 多设备同步实时计时（iOS 本地即可）
- ✗ 自动识别"通勤中"位置（需要持续定位权限，审核风险）
- ✗ 与系统日历互通
- ✗ 家长/导师视角查看
- ✗ 数据导出 CSV

---

## 12. 开发优先级建议（供排期参考）

### Phase 1（MVP · 最小可用）
1. **Capacitor 本地通知集成**：安装插件、注册 4 种通知类别、`CONFIRM_DENY` 动作回调
2. **Idle Nudge**：App 关闭时安排 24h idle 通知，打开时取消；点击后触发 `idle_detected` 进 ChatPage（最小改动，单独上线）
3. **迁移 useNightReminder**：22:00 植物/日记提醒改为原生通知（`evening_check`）
4. Onboarding 基础流程（只做工作党路径）
5. `work_start` + `work_end` + `lunch_start` 3 个提醒
6. 简单计时（TimingSession 表）

### Phase 2（完整身份支持）
6. 学生/自由职业/无业三种路径
7. 课表图片 AI 解析
8. "我的"配置入口
9. ✗ 行为：永久跳过当日此类提醒 + 打开 QuickActivityPicker

### Phase 3（体验打磨）
10. 主动输入静默跳过提醒
11. 冲突去重
12. 人格化文案
13. 智能学习建议

---

## 13. 同步更新检查清单

提交实现前需更新：

- [ ] `docs/PROJECT_MAP.md` — 新增 `src/features/onboarding/`、`src/services/reminder/`、`src/services/timing/` 目录
- [ ] `docs/CURRENT_TASK.md` — 任务切换记录
- [ ] `docs/CHANGELOG.md` — 功能上线条目
- [ ] `src/features/profile/README.md` — 新增作息与提醒模块说明
- [ ] `api/README.md` — 新增 `parse-schedule` 接口
- [ ] `src/types/userProfile.ts` — 扩展 `UserProfileManualV2`

---

**文档结束**。产品评审通过后，请在 `docs/CURRENT_TASK.md` 登记本任务并拆分为 Phase 1 的具体 issue。
