// DOC-DEPS: LLM.md -> docs/DATA_STORAGE_AUDIT_REPORT.md -> src/store/README.md
import { getLocalDateString } from './chatHelpers';
import { pruneDateCache } from './chatPersistenceHelpers';
import type { ChatState, Message, MessageSyncState } from './useChatStore.types';

function normalizeSyncedMessage(message: Message): Message {
  return {
    ...message,
    syncState: 'synced',
    syncError: null,
  };
}

function shouldKeepLocalOnlyMessage(message: Message): boolean {
  return message.syncState === 'pending' || message.syncState === 'failed';
}

function messagesEqual(left: Message, right: Message): boolean {
  return left.content === right.content
    && left.timestamp === right.timestamp
    && left.type === right.type
    && left.duration === right.duration
    && left.activityType === right.activityType
    && left.mode === right.mode
    && left.isMood === right.isMood
    && left.stardustId === right.stardustId
    && left.stardustEmoji === right.stardustEmoji
    && left.imageUrl === right.imageUrl
    && left.imageUrl2 === right.imageUrl2
    && left.isActive === right.isActive
    && left.detached === right.detached
    && left.syncState === right.syncState
    && (left.syncError ?? null) === (right.syncError ?? null)
    && JSON.stringify(left.moodDescriptions ?? null) === JSON.stringify(right.moodDescriptions ?? null);
}

export function mergeCloudMessagesWithLocal(cloudMessages: Message[], localMessages: Message[]): {
  mergedMessages: Message[];
  changed: boolean;
} {
  const cloudById = new Map(cloudMessages.map((message) => [message.id, normalizeSyncedMessage(message)]));
  const merged: Message[] = [];
  let changed = false;

  for (const local of localMessages) {
    const cloud = cloudById.get(local.id);
    if (!cloud) {
      if (shouldKeepLocalOnlyMessage(local)) {
        merged.push(local);
      } else {
        changed = true;
      }
      continue;
    }

    merged.push(cloud);
    if (!messagesEqual(local, cloud)) {
      changed = true;
    }
    cloudById.delete(local.id);
  }

  for (const cloudOnly of cloudById.values()) {
    merged.push(cloudOnly);
    changed = true;
  }

  merged.sort((left, right) => left.timestamp - right.timestamp);
  if (merged.length !== localMessages.length) {
    changed = true;
  }

  return { mergedMessages: merged, changed };
}

export function insertChatMessage(state: ChatState, message: Message): Pick<ChatState, 'messages' | 'dateCache'> {
  const dateStr = getLocalDateString(new Date(message.timestamp));
  const nextMessages = [...state.messages, message].sort((left, right) => left.timestamp - right.timestamp);
  const nextDateMessages = projectMessagesForDate(nextMessages, dateStr);

  return {
    messages: nextMessages,
    dateCache: pruneDateCache({
      ...state.dateCache,
      [dateStr]: nextDateMessages,
    }),
  };
}

export function projectMessagesForDate(messages: Message[], dateStr: string): Message[] {
  return messages
    .filter((message) => getLocalDateString(new Date(message.timestamp)) === dateStr)
    .sort((left, right) => left.timestamp - right.timestamp);
}

export function applyChatMessageSyncState(
  state: ChatState,
  messageId: string,
  syncState: MessageSyncState,
  syncError: string | null = null,
): Pick<ChatState, 'messages' | 'dateCache'> {
  const updateMessage = (message: Message): Message => (
    message.id === messageId
      ? { ...message, syncState, syncError }
      : message
  );

  return {
    messages: state.messages.map(updateMessage),
    dateCache: Object.fromEntries(
      Object.entries(state.dateCache).map(([dateStr, messages]) => [dateStr, messages.map(updateMessage)]),
    ),
  };
}
