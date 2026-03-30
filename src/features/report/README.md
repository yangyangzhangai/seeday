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
  - Plant artwork fallback order: `plantId` exact -> same `rootType+stage` default -> `rootType_early_0001` -> `sha_early_0001`
  - Special-scenario reveal copy for air-day (AND rule) and entertainment-dominant days
  - No-record fallback hint for empty-day generate attempts
  - Daily/weekly/monthly report generation
  - Report detail modal (`ReportDetailModal`) and task list modal (`TaskListModal`)
  - Report stats view (`ReportStatsView`): todo breakdown, habit/goal/recurring/one-time stats display
  - Activity records view (`ActivityRecordsView`): activity timeline with durations
  - Mood pie chart (`MoodPieChart`): mood distribution visualization
  - AI diary generation and display (`DiaryBookShelf` + `DiaryBookViewer`)
  - Diary detail modal and viewer path continue to be report-domain scoped (`ReportDetailModal` + `DiaryBookViewer`)

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

The same breakdown is serialised into plain text and passed to the diary AI via internal helper `buildRawInput()` in `reportActions.ts` (not exported).

## Visualization Components

New components added in Phase 4:

| Component | Data Source | Render When |
|-----------|-------------|-------------|
| `ActivityCategoryDonut` | `stats.actionAnalysis` | Past daily report with activity records |
| `SpectrumBarChart` | `stats.spectrum` | After AI diary generation |
| `LightQualityDashboard` | `stats.lightQuality` | After AI diary generation |

`stats.spectrum` and `stats.lightQuality` are populated in `useReportStore.generateAIDiary` from `ComputedResult` after the classifier + diary API calls succeed. They are persisted to Supabase via `stats` JSON column.

## i18n Coverage

All user-visible strings in the report feature use `t()` i18n keys (ZH/EN/IT). Keys are prefixed `report_`. Hardcoded Chinese strings have been removed from:
- `ReportPage.tsx` — page title, action buttons, early-tip dialog
- `ReportDetailModal.tsx` — back labels, date formats, swipe hint, diary section
- `ReportStatsView.tsx` — section titles, status badges, priority labels

Summary helpers `generateActionSummary` and `generateMoodSummary` in `reportHelpers.ts` accept a `lang` parameter and produce localized text for ZH/EN/IT.

## Downstream Impact

- Report schema changes affect persisted report rows and report detail UI
- Summary/mood/action computation changes impact diary generation and user insights
- Date-range semantics affect cross-day auto-generation behavior from `src/App.tsx`
- Plant section changes affect `daily_plant_records` rendering, plant-history reads, and `/profile` orientation settings

## Related Docs

- `LLM.md`
- `docs/PROJECT_MAP.md`
- `docs/ARCHITECTURE.md`
- `FEATURE_STATUS.md`
- `docs/CURRENT_TASK.md`
