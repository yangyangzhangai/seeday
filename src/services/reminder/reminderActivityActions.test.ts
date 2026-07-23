import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  tMock,
  sendAutoRecognizedInputMock,
  sendMessageMock,
  recordResponseMock,
  shouldSkipReminderMock,
  reminderState,
  timingStartMock,
  timingEndActiveMock,
} = vi.hoisted(() => ({
  tMock: vi.fn((key: string) => {
    if (key === 'reminder_activity_work_start') return 'Started work';
    if (key === 'reminder_activity_work_end') return 'Finished work';
    return '';
  }),
  sendAutoRecognizedInputMock: vi.fn(async () => undefined),
  sendMessageMock: vi.fn(async () => 'msg-1'),
  reminderState: { confirmed: false },
  recordResponseMock: vi.fn(async () => undefined),
  shouldSkipReminderMock: vi.fn(),
  timingStartMock: vi.fn(async () => undefined),
  timingEndActiveMock: vi.fn(async () => undefined),
}));

vi.mock('i18next', () => ({
  default: {
    t: tMock,
  },
}));

vi.mock('../../store/useChatStore', () => ({
  useChatStore: {
    getState: () => ({
      sendAutoRecognizedInput: sendAutoRecognizedInputMock,
      sendMessage: sendMessageMock,
    }),
  },
}));

vi.mock('../../store/useReminderStore', () => ({
  useReminderStore: {
    getState: () => ({
      recordResponse: async (type: string, options: unknown) => {
        reminderState.confirmed = true;
        await recordResponseMock(type, options);
      },
      shouldSkipReminder: (type: string) => {
        shouldSkipReminderMock(type);
        return reminderState.confirmed;
      },
    }),
  },
}));

vi.mock('../../store/useTimingStore', () => ({
  useTimingStore: {
    getState: () => ({
      start: timingStartMock,
      endActive: timingEndActiveMock,
    }),
  },
}));

import {
  confirmReminderActivity,
  rearmReminderConfirmationGuards,
  submitReminderManualActivity,
} from './reminderActivityActions';

describe('reminderActivityActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reminderState.confirmed = false;
    rearmReminderConfirmationGuards(['work_start', 'work_end'], 'user-1');
  });

  it('marks confirmed, starts timing, and writes the mapped activity for reminder confirmation', async () => {
    await confirmReminderActivity('work_start', 'user-1');

    expect(recordResponseMock).toHaveBeenCalledWith('work_start', {
      userId: 'user-1',
      responseKind: 'confirm',
      occurrence: undefined,
    });
    expect(timingStartMock).toHaveBeenCalledWith('user-1', 'work', 'reminder_confirm');
    expect(sendAutoRecognizedInputMock).toHaveBeenCalledWith('Started work', {
      skipTimingEnd: true,
    });
  });

  it('processes concurrent confirmation callbacks only once', async () => {
    await Promise.all([
      confirmReminderActivity('work_start', 'user-1'),
      confirmReminderActivity('work_start', 'user-1'),
      confirmReminderActivity('work_start', 'user-1'),
    ]);

    expect(recordResponseMock).toHaveBeenCalledTimes(1);
    expect(timingStartMock).toHaveBeenCalledTimes(1);
    expect(sendAutoRecognizedInputMock).toHaveBeenCalledTimes(1);
  });

  it('blocks a repeated callback when persisted reminder state resets mid-flight', async () => {
    await confirmReminderActivity('work_start', 'user-1');
    reminderState.confirmed = false;
    await confirmReminderActivity('work_start', 'user-1');

    expect(timingStartMock).toHaveBeenCalledTimes(1);
    expect(sendAutoRecognizedInputMock).toHaveBeenCalledTimes(1);
  });

  it('ends timing and sends manual input when denying into custom activity input', async () => {
    const result = await submitReminderManualActivity('  Wrap up docs  ', {
      reminderType: 'work_end',
      userId: 'user-1',
    });

    expect(result).toBe(true);
    expect(timingEndActiveMock).toHaveBeenCalledWith('user-1');
    expect(recordResponseMock).toHaveBeenCalledWith('work_end', {
      userId: 'user-1',
      responseKind: 'manual',
      occurrence: undefined,
    });
    expect(sendMessageMock).toHaveBeenCalledWith('Wrap up docs');
  });
});
