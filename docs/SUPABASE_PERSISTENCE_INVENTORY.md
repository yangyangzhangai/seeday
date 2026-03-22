# Supabase Persistence Inventory

Updated: 2026-03-22

This file reflects the current codebase behavior, not the live Supabase schema.
Use it as the source of truth for:

- what the frontend is already trying to persist
- what is still local-only
- what likely still needs SQL or mapper work

Important notes:

- `docs/SUPABASE_PERSISTENCE_AUDIT.md` is outdated.
- Membership is currently resolved from `auth.users.app_metadata` / `user_metadata`, not from a `memberships` table.
- "Persisted" below means "the code attempts to read/write it to Supabase". The live DB may still be missing required tables or columns.

## Quick Status

| Area | Store / Source | Remote target | Status | Notes |
| --- | --- | --- | --- | --- |
| Auth preferences | `useAuthStore` | `auth.users.user_metadata` | Partial | Core preferences are synced |
| Login streak | `useAuthStore` | `user_stats` | Synced | Also caches computed streak locally |
| Messages / activities | `useChatStore` | `messages` | Synced | Some UI-only state stays local |
| Message images | `useImageUpload` | Supabase Storage + `messages.image_url*` | Synced | Falls back to data URL locally |
| Mood labels / notes | `useMoodStore` | `moods` | Partial | Core fields synced, some metadata still local-only |
| Todos | `useTodoStore` | `todos` | Partial | Mapper now includes `recurrenceDays`; live DB still needs the current todo columns |
| Bottles | `useGrowthStore` | `bottles` | Partial | Bottle rows sync, popup state stays local |
| Daily goal text | `useGrowthStore` + auth | `auth.users.user_metadata` | Synced | Stored as `daily_goal` + `daily_goal_date` |
| Focus sessions | `useFocusStore` | `focus_sessions` | Partial | Completed sessions sync, active session stays local |
| Plant data | `usePlantStore` | `daily_plant_records`, `plant_direction_config` | Partial | Derived UI state stays local |
| AI annotations | `useAnnotationStore` | `annotations` | Partial | Annotation rows sync, cooldown/day stats stay local |
| Reports | `useReportStore` | `reports` | Partial | Derived history and transient status stay local |
| Stardust | `useStardustStore` | `stardust_memories` | Partial | Convenience mappings stay local |

## Detailed Inventory

### 1. Auth / user metadata

Remote:

- `display_name`
- `avatar_url`
- `ai_mode`
- `ai_mode_enabled`
- `daily_goal_enabled`
- `annotation_drop_rate`
- `daily_goal`
- `daily_goal_date`
- `login_days`

Remote but not in `auth.users.user_metadata`:

- `user_stats.login_streak`
- `user_stats.last_login_date`
- `user_stats.updated_at`

Local-only or derived:

- `membershipPlan`
- `membershipSource`
- `isPlus`
- `activityStreak` state value itself

Notes:

- Membership is inferred from auth metadata aliases such as `membership_plan`, `plan`, `subscription_plan`, `is_plus`, `vip`, etc.
- There is no code path that queries a `memberships` table.
- In frontend code these values are accessed as `user.user_metadata` / `user.app_metadata`, but when you query `auth.users` in SQL the physical columns are typically `raw_user_meta_data` / `raw_app_meta_data`.

### 2. Chat / messages

Persisted to `messages`:

- `id`
- `content`
- `timestamp`
- `type`
- `duration`
- `activity_type`
- `is_mood`
- `image_url`
- `image_url_2`
- `mood_descriptions`
- `is_active`
- `detached`
- `user_id`

Used locally but not persisted as `messages` columns:

- `stardustId`
- `stardustEmoji`
- `dateCache`
- `activeViewDateStr`
- `yesterdaySummary`
- `hasMoreHistory`
- `isLoadingMore`
- `isMoodMode`
- `hasInitialized`
- `lastActivityTime`

Notes:

- `stardustId` / `stardustEmoji` are represented indirectly through `stardust_memories.message_id`, not through the `messages` mapper.
- Image files themselves go to Supabase Storage; the message row keeps the URL.

### 3. Mood store

Persisted to `moods`:

- `message_id`
- `mood_label`
- `custom_label`
- `is_custom`
- `note`
- `source`

Still local-only:

- `customMoodOptions`
- `activityMoodMeta.linkedMoodMessageId`
- `moodNoteMeta.linkedMoodMessageId`

Notes:

- The code can restore `source`, but cannot fully restore linked mood-message relationships across devices because `linkedMoodMessageId` is not stored remotely.

### 4. Todos

Persisted to `todos`:

- `id`
- `content`
- `completed`
- `priority`
- `category`
- `due_date`
- `scope`
- `created_at`
- `recurrence`
- `recurrence_id`
- `completed_at`
- `is_pinned`
- `started_at`
- `duration`
- `bottle_id`
- `sort_order`
- `is_template`
- `template_id`
- `user_id`

Local-only:

- `categories`
- `activeTodoId`
- `lastGeneratedDate`
- `activeMessageMap`
- `todoCompletionMessageMap`

Notes:

- `recurrenceDays` is now mapped in code through `recurrence_days`, but the live DB still needs that column if it is missing.

### 5. Growth / bottles

Persisted to `bottles`:

- `id`
- `user_id`
- `name`
- `type`
- `stars`
- `round`
- `status`
- `created_at`

Also expected by update queries:

- `updated_at`

Stored elsewhere:

- `dailyGoal` -> `auth.users.user_metadata.daily_goal`
- `goalDate` -> `auth.users.user_metadata.daily_goal_date`

Local-only:

- `popupDisabled`

### 6. Focus

Persisted to `focus_sessions`:

- `id`
- `user_id`
- `todo_id`
- `started_at`
- `ended_at`
- `set_duration`
- `actual_duration`

Local-only:

- `currentSession`
- `activeMessageId`

### 7. Plant

Persisted to `daily_plant_records`:

- `id`
- `user_id`
- `date`
- `timezone`
- `root_metrics`
- `root_type`
- `plant_id`
- `plant_stage`
- `is_special`
- `is_support_variant`
- `diary_text`
- `generated_at`
- `cycle_id`

Persisted to `plant_direction_config`:

- `user_id`
- `direction_index`
- `category_key`

Local-only / derived:

- `todaySegments`
- `isGenerating`
- `selectedRootId`

### 8. Annotations

Persisted to `annotations`:

- `id`
- `user_id`
- `content`
- `tone`
- `event_timestamp`
- `related_event`
- `created_at`

Local-only:

- `currentAnnotation`
- `todayStats`
- `config`
- `lastAnnotationTime`

### 9. Reports

Persisted to `reports`:

- `id`
- `user_id`
- `title`
- `date`
- `start_date`
- `end_date`
- `type`
- `content`
- `ai_analysis`
- `stats`

Local-only:

- `computedHistory`
- `analysisStatus`
- `errorMessage`

Notes:

- `analysisStatus` and `errorMessage` are UI / workflow state, not remote report fields.

### 10. Stardust

Persisted to `stardust_memories`:

- `id`
- `message_id`
- `user_id`
- `message`
- `emoji_char`
- `user_raw_content`
- `created_at`
- `alien_name`

Local-only:

- `syncStatus`
- `memoryIdByMessageId`
- `isGenerating`
- `generationError`

## Highest-Priority Gaps

### Gap A: `todos.recurrenceDays`

Current problem:

- The frontend type and weekly recurrence logic use `recurrenceDays`.
- The DB mappers now persist and hydrate it, but some live databases may still be missing `todos.recurrence_days`.

Impact:

- Weekly recurring todos can lose their weekday configuration after cloud round-trips.

Recommended DB addition:

```sql
alter table public.todos
add column if not exists recurrence_days smallint[];
```

Code status:

- `recurrenceDays -> recurrence_days` is wired in `toDbTodo`
- `recurrence_days -> recurrenceDays` is wired in `fromDbTodo`
- `recurrenceDays -> recurrence_days` is wired in `TODO_DB_FIELD_MAP`

### Gap B: linked mood-message metadata

Current problem:

- `useMoodStore` tracks `linkedMoodMessageId` locally inside meta objects.
- Remote `moods` rows only store `source`, not the linked message ID.

Impact:

- Cross-device restore cannot fully reconstruct "this note / auto mood came from that mood message".

Recommended DB addition if you need full restoration:

```sql
alter table public.moods
add column if not exists linked_mood_message_id uuid;
```

Also required in code afterward:

- include `linkedMoodMessageId` in mood upsert payloads
- hydrate it back into `activityMoodMeta` / `moodNoteMeta`

## Live Schema Verification Checklist

If your friend is asking what SQL still needs to be run, check these first in the live project:

- `messages` has: `image_url`, `image_url_2`, `mood_descriptions`, `is_active`, `detached`
- `moods` exists with unique key on `(user_id, message_id)`
- `todos` has `recurrence_days` if weekly recurrence must survive sync
- `bottles` has `updated_at`
- `focus_sessions` exists
- `annotations` exists
- `reports` has `stats`
- `stardust_memories` exists
- `daily_plant_records` exists
- `plant_direction_config` exists
- `user_stats` exists

## Practical Recommendation

If you only want to patch the most important missing pieces right now:

1. Add `todos.recurrence_days`
2. Confirm all currently used `messages` columns exist
3. Confirm `moods` table and its unique index exist
4. Only add `moods.linked_mood_message_id` if cross-device recovery of mood-link metadata matters
