import {
  ACTIVE_CATEGORIES,
  ANOMALY_THRESHOLD,
  BAR_TOTAL,
  CATEGORY_CONFIG,
  type ClassifiedData,
  type ClassifiedItem,
  type ComputedResult,
  type EnergyLog,
  type LightQuality,
  type SpectrumItem,
  type TrendSignal,
} from './types';
import { classifyRecordActivityType, type ActivityRecordType } from '../activityType';

export function parseClassifierResponse(raw: string): ClassifiedData {
  try {
    return JSON.parse(raw.trim()) as ClassifiedData;
  } catch {
    // keep fallback flow
  }

  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]) as ClassifiedData;
    } catch {
      // keep fallback flow
    }
  }

  console.warn('⚠️ 分类器输出无法解析，返回空结构');
  return {
    total_duration_min: 0,
    items: [],
    todos: { completed: 0, total: 0 },
    energy_log: [],
  };
}

export function minutesToDisplay(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

export function buildBar(ratio: number, total: number = BAR_TOTAL): string {
  const filled = Math.max(0, Math.min(total, Math.round(ratio * total)));
  return '█'.repeat(filled) + '░'.repeat(total - filled);
}

export function pct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export function computeSpectrum(items: ClassifiedItem[], totalMin: number): SpectrumItem[] {
  const catDuration: Record<string, number> = {};
  const catTop: Record<string, ClassifiedItem> = {};

  for (const item of items) {
    const cat: ActivityRecordType = classifyRecordActivityType(item.name).activityType;
    const dur = item.duration_min || 0;
    catDuration[cat] = (catDuration[cat] || 0) + dur;
    if (!catTop[cat] || dur > catTop[cat].duration_min) {
      catTop[cat] = item;
    }
  }

  const spectrum: SpectrumItem[] = [];
  const sortedCats = Object.entries(catDuration).sort((a, b) => b[1] - a[1]);

  for (const [cat, dur] of sortedCats) {
    const ratio = totalMin > 0 ? dur / totalMin : 0;
    const config = CATEGORY_CONFIG[cat] || { label: cat, emoji: '⚪', desc: '' };
    const top = catTop[cat];
    const showTop = top !== undefined && top.duration_min < dur;

    spectrum.push({
      category: cat,
      label: config.label,
      emoji: config.emoji,
      duration_min: dur,
      duration_str: minutesToDisplay(dur),
      ratio,
      percent_str: pct(ratio),
      bar: buildBar(ratio),
      is_anomaly: ratio > ANOMALY_THRESHOLD,
      top_item: showTop
        ? {
            name: top.name,
            duration_str: minutesToDisplay(top.duration_min),
          }
        : null,
    });
  }

  return spectrum;
}

export function computeLightQuality(
  spectrum: SpectrumItem[],
  totalMin: number,
  todosCompleted: number,
  todosTotal: number
): LightQuality {
  const NEUTRAL_CATEGORIES = new Set(['life', 'health']);

  const neutralMin = spectrum
    .filter((s) => NEUTRAL_CATEGORIES.has(s.category))
    .reduce((sum, s) => sum + s.duration_min, 0);

  const effectiveMin = Math.max(0, totalMin - neutralMin);

  const focusMin = spectrum
    .filter((s) => s.category === 'study' || s.category === 'work')
    .reduce((sum, s) => sum + s.duration_min, 0);

  const focusRatio = effectiveMin > 0 ? focusMin / effectiveMin : 0;
  const scatterRatio = effectiveMin > 0 ? 1 - focusRatio : 0;

  const activeMin = spectrum
    .filter((s) => ACTIVE_CATEGORIES.has(s.category))
    .reduce((sum, s) => sum + s.duration_min, 0);

  const activeRatio = effectiveMin > 0 ? activeMin / effectiveMin : 0;
  const passiveRatio = effectiveMin > 0 ? 1 - activeRatio : 0;
  const todoRatio = todosTotal > 0 ? todosCompleted / todosTotal : null;

  return {
    focus_ratio: focusRatio,
    scatter_ratio: scatterRatio,
    active_ratio: activeRatio,
    passive_ratio: passiveRatio,
    focus_pct: pct(focusRatio),
    scatter_pct: pct(scatterRatio),
    active_pct: pct(activeRatio),
    passive_pct: pct(passiveRatio),
    todo_completed: todosCompleted,
    todo_total: todosTotal,
    todo_ratio: todoRatio,
    todo_str: todosTotal > 0 ? `${todosCompleted}/${todosTotal} 项完成` : '无待办记录',
  };
}

export function detectGravityMismatch(
  items: ClassifiedItem[],
  energyLog: EnergyLog[],
  lang: 'zh' | 'en' | 'it' = 'zh',
): string | null {
  if (!energyLog || energyLog.length === 0) return null;

  const lowSlots = new Set(
    energyLog.filter((e) => e.energy_level === 'low' && e.time_slot !== null).map((e) => e.time_slot)
  );

  if (lowSlots.size === 0) return null;

  const focusCategories = new Set<string>(['study', 'work']);
  const mismatch = items.filter(
    (item) => {
      const cat = classifyRecordActivityType(item.name).activityType;
      return focusCategories.has(cat) && item.time_slot && lowSlots.has(item.time_slot);
    }
  );

  if (mismatch.length === 0) return null;

  const isZh = lang === 'zh';
  const nameSep = isZh ? '、' : ', ';
  const names = mismatch.slice(0, 2).map((i) => i.name).join(nameSep);
  const slotLabels: Record<string, string> = isZh
    ? { morning: '上午', afternoon: '下午', evening: '晚间' }
    : { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };
  const slotSep = isZh ? '、' : ', ';
  const slots = Array.from(lowSlots).map((s) => slotLabels[s as string] || s).join(slotSep);

  return isZh
    ? `${names} 出现在能量低谷时段（${slots}）`
    : `${names} occurred during low-energy period (${slots})`;
}

export function computeHistoryTrend(today: ComputedResult, history: ComputedResult[]): TrendSignal[] {
  if (!history || history.length === 0) return [];

  const signals: TrendSignal[] = [];

  const todayTodo = today.light_quality.todo_ratio;
  if (todayTodo !== null && history.length >= 3) {
    const histRatios = history
      .slice(-7)
      .map((d) => d.light_quality.todo_ratio)
      .filter((r): r is number => r !== null);

    if (histRatios.length > 0) {
      const histAvg = histRatios.reduce((a, b) => a + b, 0) / histRatios.length;
      const delta = todayTodo - histAvg;
      signals.push({
        metric: '待办着陆率',
        today: pct(todayTodo),
        hist_avg: pct(histAvg),
        delta: Math.round(delta * 100),
        direction: delta > 0.05 ? '↑' : delta < -0.05 ? '↓' : '→',
        is_positive: delta > 0.05,
        is_warning: delta < -0.1,
      });
    }
  }

  const focusCats = new Set(['study', 'work']);
  const todayFocus = today.spectrum.filter((s) => focusCats.has(s.category)).reduce((sum, s) => sum + s.duration_min, 0);
  if (history.length >= 2) {
    const histFocus = history.slice(-7).map((d) => d.spectrum.filter((s) => focusCats.has(s.category)).reduce((sum, s) => sum + s.duration_min, 0));
    const histAvgFocus = histFocus.reduce((a, b) => a + b, 0) / histFocus.length;
    const consecutiveUp = histFocus.length >= 2 && histFocus.every((val, i) => i === 0 || val >= histFocus[i - 1]);

    signals.push({
      metric: '深度专注时长',
      today: minutesToDisplay(todayFocus),
      hist_avg: minutesToDisplay(Math.round(histAvgFocus)),
      direction: todayFocus > histAvgFocus ? '↑' : '↓',
      is_positive: consecutiveUp && todayFocus > histAvgFocus,
      is_warning: todayFocus < histAvgFocus * 0.6,
      consecutive_up: consecutiveUp,
      consecutive_days: histFocus.length,
    });
  }

  // 能量水平趋势（来自 energy_log 的结构化能量评估）
  if (history.length >= 2) {
    const energyScore = (log: EnergyLog[]) => {
      if (!log || log.length === 0) return null;
      const map: Record<string, number> = { high: 3, medium: 2, low: 1 };
      const scores = log.map((e) => map[e.energy_level ?? ''] ?? 2);
      return scores.reduce((a, b) => a + b, 0) / scores.length;
    };
    const todayScore = energyScore(today.energy_log);
    if (todayScore !== null) {
      const histScores = history.slice(-7).map((d) => energyScore(d.energy_log)).filter((s): s is number => s !== null);
      if (histScores.length > 0) {
        const histAvg = histScores.reduce((a, b) => a + b, 0) / histScores.length;
        const label = (s: number) => s >= 2.5 ? 'High' : s >= 1.5 ? 'Medium' : 'Low';
        signals.push({
          metric: '能量水平',
          today: label(todayScore),
          hist_avg: label(histAvg),
          direction: todayScore > histAvg + 0.3 ? '↑' : todayScore < histAvg - 0.3 ? '↓' : '→',
          is_positive: todayScore > histAvg + 0.3,
          is_warning: todayScore < histAvg - 0.3,
        });
      }
    }
  }

  return signals;
}

export function computeAll(
  classifiedJson: ClassifiedData,
  history: ComputedResult[] | null = null,
  lang: 'zh' | 'en' | 'it' = 'zh',
): ComputedResult {
  const items = classifiedJson.items || [];
  const totalMin = classifiedJson.total_duration_min || 0;
  const todos = classifiedJson.todos || { completed: 0, total: 0 };
  const energyLog = classifiedJson.energy_log || [];

  const spectrum = computeSpectrum(items, totalMin);
  const lightQuality = computeLightQuality(spectrum, totalMin, todos.completed || 0, todos.total || 0);
  const gravityMismatch = detectGravityMismatch(items, energyLog, lang);

  const today: ComputedResult = {
    total_duration_str: minutesToDisplay(totalMin),
    spectrum,
    light_quality: lightQuality,
    gravity_mismatch: gravityMismatch,
    energy_log: energyLog,
    raw_items: items,
    history_trends: [],
  };

  today.history_trends = computeHistoryTrend(today, history || []);
  return today;
}
