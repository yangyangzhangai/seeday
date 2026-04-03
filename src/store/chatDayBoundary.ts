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
