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
import { useTimingStore } from '../store/useTimingStore';
import { isSameDay } from 'date-fns';
import {
  scheduleIdleNudge,
  cancelIdleNudge,
  setupNotificationActionListener,
  setupNotificationReceivedListener,
} from '../services/notifications/localNotificationService';
import { scheduleRemindersForToday } from '../services/reminder/reminderScheduler';
import { getReminderCopy } from '../services/reminder/reminderCopy';
import type { UserProfileManualV2 } from '../types/userProfile';
import type { ReminderType } from '../services/reminder/reminderTypes';
import {
  buildReminderOccurrence,
} from '../services/reminder/reminderResponse';
import {
  consumePendingNotificationConfirm,
  queuePendingNotificationConfirm,
} from '../services/reminder/reminderPendingConfirmation';
import { getScopedClientStorageKey, resolveStorageScopeForUser } from '../store/storageScope';
import {
  confirmReminderActivity,
  rearmReminderConfirmationGuards,
} from '../services/reminder/reminderActivityActions';

// ─────────────────────────────────────────────
// 工具：判断植物/日记今日是否已生成
// ─────────────────────────────────────────────

function isPlantDoneToday(todayPlant: { date: string } | null): boolean {
  if (!todayPlant) return false;
  const now = new Date();
  const [y, m, d] = todayPlant.date.split('-').map(Number);
  return y === now.getFullYear() && m === now.getMonth() + 1 && d === now.getDate();
}

function isDiaryDoneToday(
  reports: Array<{ type: string; date: number | string; aiAnalysis?: string | null }>,
): boolean {
  const now = new Date();
  return reports.some(
    (r) => r.type === 'daily' && isSameDay(new Date(r.date), now) && !!r.aiAnalysis,
  );
}

const PENDING_NOTIFICATION_CONFIRM_KEY = 'pending_notification_confirm_action';
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
    entries.push({ type, triggerTime: t });
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

function getChangedReminderTypes(
  previous: ScheduleEntry[],
  next: ScheduleEntry[],
): ReminderType[] {
  const previousTimes = new Map(
    previous.map((entry) => [entry.type, entry.triggerTime.getTime()]),
  );
  return next
    .filter((entry) => previousTimes.get(entry.type) !== entry.triggerTime.getTime())
    .map((entry) => entry.type);
}

function getPopupDedupeKey(entry: ScheduleEntry): string {
  return `${entry.type}:${entry.triggerTime.getTime()}`;
}

interface UseReminderSystemResult {
  confirmReminderFromPopup: (type: ReminderType) => void;
}

export function useReminderSystem(navigate: (path: string) => void): UseReminderSystemResult {
  const user = useAuthStore((s) => s.user);
  const preferences = useAuthStore((s) => s.preferences);
  const userProfileV2 = useAuthStore((s) => s.userProfileV2);
  const metadataCountryCode = useAuthStore((s) => s.user?.user_metadata?.country_code);
  const { showPopup, shouldSkipReminder } = useReminderStore();
  const pendingConfirmStorageKey = useMemo(
    () => getScopedClientStorageKey(PENDING_NOTIFICATION_CONFIRM_KEY, resolveStorageScopeForUser(user?.id ?? null)),
    [user?.id],
  );
  const navigateRef = useRef(navigate);
  const todayPlant = usePlantStore((s) => s.todayPlant);
  const reports = useReportStore((s) => s.reports);
  const shownPopupKeysRef = useRef<Set<string>>(new Set());
  const previousFrontendScheduleRef = useRef<{
    userId: string;
    entries: ScheduleEntry[];
  } | null>(null);

  // Keep navigateRef current so the stable listener closure can always call latest navigate
  useEffect(() => { navigateRef.current = navigate; }, [navigate]);

  useEffect(() => {
    if (!user?.id || !userProfileV2) {
      previousFrontendScheduleRef.current = null;
      return;
    }
    const nextEntries = buildFrontendCheckSchedule(
      (userProfileV2.manual ?? {}) as UserProfileManualV2,
    );
    const previous = previousFrontendScheduleRef.current;
    previousFrontendScheduleRef.current = { userId: user.id, entries: nextEntries };
    if (!previous || previous.userId !== user.id) return;

    const changedTypes = getChangedReminderTypes(previous.entries, nextEntries);
    if (changedTypes.length === 0) return;
    useReminderStore.getState().rearmReminders(changedTypes);
    rearmReminderConfirmationGuards(changedTypes, user.id);
  }, [user?.id, userProfileV2]);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scheduleTodayNativeReminders = useCallback(async () => {
    if (!user?.id || !userProfileV2) return;
    const manual = (userProfileV2.manual ?? {}) as UserProfileManualV2;
    const reminderEnabled = manual.reminderEnabled !== false;
    const countryCode =
      typeof metadataCountryCode === 'string' && /^[A-Za-z]{2}$/.test(metadataCountryCode.trim())
        ? metadataCountryCode.trim().toUpperCase()
        : 'CN';

    try {
      await useReminderStore.getState().syncCloudResponses(user.id);
    } catch {
      // 云端回执暂时不可用时继续使用本地确认状态
    }
    try {
      await scheduleRemindersForToday({
        manual,
        aiMode: preferences.aiMode,
        storageUserId: user.id,
        countryCode,
        reminderEnabled,
        getCopyFn: (type, vars) => getReminderCopy(preferences.aiMode, type, vars),
        shouldSkipOccurrence: (type, occurrenceKey) => (
          useReminderStore.getState().shouldSkipReminder(type, occurrenceKey)
        ),
      });
    } catch {
      // 调度失败不阻断其余提醒链路（前台弹窗仍可作为兜底）
    }
  }, [user?.id, userProfileV2, preferences.aiMode, metadataCountryCode]);

  // ── 加载今日计时 sessions ──
  useEffect(() => {
    if (!user?.id) return;
    void useTimingStore.getState().loadToday(user.id);
  }, [user?.id]);

  // ── 兜底：若通知动作触发时用户态尚未恢复，恢复后补执行一次计时动作 ──
  useEffect(() => {
    if (!user?.id) return;
    const pending = consumePendingNotificationConfirm(pendingConfirmStorageKey);
    if (!pending) return;
    void confirmReminderActivity(pending.type, user.id, pending.occurrence);
  }, [user?.id, pendingConfirmStorageKey]);

  // ── 注册通知点击回调（一次） ──
  useEffect(() => {
    void setupNotificationActionListener({
      onTap: (type, occurrence) => {
        // 点击通知进入 App：直接弹出与前台一致的操作面板
        // （长按通知仍可直接一键开始/结束计时）
        if (type === 'idle_nudge') {
          navigateRef.current('/chat');
          return;
        }
        const reminder = useReminderStore.getState();
        if (!reminder.shouldSkipReminder(type, occurrence?.occurrenceKey)) {
          reminder.showPopup(type, occurrence);
        }
      },
      onConfirm: (type, occurrence) => {
        const userId = useAuthStore.getState().user?.id;
        if (!userId) {
          queuePendingNotificationConfirm({ type, occurrence }, pendingConfirmStorageKey);
          return;
        }
        void confirmReminderActivity(type, userId, occurrence);
      },
      onDeny: (type, activityType, occurrence) => (
        useReminderStore.getState().showPickerForDeny(activityType, type, occurrence)
      ),
      onViewReport: (type, occurrence) => {
        void useReminderStore.getState().recordResponse(type, {
          userId: useAuthStore.getState().user?.id,
          responseKind: 'view_report',
          occurrence,
        });
        navigateRef.current('/report?action=generate-diary');
      },
      onGrowPlant: (type, occurrence) => {
        void useReminderStore.getState().recordResponse(type, {
          userId: useAuthStore.getState().user?.id,
          responseKind: 'grow_plant',
          occurrence,
        });
        navigateRef.current('/report?action=generate-plant');
      },
      onOpenChat: () => navigateRef.current('/chat'),
      onStillYes: () => { /* session_check 重调度（Phase 2）*/ },
      onStillNo: (type, activityType) => useReminderStore.getState().showPickerForDeny(activityType, type),
    });

    // 前台收到原生通知时，补一次 App 内弹窗兜底（避免仅依赖定时器）
    void setupNotificationReceivedListener({
      onReceived: (type, occurrence) => {
        if (type === 'idle_nudge') return;
        const reminder = useReminderStore.getState();
        if (reminder.shouldSkipReminder(type, occurrence?.occurrenceKey)) return;
        if (reminder.activePopupType === type) return;
        reminder.showPopup(type, occurrence);
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingConfirmStorageKey]);

  // ── App 前后台切换：idle nudge ──
  useEffect(() => {
    if (!user?.id) return;

    const listener = CapApp.addListener('appStateChange', ({ isActive }) => {
      const manual = (userProfileV2?.manual ?? {}) as UserProfileManualV2;
      const aiMode = preferences.aiMode;
      const userName = user?.user_metadata?.display_name as string | undefined;

      if (isActive) {
        void (async () => {
          await cancelIdleNudge(user?.id);
          // Re-check cloud receipts before schedule rebuild and grace-window popup.
          await scheduleTodayNativeReminders();
          const foregroundManual = (userProfileV2?.manual ?? {}) as UserProfileManualV2;
          const foregroundSchedule = buildFrontendCheckSchedule(foregroundManual);
          const foregroundNow = Date.now();
          const FOREGROUND_GRACE_MS = 5 * 60 * 1000;
          const foregroundDateKey = new Date().toISOString().slice(0, 10);
          const reminderState = useReminderStore.getState();
          for (const entry of foregroundSchedule) {
            const diff = foregroundNow - entry.triggerTime.getTime();
            if (diff >= 0 && diff <= FOREGROUND_GRACE_MS) {
              const occurrence = buildReminderOccurrence(entry.type, entry.triggerTime);
              const dedupeKey = `${foregroundDateKey}:${getPopupDedupeKey(entry)}`;
              if (
                !shownPopupKeysRef.current.has(dedupeKey)
                && !reminderState.shouldSkipReminder(entry.type, occurrence.occurrenceKey)
              ) {
                shownPopupKeysRef.current.add(dedupeKey);
                reminderState.showPopup(entry.type, occurrence);
                break;
              }
            }
          }
        })();
      } else {
        const body = getReminderCopy(aiMode, 'idle_nudge', { name: userName });
        void scheduleIdleNudge(body, user?.id);
      }
    });

    return () => {
      void listener.then((l) => l.remove());
    };
  }, [user?.id, preferences.aiMode, userProfileV2?.manual, scheduleTodayNativeReminders]);

  // ── 注册通知类别 + 调度原生通知（串行，类别必须先注册完才能调度）──
  useEffect(() => {
    void scheduleTodayNativeReminders();
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
    const POPUP_GRACE_MS = 90 * 1000;
    const todayDateKey = new Date().toISOString().slice(0, 10);

    const triggerPopupOnce = (entry: ScheduleEntry) => {
      const dedupeKey = `${todayDateKey}:${getPopupDedupeKey(entry)}`;
      const occurrence = buildReminderOccurrence(entry.type, entry.triggerTime);
      if (shownPopupKeysRef.current.has(dedupeKey)) return;
      if (shouldSkipReminder(entry.type, occurrence.occurrenceKey)) return;
      shownPopupKeysRef.current.add(dedupeKey);
      showPopup(entry.type, occurrence);
    };

    for (const entry of schedule) {
      const delay = entry.triggerTime.getTime() - now;
      if (delay <= 0) {
        // 刚过点（如秒级误差）时立刻补弹一次，避免错过提醒
        // evening_check 需额外检查植物/日记是否已生成
        if (
          (entry.type === 'evening_check' || entry.type === 'weekend_evening_check')
          && isPlantDoneToday(todayPlant)
          && isDiaryDoneToday(reports)
        ) {
          continue;
        }
        if (Math.abs(delay) <= POPUP_GRACE_MS) {
          triggerPopupOnce(entry);
        }
        continue;
      }

      const timer = setTimeout(() => {
        // evening_check 需额外检查植物/日记是否已生成
        if (
          (entry.type === 'evening_check' || entry.type === 'weekend_evening_check')
          && isPlantDoneToday(todayPlant)
          && isDiaryDoneToday(reports)
        ) {
          return;
        }
        triggerPopupOnce(entry);
      }, delay);

      timersRef.current.push(timer);
    }

    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current = [];
    };
  }, [user?.id, userProfileV2, todayPlant, reports]);

  // ── 前台弹窗 ✓ 确认：标记已响应 + 记录活动 + 计时 ──
  const confirmReminderFromPopup = useCallback((type: ReminderType) => {
    const occurrence = useReminderStore.getState().activePopupOccurrence ?? undefined;
    void confirmReminderActivity(type, user?.id, occurrence);
  }, [user?.id]);

  return { confirmReminderFromPopup };
}
