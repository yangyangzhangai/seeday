// DOC-DEPS: LLM.md -> docs/MAGIC_PEN_CAPTURE_SPEC.md -> src/features/chat/README.md -> src/features/growth/GrowthPage.tsx
export function toDateTimeLocal(epoch?: number): string {
  if (!epoch) return '';
  const date = new Date(epoch);
  const yyyy = date.getFullYear();
  const mm = `${date.getMonth() + 1}`.padStart(2, '0');
  const dd = `${date.getDate()}`.padStart(2, '0');
  const hh = `${date.getHours()}`.padStart(2, '0');
  const min = `${date.getMinutes()}`.padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function fromDateTimeLocal(value: string): number | undefined {
  if (!value) return undefined;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : undefined;
}

export function toDateInputValue(epoch?: number): string {
  if (!epoch) return '';
  const date = new Date(epoch);
  const yyyy = date.getFullYear();
  const mm = `${date.getMonth() + 1}`.padStart(2, '0');
  const dd = `${date.getDate()}`.padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function fromDateInputValue(value: string): number | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  const date = new Date(year, month - 1, day, 9, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return undefined;
  return date.getTime();
}

export function toTimeInput(epoch?: number): string {
  if (!epoch) return '';
  const date = new Date(epoch);
  const hh = `${date.getHours()}`.padStart(2, '0');
  const min = `${date.getMinutes()}`.padStart(2, '0');
  return `${hh}:${min}`;
}

export function fromTimeInput(value: string, referenceEpoch?: number): number | undefined {
  if (!value) return undefined;
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return undefined;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return undefined;
  const date = referenceEpoch ? new Date(referenceEpoch) : new Date();
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
}

export function formatTimeRange(startAt?: number, endAt?: number): string {
  if (!startAt || !endAt) return '';
  return `${toTimeInput(startAt)} - ${toTimeInput(endAt)}`;
}

export function errorToI18nKey(error: string): string {
  if (error === 'missing_time') return 'chat_magic_pen_missing_time';
  if (error === 'invalid_time_range') return 'chat_magic_pen_invalid_time';
  if (error === 'future_time') return 'chat_magic_pen_future_time';
  if (error === 'cross_day') return 'chat_magic_pen_cross_day';
  if (error === 'overlap_with_ongoing_activity') return 'chat_magic_pen_overlap_ongoing';
  return 'chat_magic_pen_overlap';
}
