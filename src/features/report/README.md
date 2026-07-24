# Report Module

## Entry

- Page entry: `src/features/report/ReportPage.tsx`

## Public Interface

- Route: `/report`
- Main user flows:
  - Embedded daytime plant root interaction section (always visible below report-range buttons)
- Plant generation time-window gate (available after 20:00 local time) with the same irreversible confirmation for the page button and evening-reminder deep link
- Next-day first-open plant auto-backfill attempt for missing previous-day records (store-triggered)
- Successful generation transitions directly to `PlantFlipCard`; the unused `PlantRevealAnimation` helper is not part of the current runtime path
- New plant records persist a root/activity/direction snapshot in `root_metrics`; card backs consume that snapshot so later activity or direction edits cannot change a generated plant
- Legacy plant records without a snapshot lazily freeze their current cloud reconstruction through `/api/plant-generate` `action=snapshot_existing` when first opened
- Plant observation copy is server-limited to the card budget; historical oversized text is compacted at a natural sentence boundary for display/export without rewriting the stored source text
- Before today's diary exists, the report route shows the root/plant surface; starting diary generation switches directly to detail page 2 and keeps the two-page detail as the report route's primary surface
- Once today's full diary or free teaser exists, revisiting `/report` selects that report during the first render, so the plant card cannot flash before the detail page appears
- The persistent today detail is rendered inside the report page frame so the bottom navigation remains available; its header retains the original `44px` Calendar button and `44px`-high text Diary Book button instead of exposing a close path back to the plant surface
- Generated plant cards center the localized registry name and date together in a compact bottom metadata row with the same subdued treatment; Diary detail plant photos keep the name beneath the image.
- Detail pages remain under direct user-controlled horizontal swipe; generation completion no longer starts an automatic page change
- Bottom-nav report entry always targets `/report`; the report page synchronously resolves whether its primary surface is today's detail or the pre-diary plant/root view
- Tapping the plant image in detail opens only the frozen, flippable plant card centered above the detail, without the full-sheet shell or save action; a 650ms stationary long press reuses the existing current-side save/share flow, while normal taps still flip and tapping the surrounding backdrop closes it back to the same diary page
- Plant history caching is owned by `usePlantStore` as an account-scoped date map. Detail and Diary Book read the same cache, while month loading fills it before the viewer opens and cloud reconciliation never clears an already-rendered plant.
- Generating a daily diary persists `stats.diaryPageSnapshot`, containing the exact activity/mood chart inputs, todo/habit counts, and all four first-page analysis strings. Detail and Diary Book render that same snapshot instead of recomputing from current messages. Snapshot v2 keeps English/Italian todo and habit insights on complete word boundaries and gives summary copy two lines apart from its count; stored v1 snapshots upgrade once from their frozen counts, then remain immutable.
- Generated observation copy is immutable: Diary Book and detail resolve the same preferred daily report and use `reportObservation.ts` for full/teaser/loading/fallback selection. Same-day placeholders cannot replace a generated record, and both surfaces reuse the existing localized Diary Book fallback rather than maintaining unrelated defaults.
- Full observation generation uses a soft 2-4 paragraph target without post-generation character/word slicing; incomplete provider output retries once and is rejected if it remains unfinished. Existing generated observation text stays immutable.
- Diary detail first-page activity, mood, todo, and habit analysis wraps in full instead of using a two-line clamp. The page scrolls vertically when its four stable-height sections do not fit, while todo completion and habit stars remain separate secondary statistic lines.
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
- Root-page soil image starts at `106px` below the eco-sphere area, making the visible soil taller while preserving the root origin anchoring logic.
- The two floating activity and mood donut charts above the soil render at `140px`. Their empty transparent bubbles and motion/collision bounds use the same shared `140px` size, preserving consistent occupied space when data appears or disappears.
- Diary detail page activity and mood donut charts render at 0.9x of the shared default chart size; the root-page eco-sphere charts are unchanged.
- The root-page canvas height follows the Report content area's available height with `320px`/`540px` bounds, reserving `120px` of first-view space for the Generate Plant action and My Diary entry while giving the soil/root area slightly more height.

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
  - `src/store/reportDiarySnapshot.ts`
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
- `diaryPageSnapshot` — immutable first-page data and analysis copy captured when diary generation succeeds

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
