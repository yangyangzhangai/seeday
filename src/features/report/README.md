# Report Module

## Entry

- Page entry: `src/features/report/ReportPage.tsx`

## Public Interface

- Route: `/report`
- Main user flows:
  - Embedded daytime plant root interaction section (always visible below report-range buttons)
  - Daily/weekly/monthly report generation
  - Report detail modal and task list modal
  - Timeshine diary generation and display

## Upstream Dependencies

- Stores:
  - `src/store/useReportStore.ts`
  - `src/store/useTodoStore.ts`
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
