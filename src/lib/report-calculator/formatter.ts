import { CATEGORY_CONFIG, type ComputedResult } from './types';
import { minutesToDisplay } from './core';

export function formatForDiaryAI(result: ComputedResult, lang: 'zh' | 'en' | 'it' = 'zh'): string {
  const isZh = lang === 'zh';
  const lines: string[] = [isZh ? '【今日结构化数据】' : "【Today's Structured Data】", ''];

  lines.push(isZh ? `今日记录总时长：${result.total_duration_str}` : `Total Recorded Duration: ${result.total_duration_str}`);

  const focusStr = minutesToDisplay(result.focus_duration_min || 0);
  lines.push(isZh ? `专注时长（学习+工作）：${focusStr}` : `Focus Duration (study+work): ${focusStr}`);

  const todoSummary = (result.todo_total || 0) > 0
    ? `${result.todo_completed}/${result.todo_total}`
    : (isZh ? '无待办' : 'no todos');
  lines.push(isZh ? `待办完成：${todoSummary}` : `Todos Completed: ${todoSummary}`);
  lines.push('');

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

      lines.push(`  ${slotLabel[slot]}:`);
      for (const i of filtered) {
        const catLabel = isZh ? (CATEGORY_CONFIG[i.category]?.label || i.category) : i.category.replace('_', ' ');
        lines.push(`    - ${i.name} (${minutesToDisplay(i.duration_min)}) [${catLabel}]`);
      }
      if (omitted > 0) {
        lines.push(isZh ? `    - 另有 ${omitted} 项零碎事务` : `    - plus ${omitted} minor tasks`);
      }
    }

    const noSlotItems = result.raw_items.filter((i) => !i.time_slot);
    if (noSlotItems.length > 0) {
      lines.push(isZh ? '  未标注时段:' : '  Unspecified Time:');
      for (const i of noSlotItems.slice(0, 5)) {
        lines.push(`    - ${i.name} (${minutesToDisplay(i.duration_min)})`);
      }
    }
    lines.push('');
  }

  if (result.mood_records && result.mood_records.length > 0) {
    lines.push(isZh ? '▸ 今日心情记录' : "▸ Today's Mood Log");
    for (const mood of result.mood_records) {
      lines.push(`  ${mood.time} "${mood.content}"`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
