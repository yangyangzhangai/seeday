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
