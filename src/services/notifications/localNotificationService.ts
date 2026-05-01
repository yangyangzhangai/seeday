// DOC-DEPS: LLM.md -> docs/PROACTIVE_REMINDER_SPEC.md -> src/services/reminder/reminderTypes.ts
/**
 * iOS 原生本地通知服务
 * - Web 环境静默降级（不抛错）
 * - App 前台时由 ReminderPopup 组件接管，不重复推送
 * - 通知类别不含 input 字段，长按只显示操作按钮，不弹文字输入框
 */

import type { ReminderType } from '../reminder/reminderTypes';
import { getScopedClientStorageKey, resolveStorageScopeForUser } from '../../store/storageScope';
import i18n from '../../i18n';

const ERROR_LOG_KEY = 'reminder_error_log';
const MAX_ERROR_ENTRIES = 20;
let actionTypesRegistered = false;
let actionTypesRegisterPromise: Promise<void> | null = null;

function tAction(key: string): string {
  const translated = i18n.t(key);
  return translated === key ? '' : translated;
}

function logReminderError(label: string, error: unknown): void {
  try {
    const entry = {
      t: new Date().toISOString(),
      label,
      msg: error instanceof Error ? error.message : String(error),
    };
    const raw = localStorage.getItem(ERROR_LOG_KEY);
    const list: typeof entry[] = raw ? (JSON.parse(raw) as typeof entry[]) : [];
    list.push(entry);
    if (list.length > MAX_ERROR_ENTRIES) list.splice(0, list.length - MAX_ERROR_ENTRIES);
    localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(list));
  } catch {
    // localStorage 不可用时放弃记录
  }
  if (import.meta.env.DEV) console.warn(`[local-notification] ${label}`, error);
}

// 动态导入避免 Web 环境报错
interface LocalNotificationsPluginRef {
  plugin: (typeof import('@capacitor/local-notifications'))['LocalNotifications'];
}

async function getPlugin() {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    // Do not return Capacitor plugin proxy directly from async function.
    // On iOS the proxy can be treated as thenable and triggers `LocalNotifications.then()` errors.
    return { plugin: LocalNotifications } as LocalNotificationsPluginRef;
  } catch {
    return null;
  }
}

async function ensureNotificationPermission(): Promise<boolean> {
  const pluginRef = await getPlugin();
  if (!pluginRef) return false;
  const { plugin } = pluginRef;
  try {
    const current = await plugin.checkPermissions();
    if (current.display === 'granted') return true;
    if (current.display === 'denied') return false;
    const requested = await plugin.requestPermissions();
    return requested.display === 'granted';
  } catch {
    return false;
  }
}

/**
 * App 启动时调用一次，注册 iOS 可操作通知类别。
 * 必须在 scheduleRemindersForToday 之前 await 完成，避免 actionTypeId 引用未注册类别。
 * 所有 actions 不含 input:true，长按不会出现文字输入框。
 */
export async function registerNotificationCategories(): Promise<void> {
  if (actionTypesRegistered) return;
  if (actionTypesRegisterPromise) return actionTypesRegisterPromise;

  actionTypesRegisterPromise = (async () => {
    const pluginRef = await getPlugin();
    if (!pluginRef) return;
    const { plugin } = pluginRef;
    await plugin.registerActionTypes({
      types: [
        {
          id: 'CONFIRM_DENY',
          actions: [
            { id: 'confirm', title: tAction('notification_action_confirm') || '✓ Confirm', foreground: false },
            { id: 'deny', title: tAction('notification_action_deny') || 'I am busy', foreground: false },
          ],
        },
        {
          id: 'EVENING_CHECK',
          actions: [
            { id: 'view_report', title: tAction('notification_action_view_report') || 'View diary', foreground: true },
            { id: 'grow_plant', title: tAction('notification_action_grow_plant') || 'Grow plant', foreground: true },
          ],
        },
        {
          id: 'WEEKEND_CHECK',
          actions: [
            { id: 'confirm', title: tAction('notification_action_weekend_confirm') || 'Log now', foreground: false },
            { id: 'deny', title: tAction('notification_action_weekend_deny') || 'Ignore', foreground: false },
          ],
        },
        {
          id: 'IDLE_NUDGE',
          actions: [
            { id: 'open_chat', title: tAction('notification_action_open_chat') || 'Open chat', foreground: true },
          ],
        },
        {
          id: 'SESSION_CHECK',
          actions: [
            { id: 'still_yes', title: tAction('notification_action_still_yes') || '✓ Still on it', foreground: false },
            { id: 'still_no', title: tAction('notification_action_still_no') || 'I am busy', foreground: false },
          ],
        },
      ],
    });
    actionTypesRegistered = true;
  })()
    .catch((error) => {
      logReminderError('registerNotificationCategories failed', error);
      throw error;
    })
    .finally(() => {
      actionTypesRegisterPromise = null;
    });

  return actionTypesRegisterPromise;
}

/** 请求通知权限 */
export async function requestNotificationPermission(): Promise<boolean> {
  const pluginRef = await getPlugin();
  if (!pluginRef) return false;
  const { plugin } = pluginRef;

  try {
    const { display } = await plugin.requestPermissions();
    return display === 'granted';
  } catch {
    return false;
  }
}

/** 检查通知权限状态 */
export async function checkNotificationPermission(): Promise<'granted' | 'denied' | 'prompt'> {
  const pluginRef = await getPlugin();
  if (!pluginRef) return 'denied';
  const { plugin } = pluginRef;

  try {
    const { display } = await plugin.checkPermissions();
    return display as 'granted' | 'denied' | 'prompt';
  } catch {
    return 'denied';
  }
}

export interface LocalNotificationPayload {
  id: number;
  title: string;
  body: string;
  /** 触发时间（Date 对象） */
  at: Date;
  actionTypeId: 'CONFIRM_DENY' | 'EVENING_CHECK' | 'WEEKEND_CHECK' | 'IDLE_NUDGE' | 'SESSION_CHECK';
  extra: {
    reminderType: ReminderType;
    activityType?: string;
    content?: string;
  };
}

/** 调度单条本地通知 */
export async function scheduleLocalNotification(payload: LocalNotificationPayload): Promise<boolean> {
  const pluginRef = await getPlugin();
  if (!pluginRef) return false;
  const { plugin } = pluginRef;
  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) return false;

  let canUseActionType = true;
  try {
    await registerNotificationCategories();
  } catch {
    // 类别注册失败时降级为普通通知，避免整条提醒链路中断
    canUseActionType = false;
  }

  try {
    await plugin.schedule({
      notifications: [
        {
          id: payload.id,
          title: payload.title,
          body: payload.body,
          schedule: { at: payload.at, allowWhileIdle: true },
          ...(canUseActionType ? { actionTypeId: payload.actionTypeId } : {}),
          extra: payload.extra,
        },
      ],
    });
    return true;
  } catch (error) {
    logReminderError('scheduleLocalNotification failed', error);
    return false;
  }
}

/** 批量调度通知（今日提醒队列） */
export async function scheduleBatchNotifications(
  payloads: LocalNotificationPayload[],
): Promise<boolean> {
  const pluginRef = await getPlugin();
  if (!pluginRef || payloads.length === 0) return false;
  const { plugin } = pluginRef;
  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) return false;

  let canUseActionType = true;
  try {
    await registerNotificationCategories();
  } catch {
    // 类别注册失败时降级为普通通知，避免整批调度失败
    canUseActionType = false;
  }

  try {
    await plugin.schedule({
      notifications: payloads.map((p) => ({
        id: p.id,
        title: p.title,
        body: p.body,
        schedule: { at: p.at, allowWhileIdle: true },
        ...(canUseActionType ? { actionTypeId: p.actionTypeId } : {}),
        extra: p.extra,
      })),
    });
    return true;
  } catch (error) {
    logReminderError('scheduleBatchNotifications failed', error);
    return false;
  }
}

/** 按 ID 取消通知 */
export async function cancelNotifications(ids: number[]): Promise<void> {
  const pluginRef = await getPlugin();
  if (!pluginRef || ids.length === 0) return;
  const { plugin } = pluginRef;

  try {
    await plugin.cancel({ notifications: ids.map((id) => ({ id })) });
  } catch {
    // 静默失败
  }
}

/** 取消除 idle_nudge 之外的所有本地通知 */
export async function cancelAllNotifications(): Promise<void> {
  const pluginRef = await getPlugin();
  if (!pluginRef) return;
  const { plugin } = pluginRef;

  try {
    const { notifications } = await plugin.getPending();
    const toCancel = notifications.filter((n) => n.id !== IDLE_NUDGE_ID);
    if (toCancel.length > 0) {
      await plugin.cancel({ notifications: toCancel.map((n) => ({ id: n.id })) });
    }
  } catch (error) {
    logReminderError('cancelAllNotifications failed', error);
  }
}

/** 读取当前待触发通知 ID 列表 */
export async function getPendingNotificationIds(): Promise<number[]> {
  const pluginRef = await getPlugin();
  if (!pluginRef) return [];
  const { plugin } = pluginRef;

  try {
    const { notifications } = await plugin.getPending();
    return notifications
      .map((item) => Number(item.id))
      .filter((id) => Number.isFinite(id));
  } catch {
    return [];
  }
}

const IDLE_NUDGE_ID = 999001;
const IDLE_NUDGE_KEY = 'idle_nudge_scheduled_at';

/** App 进入后台时安排 idle_nudge（4h 后，夜间推迟到次日 08:00） */
export async function scheduleIdleNudge(body: string, userId?: string): Promise<void> {
  // 先取消旧的
  await cancelNotifications([IDLE_NUDGE_ID]);

  const now = new Date();
  let triggerAt = new Date(now.getTime() + 4 * 60 * 60 * 1000);

  // 夜间静默（22:00 ~ 08:00）
  const triggerHour = triggerAt.getHours();
  if (triggerHour >= 22 || triggerHour < 8) {
    const next8am = new Date(triggerAt);
    if (triggerHour >= 22) {
      next8am.setDate(next8am.getDate() + 1);
    }
    next8am.setHours(8, 0, 0, 0);
    triggerAt = next8am;
  }

  localStorage.setItem(
    getScopedClientStorageKey(IDLE_NUDGE_KEY, resolveStorageScopeForUser(userId ?? null)),
    String(triggerAt.getTime()),
  );

  await scheduleLocalNotification({
    id: IDLE_NUDGE_ID,
    title: 'Seeday',
    body,
    at: triggerAt,
    actionTypeId: 'IDLE_NUDGE',
    extra: { reminderType: 'idle_nudge' },
  });
}

/** App 回到前台时取消 idle_nudge */
export async function cancelIdleNudge(userId?: string): Promise<void> {
  await cancelNotifications([IDLE_NUDGE_ID]);
  localStorage.removeItem(getScopedClientStorageKey(IDLE_NUDGE_KEY, resolveStorageScopeForUser(userId ?? null)));
}

/** 注册通知动作回调（App 启动时执行一次） */
export async function setupNotificationActionListener(handlers: {
  onTap?: (reminderType: ReminderType) => void;
  onConfirm?: (reminderType: ReminderType) => void;
  onDeny?: (reminderType: ReminderType, activityType?: string) => void;
  onViewReport?: () => void;
  onGrowPlant?: () => void;
  onOpenChat?: () => void;
  onStillYes?: (reminderType: ReminderType, activityType?: string) => void;
  onStillNo?: (reminderType: ReminderType, activityType?: string) => void;
}): Promise<void> {
  const pluginRef = await getPlugin();
  if (!pluginRef) return;
  const { plugin } = pluginRef;

  try {
    plugin.addListener('localNotificationActionPerformed', (event) => {
      const actionId = event.actionId;
      const extra = (event.notification.extra ?? {}) as {
        reminderType?: ReminderType;
        activityType?: string;
        content?: string;
      };
      const reminderType: ReminderType = extra.reminderType ?? 'evening_check';

      if (actionId === 'tap') handlers.onTap?.(reminderType);
      if (actionId === 'confirm') handlers.onConfirm?.(reminderType);
      if (actionId === 'deny') handlers.onDeny?.(reminderType, extra.activityType);
      if (actionId === 'view_report') handlers.onViewReport?.();
      if (actionId === 'grow_plant') handlers.onGrowPlant?.();
      if (actionId === 'open_chat') handlers.onOpenChat?.();
      if (actionId === 'still_yes') handlers.onStillYes?.(reminderType, extra.activityType);
      if (actionId === 'still_no') handlers.onStillNo?.(reminderType, extra.activityType);
    });
  } catch {
    // 静默失败
  }
}

/** 注册通知到达回调（前台收到通知时触发） */
export async function setupNotificationReceivedListener(handlers: {
  onReceived?: (reminderType: ReminderType) => void;
}): Promise<void> {
  const pluginRef = await getPlugin();
  if (!pluginRef) return;
  const { plugin } = pluginRef;

  try {
    plugin.addListener('localNotificationReceived', (event) => {
      const extra = (event.extra ?? {}) as {
        reminderType?: ReminderType;
      };
      const reminderType: ReminderType = extra.reminderType ?? 'evening_check';
      handlers.onReceived?.(reminderType);
    });
  } catch {
    // 静默失败
  }
}
