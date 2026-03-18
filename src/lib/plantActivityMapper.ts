// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/TimeShine_植物生长_技术实现文档_v1.7.docx
import type { FocusLevel, PlantCategoryKey } from '../types/plant.js';

export interface PlantActivitySource {
  id: string;
  content?: string;
  duration?: number | null;
  activityType?: string | null;
  isMood?: boolean | null;
}

export interface PlantActivityMapped {
  id: string;
  categoryKey: PlantCategoryKey;
  minutes: number;
  focus: FocusLevel;
}

const TYPE_TO_CATEGORY: Record<string, PlantCategoryKey> = {
  entertainment: 'entertainment',
  dopamine: 'entertainment',
  recharge: 'entertainment',
  social: 'social',
  social_duty: 'social',
  work: 'work_study',
  study: 'work_study',
  deep_focus: 'work_study',
  work_study: 'work_study',
  health: 'exercise',
  body: 'exercise',
  exercise: 'exercise',
  sport: 'exercise',
  life: 'life',
  necessary: 'life',
  self_talk: 'life',
  dissolved: 'life',
  unknown: 'life',
  '待分类': 'life',
};

const CONTENT_HINTS: Record<PlantCategoryKey, string[]> = {
  entertainment: ['娱乐', '放松', '游戏', '视频', '电影', 'music', 'game'],
  social: ['社交', '朋友', '家人', '聊天', 'social', 'meeting'],
  work_study: ['学习', '工作', '复盘', '写作', 'study', 'work', 'code'],
  exercise: ['运动', '健身', '跑步', '瑜伽', 'exercise', 'run', 'gym'],
  life: ['生活', '吃饭', '通勤', '家务', 'sleep', 'meal', 'commute'],
};

const PRIORITY: PlantCategoryKey[] = ['work_study', 'exercise', 'social', 'entertainment', 'life'];

const normalizeType = (value: string): string => value.trim().toLowerCase();

function inferCategoryFromContent(content: string): PlantCategoryKey {
  const lower = content.toLowerCase();
  for (const category of PRIORITY) {
    if (CONTENT_HINTS[category].some(hint => lower.includes(hint.toLowerCase()))) {
      return category;
    }
  }
  return 'life';
}

export function toPlantCategoryKey(activityType?: string | null, content?: string): PlantCategoryKey {
  if (activityType) {
    const normalized = normalizeType(activityType);
    if (TYPE_TO_CATEGORY[normalized]) {
      return TYPE_TO_CATEGORY[normalized];
    }
  }
  return inferCategoryFromContent(content ?? '');
}

export function toFocusLevel(minutes: number): FocusLevel {
  return minutes >= 90 ? 'high' : 'medium';
}

export function mapSourcesToPlantActivities(sources: PlantActivitySource[]): PlantActivityMapped[] {
  return sources
    .map((source) => {
      const minutes = Math.max(0, Number(source.duration ?? 0));
      return {
        id: source.id,
        minutes,
        isMood: Boolean(source.isMood),
        categoryKey: toPlantCategoryKey(source.activityType, source.content),
      };
    })
    .filter(item => !item.isMood && item.minutes > 0)
    .map(item => ({
      id: item.id,
      categoryKey: item.categoryKey,
      minutes: item.minutes,
      focus: toFocusLevel(item.minutes),
    }));
}
