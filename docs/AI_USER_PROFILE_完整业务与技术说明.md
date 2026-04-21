# AI 用户画像完整业务与技术说明（面向产品/业务/研发）

> 适用范围：当前仓库已上线实现（2026-04）
> 目标读者：产品、业务运营、前后端开发、测试

---

## 1. 一句话说明

AI 用户画像系统是一个「周报触发、按语言提取、写入长期记忆、在批注时按需注入」的闭环：

- 每次用户生成周报时，系统会并行触发画像提取。
- 提取结果写入 Supabase Auth 的 `user_metadata.user_profile_v2`。
- 用户开启长期画像开关时，这些画像会在每次 AI 批注请求中作为 `userProfileSnapshot` 注入 prompt。

---

## 2. 业务逻辑全链路（端到端）

### 2.1 触发时机

不是定时任务，不是 cron；当前是**周报触发**：

1. 用户点击生成周报（`generateReport('weekly')`）。
2. 业务层并行调用 `triggerWeeklyProfileExtraction(messages)`。
3. 满足开关开启 + 有有效消息时，发起 `/api/extract-profile`。

关键文件：

- `src/store/useReportStore.ts`
- `src/store/reportActions.ts`

关键代码（简化）：

```ts
if (type === 'weekly') {
  void triggerWeeklyProfileExtraction(messages);
}
```

### 2.2 提取输入

输入来自最近消息（最多 120 条），包含：

- `id`
- `content`
- `timestamp`
- `duration?`
- `activityType?`
- `isMood?`

同时传入语言：`lang: 'zh' | 'en' | 'it'`。

关键文件：

- `src/store/reportActions.ts`
- `src/api/client.ts`
- `api/extract-profile.ts`

### 2.3 提取模型与 prompt

- Provider：OpenAI
- 默认模型：`gpt-4o-mini`（可用 `PROFILE_EXTRACT_MODEL` 覆盖）
- 调用方式：`chat.completions` + `response_format: json_object`
- Prompt 路由：按 `lang` 分流中/英/意三套文案，规则一致

关键文件：

- `src/server/extract-profile-service.ts`

### 2.4 提取输出（画像 patch）

服务端只返回 `Partial<UserProfileV2>` patch，不返回整份用户资料。

核心输出层级：

- `observed`（行为观测）
- `dynamicSignals`（动态信号）
- `anniversariesVisible`（可见纪念日）
- `hiddenMoments`（隐性记忆）
- `lastExtractedAt`

本轮新增 3 个周维度特征（位于 `observed`）：

- `weeklyStateSummary`：七天状态一句话
- `topActivities`：最常做的三件事
- `topMoods`：最高频的三种心情

### 2.5 存储落点

提取结果不直接写业务表，而是由前端调用 Auth 更新接口合并写回：

- `supabase.auth.updateUser({ data: nextMeta })`
- 存在于 `auth.users.raw_user_meta_data`（即 `user_metadata`）

关键键：

- `long_term_profile_enabled`
- `user_profile_v2`

关键文件：

- `src/store/useAuthStore.ts`
- `src/store/authProfileHelpers.ts`

### 2.6 消费方式（批注链路）

当长期画像开关开启时：

1. 前端构建 `userProfileSnapshot`。
2. 每次 `callAnnotationAPI()` 都把 snapshot 放进 `userContext`。
3. 服务端 prompt 构建时注入「长期画像快照」段。

关键文件：

- `src/lib/buildUserProfileSnapshot.ts`
- `src/store/useAnnotationStore.ts`
- `src/server/annotation-handler.ts`
- `src/server/annotation-prompts.user.ts`

---

## 3. 数据结构（给产品/研发统一口径）

## 3.1 核心类型：`UserProfileV2`

定义文件：`src/types/userProfile.ts`

```ts
export interface UserProfileV2 {
  manual: UserProfileManual;
  observed?: UserProfileObserved;
  dynamicSignals?: UserProfileDynamicSignals;
  anniversariesVisible?: VisibleAnniversary[];
  hiddenMoments?: HiddenMoment[];
  onboardingCompleted?: boolean;
  lastExtractedAt?: string;
  createdAt: string;
  updatedAt: string;
}
```

## 3.2 统一信号结构：`ConfidenceSignal<T>`

```ts
export interface ConfidenceSignal<T = string> {
  value: T;
  confidence: number;     // 0..1
  evidenceCount: number;  // >=1
  lastSeenAt: string;     // ISO 时间
}
```

## 3.3 本轮新增字段（已接入）

```ts
export interface UserProfileObserved {
  // ...已有字段
  weeklyStateSummary?: ConfidenceSignal<string>;
  topActivities?: ConfidenceSignal<string[]>; // max 3
  topMoods?: ConfidenceSignal<string[]>;      // max 3
}
```

---

## 4. API 契约

## 4.1 请求

`POST /api/extract-profile`

```json
{
  "recentMessages": [
    {
      "id": "msg-1",
      "content": "今天跑步30分钟",
      "timestamp": 1710000000000,
      "duration": 30,
      "activityType": "exercise",
      "isMood": false
    }
  ],
  "lang": "zh"
}
```

## 4.2 响应

```json
{
  "success": true,
  "profile": {
    "observed": {
      "weeklyStateSummary": {
        "value": "本周节奏逐步稳定，晚间情绪波动仍偏明显",
        "confidence": 0.78,
        "evidenceCount": 9,
        "lastSeenAt": "2026-04-10T10:00:00.000Z"
      },
      "topActivities": {
        "value": ["学习", "散步", "写复盘"],
        "confidence": 0.81,
        "evidenceCount": 12,
        "lastSeenAt": "2026-04-10T10:00:00.000Z"
      },
      "topMoods": {
        "value": ["平静", "焦虑", "满足"],
        "confidence": 0.74,
        "evidenceCount": 8,
        "lastSeenAt": "2026-04-10T10:00:00.000Z"
      }
    },
    "lastExtractedAt": "2026-04-10T10:00:00.000Z"
  }
}
```

---

## 5. Supabase 存储说明（回答：SQL 写了没？）

结论先说：**当前这条画像主链路没有新增业务表 SQL migration**。

- 画像数据是写在 `auth.users.raw_user_meta_data`（`user_metadata`）里。
- 写入方式是 `supabase.auth.updateUser({ data })`，不是 `insert/update public.xxx`。
- 因此这部分不依赖新建 public 表，也就没有新增 migration 文件。

可核查点：

- 写入代码：`src/store/useAuthStore.ts`
- metadata key：`src/store/authProfileHelpers.ts`

### 5.1 如何在 Supabase 查到这份数据

可以在 SQL Editor 做只读检查：

```sql
select
  id,
  raw_user_meta_data ->> 'long_term_profile_enabled' as long_term_profile_enabled,
  raw_user_meta_data -> 'user_profile_v2' as user_profile_v2,
  raw_user_meta_data -> 'user_profile_v2' ->> 'lastExtractedAt' as last_extracted_at
from auth.users
order by created_at desc
limit 20;
```

---

## 6. 功能实现文件地图（谁改哪里）

### 6.1 触发与编排（前端状态层）

- `src/store/useReportStore.ts`
  - 周报生成后触发画像提取。
- `src/store/reportActions.ts`
  - 组装提取消息 + 传 `lang` + 收到 patch 后 merge 写回。

### 6.2 前后端 API 层

- `src/api/client.ts`
  - `callExtractProfileAPI()` 请求定义（`recentMessages + lang`）。
- `api/extract-profile.ts`
  - 鉴权、请求归一化、透传模型服务。

### 6.3 提取服务层（server）

- `src/server/extract-profile-service.ts`
  - 语言分流 prompt
  - 模型调用
  - zod 校验
  - 结果清洗（日期格式、ISO、数量上限）

### 6.4 用户资料写入与读取

- `src/store/useAuthStore.ts`
  - `updateUserProfile()` 合并写 metadata。
- `src/store/authProfileHelpers.ts`
  - profile 解析、merge 规则、key 常量。

### 6.5 批注消费链路

- `src/lib/buildUserProfileSnapshot.ts`
  - 把画像数据转成 prompt 可消费文本（已含 weeklyStateSummary/topActivities/topMoods）。
- `src/store/useAnnotationStore.ts`
  - 每次批注请求透传 snapshot（受开关 gate）。
- `src/server/annotation-handler.ts`
  - 注入 prompt package。
- `src/server/annotation-prompts.user.ts`
  - prompt 中的长期画像段拼装。

---

## 7. 对产品/业务可直接使用的口径

- 这是「越用越懂你」能力，不是问卷标签系统。
- 画像更新节奏：用户每次生成周报时更新一次。
- 多语言支持：提取 prompt 已覆盖中文/英文/意大利语。
- 可解释性：所有信号都有 `confidence + evidenceCount + lastSeenAt`。
- 关键新增价值：可拿到“本周状态一句话 + 高频活动 top3 + 高频心情 top3”，用于批注个性化和运营洞察。

---

## 8. 当前边界与后续建议

当前边界：

- 无独立画像表，画像集中在 auth metadata。
- 触发口径是“周报点击触发”，不是自动定时。
- 提取失败时走保守兜底（只更新 `lastExtractedAt` 或跳过）。

后续建议（可选）：

1. 增加画像提取审计日志表（便于运营回看每周变化）。
2. 把 `weeklyStateSummary` 增加可视化标签（如 improving/stable/overloaded）。
3. 视规模将 `user_profile_v2` 从 metadata 拆到独立表（便于 BI 与分群）。

---

## 9. 相关文档

- `docs/用户画像模块_需求与技术文档_v1.md`
- `api/README.md`
- `src/api/README.md`
- `docs/CURRENT_TASK.md`
- `docs/CHANGELOG.md`
