export const ACTIVITY_RECORD_TYPES = [
  'study',
  'work',
  'social',
  'life',
  'entertainment',
  'health',
] as const;

export type ActivityRecordType = (typeof ACTIVITY_RECORD_TYPES)[number];
export type ActivityType = ActivityRecordType | 'chat' | 'mood';
export type ActivityTypeConfidence = 'high' | 'medium' | 'low';

interface ActivityTypeResult {
  activityType: ActivityRecordType;
  confidence: ActivityTypeConfidence;
}

const STUDY_HINTS = [
  '学习', '复习', '预习', '课程', '作业', '刷题', '考试', '备考', '背单词', '看教材', '看论文',
  'study', 'review', 'learn', 'lesson', 'homework', 'exam',
];

const KEYWORDS: Record<ActivityRecordType, string[]> = {
  study: STUDY_HINTS,
  work: [
    '工作', '上班', '开会', '会议', '需求', '项目', '汇报', '沟通', '对接', '通勤', '写代码', '开发',
    'work', 'meeting', 'project', 'task', 'office', 'code',
  ],
  social: [
    '社交', '聊天', '闲聊', '朋友', '家人', '约会', '聚会', '聚餐', '见朋友', '电话', '连麦',
    'social', 'friend', 'family', 'chat', 'call', 'meeting with',
  ],
  life: [
    '生活', '吃饭', '做饭', '家务', '通勤', '洗澡', '购物', '买菜', '收拾', '打扫', '睡觉',
    'life', 'meal', 'commute', 'chores', 'clean',
  ],
  entertainment: [
    '娱乐', '游戏', '电影', '追剧', '看剧', '刷视频', '短视频', '听歌', '看动漫', '放松',
    'entertainment', 'game', 'movie', 'music', 'video', 'relax',
  ],
  health: [
    '健康', '运动', '健身', '跑步', '散步', '瑜伽', '拉伸', '体检', '看医生', '喝水', '睡眠',
    'health', 'exercise', 'gym', 'run', 'walk', 'yoga', 'sleep',
  ],
};

const CHAT_OR_MOOD_TYPES = new Set(['chat', 'mood']);
const RECORD_TYPES = new Set<ActivityRecordType>(ACTIVITY_RECORD_TYPES);

const LEGACY_TO_RECORD_TYPE: Record<string, ActivityRecordType | 'work_or_study'> = {
  work_study: 'work_or_study',
  deep_focus: 'work_or_study',
  exercise: 'health',
  body: 'health',
  sport: 'health',
  social_duty: 'social',
  recharge: 'entertainment',
  dopamine: 'entertainment',
  necessary: 'life',
  self_talk: 'life',
  dissolved: 'life',
  unknown: 'life',
  '待分类': 'life',
  '未分类': 'life',
};

function includesAnyKeyword(input: string, keywords: string[]): number {
  let score = 0;
  for (const keyword of keywords) {
    if (input.includes(keyword.toLowerCase())) {
      score += keyword.length >= 2 ? 2 : 1;
    }
  }
  return score;
}

function isStudyLike(input: string): boolean {
  return STUDY_HINTS.some((hint) => input.includes(hint.toLowerCase()));
}

function resolveWorkOrStudy(input: string): ActivityRecordType {
  return isStudyLike(input) ? 'study' : 'work';
}

export function classifyRecordActivityType(content?: string | null): ActivityTypeResult {
  const normalized = (content ?? '').trim().toLowerCase();
  if (!normalized) {
    return { activityType: 'life', confidence: 'low' };
  }

  let bestType: ActivityRecordType = 'life';
  let bestScore = -1;
  let secondScore = -1;

  for (const type of ACTIVITY_RECORD_TYPES) {
    const score = includesAnyKeyword(normalized, KEYWORDS[type]);
    if (score > bestScore) {
      secondScore = bestScore;
      bestScore = score;
      bestType = type;
    } else if (score > secondScore) {
      secondScore = score;
    }
  }

  if (bestScore <= 0) {
    return { activityType: 'life', confidence: 'low' };
  }

  if (bestScore - secondScore >= 2) {
    return { activityType: bestType, confidence: 'high' };
  }

  return { activityType: bestType, confidence: 'medium' };
}

export function mapClassifierCategoryToActivityType(
  category?: string | null,
  content?: string | null,
): ActivityRecordType {
  const normalizedCategory = (category ?? '').trim().toLowerCase();
  const normalizedContent = (content ?? '').trim().toLowerCase();

  if (!normalizedCategory) {
    return classifyRecordActivityType(normalizedContent).activityType;
  }

  if (normalizedCategory === 'deep_focus') {
    return resolveWorkOrStudy(normalizedContent);
  }
  if (normalizedCategory === 'necessary') return 'life';
  if (normalizedCategory === 'body') return 'health';
  if (normalizedCategory === 'social_duty') return 'social';
  if (normalizedCategory === 'self_talk') return 'life';
  if (normalizedCategory === 'dopamine') return 'entertainment';
  if (normalizedCategory === 'dissolved') return 'life';
  if (normalizedCategory === 'recharge') {
    if (KEYWORDS.social.some((word) => normalizedContent.includes(word.toLowerCase()))) {
      return 'social';
    }
    return 'entertainment';
  }
  return classifyRecordActivityType(normalizedContent).activityType;
}

export function normalizeActivityType(
  value?: string | null,
  content?: string | null,
): ActivityType {
  const normalizedValue = (value ?? '').trim().toLowerCase();
  const normalizedContent = (content ?? '').trim().toLowerCase();

  if (!normalizedValue) {
    return classifyRecordActivityType(normalizedContent).activityType;
  }

  if (CHAT_OR_MOOD_TYPES.has(normalizedValue)) {
    return normalizedValue as ActivityType;
  }

  if (RECORD_TYPES.has(normalizedValue as ActivityRecordType)) {
    return normalizedValue as ActivityRecordType;
  }

  const legacyMapped = LEGACY_TO_RECORD_TYPE[normalizedValue];
  if (!legacyMapped) {
    return classifyRecordActivityType(normalizedContent).activityType;
  }

  if (legacyMapped === 'work_or_study') {
    return resolveWorkOrStudy(normalizedContent);
  }

  if (normalizedValue === 'unknown' || normalizedValue === '待分类' || normalizedValue === '未分类') {
    return classifyRecordActivityType(normalizedContent).activityType;
  }

  return legacyMapped;
}

export function normalizeTodoCategory(category?: string | null, title?: string | null): ActivityRecordType {
  return normalizeActivityType(category, title) as ActivityRecordType;
}
