// DOC-DEPS: LLM.md -> docs/PROACTIVE_REMINDER_SPEC.md -> src/services/notifications/localNotificationService.ts
/**
 * App 级别的提醒系统 Hook
 * - App 启动：注册通知类别 → 调度今日提醒
 * - App 前后台切换：调度/取消 idle nudge
 * - 前台时：到时间弹 App 内弹窗
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { App as CapApp } from '@capacitor/app';
import { useAuthStore } from '../store/useAuthStore';
import { useReminderStore } from '../store/useReminderStore';
import { usePlantStore } from '../store/usePlantStore';
import { useReportStore } from '../store/useReportStore';
import { useChatStore } from '../store/useChatStore';
import { isSameDay } from 'date-fns';
import {
  registerNotificationCategories,
  scheduleIdleNudge,
  cancelIdleNudge,
  cancelAllNotifications,
  setupNotificationActionListener,
} from '../services/notifications/localNotificationService';
import { scheduleRemindersForToday } from '../services/reminder/reminderScheduler';
import { getReminderCopy } from '../services/reminder/reminderCopy';
import type { UserProfileManualV2 } from '../types/userProfile';
import type { ReminderType } from '../services/reminder/reminderTypes';
import { useTimingStore } from '../store/useTimingStore';
import type { TimingType } from '../services/timing/timingSessionService';
import { getPendingProfileWrite } from '../store/authProfileHelpers';
import type { ActivityRecordType } from '../lib/activityType';

// ─────────────────────────────────────────────
// 工具：判断植物/日记今日是否已生成
// ─────────────────────────────────────────────

function isPlantDoneToday(todayPlant: { date: string } | null): boolean {
  if (!todayPlant) return false;
  const now = new Date();
  const [y, m, d] = todayPlant.date.split('-').map(Number);
  return y === now.getFullYear() && m === now.getMonth() + 1 && d === now.getDate();
}

function isDiaryDoneToday(reports: { type: string; date: string; aiAnalysis?: string | null }[]): boolean {
  const now = new Date();
  return reports.some(
    (r) => r.type === 'daily' && isSameDay(new Date(r.date), now) && !!r.aiAnalysis,
  );
}

// ─────────────────────────────────────────────
// 提醒类型 → 计时动作映射
// ─────────────────────────────────────────────

type TimingAction =
  | { kind: 'start'; type: TimingType }
  | { kind: 'end' }
  | null;

function getTimingAction(reminderType: ReminderType): TimingAction {
  switch (reminderType) {
    case 'work_start':
    case 'class_morning_start':
    case 'class_afternoon_start':
    case 'class_evening_start':
      return { kind: 'start', type: 'work' };
    case 'lunch_start':
    case 'meal_lunch':
      return { kind: 'start', type: 'lunch' };
    case 'lunch_end':
      return { kind: 'start', type: 'work' };
    case 'work_end':
    case 'class_morning_end':
    case 'class_afternoon_end':
    case 'class_evening_end':
      return { kind: 'end' };
    case 'meal_dinner':
      return { kind: 'start', type: 'dinner' };
    case 'sleep':
      return { kind: 'end' };
    default:
      return null;
  }
}

// ─────────────────────────────────────────────
// 前台定时检查（用于在 App 内直接弹窗）
// ─────────────────────────────────────────────

interface ScheduleEntry {
  type: ReminderType;
  triggerTime: Date;
}

interface PendingReminderConfirm {
  type: ReminderType;
  ts: number;
}

interface ReminderQuickRecordPreset {
  content: string;
  activityType: ActivityRecordType;
}

interface UseReminderSystemResult {
  confirmReminderFromPopup: (type: ReminderType) => Promise<void>;
}

const ROUTINE_STORAGE_PREFIX = 'profile:routine:v1:';
const TIME_TEXT_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const PENDING_REMINDER_CONFIRM_KEY = 'reminder_pending_confirms_v1';
const REMINDER_CONFIRM_DEDUP_KEY = 'reminder_confirm_dedup_v1';
const REMINDER_CONFIRM_DEDUP_MS = 45_000;

interface LocalRoutineSnapshot {
  wakeTime: string;
  sleepTime: string;
  breakfastTime: string;
  lunchTime: string;
  dinnerTime: string;
  reminderEnabled?: boolean;
}

function normalizeTimeText(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const value = raw.trim();
  return TIME_TEXT_PATTERN.test(value) ? value : undefined;
}

function normalizeManualForReminder(raw: UserProfileManualV2 | null | undefined): UserProfileManualV2 | null {
  if (!raw) return null;
  const mealTimesText = Array.isArray(raw.mealTimesText)
    ? raw.mealTimesText.map((item) => normalizeTimeText(item)).filter((item): item is string => Boolean(item))
    : [];

  const wakeTime = normalizeTimeText(raw.wakeTime);
  const sleepTime = normalizeTimeText(raw.sleepTime);
  const lunchTime = normalizeTimeText(raw.lunchTime) ?? mealTimesText[1];
  const dinnerTime = normalizeTimeText(raw.dinnerTime) ?? mealTimesText[2];

  return {
    ...raw,
    ...(wakeTime ? { wakeTime } : {}),
    ...(sleepTime ? { sleepTime } : {}),
    ...(lunchTime ? { lunchTime } : {}),
    ...(dinnerTime ? { dinnerTime } : {}),
    ...(mealTimesText.length > 0 ? { mealTimesText } : {}),
  };
}

function readLocalRoutineSnapshot(userId: string | null | undefined): LocalRoutineSnapshot | null {
  if (typeof window === 'undefined') return null;
  const key = `${ROUTINE_STORAGE_PREFIX}${userId || 'guest'}`;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<LocalRoutineSnapshot>;
    const wakeTime = normalizeTimeText(value.wakeTime);
    const sleepTime = normalizeTimeText(value.sleepTime);
    const breakfastTime = normalizeTimeText(value.breakfastTime);
    const lunchTime = normalizeTimeText(value.lunchTime);
    const dinnerTime = normalizeTimeText(value.dinnerTime);
    if (!wakeTime || !sleepTime || !breakfastTime || !lunchTime || !dinnerTime) return null;
    const reminderEnabled = typeof value.reminderEnabled === 'boolean' ? value.reminderEnabled : undefined;
    return {
      wakeTime,
      sleepTime,
      breakfastTime,
      lunchTime,
      dinnerTime,
      ...(typeof reminderEnabled === 'boolean' ? { reminderEnabled } : {}),
    };
  } catch {
    return null;
  }
}

function buildReminderManualFromLocalSnapshot(userId: string | null | undefined): UserProfileManualV2 | null {
  const snapshot = readLocalRoutineSnapshot(userId);
  if (!snapshot) return null;
  return {
    wakeTime: snapshot.wakeTime,
    sleepTime: snapshot.sleepTime,
    lunchTime: snapshot.lunchTime,
    dinnerTime: snapshot.dinnerTime,
    mealTimesText: [snapshot.breakfastTime, snapshot.lunchTime, snapshot.dinnerTime],
    ...(typeof snapshot.reminderEnabled === 'boolean' ? { reminderEnabled: snapshot.reminderEnabled } : {}),
  };
}

function buildFrontendCheckSchedule(manual: UserProfileManualV2): ScheduleEntry[] {
  const entries: ScheduleEntry[] = [];

  const addEntry = (type: ReminderType, hhmm: string | undefined) => {
    if (!hhmm) return;
    const [hh, mm] = hhmm.split(':').map(Number);
    const t = new Date();
    t.setHours(hh, mm, 0, 0);
    if (t > new Date()) entries.push({ type, triggerTime: t });
  };

  const day = new Date().getDay();
  const isWeekend = day === 0 || day === 6;

  if (isWeekend) {
    addEntry('weekend_morning_check', '10:00');
    addEntry('weekend_afternoon_check', '16:00');
    addEntry('weekend_evening_check', '20:00');
  } else {
    addEntry('wake', manual.wakeTime);
    if (manual.hasWorkSchedule) {
      addEntry('work_start', manual.workStart);
      addEntry('lunch_start', manual.lunchStart);
      addEntry('lunch_end', manual.lunchEnd);
      addEntry('work_end', manual.workEnd);
    } else {
      addEntry('meal_lunch', manual.lunchTime);
    }
    addEntry('meal_dinner', manual.dinnerTime);
    addEntry('sleep', manual.sleepTime);
    addEntry('evening_check', '20:00');
  }

  return entries.sort((a, b) => a.triggerTime.getTime() - b.triggerTime.getTime());
}

function getReminderQuickRecordPreset(type: ReminderType): ReminderQuickRecordPreset | null {
  switch (type) {
    case 'wake':
      return { content: '起床', activityType: 'life' };
    case 'work_start':
      return { content: '开始工作', activityType: 'work' };
    case 'lunch_start':
    case 'meal_lunch':
      return { content: '开始吃午饭', activityType: 'life' };
    case 'lunch_end':
      return { content: '午休结束，继续工作', activityType: 'work' };
    case 'class_morning_start':
      return { content: '开始上午课程', activityType: 'study' };
    case 'class_afternoon_start':
      return { content: '开始下午课程', activityType: 'study' };
    case 'class_evening_start':
      return { content: '开始晚间课程', activityType: 'study' };
    case 'meal_dinner':
      return { content: '开始吃晚饭', activityType: 'life' };
    default:
      return null;
  }
}

function readPendingReminderConfirms(): PendingReminderConfirm[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PENDING_REMINDER_CONFIRM_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Partial<PendingReminderConfirm>>;
    return parsed
      .map((item) => ({ type: item.type, ts: Number(item.ts) }))
      .filter((item): item is PendingReminderConfirm => {
        return typeof item.type === 'string' && Number.isFinite(item.ts);
      });
  } catch {
    return [];
  }
}

function writePendingReminderConfirms(list: PendingReminderConfirm[]): void {
  if (typeof window === 'undefined') return;
  if (list.length === 0) {
    window.localStorage.removeItem(PENDING_REMINDER_CONFIRM_KEY);
    return;
  }
  window.localStorage.setItem(PENDING_REMINDER_CONFIRM_KEY, JSON.stringify(list.slice(-20)));
}

function enqueuePendingReminderConfirm(type: ReminderType, ts: number): void {
  const queue = readPendingReminderConfirms();
  queue.push({ type, ts });
  writePendingReminderConfirms(queue);
}

function shouldProcessReminderConfirm(type: ReminderType, ts: number): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(REMINDER_CONFIRM_DEDUP_KEY);
    const map = raw ? JSON.parse(raw) as Record<string, number> : {};
    const last = Number(map[type] ?? 0);
    if (Number.isFinite(last) && ts - last < REMINDER_CONFIRM_DEDUP_MS) {
      return false;
    }
    map[type] = ts;
    window.localStorage.setItem(REMINDER_CONFIRM_DEDUP_KEY, JSON.stringify(map));
    return true;
  } catch {
    return true;
  }
}

async function endLatestActiveRecordCard(): Promise<void> {
  const chat = useChatStore.getState();
  const activeRecord = [...chat.messages]
    .reverse()
    .find((item) => item.mode === 'record' && !item.isMood && item.duration === undefined);
  if (!activeRecord) return;
  await chat.endActivity(activeRecord.id, { skipBottleStar: true });
}

export function useReminderSystem(navigate: (path: string) => void): UseReminderSystemResult {
  const user = useAuthStore((s) => s.user);
  const preferences = useAuthStore((s) => s.preferences);
  const userProfileV2 = useAuthStore((s) => s.userProfileV2);
  const { showPopup, shouldSkipReminder } = useReminderStore();
  const navigateRef = useRef(navigate);
  const todayPlant = usePlantStore((s) => s.todayPlant);
  const reports = useReportStore((s) => s.reports);

  // Keep navigateRef current so the stable listener closure can always call latest navigate
  useEffect(() => { navigateRef.current = navigate; }, [navigate]);

  const reminderManual = useMemo(() => {
    const cloudManual = normalizeManualForReminder((userProfileV2?.manual ?? null) as UserProfileManualV2 | null);
    const pendingManual = normalizeManualForReminder(
      (user?.id ? (getPendingProfileWrite(user.id)?.manual ?? null) : null) as UserProfileManualV2 | null,
    );
    const localManual = normalizeManualForReminder(buildReminderManualFromLocalSnapshot(user?.id));

    if (!cloudManual && !pendingManual && !localManual) return null;
    return normalizeManualForReminder({
      ...(cloudManual ?? {}),
      ...(pendingManual ?? {}),
      ...(localManual ?? {}),
    });
  }, [user?.id, userProfileV2?.manual]);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const runReminderConfirmFlow = useCallback(async (type: ReminderType, ts: number = Date.now()) => {
    if (!shouldProcessReminderConfirm(type, ts)) return;
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;

    useReminderStore.getState().markConfirmed(type);

    const action = getTimingAction(type);
    const preset = getReminderQuickRecordPreset(type);

    if (preset) {
      await useChatStore.getState().sendMessage(preset.content, ts, {
        activityTypeOverride: preset.activityType,
        skipMoodDetection: true,
        skipAnnotation: true,
      });
    } else if (action?.kind === 'end') {
      await endLatestActiveRecordCard();
    }

    const timing = useTimingStore.getState();
    if (action?.kind === 'start') {
      await timing.start(userId, action.type, 'reminder_confirm');
    } else if (action?.kind === 'end') {
      await timing.endActive(userId);
    }
  }, []);

  const flushPendingReminderConfirms = useCallback(async () => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    const queue = readPendingReminderConfirms();
    if (queue.length === 0) return;

    const remaining: PendingReminderConfirm[] = [];
    for (const item of queue) {
      try {
        await runReminderConfirmFlow(item.type, item.ts);
      } catch {
        remaining.push(item);
      }
    }
    writePendingReminderConfirms(remaining);
  }, [runReminderConfirmFlow]);

  const scheduleTodayNativeReminders = useCallback(() => {
    if (!reminderManual) return;
    const reminderEnabled = reminderManual.reminderEnabled !== false;

    void scheduleRemindersForToday({
      manual: reminderManual,
      aiMode: preferences.aiMode,
      countryCode: preferences.countryCode ?? 'CN',
      reminderEnabled,
      getCopyFn: (type, vars) => getReminderCopy(preferences.aiMode, type, vars),
    });
  }, [reminderManual, preferences.aiMode, preferences.countryCode]);

  // ── 加载今日计时 sessions ──
  useEffect(() => {
    if (!user?.id) return;
    void useTimingStore.getState().loadToday(user.id);
  }, [user?.id]);

  // ── 注册通知类别（一次） ──
  useEffect(() => {
    void registerNotificationCategories();
  }, []);

  // ── 注册通知动作回调（一次） ──
  useEffect(() => {
    void setupNotificationActionListener({
      onConfirm: (type) => {
        enqueuePendingReminderConfirm(type, Date.now());
        void flushPendingReminderConfirms();
      },
      onDeny: (_type, activityType) => useReminderStore.getState().showPickerForDeny(activityType),
      onViewReport: () => {
        useReminderStore.getState().markConfirmed('evening_check');
        navigateRef.current('/report');
      },
      onGrowPlant: () => {
        useReminderStore.getState().markConfirmed('evening_check');
        navigateRef.current('/growth');
      },
      onOpenChat: () => navigateRef.current('/chat'),
      onOpenReminder: (type) => {
        const skip = useReminderStore.getState().shouldSkipReminder(type);
        if (!skip) {
          useReminderStore.getState().showPopup(type);
        }
      },
      onStillYes: () => { /* session_check 重调度（Phase 2）*/ },
      onStillNo: (_type, activityType) => useReminderStore.getState().showPickerForDeny(activityType),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── App 前后台切换：idle nudge ──
  useEffect(() => {
    if (!reminderManual) return;

    const listener = CapApp.addListener('appStateChange', ({ isActive }) => {
      const aiMode = preferences.aiMode;
      const userName = reminderManual.freeText;

      if (isActive) {
        void cancelIdleNudge();
        // Foreground uses in-app popup only; suppress native banner notifications.
        void cancelAllNotifications();
        void flushPendingReminderConfirms();
      } else {
        // Background/closed states rely on native local notifications.
        scheduleTodayNativeReminders();
        const body = getReminderCopy(aiMode, 'idle_nudge', { name: userName });
        void scheduleIdleNudge(body);
      }
    });

    return () => {
      void listener.then((l) => l.remove());
    };
  }, [flushPendingReminderConfirms, reminderManual, preferences.aiMode, scheduleTodayNativeReminders]);

  // ── 调度原生通知（今日队列） ──
  useEffect(() => {
    if (!reminderManual) return;
    let cancelled = false;
    void (async () => {
      try {
        const state = await CapApp.getState();
        if (cancelled) return;
        if (state.isActive) {
          await cancelAllNotifications();
        } else {
          scheduleTodayNativeReminders();
        }
      } catch {
        if (!cancelled) scheduleTodayNativeReminders();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reminderManual, scheduleTodayNativeReminders]);

  useEffect(() => {
    void flushPendingReminderConfirms();
  }, [flushPendingReminderConfirms]);

  // ── 前台定时弹窗（用户 App 打开时的兜底） ──
  useEffect(() => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];

    if (!reminderManual) return;
    const manual = reminderManual;
    const reminderEnabled = manual.reminderEnabled !== false;
    if (!reminderEnabled) return;

    const schedule = buildFrontendCheckSchedule(manual);
    const now = Date.now();

    for (const entry of schedule) {
      const delay = entry.triggerTime.getTime() - now;
      if (delay <= 0) continue;

      const timer = setTimeout(() => {
        // evening_check 需额外检查植物/日记是否已生成
        if (
          (entry.type === 'evening_check' || entry.type === 'weekend_evening_check')
          && isPlantDoneToday(todayPlant)
          && isDiaryDoneToday(reports)
        ) {
          return;
        }
        if (!shouldSkipReminder(entry.type)) {
          showPopup(entry.type);
        }
      }, delay);

      timersRef.current.push(timer);
    }

    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current = [];
    };
  }, [reminderManual, shouldSkipReminder, showPopup, todayPlant, reports]);

  return { confirmReminderFromPopup: runReminderConfirmFlow };
}
