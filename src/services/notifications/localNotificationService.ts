// DOC-DEPS: LLM.md -> docs/PROACTIVE_REMINDER_SPEC.md -> src/services/reminder/reminderTypes.ts
/**
 * iOS 原生本地通知服务
 * - Web 环境静默降级（不抛错）
 * - App 前台时由 ReminderPopup 组件接管，不重复推送
 * - 通知类别不含 input 字段，长按只显示操作按钮，不弹文字输入框
 */

import type { ReminderType } from '../reminder/reminderTypes';

const REMINDER_ERROR_LOG_KEY = 'reminder_error_log';
let actionTypesRegistered = false;
let actionTypesRegisterPromise: Promise<void> | null = null;

function appendReminderErrorLog(stage: string, details: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(REMINDER_ERROR_LOG_KEY);
    const list = raw ? JSON.parse(raw) as Array<Record<string, unknown>> : [];
    const next = [
      ...list.slice(-49),
      {
        ts: new Date().toISOString(),
        stage,
        ...details,
      },
    ];
    window.localStorage.setItem(REMINDER_ERROR_LOG_KEY, JSON.stringify(next));
  } catch {
    // ignore localStorage failures
  }
}

// 动态导入避免 Web 环境报错
interface LocalNotificationsPluginRef {
  plugin: Awaited<ReturnType<typeof import('@capacitor/local-notifications')>>['LocalNotifications'];
}

async function getPlugin() {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    // Important: do NOT return LocalNotifications directly from an async function.
    // Capacitor plugin proxy can look like a thenable on iOS, which triggers
    // an invalid "LocalNotifications.then()" call during Promise resolution.
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
            { id: 'confirm', title: '✓ 确认' },
            { id: 'deny', title: '我在做别的' },
          ],
        },
        {
          id: 'EVENING_CHECK',
          actions: [
            { id: 'view_report', title: '看日报' },
            { id: 'grow_plant', title: '种植物' },
          ],
        },
        {
          id: 'WEEKEND_CHECK',
          actions: [
            { id: 'confirm', title: '记一下' },
            { id: 'deny', title: '忽略' },
          ],
        },
        {
          id: 'IDLE_NUDGE',
          actions: [
            { id: 'open_chat', title: '打开聊天' },
          ],
        },
        {
          id: 'SESSION_CHECK',
          actions: [
            { id: 'still_yes', title: '✓ 还在' },
            { id: 'still_no', title: '我在做别的' },
          ],
        },
      ],
    });
    actionTypesRegistered = true;
  })()
    .catch((error) => {
      appendReminderErrorLog('register_action_types_failed', {
        message: error instanceof Error ? error.message : String(error),
      });
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
  if (!hasPermission) {
    appendReminderErrorLog('schedule_single_skipped_no_permission', { id: payload.id });
    return false;
  }

  try {
    await registerNotificationCategories();
    await plugin.schedule({
      notifications: [
        {
          id: payload.id,
          title: payload.title,
          body: payload.body,
          schedule: { at: payload.at, allowWhileIdle: true },
          actionTypeId: payload.actionTypeId,
          extra: payload.extra,
        },
      ],
    });
    return true;
  } catch {
    appendReminderErrorLog('schedule_single_failed', { id: payload.id });
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
  if (!hasPermission) {
    appendReminderErrorLog('schedule_batch_skipped_no_permission', {
      count: payloads.length,
    });
    return false;
  }

  try {
    await registerNotificationCategories();
    await plugin.schedule({
      notifications: payloads.map((p) => ({
        id: p.id,
        title: p.title,
        body: p.body,
        schedule: { at: p.at, allowWhileIdle: true },
        actionTypeId: p.actionTypeId,
        extra: p.extra,
      })),
    });
    return true;
  } catch {
    appendReminderErrorLog('schedule_batch_failed', {
      count: payloads.length,
      ids: payloads.map((p) => p.id),
    });
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
export async function scheduleIdleNudge(body: string): Promise<void> {
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

  localStorage.setItem(IDLE_NUDGE_KEY, String(triggerAt.getTime()));

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
export async function cancelIdleNudge(): Promise<void> {
  await cancelNotifications([IDLE_NUDGE_ID]);
  localStorage.removeItem(IDLE_NUDGE_KEY);
}

/** 注册通知动作回调（App 启动时执行一次） */
export async function setupNotificationActionListener(handlers: {
  onTap?: (reminderType: ReminderType) => void;
  onConfirm?: (reminderType: ReminderType) => void;
  onDeny?: (reminderType: ReminderType, activityType?: string) => void;
  onViewReport?: () => void;
  onGrowPlant?: () => void;
  onOpenChat?: () => void;
  onOpenReminder?: (reminderType: ReminderType) => void;
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
      if (actionId === 'tap') handlers.onOpenReminder?.(reminderType);
    });
    plugin.addListener('localNotificationReceived', (event) => {
      const extra = (event.extra ?? {}) as { reminderType?: ReminderType };
      const reminderType = extra.reminderType;
      if (reminderType) handlers.onOpenReminder?.(reminderType);
    });
  } catch {
    // 静默失败
  }
}
