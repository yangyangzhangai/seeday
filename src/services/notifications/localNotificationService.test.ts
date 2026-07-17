import { describe, expect, it, vi } from 'vitest';

const { addListenerMock, listenerCallbacks } = vi.hoisted(() => ({
  addListenerMock: vi.fn(),
  listenerCallbacks: new Map<string, (event: unknown) => void>(),
}));

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    addListener: addListenerMock.mockImplementation(async (eventName: string, callback: (event: unknown) => void) => {
      listenerCallbacks.set(eventName, callback);
      return { remove: vi.fn(async () => undefined) };
    }),
  },
}));

import {
  setupNotificationActionListener,
  setupNotificationReceivedListener,
} from './localNotificationService';

describe('localNotificationService listener setup', () => {
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
    expect(latestConfirm).toHaveBeenCalledWith('work_start');
    expect(firstReceived).not.toHaveBeenCalled();
    expect(latestReceived).toHaveBeenCalledWith('work_start');
  });
});
