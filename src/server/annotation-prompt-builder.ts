// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md
import {
  buildSuggestionAwareUserPrompt,
  buildUserPrompt,
  getModel,
  getSystemPrompt,
} from './annotation-prompts.js';
import type {
  AnnotationCurrentDate,
  AnnotationHolidayContext,
  PendingTodoSummary,
  RecoveryNudgeContext,
  SeasonContextV2,
  WeatherAlert,
  WeatherContextV2,
} from '../types/annotation.js';

type PromptMode = 'annotation' | 'suggestion';

interface BasePromptInput {
  lang: string;
  aiMode?: string;
  eventType: string;
  eventSummary: string;
  todayActivitiesText: string;
  recentMoodText: string;
  todayContextText?: string;
  currentDate?: AnnotationCurrentDate;
  holiday?: AnnotationHolidayContext;
  currentHour?: number;
  currentMinute?: number;
  weatherContext?: WeatherContextV2;
  seasonContext?: SeasonContextV2;
  weatherAlerts?: WeatherAlert[];
}

interface SuggestionPromptInput extends BasePromptInput {
  mode: 'suggestion';
  statusSummary?: string;
  contextHints?: string[];
  frequentActivities?: string[];
  pendingTodos?: PendingTodoSummary[];
  consecutiveTextCount?: number;
  forceSuggestion?: boolean;
  recoveryNudge?: RecoveryNudgeContext;
}

interface AnnotationPromptInput extends BasePromptInput {
  mode: 'annotation';
}

export type BuildAnnotationPromptInput = SuggestionPromptInput | AnnotationPromptInput;

export interface AnnotationPromptPackage {
  mode: PromptMode;
  model: string;
  instructions: string;
  input: string;
}

function buildPromptInput(payload: BuildAnnotationPromptInput): string {
  if (payload.mode === 'suggestion') {
    return buildSuggestionAwareUserPrompt({
      lang: payload.lang,
      eventType: payload.eventType,
      eventSummary: payload.eventSummary,
      todayActivitiesText: payload.todayActivitiesText,
      recentMoodText: payload.recentMoodText,
      todayContextText: payload.todayContextText,
      statusSummary: payload.statusSummary,
      contextHints: payload.contextHints,
      frequentActivities: payload.frequentActivities,
      pendingTodos: payload.pendingTodos,
      currentDate: payload.currentDate,
      holiday: payload.holiday,
      currentHour: payload.currentHour,
      currentMinute: payload.currentMinute,
      consecutiveTextCount: payload.consecutiveTextCount,
      forceSuggestion: payload.forceSuggestion,
      recoveryNudge: payload.recoveryNudge,
      weatherContext: payload.weatherContext,
      seasonContext: payload.seasonContext,
      weatherAlerts: payload.weatherAlerts,
    });
  }

  return buildUserPrompt(
    payload.lang,
    payload.eventType,
    payload.eventSummary,
    payload.todayActivitiesText,
    payload.recentMoodText,
    payload.todayContextText,
    payload.currentDate,
    payload.holiday,
    payload.currentHour,
    payload.currentMinute,
    payload.weatherContext,
    payload.seasonContext,
    payload.weatherAlerts,
  );
}

export function buildAnnotationPromptPackage(payload: BuildAnnotationPromptInput): AnnotationPromptPackage {
  return {
    mode: payload.mode,
    model: getModel(payload.lang),
    instructions: getSystemPrompt(payload.lang, payload.aiMode),
    input: buildPromptInput(payload),
  };
}
