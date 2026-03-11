# CURRENT TASK (Session Resume Anchor)

- Last Updated: 2026-03-11 (PM, session-21)
- Owner: current working session
- Purpose: this file is the quick resume anchor for any new session.

## Current Focus

- Mainline task status: `magicpen-v2` is now the active implementation track.
- Scope anchor for next execution: adopt Mode-B interaction (`wand mode toggle` + `send-triggered parse`) and migrate parser path from regex-first to AI-first.
- Doc planning anchor for this execution: `LLM.md -> docs/MAGIC_PEN_CAPTURE_SPEC.md -> src/features/chat/README.md -> src/features/todo/README.md -> src/features/report/README.md`.
- `moodauto` remains available as follow-up branch and is no longer the immediate execution target.

## Past Focus

- `magicpen` implementation track is paused as a non-blocking branch; remaining manual acceptance can be resumed later.
- `cleanup` remains historical reference only in `docs/CODE_CLEANUP_HANDOVER_PLAN.md` and `docs/CHANGELOG.md`.

## Execution Snapshot (2026-03-11 PM / session-21)

- Mode-B 交互已落地：`ChatInputBar` 改为 wand 模式开关态；`ChatPage.handleSend` 在 mode-on 时触发 Magic Pen 解析并打开 `MagicPenSheet` 预填结果。
- 新增 serverless 端点 `api/magic-pen-parse.ts`，复用 `api/http.ts`，使用 `glm-4.7-flash` + `ZHIPU_API_KEY`，并实现三层解析兜底（直接 parse / 外层 JSON 提取 / 空 segments fallback）。
- 前端 API 合同已补齐：`src/api/client.ts` 新增 `callMagicPenParseAPI()`，`api/README.md` 与 `src/api/README.md` 已同步端点与 facade 描述。
- `src/services/input/magicPenParser.ts` 已切换为 async AI-first；本地 regex 解析已外提到 `src/services/input/magicPenParserLocalFallback.ts` 作为降级路径。
- `src/features/chat/MagicPenSheet.tsx` 解析动作已改为 `await parseMagicPenInput`，并补充解析中态与错误态文案。
- 回归补齐：`magicPenParser.test.ts` 改为 async；新增 `magicPenDraftBuilder.test.ts`；现有 `magicPenActions.test.ts` 与 `chatPageActions.test.ts` 已通过。

## Active Checklist (Tomorrow Dev Execution Plan)

### Phase MP0 / P0 - Mode-B interaction switch (locked)

- [x] Keep Magic Pen as **mode toggle** on wand button (not direct sheet-open).
- [x] `ChatInputBar.tsx`: add `isMagicPenModeOn` prop and `onToggleMagicPenMode` callback with clear active visual state.
- [x] `ChatPage.tsx`: add `isMagicPenModeOn` state and wire to `ChatInputBar`.
- [x] `ChatPage.tsx`: branch `handleSend`:
  1) mode off -> keep `sendAutoRecognizedInput(input)`
  2) mode on -> run Magic Pen parse flow and open `MagicPenSheet` with parsed result
- [x] Keep no-direct-write rule: parse result must still require `MagicPenSheet` confirmation before commit.

### Phase MP1 / P0 - AI parse endpoint + client contract

- [x] Add endpoint: `api/magic-pen-parse.ts` (reuse `api/http.ts` CORS/method/error helpers).
- [x] Use `glm-4.7-flash` with `ZHIPU_API_KEY`; enforce strict JSON response schema.
- [x] Implement server parse fallback strategy:
  1) direct `JSON.parse`
  2) outer `{...}` extraction parse
  3) safe fallback `{ segments: [], unparsed: [...] }`
- [x] Add client method in `src/api/client.ts`: `callMagicPenParseAPI(request)`.
- [x] Sync `api/README.md` endpoint table for `/api/magic-pen-parse`.

### Phase MP2 / P0 - Frontend parser refactor (AI-first)

- [x] Refactor `src/services/input/magicPenParser.ts` to async pipeline:
  1) lightweight preprocess
  2) call `callMagicPenParseAPI`
  3) map AI result via `magicPenDraftBuilder`
- [x] Remove regex-heavy classification logic from `magicPenParser.ts`.
- [x] Update `MagicPenSheet.tsx` parse action to `await parseMagicPenInput` with loading/error/retry states.
- [x] Keep deterministic local validation in `validateDrafts()` (time range, future, cross-day, overlap, ongoing conflict).

### Phase MP3 / P1 - Deletion/cleanup pass (obsolete code)

- [ ] Remove `src/services/input/magicPenRules.zh.ts` if no longer referenced.
- [x] Re-evaluate `src/services/input/magicPenDateParser.ts`:
  - keep only if still needed as deterministic post-process helper
  - otherwise delete and remove imports/tests accordingly
- [x] Ensure no stale references to old sync parser signatures remain.

### Phase MP4 / P0 - Test and regression baseline

- [x] Update `src/services/input/magicPenParser.test.ts` for async API-based parser behavior.
- [x] Add/refresh `magicPenDraftBuilder` tests for AI-result-to-draft mapping and validation rules.
- [x] Keep/adjust `src/store/magicPenActions.test.ts` for commit ordering + partial failure behavior.
- [ ] Add endpoint-level parse schema/robustness tests for `api/magic-pen-parse.ts` (if test harness available).

### Phase MP5 / P0 - Final verification gates

- [x] `npx tsc --noEmit`
- [x] `npm run test:unit -- src/services/input/magicPenParser.test.ts src/services/input/magicPenDraftBuilder.test.ts src/store/magicPenActions.test.ts`
- [x] `npm run lint:docs-sync`
- [x] `npm run lint:state-consistency`
- [x] `npm run build`

### Phase A / P0 - Runtime pipeline reorder

- [x] Reorder classifier runtime path in `src/services/input/liveInputClassifier.ts` to:
  1) normalize
  2) future/planned intercept
  3) negation/not-happened intercept
  4) ongoing detector
  5) completion detector
  6) `go + place` detector
  7) lexicon detector
  8) mood detector
  9) context linking
  10) final `internalKind` decision
- [x] Keep `hasWeakCompletion` as `mood +2` per product decision; no rollback in this round.
- [x] Keep context linking evidence-based only; no speculative shortcut path.

### Phase B / P0 - `go + place` structure detector

- [x] Add `ZH_PLACE_NOUNS` in `src/services/input/liveInputRules.zh.ts` (high-frequency place nouns first).
- [x] Add `detectGoToPlaceActivity(input)` in `src/services/input/liveInputClassifier.ts`.
- [x] Apply hard gating:
  - planned/future hit -> block activity landing
  - negated/not-happened hit -> block activity landing
  - explicit happened shell (`刚/已经/了`) -> strengthen activity evidence

### Phase C / P1 - Evidence objectization

- [x] Add internal evidence type in `src/services/input/types.ts`:
  - `source`
  - `strength`
  - `polarity`
  - `tokens`
  - `reasonCode`
- [x] Refactor classifier internals to output evidence list, then map to scores/kind.
- [x] Sync reason codes with `src/services/input/liveInputTelemetry.ts`.

### Phase D / P0 - Regression test expansion

- [x] Add required cases to `src/services/input/liveInputClassifier.test.ts`:
  - `去公园` / `去博物馆` / `去超市`
  - `待会去公园` / `明天去博物馆`
  - `想去公园但没去` / `今天没有产出`
  - `刚去超市回来` / `已经去公园了`
  - `去公园好开心`
- [x] Add rule-level guards to `src/services/input/liveInputRules.test.ts`.
- [x] Re-run integration safety check for ongoing attach behavior in `src/store/useChatStore.integration.test.ts`.

### Phase E / P1 - Write path verification

- [x] Verify dispatch still routes by `internalKind` in `src/store/chatActions.ts`.
- [x] Verify ongoing mood attach remains explicit via `relatedActivityId` in `src/store/useChatStore.ts`.
- [x] Verify no fallback mood attach to ended activity is reintroduced.

## Next Step (Single)

- Next: implement MP0 + MP1 first (mode toggle send-branch and `/api/magic-pen-parse` contract), then wire MP2 parser refactor.

## Execution Snapshot (2026-03-11 PM / session-20)

- User confirmed **Mode-B** as the canonical Magic Pen interaction:
  - wand button = mode toggle
  - parse is triggered on send
  - no auto-commit; sheet confirmation remains mandatory
- Execution plan has been promoted into Active Checklist as MP0-MP5 for direct engineering handoff.
- `moodauto` checklist remains as historical context and can resume after `magicpen-v2` milestone.

## Execution Snapshot (2026-03-11 PM / session-19)

- 写路径验证已完成：`src/store/chatActions.ts` 按 `internalKind` 分发保持正确，`standalone_mood` 仅在 `relatedActivityId` 存在时显式挂载。
- 回归补充：`src/store/chatActions.test.ts` 新增两条关键用例：
  - ongoing activity 下 `standalone_mood` 必须携带 `relatedActivityId`
  - ended activity 下 `standalone_mood` 不得 fallback 挂载（`sendMood(content, undefined)`）
- integration 结果确认：`src/store/useChatStore.integration.test.ts` 现有“ongoing attach / ended no attach”行为保持稳定。
- gold 评估快照（zh）：`npm run eval:live-input:gold`
  - `kind_accuracy = 88.69%`
  - `internal_accuracy = 82.74%`
  - Top mismatch pairs:
    1. `new_activity -> standalone_mood: 9`
    2. `activity_with_mood -> standalone_mood: 7`
    3. `mood_about_last_activity -> standalone_mood: 6`

## Execution Snapshot (2026-03-11 PM / session-18)

- `src/services/input/types.ts` 已新增内部证据模型：`LiveEvidence`（`source/strength/polarity/tokens/reasonCode`）并挂载到 `LiveInputClassification.evidence`。
- `src/services/input/liveInputClassifier.ts` 已完成 evidence-first 重构：先产出证据列表，再统一映射到 `scores`，并保持原 `internalKind` 决策语义不变。
- `src/services/input/liveInputTelemetry.ts` 已改为优先聚合 evidence reasonCode，同时与 `classification.reasons` 做并集，保证历史 reason 统计兼容。
- 回归补充：`src/services/input/liveInputClassifier.test.ts` 新增 evidence 断言（planned 拦截、go+place happened shell）。
- 已完成目标验证：
  - `npm run test:unit -- src/services/input/liveInputClassifier.test.ts src/services/input/liveInputRules.test.ts src/store/chatActions.test.ts src/store/useChatStore.integration.test.ts` ✅
  - `npx tsc --noEmit` ✅
  - `npm run lint:docs-sync` ✅
  - `npm run lint:state-consistency` ✅

## Execution Snapshot (2026-03-11 PM / session-17)

- `src/services/input/liveInputClassifier.ts` 已按结构优先重排运行时链路：`future/planned` 拦截 -> `negated/not occurred` 拦截 -> ongoing/completion -> `go + place` -> lexicon -> mood -> context linking -> final dispatch。
- `src/services/input/liveInputRules.zh.ts` 新增 `ZH_PLACE_NOUNS`，并拆分 `ZH_FUTURE_OR_PLAN_PATTERNS`、`ZH_NEGATED_OR_NOT_OCCURRED_PATTERNS`；`ZH_NON_ACTIVITY_PATTERNS` 保持为组合导出兼容旧调用。
- 已新增 `go + place` 关键回归：`去公园/去博物馆/去超市`、`待会去公园/明天去博物馆`、`想去公园但没去`、`刚去超市回来/已经去公园了`、`去公园好开心`。
- 已新增规则层 guard：future 与 negated 分层命中、地点词表存在性断言。
- 已完成目标验证：
  - `npm run test:unit -- src/services/input/liveInputClassifier.test.ts src/services/input/liveInputRules.test.ts src/store/useChatStore.integration.test.ts` ✅

## Today Discussion Addendum (2026-03-11)

### Execution Notes (1-4)

1. Reorder classifier runtime to structure-first before lexicon-first, and keep interceptors (`future/planned`, `negation/not-happened`) ahead of activity landing.
2. Implement `go + place` as a dedicated structure detector first, then generalize to motion verbs with the same place noun domain.
3. Expand regression set in lockstep with detector rollout: happened/planned/negated/mood-mixed variants must all have explicit tests.
4. Start with conservative high-frequency place nouns and high-precision patterns, then widen coverage based on mismatch report instead of bulk phrase stuffing.

### Gap Clarification (Current Main Weakness)

- Main gap remains: activity recognition is still lexicon-first in several paths, while structure detectors are incomplete.
- Priority remains to finish runtime pipeline reorder + structure detectors before adding more phrase entries.

### Structure-Detection Expansion Direction

- Keep `go + place` as P0 baseline and extend to `逛 + place` in the same detector family.
- Recommended motion verb set (first pass): `去/到/回/来/逛/逛逛/跑去/赶去/直奔`.
- Recommended high-frequency place nouns (first pass): `公园/博物馆/超市/商场/菜市场/图书馆/公司/学校/医院`.
- Hard gates stay unchanged: future/planned hit -> block activity; negated/not-happened hit -> block activity; explicit happened shell (`刚/已经/了/回来`) -> strengthen activity evidence.

## Magic Pen V2 Addendum (Session-16, user-confirmed)

### Locked decisions

1. Entry interaction:
   - Tapping Magic Pen should toggle an active/highlight state on the wand button.
   - User continues typing in the existing main input.
2. Parse trigger:
   - Use choice-2: parsing is triggered on send.
   - No typing-time auto parse in this phase.
3. Parsing strategy:
   - Move from regex-heavy extraction to LLM-led extraction/classification for better speech-to-text robustness.
   - Keep deterministic post-validation and local parser fallback.

### Execution plan (handoff-ready)

#### Phase MP-A / P0 - UI mode and send branch wiring

- `src/features/chat/ChatInputBar.tsx`
  1) Add `isMagicPenModeOn` prop and `onToggleMagicPenMode` callback.
  2) Wand button toggles mode and shows clear active style.
- `src/features/chat/ChatPage.tsx`
  1) Add `isMagicPenModeOn` state.
  2) Branch `handleSend`:
     - mode off -> keep current `sendAutoRecognizedInput` path.
     - mode on -> call Magic Pen parse flow, then open `MagicPenSheet` with parsed drafts.
  3) Keep no-direct-write rule (sheet confirmation remains mandatory).

#### Phase MP-B / P0 - API contract and server parser

- Add endpoint: `api/magic-pen-parse.ts`.
- Add client method: `callMagicPenParseAPI()` in `src/api/client.ts`.
- Response contract (strict JSON):
  - `drafts: MagicPenDraftItem[]`
  - `unparsedSegments: string[]`
  - optional `meta` (`model`, `latencyMs`, `fallbackUsed`).
- Server responsibilities:
  1) Prompt LLM for extraction/classification.
  2) Parse and validate JSON schema.
  3) Normalize fields to existing Magic Pen type contracts.

#### Phase MP-C / P0 - Reliability and fallback

- If API fails/timeout/invalid JSON:
  1) fallback to local `parseMagicPenInput`.
  2) still open sheet with fallback result.
- Preserve existing validators (`validateDrafts`) for activity/timeline safety.

#### Phase MP-D / P1 - Regression coverage

- Add/extend tests for:
  1) mode on/off send branching in chat page actions.
  2) server payload parse and schema guard.
  3) fallback behavior (API fail -> local parser).
  4) noisy speech-like Chinese inputs with weak punctuation.

### Acceptance criteria

1. Wand button clearly indicates active mode.
2. With mode on, user types in main input and taps send -> parsed result appears in `MagicPenSheet`.
3. Non-magic normal send path is unchanged when mode is off.
4. Parse API failure does not block flow; fallback path still works.
5. No automatic commit without sheet confirmation.

## Blockers

- No external blocker at the moment.
- Risk: overly broad place-noun list may increase false positives; start with conservative Top set.
- Constraint: this round should stay in service/store classification path, avoid page-layer scope creep.

## Validation Snapshot

- Docs now include explicit structure-first plan and tomorrow-ready task list.
- Refactor proposal has a dedicated execution section with locked decision: keep `hasWeakCompletion` at `+2` in this round.
- Existing code already has non-activity interception for `什么都没做` and `没/没有产出`, but still needs full structure-first completion for `go + place` generalization.

## Resume Order

1. Read `LLM.md`.
2. Read this file (`docs/CURRENT_TASK.md`).
3. Read `docs/ACTIVITY_MOOD_AUTO_RECOGNITION_REFACTOR_PROPOSAL.md` Section 15.
4. Read `docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md` for product constraints and acceptance.
5. Inspect `src/services/input/liveInputClassifier.ts`, `src/services/input/liveInputRules.zh.ts`, `src/services/input/liveInputClassifier.test.ts`, `src/services/input/liveInputRules.test.ts`, `src/store/chatActions.ts`, and `src/store/useChatStore.ts`.
6. Run targeted verification before merge: `npm run test:unit -- src/services/input/liveInputClassifier.test.ts src/services/input/liveInputRules.test.ts src/store/useChatStore.integration.test.ts`.
