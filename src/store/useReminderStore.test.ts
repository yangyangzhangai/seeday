import { beforeEach, describe, expect, it } from 'vitest';
import { buildReminderOccurrence } from '../services/reminder/reminderResponse';
import { useReminderStore } from './useReminderStore';

describe('useReminderStore cloud occurrence merge', () => {
  beforeEach(() => {
    useReminderStore.setState({
      confirmedToday: new Set(),
      confirmedOccurrenceKeys: new Set(),
      confirmedDate: '2026-07-23',
      activePopupType: null,
      activePopupOccurrence: null,
      showQuickPicker: false,
      pickerContext: null,
    });
  });

  it('skips the cloud-confirmed occurrence but allows a changed schedule time', () => {
    const confirmed = buildReminderOccurrence(
      'work_start',
      new Date(2026, 6, 23, 9, 0),
    );
    const changed = buildReminderOccurrence(
      'work_start',
      new Date(2026, 6, 23, 9, 30),
    );

    useReminderStore.getState().mergeCloudResponse({
      userId: 'user-1',
      reminderType: 'work_start',
      responseKind: 'confirm',
      respondedAt: new Date().toISOString(),
      ...confirmed,
    });

    expect(
      useReminderStore.getState().shouldSkipReminder(
        'work_start',
        confirmed.occurrenceKey,
      ),
    ).toBe(true);
    expect(
      useReminderStore.getState().shouldSkipReminder(
        'work_start',
        changed.occurrenceKey,
      ),
    ).toBe(false);
  });

  it('closes the popup for the exact occurrence received from Realtime', () => {
    const occurrence = buildReminderOccurrence('meal_dinner', new Date());
    useReminderStore.getState().showPopup('meal_dinner', occurrence);

    useReminderStore.getState().mergeCloudResponse({
      userId: 'user-1',
      reminderType: 'meal_dinner',
      responseKind: 'confirm',
      respondedAt: new Date().toISOString(),
      ...occurrence,
    });

    expect(useReminderStore.getState().activePopupType).toBeNull();
    expect(useReminderStore.getState().activePopupOccurrence).toBeNull();
  });
});
