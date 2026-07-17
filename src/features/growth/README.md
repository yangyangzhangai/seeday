# Growth Module

## Entry

- Page entry: `src/features/growth/GrowthPage.tsx`

## Public Interface

- Route: `/growth`
- Main user flows:
  - Bottle management: create habit/goal bottles, track star accumulation, mark achieved
  - Todo management: add/toggle/delete/start todos with priority, recurrence, bottle linking
  - Focus sessions: full-screen Pomodoro timer (countdown 1-60 min or count-up) triggered from todo cards
  - Daily goal popup: conditional daily prompt (once per day, first Growth page visit)
  - Cross-feature integration: todo completion and focus sessions create activity cards in `/chat` timeline

## Component Hierarchy

```
GrowthPage
├── BottleList
│   ├── BottleCard (x N, horizontal scroll)
│   └── AddBottleModal
│   └── BottleDetailSheet
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
- **Bottle artwork**: habit bottles use `glass-bottle.png`; goal bottles use the distinct `bottle_goal.png` shell while sharing the existing star artwork and layout.
- **Bottle carousel**: the native horizontal scrollbar is hidden; a short translucent rounded indicator follows scroll progress and fades out after interaction.
- **Star system**: incremented on todo completion + focus session completion; displayed as scattered visuals in bottle
- **Bottle detail sheet**: tap bottle to open unified actions (create linked todo / irrigate / continue / delete)
- **Check-in stats**: bottle stores `checkinDates` (`YYYY-MM-DD`) and exposes `last7Days/currentStreak/bestStreak`
- **Todo recurrence**: once / daily / weekly (with day-of-week selection); templates generate instances
- **Todo card density**: collapsed cards keep an approximately 40px row while retaining the standard title, priority, and action-icon sizing; the ambient shadow stays tight to all sides, and expanded cards switch immediately to a fixed 22px radius so their visible corner curvature matches the compact card without a radius animation.
- **Todo card spacing**: adjacent todo cards use a fixed `10px` vertical gap.
- **Completion feedback**: completing a todo updates its checked state immediately but holds the current card order for `700ms` before completed-item sorting moves it, so the completion action remains visible.
- **Focus timer**: circular SVG drag picker for duration; auto-completes countdown; awards star + creates activity card
- **Daily goal**: synced to Supabase user_metadata (`daily_goal`, `daily_goal_date`); popup evaluation is tracked in the persisted Growth store per user/day to avoid iOS foreground/session-storage re-prompts

## Downstream Impact

- Bottle and todo data consumed by `/report` for daily todo breakdown (habitCheckin, goalProgress, independentRecurring, oneTimeTasks)
- Focus sessions and todo completions create activity cards visible in `/chat` timeline
- Daily goal preference toggled from `/profile` (DailyGoalToggle)
- Growth store bottles data used in `/report` ReportStatsView

## Related Docs

- `LLM.md`
- `docs/PROJECT_MAP.md`
- `docs/CURRENT_TASK.md`

## Shared Button Surface

- Growth controls with a visible rounded or circular shell opt into `.app-glass-button` or the shared inline base.
- Unframed text, image, and bare icon triggers are excluded; existing colors, radii, dimensions, priority states, and destructive variants remain authoritative.
- `growthTodoPriorityStyles.ts` is the shared selected-state palette for todo priority controls in both `AddGrowthTodoModal` and expanded `GrowthTodoCard` views.
