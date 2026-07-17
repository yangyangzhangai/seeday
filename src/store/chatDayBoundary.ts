import { toLocalDateStr } from '../lib/dateUtils';
import type { Message } from './useChatStore.types';

function getNextLocalMidnightMs(timestamp: number): number {
  const nextMidnight = new Date(timestamp);
  nextMidnight.setHours(0, 0, 0, 0);
  nextMidnight.setDate(nextMidnight.getDate() + 1);
  return nextMidnight.getTime();
}

export function resolveAutoActivityEndMs(startMs: number, nowMs: number): number {
  if (nowMs <= startMs) return startMs;
  return Math.min(nowMs, getNextLocalMidnightMs(startMs));
}

export function resolveAutoActivityDurationMinutes(startMs: number, nowMs: number): number {
  const endMs = resolveAutoActivityEndMs(startMs, nowMs);
  return Math.max(0, Math.round((endMs - startMs) / 60000));
}

export function finalizeCrossDayOngoingMessages(
  messages: Message[],
  nowMs: number,
): {
  messages: Message[];
  finalized: Array<{ id: string; duration: number }>;
} {
  const todayStr = toLocalDateStr(new Date(nowMs));
  const finalized: Array<{ id: string; duration: number }> = [];

  const nextMessages = messages.map((message) => {
    const isOngoingRecord = !message.isMood && message.duration == null;
    if (!isOngoingRecord) return message;

    const messageDay = toLocalDateStr(new Date(message.timestamp));
    if (messageDay === todayStr) return message;

    const duration = resolveAutoActivityDurationMinutes(message.timestamp, nowMs);
    finalized.push({ id: message.id, duration });
    return {
      ...message,
      duration,
      isActive: false,
    };
  });

  return { messages: nextMessages, finalized };
}

/** Keep only the newest active card when duplicated notification callbacks created several. */
export function reconcileConcurrentOngoingMessages(
  messages: Message[],
): {
  messages: Message[];
  finalized: Array<{ id: string; duration: number }>;
} {
  const activeIndexes = messages
    .map((message, index) => ({ message, index }))
    .filter(({ message }) => (
      !message.isMood
      && message.mode === 'record'
      && message.isActive === true
      && message.duration == null
    ))
    .sort((left, right) => (
      left.message.timestamp - right.message.timestamp || left.index - right.index
    ));

  if (activeIndexes.length <= 1) {
    return { messages, finalized: [] };
  }

  const newest = activeIndexes[activeIndexes.length - 1];
  const olderIds = new Set(activeIndexes.slice(0, -1).map(({ message }) => message.id));
  const finalized: Array<{ id: string; duration: number }> = [];
  const nextMessages = messages.map((message) => {
    if (!olderIds.has(message.id)) return message;
    const duration = resolveAutoActivityDurationMinutes(message.timestamp, newest.message.timestamp);
    finalized.push({ id: message.id, duration });
    return { ...message, duration, isActive: false };
  });

  return { messages: nextMessages, finalized };
}
