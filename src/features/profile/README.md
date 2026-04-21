# Profile Module

## Entry

- Page entry: `src/features/profile/ProfilePage.tsx`

## Public Interface

- Route: `/profile`, `/upgrade`
- Main user flows:
  - User identity: avatar upload (resized to 160px), display name editing
  - AI companion selection: 4 personas (`van`, `agnes`, `zep`, `momo`) with free/PLUS tiers
  - AI annotation sensitivity: 3-level drop-rate selector (low/medium/high)
  - Daily goal toggle: enable/disable daily goal popup in `/growth`
  - Routine settings panel (free): edit wake/sleep/meal-time inputs (`user_metadata.user_profile_v2.manual`)
  - AI personal memory (Plus-only): enable/disable long-term memory pipeline (`user_metadata.long_term_profile_enabled`) and edit memory free text (`user_metadata.user_profile_v2.manual.freeText`)
  - User profile snapshot card: show meal-time hints, upcoming anniversaries, and latest recall moment from `buildUserProfileSnapshot(...)`
  - Plant direction customization: 5-slot mapping of activity categories to plant root positions
  - Membership display: FREE/PLUS tier feature matrix with upgrade CTA
  - Account controls: help, privacy, about, logout, admin-only telemetry link

## Component Hierarchy

```
ProfilePage
├── UserInfoCard (avatar, name, streak, stats)
├── AIModeSection (companion toggle + selection)
├── AIAnnotationDropRate (sensitivity control)
├── DailyGoalToggle
├── RoutineSettingsPanel (wake/sleep/meal editor)
├── LongTermProfileToggle (Plus-only)
├── UserProfilePanel (AI memory freeText editor, Plus-only)
├── UserProfileInsightsCard (snapshot overview)
├── MembershipCard (tier display)
├── DirectionSettingsPanel (plant root mapping)
└── SettingsList (account actions)

UpgradePage
├── Plan switcher (monthly / annual)
├── Feature list (reuses MembershipCard feature keys)
└── Payment CTA (build-time `@payment` adapter)
```

## Upstream Dependencies

- Stores:
  - `src/store/useAuthStore.ts` (user, preferences, isPlus, updatePreferences, updateAvatar, signOut)
  - `src/store/useChatStore.ts` (messages for daily activity count)
  - `src/store/useGrowthStore.ts` (bottles for completed goals count)
  - `src/store/usePlantStore.ts` (directionOrder, setDirectionOrder)
- Helpers:
  - `src/lib/imageUtils.ts` (resizeImageToDataUrl)
  - `src/constants/aiCompanion.ts` (ai_CompanionVisuals: avatar URLs, names, free/paid flags)
- API: `src/api/supabase.ts` (auth.updateUser for display name, auth.getUser for refresh)

## Key Business Logic

- **AI personas**: van (free), agnes/zep/momo (PLUS); selection stored in `preferences.aiMode`
- **Annotation drop-rate**: controls AI extraction aggressiveness; medium/high gated behind PLUS
- **Routine settings**: wake/sleep/meal-time fields are editable for all users and persisted in `manual`
- **AI personal memory**: Plus-only; `isPlus && longTermProfileEnabled` controls whether profile snapshot is injected into annotation/suggestion prompt chain and whether weekly extraction runs
- **Life goal sync**: `manual.lifeGoal` is shared with Growth-side life goal panel (two-way sync via `useAuthStore.updateUserProfile()`)
- **Weekly streak**: calculated from Supabase messages table (7-day login history)
- **Direction settings**: maps 5 `PlantCategoryKey` values (work_study, exercise, social, entertainment, life) to plant root positions; saved via `usePlantStore.setDirectionOrder()`

## Downstream Impact

- AI mode preference affects annotation prompts (`/api/annotation`), diary prompts (`/api/diary`), and plant diary prompts (`/api/plant-diary`)
- Daily goal toggle controls popup visibility in `/growth` GrowthPage
- Direction settings affect plant root rendering in `/report` PlantRootSection
- Avatar and display name changes reflect across all features via `useAuthStore.user`

## Related Docs

- `LLM.md`
- `docs/PROJECT_MAP.md`
- `docs/CURRENT_TASK.md`
