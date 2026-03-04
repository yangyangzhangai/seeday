import { CATEGORY_CONFIG, type ComputedResult } from './types';
import { buildBar, minutesToDisplay } from './core';

export function formatForDiaryAI(result: ComputedResult, lang: 'zh' | 'en' | 'it' = 'zh'): string {
  const isZh = lang === 'zh';
  const lines: string[] = [isZh ? '【今日结构化数据】' : "【Today's Structured Data】", ''];

  const slotLabel: Record<string, string> = isZh
    ? {
        morning: '上午',
        afternoon: '下午',
        evening: '晚间',
      }
    : {
        morning: 'Morning',
        afternoon: 'Afternoon',
        evening: 'Evening',
      };

  if (result.raw_items && result.raw_items.length > 0) {
    lines.push(isZh ? '▸ 今日事件清单' : "▸ Today's Event List");
    const slotOrder: Array<'morning' | 'afternoon' | 'evening'> = ['morning', 'afternoon', 'evening'];
    for (const slot of slotOrder) {
      let slotItems = result.raw_items.filter((i) => i.time_slot === slot);
      if (slotItems.length === 0) continue;

      slotItems = slotItems.sort((a, b) => b.duration_min - a.duration_min);
      const significantItems = slotItems.filter((i) => i.duration_min >= 10);
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

    const noSlotItems = result.raw_items.filter((i) => !i.time_slot);
    if (noSlotItems.length > 0) {
      lines.push(isZh ? '  未标注时段：' : '  Unspecified Time:');
      for (const i of noSlotItems.slice(0, 5)) {
        lines.push(`    · ${i.name} (${minutesToDisplay(i.duration_min)})`);
      }
    }
    lines.push('');
  }

  if (result.mood_records && result.mood_records.length > 0) {
    lines.push(isZh ? '▸ 今日心情记录' : "▸ Today's Mood Log");
    for (const mood of result.mood_records) {
      lines.push(`  ${mood.time}  「${mood.content}」`);
    }
    lines.push('');
  }

  lines.push(isZh ? '▸ 今日光谱分布' : '▸ Spectrum Distribution');
  lines.push('');
  for (const s of result.spectrum) {
    const anomaly = isZh ? (s.is_anomaly ? '  ⚠ 偏多' : '') : s.is_anomaly ? '  ⚠ High' : '';
    const label = isZh ? s.label : s.category.replace('_', ' ');
    lines.push(`  ${s.emoji} ${label.padEnd(6)}  ${s.duration_str.padEnd(10)}  [${s.bar}]  ${s.percent_str}${anomaly}`);
    if (s.top_item) {
      lines.push(
        isZh
          ? `     └ 今日之最 → ${s.top_item.name}  ${s.top_item.duration_str}`
          : `     └ Top Item → ${s.top_item.name}  ${s.top_item.duration_str}`
      );
    }
  }
  lines.push('');

  const lq = result.light_quality;
  lines.push(isZh ? '▸ 光质读数' : '▸ Light Quality');
  lines.push(isZh ? `  专注聚光 vs 碎片散光  ${lq.focus_pct}  /  ${lq.scatter_pct}` : `  Focus vs Scatter  ${lq.focus_pct}  /  ${lq.scatter_pct}`);
  lines.push(isZh ? `  主动燃烧 vs 被动响应  ${lq.active_pct}  /  ${lq.passive_pct}` : `  Active vs Passive  ${lq.active_pct}  /  ${lq.passive_pct}`);
  lines.push(isZh ? `  待办着陆率            ${lq.todo_str}` : `  Todo Completion   ${lq.todo_str}`);
  lines.push('');

  if (result.energy_log && result.energy_log.length > 0) {
    const levelLabel: Record<string, string> = isZh
      ? {
          high: '⚡ 充沛',
          medium: '〰 平稳',
          low: '🔋 低谷',
        }
      : {
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

  if (result.gravity_mismatch) {
    lines.push(isZh ? '▸ 引力错位检测' : '▸ Gravity Mismatch Detection');
    lines.push(`  ⚠ ${result.gravity_mismatch}`);
    lines.push('');
  }

  if (result.history_trends && result.history_trends.length > 0) {
    lines.push(isZh ? '▸ 历史观测趋势' : '▸ Historical Trends');
    for (const t of result.history_trends) {
      let tag = '';
      if (t.is_positive) {
        tag = isZh ? '  ✦ 积极信号' : '  ✦ Positive';
      } else if (t.is_warning) {
        tag = isZh ? '  ⚠ 状态预警' : '  ⚠ Warning';
      }

      lines.push(
        isZh
          ? `  ${t.metric.padEnd(10)}  ${t.direction}  今日 ${t.today}  均值 ${t.hist_avg}${tag}`
          : `  ${t.metric.padEnd(10)}  ${t.direction}  Today ${t.today}  Avg ${t.hist_avg}${tag}`
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}
