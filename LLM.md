# LLM Entry

This is the single entry document for AI/LLM context loading in this repository.

## Authority Order

1. `LLM.md` (this file): global read order, hard constraints, and sync rules.
2. `docs/PROJECT_MAP.md`: repository structure and boundary truth source.
3. Module README files:
   - `src/features/auth/README.md`
   - `src/features/chat/README.md`
   - `src/features/todo/README.md`
   - `src/features/report/README.md`
   - `src/api/README.md`
4. Key file dependency headers (`DOC-DEPS` in key files) for file-level context.
5. `docs/CODE_CLEANUP_HANDOVER_PLAN.md`: execution board and handover history.

If two documents conflict, follow the order above.

## Three-Layer Read Order

1. L1 Global: `LLM.md` -> `docs/PROJECT_MAP.md`
2. L2 Module: read the target module README in `src/features/*/README.md` or `src/api/README.md`
3. L3 File: read key file `DOC-DEPS` headers and then the file body

## Hard Constraints

1. Frontend code in `src/**` must not call third-party AI providers directly.
2. AI calls must go through `src/api/client.ts` -> `api/*` serverless handlers.
3. Secret keys must be loaded from `process.env` on server side only.
4. For structural or interface changes, code and docs must be updated in the same PR.

## Prohibited Changes

1. Do not create parallel "main plan" docs to replace `docs/CODE_CLEANUP_HANDOVER_PLAN.md`.
2. Do not add new pages outside `src/features/*`.
3. Do not bypass `npm run lint:docs-sync` after structure or interface changes.

## Loop Check (Required)

Before merging:

1. Run `npm run lint:docs-sync`.
2. If code paths changed, update module README and relevant key file `DOC-DEPS` headers.
3. Add one changelog entry in `docs/CHANGELOG.md` for doc-sync impact.
4. Sync board/log status in `docs/CODE_CLEANUP_HANDOVER_PLAN.md` when cleanup tasks are involved.
