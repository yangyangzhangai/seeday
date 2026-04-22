// DOC-DEPS: LLM.md -> docs/PROACTIVE_REMINDER_SPEC.md -> src/services/reminder/reminderTypes.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ReminderType } from '../services/reminder/reminderTypes';

// ─────────────────────────────────────────────
// 状态定义
// ─────────────────────────────────────────────

interface ReminderState {
  /** 当日已响应的提醒类型集合 */
  confirmedToday: Set<ReminderType>;
  /** confirmedToday 对应的日期键（本地日历日） */
  confirmedDate: string;
  /** 当前正在展示的前台弹窗提醒类型（null = 无） */
  activePopupType: ReminderType | null;
  /** 最近一次活动记录（用于 session_check） */
  lastSessionActivity: {
    activityType?: string;
    content?: string;
    timestamp?: number;
  } | null;
  /** 是否显示 QuickActivityPicker */
  showQuickPicker: boolean;
  pickerContext: { activityType?: string } | null;

  // Actions
  markConfirmed: (type: ReminderType) => void;
  showPopup: (type: ReminderType) => void;
  hidePopup: () => void;
  shouldSkipReminder: (type: ReminderType) => boolean;
  setLastSessionActivity: (act: { activityType?: string; content?: string; timestamp?: number }) => void;
  showPickerForDeny: (activityType?: string) => void;
  hidePicker: () => void;
  resetForNewDay: () => void;
}

interface ReminderPersistedState {
  confirmedToday: ReminderType[];
  confirmedDate: string;
}

const REMINDER_PERSIST_KEY = 'seeday:v1:reminder';
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

function buildFreshDayState(): Pick<ReminderState, 'confirmedToday' | 'confirmedDate'> {
  return {
    confirmedToday: new Set<ReminderType>(),
    confirmedDate: getTodayDateStr(),
  };
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
      lastSessionActivity: null,
      showQuickPicker: false,
      pickerContext: null,

      markConfirmed: (type) => {
        const state = get();
        const today = getTodayDateStr();
        const baseSet = state.confirmedDate === today
          ? new Set(state.confirmedToday)
          : new Set<ReminderType>();
        baseSet.add(type);
        set({ confirmedToday: baseSet, confirmedDate: today, activePopupType: null });
      },

      showPopup: (type) => {
        set({ activePopupType: type });
      },

      hidePopup: () => {
        set({ activePopupType: null });
      },

      shouldSkipReminder: (type) => {
        const state = get();
        const today = getTodayDateStr();
        if (state.confirmedDate !== today) return false;
        return state.confirmedToday.has(type);
      },

      setLastSessionActivity: (act) => {
        set({ lastSessionActivity: act });
      },

      showPickerForDeny: (activityType) => {
        set({ showQuickPicker: true, pickerContext: { activityType }, activePopupType: null });
      },

      hidePicker: () => {
        set({ showQuickPicker: false, pickerContext: null });
      },

      resetForNewDay: () => {
        set(buildFreshDayState());
      },
    }),
    {
      name: REMINDER_PERSIST_KEY,
      partialize: (state) => ({
        confirmedToday: Array.from(state.confirmedToday),
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
          confirmedDate: persistedDate === today ? persistedDate : today,
        };
      },
    },
  ),
);
