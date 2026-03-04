# 2026-03-04 Root Residual Files Disposition

## Scope

- `TO-DO.json`
- `YOUWARE.md`
- `SECURITY_FIX.md`
- `scripts/test-minmax.ts` (already removed before this batch)

## Decision

1. Remove `TO-DO.json` and `YOUWARE.md`.
   - Reason: content is stale and superseded by current docs (`README.md`, `PROJECT_CONTEXT.md`, `FEATURE_STATUS.md`).
2. Remove `SECURITY_FIX.md` from root.
   - Reason: historical incident note included concrete key strings and no longer serves as active runbook.
   - Security posture is now documented by current architecture and environment variable docs.
3. Keep `scripts/` empty directory out of active scope.
   - `scripts/test-minmax.ts` was already deleted in earlier cleanup step.

## Rollback Point

- Recover deleted files from git history if historical context is needed.
