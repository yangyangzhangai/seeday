export interface BottleCheckinStats {
  last7Days: number;
  currentStreak: number;
  bestStreak: number;
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeCheckinDates(checkinDates: string[]): string[] {
  const normalized = checkinDates
    .map((value) => value.trim())
    .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value));

  return Array.from(new Set(normalized)).sort();
}

function computeCurrentStreak(dateSet: Set<string>, now: Date): number {
  let streak = 0;
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);

  while (dateSet.has(toLocalDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function computeBestStreak(sortedDates: string[]): number {
  if (sortedDates.length === 0) return 0;

  let best = 1;
  let current = 1;

  for (let i = 1; i < sortedDates.length; i += 1) {
    const previous = new Date(`${sortedDates[i - 1]}T00:00:00`).getTime();
    const next = new Date(`${sortedDates[i]}T00:00:00`).getTime();

    if (next - previous === 24 * 60 * 60 * 1000) {
      current += 1;
      if (current > best) best = current;
    } else {
      current = 1;
    }
  }

  return best;
}

function computeLast7Days(dateSet: Set<string>, now: Date): number {
  let count = 0;
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);

  for (let i = 0; i < 7; i += 1) {
    if (dateSet.has(toLocalDateKey(cursor))) {
      count += 1;
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  return count;
}

export function computeBottleCheckinStats(checkinDates: string[] | undefined, now: Date = new Date()): BottleCheckinStats {
  const normalized = normalizeCheckinDates(checkinDates ?? []);
  const dateSet = new Set(normalized);

  return {
    last7Days: computeLast7Days(dateSet, now),
    currentStreak: computeCurrentStreak(dateSet, now),
    bestStreak: computeBestStreak(normalized),
  };
}
