// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/chat/README.md
// 时区工具函数：Supabase 存储 UTC，前端显示本地时间，统一转换

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** 将 Date 转为本地日期字符串 YYYY-MM-DD，用于 DatePicker / 缓存 Key */
export function toLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 本地日期字符串 → UTC 查询范围，用于 Supabase timestamp 查询 */
export function toUTCRange(dateStr: string): { start: string; end: string } {
  const local = new Date(dateStr + 'T00:00:00');
  const startUTC = local.toISOString();
  const endLocal = new Date(dateStr + 'T23:59:59.999');
  const endUTC = endLocal.toISOString();
  return { start: startUTC, end: endUTC };
}

/** 返回昨天的本地日期字符串 */
export function getYesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toLocalDateStr(d);
}

/** 判断两个时间戳是否在同一本地日期 */
export function isSameLocalDay(tsA: number, tsB: number): boolean {
  return toLocalDateStr(new Date(tsA)) === toLocalDateStr(new Date(tsB));
}
