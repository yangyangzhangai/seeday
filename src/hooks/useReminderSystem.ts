// DOC-DEPS: LLM.md -> docs/PROACTIVE_REMINDER_SPEC.md -> src/services/notifications/localNotificationService.ts
/**
 * App 级别的提醒系统 Hook
 * - App 启动：注册通知类别 → 调度今日提醒
 * - App 前后台切换：调度/取消 idle nudge
 * - 前台时：到时间弹 App 内弹窗
 */
import { useCallback, useEffect, useRef } from 'react';
import { App as CapApp } from '@capacitor/app';
import { useAuthStore } from '../store/useAuthStore';
import { useReminderStore } from '../store/useReminderStore';
import { usePlantStore } from '../store/usePlantStore';
import { useReportStore } from '../store/useReportStore';
import { isSameDay } from 'date-fns';
import {
  registerNotificationCategories,
  scheduleIdleNudge,
  cancelIdleNudge,
  setupNotificationActionListener,
} from '../services/notifications/localNotificationService';
import { scheduleRemindersForToday } from '../services/reminder/reminderScheduler';
import { getReminderCopy } from '../services/reminder/reminderCopy';
import type { UserProfileManualV2 } from '../types/userProfile';
import type { ReminderType } from '../services/reminder/reminderTypes';
import { useTimingStore } from '../store/useTimingStore';
import type { TimingType } from '../services/timing/timingSessionService';

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

export function useReminderSystem(navigate: (path: string) => void) {
  const user = useAuthStore((s) => s.user);
  const preferences = useAuthStore((s) => s.preferences);
  const userProfileV2 = useAuthStore((s) => s.userProfileV2);
  const { showPopup, shouldSkipReminder } = useReminderStore();
  const navigateRef = useRef(navigate);
  const todayPlant = usePlantStore((s) => s.todayPlant);
  const reports = useReportStore((s) => s.reports);

  // Keep navigateRef current so the stable listener closure can always call latest navigate
  useEffect(() => { navigateRef.current = navigate; }, [navigate]);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scheduleTodayNativeReminders = useCallback(() => {
    if (!user?.id || !userProfileV2) return;
    const manual = (userProfileV2.manual ?? {}) as UserProfileManualV2;
    const reminderEnabled = manual.reminderEnabled !== false;

    void scheduleRemindersForToday({
      manual,
      aiMode: preferences.aiMode,
      countryCode: preferences.countryCode ?? 'CN',
      reminderEnabled,
      getCopyFn: (type, vars) => getReminderCopy(preferences.aiMode, type, vars),
    });
  }, [user?.id, userProfileV2, preferences.aiMode, preferences.countryCode]);

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
        useReminderStore.getState().markConfirmed(type);
        navigateRef.current('/chat');
        const action = getTimingAction(type);
        if (action) {
          const userId = useAuthStore.getState().user?.id;
          if (userId) {
            const timing = useTimingStore.getState();
            if (action.kind === 'start') {
              void timing.start(userId, action.type, 'reminder_confirm');
            } else {
              void timing.endActive(userId);
            }
          }
        }
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
      onStillYes: () => { /* session_check 重调度（Phase 2）*/ },
      onStillNo: (_type, activityType) => useReminderStore.getState().showPickerForDeny(activityType),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── App 前后台切换：idle nudge ──
  useEffect(() => {
    if (!user?.id) return;

    const listener = CapApp.addListener('appStateChange', ({ isActive }) => {
      const manual = (userProfileV2?.manual ?? {}) as UserProfileManualV2;
      const aiMode = preferences.aiMode;
      const userName = manual.freeText;

      if (isActive) {
        void cancelIdleNudge();
        // Re-check daily schedule on foreground (cross-day / cold wake safety net)
        scheduleTodayNativeReminders();
      } else {
        const body = getReminderCopy(aiMode, 'idle_nudge', { name: userName });
        void scheduleIdleNudge(body);
      }
    });

    return () => {
      void listener.then((l) => l.remove());
    };
  }, [user?.id, preferences.aiMode, userProfileV2?.manual, scheduleTodayNativeReminders]);

  // ── 调度原生通知（今日队列） ──
  useEffect(() => {
    scheduleTodayNativeReminders();
  }, [scheduleTodayNativeReminders]);

  // ── 前台定时弹窗（用户 App 打开时的兜底） ──
  useEffect(() => {
    if (!user?.id || !userProfileV2) return;
    const manual = (userProfileV2.manual ?? {}) as UserProfileManualV2;
    const reminderEnabled = manual.reminderEnabled !== false;
    if (!reminderEnabled) return;

    // 清除旧定时器
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];

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
  }, [user?.id, userProfileV2, todayPlant, reports]);
}
