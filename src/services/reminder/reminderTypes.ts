// DOC-DEPS: LLM.md -> docs/PROACTIVE_REMINDER_SPEC.md

export type ReminderType =
  | 'work_start'
  | 'work_end'
  | 'lunch_start'
  | 'lunch_end'
  | 'class_morning_start'
  | 'class_morning_end'
  | 'class_afternoon_start'
  | 'class_afternoon_end'
  | 'class_evening_start'
  | 'class_evening_end'
  | 'wake'
  | 'sleep'
  | 'meal_lunch'
  | 'meal_dinner'
  | 'evening_check'
  | 'weekend_morning_check'
  | 'weekend_afternoon_check'
  | 'weekend_evening_check'
  | 'idle_nudge'
  | 'session_check';

export interface ScheduledReminder {
  type: ReminderType;
  /** 'HH:MM' 24h */
  time: string;
}

export type ActivityRecordCategory = 'work' | 'study' | 'social' | 'life' | 'entertainment' | 'health';

export const ACTIVITY_DISPLAY_LABEL: Record<ActivityRecordCategory, string> = {
  work: '工作',
  study: '学习',
  social: '社交活动',
  life: '日常活动',
  entertainment: '娱乐',
  health: '运动',
};

/** Notification action type IDs registered with iOS */
export type NotificationActionTypeId =
  | 'CONFIRM_DENY'
  | 'EVENING_CHECK'
  | 'WEEKEND_CHECK'
  | 'IDLE_NUDGE'
  | 'SESSION_CHECK';
