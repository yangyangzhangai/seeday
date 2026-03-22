# Auth Module

## Entry

- Page entry: `src/features/auth/AuthPage.tsx`

## Public Interface

- Route: `/auth`
- Main actions:
  - Sign in / sign up
  - Avatar selection/update during auth flow
  - Session restore via `useAuthStore.initialize()`
  - Sign out / preference updates are exposed by `useAuthStore` and consumed by other pages such as `/profile`

## Upstream Dependencies

- Store: `src/store/useAuthStore.ts`
- App routing: `src/App.tsx`
- i18n: `src/i18n/*`

## Downstream Impact

- Auth state controls route access in `src/App.tsx`
- User identity is consumed by chat/growth/report/plant stores for cloud sync and hydration

## Related Docs

- `LLM.md`
- `docs/PROJECT_MAP.md`
- `PROJECT_CONTEXT.md`
- `FEATURE_STATUS.md`
- `docs/CURRENT_TASK.md`
