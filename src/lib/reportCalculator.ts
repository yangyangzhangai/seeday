/**
 * Timeshine 计算层 v2
 * ────────────────────
 * 职责：接收分类器AI返回的JSON，完成所有数值计算，
 *       输出结构化文本供日记AI使用。
 *
 * 数据流：
 *   用户原始输入
 *        ↓
 *   parseClassifierResponse()   ← 剥离JSON包裹病
 *        ↓
 *   computeAll()                 ← 主计算入口
 *        ↓
 *   formatForDiaryAI()           ← 格式化为日记AI输入文本
 *        ↓
 *   日记AI（Qwen3-235B）生成观察手记
 */

// ── 类型定义 ──────────────────────────────────────────────────────────────────

export interface ClassifiedItem {
  name: string;
  duration_min: number;
  time_slot: 'morning' | 'afternoon' | 'evening' | null;
  category: string;
  flag: 'ambiguous' | null;
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
  time: string;        // "HH:mm"
  time_slot: 'morning' | 'afternoon' | 'evening';
  content: string;     // 用户原始心情文字
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

// ── 类别配置 ──────────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { label: string; emoji: string; desc: string }> = {
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

// 主动燃烧类别（用于计算主动/被动占比）
const ACTIVE_CATEGORIES = new Set(['deep_focus', 'recharge', 'self_talk']);

// 异常偏多触发阈值（占当日总时长的比例）
const ANOMALY_THRESHOLD = 0.35;

// 进度条总格数
const BAR_TOTAL = 12;

// ── JSON 解析（处理包裹病）────────────────────────────────────────────────────

/**
 * 剥离模型输出中可能存在的 Markdown 代码块包裹，提取并解析 JSON。
 * 模型经常输出：
 *     ```json
 *     { ... }
 *     ```
 * 直接 JSON.parse() 会报错，此函数负责清洗。
 */
export function parseClassifierResponse(raw: string): ClassifiedData {
  // 优先尝试直接解析
  try {
    return JSON.parse(raw.trim()) as ClassifiedData;
  } catch {
    // 继续尝试其他方法
  }

  // 用正则提取第一个完整的 { ... } 块
  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]) as ClassifiedData;
    } catch {
      // 继续兜底
    }
  }

  // 兜底：返回空结构，避免下游崩溃
  console.warn('⚠️ 分类器输出无法解析，返回空结构');
  return {
    total_duration_min: 0,
    items: [],
    todos: { completed: 0, total: 0 },
    energy_log: [],
  };
}

// ── 工具函数 ──────────────────────────────────────────────────────────────────

/**
 * 把分钟数转成 Xh XXmin 格式
 */
export function minutesToDisplay(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) {
    return `${m}min`;
  }
  if (m === 0) {
    return `${h}h`;
  }
  return `${h}h ${m}min`;
}

/**
 * 根据占比生成进度条字符串
 */
export function buildBar(ratio: number, total: number = BAR_TOTAL): string {
  const filled = Math.max(0, Math.min(total, Math.round(ratio * total)));
  return '█'.repeat(filled) + '░'.repeat(total - filled);
}

/**
 * 把小数转成百分比字符串
 */
export function pct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

// ── 核心计算 ──────────────────────────────────────────────────────────────────

/**
 * 计算每个类别的光谱数据。
 * 返回按时长降序排列的列表。
 */
export function computeSpectrum(items: ClassifiedItem[], totalMin: number): SpectrumItem[] {
  const catDuration: Record<string, number> = {};
  const catTop: Record<string, ClassifiedItem> = {};

  for (const item of items) {
    const cat = item.category || 'dissolved';
    const dur = item.duration_min || 0;

    catDuration[cat] = (catDuration[cat] || 0) + dur;

    // 记录该类别中耗时最长的单项
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

    // 只在该类别有多个事项时展示「今日之最」
    // （单个事项时，今日之最 = 类别总时长，无需重复展示）
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

/**
 * 计算光质读数（聚光率 / 散光率 / 主被动 / 待办着陆率）
 * 改版逻辑：剔除维生基建（body, necessary）作为中性底色，只在有效时长内计算比例
 */
export function computeLightQuality(
  spectrum: SpectrumItem[],
  totalMin: number,
  todosCompleted: number,
  todosTotal: number
): LightQuality {
  // 定义中性基建类别（不参与散光和被动计算）
  const NEUTRAL_CATEGORIES = new Set(['body', 'necessary']);

  const neutralMin = spectrum
    .filter((s) => NEUTRAL_CATEGORIES.has(s.category))
    .reduce((sum, s) => sum + s.duration_min, 0);

  // 有效时长 = 总时长 - 维持生命的基础时长
  const effectiveMin = Math.max(0, totalMin - neutralMin);

  // ── 聚光 vs 散光 ────────────────────────────────────────────────
  // 聚光：仅深度专注
  const focusMin = spectrum
    .filter((s) => s.category === 'deep_focus')
    .reduce((sum, s) => sum + s.duration_min, 0);

  // 散光：除了聚光和中性底色的剩余时间（dissolved, dopamine, recharge, social_duty, self_talk）
  // 按照之前的讨论，如果不属于聚光，且不属于中性，就在这块有效饼图中算作散光（或者你希望更纯粹的话，散光只算 dissolved+dopamine，这里采用剩余比例法保证加起来 100%）
  // 为了保证UI上专注和散光加起来是100%（针对有效时间），我们用有效时间做分母

  const focusRatio = effectiveMin > 0 ? focusMin / effectiveMin : 0;
  // 保证极值情况下（比如有效时间全是聚光）散光为0
  const scatterRatio = effectiveMin > 0 ? 1 - focusRatio : 0;

  // ── 主动 vs 被动 ────────────────────────────────────────────────
  // 主动：深度专注、灵魂充电、自我整理
  const activeMin = spectrum
    .filter((s) => ACTIVE_CATEGORIES.has(s.category))
    .reduce((sum, s) => sum + s.duration_min, 0);

  const activeRatio = effectiveMin > 0 ? activeMin / effectiveMin : 0;
  // 被动：非主动作且非中性底色的剩余有效时间
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

/**
 * 检测引力错位：deep_focus 事项出现在用户标注为 low 能量的时段。
 *
 * 依赖：
 * - items 中每条记录含 time_slot 字段（由分类器AI填充）
 * - energy_log 中含各时段的 energy_level 标注
 */
export function detectGravityMismatch(
  items: ClassifiedItem[],
  energyLog: EnergyLog[]
): string | null {
  if (!energyLog || energyLog.length === 0) {
    return null;
  }

  // 找出用户标注为低能量的时段
  const lowSlots = new Set(
    energyLog
      .filter((e) => e.energy_level === 'low' && e.time_slot !== null)
      .map((e) => e.time_slot)
  );

  if (lowSlots.size === 0) {
    return null;
  }

  // 找出 deep_focus 事项中发生在低能量时段的
  const mismatch = items.filter(
    (item) => item.category === 'deep_focus' && item.time_slot && lowSlots.has(item.time_slot)
  );

  if (mismatch.length > 0) {
    const names = mismatch
      .slice(0, 2)
      .map((i) => i.name)
      .join('、');
    const slotLabels: Record<string, string> = {
      morning: '上午',
      afternoon: '下午',
      evening: '晚间',
    };
    const slots = Array.from(lowSlots)
      .map((s) => slotLabels[s as string] || s)
      .join('、');
    return `${names} 出现在能量低谷时段（${slots}）`;
  }

  return null;
}

/**
 * 对比历史数据，输出趋势信号列表。
 *
 * 参数：
 *   today   — computeAll() 返回的今日数据
 *   history — 历史天数据列表（按时间升序），每条结构与 today 相同
 */
export function computeHistoryTrend(
  today: ComputedResult,
  history: ComputedResult[]
): TrendSignal[] {
  if (!history || history.length === 0) {
    return [];
  }

  const signals: TrendSignal[] = [];

  // ── 待办着陆率趋势 ────────────────────────────────
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

  // ── 深度专注时长趋势 ──────────────────────────────
  const todayFocus =
    today.spectrum.find((s) => s.category === 'deep_focus')?.duration_min || 0;

  if (history.length >= 2) {
    const histFocus = history.slice(-7).map((d) => {
      return d.spectrum.find((s) => s.category === 'deep_focus')?.duration_min || 0;
    });

    const histAvgFocus = histFocus.reduce((a, b) => a + b, 0) / histFocus.length;

    // 检查是否连续上升
    let consecutiveUp = false;
    if (histFocus.length >= 2) {
      consecutiveUp = histFocus.every((val, i) => i === 0 || val >= histFocus[i - 1]);
    }

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

  return signals;
}

// ── 主入口 ────────────────────────────────────────────────────────────────────

/**
 * 输入：parseClassifierResponse() 解析后的数据 + 历史数据（可选）
 * 输出：传给日记AI的完整结构化数据字典
 */
export function computeAll(
  classifiedJson: ClassifiedData,
  history: ComputedResult[] | null = null
): ComputedResult {
  const items = classifiedJson.items || [];
  const totalMin = classifiedJson.total_duration_min || 0;
  const todos = classifiedJson.todos || { completed: 0, total: 0 };
  const energyLog = classifiedJson.energy_log || [];

  const spectrum = computeSpectrum(items, totalMin);
  const lightQuality = computeLightQuality(
    spectrum,
    totalMin,
    todos.completed || 0,
    todos.total || 0
  );
  const gravityMismatch = detectGravityMismatch(items, energyLog);

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

// ── 格式化输出（传给日记AI）────────────────────────────────────────────────────

/**
 * 把 computeAll() 的结果组装成日记AI的输入文本。
 * 日记AI拿到这段文字后，只需专心写创意内容，不需要做任何计算。
 */
export function formatForDiaryAI(result: ComputedResult, lang: 'zh' | 'en' | 'it' = 'zh'): string {
  const isZh = lang === 'zh';
  const lines: string[] = [isZh ? '【今日结构化数据】' : '【Today\'s Structured Data】', ''];

  const slotLabel: Record<string, string> = isZh ? {
    morning: '上午',
    afternoon: '下午',
    evening: '晚间',
  } : {
    morning: 'Morning',
    afternoon: 'Afternoon',
    evening: 'Evening',
  };

  // ── 事件清单（按时段分组，智能过滤）──────────────────────────
  if (result.raw_items && result.raw_items.length > 0) {
    lines.push(isZh ? '▸ 今日事件清单' : '▸ Today\'s Event List');
    const slotOrder: Array<'morning' | 'afternoon' | 'evening'> = ['morning', 'afternoon', 'evening'];
    for (const slot of slotOrder) {
      let slotItems = result.raw_items.filter(i => i.time_slot === slot);
      if (slotItems.length === 0) continue;

      // 智能过滤：按时长降序，保留 ≥10min 或 Top5（取较大集合）
      slotItems = slotItems.sort((a, b) => b.duration_min - a.duration_min);
      const significantItems = slotItems.filter(i => i.duration_min >= 10);
      const top5 = slotItems.slice(0, 5);
      const filtered = significantItems.length >= top5.length ? significantItems : top5;
      const omitted = slotItems.length - filtered.length;

      lines.push(`  ${slotLabel[slot]}：`);
      for (const i of filtered) {
        const catLabel = isZh ? (CATEGORY_CONFIG[i.category]?.label || i.category) : i.category.replace('_', ' ');
        lines.push(`    · ${i.name} (${minutesToDisplay(i.duration_min)}) [${catLabel}]`);
      }
      if (omitted > 0) {
        lines.push(isZh ? `    · …另有 ${omitted} 项琐碎事务` : `    · …and ${omitted} minor tasks`);
      }
    }
    // 无时段的事项
    const noSlotItems = result.raw_items.filter(i => !i.time_slot);
    if (noSlotItems.length > 0) {
      lines.push(isZh ? '  未标注时段：' : '  Unspecified Time:');
      for (const i of noSlotItems.slice(0, 5)) {
        lines.push(`    · ${i.name} (${minutesToDisplay(i.duration_min)})`);
      }
    }
    lines.push('');
  }

  // ── 心情记录 ────────────────────────────────────────────────
  if (result.mood_records && result.mood_records.length > 0) {
    lines.push(isZh ? '▸ 今日心情记录' : '▸ Today\'s Mood Log');
    for (const mood of result.mood_records) {
      lines.push(`  ${mood.time}  「${mood.content}」`);
    }
    lines.push('');
  }

  // ── 光谱分布（含百分比 + 方括号进度条）──────────────────────
  lines.push(isZh ? '▸ 今日光谱分布' : '▸ Spectrum Distribution');
  lines.push('');
  for (const s of result.spectrum) {
    const anomalyZh = s.is_anomaly ? '  ⚠ 偏多' : '';
    const anomalyEn = s.is_anomaly ? '  ⚠ High' : '';
    const anomaly = isZh ? anomalyZh : anomalyEn;
    const label = isZh ? s.label : s.category.replace('_', ' ');
    lines.push(`  ${s.emoji} ${label.padEnd(6)}  ${s.duration_str.padEnd(10)}  [${s.bar}]  ${s.percent_str}${anomaly}`);
    if (s.top_item) {
      lines.push(isZh ? `     └ 今日之最 → ${s.top_item.name}  ${s.top_item.duration_str}` : `     └ Top Item → ${s.top_item.name}  ${s.top_item.duration_str}`);
    }
  }
  lines.push('');

  // ── 光质读数 ────────────────────────────────────────────────
  const lq = result.light_quality;
  lines.push(isZh ? '▸ 光质读数' : '▸ Light Quality');
  lines.push(isZh ? `  专注聚光 vs 碎片散光  ${lq.focus_pct}  /  ${lq.scatter_pct}` : `  Focus vs Scatter  ${lq.focus_pct}  /  ${lq.scatter_pct}`);
  lines.push(isZh ? `  主动燃烧 vs 被动响应  ${lq.active_pct}  /  ${lq.passive_pct}` : `  Active vs Passive  ${lq.active_pct}  /  ${lq.passive_pct}`);
  lines.push(isZh ? `  待办着陆率            ${lq.todo_str}` : `  Todo Completion   ${lq.todo_str}`);
  lines.push('');

  // ── 能量曲线（含进度条）────────────────────────────────────
  if (result.energy_log && result.energy_log.length > 0) {
    const levelLabel: Record<string, string> = isZh ? {
      high: '⚡ 充沛',
      medium: '〰 平稳',
      low: '🔋 低谷',
    } : {
      high: '⚡ High',
      medium: '〰 Medium',
      low: '🔋 Low',
    };
    const levelBar: Record<string, string> = {
      high: buildBar(1.0, 8),
      medium: buildBar(0.625, 8),
      low: buildBar(0.25, 8),
    };
    lines.push(isZh ? '▸ 今日能量曲线' : '▸ Energy Curve');
    for (const e of result.energy_log) {
      const slot = slotLabel[e.time_slot] || e.time_slot;
      const level = levelLabel[e.energy_level || ''] || '—';
      const bar = levelBar[e.energy_level || ''] || '░░░░░░░░';
      const mood = e.mood ? `  「${e.mood}」` : '';
      lines.push(`  ${slot}  [${bar}]  ${level}${mood}`);
    }
    lines.push('');
  }

  // ── 引力错位（有异常时展示）────────────────────────────────
  if (result.gravity_mismatch) {
    lines.push(isZh ? '▸ 引力错位检测' : '▸ Gravity Mismatch Detection');
    lines.push(`  ⚠ ${result.gravity_mismatch}`);
    lines.push('');
  }

  // ── 历史趋势（有多日数据时展示）────────────────────────────
  if (result.history_trends && result.history_trends.length > 0) {
    lines.push(isZh ? '▸ 历史观测趋势' : '▸ Historical Trends');
    for (const t of result.history_trends) {
      let tag = '';
      if (t.is_positive) {
        tag = isZh ? '  ✦ 积极信号' : '  ✦ Positive';
      } else if (t.is_warning) {
        tag = isZh ? '  ⚠ 状态预警' : '  ⚠ Warning';
      }
      lines.push(isZh
        ? `  ${t.metric.padEnd(10)}  ${t.direction}  今日 ${t.today}  均值 ${t.hist_avg}${tag}`
        : `  ${t.metric.padEnd(10)}  ${t.direction}  Today ${t.today}  Avg ${t.hist_avg}${tag}`
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ── 便捷函数：一站式处理 ───────────────────────────────────────────────────────

/**
 * 一站式处理：从原始分类器输出到日记AI输入文本
 */
export function processClassifierOutput(
  rawClassifierOutput: string,
  history: ComputedResult[] | null = null,
  lang: 'zh' | 'en' | 'it' = 'zh'
): { computed: ComputedResult; diaryInput: string } {
  const classified = parseClassifierResponse(rawClassifierOutput);
  const computed = computeAll(classified, history);
  const diaryInput = formatForDiaryAI(computed, lang);
  return { computed, diaryInput };
}
