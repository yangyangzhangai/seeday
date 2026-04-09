// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/types/userProfile.ts
import type {
  HiddenMoment,
  UpcomingVisibleAnniversary,
  UserProfileSnapshot,
  UserProfileV2,
  VisibleAnniversary,
} from '../types/userProfile';

interface BuildUserProfileSnapshotInput {
  profile?: UserProfileV2 | null;
  now?: Date;
}

function normalizeMealTimes(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item >= 0 && item <= 23)
    .map((item) => Math.floor(item));
}

function formatMealTimes(times: number[]): string {
  return times
    .map((hour) => `${String(hour).padStart(2, '0')}:00`)
    .join(', ');
}

function isLongTermDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isRepeatingDate(value: string): boolean {
  return /^\d{2}-\d{2}$/.test(value);
}

function toDayStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(start: Date, end: Date): number {
  const ms = toDayStart(end).getTime() - toDayStart(start).getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function computeDaysUntil(dateText: string, now: Date): number | null {
  const today = toDayStart(now);

  if (isLongTermDate(dateText)) {
    const target = new Date(`${dateText}T00:00:00`);
    if (Number.isNaN(target.getTime())) return null;
    const diff = daysBetween(today, target);
    return diff >= 0 ? diff : null;
  }

  if (isRepeatingDate(dateText)) {
    const [monthText, dayText] = dateText.split('-');
    const month = Number(monthText);
    const day = Number(dayText);
    if (!Number.isFinite(month) || !Number.isFinite(day)) return null;

    const thisYear = new Date(today.getFullYear(), month - 1, day);
    if (Number.isNaN(thisYear.getTime())) return null;
    const thisYearDiff = daysBetween(today, thisYear);
    if (thisYearDiff >= 0) return thisYearDiff;

    const nextYear = new Date(today.getFullYear() + 1, month - 1, day);
    if (Number.isNaN(nextYear.getTime())) return null;
    return daysBetween(today, nextYear);
  }

  return null;
}

function pickUpcomingAnniversaries(
  anniversaries: VisibleAnniversary[] | undefined,
  now: Date,
): UpcomingVisibleAnniversary[] {
  if (!anniversaries?.length) return [];

  return anniversaries
    .map((item) => ({
      ...item,
      daysUntil: computeDaysUntil(item.date, now),
    }))
    .filter((item): item is UpcomingVisibleAnniversary => typeof item.daysUntil === 'number')
    .filter((item) => item.daysUntil >= 0 && item.daysUntil <= 3)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 3);
}

function pickHiddenRecallMoments(hiddenMoments: HiddenMoment[] | undefined): HiddenMoment[] {
  if (!hiddenMoments?.length) return [];
  return [...hiddenMoments]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 3);
}

function buildSnapshotText(snapshot: {
  wakeTime?: string;
  sleepTime?: string;
  currentGoal?: string;
  lifeGoal?: string;
  declaredMealTimes: number[];
  observedMealTimes: number[];
  dynamicPreferences: string[];
  dynamicDislikes: string[];
  upcomingAnniversaries: UpcomingVisibleAnniversary[];
  hiddenRecallMoments: HiddenMoment[];
}): string {
  const lines: string[] = [];

  lines.push('Long-term profile snapshot:');
  lines.push(`Declared wake/sleep: ${snapshot.wakeTime || 'unknown'} / ${snapshot.sleepTime || 'unknown'}`);
  lines.push(`Declared meal times: ${snapshot.declaredMealTimes.length ? formatMealTimes(snapshot.declaredMealTimes) : 'unknown'}`);
  lines.push(`Observed meal times: ${snapshot.observedMealTimes.length ? formatMealTimes(snapshot.observedMealTimes) : 'unknown'}`);
  lines.push(`Current goal: ${snapshot.currentGoal || 'unknown'}`);
  lines.push(`Life goal: ${snapshot.lifeGoal || 'unknown'}`);
  lines.push(`Preferences: ${snapshot.dynamicPreferences.length ? snapshot.dynamicPreferences.join(', ') : 'none'}`);
  lines.push(`Dislikes: ${snapshot.dynamicDislikes.length ? snapshot.dynamicDislikes.join(', ') : 'none'}`);

  if (snapshot.upcomingAnniversaries.length > 0) {
    lines.push(
      `Upcoming anniversaries: ${snapshot.upcomingAnniversaries
        .map((item) => `${item.label} (in ${item.daysUntil}d)`)
        .join('; ')}`,
    );
  } else {
    lines.push('Upcoming anniversaries: none');
  }

  if (snapshot.hiddenRecallMoments.length > 0) {
    lines.push(
      `Recall moments: ${snapshot.hiddenRecallMoments
        .map((item) => `${item.title} (${item.date})`)
        .join('; ')}`,
    );
  } else {
    lines.push('Recall moments: none');
  }

  return lines.join('\n');
}

export function isLongTermProfileEnabled(meta: Record<string, unknown> | null | undefined): boolean {
  return meta?.long_term_profile_enabled === true;
}

export function buildUserProfileSnapshot(input: BuildUserProfileSnapshotInput): UserProfileSnapshot {
  const profile = input.profile;
  if (!profile) {
    return { text: 'none' };
  }

  const now = input.now || new Date();
  const declaredMealTimes = normalizeMealTimes(profile.manual?.mealTimes);
  const observedMealTimes = normalizeMealTimes(profile.observed?.mealTimes?.value);
  const upcomingAnniversaries = pickUpcomingAnniversaries(profile.anniversariesVisible, now);
  const hiddenRecallMoments = pickHiddenRecallMoments(profile.hiddenMoments);
  const dynamicPreferences = profile.dynamicSignals?.preferences?.value || [];
  const dynamicDislikes = profile.dynamicSignals?.dislikes?.value || [];

  return {
    text: buildSnapshotText({
      wakeTime: profile.manual?.wakeTime,
      sleepTime: profile.manual?.sleepTime,
      currentGoal: profile.manual?.currentGoal,
      lifeGoal: profile.manual?.lifeGoal,
      declaredMealTimes,
      observedMealTimes,
      dynamicPreferences,
      dynamicDislikes,
      upcomingAnniversaries,
      hiddenRecallMoments,
    }),
    declaredMealTimes,
    observedMealTimes,
    mealTimesForSuggestion: declaredMealTimes.length ? declaredMealTimes : observedMealTimes,
    visibleUpcomingAnniversaries: upcomingAnniversaries,
    hiddenRecallMoments,
  };
}
