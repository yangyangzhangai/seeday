import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  addListenerMock,
  cancelMock,
  getDeliveredMock,
  getPendingMock,
  listenerCallbacks,
  removeDeliveredMock,
} = vi.hoisted(() => ({
  addListenerMock: vi.fn(),
  cancelMock: vi.fn(async () => undefined),
  getDeliveredMock: vi.fn(),
  getPendingMock: vi.fn(),
  listenerCallbacks: new Map<string, (event: unknown) => void>(),
  removeDeliveredMock: vi.fn(async () => undefined),
}));

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    addListener: addListenerMock.mockImplementation(async (eventName: string, callback: (event: unknown) => void) => {
      listenerCallbacks.set(eventName, callback);
      return { remove: vi.fn(async () => undefined) };
    }),
    cancel: cancelMock,
    getDeliveredNotifications: getDeliveredMock,
    getPending: getPendingMock,
    removeDeliveredNotifications: removeDeliveredMock,
  },
}));

import {
  cancelReminderOccurrence,
  setupNotificationActionListener,
  setupNotificationReceivedListener,
} from './localNotificationService';

describe('localNotificationService listener setup', () => {
  beforeEach(() => {
    cancelMock.mockClear();
    getDeliveredMock.mockReset();
    getPendingMock.mockReset();
    removeDeliveredMock.mockClear();
  });

  it('registers each native listener once and routes events to the latest handlers', async () => {
    const firstConfirm = vi.fn();
    const latestConfirm = vi.fn();
    const firstReceived = vi.fn();
    const latestReceived = vi.fn();

    await setupNotificationActionListener({ onConfirm: firstConfirm });
    await setupNotificationActionListener({ onConfirm: latestConfirm });
    await setupNotificationReceivedListener({ onReceived: firstReceived });
    await setupNotificationReceivedListener({ onReceived: latestReceived });

    expect(addListenerMock).toHaveBeenCalledTimes(2);
    listenerCallbacks.get('localNotificationActionPerformed')?.({
      actionId: 'confirm',
      notification: { extra: { reminderType: 'work_start' } },
    });
    listenerCallbacks.get('localNotificationReceived')?.({
      extra: { reminderType: 'work_start' },
    });

    expect(firstConfirm).not.toHaveBeenCalled();
    expect(latestConfirm).toHaveBeenCalledWith('work_start', undefined);
    expect(firstReceived).not.toHaveBeenCalled();
    expect(latestReceived).toHaveBeenCalledWith('work_start', undefined);
  });

  it('cancels pending and delivered notifications for one occurrence only', async () => {
    const occurrenceKey = '2026-07-23:work_start:0900';
    getPendingMock.mockResolvedValue({
      notifications: [
        { id: 1, extra: { occurrenceKey } },
        { id: 2, extra: { occurrenceKey: 'other' } },
      ],
    });
    getDeliveredMock.mockResolvedValue({
      notifications: [
        { id: 3, extra: { occurrenceKey } },
        { id: 4, extra: { occurrenceKey: 'other' } },
      ],
    });

    await cancelReminderOccurrence(occurrenceKey);

    expect(cancelMock).toHaveBeenCalledWith({ notifications: [{ id: 1 }] });
    expect(removeDeliveredMock).toHaveBeenCalledWith({
      notifications: [{ id: 3, extra: { occurrenceKey } }],
    });
  });
});
