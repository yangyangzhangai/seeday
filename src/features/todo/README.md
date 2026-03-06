# Todo Module

## Entry

- Page entry: `src/features/todo/TodoPage.tsx`

## Public Interface

- Route: `/todo`
- Main user flows:
  - Todo CRUD
  - Priority/category/scope editing
  - Start timer -> jump to chat record mode

## Upstream Dependencies

- Store: `src/store/useTodoStore.ts`
- Shared helpers:
  - `src/features/todo/todoPageHelpers.ts`
  - `src/lib/todoHelpers.ts`
- App routing: `src/App.tsx`

## Downstream Impact

- Todo completion and duration are consumed by report generation in `src/store/useReportStore.ts`
- Category and field mapping changes affect DB write/read mapper behavior

## Related Docs

- `LLM.md`
- `docs/PROJECT_MAP.md`
- `PROJECT_CONTEXT.md`
- `FEATURE_STATUS.md`
- `docs/CODE_CLEANUP_HANDOVER_PLAN.md`
