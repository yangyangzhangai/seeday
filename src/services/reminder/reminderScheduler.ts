// DOC-DEPS: LLM.md -> docs/PROACTIVE_REMINDER_SPEC.md -> src/services/reminder/reminderTypes.ts
import type { ScheduledReminder, ReminderType } from './reminderTypes';
import type { UserProfileManualV2 } from '../../types/userProfile';
import { toLocalDateStr } from '../../lib/dateUtils';
import {
  scheduleBatchNotifications,
  cancelAllNotifications,
  getPendingNotificationIds,
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

function resolveActionTypeId(
  type: ReminderType,
): LocalNotificationPayload['actionTypeId'] {
  if (type === 'evening_check' || type === 'weekend_evening_check') {
    return 'EVENING_CHECK';
  }
  if (type === 'weekend_morning_check' || type === 'weekend_afternoon_check') {
    return 'WEEKEND_CHECK';
  }
  return 'CONFIRM_DENY';
}

// ─────────────────────────────────────────────
// 节假日检测（结果缓存到 localStorage，当日有效）
// ─────────────────────────────────────────────

export async function getIsFreeDay(date: Date, countryCode: string): Promise<boolean> {
  const localDate = toLocalDateStr(date);
  const key = `freeDay_${localDate}`;
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
      `/api/live-input-telemetry?module=holiday_check&date=${localDate}&country=${countryCode}`,
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
// 每日调度（取消旧通知 → 重建今日/明日队列）
// ─────────────────────────────────────────────

/** 将 'HH:MM' 字符串解析为指定 date 当天的 Date 对象 */
function timeStringToDate(hhmm: string, baseDate: Date): Date {
  const [hh, mm] = hhmm.split(':').map(Number);
  const d = new Date(baseDate);
  d.setHours(hh, mm, 0, 0);
  return d;
}

/** 解析 'HH:MM' 字符串为今日的 Date 对象（向后兼容） */
function timeStringToToday(hhmm: string): Date {
  return timeStringToDate(hhmm, new Date());
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

/** 将队列 + 日期转换为通知 payload 列表 */
function buildPayloads(
  queue: ScheduledReminder[],
  baseDate: Date,
  opts: ScheduleOptions,
): LocalNotificationPayload[] {
  return queue.map(({ type, time }) => ({
    id: makeNotificationId(type),
    title: opts.notificationTitle ?? 'Seeday',
    body: opts.getCopyFn(type, { name: opts.userName }),
    at: timeStringToDate(time, baseDate),
    actionTypeId: resolveActionTypeId(type),
    extra: { reminderType: type },
  }));
}

export async function scheduleRemindersForToday(opts: ScheduleOptions): Promise<void> {
  if (opts.reminderEnabled === false) return;

  const todayKey = toLocalDateStr(new Date());
  const wasMarkedToday = localStorage.getItem(SCHEDULE_DONE_KEY) === todayKey;

  const now = new Date();
  const isFreeDay = await getIsFreeDay(now, opts.countryCode);
  const queue = buildReminderQueue(opts.manual, now, isFreeDay);

  // 只保留触发时间在未来的提醒
  const future = queue.filter(({ time }) => timeStringToToday(time) > now);

  // 若今天已标记完成，先检查 pending 是否完整，完整则直接跳过。
  if (wasMarkedToday) {
    const pendingIds = await getPendingNotificationIds();

    if (future.length > 0) {
      const expectedTodayIds = buildPayloads(future, now, opts).map((item) => item.id);
      const todayAlreadyScheduled =
        expectedTodayIds.length > 0 && expectedTodayIds.every((id) => pendingIds.includes(id));
      if (todayAlreadyScheduled) {
        localStorage.setItem('reminder_today_count', String(expectedTodayIds.length));
        return;
      }
    } else {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const isTomorrowFreeDay = await getIsFreeDay(tomorrow, opts.countryCode);
      const tomorrowQueue = buildReminderQueue(opts.manual, tomorrow, isTomorrowFreeDay);
      const expectedTomorrowIds = buildPayloads(tomorrowQueue, tomorrow, opts).map((item) => item.id);
      const tomorrowAlreadyScheduled =
        expectedTomorrowIds.length === 0 || expectedTomorrowIds.every((id) => pendingIds.includes(id));
      if (tomorrowAlreadyScheduled) {
        localStorage.setItem('reminder_today_count', '0');
        return;
      }
    }
  }

  // 取消旧通知（cancelAllNotifications 已排除 idle_nudge）
  await cancelAllNotifications();

  if (future.length === 0) {
    // 今日所有提醒时间已过 → 调度明日队列，确保用户明天能收到通知
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrowFreeDay = await getIsFreeDay(tomorrow, opts.countryCode);
    const tomorrowQueue = buildReminderQueue(opts.manual, tomorrow, isTomorrowFreeDay);
    const tomorrowPayloads = buildPayloads(tomorrowQueue, tomorrow, opts);
    if (tomorrowPayloads.length > 0) {
      const scheduled = await scheduleBatchNotifications(tomorrowPayloads);
      if (!scheduled) return;
    }
    localStorage.setItem(SCHEDULE_DONE_KEY, todayKey);
    localStorage.setItem('reminder_today_count', '0');
    return;
  }

  const payloads = buildPayloads(future, now, opts);
  const scheduled = await scheduleBatchNotifications(payloads);
  if (!scheduled) return;
  localStorage.setItem(SCHEDULE_DONE_KEY, todayKey);
  localStorage.setItem('reminder_today_count', String(payloads.length));
}
