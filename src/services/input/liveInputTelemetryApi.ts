import type { InternalLiveInputKind, LiveInputClassification, LiveInputConfidence, LiveInputKind } from './types';

export type LiveInputTelemetryEventType =
  | 'classification'
  | 'correction'
  | 'plant_asset'
  | 'diary_sticker'
  | 'annotation_telemetry'
  | 'todo_decompose';
export type LiveInputTelemetryCorrectionKind = 'activity' | 'mood';
export type LiveInputTelemetryLang = 'zh' | 'en' | 'it';

export interface LiveInputTelemetryBaseEvent {
  sessionId?: string;
  lang?: LiveInputTelemetryLang;
  platform?: string;
  appVersion?: string;
}

export interface LiveInputClassificationIngestRequest extends LiveInputTelemetryBaseEvent {
  eventType: 'classification';
  rawInput: string;
  inputLength: number;
  kind: LiveInputKind;
  internalKind: InternalLiveInputKind;
  confidence: LiveInputConfidence;
  reasons: string[];
  relatedActivityId?: string;
  containsMoodSignal?: boolean;
  extractedMood?: string;
  messageId?: string;
}

export interface LiveInputCorrectionIngestRequest extends LiveInputTelemetryBaseEvent {
  eventType: 'correction';
  rawInput?: string;
  inputLength: number;
  fromKind: LiveInputTelemetryCorrectionKind;
  toKind: LiveInputTelemetryCorrectionKind;
  messageId?: string;
}

export type LiveInputTelemetryIngestRequest =
  | LiveInputClassificationIngestRequest
  | LiveInputCorrectionIngestRequest;

export interface LiveInputTelemetryIngestResponse {
  success: boolean;
  id?: string;
  skipped?: boolean;
}

export interface LiveInputTelemetryBreakdownItem {
  key: string;
  count: number;
  percent: number;
}

export interface LiveInputTelemetrySeriesPoint {
  day: string;
  classificationCount: number;
  correctionCount: number;
  plantAssetCount: number;
  diaryStickerCount: number;
  uniqueUsers: number;
}

export interface TodoDecomposeTelemetrySeriesPoint {
  day: string;
  requestedCount: number;
  succeededCount: number;
  emptyCount: number;
  parseFailedCount: number;
  failedCount: number;
  regenerateCount: number;
}

export interface TodoDecomposeTelemetrySummary {
  requestedCount: number;
  succeededCount: number;
  emptyCount: number;
  parseFailedCount: number;
  failedCount: number;
  regenerateCount: number;
  uniqueTodosDecomposed: number;
  emptyRate: number;
  parseFailureRate: number;
  failureRate: number;
  regenerateRate: number;
  avgStepsPerSuccess: number;
}

export interface LiveInputTelemetryRecentEvent {
  id: string;
  createdAt: string;
  userId: string;
  eventType: LiveInputTelemetryEventType;
  kind?: LiveInputKind | null;
  internalKind?: InternalLiveInputKind | null;
  confidence?: LiveInputConfidence | null;
  reasons?: string[];
  fromKind?: LiveInputTelemetryCorrectionKind | null;
  toKind?: LiveInputTelemetryCorrectionKind | null;
  fallbackLevel?: 1 | 2 | 3 | 4 | null;
  requestedPlantId?: string | null;
  resolvedAssetUrl?: string | null;
  rootType?: string | null;
  plantStage?: string | null;
  eventName?: string | null;
  reportId?: string | null;
  reportDate?: string | null;
  stickerId?: string | null;
  newOrder?: string[] | null;
  lang?: string | null;
  inputLength: number;
  inputPreview?: string | null;
  narrativeScore?: number | null;
  finalProbability?: number | null;
  triggered?: boolean | null;
  characterId?: string | null;
  associationType?: string | null;
  todoId?: string | null;
  isRegenerate?: boolean | null;
  model?: string | null;
  provider?: string | null;
  stepsCount?: number | null;
}

export interface AnnotationScoreBucketItem {
  key: string;
  count: number;
  triggeredCount: number;
  triggerRate: number;
}

export interface AiAnnotationTelemetrySummary {
  totalEvents: number;
  densityScoredCount: number;
  triggerBlockedCount: number;
  eventTriggeredCount: number;
  eventCondensedCount: number;
  lateralSampledCount: number;
  lateralTriggeredCount: number;
  lateralTriggerRate: number;
  avgNarrativeScore: number;
  avgFinalProbability: number;
}

export interface LiveInputTelemetryDashboardSummary {
  days: number;
  classificationCount: number;
  correctionCount: number;
  plantAssetCount: number;
  diaryStickerCount: number;
  correctionRate: number;
  plantExactHitRate: number;
  uniqueUsers: number;
}

export interface LiveInputTelemetryDashboardResponse {
  success: boolean;
  summary: LiveInputTelemetryDashboardSummary;
  byInternalKind: LiveInputTelemetryBreakdownItem[];
  correctionPaths: LiveInputTelemetryBreakdownItem[];
  topReasons: LiveInputTelemetryBreakdownItem[];
  byLang: LiveInputTelemetryBreakdownItem[];
  plantFallbackLevels: LiveInputTelemetryBreakdownItem[];
  diaryStickerActions: LiveInputTelemetryBreakdownItem[];
  annotationEventNames: LiveInputTelemetryBreakdownItem[];
  annotationCharacters: LiveInputTelemetryBreakdownItem[];
  associationTypes: LiveInputTelemetryBreakdownItem[];
  narrativeScoreBuckets: AnnotationScoreBucketItem[];
  aiAnnotationSummary: AiAnnotationTelemetrySummary;
  todoDecomposeSummary: TodoDecomposeTelemetrySummary;
  todoDecomposeEventNames: LiveInputTelemetryBreakdownItem[];
  todoDecomposeByLang: LiveInputTelemetryBreakdownItem[];
  todoDecomposeByModel: LiveInputTelemetryBreakdownItem[];
  todoDecomposeSeries: TodoDecomposeTelemetrySeriesPoint[];
  todoDecomposeRecentEvents: LiveInputTelemetryRecentEvent[];
  series: LiveInputTelemetrySeriesPoint[];
  recentEvents: LiveInputTelemetryRecentEvent[];
}

export function collectClassificationReasons(classification: LiveInputClassification): string[] {
  return Array.from(new Set([
    ...classification.reasons,
    ...(classification.evidence?.map((item) => item.reasonCode) ?? []),
  ]));
}
