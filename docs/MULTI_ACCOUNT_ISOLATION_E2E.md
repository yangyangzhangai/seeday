# Multi-Account Isolation E2E Checklist (Manual)

Last Updated: 2026-04-23

## Preconditions

- Build uses `VITE_MULTI_ACCOUNT_ISOLATION_V2=true`
- Test account A and account B are both available
- Device/browser starts from a clean login state

## Script

1. Sign in as account A, create identifiable data in chat/todo/mood/report.
2. Force close app (or hard refresh web) and reopen.
3. Verify account A data is restored only for account A.
4. Sign out.
5. Sign in as account B.
6. Verify account A data never flashes in account B UI during boot.
7. Create account B data and verify account A data remains absent.
8. Sign out and sign in back to account A.
9. Verify account A data returns and account B data never appears.
10. In DEV console, confirm `StorageScope` logs show scope switch before rehydrate/fetch.

## Pass Criteria

- No cross-account data flash during initialize/sign-in/sign-out.
- Unknown owner path does not auto-upload local data when isolation v2 is enabled.
- Outbox retry/flush only affects current active user scope.
