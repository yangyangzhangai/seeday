# Growth Module

## Entry

- Page entry: `src/features/growth/GrowthPage.tsx`

## Public Interface

- Route: `/growth`
- Main user flows:
  - Bottle management: create habit/goal bottles, track star accumulation, mark achieved
  - Todo management: add/toggle/delete/start todos with priority, recurrence, bottle linking
  - Life goal management: edit long-term life goal in Growth and sync with `user_profile_v2.manual.lifeGoal`
  - Focus sessions: full-screen Pomodoro timer (countdown 1-60 min or count-up) triggered from todo cards
  - Daily goal popup: conditional daily prompt (once per day, first Growth page visit)
  - Cross-feature integration: todo completion and focus sessions create activity cards in `/chat` timeline

## Component Hierarchy

```
GrowthPage
├── LifeGoalPanel (two-way sync with profile life goal)
├── BottleList
│   ├── BottleCard (x N, horizontal scroll)
│   └── AddBottleModal
├── GrowthTodoSection
│   ├── GrowthTodoCard (x N, sorted/filtered list)
│   └── AddGrowthTodoModal
├── DailyGoalPopup (conditional overlay)
└── FocusMode (conditional full-screen overlay)
    └── FocusTimer
```

## Upstream Dependencies

- Stores:
  - `src/store/useGrowthStore.ts` (bottles, daily goal, star system)
  - `src/store/useTodoStore.ts` (todos, recurring generation, template management)
  - `src/store/useFocusStore.ts` (focus session state)
  - `src/store/useChatStore.ts` (sendMessage, endActivity for timeline integration)
  - `src/store/useAuthStore.ts` (user preferences, daily goal metadata)
- Helpers:
  - `src/lib/activityType.ts` (`normalizeTodoCategory`)
  - `src/lib/utils.ts` (`cn`)
- API: `src/api/supabase.ts` (auth.getUser, auth.updateUser for daily goal date sync)

## Key Business Logic

- **Bottle types**: habit (ongoing) / goal (completable with round tracking)
- **Star system**: incremented on todo completion + focus session completion; displayed as scattered visuals in bottle
- **Todo recurrence**: once / daily / weekly (with day-of-week selection); templates generate instances
- **Focus timer**: circular SVG drag picker for duration; auto-completes countdown; awards star + creates activity card
- **Daily goal**: synced to Supabase user_metadata (daily_goal, daily_goal_date); controlled via sessionStorage + localStorage

## Downstream Impact

- Bottle and todo data consumed by `/report` for daily todo breakdown (habitCheckin, goalProgress, independentRecurring, oneTimeTasks)
- Focus sessions and todo completions create activity cards visible in `/chat` timeline
- Daily goal preference toggled from `/profile` (DailyGoalToggle)
- Growth store bottles data used in `/report` ReportStatsView

## Related Docs

- `LLM.md`
- `docs/PROJECT_MAP.md`
- `docs/CURRENT_TASK.md`
