# Auth Module

## Entry

- Page entry: `src/features/auth/AuthPage.tsx`

## Public Interface

- Route: `/auth`
- Main actions:
  - Sign in / sign up
  - OAuth sign-in (Google / Apple) with platform-aware redirect (`web origin` vs `iOS deep link`)
  - Auth-only entry for signed-out users (sign-out does not jump to onboarding)
  - Session restore via `useAuthStore.initialize()`
  - Sign out / preference updates are exposed by `useAuthStore` and consumed by other pages such as `/profile`

## Onboarding Gate

- Onboarding route: `/onboarding`
- Trigger rule (in `src/App.tsx`): user is signed in, account age < 72h, and profile metadata is still missing
- Signed-out users always enter `/auth`; onboarding is reserved for newly registered users that still need first-time setup

## Upstream Dependencies

- Store: `src/store/useAuthStore.ts`
- Mobile OAuth bridge: `src/lib/mobileAuthBridge.ts` (Capacitor `appUrlOpen` callback handling)
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
