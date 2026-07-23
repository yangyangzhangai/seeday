import { describe, expect, it } from 'vitest';
import {
  buildReminderOccurrence,
  isOccurrenceForType,
} from './reminderResponse';

describe('reminderResponse occurrence identity', () => {
  it('includes local date, reminder type, and scheduled local time', () => {
    const scheduledAt = new Date(2026, 6, 23, 9, 30, 0, 0);
    const occurrence = buildReminderOccurrence('work_start', scheduledAt);

    expect(occurrence.occurrenceKey).toBe('2026-07-23:work_start:0930');
    expect(occurrence.occurrenceDate).toBe('2026-07-23');
    expect(occurrence.scheduledFor).toBe(scheduledAt.toISOString());
  });

  it('distinguishes the same reminder type after its time changes', () => {
    const first = buildReminderOccurrence(
      'work_start',
      new Date(2026, 6, 23, 9, 0),
    );
    const changed = buildReminderOccurrence(
      'work_start',
      new Date(2026, 6, 23, 9, 30),
    );

    expect(first.occurrenceKey).not.toBe(changed.occurrenceKey);
    expect(isOccurrenceForType(first.occurrenceKey, 'work_start')).toBe(true);
  });
});
