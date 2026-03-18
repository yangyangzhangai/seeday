// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/TimeShine_植物生长_PRD_v1_8.docx -> docs/TimeShine_植物生长_技术实现文档_v1.7.docx
import type { FocusLevel, PlantCategoryKey, RootMetrics, RootType } from '../types/plant';

export interface PlantActivityInput {
  id: string;
  categoryKey: PlantCategoryKey;
  minutes: number;
  focus?: FocusLevel;
}

interface RootTypeScoreRule {
  threshold: (metrics: RootMetrics) => boolean;
  score: (metrics: RootMetrics) => number;
}

export interface RootScoreConfig {
  tieBreakThreshold: number;
  tieBreakPriority: RootType[];
  rules: Record<RootType, RootTypeScoreRule>;
  supportThreshold: {
    supportRatioMin: number;
    depthScoreMin: number;
    dominantRatioMaxExclusive: number;
  };
  specialThreshold: {
    airMaxActivities: number;
    airMaxTotalMinutesExclusive: number;
    entertainmentRatioMin: number;
  };
}

const CATEGORY_WEIGHT: Record<PlantCategoryKey, number> = {
  entertainment: 1,
  social: 1,
  work_study: 1,
  exercise: 1,
  life: 0.3,
};

const TARGET_CATEGORIES: PlantCategoryKey[] = ['entertainment', 'social', 'work_study', 'exercise'];

const clamp01 = (value: number): number => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

const toRatio = (value: number, total: number): number => {
  if (total <= 0) return 0;
  return clamp01(value / total);
};

const safeLog = (value: number): number => {
  if (value <= 0) return 0;
  return Math.log(value);
};

const normalizedEntropy = (values: number[]): number => {
  const positives = values.filter(value => value > 0);
  if (positives.length <= 1) return 0;
  const sum = positives.reduce((acc, value) => acc + value, 0);
  if (sum <= 0) return 0;
  const entropy = positives.reduce((acc, value) => {
    const p = value / sum;
    return p <= 0 ? acc : acc - p * safeLog(p);
  }, 0);
  const normalized = entropy / safeLog(positives.length);
  return clamp01(normalized);
};

const initBreakdown = (): RootMetrics['directionBreakdown'] => ({
  entertainment: { minutes: 0, weightedMinutes: 0, activities: 0, focus: 'medium' },
  social: { minutes: 0, weightedMinutes: 0, activities: 0, focus: 'medium' },
  work_study: { minutes: 0, weightedMinutes: 0, activities: 0, focus: 'medium' },
  exercise: { minutes: 0, weightedMinutes: 0, activities: 0, focus: 'medium' },
  life: { minutes: 0, weightedMinutes: 0, activities: 0, focus: 'medium' },
});

const buildScores = (metrics: RootMetrics, config: RootScoreConfig): Record<RootType, number> => {
  const roots: RootType[] = ['tap', 'fib', 'sha', 'bra', 'bul'];
  return roots.reduce((acc, rootType) => {
    const rule = config.rules[rootType];
    acc[rootType] = rule.threshold(metrics) ? rule.score(metrics) : Number.NEGATIVE_INFINITY;
    return acc;
  }, {} as Record<RootType, number>);
};

export const ROOT_SCORE_CONFIG: RootScoreConfig = {
  tieBreakThreshold: 6,
  tieBreakPriority: ['fib', 'tap', 'bra', 'sha', 'bul'],
  rules: {
    tap: {
      threshold: () => true,
      score: metrics => metrics.dominantRatio * 55 + metrics.top2Gap * 45,
    },
    fib: {
      threshold: metrics => metrics.activeTargetDirections >= 2,
      score: metrics => metrics.evenness * 55 + (1 - metrics.top2Gap) * 25 + metrics.depthScore * 20,
    },
    sha: {
      threshold: metrics => metrics.depthScore <= 0.45,
      score: metrics => (1 - metrics.depthScore) * 55 + metrics.evenness * 25 + (1 - metrics.dominantRatio) * 20,
    },
    bra: {
      threshold: metrics => metrics.dominantRatio >= 0.25 && metrics.dominantRatio <= 0.78,
      score: metrics => {
        const centerBonus = 1 - Math.abs(metrics.dominantRatio - 0.5) / 0.28;
        return clamp01(centerBonus) * 30 + metrics.branchiness * 45 + metrics.depthScore * 25;
      },
    },
    bul: {
      threshold: metrics => metrics.dominantRatio >= 0.35 && metrics.depthScore >= 0.5,
      score: metrics => metrics.dominantRatio * 35 + metrics.depthScore * 50 + metrics.top2Gap * 15,
    },
  },
  supportThreshold: {
    supportRatioMin: 0.28,
    depthScoreMin: 0.35,
    dominantRatioMaxExclusive: 0.65,
  },
  specialThreshold: {
    airMaxActivities: 2,
    airMaxTotalMinutesExclusive: 30,
    entertainmentRatioMin: 0.6,
  },
};

export function computeRootMetrics(activities: PlantActivityInput[]): RootMetrics {
  const breakdown = initBreakdown();
  for (const activity of activities) {
    const minutes = Math.max(0, activity.minutes || 0);
    if (minutes <= 0) continue;
    const item = breakdown[activity.categoryKey];
    item.minutes += minutes;
    item.weightedMinutes += minutes * CATEGORY_WEIGHT[activity.categoryKey];
    item.activities += 1;
    if ((activity.focus ?? 'medium') === 'high') item.focus = 'high';
  }

  const totalMinutes = Object.values(breakdown).reduce((acc, item) => acc + item.minutes, 0);
  const weightedTotal = Object.values(breakdown).reduce((acc, item) => acc + item.weightedMinutes, 0);
  const targetMinutes = TARGET_CATEGORIES.map(category => breakdown[category]!.minutes);
  const targetActivities = TARGET_CATEGORIES.map(category => breakdown[category]!.activities);
  const sortedTargetMinutes = [...targetMinutes].sort((a, b) => b - a);
  const top1 = sortedTargetMinutes[0] ?? 0;
  const top2 = sortedTargetMinutes[1] ?? 0;
  const activeTargetDirections = targetMinutes.filter(value => value > 0).length;

  const highFocusMinutes = activities.reduce((acc, activity) => {
    const minutes = Math.max(0, activity.minutes || 0);
    return (activity.focus ?? 'medium') === 'high' ? acc + minutes : acc;
  }, 0);
  const longSessionMinutes = activities.reduce((acc, activity) => {
    const minutes = Math.max(0, activity.minutes || 0);
    return minutes >= 90 ? acc + minutes : acc;
  }, 0);
  const timeComponent = clamp01(safeLog(1 + totalMinutes / 60) / safeLog(13));
  const qualityComponent = clamp01(toRatio(highFocusMinutes, totalMinutes) * 0.6 + toRatio(longSessionMinutes, totalMinutes) * 0.4);

  return {
    dominantRatio: toRatio(top1, weightedTotal),
    top2Gap: clamp01(toRatio(top1, weightedTotal) - toRatio(top2, weightedTotal)),
    depthScore: clamp01(timeComponent * 0.4 + qualityComponent * 0.6),
    evenness: normalizedEntropy(targetMinutes),
    branchiness: normalizedEntropy(targetActivities),
    totalMinutes,
    activeTargetDirections,
    directionBreakdown: breakdown,
  };
}

export function matchRootType(metrics: RootMetrics, config: RootScoreConfig = ROOT_SCORE_CONFIG): RootType {
  const scores = buildScores(metrics, config);
  const ranked = Object.entries(scores)
    .map(([rootType, score]) => ({ rootType: rootType as RootType, score }))
    .filter(item => Number.isFinite(item.score))
    .sort((a, b) => b.score - a.score);
  if (ranked.length === 0) return 'tap';
  const leader = ranked[0]!;
  const tieCandidates = ranked.filter(item => leader.score - item.score < config.tieBreakThreshold);
  if (tieCandidates.length <= 1) return leader.rootType;
  const tieSet = new Set(tieCandidates.map(item => item.rootType));
  return config.tieBreakPriority.find(rootType => tieSet.has(rootType)) ?? leader.rootType;
}

export function resolveSupportVariant(metrics: RootMetrics, config: RootScoreConfig = ROOT_SCORE_CONFIG): boolean {
  const supportMinutes = (metrics.directionBreakdown.exercise?.minutes ?? 0) + (metrics.directionBreakdown.life?.minutes ?? 0);
  const supportRatio = toRatio(supportMinutes, metrics.totalMinutes);
  return supportRatio >= config.supportThreshold.supportRatioMin
    && metrics.depthScore >= config.supportThreshold.depthScoreMin
    && metrics.dominantRatio < config.supportThreshold.dominantRatioMaxExclusive;
}

export function isAirPlantDay(activities: PlantActivityInput[], config: RootScoreConfig = ROOT_SCORE_CONFIG): boolean {
  const activityCount = activities.filter(activity => (activity.minutes || 0) > 0).length;
  const totalMinutes = activities.reduce((acc, activity) => acc + Math.max(0, activity.minutes || 0), 0);
  return activityCount <= config.specialThreshold.airMaxActivities
    && totalMinutes < config.specialThreshold.airMaxTotalMinutesExclusive;
}

export function isEntertainmentDominantDay(metrics: RootMetrics, config: RootScoreConfig = ROOT_SCORE_CONFIG): boolean {
  const entertainmentMinutes = metrics.directionBreakdown.entertainment?.minutes ?? 0;
  return toRatio(entertainmentMinutes, metrics.totalMinutes) >= config.specialThreshold.entertainmentRatioMin;
}
