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
- After the plant card appears, its diary CTA opens today's report detail directly on the diary page and reuses the same generate/view path as the report page
- Generated plant cards and Diary detail plant photos show the current plant's localized registry name beneath the artwork.
- After AI diary text finishes generating from that CTA, the detail view waits 2 seconds on the diary page and then auto-slides back to page 1 (activity/mood/todo/habit overview)
- Bottom-nav report entry now deep-links to today's diary detail page 1 once today's AI diary already exists; otherwise it still lands on the plant/root surface
- Diary detail pages show a two-dot page indicator below the date divider and keep horizontal swipe navigation between the two pages. The former middle-edge `‹ / ›` controls are removed; the first page still gives one short leftward motion hint on entry, while top navigation remains reserved for back/close and adjacent-date navigation.
- Report calendar today/future cells remain disabled but retain the calendar's transparent date-button surface instead of the library's default gray disabled background.
- Plant artwork fallback order: `plantId` exact -> same `rootType+stage` default -> `rootType_early_0001` -> `sha_early_0001`
  - Special-scenario reveal copy for air-day (AND rule) and entertainment-dominant days
  - No-record fallback hint for empty-day generate attempts
  - Daily/weekly/monthly report generation
  - Report detail modal (`ReportDetailModal`) and task list modal (`TaskListModal`)
  - Report stats view (`ReportStatsView`): todo breakdown, habit/goal/recurring/one-time stats display
  - Activity records view (`ActivityRecordsView`): activity timeline with durations
  - Mood pie chart (`MoodPieChart`): mood distribution visualization
  - AI diary generation and display (`DiaryBookShelf` + `DiaryBookViewer`)
  - Free-tier diary teaser blur-lock + upgrade CTA (`/upgrade`) in observation area
  - Diary detail modal and viewer path continue to be report-domain scoped (`ReportDetailModal` + `DiaryBookViewer`)
  - Root-section "My Diary" textarea edits directly on focus and persists on blur/autosave (iOS WebView keyboard-safe path)
- Root canvas keeps its original `360 x 520` proportions across screen widths, anchors the root origin to the soil surface, and uses the same 16px horizontal gutter as the page title.
- The two floating activity and mood donut charts above the soil render at `150px`, preserving their existing colors, ring proportions, labels, and motion behavior.
- The root-page canvas height follows the Report content area's available height with `300px`/`520px` bounds, reserving `136px` of first-view space for the Generate Plant action, My Diary heading, and the complete first placeholder line across iPhone safe-area variants.

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

Current daily-report visual blocks focus on activity and mood summaries from `stats.actionAnalysis` and `stats.moodDistribution`.

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

## Local-First Notes (2026-04-21)

- `reportPageHelpers.getMessagesForReport(...)` now consumes `dateCache: Record<string, Message[]>` from chat store.
- `DiaryBookViewer` reads date cache via object access (`dateCache[dateStr]`) and falls back to global `messages` when absent.

## Related Docs

- `LLM.md`
- `docs/PROJECT_MAP.md`
- `docs/ARCHITECTURE.md`
- `FEATURE_STATUS.md`
- `docs/CURRENT_TASK.md`

## Shared Button Surface

- Report, plant, diary viewer, calendar, and modal controls with a visible shell opt into `.app-glass-button` or the shared inline base.
- Unframed calendar headings, image/text triggers, and bare icons are excluded; report colors, radii, dimensions, and semantic states remain authoritative.
