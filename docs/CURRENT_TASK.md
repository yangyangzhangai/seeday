# CURRENT TASK (Session Resume Anchor)

- Last Updated: 2026-03-07
- Owner: current working session
- Purpose: this file is the quick resume anchor for any new session.

## Current Focus

- 已完成 Phase H 的 H5/H6/H7（annotation 拆分、chat store 瘦身、重依赖清理）。H8 已按用户决定停止执行。

## Active Checklist

- [x] Add a lightweight resume panel file in `docs/`.
- [x] Add a state-consistency check script for code/doc sync.
- [x] Add a restart SOP into contribution guidelines.
- [x] Wire quality checks into git pre-commit hook (`check-secrets`, `check-max-lines`, `check-doc-sync`, `tsc`).
- [x] Expand `LLM.md` into full AI onboarding SOP.
- [x] H5: Split annotation prompts/handler (`api/annotation-prompts.ts`, `api/annotation-handler.ts`).
- [x] H6: Extract `insertActivity` + duration-sync helper flow from `useChatStore` to `chatActions`.
- [x] H7: Remove unused heavy dependencies (`cannon-es`, `matter-js`, `three`, `@types/matter-js`).
- [ ] C12: Restore `annotationHelpers.ts` probability logic (remove 100% test trigger) — user-owned.
- [ ] C13: Clean up 26 `console.log` in 5 store files — user-owned.

## Next Step (Single)

- 等待用户选择下一步（转入新功能任务；C12/C13 继续保持用户自持）。

## Blockers

- None.

## Validation Snapshot

- `npm run lint:max-lines` → ✅ Passed (warnings only).
- `npm run lint:docs-sync` → ✅ Passed.
- `npm run lint:state-consistency` → ✅ Passed.
- `npx tsc --noEmit` → ✅ Passed.
- `npm run build` → ✅ Passed.

## Resume Order

1. Read `LLM.md`.
2. Read this file (`docs/CURRENT_TASK.md`).
3. Read `docs/CODE_CLEANUP_HANDOVER_PLAN.md` section 4 (board) and latest section 8 log entry.
4. Continue from the single "Next Step" item above.
