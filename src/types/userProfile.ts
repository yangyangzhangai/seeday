// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/用户画像模块_需求与技术文档_v1.md
export type PrimaryUse =
  | 'life_record'
  | 'organize_thoughts'
  | 'emotion_management'
  | 'habit_building';

export type LifeStage = 'student' | 'employed' | 'freelance' | 'other';

export interface VisibleAnniversary {
  id: string;
  label: string;
  date: string;
  repeating: boolean;
  source: 'user' | 'ai_auto';
  createdAt: string;
}

export interface HiddenMoment {
  id: string;
  kind: 'first_time' | 'highlight' | 'lowlight' | 'milestone';
  title: string;
  date: string;
  summary: string;
  sourceMessageIds: string[];
  createdAt: string;
}

export interface ConfidenceSignal<T = string> {
  value: T;
  confidence: number;
  evidenceCount: number;
  lastSeenAt: string;
}

export interface TimeRange {
  start: string; // 'HH:MM'
  end: string;   // 'HH:MM'
}

export interface ClassSchedule {
  weekdays: number[];      // [1,2,3,4,5] = 周一至周五
  morning?: TimeRange;
  afternoon?: TimeRange;
  evening?: TimeRange;
}

/** 扩展后的 manual 字段，兼容旧版 UserProfileManual */
export interface UserProfileManualV2 extends UserProfileManual {
  // 日程开关（仅用于调度逻辑，不在 UI 展示为"身份"标签）
  hasWorkSchedule?: boolean;
  hasClassSchedule?: boolean;

  // 工作日程字段
  workStart?: string;    // 'HH:MM'
  workEnd?: string;
  lunchStart?: string;
  lunchEnd?: string;

  // 课表字段
  classSchedule?: ClassSchedule;
  classScheduleSource?: 'image' | 'manual';

  // 通用作息（dinner 补充）
  dinnerTime?: string;   // 'HH:MM'
  lunchTime?: string;    // 无工作日程时使用

  // 提醒开关
  reminderEnabled?: boolean;
}

export interface UserProfileManual {
  primaryUse?: PrimaryUse;
  lifeStage?: LifeStage;
  wakeTime?: string;
  sleepTime?: string;
  mealTimes?: number[];
  mealTimesText?: string[];
  currentGoal?: string;
  lifeGoal?: string;
  tags?: string[];
  freeText?: string;
}

export interface UserProfileObserved {
  wakeTime?: ConfidenceSignal<string>;
  sleepTime?: ConfidenceSignal<string>;
  mealTimes?: ConfidenceSignal<number[]>;
  activeWindows?: ConfidenceSignal<string[]>;
  moodByTimeBand?: ConfidenceSignal<Record<string, string>>;
  efficiencyByTimeBand?: ConfidenceSignal<Record<string, string>>;
  weeklyStateSummary?: ConfidenceSignal<string>;
  topActivities?: ConfidenceSignal<string[]>;
  topMoods?: ConfidenceSignal<string[]>;
}

export interface UserProfileDynamicSignals {
  preferences?: ConfidenceSignal<string[]>;
  dislikes?: ConfidenceSignal<string[]>;
  copingPatterns?: ConfidenceSignal<string[]>;
  relationshipSignals?: ConfidenceSignal<string[]>;
  currentFocusInference?: ConfidenceSignal<string[]>;
}

export interface UserProfileV2 {
  manual: UserProfileManual;
  observed?: UserProfileObserved;
  dynamicSignals?: UserProfileDynamicSignals;
  anniversariesVisible?: VisibleAnniversary[];
  hiddenMoments?: HiddenMoment[];
  onboardingCompleted?: boolean;
  lastExtractedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpcomingVisibleAnniversary extends VisibleAnniversary {
  daysUntil: number;
}

export interface UserProfileSnapshot {
  text: string;
  declaredMealTimes?: number[];
  observedMealTimes?: number[];
  mealTimesForSuggestion?: number[];
  visibleUpcomingAnniversaries?: UpcomingVisibleAnniversary[];
  hiddenRecallMoments?: HiddenMoment[];
}
