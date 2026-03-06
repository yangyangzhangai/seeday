# CURRENT TASK (Session Resume Anchor)

- Last Updated: 2026-03-06
- Owner: current working session
- Purpose: this file is the quick resume anchor for any new session.

## Current Focus

- 已完成 Git Hook 自动拦截体系安装。当前无活跃主线任务。

## Active Checklist

- [x] Add a lightweight resume panel file in `docs/`.
- [x] Add a state-consistency check script for code/doc sync.
- [x] Add a restart SOP into contribution guidelines.
- [x] Wire quality checks into git pre-commit hook (`check-secrets`, `check-max-lines`, `check-doc-sync`, `tsc`).
- [x] Expand `LLM.md` into full AI onboarding SOP.
- [ ] C12: Restore `annotationHelpers.ts` probability logic (remove 100% test trigger) — user-owned.
- [ ] C13: Clean up 26 `console.log` in 5 store files — user-owned.

## Next Step (Single)

- 等待用户选择下一个任务（候选：C12/C13 清理，或 `api/annotation.ts` 拆分）。

## Blockers

- None.

## Validation Snapshot

- `node ./scripts/pre-commit.mjs` → ✅ All 4 checks passed (2026-03-06).
- `npm run lint:docs-sync` → ✅ Passed.

## Resume Order

1. Read `LLM.md`.
2. Read this file (`docs/CURRENT_TASK.md`).
3. Read `docs/CODE_CLEANUP_HANDOVER_PLAN.md` section 4 (board) and latest section 8 log entry.
4. Continue from the single "Next Step" item above.

