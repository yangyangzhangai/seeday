# Seeday Supabase 数据持久化审计报告

> 日期: 2026-03-19
> 范围: 全部 Zustand Store → Supabase 同步状态

---

## 一、总览

| 数据类别 | 对应 Store | Supabase 表 | 状态 |
|---------|-----------|-------------|------|
| 用户认证 & 偏好 | useAuthStore | `auth.users` (user_metadata) | ✅ 已同步 |
| 事件/情绪卡片 | useChatStore | `messages` | ✅ 已同步 |
| 情绪标签选择 | useMoodStore | ❌ 无表 | ⚠️ **仅 localStorage** |
| 待办 & 周期待办 | useTodoStore | `todos` | ✅ 已同步 |
| 习惯/目标瓶 & 星星 | useGrowthStore | ❌ 无表 | ⚠️ **仅 localStorage** |
| 专注计时 | useFocusStore | ❌ 无表 | ⚠️ **仅 localStorage** |
| 根系生长 | usePlantStore | `daily_plant_records` / `plant_direction_config` | ✅ 已同步 |
| AI 批注 | useAnnotationStore | `annotations` | ✅ 已同步 |
| 日/周报告 | useReportStore | `reports` | ✅ 已同步 |
| 星尘记忆 | useStardustStore | `stardust_memories` | ✅ 已同步 |
| 会员信息 | useAuthStore | `memberships` (只读查询) | ✅ 已同步 |

---

## 二、已正常同步的数据 ✅

### 2.1 用户信息（useAuthStore → `auth.users`）

| 字段 | 存储位置 | 说明 |
|------|---------|------|
| email / uid | `auth.users` | Supabase Auth 自动管理 |
| display_name | `user_metadata.display_name` | ✅ 通过 `updateUser()` 同步 |
| avatar_url | `user_metadata.avatar_url` | ✅ 通过 `updateUser()` 同步 |
| aiMode | `user_metadata.aiMode` | ✅ AI 模型选择 |
| aiModeEnabled | `user_metadata.aiModeEnabled` | ✅ AI 模型是否开启 |
| dailyGoalEnabled | `user_metadata.dailyGoalEnabled` | ✅ 每日目标开关 |
| annotationDropRate | `user_metadata.annotationDropRate` | ✅ AI 批注掉落概率 |

> **⚠️ 缺失：连续登录天数（streak）** — 目前没有字段记录。需要新增。

### 2.2 事件卡片 & 情绪卡片（useChatStore → `messages`）

| 字段 | DB 列名 | 状态 |
|------|---------|------|
| id | id | ✅ |
| content（事件/情绪标题） | content | ✅ |
| timestamp | timestamp | ✅ |
| type（user/assistant） | type | ✅ |
| duration（用时记录） | duration | ✅ |
| activityType | activity_type | ✅ |
| isActive（进行中） | is_active | ✅ |
| isMood | is_mood | ✅ |
| detached | detached | ✅ |
| imageUrl | image_url | ✅ |
| imageUrl2 | image_url_2 | ✅（刚修复，需建列） |
| moodDescriptions | mood_descriptions | ✅ |
| stardustId | stardust_id | ✅ |
| stardustEmoji | stardust_emoji | ✅ |

### 2.3 待办 & 周期待办（useTodoStore → `todos`）

| 字段 | DB 列名 | 状态 |
|------|---------|------|
| id | id | ✅ |
| title | content | ✅ |
| completed | completed | ✅ |
| priority | priority | ✅ |
| category | category | ✅ |
| dueAt | due_date | ✅ |
| scope | scope | ✅ |
| recurrence | recurrence | ✅ |
| recurrenceId | recurrence_id | ✅ |
| isTemplate | is_template | ✅ |
| templateId | template_id | ✅ |
| startedAt | started_at | ✅ |
| completedAt | completed_at | ✅ |
| duration | duration | ✅ |
| bottleId | bottle_id | ✅ |
| sortOrder | sort_order | ✅ |
| isPinned | is_pinned | ✅ |

### 2.4 根系生长（usePlantStore → `daily_plant_records` / `plant_direction_config`）

- ✅ 每日植物记录完整同步
- ✅ 方向偏好配置完整同步
- SQL 已就绪：`scripts/plant_p0_schema_up.sql`

### 2.5 其他已同步

- **AI 批注** → `annotations` ✅
- **日/周报告** → `reports` ✅
- **星尘记忆** → `stardust_memories` ✅
- **会员状态** → `memberships`（只读） ✅

---

## 三、⚠️ 未同步到 Supabase 的数据（高优先级）

### 3.1 情绪标签选择（useMoodStore）— 需新建 `moods` 表

**现状：** 所有数据仅存在 localStorage `'activity-mood-storage'` 中，清除浏览器缓存即丢失。

| 字段 | 说明 | 风险 |
|------|------|------|
| activityMood | 每个事件对应的情绪标签（如"开心"） | 🔴 清缓存丢失 |
| customMoodLabel | 用户自定义的情绪标签 | 🔴 清缓存丢失 |
| customMoodApplied | 是否使用了自定义标签 | 🔴 清缓存丢失 |
| customMoodOptions | 用户创建的自定义情绪选项列表 | 🔴 清缓存丢失 |
| moodNote | 情绪备注内容 | 🔴 清缓存丢失 |
| activityMoodMeta | 情绪来源元数据 (auto/manual) | 🟡 辅助数据 |
| moodNoteMeta | 备注来源元数据 | 🟡 辅助数据 |

**建议 SQL：**

```sql
CREATE TABLE IF NOT EXISTS public.moods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id uuid NOT NULL,           -- 关联的 message.id
  mood_label text,                     -- 情绪标签 (如 "happy", "sad")
  custom_label text,                   -- 用户自定义标签
  is_custom boolean DEFAULT false,     -- 是否使用了自定义
  note text,                           -- 情绪备注
  source text DEFAULT 'auto',          -- 'auto' | 'manual'
  created_at timestamptz DEFAULT now(),
  CONSTRAINT moods_user_message_unique UNIQUE (user_id, message_id)
);

ALTER TABLE public.moods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "moods_select_own" ON public.moods FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "moods_insert_own" ON public.moods FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "moods_update_own" ON public.moods FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "moods_delete_own" ON public.moods FOR DELETE USING (auth.uid() = user_id);
```

### 3.2 习惯/目标瓶 & 星星（useGrowthStore）— 需新建 `bottles` 表

**现状：** 所有数据仅存在 localStorage `'growth-store'` 中。

| 字段 | 说明 | 风险 |
|------|------|------|
| bottles[] | 习惯/目标瓶数组 | 🔴 清缓存丢失 |
| ↳ name | 瓶名称 | 🔴 |
| ↳ type | habit / goal | 🔴 |
| ↳ stars | 星星数量 (0-21) | 🔴 |
| ↳ round | 第几轮 | 🔴 |
| ↳ status | active / achieved / irrigated | 🔴 |
| dailyGoal | 今日目标文本 | 🔴 清缓存丢失 |
| goalDate | 目标日期 | 🟡 辅助数据 |

**建议 SQL：**

```sql
CREATE TABLE IF NOT EXISTS public.bottles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('habit', 'goal')),
  stars smallint NOT NULL DEFAULT 0,
  round smallint NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'irrigated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bottles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bottles_select_own" ON public.bottles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "bottles_insert_own" ON public.bottles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bottles_update_own" ON public.bottles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bottles_delete_own" ON public.bottles FOR DELETE USING (auth.uid() = user_id);
```

### 3.3 专注计时（useFocusStore）— 需新建 `focus_sessions` 表

**现状：** 所有数据仅存在 localStorage `'focus-store'` 中。

| 字段 | 说明 | 风险 |
|------|------|------|
| sessions[] | 专注计时历史 | 🔴 清缓存丢失 |
| ↳ todoId | 关联的待办 ID | 🔴 |
| ↳ startedAt | 开始时间 | 🔴 |
| ↳ endedAt | 结束时间 | 🔴 |
| ↳ setDuration | 设定时长 | 🔴 |
| ↳ actualDuration | 实际时长 | 🔴 |

**建议 SQL：**

```sql
CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  todo_id uuid,                         -- 关联的 todo.id（可为空）
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  set_duration integer,                 -- 设定时长（秒）
  actual_duration integer,              -- 实际时长（秒）
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "focus_sessions_select_own" ON public.focus_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "focus_sessions_insert_own" ON public.focus_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "focus_sessions_update_own" ON public.focus_sessions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "focus_sessions_delete_own" ON public.focus_sessions FOR DELETE USING (auth.uid() = user_id);
```

---

## 四、⚠️ `messages` 表缺失列（需 ALTER）

以下列在代码中已使用，但 Supabase 表可能尚未添加：

```sql
-- 第二张图片
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS image_url_2 TEXT;

-- 事件进行状态
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;

-- 情绪脱离标记
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS detached BOOLEAN DEFAULT false;

-- 情绪描述 JSONB
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS mood_descriptions JSONB;

-- 第一张图片（如果还没有）
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 星尘关联
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS stardust_id TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS stardust_emoji TEXT;
```

---

## 五、用户信息补充 — 连续登录天数

目前没有 `streak`（连续登录天数）字段。建议：

```sql
-- 方案 A：在 user_metadata 中追加（简单）
-- 代码中调用 supabase.auth.updateUser({ data: { login_streak: N, last_login_date: '2026-03-19' }})

-- 方案 B：新建独立表（更规范）
CREATE TABLE IF NOT EXISTS public.user_stats (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  login_streak integer NOT NULL DEFAULT 0,
  last_login_date date,
  total_events integer DEFAULT 0,
  total_moods integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_stats_select_own" ON public.user_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_stats_upsert_own" ON public.user_stats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_stats_update_own" ON public.user_stats FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

---

## 六、中低优先级

| 数据 | Store | 现状 | 建议 |
|------|-------|------|------|
| 批注事件日志 (todayStats.events) | useAnnotationStore | localStorage | 可暂不处理，重启后重新计数 |
| 报告计算缓存 (computedHistory) | useReportStore | localStorage | 可暂不处理，可重新计算 |
| 待办分类列表 (categories) | useTodoStore | 硬编码 | 如需用户自定义分类再建表 |
| 每日目标文本 (dailyGoal) | useGrowthStore | localStorage | 可存入 `bottles` 表或 `user_stats` |

---

## 七、完整 SQL 汇总（一次性执行）

将以下 SQL 交给你的伙伴在 Supabase SQL Editor 中执行：

```sql
BEGIN;

------------------------------------------------------------
-- 1. messages 表补列
------------------------------------------------------------
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS image_url_2 TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS detached BOOLEAN DEFAULT false;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS mood_descriptions JSONB;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS stardust_id TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS stardust_emoji TEXT;

------------------------------------------------------------
-- 2. moods 表（情绪标签）
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.moods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id uuid NOT NULL,
  mood_label text,
  custom_label text,
  is_custom boolean DEFAULT false,
  note text,
  source text DEFAULT 'auto',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT moods_user_message_unique UNIQUE (user_id, message_id)
);

ALTER TABLE public.moods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "moods_select_own" ON public.moods FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "moods_insert_own" ON public.moods FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "moods_update_own" ON public.moods FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "moods_delete_own" ON public.moods FOR DELETE USING (auth.uid() = user_id);

------------------------------------------------------------
-- 3. bottles 表（习惯/目标瓶）
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bottles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('habit', 'goal')),
  stars smallint NOT NULL DEFAULT 0,
  round smallint NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'irrigated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bottles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bottles_select_own" ON public.bottles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "bottles_insert_own" ON public.bottles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bottles_update_own" ON public.bottles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bottles_delete_own" ON public.bottles FOR DELETE USING (auth.uid() = user_id);

------------------------------------------------------------
-- 4. focus_sessions 表（专注计时）
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  todo_id uuid,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  set_duration integer,
  actual_duration integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "focus_sessions_select_own" ON public.focus_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "focus_sessions_insert_own" ON public.focus_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "focus_sessions_update_own" ON public.focus_sessions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "focus_sessions_delete_own" ON public.focus_sessions FOR DELETE USING (auth.uid() = user_id);

------------------------------------------------------------
-- 5. user_stats 表（连续登录等统计）
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_stats (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  login_streak integer NOT NULL DEFAULT 0,
  last_login_date date,
  total_events integer DEFAULT 0,
  total_moods integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_stats_select_own" ON public.user_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_stats_upsert_own" ON public.user_stats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_stats_update_own" ON public.user_stats FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

COMMIT;
```

---

## 八、执行顺序建议

1. **立即执行** → 第七节的完整 SQL（一次性在 Supabase SQL Editor 跑）
2. **代码侧对接**（后续开发）：
   - `useMoodStore` → 增加 Supabase CRUD 同步
   - `useGrowthStore` → 增加 Supabase CRUD 同步
   - `useFocusStore` → 增加 Supabase CRUD 同步
   - 登录时写入 `user_stats` 更新 streak
3. **植物表** → 已有 `plant_p0_schema_up.sql`，如未执行也一并跑
