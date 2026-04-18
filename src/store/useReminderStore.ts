// DOC-DEPS: LLM.md -> docs/PROACTIVE_REMINDER_SPEC.md -> src/services/reminder/reminderTypes.ts
import { create } from 'zustand';
import type { ReminderType } from '../services/reminder/reminderTypes';

// ─────────────────────────────────────────────
// 状态定义
// ─────────────────────────────────────────────

interface ReminderState {
  /** 当日已响应的提醒类型集合 */
  confirmedToday: Set<ReminderType>;
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

// ─────────────────────────────────────────────
// 每日重置 key
// ─────────────────────────────────────────────

const CONFIRMED_KEY = 'reminder_confirmed_today';
const CONFIRMED_DATE_KEY = 'reminder_confirmed_date';

function loadConfirmedToday(): Set<ReminderType> {
  const today = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem(CONFIRMED_DATE_KEY) !== today) {
    localStorage.removeItem(CONFIRMED_KEY);
    localStorage.setItem(CONFIRMED_DATE_KEY, today);
    return new Set();
  }
  try {
    const raw = localStorage.getItem(CONFIRMED_KEY);
    return raw ? new Set(JSON.parse(raw) as ReminderType[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveConfirmedToday(set: Set<ReminderType>): void {
  localStorage.setItem(CONFIRMED_KEY, JSON.stringify([...set]));
}

// ─────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────

export const useReminderStore = create<ReminderState>((set, get) => ({
  confirmedToday: loadConfirmedToday(),
  activePopupType: null,
  lastSessionActivity: null,
  showQuickPicker: false,
  pickerContext: null,

  markConfirmed: (type) => {
    const next = new Set(get().confirmedToday);
    next.add(type);
    saveConfirmedToday(next);
    set({ confirmedToday: next, activePopupType: null });
  },

  showPopup: (type) => {
    set({ activePopupType: type });
  },

  hidePopup: () => {
    set({ activePopupType: null });
  },

  shouldSkipReminder: (type) => {
    return get().confirmedToday.has(type);
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
    const fresh = new Set<ReminderType>();
    saveConfirmedToday(fresh);
    set({ confirmedToday: fresh });
  },
}));
