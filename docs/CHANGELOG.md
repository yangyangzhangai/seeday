# Changelog

## 2026-10-28 - Tune DeepSeek request budgets by feature

- Applied the discussed per-feature temperatures and output limits, including retries, rewrites and pre-decomposition; all DeepSeek requests remain non-thinking. Current values are recorded in `docs/AI_USAGE_INVENTORY.md`.
- Preserved existing prompts, response schemas, timeouts/fallbacks and the prior OpenAI/Gemini parameters. Prompt editing and environment-based prompt management are deferred by user request.
- Updated request assertions and API documentation. Risk: larger Magic Pen/profile budgets require real-provider latency/quality checks; raising the budget does not bypass existing timeouts. Rollback: revert this parameter adjustment or use the retained legacy provider configuration. Validation: all 861 unit tests, lint/type/docs/state checks, full-repository secret scan and production build pass; no publication performed.

## 2026-10-21 - DeepSeek Pro/Flash defaults with configuration rollback

- Moved all eight AI capabilities and all languages to DeepSeek: full diary uses `deepseek-v4-pro`; other requests use `deepseek-flash`. Every DeepSeek call explicitly sends `thinking.type=disabled`, including retries and suggestion pre-decomposition.
- Added centralized routing and environment overrides. Retained OpenAI Responses/Chat Completions and Gemini generateContent adapters; `AI_PROVIDER_MODE=legacy` plus valid provider keys and a server redeploy restores the old supplier mapping without code edits. DeepSeek paths default to Flash in both modes.
- Preserved frontend contracts, output budgets, prompts, membership/consent guards, local fallbacks and the function count. OpenAI clients now initialize lazily so default mode works with only a DeepSeek key; legacy requests retain `store:false` / Gemini `thinkingBudget:0`.
- Updated the AI inventory, API guides, project map, session anchor and `.env.example`. Existing user-facing privacy/i18n copy was not rewritten.
- Risk/rollback: model style, structured extraction quality and latency require real-provider checks after deployment. Roll back via `AI_PROVIDER_MODE=legacy` and redeploy; no schema migration is involved. Remote August 4 UI commits were merged on 2026-10-28 at `9a55ec3`; no deployment or live AI calls were performed.
- Validation (2026-10-28): post-merge lint/type/docs/state checks, the full-repository secret scan (545 files), production build, and all 861 tests across 108 files pass. The outbox regression test now loads Chat/Mood dependencies before fake timers instead of importing them during the timed test; production behavior and timeout remain unchanged. Routing tests additionally assert temperature and output-token budgets. User authorized GitHub publication on 2026-10-28.

## 2026-08-04 - Complete shared UI migration gaps

- Replaced the unused legacy avatar header with a shared frosted page-header shell and reused it on Chat, Growth, Report, and Profile without changing their controls or layout.
- Migrated Auth supporting copy, statuses, dividers, social actions, primary CTA, and agreement text to the established typography semantics while preserving authentication and verification behavior.
- Applied shared modal, button, form, and text foundations to AI consent, reminder, evening-check, quick-activity, and fatal-error surfaces without changing their callbacks or persistence.
- Extended `AppSelectMenu` with placeholder and invalid states, then reused it for Feedback issue type and all Root Direction positions while preserving existing values, duplicate validation, telemetry, and save flows.
- Corrected Root Direction dialog close semantics by keeping the backdrop decorative and naming the visible close control with the existing localized label.
- Kept Membership Purchase, Diary Book content/viewer layout, Report's dedicated calendar, and Onboarding showcase headings/artwork outside this pass as previously confirmed independent presentation boundaries.

## 2026-08-04 - Migrate Onboarding while preserving display hierarchy

- Kept the `30px` welcome heading, `24px` step headings, AI companion names, illustrations, progress bar, card geometry, and onboarding motion as presentation-specific visuals.
- Migrated onboarding subtitles, feature rows, form-adjacent copy, statuses, field labels, small actions, primary CTAs, removable-item hit areas, and the active Routine time-picker shell to the shared typography, form, hit-target, and modal semantics.
- Continued reusing Terms, Privacy, EventCard, MoodCard, and MoodPicker without onboarding-specific overrides; left the unreferenced legacy `OnboardingTimePicker.tsx` untouched.
- Preserved authentication, OTP verification, trial activation, Journal classification, Todo/Bottle/Routine state, onboarding persistence, and navigation behavior.

## 2026-08-04 - Migrate Report with separate Diary Book layout

- Migrated the ordinary Report page, detail pages, stats, task/activity views, plant-root controls, and standard notices to the shared typography semantics without changing report data or behavior.
- Restored Report's independent frosted Diary calendar shell while preserving its today/future disabled dates and weekly/monthly/custom marker actions.
- Migrated only the Diary Book header and search-tool shell to shared page/modal/form semantics; retained the independent book-cover, shelf, scaled paper-page, expanded-reading, and motion typography.
- Preserved report generation, frozen diary snapshots, observation selection, My Diary edit locks, date navigation, plant rendering, and persistence.

## 2026-08-04 - Refine Magic Pen group hierarchy

- Restored Magic Pen activity/todo draft project-title inputs to the shared `16px` form tier so web and narrow iOS WebKit remain aligned with the focus-zoom safeguard.
- Raised only the Activity, Todo, and Auto-written group labels from `12px` captions to `14px` medium-weight body text.
- Preserved Magic Pen behavior, other Chat typography, card geometry, copy, and persistence.

## 2026-08-04 - Restyle Magic Pen todo date control

- Replaced the exposed browser-native date field with a compact, full-width trigger that matches the warm Magic Pen draft card, uses a local Lucide icon, and keeps a 44px minimum touch target.
- Added a generic `AppCalendarPicker` that reuses the existing `.calendar-wrapper` visual foundation and renders through a portal so Magic Pen's scrollable review sheet cannot clip it.
- Removed the hidden native date interaction layer; selection now uses the shared `react-calendar` surface while preserving the localized visible date, local-date timestamp conversion, accessibility label, draft updates, and persistence.
- Kept Report-only disabled-future rules and Report/Diary date markers out of the shared picker.

## 2026-08-01 - Migrate active Chat surfaces to typography tokens

- Migrated the active Chat date header, timeline empty state/time labels, event and mood card hierarchy, mood notes, timer/status text, input feedback, mood chips, and yesterday summary to the shared page-title, body, description, and caption tiers.
- Preserved Magic Pen's nested hierarchy with shared section-title, body, description, caption, and form tiers across the main sheet and its edit, crop, and upgrade dialogs.
- Kept card geometry, colors, mood serif treatment, images, actions, classification, upload/sync, timers, draft validation/commit, and persistence unchanged. Fixed calendar geometry and the unreferenced legacy `MessageItem` remain scoped exceptions.
- Added a development-only `preview=ui` hash query that suppresses the consent gate for visual review without changing consent state or bypassing client/server AI-request enforcement.

## 2026-07-31 - Explicit third-party AI consent and verified privacy wording

- Added a separate, unselected ZH/EN/IT AI-consent dialog that identifies DeepSeek, OpenAI, and Google Gemini, explains data categories and purposes, requires an affirmative checkbox, and lets users continue with non-AI features.
- Added versioned consent state/timestamps to `user_account_state`, a Profile settings surface for status/re-grant/withdrawal, and fail-closed persistence semantics so an unavailable cloud write cannot enable AI locally.
- Centralized pure-AI client gating and added independent server-side database verification for annotation, classification/todo decomposition, full diary/insight, Magic Pen, and profile extraction. Plant generation stays available without consent but uses local static text instead of OpenAI.
- Rewrote the in-app privacy and account-deletion copy in Chinese, English, and Italian to reflect the verified Supabase/OpenAI/Gemini settings, qualified DeepSeek evidence boundary, consent withdrawal, account-deletion interruption behavior, and provider log/backup limits.
- Updated App Store submission/compliance trackers with the supplied control-panel evidence and a ready-to-paste Review Notes explanation; production rollout still requires the consent SQL migration, server deployment, and new iOS build.
- Added focused consent verification tests and updated the annotation handler test harness for the new server guard.

## 2026-07-31 - AI provider retention evidence and no-store requests

- Reviewed the supplied Supabase, Gemini, and OpenAI control-panel evidence and recorded the verified plan, backup, logging, sharing, and retention settings in `docs/AI_USAGE_INVENTORY.md`.
- Added explicit `store: false` to every active OpenAI Chat Completions and Responses request, covering full diary, report insight, profile extraction, English/Italian annotation, and plant observation generation.
- Added a regression assertion for the Responses API annotation path so later refactors cannot silently restore provider-side application-state storage.
- Kept provider abuse-monitoring retention distinct from application-state storage; DeepSeek still requires written API retention/training/DPA evidence before final privacy copy can make provider-specific claims.
- Verification: all 13 annotation handler tests, `npm run lint:all`, `npm run lint:state-consistency`, and the production build pass.

## 2026-07-30 - iOS production API bundle and Apple deletion reauthorization

- Added a tracked `.env.ios` production API base and changed `npm run build:ios` to validate/normalize the endpoint, build with Vite's iOS mode, and run `cap copy ios`; the generated local Xcode bundle was verified to contain the absolute production `/api` base.
- Moved account table/Storage cleanup into tested fail-closed server helpers while preserving recursive deletion of all `seeday-images/<userId>/**` files and the full known user-scoped table list, including feedback and telemetry.
- Replaced the unreliable Supabase provider-token-at-delete dependency for Apple users. iOS deletion now reauthorizes with the native Apple sheet, sends a fresh authorization code, exchanges it server-side, verifies the returned Apple subject/audience against the linked account, revokes the token, and only then starts user-data deletion.
- Separated Sign in with Apple revoke credentials from App Store Connect IAP credentials (`APPLE_SIGN_IN_TEAM_ID`, `APPLE_SIGN_IN_KEY_ID`, `APPLE_SIGN_IN_PRIVATE_KEY`, `APPLE_SIGN_IN_CLIENT_ID`) and added focused regression coverage for token exchange/revoke, identity mismatch, recursive Storage cleanup, and table-delete interruption.
- Removed obsolete `QWEN_BASE_URL`, `QWEN_API_KEY`, `ZHIPU_API_KEY`, and `CHUTES_API_KEY` from the linked Vercel project. Added the verified Apple Team ID/client ID to all Vercel environments; the operator must still provide the Sign in with Apple Key ID and `.p8` private key.
- Verification: `npm run lint:all`, the iOS production build/copy, and all 7 focused deletion/revoke tests pass. The repository-wide unit suite still has 19 failures in unrelated pre-existing annotation, magic-pen timezone, companion prompt, store, reminder, and feedback tests; no failing test targets a file changed by this work.
## 2026-07-31 - Pre-merge stability baseline restored

- Serialized new Chat activity persistence so the parent `messages` row is persisted or queued before automatic mood persistence starts, preventing mood foreign-key races without changing local-first message creation.
- Automatic mood detection now infers language from the entered text in both new-activity and attached-mood paths, so multilingual input is no longer interpreted through the current UI language.
- Aligned Chinese Magic Pen period windows with `docs/MAGIC_PEN_CAPTURE_SPEC.md` and made todo hydration normalize numeric-string `sort_order` timestamps instead of silently falling back to due/created time.
- Updated stale annotation/diary/suggestion assertions, froze reminder/report tests in local time, excluded nested `.claude/worktrees/**` from Vitest discovery, and gave the first-run orphan-mood outbox integration case a scoped 10-second budget for its dynamic Store imports. The canonical suite now passes all 823 tests across 103 files.
- Added a GitHub Quality workflow that runs repository checks, the full unit suite, and the production build for pull requests and pushes to `main`.

## 2026-07-31 - Reorder Growth todo editor fields

- Moved the Priority row below Repeat in both the expanded todo editor and Add Task modal, producing the order Due Date & Time, Repeat, Priority, then Link to Bottle after the task title.
- Preserved priority values, selected-state styling, update/draft behavior, persistence, typography, and localized copy.

## 2026-07-31 - Unify expanded Growth editor typography

- Unified labels, option values, browser date text, bottle selection, Steps content/actions, Pin, and title editing in the expanded todo editor at the same `14px` body tier as the compact todo row.
- Added a scoped compact typography option to `AppSelectMenu`, preserving the Add Task dialog's default `16px` trigger and all existing dropdown behavior.
- Kept the global narrow-WebKit native-control safeguard, so the iPhone date input may remain `16px` to prevent focus zoom; todo data, handlers, persistence, colors, and copy are unchanged.

## 2026-07-30 - Align expanded Growth form typography

- Raised the expanded todo editor's priority and recurrence choices from the `12px` caption tier to the shared `16px` form tier, matching date/time and Link to Bottle values.
- Kept field labels, Steps content, and Pin at `12px`, with all task values, handlers, persistence, colors, and localized copy unchanged.

## 2026-07-30 - Replace Growth native bottle selects

- Added the reusable `AppSelectMenu` custom listbox, visually derived from the existing Feedback dropdown and aligned with the app's rounded glass surfaces.
- Replaced only the Add Task and expanded-task Link to Bottle native selects; bottle IDs, draft state, and save handlers are unchanged.
- Added `44px` option targets, selected-state tint/checkmark, bounded internal scrolling, automatic selected-option reveal, outside-press closing, and Escape closing.
- Browser checks confirmed both placements stay inside the viewport, avoid horizontal overflow, expose listbox/option semantics, and select/close correctly without saving test data.

## 2026-07-30 - Migrate Growth surfaces to typography tokens

- Migrated the Growth page and section hierarchy, bottle labels, todo rows, expanded task editors, nested steps, ordinary focus-mode copy, dialogs, and status feedback to the global typography semantics.
- Kept compact todo text at the `14px` body level and native controls at the `16px` form level; bottle names and progress now share the `12px` supporting tier instead of the previous `11px` name / `14px` progress inversion.
- Preserved functional display sizes for focus timers, celebrations, active-focus titles, and the Daily Goal prompt, along with all Growth colors, geometry, drag/sort/completion/recurrence behavior, focus timing, rewards, and persistence.
- Verified the running root page, bottle detail, add-bottle/add-todo dialogs, expanded todo editor, and focus setup in English, plus root/modal fit in Chinese and Italian, with no semantic-text or horizontal overflow.

## 2026-07-30 - Keep Root Direction labels on one line

- Widened the shared English category selector from `140px` to `155px`, allowing `Work & Study` to remain on one line while keeping all five English selectors equal in width.
- Preserved the existing Chinese and Italian widths, modal layout, category values, and save behavior.

## 2026-07-30 - Migrate Profile secondary surfaces to typography tokens

- Migrated the standalone Routine and AI Personal Memory pages plus Region, Root Direction, Change Password, Help, About, Privacy, Terms, Feedback, and Delete Account panels to the global typography semantics.
- Preserved all business callbacks, localized copy, colors, geometry, persistence, account actions, and navigation; the separate Upgrade/payment flow was intentionally excluded.
- Kept Routine time-wheel selected/unselected sizes and the About brand glyph as intentional local display treatments.
- Verified the running routes and representative panels in English, Chinese, and Italian; semantic text and the page frame show no horizontal overflow.

## 2026-07-30 - Migrate the Profile root page to typography tokens

- Migrated Profile identity copy, statistics, AI companion labels, embedded annotation sensitivity, FREE membership copy, and the language switcher to the global typography semantics.
- Kept the established hierarchy at `24px` for the page title, `16px` for primary names/values/settings, `12px` for supporting labels and descriptions, and `10px` for badges and compact hints.
- Preserved membership colors, card geometry, avatar and illustration sizing, toggle behavior, navigation, payment, and account logic.
- Verified computed typography and horizontal fit on the running Profile page; Chinese, English, and Italian semantic text all render without overflow, and the test language was restored to English.

## 2026-07-30 - Add global typography Design Tokens

- Created the independent `codex/ui-redesign` branch after design-spec confirmation.
- Added app-wide font-family, size, line-height, and weight tokens for display titles, page titles, section titles, item titles, body copy, descriptions, captions, form text, and badges.
- Added matching semantic typography classes in Tailwind's `components` layer so they override base element defaults while remaining overridable by intentional utility classes.
- Migrated the main Profile, Growth, and Report headers plus supported Report/Profile subpage headers to the `24px` page-title token.
- Added a shared standard modal-title class and migrated standard modal/sheet headers to the `16px` section-title token; special purchase and promotional dialog titles retain their existing display hierarchy.
- Migrated every visible native text input, textarea, and select to the `16px` form token, either directly or through the shared modal input class. A TypeScript syntax-tree audit reports zero visible form controls outside that semantic path.
- Replaced the Profile-only function-title class with the global `16px` item-title token and migrated setting descriptions to the `12px` description token.
- Confirmed that Bottom Nav contains icon-only links and therefore has no visible typography to migrate or change in this pass.
- Browser verification covered Profile, Growth, Report, personal memory, a standard information sheet, and Profile labels in Chinese, English, and Italian with no horizontal overflow or item-title truncation.

## 2026-07-30 - Standardize Profile item typography

- Raised the shared Profile function-title style from `14px` to `16px`, covering the main page's AI mode, membership, daily goal, routine, AI memory, language, region, root direction, account, help, deletion, and logout items.
- Raised the Daily Goal description from `10px` to `12px`, matching the existing AI-mode subtitle while leaving badges, statistics, buttons, and standalone settings-page labels unchanged.

## 2026-07-30 - Normalize native form-control typography

- Raised all visible native `input`, `textarea`, and `select` declarations below `16px` to `16px` across Auth, Chat/Magic Pen, Growth, Onboarding, Profile, Report, and Telemetry while leaving surrounding labels, descriptions, and button copy unchanged.
- Removed the Region input's independent `10px` placeholder override so its placeholder matches entered text.
- Re-audited all 55 native form controls through the TypeScript syntax tree; no visible control or explicitly sized placeholder remains below `16px`.

## 2026-07-30 - Align personal-memory editor typography

- Set the personal-memory editor label to `16px`, matching the textarea and the existing iOS form-control focus-zoom safeguard so browser preview and iPhone presentation use the same explicit size.
- Raised the standalone memory-enable title to `16px` while preserving the existing description and status-message sizes.

## 2026-07-30 - Localize startup and retry feedback

- Replaced the startup wait screen's developer-facing stage, timing, Xcode, and diagnostic-key copy with the confirmed localized loading message in Chinese, English, and Italian; detailed startup timing remains available through diagnostic logs.
- Reused the existing localized `retry` action for failed outbox entries and removed the browser tooltip that exposed internal sync kind, status, attempt count, retry time, and raw error details.

## 2026-07-30 - Restore component typography overrides

- Changed the global `1.5` line-height and Profile default `500` font-weight selectors to zero-specificity defaults without `!important`, allowing component-level line-height and weight utilities to render as declared while preserving the existing fallback typography.
- Scoped the forced full-bleed `.app-mobile-page-frame` reset to screens below `768px`, preserving the existing iPhone layout while allowing declared tablet/desktop max-width, radius, border, background, and shadow styles to apply.
- Standardized the personal-memory textarea and placeholder at `16px` in the component itself so browser preview and iOS WebView no longer disagree.
- Lowered the generic button hover/press transform specificity and added a reusable transparent `44x44` hit target to confirmed compact actions, modal close controls, and switches without enlarging their visible artwork.
- Replaced every runtime Material Symbols glyph with Lucide SVG icons and removed the unused icon-font bootstrap/dependency, eliminating the path where a failed font readiness check could leave navigation or action icons transparent.

## 2026-07-30 - Account deletion now fails closed and clears storage

- Reworked `api/delete-account.ts` to use the service-role client for explicit deletion of all currently known user-scoped tables before auth deletion, adding `telemetry_events`, `user_feedback`, `reminder_responses`, `user_profiles`, `user_account_state`, `user_login_days`, and `timing_sessions` to the hard-delete path.
- Account deletion now recursively removes all `seeday-images/<userId>/**` objects, covering avatar uploads, current chat-image folders, and legacy top-level chat image files, before deleting the Supabase Auth user.
- This first pass attempted Apple revocation from transient Supabase provider tokens; the later entry above replaces it with fresh native reauthorization and server-side code exchange.

## 2026-07-30 - In-app privacy provider disclosure matches runtime

- Updated the existing ZH/EN/IT privacy-policy i18n keys to list only the current AI providers: DeepSeek, OpenAI, and Google Gemini, with the actual language and feature routing.
- Removed the unverified claims that AI providers retain content only for the session and never use it for model training; the policy now states that provider-side retention and training depend on applicable terms and the active account configuration.
- Updated third-party disclosures to identify Supabase as Free and explain that Open-Meteo receives the configured region coordinates for weather and air-quality lookup, not journal text.

## 2026-07-29 - My Diary stays editable until next-day 06:00

- Kept the existing 20:00 AI diary generation gate and same-moment freeze for generated observation copy plus `stats.diaryPageSnapshot`, but changed the user-authored `My Diary` note (`reports.userNote`) to remain editable until the next local-day `06:00`.
- `src/features/report/ReportDetailModal.tsx` now allows conditional editing on page 2 during that grace window instead of rendering `My Diary` as permanently read-only immediately after generation, while `src/features/report/plant/PlantRootSection.tsx` closes the root-surface editor once the same cutoff passes.
- `src/store/useReportStore.ts` now rejects expired `daily.userNote` writes before local state/outbox changes, preventing late UI events from reopening a locked note after the grace window ends.

## 2026-07-29 - Qwen/Zhipu/Chutes retired; GPT and Gemini preserved

- Migrated the remaining Qwen classification path and Qwen/Zhipu Magic Pen chain to the shared DeepSeek `deepseek-chat` runtime, while preserving all existing OpenAI GPT and Gemini routes.
- Kept annotation split as `zh=DeepSeek / en,it=OpenAI`, todo decomposition as `zh=DeepSeek / en,it=Gemini`, and diary/insight/profile/plant diary on OpenAI.
- Deleted the orphaned Chutes-backed `/api/report` function and removed obsolete Qwen/Zhipu configuration plus the Magic Pen `fallbackFrom` client field.
- Made `docs/AI_USAGE_INVENTORY.md` the sole current provider/model/data-scope SSOT and updated deployment, API, architecture, compliance, profile, project-map, and App Store submission docs to reference the three-provider runtime.

## 2026-07-29 - Chat store integration tests split under max-lines gate

- Replaced the single oversized `src/store/useChatStore.integration.test.ts` with one shared helper file plus four focused suites: auto-recognition, timeline/manual-end edits, sync/images, and reclassify/mood stability.
- Preserved the same chat-store regression scenarios while bringing every individual test file back under the repository's max-lines threshold, so pre-commit no longer fails on that test coverage bundle.

## 2026-07-29 - Growth todo status pills moved inline with the title

- Moved the compact `today / tomorrow / overdue` todo status pills from the second line below the title into the title row itself, attached directly after the title text instead of forming a right-aligned status area, while shrinking the pill height so collapsed cards stay visually tighter.
- Pinned todos now show a matching compact pin pill beside the title, keeping pin state in the same visual language as due-state pills instead of hiding it only inside the expanded editor.
- The right-side priority/start/focus action cluster is unchanged; title text still truncates first so the state pills remain readable on narrow mobile widths.

## 2026-07-29 - Todo decompose zh now uses DeepSeek and caps at five steps

- Switched Growth todo manual decompose so Chinese requests now call DeepSeek `deepseek-chat`, while English and Italian stay on Gemini.
- Tightened the decompose prompt and normalization to return 3-5 sub-steps instead of allowing six, preserving the existing title + duration response contract.
- Updated the todo-decompose client/provider typing, server logging, deployment notes, and AI inventory/docs to match the new `zh=DeepSeek / en,it=Gemini` split.

## 2026-07-29 - Welcome feature illustrations

- Cropped seven user-provided transparent PNG illustrations into individually named Welcome assets for diary, Magic Pen, task breakdown, mood recognition, goal tracking, personal memory, and greenhouse companions; the personal-memory frame is vertically recentered within its transparent canvas.
- Replaced the trial-intro feature-row Emoji with the matching illustrations in fixed `48px` contain boxes; the personal-memory illustration alone is shifted left `4px` and down `8px` to compensate for its transparent-canvas balance and top-aligned card content, preserving the existing copy and trial behavior.

## 2026-07-29 - Welcome trial-intro local preview

- Added a development-only `#/onboarding?preview=trial` entry that renders the real Welcome step 2 for visual review.
- Preview mode suppresses onboarding account-state writes and trial activation, and the bypass is unavailable in production builds.

## 2026-07-29 - Activity cards can select two photos at once

- Empty Chat activity cards now open the native photo picker in multi-select mode and accept up to two selected images in one action.
- The selected images run through the existing crop flow sequentially and upload to the independent `imageUrl` / `imageUrl2` slots, preserving current storage and offline retry behavior.
- Cards that already contain one photo continue to target only the remaining slot.
- Added focused slot-availability regression coverage in `src/features/chat/components/eventCardImages.test.ts`.

## 2026-07-26 - Duplicate email signup now shows the existing-account error

- Fixed email-code signup so attempting to register an already registered email no longer falls through into the verification-code state with no actual code delivered.
- `src/store/authStoreAccountActions.ts` now preserves Supabase signup `data`, and the shared auth signup helper detects both explicit `User already registered` errors and Supabase's duplicate-email obfuscation payload shape (`session=null`, matching email, empty `identities`).
- `src/features/auth/AuthPage.tsx` and `src/features/onboarding/OnboardingFlow.tsx` now stop the flow early and show the existing localized `auth_error_user_exists` message for duplicate emails instead of pretending signup code delivery succeeded.
- Added focused regression coverage in `src/features/auth/authSignupHelpers.test.ts` for duplicate-email error mapping and obfuscated duplicate signup detection.

## 2026-07-26 - Todo completion annotations now bias positive encouragement

- Kept the existing `activity_completed` trigger path, but now pass raw annotation `eventData` through the normal prompt builder so plain annotation prompts can tell when the event is specifically a todo completion.
- When `todoCompletionContext.isTodoCompletion === true`, the normal annotation prompt now injects one extra short localized instruction (ZH/EN/IT) telling the companion to answer around the just-finished todo itself and lean more positive/encouraging.
- No annotation event types, trigger timing, or frontend completion flows changed.

## 2026-07-26 - Stardust memory cards always expose expand

- Fixed the Stardust memory viewer so saved annotation cards no longer hide the rest of a clamped note without offering a way to expand it on narrow mobile layouts.
- `src/components/feedback/StardustCard.tsx` still defaults message text to `line-clamp-4`, but the expand/collapse control is now always rendered instead of being incorrectly gated by `message.length > 200`.

## 2026-07-26 - Chat store max-lines split

- Split runtime-only helpers out of `src/store/useChatStore.ts` into new `src/store/chatStoreRuntime.ts` to satisfy the hard pre-commit max-lines gate again.
- Moved legacy-row filtering, manual-end timer bookkeeping, and day-rollover refresh orchestration without changing chat state shape, persistence, or user-visible behavior.

## 2026-07-26 - Growth todo completion now closes the original timeline card

- Fixed the Growth todo alarm/timer completion path so checking off a started todo now ends its originally linked Chat activity card instead of creating and closing a second synthetic completion record while the first card stays ongoing.
- `useChatStore.endActivity()` now writes the fully ended message through the existing `chat.upsert` sync path, marks the local card `pending` until cloud persistence settles, and falls back to the outbox on end-sync failure instead of silently leaving a stale cloud row behind.
- Chat cloud/local merge now keeps a locally ended pending activity over an older cloud copy that still says `is_active=true`, preventing date refreshes or home-page navigation from reviving a just-ended card.
- Added focused regression coverage in `src/store/useChatStore.integration.test.ts` and `src/store/chatSyncHelpers.test.ts`.

## 2026-07-24 - Plant snapshot backfill no longer crashes serverless runtime

- Fixed `/api/plant-generate` `snapshot_existing` crashing on Vercel with `ERR_MODULE_NOT_FOUND` when the Report page auto-backfilled a missing root snapshot.
- `src/lib/plantRootSnapshot.ts` now uses explicit ESM `.js` import specifiers for its server-shared `rootRenderer` and plant-type dependencies so the transpiled `plantRootSnapshot.js` resolves correctly inside serverless functions.
- This restores the background root-snapshot backfill path without changing plant-generation business logic, trigger timing, or frontend copy.

## 2026-07-24 - Magic Pen now uses the repo's DeepSeek path

- Replaced Magic Pen's exhausted Qwen/Zhipu remote provider chain with the repository's existing DeepSeek OpenAI-compatible runtime, defaulting to `deepseek-chat` and reusing `DEEPSEEK_API_KEY` with optional Magic-Pen-specific overrides.
- Preserved the existing Magic Pen JSON validation and semantic quality gate, but provider exhaustion now returns the original text for the local parser instead of attempting a second external provider.
- Magic Pen client parsing now auto-corrects Han-script input to `lang='zh'` before both the remote API call and the local fallback, preventing English UI language from routing Chinese notes through English prompts/rules.
- Added regression coverage for the DeepSeek provider path and Chinese-input language correction in `src/server/magic-pen-parse.test.ts` and `src/services/input/magicPenParser.remoteFallback.test.ts`.

## 2026-07-24 - English stretched mood words stay mood

- Fixed the ordinary English activity/mood classifier so elongated mood phrasing like `sooo good`, `reeeally tired`, `I feel goooood`, and `happppy today` no longer miss the mood regex path and fall through to activity.
- The English signal extractor now normalizes a small whitelist of stretched intensifiers (`sooo`, `reeeally`, `veeery`, `quiiite`) and mood adjectives (`goooood`, `greeeat`, `happppy`, `tiiiired`, `saaad`) before mood sentence-pattern matching only; activity/history parsing and stored user text remain unchanged.
- Added focused regression coverage in `src/services/input/liveInputClassifier.i18n.test.ts` for stretched-intensifier and stretched-adjective mood input.

## 2026-07-24 - Report My Diary save now dismisses iOS keyboard

- Fixed the Report root `My Diary` editor on Capacitor iOS so tapping `Save` now closes the editor and dismisses the native keyboard in the same action instead of requiring a second blank-area tap.
- Added a shared native keyboard dismiss helper and used it from the report diary save path while preserving the existing guarded save-button focus behavior.
- The textarea blur autosave path now skips its duplicate save during the explicit close sequence, avoiding double-persist races when the keyboard is dismissed programmatically.

## 2026-07-24 - Report diary-book header button simplification

- Changed the Report root header and persistent diary detail header Diary Book control from an icon-and-text pill to an icon-only `44x44` book button.
- Preserved the existing localized `report_view_diary_book` label as the button `aria-label` / `title`, so discoverability stays intact while avoiding multilingual width pressure in the top bar.

## 2026-07-24 - Chat reclassify ongoing-state repair

- Fixed the latest activity-card -> mood-card correction path so the adjacent previous activity is fully restored to ongoing (`duration=null` + `isActive=true`) instead of keeping a half-closed state that hid the timer and end button.
- The converted mood card now explicitly drops active state, and reclassify persistence now writes `messages.is_active` plus `messages.detached` together with the existing `is_mood/activity_type/duration` fields.
- `useChatStore.reclassifyRecentInput()` now refreshes the affected `dateCache` buckets at the same time as in-memory `messages`, preventing date switches, hydration, or reloads from reviving the broken intermediate state.
- Regression coverage now checks ongoing-state repair, cache repair, and cloud persistence fields for latest activity/mood conversion.

## 2026-07-23 - Cross-device routine reminder response receipts

- Added `reminder_responses` schema, authenticated RLS policies, Realtime publication setup, and minimum-schema verification.
- Added occurrence-level reminder identity (`local date + type + scheduled time`) so same-day schedule edits create a distinct reminder instead of inheriting an old confirmation.
- Reminder confirmations, manual replacements, and evening actions now write an idempotent cloud receipt; failed writes enter the existing scoped outbox.
- App startup/scheduling, foreground recovery, network recovery, and Supabase Realtime now merge current-day receipts before showing grace-window popups or rebuilding local notification queues.
- Matching cloud receipts close the active in-app popup/quick picker and cancel pending or delivered local notifications where Capacitor and the OS permit.
- No user-visible copy or translation source changed.

All notable effective changes are documented here.

> Note: 仅保留近期变更；更早且已收口记录已归档清理，避免维护噪音。

## 2026-07-24

### Fix: AI todo suggestions now keep copy and target on the same todo

- Suggestion-mode annotation requests no longer reuse the plain annotation companion system prompt. They now use a dedicated suggestion system prompt that keeps the same companion voice while requiring one JSON-only actionable payload.
- Forced suggestion fallback no longer keeps model freeform copy while swapping in a different fallback todo target. When fallback is needed, the server now returns one whole payload (`content`, `actionLabel`, and target fields) from the same source.
- Todo suggestions now use `todoId` as the only hard target locator, then rewrite `todoTitle` from the canonical pending-todo row before returning the payload.
- Allow-suggestion mode no longer swaps in a different fallback todo when a suggested todo target is invalid; it now degrades to plain annotation output instead of manufacturing a new button target.
- DeepSeek suggestion calls now also request JSON-object output at the transport layer in addition to prompt-level guidance; OpenAI/Gemini paths keep the existing prompt/schema validation and whole-payload fallback behavior.
- Growth-page jump/highlight behavior is unchanged on the client side; the fix removes the server-side mixed-source payloads that previously caused the wrong todo to be highlighted.

Validation:

- `npx vitest run src/server/annotation-handler.test.ts src/server/annotation-prompts.user.test.ts`
- `npx tsc --noEmit`

### Fix: Magic Pen keeps multilingual complex input intact

- Complex Magic Pen requests now default to Qwen `qwen-plus` through the existing DashScope endpoint and fall back to Zhipu `glm-4.7-flash`; no provider or Serverless function was added.
- Parseable JSON must also pass semantic quality checks for non-empty extraction, total/recognized original-text coverage, explicit time-anchor preservation, and minimum splitting of complex multi-clause input.
- Low-quality output triggers the second provider instead of being reported as success. When all providers fail, the response returns the complete submitted text in `unparsed` rather than a fixed Chinese failure placeholder.
- Frontend preprocessing no longer slices input at 500 characters. Remote failure invokes the existing safe local parser and preserves any unrecovered original text in the existing localized review surface.
- The remote-failure parser now uses one conservative ZH/EN/IT semantic pipeline instead of Chinese substring rules plus an all-or-nothing non-Chinese branch. It separates clauses, reuses shared activity/mood lexicons, and distinguishes realtime, past, future, intent, wish, negation, and cross-day evidence.
- Todo recovery now requires both a plan/duty/time signal and recognizable action evidence. Chinese `得` only acts as duty in an action context, so phrases such as `工作得有点烦了` and `觉得累` cannot become todos; ambiguous wishes remain unparsed.
- English and Italian mixed notes can recover explicit current activity/mood, future todos, and past activity backfills locally while vague phrases such as `maybe later` remain untouched.
- High-confidence realtime auto-write rules are unchanged; uncertain content remains review-only.
- No user-visible static copy or translation source changed.

Validation:

- `npx vitest run src/services/input/magicPenParserLocalFallback.test.ts src/services/input/magicPenParser.remoteFallback.test.ts src/services/input/magicPenTodoSalvage.test.ts src/server/magic-pen-quality.test.ts src/server/magic-pen-parse.test.ts --exclude '.claude/**'` (30 passed)
- `npm run lint:all`
- `npm run lint:state-consistency`
- `npm run build`
- `git diff --check`
- `npx vitest run --exclude '.claude/**'` (781 passed, 14 pre-existing failures: timezone-sensitive Magic Pen period assertions plus unrelated companion prompt, DB mapper, chat persistence/mood, reminder, and annotation tests)
- `npm run test:unit` also scans stale `.claude/worktrees` copies and therefore duplicates their outdated Magic Pen/provider assertions and other historical failures.

### Style: Report eco-sphere charts use one 140px footprint

- Activity and mood eco-sphere charts above the Report soil are reduced from `150px` to `140px`.
- Empty transparent bubbles now use the same `140px` dimensions instead of the former `80px`, so empty and populated states occupy the same visible footprint.
- Motion bounds, collision separation, ring radii, and label size follow the shared bubble dimension; data logic, colors, and movement behavior are unchanged.

### Fix: Observation diaries finish their final sentence and detail analysis shows in full

- Full `/api/diary` generation no longer slices Chinese at 260 characters or English/Italian at 170 words after generation.
- The prompt now treats length as a soft 2-4 paragraph target. A provider token stop or missing final punctuation triggers one concise regeneration; if that result is still incomplete, the API returns an error instead of persisting a dangling sentence.
- Diary detail removes the two-line clamp from activity, mood, todo, and habit analysis. Each section has a stable minimum height, and the first page scrolls vertically on shorter screens.
- Todo completion such as `7/14` and habit star count remain separate subdued statistic lines below their complete analysis text.
- Existing generated diary storage remains `reports.ai_analysis`; no historical observation was rewritten and no new static user-visible translation was added.

Validation:

- `npx vitest run src/server/diary-body-integrity.test.ts src/features/report/reportObservation.test.ts src/store/reportRecordResolver.test.ts` (11 passed)
- `npm run lint:all`
- `npm run lint:state-consistency`
- `npm run build`
- `git diff --check`
- Browser verification: July 23 detail shows the complete activity/mood/todo/habit analysis without a line clamp, keeps `7/14` and `0 颗星` as separate statistic lines, and emits no console errors.

### Fix: Generated observation diaries remain immutable across startup and navigation

- Startup yesterday-repair now checks the report before and after message loading and never rebuilds a report that already has `aiAnalysis` or `teaserText`.
- `generateReport()` returns an existing generated report unchanged, and `updateReport()` preserves its stored full/teaser diary plus frozen first-page snapshot when a later sparse or conflicting update arrives.
- Persist hydration, cloud fetch, Supabase Realtime, Report navigation, and Diary Book page construction now share one same-day report resolver. Generated records beat placeholders; duplicate generated records with snapshots select the earliest frozen generation deterministically.
- Diary Book and Report detail now share the same observation-text resolver, companion-aware existing loading key, and existing localized fallback source, so temporary state cannot select two unrelated default paragraphs.
- Existing cloud rows are not deleted. The client deterministically ignores non-preferred duplicates, avoiding destructive cleanup while preventing view-to-view switching.
- Storage remains `reports.ai_analysis` / `reports.teaser_text`; no new user-visible copy or machine translation was added.

Validation:

- `npx vitest run src/store/reportRecordResolver.test.ts src/store/useReportStore.test.ts src/features/report/reportObservation.test.ts src/features/report/reportPageHelpers.test.ts src/features/report/reportPage.integration.test.tsx src/store/reportDiarySnapshot.test.ts src/hooks/useRealtimeSync.test.ts --exclude '.claude/**'` (23 passed)
- `npm run lint:all`
- `npm run lint:state-consistency`
- `npm run build`
- `git diff --check`
- Browser verification: after an 8-second post-reload startup cycle, the July 23 Diary Book observation remained byte-for-byte identical; double-opening detail produced the same 275-character AI body, with no page console errors.

### Fix: Diary todo and habit insights keep complete phrases

- `/api/diary` short insights no longer apply an unconditional 20-character slice to every language. English and Italian are compacted at whole-word boundaries to at most eight words; Chinese keeps its 20-character card budget with sentence punctuation.
- Daily first-page snapshots now write version 2 and share the same compaction rule as the server, preventing a second frontend hard cut.
- Existing version-1 snapshots upgrade once using only their frozen todo/habit counts. Successful upgrades replace legacy clipped summaries and remain immutable afterward.
- Diary detail gives the summary up to two lines while keeping completion/star counts on a separate compact line; Diary Book also preserves normal word boundaries inside its two-line area.
- Storage remains `reports.stats.diaryPageSnapshot`; short insights remain AI-generated in the selected ZH/EN/IT language. No new static user-visible copy or machine-translated copy was added.

Validation:

- `npx vitest run src/lib/diaryInsightText.test.ts src/store/reportDiarySnapshot.test.ts src/features/report/reportPage.integration.test.tsx --exclude '.claude/**'` (10 passed)
- `npm run lint:all`
- `npm run lint:state-consistency`
- `npm run build`
- `git diff --check`
- Browser verification: July 23 Diary detail shows complete todo/habit summary phrases with their `7/14` and star count on separate lines; no page console errors were emitted.

### Fix: Diary header parity, long-press card save, and plant preloading

- The persistent detail header now matches the original Report controls exactly: Calendar is `44x44`, Diary Book is a `44px`-high icon-and-text button, and the title shifts left only on narrow viewports to prevent overlap.
- A stationary 650ms long press on the card-only popup saves/shares the currently visible side through the existing export path, provides haptic confirmation, and suppresses the subsequent click so the card does not also flip.
- Historical plant state now lives in `usePlantStore` as one account-scoped date cache shared by Diary detail and Diary Book. Month requests are deduplicated and awaited before the viewer opens, while background reconciliation preserves already-rendered plants.
- Cross-midnight stale `todayPlant` records are excluded from the current-day fast path, preventing an older local record from replacing a complete historical cloud snapshot.
- Successful diary generation now stores an immutable `stats.diaryPageSnapshot` with activity/mood chart inputs, todo/habit counts, and all four analysis strings. Both diary surfaces read the same snapshot and no longer regenerate short insights or recalculate the first page from later activity, mood, todo, or habit changes.
- Existing generated diaries build and persist one deterministic compatibility snapshot from their already-stored report stats; the previously generated transient todo/habit wording was never stored and therefore cannot be reconstructed.
- No user-visible copy or translation source changed.

Validation:

- `npx vitest run src/store/reportDiarySnapshot.test.ts src/store/usePlantStore.history.test.ts src/store/usePlantStore.test.ts src/store/usePlantStore.direction-sync.test.ts src/features/report/reportPageHelpers.test.ts src/features/report/reportPage.integration.test.tsx --exclude '.claude/**'` (18 passed)
- `npm run lint:all`
- `npm run lint:state-consistency`
- `npm run build`
- Browser verification: original header controls measure `44x44` and `108x44`; after closing and reopening July Diary Book, the July 23 plant is complete in the first visible viewer state; Diary detail and viewer show the same frozen first-page analysis before and after waiting; normal card tap still flips to the complete frozen root back.

## 2026-07-23

### Fix: Generated diary becomes the stable report landing page

- A generated today diary or free teaser is selected during `ReportPage`'s first render, eliminating the plant-card frame that previously appeared before the `open-today-diary` effect ran.
- Bottom navigation now always targets `/report`; the report route owns the synchronous choice between its pre-diary plant/root surface and persistent today-detail surface.
- Starting diary generation enters detail page 2 immediately and stays under user-controlled two-page swiping; the former two-second automatic slide is removed.
- Persistent today detail renders inside the report page frame so bottom navigation remains reachable, and its centered header retains both Calendar and Diary Book controls instead of exposing a close path back to the plant surface.
- The Calendar overlay now renders independently of the pre-diary plant-page branch, allowing the restored detail-header control to open the same historical-date flow.
- Tapping the detail plant image opens only the frozen flippable card centered over the backdrop; the full-sheet shell and save action are omitted in this context, while card close, flip, frozen roots, and backdrop return remain unchanged.

Validation:

- `npx vitest run src/features/report/reportPageHelpers.test.ts src/features/report/reportPage.integration.test.tsx --exclude '.claude/**'`
- `npm run lint:all`
- `npm run lint:state-consistency`
- `npm run build`
- `git diff --check`

### Fix: Generated plant cards now honor their irreversible snapshot

- The localized plant registry name and date now sit together at the center of the front card's bottom metadata row with a compact gap and the same subdued styling; saved front-card exports use the same layout, and the former external line is removed.
- Report plant generation now opens the existing translated irreversible confirmation for both the page button and evening-reminder deep link before any API request starts.
- `/api/plant-generate` persists a root snapshot in the existing `daily_plant_records.root_metrics` JSONB value, including deterministic root segments, direction order, and activity detail fields used by the card back.
- Generated cards read only the saved snapshot, so later activity edits/deletes and direction-setting changes do not alter an existing card on the same or another device.
- Existing records without a snapshot use `action: snapshot_existing` on the same endpoint to freeze their current cloud reconstruction when first opened; no new Serverless function or SQL migration is required.
- Plus plant observation prompts now target 24-40 Chinese characters or 14-22 English/Italian words with a 140-character ceiling. Oversized AI output retries and then falls back; historical long copy uses a complete-sentence-first compact renderer without changing the stored original.
- No new user-visible copy or machine translation was added; confirmation reuses `plant_generate_confirm`, `confirm`, and `cancel`.

Validation:

- `npx vitest run src/lib/plantDiaryText.test.ts src/lib/plantRootSnapshot.test.ts src/lib/dbPlantSnapshot.test.ts src/lib/rootRenderer.test.ts src/features/report/plant/plantGenerateUi.test.ts --exclude '.claude/**'` (20 passed)
- `npx tsc --noEmit`
- Full unit run excluding `.claude/**`: 735 passed, 15 unrelated existing failures; focused plant tests pass.

### Fix: Mood foreign-key retries stop after verified parent cleanup

- `src/store/chatTimelineActions.ts` now removes matching local mood maps, mood outbox entries, and cloud mood rows when an activity/message is deleted.
- `src/store/moodRelationshipHelpers.ts` separates cloud-backed mood parents, unresolved local/offline parents, and verified orphans. Standalone `messages.is_mood` records and historical cloud messages remain valid parents.
- `src/store/authDataSyncHelpers.ts` uploads only moods whose parent is confirmed in cloud; a mood is pruned only after a complete cloud check also confirms the parent is absent locally and remotely.
- `src/store/useOutboxStore.ts` performs the same conservative parent check before mood retries, removing only verified orphan retries instead of repeatedly sending a permanent `23503` foreign-key conflict.
- Focused tests cover deleted-message cleanup, standalone moods, historical cloud parents, offline unresolved parents, complete/incomplete verification, and targeted outbox cleanup.
- No database schema or user-visible copy changed.

Validation:

- `npx vitest run --exclude '.claude/**' src/store/moodRelationshipHelpers.test.ts src/store/useMoodStore.test.ts src/store/useOutboxStore.test.ts` (21 passed)
- `npx vitest run --exclude '.claude/**' src/store/useChatStore.integration.test.ts -t "removes a deleted activity from messages and every date cache bucket"` (1 passed)
- `npm run lint:all`
- `npm run lint:state-consistency`
- `npm run build`
- `git diff --check`
- Full unit run excluding `.claude/**`: 728 passed, 15 unrelated existing failures; focused tests for this fix pass.

### Fix: Undoing a completed todo removes its generated activity cache

- `src/store/chatTimelineActions.ts`: `deleteActivity()` now removes the message from both the active timeline and every persisted `dateCache` bucket in the same state update, while continuing to clear pending manual-end state, bottle rewards, annotations, and the cloud row.
- `src/store/useChatStore.integration.test.ts`: adds a regression covering deletion from the active message list, multiple date-cache buckets, and pending manual-end state.
- No store contract or user-visible copy changed.

Validation:

- `npx vitest run --dir src src/store/useChatStore.integration.test.ts -t "removes a deleted activity from messages and every date cache bucket"`
- `npm run lint:all`
- `npm run lint:state-consistency`
- `npm run build`
- `git diff --check`
- Full `useChatStore.integration.test.ts` run still has an unrelated existing mood assertion mismatch (`down` expected, `calm` received); the new deletion regression passes independently.

### Fix: Growth todo compact-card touch accuracy

- `src/features/growth/GrowthTodoCard.tsx`: keeps the compact card and whole-card detail expansion while separating visual icon size from touch size. Completion, start, and focus now use 44px touch targets; the right action cluster absorbs near-miss taps instead of expanding details; pointer-origin tracking prevents a press that begins on an action and drifts outside from toggling the card.
- No user-visible copy, store contract, or todo action behavior changed.

Validation:

- `npm run lint:secrets`
- `npm run lint:max-lines`
- `npm run lint:docs-sync`
- `npm run lint:state-consistency`
- `npx tsc --noEmit`
- `npm run build`
- `git diff --check`
- Browser smoke check reached the local app successfully; authenticated Growth-page interaction remains for iOS/device verification.

## 2026-07-20

### Fix: IAP transaction listener avoids Swift 6 captured-self warning

- `ios/App/App/SeedayIAPPlugin.swift`: changes the StoreKit transaction update listener from `Task.detached` plus nested `MainActor.run` self capture to a background-priority `Task` that calls a `@MainActor` notification helper, removing the Xcode Swift concurrency warning without changing purchase, restore, or transaction payload behavior.

Validation:

- `npm run lint:docs-sync`
- `git diff --check`
- Xcode command-line build was not run because local Xcode cache/simulator access requires approval; verify once in Xcode after this patch.

### Refactor: Split Todo store sync helpers out of the main store file

- Added `src/store/todoStoreSync.ts` for background todo sync, pending-delete retention, cascade-delete cleanup, and Plus todo-category refinement helpers.
- `src/store/useTodoStore.ts` now imports those helpers and stays under the hard max-lines pre-commit limit without changing persisted state, public store actions, or todo behavior.

Validation:

- `npm run lint:max-lines`
- `npx tsc --noEmit`

### Fix: Growth todo delete no longer resurrects during refresh or late realtime sync

- `src/store/useTodoStore.ts` now preserves `pendingDeletedTodoIds` that are still backed by a queued `todo.delete` outbox entry, and `fetchTodos()` re-reads the latest tombstones before committing merged cloud state so a delete that happens during an in-flight fetch cannot be overwritten by a stale refresh result.
- `src/hooks/useRealtimeSync.ts` now ignores late todo `INSERT` events and strips late non-delete `UPDATE` events for tombstoned todo IDs, preventing deleted tasks from reappearing immediately or after foreground refresh/reconnect.
- `src/store/useTodoStore.test.ts` and `src/hooks/useRealtimeSync.test.ts` add focused regressions for stale-fetch resurrection, retained queued tombstones, and late realtime todo events.

Validation:

- `npx vitest run src/store/useTodoStore.test.ts src/hooks/useRealtimeSync.test.ts`
- `npx tsc --noEmit`

### Improve: English activity and mood grammar evidence

- Expanded the existing MIT `compromise` integration and narrowed runtime import to `compromise/two`. English classification now uses POS/root grammar for phrasal verbs, movement destinations, action objects, short location phrases, 1-4 token noun/title input, mental-state relationships, contracted future, and broad negation.
- Added exact local history evidence from the latest 50 non-mood activity messages. Matching is normalized and exact only; it does not add persistence, fuzzy entity lookup, or a fourth classification result.
- Added dedicated regressions for `go to school`, `Disneyland`, movie titles, mental association, contractions, history precedence, and mood phrase guards. The PR0 live-intent fixture grew from 18 to 26 cases and currently reports 26/26 with no mismatches.

Validation:

- `npm run eval:classification:pr0`
- `npx vitest run src/services/input/liveInputClassifier.i18n.test.ts src/services/input/liveInputContext.test.ts`

### Fix: TestFlight IAP activation falls through to Apple Sandbox

- `api/subscription.ts` now queries Apple's current StoreKit API domains and generates a fresh ES256 JWT for each upstream request. A Production `401` or `404` now continues to the Sandbox lookup, covering TestFlight/Sandbox transaction IDs that Apple may reject with `401` on the Production endpoint.
- `api/subscription.test.ts` adds a regression case for Production `401` followed by a successful Sandbox transaction response. The StoreKit purchase bridge, product IDs, and frontend activation payload are unchanged.

Validation:

- `npx vitest run api/subscription.test.ts`
- `npm run lint:all`

### Fix: Password changes verify the old password first

- `src/features/profile/components/ChangePasswordPanel.tsx`: email-password users must enter their existing password before `supabase.auth.updateUser({ password })` runs; the check reuses Supabase `signInWithPassword` against the current account email and existing i18n password/error keys.
- `src/features/profile/README.md` documents the current password-change behavior. Password setup for non-email identity accounts is unchanged.

Validation:

- `npx tsc --noEmit`

### UI: Soften Growth todo card shadow

- `src/features/growth/GrowthTodoCard.tsx`: lightens the todo-card ambient shadow and shifts it slightly toward green, reducing the gray bottom shadow while preserving card shape, spacing, and interactions.
- `src/features/growth/GrowthTodoCard.tsx`: enlarges the left completion checkbox from 16px to 20px with a finer 1.5px stroke, and increases the right-side priority/start/focus visuals with slightly wider spacing.
- `src/features/growth/README.md` documents the current shadow treatment.

Validation:

- `npx tsc --noEmit`

### UI: Tune Report soil and diary donut sizes

- `src/features/report/plant/PlantRootSection.tsx`: extends the root-page soil image vertically by moving the soil canvas top offset from 130px to 106px while keeping the eco-sphere layer separate.
- `src/features/report/plant/PlantRootSection.tsx`: increases the root-page canvas clamp from `300px/calc(100% - 136px)/520px` to `320px/calc(100% - 120px)/540px`, giving the soil/root area more vertical room while slightly reducing first-view space below it.
- `src/features/report/ReportDetailModal.tsx`: renders the diary activity and mood donut charts at 0.9x of their previous size. Root-page eco-sphere charts stay unchanged.
- `src/features/report/README.md` documents the updated Report visual sizing.

Validation:

- `npx tsc --noEmit`

### Fix: Annotation outbox retries are idempotent

- `src/store/useOutboxStore.ts`: changed `annotation.insert` retry writes from `insert` to `upsert(onConflict: id)`, so an annotation already present in Supabase is treated as successfully synced instead of surfacing a persistent `annotations_pkey` 409 conflict.
- `src/store/useOutboxStore.test.ts` covers the retry contract, and `src/store/README.md` documents the idempotent annotation outbox behavior.

Validation:

- `npx vitest run --dir src src/store/useOutboxStore.test.ts`
- `npx tsc --noEmit`

### Fix: Auth avatar state now hydrates more consistently across login and refresh

- `src/store/authStoreAccountActions.ts` now applies avatar changes optimistically before upload completes, persists the final storage URL to both `user_profiles.avatar_url` and Auth metadata `avatar_url`, and merges the latest returned user snapshot instead of rewriting a stale captured `currentUser` object.
- `src/store/useAuthStore.ts` and `src/store/authProfileCloudStore.ts` now keep a user-scoped local avatar URL cache and use it during auth bootstrap / `SIGNED_IN` snapshots so the UI can render the latest known avatar before the background `user_profiles` fetch finishes.
- `src/lib/authMetadataSanitizer.ts`, `src/lib/authMetadataSanitizer.test.ts`, and `src/store/authProfileCloudStore.test.ts` now allow normal avatar URLs to stay in JWT-safe metadata while still stripping data URLs, and add focused regression coverage for cached-avatar reuse.

## 2026-07-19

### Fix: Chat image replacement no longer revives deleted photos

- `src/hooks/useImageUpload.ts`, `src/lib/chatImageStorage.ts`, and `src/store/useOutboxStore.ts` now give every new chat-card image upload its own storage object path instead of reusing one fixed slot URL, while still recognizing legacy fixed-path URLs during deletion and reupload fallback.
- `src/store/chatTimelineActions.ts` now treats chat image field changes like other durable chat edits: public-URL writes and null clears mark the message pending, sync through `chat.upsert`, and only flip back to `synced` after cloud success; local data-URL fallbacks stay local-pending until the existing `image.reupload` path replaces them with a storage URL.
- `src/store/useChatStore.integration.test.ts`, `src/lib/chatImageStorage.test.ts`, and `src/store/README.md` add regression/documentation coverage for unique storage paths, offline image-field durability, and the delete-then-reupload cache-resurrection fix.

### Fix: Growth parent todo deletes now cascade through subtasks

- `src/store/useTodoStore.ts` now deletes parent todos together with every descendant subtask, reuses the durable `todo.delete` fallback for the full cascade, and removes related completion/reward/message artifacts in one pass so deleting a parent task cannot leave hidden child rows behind.
- `src/store/useTodoStore.ts` `fetchTodos()` no longer clears orphaned `parentId` values and accidentally promotes old subtasks into top-level tasks after refresh; it now detects orphan subtrees, removes them locally, and queues soft-delete retries for cloud cleanup.
- `src/store/useTodoStore.test.ts` and `src/store/README.md` now cover/document both the parent-delete cascade and the orphan-subtask fetch cleanup path.

### Change: Unified account-state table now drives onboarding gating

- Added `src/types/userAccountState.ts`, `src/store/authAccountStateHelpers.ts`, and `src/store/authAccountStateCloudStore.ts` plus the `public.user_account_state` SQL scripts so account lifecycle state has a dedicated cloud model instead of spreading onboarding and plan snapshots across profile JSON, metadata aliases, and local flags.
- `src/store/useAuthStore.ts`, `src/store/authStoreAccountActions.ts`, and `src/App.tsx` now hydrate/maintain `accountState`, ensure a cloud row exists for signed-in users, and route `/onboarding` from `accountState.onboardingStatus` with local-first pending fallback; local completed/skipped onboarding can temporarily outrank older cloud required/in-progress state until sync succeeds.
- `src/features/onboarding/OnboardingFlow.tsx` now writes onboarding progress/completion into the unified account-state path, and `api/subscription.ts` mirrors trial/plan updates into `user_account_state.plan_*` so OAuth signup, onboarding, and membership snapshots read from one normalized source.

### Fix: Chat activity cards keep distinct first and second images

- `src/features/chat/components/EventCard.tsx`, `src/features/chat/components/MoodCard.tsx`, and `src/features/chat/components/ImageUploader.tsx` now pass an explicit image slot through the upload flow instead of pretending slot 2 is a separate message with a fake `${message.id}_2` identifier.
- `src/hooks/useImageUpload.ts`, `src/store/useOutboxStore.ts`, and new helper `src/lib/chatImageStorage.ts` now generate different storage object paths for `imageUrl` and `imageUrl2`, so a second photo cannot overwrite or reupload through the first slot's path.
- `src/store/chatTimelineActions.ts` now updates both `messages` and `dateCache` when an activity image changes, and regression coverage verifies the second image can be written without disturbing the first.

### UI: Show localized plant names beneath plant artwork

- Generated plant flip cards now show the current plant's localized registry name as a small line beneath the card.
- Diary detail plant photos show the same localized name beneath the image, using the existing ZH/EN/IT plant registry and `plantId` as the shared source.
- Plant generation, artwork resolution, card actions, and diary content are unchanged; `src/lib/plantDisplayName.ts` adds focused name-resolution coverage.

### Fix: Email verification resend is rate-limited in the UI

- `src/features/auth/AuthPage.tsx` and onboarding `StepAuth` now share a 60-second resend cooldown after the initial signup code request and after each successful resend.
- The resend control stays disabled during the cooldown and shows the remaining seconds beside the existing translated resend label; verification and error handling are unchanged.
- `src/features/auth/useResendCodeCooldown.ts` owns the shared timer, with regression coverage for countdown rounding and expiry.

### Fix: Auth initialization no longer retains another account's profile

- `src/store/useAuthStore.ts` now preserves the current in-memory `userProfileV2` only when the previous and incoming authenticated user IDs match across initialization, auth-state events, and background user refreshes.
- `src/store/authProfileHelpers.ts` centralizes the same-user check, with regression coverage proving same-account refreshes keep their fallback while account switches and first sign-ins drop the previous profile.
- OAuth routing, new-user detection, onboarding steps, membership, and user-visible copy are unchanged.

## 2026-07-17

### Fix: Apple IAP purchases activate after StoreKit success

- `api/subscription.ts` now signs App Store Server API ES256 JWTs with IEEE-P1363 encoding instead of Node's default DER encoding, preventing Apple verification authorization from failing after StoreKit has already completed the purchase.
- `api/subscription.test.ts` verifies the ES256 signature is the JWS-required 64 bytes and validates against the generated public key. Product IDs, native purchase flow, and membership UI are unchanged.

### UI: Adapt Report root page height across iPhone screens

- `src/features/report/plant/PlantRootSection.tsx` now sizes the root canvas from the Report content area's real available height using `clamp(300px, calc(100% - 136px), 520px)` instead of global `vh` plus a large fixed minimum.
- The layout reserves enough first-view space for Generate Plant, the My Diary heading, and the complete first placeholder line across iPhone safe-area and bottom-navigation variants; soil/root rendering and action styling are unchanged.

### UI: Enlarge Report eco-sphere donut charts

- `src/features/report/plant/DayEcoSphere.tsx` enlarges the two floating activity/mood donut charts from `100px` to `150px`, scaling their ring geometry and labels by the same 1.5 ratio.
- `src/features/report/plant/useBubbleMotionController.ts` uses the matching `150px` collision and edge bounds so the enlarged charts remain fully visible while floating.

### UI: Remove Diary middle-edge arrows

- `src/features/report/ReportDetailModal.tsx` no longer renders the first-page right-edge `›` or second-page left-edge `‹`. The two-dot page indicator and horizontal swipe behavior are unchanged.
- `src/features/report/README.md` and `docs/CURRENT_TASK.md` now describe the current Diary navigation behavior.

### Fix: Edited routine times re-arm foreground reminders

- `src/hooks/useReminderSystem.ts` now detects actual routine trigger-time changes, re-arms only the changed reminder types, and includes each trigger timestamp in foreground popup dedupe keys. Keeping the app open while editing a schedule no longer leaves the replacement reminder suppressed by the old time.
- `src/services/reminder/reminderActivityActions.ts` adds a 10-second process-level confirmation claim in front of the persisted reminder-store check. Duplicate native callbacks during cold-start hydration can no longer create two activity cards or timing starts.
- `src/store/useReminderStore.ts` exposes targeted reminder re-arming without clearing unrelated confirmations; focused unit coverage verifies the hydration-reset duplicate-callback case.

### UI: Growth todo cards use a denser compact row

- `src/features/growth/GrowthTodoCard.tsx`: reduced the collapsed todo row from roughly 60px to roughly 40px; the checkbox and spacing stay compact while title/due text and right-side priority/start/focus visuals retain their standard sizes.
- Replaced the previous downward-offset shadow with a tighter `6px/3px` ambient shadow around the card. Expanded cards now use a fixed `22px` radius to preserve the compact card's visible curvature instead of enlarging the arc with panel height, and the radius switches immediately without a transition animation; editor controls and the quick-add row are unchanged.
- `src/features/growth/GrowthTodoSection.tsx`: changed the vertical gap between adjacent todo cards from `8px` to `10px`.
- `src/features/growth/GrowthTodoSection.tsx`: added a `700ms` completion hold so the checked state is visible in place before the existing completed-card ordering moves the item.
- `src/features/growth/README.md` and `docs/CURRENT_TASK.md`: synchronized the Growth module behavior and current task anchor.

### Fix: Routine confirmation no longer creates multiple active timers

- `src/services/notifications/localNotificationService.ts` and `src/services/reminder/reminderActivityActions.ts`: native notification listeners are now singleton registrations with replaceable current handlers, and same-day reminder confirmation is marked synchronously before async timing/chat work so duplicate callbacks cannot create duplicate records.
- `src/store/useChatStore.ts`, `src/store/chatActions.ts`, and `src/store/useChatStore.types.ts`: reminder-generated activity records can preserve the timing session explicitly started by the reminder instead of immediately ending it through the normal manual-input rule.
- `src/store/chatDayBoundary.ts`, `src/store/chatPersistenceHelpers.ts`, `src/services/timing/timingSessionService.ts`, and `src/store/useTimingStore.ts`: cold-start hydration now self-heals existing duplicate active cards and timing sessions, closing all stale records at the newest record's start time and keeping only the newest active.
- Added regression coverage for singleton notification listeners, three concurrent confirmation callbacks, duplicate activity-card reconciliation, and duplicate timing-session reconciliation.

Validation:

- `npm run test:unit -- src/services/reminder/reminderActivityActions.test.ts src/services/notifications/localNotificationService.test.ts src/services/timing/timingSessionService.test.ts src/store/chatDayBoundary.test.ts src/store/chatActions.test.ts`
- `npm run lint:all`
- `npm run lint:state-consistency`
- `npm run build`
- Full `npm run test:unit` was attempted; unrelated existing failures remain in Magic Pen timezone/prompt snapshots, outbox/suggestion-flow tests, persistence ordering, and duplicate test discovery under `.claude/worktrees`.

## 2026-07-16

### Change: Todo deletes no longer trigger AI annotation bubbles

- `src/store/useTodoStore.ts`: removed the delete-path annotation dispatch, so deleting one-time or recurring todos now only updates local state and durable cloud-delete fallback.
- `src/types/annotation.ts`, `src/store/annotationHelpers.ts`, and `src/server/annotation-prompts.defaults.ts`: pruned the obsolete `task_deleted` event type, its probability weights, and its default fallback annotation copy to fully remove the trigger condition.
- `src/store/useTodoStore.test.ts` and `src/store/README.md`: added regression coverage and synced the store documentation to assert todo deletes no longer call `triggerAnnotation()`.

Validation:

- `npm run test:unit -- src/store/useTodoStore.test.ts`
- `npx tsc --noEmit`

### Change: Ordinary activity/mood input is now strict three-way

- `src/services/input/*` and `src/store/chatActions.ts`: removed the legacy mixed local classification and its dedicated write branch; every ordinary input now resolves to `new_activity`, `standalone_mood`, or `mood_about_last_activity`.
- `src/features/chat/chatPageActions.ts`: kept the Magic Pen local fast path for clear single-intent text, but moved mixed activity+mood evidence ahead of short-text handling so mixed content uses the AI parser; Magic Pen's four segment kinds remain unchanged.
- Added the MIT-licensed `compromise` dependency and an English linguistic adapter for phrasal-verb evidence, including `get up / got up / getting up / gets up / wake up / woke up`; place evidence remains explicit for English and Italian.
- Updated classifier/store/Magic Pen regressions, benchmark fixtures, telemetry schema, current-state and product specs, module READMEs, lexicon docs, telemetry audit, and the expanded `PROJECT_MAP` document map.

Validation:

- Targeted classifier/store/Magic Pen regression: 300/300 passed.
- `npm run eval:classification:pr0`: all four sections 100%, no mismatches.
- `npm run lint:all`
- `npm run lint:state-consistency`
- `npm run build`
- Full `npm run test:unit` was also attempted; 15 unrelated existing/environment-sensitive assertions remain in Magic Pen time-zone tests, AI prompt snapshots, Todo ordering, persistence order, and suggestion flow.

### Fix: One-time todo deletes no longer resurrect after missed cloud sync

- `src/store/useTodoStore.ts`: tightened todo soft-delete confirmation so delete requests only count as successful when Supabase returns the affected row, and now queue a durable `todo.delete` outbox retry whenever the immediate cloud delete cannot be confirmed.
- `src/store/useOutboxStore.ts`, `src/store/useOutboxStore.test.ts`, and `src/store/useTodoStore.test.ts`: added a dedicated todo-delete outbox executor plus regression coverage for offline/no-session delete fallback and retry flushing.
- `src/store/README.md` and `docs/CURRENT_TASK.md`: synced the store-layer note and session anchor for the todo delete resurrection fix.

Validation:

- `npm run test:unit -- src/store/useOutboxStore.test.ts src/store/useTodoStore.test.ts`
- `npx tsc --noEmit`

## 2026-07-15

### Fix: New-user Growth goal popup no longer bounces back into onboarding

- `src/App.tsx` and `src/store/authProfileHelpers.ts`: onboarding route guards now use sticky completion evidence instead of treating a transient `userProfileV2 === null` as "unfinished onboarding"; completion can come from the cloud profile, pending local profile, or a user-scoped local completion marker written at onboarding finish.
- `src/store/useAuthStore.ts`: `applyUserSnapshot()` now preserves an already-known profile while Auth metadata refreshes catch up, so metadata-only refreshes and foreground session refreshes no longer wipe `userProfileV2` and trigger `/onboarding` redirects.
- `src/features/onboarding/OnboardingFlow.tsx`, `src/store/useGrowthStore.ts`, `src/features/growth/GrowthPage.tsx`, `src/store/authStoreRuntimeHelpers.ts`, `src/features/growth/README.md`, and `src/store/README.md`: onboarding completion now writes the user-scoped local fallback flag, and Growth's daily-goal popup now records "evaluated today" in persisted Growth state instead of volatile `sessionStorage`, preventing repeated popup evaluation and the follow-on routing flash after iOS foreground restores.

Validation:

- `npx tsc --noEmit`

### Fix: Report calendar disabled dates keep the original transparent surface

- Scoped an override to `report-calendar-frost` so `react-calendar` no longer paints today/future disabled date buttons with its default gray-white background.
- Kept the date restriction, selected-date styling, calendar markers, and shared glass button base unchanged.

### Fix: Diary Book no longer opens on accidental future blank pages

- `src/features/report/ReportPage.tsx`: blocked today/future daily calendar cells from opening or generating reports, and disabled those cells in the calendar UI.
- `src/features/report/reportPageHelpers.ts`: added shared helpers to ignore future daily reports and prefer the latest non-future report with real diary signals when choosing the Diary Book initial page.
- Added regression coverage in `src/features/report/reportPageHelpers.test.ts` for future-date blocking and Diary Book initial-target selection.

Validation:

- `npm run test:unit -- src/features/report/reportPageHelpers.test.ts`
- `npx tsc --noEmit`

### UI: Distinct goal bottle artwork

- Added `bottle_goal.png` as the dedicated bottle shell for Growth bottles whose type is `goal`.
- Kept habit bottle artwork and the existing star image, count, and scattered layout unchanged.

### UI: Refined bottle carousel indicator

- Replaced the browser's native horizontal scrollbar with a compact, translucent rounded progress indicator.
- The indicator appears while scrolling, tracks carousel progress, and fades after 650ms without changing native touch scrolling.

### UX: Diary detail page indicator and page controls

- Added a shared `ReportDetailPageHeader` for both diary detail pages.
- Added a two-dot page indicator below the date divider, with the active page shown as a filled dot.
- Replaced surfaced page controls with 35%-opacity `›` / `‹` edge hints, vertically centered on the right/left side of each page.
- Enlarged both edge hints to `32px` while preserving their position, opacity, and transparent surface.
- Added a one-time 6px leftward entry motion and rebound for the first page and its arrow while preserving horizontal swipe, back/close, and adjacent-date navigation behavior.

Validation:

- `npm run lint:all`
- `npm run lint:state-consistency`
- `npm run build`
- Browser interaction check at narrow and wide viewports.

## 2026-07-14

### Fix: Responsive soil and root alignment

- `PlantRootSection.tsx`: aligned the soil canvas to the report title's 16px horizontal gutter.
- `SoilCanvas.tsx`, `soilCanvasViewport.ts`, and `RootSystem.tsx`: preserve the root system's original `360 x 520` aspect ratio and responsively anchor its origin to the soil surface instead of stretching it across wide screens.
- `rootRenderer.ts`: exposed the existing root-canvas dimensions and soil anchor as shared constants; root generation angles, lengths, and activity data are unchanged.
- Added viewport regression coverage for mobile and wide-screen root anchoring.

Validation:

- `npm run test:unit -- src/features/report/plant/soilCanvasViewport.test.ts`
- `npm run lint:all`
- `npm run build`

### Fix: Growth page runtime error from missing timing-store import

- `src/hooks/useReminderSystem.ts`: restored the missing `useTimingStore` import used by the existing today-session loading effect, preventing Safari from throwing `Can't find variable: useTimingStore` during app render.
- No reminder behavior or UI styling changed.

Validation:

- `npx tsc --noEmit`
- `npm run build`

## 2026-07-13

### Fix: Chat manual time edit now distinguishes start-only vs manual end

- `src/features/chat/ChatPage.tsx`: the edit modal now tracks whether an ongoing card's end time was actually touched; ongoing cards open with end time defaulted to the current moment, and if the user only shifts the start time save still keeps the activity ongoing.
- `src/store/chatTimelineActions.ts`, `src/store/useChatStore.types.ts`, and `src/store/README.md`: `updateActivity()` now supports keeping an edited activity ongoing, but if the user explicitly edits the end time it immediately persists `duration` plus `is_active=false`, and syncs `dateCache` so the next activity no longer re-closes that card.
- `src/store/useChatStore.integration.test.ts` and `docs/CURRENT_TASK.md`: added regression coverage for start-only edits, manual end edits, and cloud closed-state persistence; synced the session anchor.

Validation:

- `npm.cmd run test:unit -- src/store/useChatStore.integration.test.ts`
- `npx.cmd tsc --noEmit`

### Fix: Overlapping active activity timers across reminder and manual entry flows

- `src/store/chatActions.ts`, `src/store/useChatStore.ts`, and `src/store/chatTimelineActions.ts`: new activity creation now closes every ongoing activity instead of only the latest record, and manual timeline insert/edit now rejects ranges that overlap an ongoing activity to stop the timeline from entering a double-active state.
- `src/services/reminder/reminderActivityActions.ts`, `src/hooks/useReminderSystem.ts`, `src/components/ReminderPopup.tsx`, `src/components/QuickActivityPicker.tsx`, and `src/store/useReminderStore.ts`: reminder confirm, cold-start replay, popup custom input, and deny-to-picker recovery now share one timing+chat action flow so reminder timing sessions and chat activity cards stay aligned.
- `src/store/useChatStore.integration.test.ts`, `src/services/reminder/reminderActivityActions.test.ts`, and `src/store/README.md`: added regression coverage for multi-ongoing closure, timeline overlap guards, reminder manual-input timing sync, and updated store-layer notes.

Validation:

- `npm.cmd run test:unit -- src/store/useChatStore.integration.test.ts src/services/reminder/reminderActivityActions.test.ts`
- `npx.cmd tsc --noEmit`

### Fix: Report bottom-nav diary re-entry and post-generate auto-return

- `src/components/layout/BottomNav.tsx`: the report tab now checks whether today's AI diary already exists and deep-links to `/report?action=open-today-diary` when it does, while keeping the old `/report` root/plant landing path for pre-diary states.
- `src/features/report/ReportPage.tsx`: added a dedicated today-diary open path so report entry can open today's detail modal on page 1, while the plant CTA still opens page 2 and marks the session for one-shot post-generation auto-return behavior.
- `src/features/report/ReportDetailModal.tsx`: after a plant-CTA diary generation completes and the modal is still on page 2, the view now waits 2 seconds and auto-slides back to page 1; manual page changes during that window cancel the auto-slide.
- `src/features/report/README.md` and `docs/CURRENT_TASK.md`: synced the report-flow documentation for the new diary re-entry and auto-slide behavior.

Validation:

- Not run (UI flow change)

## 2026-07-10

### Fix: Auth signup code-sent feedback visibility

- `src/features/auth/AuthPage.tsx`: replaced the fragile small success text with a stable OTP-stage card that stays visible while `pendingSignUpEmail` exists, shows the target email explicitly, keeps the reminder visible after verify failures, and constrains verification input to 6 digits.
- `src/features/onboarding/OnboardingFlow.tsx`: aligned the duplicated onboarding auth step with the main auth flow by adding the same sent-email card, OTP placeholder, verify CTA, resend action, and 6-digit code gating.
- `docs/CURRENT_TASK.md`: synced the session anchor for the auth OTP reminder fix.

Validation:

- `npx.cmd tsc --noEmit`
- `git diff --check` (blocked by pre-existing trailing whitespace in `src/features/chat/components/ImageUploader.tsx:26`)
## 2026-07-14

### UX: Add Task priority colors match expanded todo cards

- `src/features/growth/growthTodoPriorityStyles.ts`: added the shared selected-state mapping for High pink, Medium yellow, and Low green priority controls.
- `src/features/growth/AddGrowthTodoModal.tsx`, `src/features/growth/GrowthTodoCard.tsx`: switched both priority selectors to the same background, border, shadow, and text-color source; recurrence controls keep their existing blue selected state.
- `src/features/growth/README.md`, `docs/CURRENT_TASK.md`: documented the shared mapping and current state.

Validation:

- `npm run lint:all`
- `npm run lint:state-consistency`
- `npm run build`
- Browser interaction check: High rendered pink, Medium yellow, and Low green in the Add Task modal with matching text colors and shadows.

### UX: Event-card mood conversion follows card activation

- `src/features/chat/components/EventCard.tsx`: changed attached mood-row conversion buttons to use the same `showActionButtons` visibility condition as the camera action, so they appear after the event card is tapped and disappear after an outside tap.
- The conversion handler, button styling, readonly behavior, and latest-record reclassification rules are unchanged.
- `src/features/chat/README.md`, `docs/CURRENT_TASK.md`: documented the interaction rule and session state.

Validation:

- `npm run lint:all`
- `npm run lint:state-consistency`
- `npm run build`
- Browser interaction check: conversion action hidden initially, visible with the camera action after card tap, and hidden again after tapping outside.

## 2026-07-13

### UX: Visual button shells opt into the shared glass base

- `src/index.css`: scoped the shared dual-gradient background, transparent hairline border, outer shadow, and non-frosted default to the explicit `.app-glass-button` class instead of every native button.
- `src/index.css`, `src/lib/modalTheme.ts`: moved the shared background/border/shadow values into `:root` variables so global CSS and React inline consumers use the same source; per-button `--app-glass-*` variables can change hue without changing the shell.
- `src/lib/modalTheme.ts`, `src/lib/moodColor.ts`: connected shared modal actions and mood pills to the explicit visual-shell class while leaving text, image, and unframed triggers untouched.
- `src/features/{chat,growth,report,profile}/README.md`: documented the opt-in visual-shell contract and the exclusion of unframed clickable controls.
- `docs/CURRENT_TASK.md`: synced the session anchor for the app-wide rollout.

Validation:

- `npm run lint:all`
- `npm run lint:state-consistency`
- `npx vitest run src/store/useMoodStore.test.ts` (10 tests passed across discovered worktrees)
- `npm run build`
- Browser audit of `#/chat`, `#/growth`, `#/report`, and `#/profile`; unframed date labels, date cells, and clickable images remained outside the public shell.

### UX: Shared glass button base now uses dynamic dual gradients without frosting

- `src/lib/modalTheme.ts`: removed the white inset highlight and `backdrop-filter` / `-webkit-backdrop-filter` frosting from `APP_GLASS_BUTTON_BASE_STYLE`.
- `src/lib/modalTheme.ts`: added a two-layer gradient background driven by `--app-glass-surface-*` and `--app-glass-border-*` CSS variable slots, with neutral fallbacks so consumers can preserve or supply their own colors instead of inheriting one fixed hue.
- `src/lib/modalTheme.ts`: removed the explicit inset highlight overrides from the Profile jelly button and toggle derivatives so they now honor the updated base surface.
- `docs/CURRENT_TASK.md`: synced the session anchor for the shared base update.

Validation:

- `npx tsc --noEmit` ✅
- `npm run lint:docs-sync` ✅
- `git diff --check` ✅
- Browser computed-style check ✅ (Profile selected companion and frequency button both report `backdrop-filter: none` and outer shadow only)

### UX: Profile AI companion selected-state preview uses calendar-style glass

- `src/features/profile/components/AIModeSection.tsx`: changed only the selected AI companion card to a local green dual-gradient preview modeled on the home calendar selected state; removed the inset highlight and backdrop blur/saturation while preserving the existing green color and 12px radius.
- `src/lib/modalTheme.ts`: unchanged; the shared glass base and all other consumers remain untouched.
- `docs/CURRENT_TASK.md`: synced the session anchor for this isolated visual preview.

Validation:

- `npx tsc --noEmit` ✅
- `npm run lint:docs-sync` ✅
- `git diff --check` ✅
- Browser computed-style check ✅ (selected companion: dual gradient, no inset shadow, `backdrop-filter: none`, 12px radius)

### UX: Chat mood pills now share one exact shell and clearer macaroon colors

- `src/lib/moodColor.ts`: added one shared mood-pill class, separated `calm/down` and `bored/tired` into cyan/blue and warm-neutral/lavender pairs, and replaced the top-left pure-white gradient stop with a softened mood-color stop inspired by the quieter calendar selected state.
- `src/features/chat/MoodPickerModal.tsx`, `src/features/chat/components/EventCard.tsx`, `src/features/chat/MessageItem.tsx`: now consume the same class and `getMoodGlassStyle()` source; removed the activity card's remaining hand-written mood gradient so popup and card labels render the same shell.
- `docs/CURRENT_TASK.md`: synced the session anchor for the mood color and shell alignment.

Validation:

- `npx tsc --noEmit` ✅
- `npx vitest run src/store/useMoodStore.test.ts` ✅ (10 tests across workspace copies)
- `npm run test:unit` ⚠️ (repository-wide pre-existing failures remain in Magic Pen time-zone assertions, magic-pen parse expectations, annotation suggestion flow, and DB timestamp mapping; no mood-style failure)
- Browser computed-style check ✅ (`Bored` card pill and selected picker pill match in background, border, shadow, blur, padding, and font size)

### UX: Mood glass highlight softened and mood palette separated further

- `src/lib/moodColor.ts`: reduced the top-left white highlight intensity inside `getMoodGlassStyle()` by lowering the white-alpha stops, while keeping the same shared blur/shadow shell structure.
- `src/lib/moodColor.ts`: widened the mood palette into clearer macaroon-style separation, especially between `calm/down`, `bored/tired`, and `anxious/satisfied`, so selected mood pills are easier to distinguish at a glance.
- `docs/CURRENT_TASK.md`: synced the session anchor for this mood-style refinement.

Validation:

- `npx tsc --noEmit`

### UX: Mood color helper completed for picker-selected mood styling

- `src/lib/moodColor.ts`: restored the missing `anxious` palette entry and re-added the shared `getMoodTextColor()` / `getMoodGlassStyle()` helpers so the picker can actually render per-mood selected styles instead of falling back toward a single-color path.
- `docs/CURRENT_TASK.md`: synced the session anchor for this helper-level mood-style fix.

Validation:

- `npx tsc --noEmit`

### UX: Mood picker selection source switched back from legacy blue glow to mood colors

- `src/features/chat/MoodPickerModal.tsx`: removed the leftover `APP_SELECTED_GLOW_*` selected state and switched selected predefined/custom mood buttons back to `getMoodGlassStyle()`, restoring per-mood colors and keeping them aligned with the outer activity-card mood tags.
- `docs/CURRENT_TASK.md`: synced the session anchor for this picker color-source correction.

Validation:

- `npx tsc --noEmit`

### UX: Chat list mood pill shell matched more literally to the picker button

- `src/features/chat/MessageItem.tsx`: changed the activity-list mood pill to use the same button shell structure as the picker example (`rounded-full border px-3 py-1.5 text-xs shadow-sm transition-colors`) and moved the serif font family onto the button itself, reducing remaining visual differences.
- `docs/CURRENT_TASK.md`: synced the session anchor for this tighter picker/list mood-pill alignment.

Validation:

- `npx tsc --noEmit`

### UX: Chat list mood tags now use the picker-selected glass texture

- `src/features/chat/MessageItem.tsx`: switched the right-side mood pills in the chat activity list from the simplified flat color version to the same `getMoodGlassStyle()` texture used by selected mood buttons in the picker, so the card-surface tag now matches the popup button look.
- `docs/CURRENT_TASK.md`: synced the session anchor for this chat-list mood-tag texture alignment.

Validation:

- `npx tsc --noEmit`

### UX: Shared glass button shell expanded across nav pages and secondary panels

- `src/lib/modalTheme.ts`: kept the saved shared shell in `APP_GLASS_BUTTON_BASE_STYLE` as the single source of truth, and rebased `APP_GREEN_GLASS_BUTTON_STYLE`, `APP_PROFILE_JELLY_BUTTON_STYLE`, and `APP_PROFILE_JELLY_TOGGLE_ON_STYLE` directly on top of it so they now inherit the exact same border, shadow, and blur/saturate shell parameters.
- `src/features/growth/AddBottleModal.tsx`, `src/features/growth/BottleDetailSheet.tsx`, `src/features/growth/BottleList.tsx`, `src/features/growth/AddGrowthTodoModal.tsx`, `src/features/growth/DailyGoalPopup.tsx`, `src/features/growth/FocusTimer.tsx`: replaced remaining ad hoc button shells with the shared glass shell while preserving each button's original green or rose color and its existing radius.
- `src/features/report/plant/PlantRootSection.tsx`, `src/features/report/ReportDetailModal.tsx`, `src/features/report/DiaryBookShelf.tsx`, `src/features/report/DiaryBookViewer.tsx`: aligned report/diary action buttons and top controls to the same saved shell without changing their existing colors or shapes.
- `src/features/profile/components/InfoSheetPanel.tsx`, `src/features/profile/components/DeleteAccountModal.tsx`: updated shared close / destructive / cancel buttons to use the same glass shell so Profile secondary panels no longer keep their own separate button surface.
- `docs/CURRENT_TASK.md`: synced the current-session anchor for this shared-button-shell rollout.

Validation:

- `npx tsc --noEmit`

## 2026-07-10

### UX: Root-direction language widths adjusted again

- `src/features/profile/components/DirectionSettingsPanel.tsx`: updated the language-specific selection-pill widths to `110px` for Chinese and `155px` for Italian, while leaving the `140px` width for the remaining languages unchanged.
- `docs/CURRENT_TASK.md`: synced the session anchor for this width adjustment.

Validation:

- `npx tsc --noEmit`

### UX: Root-direction selection pill width now varies by language

- `src/features/profile/components/DirectionSettingsPanel.tsx`: changed the right-side selection pill width to language-specific fixed sizes: `100px` for Chinese, `160px` for Italian, and `140px` for the remaining languages.
- `docs/CURRENT_TASK.md`: synced the session anchor for this language-specific width rule.

Validation:

- `npx tsc --noEmit`

### UX: Root-direction selection pill width set to 140px

- `src/features/profile/components/DirectionSettingsPanel.tsx`: set the fixed width of the right-side selection pill to the user-specified `140px`.
- `docs/CURRENT_TASK.md`: synced the session anchor for this explicit width update.

Validation:

- `npx tsc --noEmit`

### UX: Root-direction selection pill width reduced once more

- `src/features/profile/components/DirectionSettingsPanel.tsx`: tightened the fixed width of the right-side selection pill again so the `Entertainment` option leaves less trailing empty space.
- `docs/CURRENT_TASK.md`: synced the session anchor for this additional width reduction.

Validation:

- `npx tsc --noEmit`

### UX: Root-direction selection pill width reduced again to a visibly shorter size

- `src/features/profile/components/DirectionSettingsPanel.tsx`: reduced the fixed width of the right-side selection pill again to a clearly shorter size, targeting a visual length closer to the `Entertainment` label.
- `docs/CURRENT_TASK.md`: synced the session anchor for this second width reduction.

Validation:

- `npx tsc --noEmit`

### UX: Root-direction selection pill width tightened

- `src/features/profile/components/DirectionSettingsPanel.tsx`: reduced the fixed width of the right-side selection pill from the earlier longer value to a tighter length that better fits the longest option text while still keeping EN/IT widths consistent.
- `docs/CURRENT_TASK.md`: synced the session anchor for this root-direction width refinement.

Validation:

- `npx tsc --noEmit`

### UX: Root-direction selection pills now keep a fixed width in EN/IT

- `src/features/profile/components/DirectionSettingsPanel.tsx`: fixed the width of the right-side selection pill in the root-direction modal so English and Italian labels keep a consistent box length instead of resizing per option.
- `docs/CURRENT_TASK.md`: synced the session anchor for this root-direction width normalization.

Validation:

- `npx tsc --noEmit`

### UX: Root-direction picker text now matches the outer direction label style

- `src/features/profile/components/DirectionSettingsPanel.tsx`: adjusted the right-side selection pill text from `text-xs font-semibold` to `text-[13px] font-medium` so it matches the outer position labels such as “左” and “中偏右”.
- `docs/CURRENT_TASK.md`: synced the session anchor for this root-direction text-style alignment.

Validation:

- `npx tsc --noEmit`

### UX: Restore original companion-button corner radius on profile page

- `src/features/profile/components/AIModeSection.tsx`: reverted only the `Choose companion` button group from the temporary `50px` pill radius back to its original smaller corner radius while leaving the rest of the profile page buttons unchanged.
- `docs/CURRENT_TASK.md`: synced the session anchor for this companion-button radius rollback.

Validation:

- `npx tsc --noEmit`

### UX: Profile buttons now use 50px corner radius

- `src/lib/modalTheme.ts`: set the shared profile jelly-button shell to `borderRadius: '50px'`.
- `src/features/profile/components/AIModeSection.tsx`, `AIAnnotationDropRate.tsx`, `HelpSupportPanel.tsx`, `FeedbackPanel.tsx`, `RegionSettingsPanel.tsx`, `UserProfilePanel.tsx`, `DirectionSettingsPanel.tsx`, `RoutineSettingsPanel.tsx`, `MembershipCard.tsx`, `ChangePasswordPanel.tsx`, and `DeleteAccountModal.tsx`: updated the main button surfaces on the profile side to `50px` corner radius.
- `docs/CURRENT_TASK.md`: synced the session anchor for this profile button-radius pass.

Validation:

- `npx tsc --noEmit`

### UX: Restore profile jelly buttons to the original green color

- `src/lib/modalTheme.ts`: corrected the profile jelly-shell rollout so the profile page keeps its original green color family (`APP_GREEN_GLASS_BG` for buttons and `APP_GREEN_TOGGLE_ON_STYLE` for enabled toggles) while retaining the jelly-shell border/shadow/blur treatment.
- `docs/CURRENT_TASK.md`: synced the session anchor for this profile color-restoration fix.

Validation:

- `npx tsc --noEmit`

### UX: Profile green buttons now reuse the chat mood-tag jelly shell

- `src/lib/modalTheme.ts`: added `APP_PROFILE_JELLY_BUTTON_STYLE` and `APP_PROFILE_JELLY_TOGGLE_ON_STYLE` using the exact jelly-shell treatment from the chat mood button, while keeping the profile page's existing green color direction.
- `src/features/profile/components/AIModeSection.tsx`, `AIAnnotationDropRate.tsx`, `DailyGoalToggle.tsx`, `LongTermProfileToggle.tsx`, `UserProfilePanel.tsx`, `RoutineSettingsPanel.tsx`, `HelpSupportPanel.tsx`, `FeedbackPanel.tsx`, `RegionSettingsPanel.tsx`, and `DirectionSettingsPanel.tsx`: switched the current green buttons and enabled green toggles to that shared jelly shell.
- `docs/CURRENT_TASK.md`: synced the session anchor for this profile jelly-shell rollout.

Validation:

- `npx tsc --noEmit`

### UX: Chat event-card action buttons now reuse the shared glass shell exactly

- `src/features/chat/components/EventCard.tsx`: changed the top-right camera button and mood tag button to use the shared glass-button shell values directly for border, shadow, and blur treatment, while keeping only their color layers distinct.
- `docs/CURRENT_TASK.md`: synced the session anchor for this exact shared-shell replacement.

Validation:

- `npx tsc --noEmit`

### UX: Chat event-card camera and mood buttons align to shared glass shell

- `src/features/chat/components/EventCard.tsx`: refined the top-right camera button and mood tag button so both use the same stronger border highlight, `blur(20px) saturate(128%)`, and subtle inner sheen language as the shared glass-button shell, while preserving their existing blue and mood-tinted color roles.
- `docs/CURRENT_TASK.md`: synced the session anchor for this chat event-card button-shell alignment.

Validation:

- `npx tsc --noEmit`

### UX: Green buttons unified to one shared app-wide shell

- `src/lib/modalTheme.ts`: updated the shared green glass token set to the confirmed companion-frequency button values and added reusable green button/toggle helpers.
- `src/features/profile/components/AIModeSection.tsx`, `AIAnnotationDropRate.tsx`, `DailyGoalToggle.tsx`, `LongTermProfileToggle.tsx`, `UserProfilePanel.tsx`, `RoutineSettingsPanel.tsx`, `HelpSupportPanel.tsx`, `FeedbackPanel.tsx`, `RegionSettingsPanel.tsx`, and `DirectionSettingsPanel.tsx`: aligned the profile page's green selected buttons, save buttons, and green toggles to the same shared green shell.
- `src/components/layout/LanguageSwitcher.tsx`: aligned the green trigger/current-language button style to the same shared green shell.
- `src/features/report/ReportPage.tsx` and `ReportDetailModal.tsx`: aligned the green report header and diary-generate buttons to the same shared green shell.
- Shared modal primary buttons now inherit the same green shell through `APP_MODAL_PRIMARY_BUTTON_CLASS`, which also brings existing green primary CTAs in chat/growth modals onto the same visual spec.
- `docs/CURRENT_TASK.md`: synced the session anchor for this app-wide green-button unification pass.

Validation:

- `npx tsc --noEmit`

### UX: Profile AI companion selected shell now matches frequency High button

- `src/features/profile/components/AIModeSection.tsx`: updated the selected AI companion button shell to reuse the same selected-state gradient, border, and shadow values as the `Companion frequency` `High` button while keeping the avatar/name/lock content unchanged.
- `docs/CURRENT_TASK.md`: synced the session anchor for this profile companion-button shell alignment.

Validation:

- `npx tsc --noEmit`

### UX: Profile AI companion buttons adopt provided outer button template

- `src/features/profile/components/AIModeSection.tsx`: changed the AI companion selection buttons to use the provided outer button structure (`rounded-lg`, `border`, `py-1.5`, `text-xs`, `font-medium`, transition classes) while keeping avatar/name/lock content intact.
- `docs/CURRENT_TASK.md`: synced the session anchor for this AI companion button-shell update.

Validation:

- `npx tsc --noEmit`

### UX: Profile toggles and High button recolored to `#D0E6A1`

- `src/features/profile/components/AIModeSection.tsx`: changed the AI mode toggle enabled-state green to the `#D0E6A1` reference family.
- `src/features/profile/components/DailyGoalToggle.tsx`: changed the daily-goal toggle enabled-state green to the same reference family.
- `src/features/profile/components/AIAnnotationDropRate.tsx`: changed the selected drop-rate button color treatment (including `High`) to the same `#D0E6A1` glass green family while leaving structure unchanged.
- `docs/CURRENT_TASK.md`: synced the session anchor for this narrowed profile color pass.

Validation:

- `npx tsc --noEmit`

### UX: More green buttons unified to `#D0E6A1` glass palette

- `src/features/profile/components/AIModeSection.tsx`: aligned the selected AI companion button to the shared `#D0E6A1` glass green palette.
- `src/features/report/plant/PlantRootSection.tsx`: aligned the green action buttons in the diary/report lower section (`Generate Plan`, early-tip confirm, diary save) to the same shared green glass palette.
- `docs/CURRENT_TASK.md`: synced the session anchor for this additional green-button unification pass.

Validation:

- `npx tsc --noEmit`

### Refactor: Extract shared glass button shell base

- `src/lib/modalTheme.ts`: added `APP_GLASS_BUTTON_BASE_STYLE` to hold the shared button shell parameters (`border`, `boxShadow`, `backdropFilter`, `WebkitBackdropFilter`) requested for reuse.
- `src/lib/modalTheme.ts`: updated modal primary/secondary/close button classes to use the same shell treatment while preserving their original color roles.
- `src/features/chat/ChatInputBar.tsx`, `src/features/chat/components/EventCard.tsx`, and `src/features/report/ReportPage.tsx`: connected existing top-level glass buttons to the shared shell base while keeping their current colors and shapes unchanged.
- `docs/CURRENT_TASK.md`: synced the session anchor for this button-shell refactor.

Validation:

- `npx tsc --noEmit`

### UX: Profile AI companion button now changes color only

- `src/features/profile/components/AIModeSection.tsx`: adjusted the selected AI companion button to keep its original highlight structure and shadow strength while only swapping the green family to the `#D0E6A1` reference palette.
- `docs/CURRENT_TASK.md`: synced the session anchor for this profile color-only refinement.

Validation:

- `npx tsc --noEmit`

### UX: Profile AI companion selection uses reference green `#D0E6A1`

- `src/features/profile/components/AIModeSection.tsx`: updated the selected AI companion button style to the provided green reference family centered on `#D0E6A1`, including the glass gradient and matching shadow tint.
- `docs/CURRENT_TASK.md`: synced the session anchor for this profile AI-mode color update.

Validation:

- `npx tsc --noEmit`

### UX: Growth expanded medium priority uses reference yellow `#FEFFAF`

- `src/features/growth/GrowthTodoCard.tsx`: updated the expanded-card `medium` priority selected style to the provided yellow reference family centered on `#FEFFAF`, including its glass gradient and matching shadow tint.
- `docs/CURRENT_TASK.md`: synced the session anchor for this growth priority-color adjustment.

Validation:

- `npx tsc --noEmit`

### UX: Diary header buttons left highlight reduced to `0.80`

- `src/features/report/ReportPage.tsx`: lowered the left-side main surface highlight on both diary header buttons from `rgba(236,244,218,0.92)` to `rgba(236,244,218,0.80)` while leaving the rest of the glass/frosted parameters unchanged.
- `docs/CURRENT_TASK.md`: synced the session anchor for this highlight-opacity tweak.

Validation:

- `npx tsc --noEmit`

### UX: Diary calendar button now matches Diary Book button style

- `src/features/report/ReportPage.tsx`: updated the left calendar header button to use the same green glass gradient, highlight, shadow, and light frosted treatment as the `Diary Book` button, so the two top-right controls are now visually identical.
- `docs/CURRENT_TASK.md`: synced the session anchor for this report-header button unification.

Validation:

- `npx tsc --noEmit`

### UX: Diary Book button reuses confirmed glass values while keeping frosted finish

- `src/features/report/ReportPage.tsx`: kept the `Diary Book` header button's current `#D0E6A1` green direction and frosted `blur/saturate` treatment, while restoring the main gradient stops, border highlight, and base shadow closer to the user-confirmed `greenGlassStyle` values.
- `docs/CURRENT_TASK.md`: synced the session anchor for this diary-book parameter reconciliation.

Validation:

- `npx tsc --noEmit`

### UX: Diary Book button highlight softened and frosted slightly more

- `src/features/report/ReportPage.tsx`: reduced the left-side highlight strength on the `Diary Book` header button and increased its light frosted feel with slightly stronger blur, lower saturation, and a subtler inset highlight.
- `docs/CURRENT_TASK.md`: synced the session anchor for this diary-book surface refinement.

Validation:

- `npx tsc --noEmit`

### UX: Diary Book button green returns to `#D0E6A1`

- `src/features/report/ReportPage.tsx`: adjusted only the `Diary Book` header button back to the requested `#D0E6A1` green family while keeping the same glass-shell structure and sizing as the calendar button.
- `docs/CURRENT_TASK.md`: synced the session anchor for this diary-book color-only adjustment.

Validation:

- `npx tsc --noEmit`

### UX: Diary Book header button now matches calendar button shell

- `src/features/report/ReportPage.tsx`: aligned the `Diary Book` header button surface treatment with the left calendar button so both top-right controls now share the same glass shell style and differ only by content.
- `docs/CURRENT_TASK.md`: synced the session anchor for this report-header button-shell alignment.

Validation:

- `npx tsc --noEmit`

### UX: Diary Book button switches to `#D0E6A1` with slight frosted finish

- `src/features/report/ReportPage.tsx`: updated the `Diary Book` header button to use `#D0E6A1` as the green base and softened it with a slight frosted treatment through gentler blur, lower saturation, and a lighter inset highlight.
- `docs/CURRENT_TASK.md`: synced the session anchor for this diary-book button frosted-green update.

Validation:

- `npx tsc --noEmit`

### UX: Diary header buttons now match donut-chart green

- `src/features/report/ReportPage.tsx`: adjusted the right-side calendar and diary-book buttons to a lighter green glass tint derived from the activity donut chart green (`#D5E8CE` family), so the diary page header matches the report visualization palette more closely.
- `docs/CURRENT_TASK.md`: synced the session anchor for this report-header color calibration.

Validation:

- `npx tsc --noEmit`

### UX: Chat mood tag now uses glass pill treatment

- `src/features/chat/components/EventCard.tsx`: updated the mood tag pill itself from a flat translucent fill to a glass-style capsule with subtle highlight, tinted gradient, and soft shadow so it matches the surrounding action controls.
- `docs/CURRENT_TASK.md`: synced the session anchor for this mood-tag finish pass.

Validation:

- `npx tsc --noEmit`

### UX: Add glass treatment to chat event actions and diary header buttons

- `src/features/chat/components/EventCard.tsx`: changed the top-right photo-upload and event-to-mood buttons from flat solid circles to tinted glass circular buttons, keeping the blue/purple functional distinction while aligning their surface treatment with the rest of the UI.
- `src/features/report/ReportPage.tsx`: updated the diary/report header calendar button and diary-book button to the shared green glass CTA style so the top action row matches the unified button system.
- `docs/CURRENT_TASK.md`: synced the session anchor for this chat/report glass-button pass.

Validation:

- `npx tsc --noEmit`

### UX: Growth confirm buttons converge on shared green glass CTA

- `src/features/growth/AddGrowthTodoModal.tsx`: updated the main confirm button to the shared `#D0E6A1` green glass CTA style.
- `src/features/growth/DailyGoalPopup.tsx`: updated the daily-goal confirm button to the same shared green glass gradient, border highlight, shadow, and text color.
- `docs/CURRENT_TASK.md`: synced the session anchor for this final growth CTA alignment pass.

Validation:

- `npx tsc --noEmit`

### UX: Growth auto-create prompt save button matches shared green glass CTA

- `src/features/growth/BottleList.tsx`: updated the `Save` action in the post-create habit auto-create-daily-todo prompt to the same confirmed green glass CTA style already used by bottle modal actions and the chat send button.
- `docs/CURRENT_TASK.md`: synced the session anchor for this prompt-button alignment.

Validation:

- `npx tsc --noEmit`

### UX: Reuse confirmed green glass CTA across growth and chat actions

- `src/lib/modalTheme.ts`: extracted the confirmed `#D0E6A1` green glass gradient, border, shadow, and text color into shared constants so bottle-related CTAs and chat send actions can stay on the same visual spec.
- `src/features/growth/BottleDetailSheet.tsx`: updated bottle-detail primary actions (`create todo`, `irrigate`, `goal yes`) to the shared green glass CTA style while keeping secondary actions unchanged.
- `src/features/chat/ChatInputBar.tsx`: changed the home-page send button on the right side of the input to the same green glass color and surface treatment.
- `src/features/growth/AddBottleModal.tsx` and `src/features/growth/BottleList.tsx`: switched existing inline values to the new shared constants without changing the confirmed look.
- `docs/CURRENT_TASK.md`: synced the session anchor for this shared CTA style rollout.

Validation:

- `npx tsc --noEmit`

### UX: Growth bottle add button now matches confirmed green glass CTA

- `src/features/growth/BottleList.tsx`: updated the bottle-section add button on the right side of the habit/goal row to reuse the same confirmed `#D0E6A1` green glass gradient, border highlight, and shadow values as the add-bottle modal CTA buttons.
- `docs/CURRENT_TASK.md`: synced the session anchor for this button-style alignment.

Validation:

- `npx tsc --noEmit`

### UX: Growth add-bottle modal buttons unify to green glass style

- `src/features/growth/AddBottleModal.tsx`: adjusted the selected `Type` button to the `#D0E6A1` green family while keeping the existing soft glass treatment.
- `src/features/growth/AddBottleModal.tsx`: restyled the `Save` button to use the same green glass gradient, border treatment, and shadow language as the `Type` button for a more consistent modal CTA surface.
- `docs/CURRENT_TASK.md`: synced the session anchor for this modal button visual alignment.

Validation:

- `npx tsc --noEmit`

### UX: Growth bottle section hint becomes transient title popover

- `src/features/growth/BottleList.tsx`: removed the always-visible bottle-section subtitle and changed it to a small popover anchored beside the section title when the user taps the title.
- The hint now auto-dismisses after 3 seconds of inactivity and also closes when the user taps elsewhere on the page.

Validation:

- `npx tsc --noEmit`

### Fix: Chat manual-end mis-tap undo window

- `src/features/chat/components/TimelineView.tsx` and `src/features/chat/components/EventCard.tsx`: the home-page activity stop button now enters a 3-second gray pending state on first tap; tapping again during that window cancels the stop and keeps the original timer running.
- `src/store/useChatStore.ts` and `src/store/useChatStore.types.ts`: added transient `pendingManualEnds` plus request/cancel actions so manual stop side effects only finalize after the 3-second window expires.
- `src/store/useChatStore.integration.test.ts` and `src/store/README.md`: added regression coverage and synced the store-layer note for the delayed-finalize behavior.

Validation:

- `npm.cmd run test:unit -- src/store/useChatStore.integration.test.ts`
- `npx.cmd tsc --noEmit`

### Fix: AI diary English word wrapping in report views

- `src/features/report/ReportDetailModal.tsx`: changed AI diary observation paragraphs from `wordBreak: 'break-all'` to `wordBreak: 'normal'` while keeping `pre-wrap`, so English words no longer split mid-word in the main diary detail modal.
- `src/features/report/DiaryBookViewerPageContent.tsx`: made diary-book observation text layout language-aware, keeping justified text for Chinese but using left-aligned wrapping plus normal word breaks for EN/IT narrow-column pages.
- `docs/CURRENT_TASK.md`: synced the session anchor for this diary typography fix.

Validation:

- Not run (targeted UI text-layout change)

### Refactor: Split oversized diary viewer

- `src/features/report/DiaryBookViewer.tsx`: extracted the page rendering block and shared viewer constants so the main viewer file drops below the 1000-line pre-commit error threshold while keeping flip/drag behavior unchanged.
- `src/features/report/DiaryBookViewerPageContent.tsx`: new report-local page content component for cover/day/back page rendering, localized summaries, and teaser/plant card presentation.
- `src/features/report/diaryBookViewerTheme.ts`: new shared constants/helper module for viewer sizing, textures, cover colors, and localized-summary guards.
- `docs/CURRENT_TASK.md`: synced the session anchor for the file split.

Validation:

- `npm.cmd run lint:max-lines`
- `npx.cmd tsc --noEmit`

### Fix: Plant card diary CTA now opens today's diary

- `src/features/report/ReportPage.tsx`: passes the existing today-diary open/generate handler down into the plant section so the report modal opens on the diary page after the plant-card CTA is tapped.
- `src/features/report/plant/PlantRootSection.tsx`: routes the post-plant "Generate Diary" action through the report-page handler instead of only generating in place, preserving the existing fallback when the section is used standalone.
- `src/features/report/README.md` and `docs/CURRENT_TASK.md`: synced the report user-flow documentation for the new plant-to-diary transition.

Validation:

- `npx.cmd tsc --noEmit`

### Fix: Recurring todo delete-all-future from completed item

- `src/features/growth/GrowthTodoSection.tsx`: when deleting all future occurrences from a completed recurring todo instance, the app now deletes both the recurrence template and the selected completed instance so the card disappears immediately.
- Existing historical completed instances remain preserved because template cascade deletion in the store still only removes unfinished generated instances.

Validation:

- `npx.cmd tsc --noEmit`

### Fix: Chat activity card second image visibility

- `src/features/chat/components/EventCard.tsx`: keeps the second image slot visible after the first image is removed, while preserving the empty-card upload trigger.
- `src/features/chat/components/eventCardImages.ts`: adds a small image-slot helper with a regression test for the second-image-only state.

Validation:

- `npm.cmd run test:unit -- src/features/chat/components/eventCardImages.test.ts`
- `npx.cmd tsc --noEmit`

### Fix: Chat activity card image reflow after delete

- `src/features/chat/components/EventCard.tsx`: visible activity-card thumbnails now render from the actual filled slots, so when the first image is deleted the remaining second image shifts into the first visual position.
- `src/features/chat/components/ImageUploader.tsx`: adds a hidden input-only mode so slot-specific upload controls stay mounted for the top-right camera action without leaving an empty thumbnail column in the card.

Validation:

- `npm.cmd run test:unit -- src/features/chat/components/eventCardImages.test.ts`
- `npx.cmd tsc --noEmit`

### Fix: English diary activity/mood fallback copy

- `src/features/report/DiaryBookViewer.tsx`: recomputes localized activity and mood summaries when saved report summaries are from another language, preventing English diary pages from showing Chinese fallback text.
- `src/features/report/ReportDetailModal.tsx`: applies the same language-aware stored-summary check in the diary detail view.
- `api/diary.ts`: localizes the raw input, date, and history prompt labels passed to diary generation for EN/IT.

Validation:

- `.\node_modules\.bin\tsc.cmd --noEmit`
- `git diff --check`

### Copy: Chat placeholder English polish

- `src/i18n/locales/en.ts`: updated `chat_placeholder_neutral` from "Write this moment..." to "Capture this moment..." for more natural English.
- ZH/IT translations were left unchanged.

Validation:

- Not run (copy-only i18n update)

## 2026-07-07

### Fix: Store avatars outside Auth metadata

- `src/lib/avatarStorage.ts`: uploads replacement avatars to versioned Storage object paths instead of overwriting `profile.jpg`.
- `src/store/authProfileCloudStore.ts`, `src/store/useAuthStore.ts`, and `src/store/authStoreAccountActions.ts`: persist avatar URLs in `user_profiles.avatar_url` and hydrate existing UI from that cloud field.
- Supabase schema scripts now include `user_profiles.avatar_url` and backfill existing non-data-URL avatar metadata.

### Fix: Supabase/iOS startup diagnostics and local-first boot

- `src/store/useAuthStore.ts`: changed initialization to open the app after session restore, storage scope setup, and local cache rehydrate; cloud refresh, local-to-cloud sync, outbox flush, activity streak, and deletion checks now run in background with per-stage diagnostics.
- `src/store/authStoreRuntimeHelpers.ts` and `src/store/authDataSyncHelpers.ts`: added domain/table-level diagnostics for cloud refresh and local-to-cloud sync so failures show which business area/table failed.
- `src/lib/diagnostics.ts`, `src/api/client.ts`, `src/api/supabase.ts`, `src/main.tsx`, `src/App.tsx`, and feedback/auth/payment/chat paths: added request timing, requestId, runtime context, retry details, startup/error-boundary diagnostics, and clearer user-visible failure messages.
- `api/subscription.ts` and `src/server/http.ts`: added requestId propagation for subscription/API responses.
- `docs/CURRENT_TASK.md`: updated the session anchor and next diagnostic steps.

Validation:

- `.\node_modules\.bin\tsc.cmd --noEmit`
- `git diff --check`

### Fix: Move growing Auth metadata to business tables

- `scripts/migrate_auth_metadata_profile_to_tables.sql`: added `user_login_days` and `user_profiles` schema, RLS policies, metadata backfill, and commented cleanup SQL for removing migrated keys after verification.
- `src/store/authProfileCloudStore.ts`, `src/store/useAuthStore.ts`, and auth account/runtime helpers: moved `login_days`, `user_profile_v2`, and `long_term_profile_enabled` writes to Supabase tables while keeping Auth metadata as a migration fallback.
- `src/features/profile/components/UserInfoCard.tsx`: reads recent login days from `user_login_days`, falling back to existing metadata when needed.

Validation:

- `.\node_modules\.bin\tsc.cmd --noEmit`
- `node ./scripts/check-max-lines.mjs`
- `git diff --check`

## 2026-05-05

### Fix: 日记超长截断与 Agnes 小标题板块移除

- `src/lib/aiCompanion/prompts/agnes.ts`：Agnes 三语 diary prompt 删除“正文后额外【】板块/小标题”硬要求，改为单段连续正文；同时收紧建议长度（ZH 150-260 字，EN/IT 110-170 词）
- `api/diary.ts`：新增语言化长度最高优先规则并注入 user prompt（与称呼规则同级）；将 `max_tokens` 从 `1000` 收紧到 `520`
- `api/diary.ts`：新增服务端后置兜底裁剪（按语言裁剪正文、保留并回挂落款），避免模型偶发超长导致前端展示不全
- `src/features/report/ReportDetailModal.tsx`、`src/features/report/DiaryBookViewer.tsx`：观察日记展示区增加纵向滚动兜底（iOS touch scroll），避免异常长文被 `overflow: hidden` 直接截断

Validation:

- Not run (targeted prompt/server/UI fallback update)

## 2026-05-02

### Fix: Magic Pen 时间冲突校验改为“允许 ended、拦截 ongoing”

- `src/services/input/magicPenDraftBuilder.ts`：移除“与已完成活动重叠即报错”逻辑，改为仅校验与进行中活动（`duration === undefined`）冲突；与既有已完成活动重叠允许提交并交由 `insertActivity` 自动切分
- `src/services/input/magicPenDraftBuilder.ts`：批次重叠错误从“双边标红”改为仅标记后一条冲突草稿（更符合用户修改心智）
- `src/services/input/magicPenDraftBuilder.test.ts`、`src/store/magicPenActions.test.ts`：同步更新冲突规则断言（ongoing 拦截、ended 放行、batch 仅后条报错）

Validation:

- `npx vitest run src/services/input/magicPenDraftBuilder.test.ts src/store/magicPenActions.test.ts` ⚠️（本次规则相关测试已对齐；`magicPenDraftBuilder.test.ts` 仍存在仓库既有时区相关失败，与本次改动无关）

### Fix: 日记生成状态提示文案纠正（避免误显示“植物已生成”）

- `src/features/report/ReportDetailModal.tsx`：日记按钮点击后的“已生成”提示从 `plant_generate_already` 改为 `report_generate_already`
- `src/features/report/plant/PlantRootSection.tsx`：日记生成链路的“已生成/成功”提示改为 `report_generate_already` / `report_generate_success`
- `src/i18n/locales/zh.ts`、`src/i18n/locales/en.ts`、`src/i18n/locales/it.ts`：新增三语 key
  - `report_generate_already`
  - `report_generate_success`
- 中文文案更新为：`日记已经生成，去日记本里看看吧~`

Validation:

- Not run (targeted i18n + hint key fix)

### Fix: 偏好 outbox 去重与即时补推

- `src/store/useOutboxStore.ts`：`enqueue()` 对 `preference.upsert` 增加同类去重策略（入队时移除历史 `preference.upsert` 条目，仅保留最新快照），与设置型数据的 last-write-wins 语义对齐，减少冗余队列与重复 metadata 写入
- `src/store/authPreferenceHelpers.ts`：`queuePreferenceSnapshot(...)` 入队后立即触发一次非阻塞 `outbox.flush()`，在在线场景下加速偏好写云与跨设备可见性
- `src/store/useOutboxStore.test.ts`：补充 `preference.upsert` 仅保留最新项的单测

Validation:
- `npx vitest run src/store/useOutboxStore.test.ts` ❌（该测试文件当前存在与 multi-account isolation scope 相关的既有失败；本次新增用例通过，存量用例失败与本改动前一致）

### Fix: iCloud Sync 审计修复（Apple SynchronizingAppPreferencesWithICloud 规范对齐）

- **F1 — 偏好设置持久化**：`src/store/authPreferenceHelpers.ts` 移除模块级内存队列 (`queuedPreferenceSnapshot` / `flushQueuedPreferences`)，改为调用 `useOutboxStore.enqueue({ kind: 'preference.upsert', ... })`；`src/store/useOutboxStore.ts` 新增 `PreferenceUpsertOutboxEntry` 类型与 `executePreferenceUpsertEntry` 执行器（动态 import `authMetadataQueue`），纳入统一 outbox retry/cooldown 机制
- **F2 — 前台元数据刷新**：`src/hooks/useNetworkSync.ts` 新增 `visibilitychange` 监听，应用从后台切换至前台时触发 `supabase.auth.refreshSession()`，通过现有 `onAuthStateChange → TOKEN_REFRESHED` 链路将其他设备最新偏好同步写入本地 auth store
- **F3/F5 — 调度器 localStorage 迁移**：`src/services/reminder/reminderScheduler.ts` 将全部 `getPersistentItem`/`setPersistentItem`/`removePersistentItem` 调用改为 `localStorage.getItem/setItem/removeItem`，移除 storageService 依赖；调度器运维键（`freeDay_*` / `reminder_scheduled_date` / `reminder_today_count`）均已通过 `getScopedClientStorageKey` 按用户隔离，存入 WebKit 层（已配置排除 iCloud 备份）
- **F4 — 多账户隔离 V2 默认开启**：`src/store/storageScope.ts` `isMultiAccountIsolationV2Enabled()` 逻辑反转为默认启用，仅当 `VITE_MULTI_ACCOUNT_ISOLATION_V2=0|false|off` 时关闭；防止账户切换时 V1 key 泄露其他用户数据

Validation:
- `npx tsc --noEmit` → 通过（无类型错误）
- `npm run lint:all` → 通过（secrets / max-lines / docs-sync / tsc 全部通过）

## 2026-05-01

### Fix: Van 日记格式与情绪摘要 NaN 修复

- `src/features/report/ReportDetailModal.tsx`：移除观察日记文案的全局空白折叠（`replace(/\s+/g, ' ')`），保留 AI 输出原始换行，修复 `【】` 小标题前空行被吞掉导致整段粘连
- `api/diary.ts`：增强落款识别规则，新增“`Van ——` / `Agnes ——`”等尾部签名形态检测，避免模型已落款时再次追加 fallback 造成双落款
- `src/store/reportHelpers.ts`：`generateMoodSummary(...)` 增加 `totalMinutes <= 0` 兜底，避免情绪占比文案出现 `NaN%`

Validation:

- Not run (targeted formatting + summary guard fix)

### Fix: 植物卡片下载图遮挡修复（移除导出“轻点翻转”）

- `src/features/report/plant/PlantFlipCard.tsx`：下载正面卡片改为抓取 export-only 节点，不再复用交互态 UI 节点
- export-only 正面节点移除 `plant_tap_to_flip` 提示文案，避免“轻点翻转”进入下载图
- export-only 正面节点底部留白从交互态分离并加大，修复下载图最底行文案被遮挡/压线
- `html2canvas` 增加 `useCORS: true`，降低图片导出在 iOS/WebView 场景下的偶发渲染差异

Validation:

- Not run (targeted UI export fix)

### Copy: 帮助与支持文案更新（取消订阅路径 + 联系支持表达）

- `src/i18n/locales/zh.ts`、`src/i18n/locales/en.ts`、`src/i18n/locales/it.ts`：
  - `help_a9` 统一为双入口说明：`App Store（头像→订阅）` 或 `iPhone 设置（姓名→订阅）`
  - `help_contact_desc` 统一改为“如需支持请发邮件至”语义，避免仅“联系我们：”的生硬表达
- `src/features/profile/components/HelpSupportPanel.tsx`：移除支持邮箱链接下划线样式，保留 `mailto:` 点击能力与底部灰字展示

Validation:

- Not run (copy/style update only)

### Docs+Copy: 隐私政策供应商披露补齐 + ASC 提审填写模板

- `src/i18n/locales/zh.ts`：更新设置页隐私政策中文文案
  - `privacy_updated` 更新为 `2026 年 5 月 1 日`
  - `privacy_s3_body` 补齐 AI 供应商名单：OpenAI、DeepSeek、Qwen、智谱 AI、Google Gemini
  - `privacy_s4_body` 补齐第三方服务披露：Open-Meteo（天气+空气质量）并与 AI 供应商列表对齐
- 新增 `docs/ASC_SUBMISSION_CODE_BASED_FILL_TEMPLATE.md`：基于当前代码的 App Store Connect 提审填写模板（供应商、数据类型、用途、人工核对项）
- `docs/CURRENT_TASK.md`：同步会话锚点与本轮隐私披露更新记录

### Fix+Docs: Report 功能整体下线（前端链路 + API 端点）

- 删除 `api/report.ts`（Vercel Serverless endpoint）
- 删除前端调用：
  - `src/store/reportActions.ts`：`runReportAIAnalysis` 函数（调用 `/api/report`）
  - `src/store/useReportStore.ts`：`triggerAIAnalysis` action
  - `src/api/client.ts`：`callReportAPI` + `ReportRequest/ReportResponse` 类型
  - `src/features/profile/components/HelpSupportPanel.tsx`：`help_q10` 等 report 相关 FAQ 文案待后续清理
- 遗留：Report 基础功能（日报/月报生成、Diary 日记、AI日记）不受影响，仍正常使用 Supabase + `/api/diary`
- 关联清理：同步移除隐私政策中的 Chutes 表述（已在上一轮完成）

Validation:

- `npx tsc --noEmit` ✅

### Fix+Docs: 下线 Report 外部模型链路并清理 Chutes 残留

- `api/report.ts`：移除 `CHUTES_API_KEY` 读取与 `llm.chutes.ai` 外部请求链路，改为占位返回（生产简版、非生产附带 debug context）
- `src/types/annotation.ts`：删除未使用的 `Chutes*` 类型定义
- 配置与文档清理：`.env`、`.env.example`、`README.md`、`DEPLOY.md`、`docs/PROJECT_MAP.md`、`docs/ARCHITECTURE.md`、`PROJECT_CONTEXT.md`、`docs/SEEDAY_DEV_SPEC.md`、`docs/AI_USAGE_INVENTORY.md`、`api/README.md`、`docs/COMPLIANCE_AND_REVIEW_PLAN.md`、`LLM.md`、`CLAUDE.md` 去除 `CHUTES_API_KEY`/Chutes 相关表述
- `src/i18n/locales/zh.ts`、`docs/ASC_SUBMISSION_CODE_BASED_FILL_TEMPLATE.md`：同步移除 Chutes 供应商表述；隐私文案维持 iOS 提审口径（不写 Stripe）

Validation:

- Not run (copy/docs update only)

### Fix: iOS 关键本地缓存最小迁移（Auth Session + Reminder Scheduler）

- 新增 `src/services/native/storageService.ts`：统一持久化适配层（native: `@capacitor/preferences`，web: `localStorage`），并在 native 路径对同名 legacy localStorage key 做一次性迁移
- `src/api/supabase.ts`：Supabase Auth `storage` 改为统一适配器，避免 iOS WKWebView 下会话仅依赖 localStorage
- `src/services/reminder/reminderScheduler.ts`：`freeDay_<date>`、`reminder_scheduled_date`、`reminder_today_count` 改为通过统一适配层读写，降低调度状态在 iOS 被回收后的丢失风险
- `package.json` / `package-lock.json`：新增 `@capacitor/preferences@^7.0.0`

Validation:

- `npx tsc --noEmit` ✅

### Fix: 提审高风险项收口（Router/IAP/ErrorBoundary）

- `src/App.tsx`：将 `BrowserRouter` 切换为 `HashRouter`，降低 Capacitor 套壳深链/刷新边缘异常风险
- `api/subscription.ts`：新增生产环境防呆；当 `APPLE_IAP_VERIFY_BYPASS=true` 且 `NODE_ENV/VERCEL_ENV` 为 production 时直接抛错阻断，避免误绕过 Apple 校验
- `src/components/feedback/ErrorBoundary.tsx`：错误日志改为 DEV-only，避免生产设备暴露原始异常对象
- `src/services/notifications/localNotificationService.ts`：通知操作按钮文案改为 i18n key（中/英/意），移除中文硬编码
- `src/i18n/locales/en.ts`、`src/i18n/locales/zh.ts`、`src/i18n/locales/it.ts`：补充通知 action 文案翻译键
- `ios/App/App/Info.plist` + `ios/App/App/{en,it,zh-Hans}.lproj/InfoPlist.strings`：通知权限说明改为本地化资源，默认文案改为英文基线

Validation:

- Not run (targeted risk fixes + docs sync)

### Fix: 前端 store 生产日志进一步收口（R-ASR-007 Round 1.12）

- `src/store/reportActions.ts`、`src/store/authStoreRuntimeHelpers.ts`、`src/store/useReportStore.ts`：生产路径 `console.warn/error` 改为 DEV-only
- `src/store/useAnnotationStore.ts`、`src/store/useStardustStore.ts`、`src/store/authDataSyncHelpers.ts`、`src/store/authPreferenceHelpers.ts`：生产路径 `console.warn/error` 改为 DEV-only，避免在用户设备暴露错误对象细节

Validation:

- `npm run lint:all` ✅

### Fix: 生产日志最小化（R-ASR-007 Round 1.11）

- 前端日志收口：`src/store/useChatStore.ts`、`src/store/useTodoStore.ts` 将生产路径 `console.error` 与 `catch(console.error)` 改为 DEV-only，避免用户设备暴露运行时错误对象
- 服务端日志脱敏：`api/report.ts`、`api/classify.ts`、`api/diary.ts`、`api/magic-pen-parse.ts` 错误日志改为结构化摘要（`status` / `statusText` / `errorLength`），移除原始文本预览
- 文档回填：`docs/APP_REVIEW_ASR_NR_AUDIT_TRACKER.md` 新增 Round 1.11 审计记录，`docs/CURRENT_TASK.md` 同步会话锚点

Validation:

- `npm run lint:all` ✅

### Fix: 清理前端非必要日志（R-ASR-007）

- 移除前端主链路非必要 `console.log`：`src/features/chat/chatPageActions.ts`、`src/services/input/magicPenParser.ts`、`src/store/useAuthStore.ts`、`src/store/annotationHelpers.ts`、`src/store/useAnnotationStore.ts`、`src/store/authDataSyncHelpers.ts`、`src/store/useChatStore.ts`、`src/store/useReportStore.ts`、`src/store/reportActions.ts`、`src/store/useStardustStore.ts`、`src/lib/aiParser.ts`、`src/lib/imageCompressor.ts`、`src/services/timing/timingSessionService.ts`
- `src/api/client.ts`：前端 debug logger 改为空实现，不再输出 request/response `console.log`
- `src/store/storageScope.ts`：保留 DEV 分支但移除具体输出，避免前端运行时日志噪音
- server 侧继续收口：`src/server/annotation-handler.ts`、`src/server/annotation-handler-utils.ts`、`src/server/todo-decompose-service.ts` 删除非必要 `console.log`（保留 `console.warn/error` 诊断）

Validation:

- `npx tsc --noEmit` ✅

### Docs: ASR/NR Round 1.9 全量条款补审完成（代码证据驱动）

- `docs/APP_REVIEW_ASR_NR_AUDIT_TRACKER.md`：补齐剩余 28 条 `ASR & NR` 条款逐条审计，进度更新为 52/52（待审 0）；新增 Round 1.9 结论、风险与证据路径
- `docs/APP_REVIEW_ASR_NR_AUDIT_TRACKER.md`：`ASR/NR 全量条款清单` 全部由“待审”更新为“已审（Round 1.9）”
- `docs/CURRENT_TASK.md`：回填 Round 1.9 会话锚点，明确提审前人工核对项与剩余代码风险聚焦 `R-ASR-007`

Validation:

- Not run (docs audit sync only)

### Fix: 收口订阅服务端详细日志（ASR/NR R-ASR-007）

- `api/subscription.ts`：新增 `SUBSCRIPTION_VERBOSE_LOGS` 开关；将 IAP 校验与订阅请求链路的详细 `console.log` 统一改为受控 debug 日志，生产默认不输出详细轨迹
- `docs/APP_REVIEW_ASR_NR_AUDIT_TRACKER.md`：`R-ASR-007` 更新为“修复中（server 侧继续收口）”，补充 Round 1.8 进展与证据
- `docs/CURRENT_TASK.md`：补充 Round 1.8 会话锚点

Validation:

- Not run (server logging policy + docs update)

### Fix: 收口 WKWebView `isInspectable` 发布配置（ASR/NR R-ASR-005）

- `ios/App/App/AppDelegate.swift`：将 `webView.isInspectable = true` 改为仅在 `#if DEBUG` 条件下开启，确保发布包默认关闭
- `docs/APP_REVIEW_ASR_NR_AUDIT_TRACKER.md`：`R-ASR-005` 标记为已修复；`2.5.1` 结论更新为符合并补充 Round 1.7 审核日志
- `docs/CURRENT_TASK.md`：新增 Round 1.7 会话记录，作为下一会话恢复锚点

Validation:

- Not run (iOS native config + docs update)

### Docs: iOS Review ASR/NR 交接基线补全

- `docs/IOS_REVIEW_ASR_NR_AUDIT_SPEC.md`：
  - 更新为 Round 1.6 handoff 版本
  - 新增「6.1 当前风险状态」：明确 `R-ASR-004/006` 已修复、`R-ASR-005` 未收敛、`R-ASR-007` 修复中
  - 新增「6.2 下一个会话接手清单」：约定下一位执行顺序与回填要求
- `docs/CURRENT_TASK.md`：新增交接锚点，指向 ASR/NR 规范文档中的接手清单

Validation:

- Not run (docs update only)

### Docs: ASR/NR 审计台账 Round 1.6 更新（代码证据口径）

- `docs/APP_REVIEW_ASR_NR_AUDIT_TRACKER.md`：
  - 审核进度更新为 28/52（待审 28）
  - 新增已审核条款：`4.5.4`（Push 规则）、`5.1.2`（数据使用/共享）
  - 回填代码证据：通知权限请求入口、提醒开关、隐私面板入口、API 访问边界
  - 新增提审前人工核对项：App Store Connect 隐私标签与第三方共享披露一致性
- `docs/CURRENT_TASK.md`：补充 Round 1.6 会话记录，作为后续会话恢复锚点

Validation:

- Not run (docs update only)

### Docs: 新增 ASR/NR 审计执行规范模板

- 新增 `docs/IOS_REVIEW_ASR_NR_AUDIT_SPEC.md`：
  - 明确以 `docs/ios review.txt` 作为 ASR/NR 规则基准
  - 固化代码证据驱动审计流程（条款抽取、逐条核验、风险分级、修复回填）
  - 提供可复用的轮次结论输出模板，便于新人接手与持续审计

Validation:

- Not run (docs only)

### Fix: 清理前端可见日志并统一 DEV 保护

- `src/store/useAuthStore.ts`：登出时日志改为 DEV-only
- `src/store/useReportStore.ts`：AI 日记完成日志改为 DEV-only
- `src/store/useAnnotationStore.ts`：批注触发/跳过/生成人设等前端日志改为 DEV-only
- `src/store/useStardustStore.ts`：珍藏重复与拉取数量日志改为 DEV-only
- `src/store/authDataSyncHelpers.ts`：本地数据同步成功日志改为 DEV-only
- `src/store/annotationHelpers.ts`：批注概率与冷却日志改为 DEV-only
- `src/lib/aiParser.ts`：提取策略与失败日志改为 DEV-only
- `docs/APP_REVIEW_ASR_NR_AUDIT_TRACKER.md`、`docs/CURRENT_TASK.md`：同步 Round 1.5 审计进展（`R-ASR-007` 更新为修复中）

Validation:

- Not run (frontend log gating + docs update)

### Fix: 删除账号文案统一为“立即删除” + 补齐 iOS 隐私清单

- `src/i18n/locales/{zh,en,it}.ts`：
  - 删除账号按钮文案统一为“立即删除”（`delete_account_button`）
  - 隐私政策数据留存口径统一改为“账号删除后立即永久删除”（`privacy_s5_body`）
- `ios/App/App/PrivacyInfo.xcprivacy`：新增 iOS 隐私清单（当前声明无追踪、无收集项，包含 `UserDefaults` 访问类别与 reason code）
- `ios/App/App.xcodeproj/project.pbxproj`：将 `PrivacyInfo.xcprivacy` 加入 App target 的 Resources
- `docs/APP_REVIEW_ASR_NR_AUDIT_TRACKER.md`、`docs/CURRENT_TASK.md`：同步 Round 1.4 审计状态，`R-ASR-006` 标记为已修复

Validation:

- Not run (copy + iOS manifest wiring)

### Fix: 移除 force onboarding 覆盖逻辑

- `src/App.tsx`：删除 `forceOnboarding=1`（query）与 `VITE_FORCE_ONBOARDING`（env）强制进入 onboarding 的全部分支，恢复为仅真实新用户进入 onboarding
- `docs/APP_REVIEW_ASR_NR_AUDIT_TRACKER.md`：将 `R-ASR-004` 更新为已修复，并记录 Round 1.3
- `docs/CURRENT_TASK.md`：补充本次修复记录

Validation:

- Not run (logic removal + docs update)

### Docs: ASR/NR 审计台账 Round 1.2 更新（代码证据口径）

- `docs/APP_REVIEW_ASR_NR_AUDIT_TRACKER.md`：
  - 审核进度更新为 26/52（待审 30）
  - 新增已审核条款：`2.4.2`、`2.5.3`、`2.5.4`、`2.5.6`、`2.5.9`、`2.5.11`、`2.5.12`、`2.5.13`、`2.5.16`、`2.5.17`、`2.5.18`
  - 回填已修复项：`2.1(a)`（Apple 登录占位 URI 已移除）、`5.1.1(v)`（删除账号改为直接硬删除链路）
  - 新增风险项：`R-ASR-004~007`（生产可触发 onboarding 覆盖开关、`isInspectable` 发布包开启、缺少 `PrivacyInfo.xcprivacy`、生产 `console.log`）
- `docs/CURRENT_TASK.md`：补充本轮审计结论与高风险待整改清单，作为会话恢复锚点

Validation:

- Not run (docs update only)

### Fix: 登录与新手引导登录使用统一吉祥物图片

- `src/features/auth/AuthPage.tsx`：将登录头部树苗图标从 `Sprout` 替换为图片资源 `/assets/auth-login-mascot.png`
- `src/features/onboarding/OnboardingFlow.tsx`：`StepAuth` 同步替换为同一图片资源，确保新用户/老用户登录界面一致

Validation:

- Not run (UI asset wiring only)

### Fix: 日记按钮“生成中”文案缩短并保留人设名

- `src/i18n/locales/zh.ts`：`report_generating` 改为 `{{companion}} 正在写日记...`，减少按钮占位宽度
- `src/i18n/locales/en.ts`：`report_generating` 改为 `{{companion}} is writing...`
- `src/i18n/locales/it.ts`：`report_generating` 改为 `{{companion}} sta scrivendo...`
- 影响范围：`ReportDetailModal` 与 `PlantFlipCard` 两处按钮继续复用同一 key，按当前人设显示 `Van/Agnes/Zep/Momo`

Validation:

- Not run (copy update only)

### Fix: 帮助与支持 FAQ 文案与真实交互对齐

- `src/i18n/locales/zh.ts`：将“AI 伴侣”统一为“AI 伙伴”；将“编辑/删除记录”改为分入口说明（消息点击删除、时间轴编辑活动时间与内容）；将“报告实时生成”改为“每日植物与今日日记 20:00 后可见/可生成”
- `src/features/profile/components/HelpSupportPanel.tsx`：Growth 分组新增 3 条 FAQ，补充“如何添加/编辑待办”“待办按钮作用（置顶/开始/专注/会员分步拆解）”“点击瓶子可查看打卡数据、生成待办、删除瓶子”
- `src/i18n/locales/en.ts`、`src/i18n/locales/it.ts`：补齐新增 FAQ keys（`help_q11~help_q13`）以保持三语 key 集一致
- `src/features/profile/components/HelpSupportPanel.tsx`：新增“联系我们”信息卡，显示支持邮箱并提供 `mailto:` 点击入口

Validation:

- Not run (copy update only)

### Fix: Onboarding 地区占位示例本地化并移除英文多余逗号感

- `src/i18n/locales/en.ts`：`onboarding2_routine_region_placeholder` 从 `e.g., Milan` 改为 `e.g. New York or London`，更贴近英文用户常见地区示例并去除 `e.g.` 后逗号
- `src/i18n/locales/it.ts`：`onboarding2_routine_region_placeholder` 从 `es. Roma` 改为 `es. Milano`

Validation:

- Not run (copy update only)

### Fix: 帮助与支持中文 FAQ 二次润色与去重

- `src/i18n/locales/zh.ts`：
  - `help_a1` 去除破折号，改为更连贯口语表述
  - `help_a4` 改为“点击消息卡片”可删除
  - `help_a11` 明确“可设置每天或每周重复”
  - `help_a12` 置顶文案改为“点击置顶按钮，可以把这一条待办置顶”
  - `help_a5` 去掉与瓶子问答重复的信息
- `src/features/profile/components/HelpSupportPanel.tsx`：Growth 分组移除“支持重复任务吗”与“瓶子里还可以做什么”两条显示项，避免重复

Validation:

- Not run (copy update only)

### Fix: 帮助与支持待办按钮文案定稿（分号节奏 + 分步完成 + 连续专注）

- `src/i18n/locales/zh.ts`：`help_a12` 调整为用户确认版本，统一使用分号连接动作说明，并将会员能力描述更新为“分步完成”+“点击闹钟开启按步骤连续专注模式”

Validation:

- Not run (copy update only)

### Fix: 帮助与支持“瓶子是什么”文案改为后续能力表达

- `src/i18n/locales/zh.ts`：`help_a5` 调整为单行文案，改为“后续将开放满瓶浇灌周报与月报植物能力，敬请期待”

Validation:

- Not run (copy update only)

### Fix: 帮助与支持三语文案对齐 + 联系方式降级为单行灰字

- `src/i18n/locales/en.ts`、`src/i18n/locales/it.ts`：FAQ 文案同步中文现状口径（AI 伙伴命名、消息卡片删除入口、20:00 可见规则、待办按钮说明、会员分步与连续专注）
- `src/i18n/locales/{zh,en,it}.ts`：联系文案改为仅“联系我们/Contact us/Contattaci + 邮箱”，移除“几个工作日回复”承诺
- `src/features/profile/components/HelpSupportPanel.tsx`：将联系方式从高显眼卡片改为底部一行灰色小字（含 `mailto:` 邮箱链接）

Validation:

- Not run (copy + style update)

### Fix: Onboarding 记录步骤 iOS 键盘弹出时输入区跟随上移

- `src/features/onboarding/components/StepJournal.tsx`：底部输入区容器新增 `padding-bottom: calc(env(safe-area-inset-bottom, 0px) + var(--keyboard-height, 0px))`，复用原生键盘高度变量，在 iOS 套壳键盘弹出时将输入框整体抬升，避免发送区被遮挡

Validation:

- Not run (UI behavior tweak; verify on iOS TestFlight)

### Fix: 日记按钮改为“当日仅一次”并在生成后置灰

- `src/features/report/plant/PlantRootSection.tsx`：植物翻卡“生成日记”入口增加统一可点击条件（20:00 后 + 当日未生成 + 非生成中），当日已生成时按钮置灰并阻止重复触发
- `src/features/report/plant/PlantFlipCard.tsx`：将“生成中”与“禁用”拆分为两个状态，避免禁用时误显示“生成中”文案
- `src/features/report/ReportDetailModal.tsx`：日记详情页现有“生成日记”按钮改为同一规则，20:00 前与已生成后均不可再次点击
- `src/store/useReportStore.ts`：`generateAIDiary` 增加幂等早退；已有 `aiAnalysis` 或 `teaserText` 时直接返回，防止重复生成

Validation:

- `npx tsc --noEmit` ✅

### Fix: 个人画像输入框提示文字字号下调至 10px

- `src/features/profile/components/UserProfilePanel.tsx`：为长期画像自由输入框新增 `placeholder:text-[10px]`，仅调整 placeholder 视觉字号，不影响已输入内容字号
- 补充：同一输入框实际输入文字字号同步下调为 `text-[10px]`

Validation:

- Not run (UI style tweak only)

## 2026-04-30

### Fix: 聊天编辑弹窗时间选择器支持 zh/en/it 日期显示

- `src/features/chat/EditInsertModal.tsx`：`datetime-local` 输入新增 `lang` 绑定，随 i18n 切换为 `zh-CN` / `en-US` / `it-IT`
- 增加 `normalizeUiLanguage(i18n.language)` 归一化，避免区域值导致英文回退

Validation:

- Not run (UI locale binding update)

### Fix: Apple 登录回调移除 placeholder URI

- `src/store/authStoreAccountActions.ts`：Apple OAuth 回调从硬编码 placeholder 改为 `resolveOAuthRedirectUrl()`
- 新增防御校验：空值或 placeholder 直接返回 `Invalid Apple OAuth redirect URI`

Validation:

- Not run (auth config + runtime guard update)

### Fix: 删除账号改为立即执行服务端硬删除

- `src/features/profile/components/DeleteAccountModal.tsx`：确认后直接调用 `callDeleteAccountAPI()`，不再仅标记 pending
- `src/store/useAuthStore.ts`：修复 pending 删除分支（未到期不清标记；到期失败保留重试）
- `src/i18n/locales/{zh,en,it}.ts`：删除账号文案改为“立即永久删除且不可恢复”

Validation:

- Not run (account deletion flow update)

### Fix: Magic Pen 活动重叠校验改为“允许 ongoing、拦截 ended”

- `src/services/input/magicPenDraftBuilder.ts`：移除 ongoing 冲突拦截；新增 ended 冲突拦截
- `src/store/magicPenActions.test.ts`、`src/services/input/magicPenDraftBuilder.test.ts`：同步回归覆盖

Validation:

- `npx vitest run src/store/magicPenActions.test.ts` ✅
- `npx vitest run src/services/input/magicPenDraftBuilder.test.ts` ⚠️（仓库既有时区断言问题）

## 2026-04-29

### Fix: 日记入口与当日实时统计恢复

- `src/features/report/ReportDetailModal.tsx`：恢复“生成日记”入口，20:00 前提示、20:00 后可生成
- `src/features/report/DiaryBookViewer.tsx`：放开今日日历页双击进入详情
- `src/features/report/plant/{PlantFlipCard,PlantRootSection}.tsx`：恢复“保存卡片 + 生成日记”双按钮
- 今日日记页统计改为实时口径：接入 `useTodoStore`、`useGrowthStore` 和 `computeDailyTodoStats(...)`

Validation:

- `npx tsc --noEmit` ✅

### Fix: Telemetry 默认时间窗口统一为 7 天

- `src/features/telemetry/*TelemetryPage.tsx`：默认 `days` 统一为 7
- `src/api/client.ts`：telemetry dashboard 默认参数统一改为 7

Validation:

- Not run (default-window update)

### Update: Telemetry 审计与看板注释补齐

- 新增审计报告：`docs/Telemetry_Audit_Report_2026-04-29.doc`
- `LiveInputTelemetryPage`、`UserAnalyticsDashboardPage`、`FeedbackTelemetryPage`、`AiAnnotationTelemetryPage` 补齐 PM 注释与解释文案
- `src/i18n/locales/{zh,en,it}.ts` 同步新增对应三语词条

Validation:

- Not run (report + dashboard copy update)

### Fix: 三语一致性与 Prompt 对齐收口

- `src/i18n/locales/{zh,en,it}.ts`：完成 key/占位符一致性巡检并修复差异
- `src/server/magic-pen-prompts.ts`、`api/diary.ts`：补齐 en/it prompt 与中文约束对齐
- `src/lib/aiCompanion/prompts/{van,agnes,zep,momo}.ts`：四人设日记 prompt 三语语义对齐
- `src/lib/aiCompanion.ts`：统一追加语言硬约束，覆盖 diary + annotation

Validation:

- `npx tsc --noEmit` ✅

### Fix: 会员分类与跨天补偿相关收口

- `api/classify.ts`：去除 matched_bottle 阈值提示，补上位-下位映射规则
- `src/hooks/useMidnightAutoGenerate.ts`：补登录后与前台恢复补偿，新增 warmup 与稀疏 stats 修复
- `src/features/onboarding/OnboardingFlow.tsx`：试用会员改为点击 CTA 后激活

Validation:

- `npx tsc --noEmit` ✅

### Fix: iOS 体验与稳定性收口

- `src/features/chat/EditInsertModal.tsx`：移动端弹窗改四角圆角浮层并补 safe-area 底部留缝
- `src/features/profile/components/RegionSettingsPanel.tsx`：地区保存后回填输入框（优先 `location_label`）
- `src/features/growth/SubTodoList.tsx`：子步骤长文案支持两行 + 点击查看全文

Validation:

- `npx tsc --noEmit` ✅
