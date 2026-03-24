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
  deep_focus: {
    label: '深度专注',
    emoji: '🔵',
    desc: '冷静、沉浸、屏蔽外界',
  },
  recharge: {
    label: '灵魂充电',
    emoji: '🟢',
    desc: '主动滋养、生长、恢复',
  },
  body: {
    label: '身体维护',
    emoji: '🟡',
    desc: '基础补给、躯壳照料',
  },
  necessary: {
    label: '生活运转',
    emoji: '🟠',
    desc: '稳定、必要、日常底色',
  },
  social_duty: {
    label: '声波交换',
    emoji: '🟣',
    desc: '被动或义务性的人际能量流动',
  },
  self_talk: {
    label: '自我整理',
    emoji: '🟤',
    desc: '沉淀、内敛、向内',
  },
  dopamine: {
    label: '即时满足',
    emoji: '🔴',
    desc: '冲动、刺激、停不下来',
  },
  dissolved: {
    label: '光的涣散',
    emoji: '⚫',
    desc: '模糊、无方向、去向不明',
  },
};

export const ACTIVE_CATEGORIES = new Set(['deep_focus', 'recharge', 'self_talk']);
export const ANOMALY_THRESHOLD = 0.35;
export const BAR_TOTAL = 12;
