// DOC-DEPS: LLM.md -> docs/PROACTIVE_REMINDER_SPEC.md -> src/services/reminder/reminderTypes.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ReminderType } from '../services/reminder/reminderTypes';
import {
  isOccurrenceForType,
  resolveReminderOccurrence,
  type ReminderOccurrence,
  type ReminderResponseKind,
  type ReminderResponseRecord,
} from '../services/reminder/reminderResponse';
import {
  fetchReminderResponses,
  upsertReminderResponse,
} from '../api/reminderResponses';
import { cancelReminderOccurrence } from '../services/notifications/localNotificationService';
import { PERSIST_KEYS } from './persistKeys';
import { createScopedJSONStorage } from './scopedPersistStorage';

// ─────────────────────────────────────────────
// 状态定义
// ─────────────────────────────────────────────

interface ReminderState {
  /** 当日已响应的提醒类型集合 */
  confirmedToday: Set<ReminderType>;
  /** 当日已响应的具体提醒 occurrence key */
  confirmedOccurrenceKeys: Set<string>;
  /** confirmedToday 对应的日期键（本地日历日） */
  confirmedDate: string;
  /** 当前正在展示的前台弹窗提醒类型（null = 无） */
  activePopupType: ReminderType | null;
  activePopupOccurrence: ReminderOccurrence | null;
  /** 最近一次活动记录（用于 session_check） */
  lastSessionActivity: {
    activityType?: string;
    content?: string;
    timestamp?: number;
  } | null;
  /** 是否显示 QuickActivityPicker */
  showQuickPicker: boolean;
  pickerContext: {
    activityType?: string;
    reminderType?: ReminderType;
    occurrence?: ReminderOccurrence;
  } | null;

  // Actions
  markConfirmed: (type: ReminderType, occurrence?: ReminderOccurrence | null) => void;
  recordResponse: (
    type: ReminderType,
    options: {
      userId?: string | null;
      responseKind: ReminderResponseKind;
      occurrence?: ReminderOccurrence | null;
    },
  ) => Promise<void>;
  mergeCloudResponse: (response: ReminderResponseRecord) => void;
  syncCloudResponses: (userId: string) => Promise<void>;
  showPopup: (type: ReminderType, occurrence?: ReminderOccurrence | null) => void;
  hidePopup: () => void;
  shouldSkipReminder: (type: ReminderType, occurrenceKey?: string | null) => boolean;
  setLastSessionActivity: (act: { activityType?: string; content?: string; timestamp?: number }) => void;
  showPickerForDeny: (
    activityType?: string,
    reminderType?: ReminderType,
    occurrence?: ReminderOccurrence,
  ) => void;
  hidePicker: () => void;
  resetForNewDay: () => void;
  rearmReminders: (types: ReminderType[]) => void;
}

interface ReminderPersistedState {
  confirmedToday: ReminderType[];
  confirmedOccurrenceKeys: string[];
  confirmedDate: string;
}

const REMINDER_PERSIST_KEY = PERSIST_KEYS.reminder;
const LEGACY_CONFIRMED_KEY = 'reminder_confirmed_today';
const LEGACY_CONFIRMED_DATE_KEY = 'reminder_confirmed_date';

function getTodayDateStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function resolveConfirmedSet(confirmedDate: string, confirmedToday: ReminderType[]): Set<ReminderType> {
  if (confirmedDate !== getTodayDateStr()) {
    return new Set();
  }
  return new Set(confirmedToday);
}

function buildFreshDayState(): Pick<
  ReminderState,
  'confirmedToday' | 'confirmedOccurrenceKeys' | 'confirmedDate'
> {
  return {
    confirmedToday: new Set<ReminderType>(),
    confirmedOccurrenceKeys: new Set<string>(),
    confirmedDate: getTodayDateStr(),
  };
}

function hasConfirmedOccurrenceForType(
  occurrenceKeys: Set<string>,
  type: ReminderType,
): boolean {
  return Array.from(occurrenceKeys).some((key) => isOccurrenceForType(key, type));
}

function readLegacyPersistedState(): ReminderPersistedState | null {
  if (typeof window === 'undefined') return null;
  try {
    const confirmedDateRaw = window.localStorage.getItem(LEGACY_CONFIRMED_DATE_KEY);
    const confirmedTodayRaw = window.localStorage.getItem(LEGACY_CONFIRMED_KEY);
    if (!confirmedDateRaw && !confirmedTodayRaw) return null;

    const confirmedToday = confirmedTodayRaw
      ? (JSON.parse(confirmedTodayRaw) as ReminderType[])
      : [];
    const confirmedDate = typeof confirmedDateRaw === 'string' && confirmedDateRaw
      ? confirmedDateRaw
      : getTodayDateStr();

    window.localStorage.removeItem(LEGACY_CONFIRMED_KEY);
    window.localStorage.removeItem(LEGACY_CONFIRMED_DATE_KEY);

    return {
      confirmedToday: Array.isArray(confirmedToday) ? confirmedToday : [],
      confirmedOccurrenceKeys: [],
      confirmedDate,
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────

export const useReminderStore = create<ReminderState>()(
  persist(
    (set, get) => ({
      ...buildFreshDayState(),
      activePopupType: null,
      activePopupOccurrence: null,
      lastSessionActivity: null,
      showQuickPicker: false,
      pickerContext: null,

      markConfirmed: (type, occurrence) => {
        const state = get();
        const today = getTodayDateStr();
        const baseSet = state.confirmedDate === today
          ? new Set(state.confirmedToday)
          : new Set<ReminderType>();
        const occurrenceKeys = state.confirmedDate === today
          ? new Set(state.confirmedOccurrenceKeys)
          : new Set<string>();
        baseSet.add(type);
        if (occurrence) occurrenceKeys.add(occurrence.occurrenceKey);
        set({
          confirmedToday: baseSet,
          confirmedOccurrenceKeys: occurrenceKeys,
          confirmedDate: today,
          activePopupType: null,
          activePopupOccurrence: null,
        });
      },

      recordResponse: async (type, options) => {
        const occurrence = resolveReminderOccurrence(type, options.occurrence);
        const response = {
          ...occurrence,
          reminderType: type,
          responseKind: options.responseKind,
          respondedAt: new Date().toISOString(),
        };
        get().markConfirmed(type, occurrence);
        if (!options.userId) return;

        try {
          await upsertReminderResponse(options.userId, response);
        } catch {
          const { useOutboxStore } = await import('./useOutboxStore');
          useOutboxStore.getState().enqueue({
            kind: 'reminder.response',
            payload: { response },
            consecutiveFailures: 0,
          });
        }
      },

      mergeCloudResponse: (response) => {
        if (response.occurrenceDate !== getTodayDateStr()) return;
        const state = get();
        const confirmedToday = state.confirmedDate === response.occurrenceDate
          ? new Set(state.confirmedToday)
          : new Set<ReminderType>();
        const confirmedOccurrenceKeys = state.confirmedDate === response.occurrenceDate
          ? new Set(state.confirmedOccurrenceKeys)
          : new Set<string>();
        confirmedToday.add(response.reminderType);
        confirmedOccurrenceKeys.add(response.occurrenceKey);
        const popupMatches = state.activePopupOccurrence?.occurrenceKey === response.occurrenceKey;
        const pickerMatches = state.pickerContext?.occurrence?.occurrenceKey === response.occurrenceKey;
        set({
          confirmedToday,
          confirmedOccurrenceKeys,
          confirmedDate: response.occurrenceDate,
          activePopupType: popupMatches ? null : state.activePopupType,
          activePopupOccurrence: popupMatches ? null : state.activePopupOccurrence,
          showQuickPicker: pickerMatches ? false : state.showQuickPicker,
          pickerContext: pickerMatches ? null : state.pickerContext,
        });
      },

      syncCloudResponses: async (userId) => {
        const responses = await fetchReminderResponses(userId, getTodayDateStr());
        responses.forEach((response) => get().mergeCloudResponse(response));
        await Promise.all(
          responses.map((response) => cancelReminderOccurrence(response.occurrenceKey)),
        );
      },

      showPopup: (type, occurrence) => {
        set({ activePopupType: type, activePopupOccurrence: occurrence ?? null });
      },

      hidePopup: () => {
        set({ activePopupType: null, activePopupOccurrence: null });
      },

      shouldSkipReminder: (type, occurrenceKey) => {
        const state = get();
        const today = getTodayDateStr();
        if (state.confirmedDate !== today) return false;
        if (occurrenceKey) {
          if (state.confirmedOccurrenceKeys.has(occurrenceKey)) return true;
          return state.confirmedToday.has(type)
            && !hasConfirmedOccurrenceForType(state.confirmedOccurrenceKeys, type);
        }
        return state.confirmedToday.has(type);
      },

      setLastSessionActivity: (act) => {
        set({ lastSessionActivity: act });
      },

      showPickerForDeny: (activityType, reminderType, occurrence) => {
        set({
          showQuickPicker: true,
          pickerContext: { activityType, reminderType, occurrence },
          activePopupType: null,
          activePopupOccurrence: null,
        });
      },

      hidePicker: () => {
        set({ showQuickPicker: false, pickerContext: null });
      },

      resetForNewDay: () => {
        set(buildFreshDayState());
      },

      rearmReminders: (types) => {
        const state = get();
        const today = getTodayDateStr();
        const nextConfirmed = state.confirmedDate === today
          ? new Set(state.confirmedToday)
          : new Set<ReminderType>();
        const nextOccurrenceKeys = state.confirmedDate === today
          ? new Set(state.confirmedOccurrenceKeys)
          : new Set<string>();
        types.forEach((type) => nextConfirmed.delete(type));
        for (const key of nextOccurrenceKeys) {
          if (types.some((type) => isOccurrenceForType(key, type))) {
            nextOccurrenceKeys.delete(key);
          }
        }
        set({
          confirmedToday: nextConfirmed,
          confirmedOccurrenceKeys: nextOccurrenceKeys,
          confirmedDate: today,
          activePopupType: state.activePopupType && types.includes(state.activePopupType)
            ? null
            : state.activePopupType,
          activePopupOccurrence: state.activePopupType && types.includes(state.activePopupType)
            ? null
            : state.activePopupOccurrence,
        });
      },
    }),
    {
      name: REMINDER_PERSIST_KEY,
      storage: createScopedJSONStorage<ReminderPersistedState>('reminder'),
      skipHydration: true,
      partialize: (state) => ({
        confirmedToday: Array.from(state.confirmedToday),
        confirmedOccurrenceKeys: Array.from(state.confirmedOccurrenceKeys),
        confirmedDate: state.confirmedDate,
      }),
      merge: (persistedState, currentState) => {
        const current = currentState as ReminderState;
        const persisted = (persistedState as Partial<ReminderPersistedState>) || {};
        const legacy = readLegacyPersistedState();
        const mergedSource = {
          confirmedToday: Array.isArray(persisted.confirmedToday)
            ? persisted.confirmedToday
            : legacy?.confirmedToday,
          confirmedDate: typeof persisted.confirmedDate === 'string'
            ? persisted.confirmedDate
            : legacy?.confirmedDate,
        };
        const persistedDate = typeof persisted.confirmedDate === 'string'
          ? persisted.confirmedDate
          : typeof mergedSource.confirmedDate === 'string'
            ? mergedSource.confirmedDate
          : getTodayDateStr();
        const persistedConfirmedToday = Array.isArray(mergedSource.confirmedToday)
          ? mergedSource.confirmedToday
          : [];
        const today = getTodayDateStr();

        return {
          ...current,
          confirmedToday: resolveConfirmedSet(persistedDate, persistedConfirmedToday),
          confirmedOccurrenceKeys: persistedDate === today
            ? new Set(Array.isArray(persisted.confirmedOccurrenceKeys)
              ? persisted.confirmedOccurrenceKeys
              : [])
            : new Set<string>(),
          confirmedDate: persistedDate === today ? persistedDate : today,
        };
      },
    },
  ),
);
