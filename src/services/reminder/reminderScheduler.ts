// DOC-DEPS: LLM.md -> docs/PROACTIVE_REMINDER_SPEC.md -> src/services/reminder/reminderTypes.ts
import type { ScheduledReminder, ReminderType } from './reminderTypes';
import type { UserProfileManualV2 } from '../../types/userProfile';
import {
  scheduleBatchNotifications,
  cancelAllNotifications,
  type LocalNotificationPayload,
} from '../notifications/localNotificationService';

// ─────────────────────────────────────────────
// 通知 ID 生成（命名规范：reminder_<type>_<HHMM>）
// ─────────────────────────────────────────────

const REMINDER_ID_BASE = 100000;

function reminderTypeToIndex(type: ReminderType): number {
  const TYPES: ReminderType[] = [
    'wake', 'work_start', 'lunch_start', 'lunch_end', 'work_end',
    'class_morning_start', 'class_morning_end', 'class_afternoon_start',
    'class_afternoon_end', 'class_evening_start', 'class_evening_end',
    'meal_lunch', 'meal_dinner', 'sleep',
    'evening_check', 'weekend_morning_check', 'weekend_afternoon_check', 'weekend_evening_check',
    'idle_nudge', 'session_check',
  ];
  const idx = TYPES.indexOf(type);
  return idx >= 0 ? idx : TYPES.length;
}

function makeNotificationId(type: ReminderType): number {
  return REMINDER_ID_BASE + reminderTypeToIndex(type);
}

// ─────────────────────────────────────────────
// 节假日检测（结果缓存到 localStorage，当日有效）
// ─────────────────────────────────────────────

export async function getIsFreeDay(date: Date, countryCode: string): Promise<boolean> {
  const key = `freeDay_${date.toISOString().slice(0, 10)}`;
  const cached = localStorage.getItem(key);
  if (cached !== null) return cached === 'true';

  // 周末直接判定，无需请求
  const day = date.getDay();
  if (day === 0 || day === 6) {
    localStorage.setItem(key, 'true');
    return true;
  }

  try {
    const res = await fetch(
      `/api/live-input-telemetry?module=holiday_check&date=${date.toISOString().slice(0, 10)}&country=${countryCode}`,
    );
    if (res.ok) {
      const { isFreeDay } = (await res.json()) as { isFreeDay: boolean };
      localStorage.setItem(key, String(isFreeDay));
      return isFreeDay;
    }
  } catch {
    // 网络失败时保守当作工作日
  }

  localStorage.setItem(key, 'false');
  return false;
}

// ─────────────────────────────────────────────
// 提醒队列构建
// ─────────────────────────────────────────────

function buildWeekdayReminderQueue(manual: UserProfileManualV2): ScheduledReminder[] {
  const queue: ScheduledReminder[] = [];

  // 通用作息
  if (manual.wakeTime) queue.push({ type: 'wake', time: manual.wakeTime });
  if (manual.sleepTime) queue.push({ type: 'sleep', time: manual.sleepTime });

  if (manual.hasWorkSchedule) {
    if (manual.workStart) queue.push({ type: 'work_start', time: manual.workStart });
    if (manual.lunchStart) queue.push({ type: 'lunch_start', time: manual.lunchStart });
    if (manual.lunchEnd) queue.push({ type: 'lunch_end', time: manual.lunchEnd });
    if (manual.workEnd) queue.push({ type: 'work_end', time: manual.workEnd });
  } else {
    // 无工作日程，使用通用三餐时间
    if (manual.lunchTime) queue.push({ type: 'meal_lunch', time: manual.lunchTime });
  }

  if (manual.dinnerTime) queue.push({ type: 'meal_dinner', time: manual.dinnerTime });

  if (manual.hasClassSchedule && manual.classSchedule) {
    const { morning, afternoon, evening } = manual.classSchedule;
    if (morning?.start) queue.push({ type: 'class_morning_start', time: morning.start });
    if (morning?.end) queue.push({ type: 'class_morning_end', time: morning.end });
    if (afternoon?.start) queue.push({ type: 'class_afternoon_start', time: afternoon.start });
    if (afternoon?.end) queue.push({ type: 'class_afternoon_end', time: afternoon.end });
    if (evening?.start) queue.push({ type: 'class_evening_start', time: evening.start });
    if (evening?.end) queue.push({ type: 'class_evening_end', time: evening.end });
  }

  // 晚间总结固定 20:00
  queue.push({ type: 'evening_check', time: '20:00' });

  return queue;
}

function buildWeekendReminderQueue(): ScheduledReminder[] {
  return [
    { type: 'weekend_morning_check', time: '10:00' },
    { type: 'weekend_afternoon_check', time: '16:00' },
    { type: 'weekend_evening_check', time: '20:00' },
  ];
}

export function buildReminderQueue(
  manual: UserProfileManualV2,
  date: Date,
  isFreeDay: boolean,
): ScheduledReminder[] {
  if (isFreeDay) return buildWeekendReminderQueue();
  return buildWeekdayReminderQueue(manual);
}

// ─────────────────────────────────────────────
// 每日调度（取消旧通知 → 重建今日队列）
// ─────────────────────────────────────────────

/** 解析 'HH:MM' 字符串为今日的 Date 对象 */
function timeStringToToday(hhmm: string): Date {
  const [hh, mm] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  return d;
}

export interface ScheduleOptions {
  manual: UserProfileManualV2;
  aiMode: string;
  userName?: string;
  countryCode: string;
  notificationTitle?: string;
  /** (type, vars) → notification body text */
  getCopyFn: (type: ReminderType, vars?: { name?: string; activity?: string }) => string;
  reminderEnabled?: boolean;
}

const SCHEDULE_DONE_KEY = 'reminder_scheduled_date';

export async function scheduleRemindersForToday(opts: ScheduleOptions): Promise<void> {
  if (opts.reminderEnabled === false) return;

  const todayKey = new Date().toISOString().slice(0, 10);
  // 已经调度过今天的则跳过（重启 App 不重复调度）
  if (localStorage.getItem(SCHEDULE_DONE_KEY) === todayKey) return;

  const now = new Date();
  const isFreeDay = await getIsFreeDay(now, opts.countryCode);
  const queue = buildReminderQueue(opts.manual, now, isFreeDay);

  // 只保留触发时间在未来的提醒
  const future = queue.filter(({ time }) => timeStringToToday(time) > now);

  if (future.length === 0) {
    localStorage.setItem(SCHEDULE_DONE_KEY, todayKey);
    return;
  }

  // 取消旧通知（不含 idle_nudge，它有独立 ID 999001）
  await cancelAllNotifications();

  const payloads: LocalNotificationPayload[] = future.map(({ type, time }) => {
    const body = opts.getCopyFn(type, { name: opts.userName });
    const actionTypeId =
      type === 'evening_check' || type === 'weekend_evening_check'
        ? 'EVENING_CHECK'
        : type === 'weekend_morning_check' || type === 'weekend_afternoon_check'
        ? 'WEEKEND_CHECK'
        : 'CONFIRM_DENY';

    return {
      id: makeNotificationId(type),
      title: opts.notificationTitle ?? 'Tshine',
      body,
      at: timeStringToToday(time),
      actionTypeId,
      extra: { reminderType: type },
    };
  });

  await scheduleBatchNotifications(payloads);
  localStorage.setItem(SCHEDULE_DONE_KEY, todayKey);
  localStorage.setItem('reminder_today_count', String(payloads.length));
}
