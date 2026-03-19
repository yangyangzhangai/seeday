// DOC-DEPS: LLM.md -> docs/TimeShine_植物生长_PRD_v1_8.docx -> docs/TimeShine_植物生长_技术实现文档_v1.7.docx

export type RootType = 'tap' | 'fib' | 'sha' | 'bra' | 'bul';

export type PlantStage = 'early' | 'mid' | 'late';

export type DirectionIndex = 0 | 1 | 2 | 3 | 4;

export type FocusLevel = 'medium' | 'high';

export type PlantCategoryKey = 'entertainment' | 'social' | 'work_study' | 'exercise' | 'life';

export const DEFAULT_DIRECTION_ORDER: PlantCategoryKey[] = [
  'entertainment',
  'social',
  'work_study',
  'exercise',
  'life',
];

export interface DirectionBreakdownItem {
  minutes: number;
  weightedMinutes: number;
  activities: number;
  focus: FocusLevel;
}

export interface RootMetrics {
  dominantRatio: number;
  top2Gap: number;
  depthScore: number;
  evenness: number;
  branchiness: number;
  totalMinutes: number;
  activeTargetDirections: number;
  directionBreakdown: Partial<Record<PlantCategoryKey, DirectionBreakdownItem>>;
}

export interface DailyPlantRecord {
  id: string;
  userId: string;
  date: string;
  timezone: string;
  rootMetrics: RootMetrics;
  rootType: RootType;
  plantId: string;
  plantStage: PlantStage;
  isSpecial: boolean;
  isSupportVariant: boolean;
  diaryText?: string;
  generatedAt: number;
  cycleId?: string | null;
}

export interface RootSegment {
  id: string;
  direction: DirectionIndex;
  activityId: string;
  minutes: number;
  focus: FocusLevel;
  isMainRoot: boolean;
  branchOrder: number;
  growthMode?: 'origin' | 'branch';
  branchRatio?: number;
  parentRootId?: string;
}

export type PlantApiStatus = 'too_early' | 'empty_day' | 'generated' | 'already_generated';

export interface PlantGenerateRequest {
  date: string;
  timezone: string;
  dayStartMs?: number;
  dayEndMs?: number;
  lang?: 'zh' | 'en' | 'it';
}

export interface PlantDiaryRequest {
  date: string;
  activities: Array<{ category: PlantCategoryKey; duration: number; focus: FocusLevel }>;
  totalDuration: number;
  rootType: RootType;
  plantStage: PlantStage;
  isSpecial: boolean;
  isSupportVariant?: boolean;
  lang?: 'zh' | 'en' | 'it';
}

export interface PlantDiaryResponse {
  success: boolean;
  diaryText: string;
  diaryStatus: 'ready' | 'fallback';
}

export interface PlantGenerateResponse {
  success: boolean;
  status: PlantApiStatus;
  plant: DailyPlantRecord | null;
  message?: string;
  diaryStatus?: 'ready' | 'fallback';
}

export interface PlantHistoryResponse {
  success: boolean;
  records: DailyPlantRecord[];
}

export interface PlantDirectionConfig {
  id: string;
  userId: string;
  directionIndex: DirectionIndex;
  categoryKey: PlantCategoryKey;
  updatedAt: number;
}
