# Report Module

## Entry

- Page entry: `src/features/report/ReportPage.tsx`

## Public Interface

- Route: `/report`
- Main user flows:
  - Embedded daytime plant root interaction section (always visible below report-range buttons)
  - Plant generation time-window gate (available after 20:00 local time) with irreversible confirmation
  - Next-day first-open plant auto-backfill attempt for missing previous-day records (store-triggered)
  - Plant reveal chain after successful generation (`PlantRevealAnimation` + `PlantImage`)
  - Plant artwork fallback order: `plantId` exact -> same `rootType+stage` default -> `rootType_mid_001` -> `sha_mid_001`
  - Special-scenario reveal copy for air-day (AND rule) and entertainment-dominant days
  - No-record fallback hint for empty-day generate attempts
  - Daily/weekly/monthly report generation
  - Report detail modal and task list modal
  - Timeshine diary generation and display

## Upstream Dependencies

- Stores:
  - `src/store/useReportStore.ts`
  - `src/store/useTodoStore.ts`
  - `src/store/useGrowthStore.ts` ← bottles data for daily todo breakdown
  - `src/store/useChatStore.ts`
  - `src/store/useMoodStore.ts`
  - `src/store/usePlantStore.ts`
- Helpers/actions:
  - `src/store/reportHelpers.ts`
  - `src/store/reportActions.ts`
  - `src/features/report/reportPageHelpers.ts`
- Plant UI:
  - `src/features/report/plant/*`
- API client: `src/api/client.ts`

## ReportStats Daily Fields

Daily reports (`type === 'daily'`) compute a structured todo breakdown via `computeDailyTodoStats` in `reportHelpers.ts`. Todos are split by whether they are linked to a bottle:

- `habitCheckin` — todos linked to a `habit` bottle; one row per todo with done/not-done state
- `goalProgress` — todos linked to a `goal` bottle; grouped by bottle, shows `currentStars/21` progress bar
- `independentRecurring` — recurring todos with no bottle link; shown as a single completed/total count
- `oneTimeTasks` — one-time todos with no bottle link; broken down by priority (`high/medium/low`) with completed-title chips

Template todos (`isTemplate: true`) are excluded from all counts.

Weekly/monthly reports continue to use `recurringStats` (habit rate over the period) and `dailyCompletion` (day-by-day trend bar chart).

The same breakdown is serialised into plain text and passed to the Timeshine diary AI via `buildRawInput` in `reportActions.ts`.

## Downstream Impact

- Report schema changes affect persisted report rows and report detail UI
- Summary/mood/action computation changes impact diary generation and user insights
- Date-range semantics affect cross-day auto-generation behavior from `src/App.tsx`
- Plant section changes affect `daily_plant_records` rendering、plant-history 读取与 `/profile` 方向设置预期

## Related Docs

- `LLM.md`
- `docs/PROJECT_MAP.md`
- `docs/ARCHITECTURE.md`
- `FEATURE_STATUS.md`
- `docs/CURRENT_TASK.md`
