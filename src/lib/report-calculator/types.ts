export interface ClassifiedItem {
  name: string;
  duration_min: number;
  time_slot: 'morning' | 'afternoon' | 'evening' | null;
  category: string;
  flag: 'ambiguous' | null;
  matched_bottle?: { type: 'habit' | 'goal'; id: string; stars: number } | null;
  matched_by?: 'ai' | 'keyword';
}

export interface EnergyLog {
  time_slot: 'morning' | 'afternoon' | 'evening';
  energy_level: 'high' | 'medium' | 'low' | null;
  mood: string | null;
}

export interface ClassifiedData {
  total_duration_min: number;
  items: ClassifiedItem[];
  todos: {
    completed: number;
    total: number;
  };
  energy_log: EnergyLog[];
}

export interface SpectrumItem {
  category: string;
  label: string;
  emoji: string;
  duration_min: number;
  duration_str: string;
  ratio: number;
  percent_str: string;
  bar: string;
  is_anomaly: boolean;
  top_item: {
    name: string;
    duration_str: string;
  } | null;
}

export interface LightQuality {
  focus_ratio: number;
  scatter_ratio: number;
  active_ratio: number;
  passive_ratio: number;
  focus_pct: string;
  scatter_pct: string;
  active_pct: string;
  passive_pct: string;
  todo_completed: number;
  todo_total: number;
  todo_ratio: number | null;
  todo_str: string;
}

export interface TrendSignal {
  metric: string;
  today: string;
  hist_avg: string;
  delta?: number;
  direction: string;
  is_positive: boolean;
  is_warning: boolean;
  consecutive_up?: boolean;
  consecutive_days?: number;
}

export interface MoodRecord {
  time: string;
  time_slot: 'morning' | 'afternoon' | 'evening';
  content: string;
}

export interface ComputedResult {
  total_duration_str: string;
  spectrum: SpectrumItem[];
  light_quality: LightQuality;
  gravity_mismatch: string | null;
  energy_log: EnergyLog[];
  raw_items: ClassifiedItem[];
  history_trends: TrendSignal[];
  mood_records?: MoodRecord[];
}

export const CATEGORY_CONFIG: Record<string, { label: string; emoji: string; desc: string }> = {
  study: {
    label: '学习',
    emoji: '📖',
    desc: '学习、阅读、备考、课程',
  },
  work: {
    label: '工作',
    emoji: '💼',
    desc: '编程、会议、设计、办公',
  },
  social: {
    label: '社交',
    emoji: '💬',
    desc: '聊天、聚会、社交互动',
  },
  life: {
    label: '生活',
    emoji: '🏠',
    desc: '家务、通勤、日常事务',
  },
  entertainment: {
    label: '娱乐',
    emoji: '🎮',
    desc: '游戏、影视、休闲放松',
  },
  health: {
    label: '健康',
    emoji: '💪',
    desc: '运动、健身、睡眠、就医',
  },
};

export const ACTIVE_CATEGORIES = new Set(['study', 'work']);
export const ANOMALY_THRESHOLD = 0.35;
export const BAR_TOTAL = 12;
