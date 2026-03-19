# Auth Module

## Entry

- Page entry: `src/features/auth/AuthPage.tsx`

## Public Interface

- Route: `/auth`
- Main actions:
  - Sign in / sign up
  - Sign out
  - Avatar update

## Upstream Dependencies

- Store: `src/store/useAuthStore.ts`
- App routing: `src/App.tsx`
- i18n: `src/i18n/*`

## Downstream Impact

- Auth state controls route access in `src/App.tsx`
- User identity is consumed by chat/todo/report stores for cloud sync

## Related Docs

- `LLM.md`
- `docs/PROJECT_MAP.md`
- `PROJECT_CONTEXT.md`
- `FEATURE_STATUS.md`
- `docs/CURRENT_TASK.md`
