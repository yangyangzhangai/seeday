import type { ActivityType } from '../lib/activityType';
import type { AiCompanionMode } from '../lib/aiCompanion';
/**
 * AI 批注系统类型定义
 * 
 * 用于管理 AI 外星观察者的批注行为：
 * - 事件驱动的批注触发
 * - 每日限额控制
 * - 批注内容展示
 */

export type AnnotationEventType = 
  | 'activity_completed'   // 活动完成时
  | 'activity_recorded'    // 记录新活动时
  | 'mood_recorded'        // 记录心情时
  | 'task_deleted'         // 删除待办时
  | 'idle_detected'        // 闲置检测（3小时无操作）
  | 'overwork_detected'    // 超时工作（超过3小时）
  | 'annotation_generated'; // 批注已生成（内部使用）

export type AnnotationTone = 'playful' | 'concerned' | 'celebrating' | 'curious';

export interface AnnotationEvent {
  type: AnnotationEventType;
  timestamp: number;
  data?: {
    content?: string;        // 活动内容/待办内容
    duration?: number;       // 活动时长（分钟）
    mood?: string;          // 心情内容
    count?: number;         // 相关计数（如连续完成数）
    [key: string]: any;
  };
}

/** AI 建议类型：活动建议 或 待办建议 */
export type SuggestionType = 'activity' | 'todo';

/** AI 建议数据 */
export interface AnnotationSuggestion {
  type: SuggestionType;
  /** 按钮文字，如"去喝水"/"去跑步" */
  actionLabel: string;
  /** type=activity 时的活动名称 */
  activityName?: string;
  /** type=todo 时的待办 ID */
  todoId?: string;
  /** type=todo 时的待办标题（用于兜底显示） */
  todoTitle?: string;
  /** 奖励星星数（建议激活后生效） */
  rewardStars?: number;
  /** 奖励目标瓶子（可选） */
  rewardBottleId?: string;
  /** 奖励目标 key（用于去重） */
  recoveryKey?: string;
}

export interface PendingSuggestionIntent {
  type: 'activity' | 'todo';
  annotationId: string;
  createdAt: number;
  activityName?: string;
  todoId?: string;
  todoTitle?: string;
}

export type RecoveryNudgeReason = 'bottle_missed_3_days' | 'recurring_missed_yesterday';

export interface RecoveryNudgeContext {
  key: string;
  reason: RecoveryNudgeReason;
  rewardStars: number;
  todoId?: string;
  todoTitle?: string;
  bottleId?: string;
  bottleName?: string;
  activityName?: string;
}

export interface AIAnnotation {
  id: string;
  content: string;           // 批注文本内容
  tone: AnnotationTone;      // 语气标签
  timestamp: number;         // 生成时间
  relatedEvent: AnnotationEvent;  // 关联的触发事件
  todayContext?: TodayContextSnapshot; // 生成时的今日上下文快照（便于回放/分析）
  displayDuration: number;   // 建议显示时长（毫秒）
  syncedToCloud: boolean;    // 是否已同步到云端
  suggestion?: AnnotationSuggestion; // AI 建议（overwork 模式）
  suggestionAccepted?: boolean; // suggestion 反馈（true/false/null）
}

export interface AnnotationState {
  // 当前显示的批注
  currentAnnotation: AIAnnotation | null;
  
  // 今日统计（用于 AI 决策和限制检查）
  todayStats: {
    date: string;            // 日期字符串 YYYY-MM-DD
    speakCount: number;      // 今日已批注次数
    lastSpeakTime: number;   // 上次批注时间戳
    events: AnnotationEvent[];  // 今日事件日志
  };
  
  // 配置
  config: {
    dailyLimit: number;      // 每日限额，默认 5
    enabled: boolean;        // 总开关
    dropRate?: 'low' | 'medium' | 'high'; // 批注频率档位
  };
}

// 事件权重配置
export interface EventWeight {
  base: number;              // 基础概率 0-100
  max: number;               // 最大概率上限
  bonuses: BonusCondition[];
}

export interface BonusCondition {
  check: (event: AnnotationEvent, todayEvents: AnnotationEvent[]) => boolean;
  bonus: number;             // 加成值
  description: string;       // 描述（用于调试）
}

// 今日活动详细信息
export interface TodayActivity {
  content: string;           // 活动名称/内容
  duration: number;          // 活动时长（分钟）
  activityType?: ActivityType; // 活动类型（AI分类）
  moodLabel?: string;        // 活动旁显示的心情标签（八类或自定义）
  timestamp: number;         // 开始时间
  completed: boolean;        // 是否已完成
}

// AI 请求/响应类型
/** 待办摘要（传给 AI 用于建议选择） */
export interface PendingTodoSummary {
  id: string;
  title: string;
  category?: string;
  dueAt?: number;
}

export type TodayContextCategory = 'health' | 'special_day' | 'major_event';

export interface TodayContextItem {
  id: string;
  category: TodayContextCategory;
  summary: string;
  sourceText: string;
  confidence: number;
  detectedAt: number;
  expiresAt: number;
}

export interface TodayContextSnapshot {
  date: string;
  items: TodayContextItem[];
  version: 'v1';
}

export interface AnnotationCurrentDate {
  year: number;
  month: number;
  day: number;
  weekday: number;
  weekdayName?: string;
  isoDate: string;
}

export interface AnnotationHolidayContext {
  isHoliday: boolean;
  name?: string;
  type?: 'legal' | 'social';
  source: 'calendar' | 'none';
}

export type WeatherCondition =
  | 'sunny'
  | 'cloudy'
  | 'overcast'
  | 'rain_light'
  | 'rain_medium'
  | 'rain_heavy'
  | 'snow'
  | 'hail'
  | 'windy'
  | 'unknown';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter' | 'unknown';

export type WeatherAlert = 'strong_wind_watch' | 'haze_watch';

export interface WeatherContextV2 {
  temperatureC: number | null;
  conditions: WeatherCondition[];
  source: 'api' | 'fallback';
}

export interface SeasonContextV2 {
  season: Season;
  source: 'local' | 'fallback';
}

export interface AnnotationRequest {
  eventType: AnnotationEventType;
  eventData: AnnotationEvent['data'];
  userContext: {
    todayActivities: number;           // 活动总数
    todayDuration: number;             // 今日总时长
    currentHour: number;               // 当前时间
    currentMinute?: number;            // 当前分钟
    timezone?: string;                 // IANA 时区字符串，如 "Europe/Rome"
    currentDate?: AnnotationCurrentDate;
    countryCode?: string;              // ISO 3166-1 alpha-2, 如 "CN" / "IT"
    holiday?: AnnotationHolidayContext;
    latitude?: number;
    longitude?: number;
    weatherContext?: WeatherContextV2;
    seasonContext?: SeasonContextV2;
    weatherAlerts?: WeatherAlert[];
    recentAnnotations?: string[];      // 最近批注（可选）
    recentMoodMessages?: string[];     // 连续心情原文（最多3条）
    moodConversationHistory?: Array<{ role: 'user' | 'ai'; content: string }>;
    todayActivitiesList: TodayActivity[]; // 今日每件活动的详细数据
    pendingTodos?: PendingTodoSummary[];  // 未完成待办（overwork 模式用）
    statusSummary?: string;
    contextHints?: string[];
    frequentActivities?: string[];
    todayContext?: TodayContextSnapshot;
    allowSuggestion?: boolean;
    forceSuggestion?: boolean;
    consecutiveTextCount?: number;
    recoveryNudge?: RecoveryNudgeContext;
  };
  lang?: 'zh' | 'en' | 'it';
  aiMode?: AiCompanionMode;
}

export interface AnnotationResponse {
  content: string;
  tone: AnnotationTone;
  displayDuration: number;
  suggestion?: AnnotationSuggestion;
  source?: 'ai' | 'default';
  reason?:
    | 'no_key'
    | 'fetch_failed'
    | 'empty_response'
    | 'empty_content'
    | 'extract_failed'
    | 'exception'
    | 'suggestion_force_fallback'
    | 'duplicate_or_emoji_repeated';
  debugAiMode?: string;
}

// Chutes API 类型
export interface ChutesMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChutesRequest {
  model: string;
  messages: ChutesMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface ChutesResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
