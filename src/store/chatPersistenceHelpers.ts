import { getLocalDateString } from './chatHelpers';
import { finalizeCrossDayOngoingMessages } from './chatDayBoundary';
import type { ChatState, Message } from './useChatStore.types';

/** Keep only recent MAX_PERSISTED_DAYS cached entries. */
export function pruneDateCache(cache: Record<string, Message[]>): Record<string, Message[]> {
  const MAX_PERSISTED_DAYS = 30;
  const keys = Object.keys(cache).sort();
  if (keys.length <= MAX_PERSISTED_DAYS) return cache;
  const toKeep = keys.slice(-MAX_PERSISTED_DAYS);
  return Object.fromEntries(toKeep.map((key) => [key, cache[key]]));
}

export function mergePersistedChatState(
  persistedState: unknown,
  currentState: ChatState,
): ChatState {
  const persisted = (persistedState ?? {}) as Partial<ChatState>;
  const merged = { ...currentState, ...persisted } as ChatState;

  const nowMs = Date.now();
  const todayStr = getLocalDateString(new Date(nowMs));
  const sameDay = persisted.currentDateStr != null && persisted.currentDateStr === todayStr;

  merged.dateCache = (persisted.dateCache != null && typeof persisted.dateCache === 'object' && !Array.isArray(persisted.dateCache))
    ? persisted.dateCache as Record<string, Message[]>
    : {};

  const incomingMessages = Array.isArray(persisted.messages)
    ? persisted.messages
    : [];
  const { messages: finalizedMessages } = finalizeCrossDayOngoingMessages(incomingMessages, nowMs);

  if (!sameDay) {
    merged.messages = [];
    merged.currentDateStr = null;
    merged.activeViewDateStr = null;
    merged.hasInitialized = false;
    return merged;
  }

  merged.messages = finalizedMessages;
  merged.currentDateStr = persisted.currentDateStr ?? todayStr;
  merged.activeViewDateStr = persisted.activeViewDateStr ?? merged.currentDateStr;
  merged.hasInitialized = Boolean(persisted.hasInitialized);

  return merged;
}
