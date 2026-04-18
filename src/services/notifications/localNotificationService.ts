// DOC-DEPS: LLM.md -> docs/PROACTIVE_REMINDER_SPEC.md -> src/services/reminder/reminderTypes.ts
/**
 * iOS 原生本地通知服务
 * - Web 环境静默降级（不抛错）
 * - App 前台时由 ReminderPopup 组件接管，不重复推送
 */

import type { ReminderType } from '../reminder/reminderTypes';

// 动态导入避免 Web 环境报错
async function getPlugin() {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    return LocalNotifications;
  } catch {
    return null;
  }
}

/** App 启动时调用一次，注册 iOS 可操作通知类别 */
export async function registerNotificationCategories(): Promise<void> {
  const plugin = await getPlugin();
  if (!plugin) return;

  try {
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
  } catch {
    // 静默失败（Web 环境或权限未授予）
  }
}

/** 请求通知权限 */
export async function requestNotificationPermission(): Promise<boolean> {
  const plugin = await getPlugin();
  if (!plugin) return false;

  try {
    const { display } = await plugin.requestPermissions();
    return display === 'granted';
  } catch {
    return false;
  }
}

/** 检查通知权限状态 */
export async function checkNotificationPermission(): Promise<'granted' | 'denied' | 'prompt'> {
  const plugin = await getPlugin();
  if (!plugin) return 'denied';

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
export async function scheduleLocalNotification(payload: LocalNotificationPayload): Promise<void> {
  const plugin = await getPlugin();
  if (!plugin) return;

  try {
    await plugin.schedule({
      notifications: [
        {
          id: payload.id,
          title: payload.title,
          body: payload.body,
          schedule: { at: payload.at },
          actionTypeId: payload.actionTypeId,
          extra: payload.extra,
        },
      ],
    });
  } catch {
    // 静默失败
  }
}

/** 批量调度通知（今日提醒队列） */
export async function scheduleBatchNotifications(
  payloads: LocalNotificationPayload[],
): Promise<void> {
  const plugin = await getPlugin();
  if (!plugin || payloads.length === 0) return;

  try {
    await plugin.schedule({
      notifications: payloads.map((p) => ({
        id: p.id,
        title: p.title,
        body: p.body,
        schedule: { at: p.at },
        actionTypeId: p.actionTypeId,
        extra: p.extra,
      })),
    });
  } catch {
    // 静默失败
  }
}

/** 按 ID 取消通知 */
export async function cancelNotifications(ids: number[]): Promise<void> {
  const plugin = await getPlugin();
  if (!plugin || ids.length === 0) return;

  try {
    await plugin.cancel({ notifications: ids.map((id) => ({ id })) });
  } catch {
    // 静默失败
  }
}

/** 取消所有本地通知 */
export async function cancelAllNotifications(): Promise<void> {
  const plugin = await getPlugin();
  if (!plugin) return;

  try {
    const { notifications } = await plugin.getPending();
    if (notifications.length > 0) {
      await plugin.cancel({ notifications: notifications.map((n) => ({ id: n.id })) });
    }
  } catch {
    // 静默失败
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
  onConfirm?: (reminderType: ReminderType) => void;
  onDeny?: (reminderType: ReminderType, activityType?: string) => void;
  onViewReport?: () => void;
  onGrowPlant?: () => void;
  onOpenChat?: () => void;
  onStillYes?: (reminderType: ReminderType, activityType?: string) => void;
  onStillNo?: (reminderType: ReminderType, activityType?: string) => void;
}): Promise<void> {
  const plugin = await getPlugin();
  if (!plugin) return;

  try {
    plugin.addListener('localNotificationActionPerformed', (event) => {
      const actionId = event.actionId;
      const extra = (event.notification.extra ?? {}) as {
        reminderType?: ReminderType;
        activityType?: string;
        content?: string;
      };
      const reminderType: ReminderType = extra.reminderType ?? 'evening_check';

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
