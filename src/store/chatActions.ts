import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../api/supabase';
import { autoDetectMood } from '../lib/mood';
import { toDbMessage } from '../lib/dbMappers';
import { classifyRecordActivityType } from '../lib/activityType';
import { getSupabaseSession } from '../lib/supabase-utils';
import { useMoodStore } from './useMoodStore';
import type { Message } from './useChatStore.types';
import { classifyLiveInput } from '../services/input/liveInputClassifier';
import { getLiveInputContext } from '../services/input/liveInputContext';
import type { LiveInputClassification } from '../services/input/types';
import { recordLiveInputClassification } from '../services/input/liveInputTelemetry';
import { emitLiveInputClassificationTelemetry } from '../services/input/liveInputTelemetryCloud';
import type { SupportedLang } from '../services/input/lexicon/getLexicon';
import i18n from '../i18n';
import { resolveAutoActivityDurationMinutes } from './chatDayBoundary';

type SendMessageFn = (
  content: string,
  customTimestamp?: number,
  options?: { skipMoodDetection?: boolean; activityTypeOverride?: import('../lib/activityType').ActivityRecordType },
) => Promise<string | null>;

type SendMoodFn = (content: string, options?: { relatedActivityId?: string }) => Promise<string | null>;
type ReclassifyKind = 'activity' | 'mood';

interface MessagePatch {
  id: string;
  isMood: boolean;
  activityType: string;
  duration?: number;
}

interface ReclassifyResult {
  updatedMessages: Message[];
  patches: MessagePatch[];
  previousActivityId?: string;
  previousActivityMoodAttachmentToClear?: string;
}

export interface AutoRecognizedInputResult {
  classification: LiveInputClassification;
  messageId: string | null;
}

function inferAutoMoodLang(content: string): SupportedLang {
  if (/[\u3400-\u9fff]/.test(content)) {
    return 'zh';
  }
  const lowered = content.toLowerCase();
  if (
    /\b(sono|sto|stanco|stanca|felice|ansioso|ansiosa|sollevato|sollevata|sollievo|riunione|lezione|lavorando|studiando)\b/.test(lowered)
  ) {
    return 'it';
  }
  return 'en';
}

function resolveCurrentLang(): SupportedLang {
  const lang = i18n.language?.toLowerCase() ?? 'zh';
  if (lang.startsWith('en')) return 'en';
  if (lang.startsWith('it')) return 'it';
  return 'zh';
}

function resolveLangForText(content: string): SupportedLang {
  if (!content.trim()) return resolveCurrentLang();
  return inferAutoMoodLang(content);
}

function findLatestMessageIndex(messages: Message[]): number {
  let latestIndex = -1;
  let latestTimestamp = -Infinity;

  for (let i = 0; i < messages.length; i++) {
    const timestamp = messages[i].timestamp;
    if (timestamp >= latestTimestamp) {
      latestTimestamp = timestamp;
      latestIndex = i;
    }
  }

  return latestIndex;
}

function findPreviousActivityIndex(messages: Message[], fromIndex: number): number {
  for (let i = fromIndex - 1; i >= 0; i--) {
    const message = messages[i];
    if (!message.isMood) {
      return i;
    }
  }
  return -1;
}

function toRoundedMinutes(from: number, to: number): number {
  return Math.max(0, Math.round((to - from) / (1000 * 60)));
}

function buildMoodToActivityReclassify(
  messages: Message[],
  targetIndex: number,
  moodNoteMetaMap: Record<string, { source: 'auto' | 'manual'; linkedMoodMessageId?: string } | undefined>,
): ReclassifyResult {
  const updatedMessages = [...messages];
  const target = updatedMessages[targetIndex];
  const patches: MessagePatch[] = [];

  updatedMessages[targetIndex] = {
    ...target,
    isMood: false,
    activityType: classifyRecordActivityType(target.content, resolveLangForText(target.content)).activityType,
    duration: undefined,
  };
  patches.push({
    id: target.id,
    isMood: false,
    activityType: classifyRecordActivityType(target.content, resolveLangForText(target.content)).activityType,
    duration: undefined,
  });

  const previousActivityIndex = findPreviousActivityIndex(updatedMessages, targetIndex);
  if (previousActivityIndex >= 0) {
    const previous = updatedMessages[previousActivityIndex];
    if (previous.duration === undefined) {
      const duration = toRoundedMinutes(previous.timestamp, target.timestamp);
      updatedMessages[previousActivityIndex] = { ...previous, duration };
      patches.push({
        id: previous.id,
        isMood: false,
        activityType: previous.activityType || classifyRecordActivityType(previous.content, resolveLangForText(previous.content)).activityType,
        duration,
      });
    }

    return {
      updatedMessages,
      patches,
      previousActivityId: previous.id,
      previousActivityMoodAttachmentToClear:
        moodNoteMetaMap[previous.id]?.source === 'auto' &&
        moodNoteMetaMap[previous.id]?.linkedMoodMessageId === target.id
          ? previous.id
          : undefined,
    };
  }

  return {
    updatedMessages,
    patches,
  };
}

function buildActivityToMoodReclassify(messages: Message[], targetIndex: number): ReclassifyResult {
  const updatedMessages = [...messages];
  const target = updatedMessages[targetIndex];
  const patches: MessagePatch[] = [];

  updatedMessages[targetIndex] = {
    ...target,
    isMood: true,
    activityType: 'mood',
    duration: undefined,
    detached: true,
  };
  patches.push({
    id: target.id,
    isMood: true,
    activityType: 'mood',
    duration: undefined,
  });

  const previousActivityIndex = findPreviousActivityIndex(messages, targetIndex);
  if (previousActivityIndex >= 0) {
    const previous = updatedMessages[previousActivityIndex];
    const expectedDuration = toRoundedMinutes(previous.timestamp, target.timestamp);

    if (previous.duration !== undefined && Math.abs(previous.duration - expectedDuration) <= 1) {
      updatedMessages[previousActivityIndex] = {
        ...previous,
        duration: undefined,
      };
      patches.push({
        id: previous.id,
        isMood: false,
        activityType: previous.activityType || classifyRecordActivityType(previous.content, resolveLangForText(previous.content)).activityType,
        duration: undefined,
      });
    }

    return {
      updatedMessages,
      patches,
      previousActivityId: previous.id,
    };
  }

  return {
    updatedMessages,
    patches,
  };
}

export function buildRecentReclassifyResult(
  messages: Message[],
  messageId: string,
  nextKind: ReclassifyKind,
  moodNoteMetaMap: Record<string, { source: 'auto' | 'manual'; linkedMoodMessageId?: string } | undefined>,
): ReclassifyResult | null {
  if (messages.length === 0) {
    return null;
  }

  const targetIndex = messages.findIndex((message) => message.id === messageId);
  if (targetIndex < 0) {
    return null;
  }

  const target = messages[targetIndex];

  const latestIndex = findLatestMessageIndex(messages);
  if (targetIndex !== latestIndex) {
    return null;
  }

  const isAlreadyKind = (nextKind === 'mood' && target.isMood) || (nextKind === 'activity' && !target.isMood);
  if (isAlreadyKind) {
    return null;
  }

  if (nextKind === 'activity') {
    return buildMoodToActivityReclassify(messages, targetIndex, moodNoteMetaMap);
  }

  return buildActivityToMoodReclassify(messages, targetIndex);
}

export async function persistReclassifiedMessages(userId: string, patches: MessagePatch[]): Promise<void> {
  for (const patch of patches) {
    await supabase
      .from('messages')
      .update({
        is_mood: patch.isMood,
        activity_type: patch.activityType,
        duration: patch.duration ?? null,
      })
      .eq('id', patch.id)
      .eq('user_id', userId);
  }
}

export function applyReclassifyMoodSideEffects(
  targetMessageId: string,
  nextKind: ReclassifyKind,
  targetContent: string,
  previousActivityId?: string,
  previousActivityMoodAttachmentToClear?: string,
): void {
  const moodStore = useMoodStore.getState();

  if (nextKind === 'mood') {
    if (previousActivityId) {
      moodStore.setMoodNote(previousActivityId, targetContent, {
        source: 'auto',
        linkedMoodMessageId: targetMessageId,
      });
      void triggerMoodDetection(previousActivityId, targetContent, {
        source: 'auto',
        linkedMoodMessageId: targetMessageId,
      });
    }

    useMoodStore.setState((state) => ({
      activityMood: { ...state.activityMood, [targetMessageId]: undefined },
      activityMoodMeta: { ...state.activityMoodMeta, [targetMessageId]: undefined },
      customMoodLabel: { ...state.customMoodLabel, [targetMessageId]: undefined },
      customMoodApplied: { ...state.customMoodApplied, [targetMessageId]: false },
      moodNote: { ...state.moodNote, [targetMessageId]: undefined },
      moodNoteMeta: { ...state.moodNoteMeta, [targetMessageId]: undefined },
    }));
    return;
  }

  if (previousActivityMoodAttachmentToClear) {
    moodStore.clearAutoMoodAttachmentsByMessage(previousActivityMoodAttachmentToClear, targetMessageId);
  }
}

export function classifyAutoRecognizedInput(content: string, messages: Message[]): LiveInputClassification | null {
  const trimmed = content.trim();
  if (!trimmed) {
    return null;
  }

  const context = getLiveInputContext(messages, Date.now());
  return classifyLiveInput(trimmed, context);
}

export async function dispatchAutoRecognizedInput(
  content: string,
  classification: LiveInputClassification,
  sendMessage: SendMessageFn,
  sendMood: SendMoodFn,
): Promise<string | null> {
  const trimmed = content.trim();

  switch (classification.internalKind) {
    case 'standalone_mood': {
      const relatedActivityId = classification.relatedActivityId;
      return sendMood(trimmed, relatedActivityId ? { relatedActivityId } : undefined);
    }
    case 'mood_about_last_activity': {
      const relatedActivityId = classification.relatedActivityId;
      return sendMood(trimmed, relatedActivityId ? { relatedActivityId } : undefined);
    }
    case 'activity_with_mood':
      return sendMessage(trimmed, undefined, {
        skipMoodDetection: true,
      });
    case 'new_activity':
      return sendMessage(trimmed, undefined, {
        skipMoodDetection: false,
      });
    default:
      return classification.kind === 'mood'
        ? sendMood(trimmed)
        : sendMessage(trimmed);
  }
}

export function applyAutoRecognizedInputEffects(
  messageId: string | null,
  classification: LiveInputClassification,
): void {
  if (!messageId || classification.kind !== 'activity') {
    return;
  }

  if (classification.internalKind !== 'activity_with_mood') {
    return;
  }

  const moodStore = useMoodStore.getState();
  const fallbackMood = autoDetectMood(classification.moodNote ?? '', 0, inferAutoMoodLang(classification.moodNote ?? ''));
  moodStore.setMood(messageId, classification.extractedMood ?? fallbackMood, 'auto');
  if (classification.moodNote) {
    moodStore.setMoodNote(messageId, classification.moodNote, 'auto');
  }
}

export async function sendAutoRecognizedInputFlow(
  content: string,
  messages: Message[],
  sendMessage: SendMessageFn,
  sendMood: SendMoodFn,
): Promise<AutoRecognizedInputResult | null> {
  const classification = classifyAutoRecognizedInput(content, messages);
  if (!classification) {
    return null;
  }

  recordLiveInputClassification(classification);

  const messageId = await dispatchAutoRecognizedInput(content, classification, sendMessage, sendMood);
  applyAutoRecognizedInputEffects(messageId, classification);
  emitLiveInputClassificationTelemetry(content, classification, messageId);

  return {
    classification,
    messageId,
  };
}

export async function closePreviousActivity(messages: Message[], now: number): Promise<Message[]> {
  const updatedMessages = [...messages];

  let lastRecordIndex = -1;
  for (let i = updatedMessages.length - 1; i >= 0; i--) {
    if (!updatedMessages[i].isMood) {
      lastRecordIndex = i;
      break;
    }
  }

  if (lastRecordIndex === -1) {
    return updatedMessages;
  }

  const lastMessage = updatedMessages[lastRecordIndex];
  const duration = resolveAutoActivityDurationMinutes(lastMessage.timestamp, now);
  updatedMessages[lastRecordIndex] = { ...lastMessage, duration, isActive: false };

  const session = await getSupabaseSession();
  if (session) {
    await supabase
      .from('messages')
      .update({ duration, is_active: false })
      .eq('id', lastMessage.id)
      .eq('user_id', session.user.id);
  }

  const moodStore = useMoodStore.getState();
  if (!moodStore.getMood(lastMessage.id)) {
    moodStore.setMood(
      lastMessage.id,
      autoDetectMood(lastMessage.content, duration, resolveLangForText(lastMessage.content)),
    );
  }

  return updatedMessages;
}

export function buildInsertedActivityResult(
  messages: Message[],
  content: string,
  startTime: number,
  endTime: number,
  lang?: SupportedLang,
): {
  finalMessages: Message[];
  messagesToInsert: Message[];
  messagesToUpdate: Message[];
} {
  const newMessage: Message = {
    id: uuidv4(),
    content,
    timestamp: startTime,
    type: 'text',
    duration: Math.round((endTime - startTime) / (1000 * 60)),
    activityType: classifyRecordActivityType(content, lang ?? resolveLangForText(content)).activityType,
    mode: 'record',
  };

  const messagesToInsert: Message[] = [newMessage];
  const messagesToUpdate: Message[] = [];

  const currentMessages = messages.map((message) => {
    const messageStart = message.timestamp;
    const messageDuration = message.duration || 0;
    const messageEnd = messageStart + messageDuration * 60 * 1000;

    if (messageStart < endTime && messageEnd > startTime) {
      if (messageStart < startTime && messageEnd > endTime) {
        const tailDuration = Math.round((messageEnd - endTime) / (1000 * 60));
        const tailMessage: Message = {
          ...message,
          id: uuidv4(),
          timestamp: endTime,
          duration: tailDuration,
        };
        messagesToInsert.push(tailMessage);

        const headDuration = Math.round((startTime - messageStart) / (1000 * 60));
        const updatedHead = { ...message, duration: headDuration };
        messagesToUpdate.push(updatedHead);
        return updatedHead;
      }

      if (Math.abs(messageStart - startTime) < 1000) {
        const updatedStart = endTime;
        const updatedDuration = Math.max(0, Math.round((messageEnd - updatedStart) / (1000 * 60)));
        const updatedMessage = { ...message, timestamp: updatedStart, duration: updatedDuration };
        messagesToUpdate.push(updatedMessage);
        return updatedMessage;
      }

      if (messageStart < startTime) {
        const updatedDuration = Math.max(0, Math.round((startTime - messageStart) / (1000 * 60)));
        if (updatedDuration !== messageDuration) {
          const updatedMessage = { ...message, duration: updatedDuration };
          messagesToUpdate.push(updatedMessage);
          return updatedMessage;
        }
      }
    }

    return message;
  });

  const finalMessages = [...currentMessages, ...messagesToInsert].sort((a, b) => a.timestamp - b.timestamp);

  return {
    finalMessages,
    messagesToInsert,
    messagesToUpdate,
  };
}

export async function persistInsertedActivityResult(
  userId: string,
  messagesToInsert: Message[],
  messagesToUpdate: Message[],
): Promise<void> {
  const insertPayload = messagesToInsert.map((message) => toDbMessage(message, userId));

  if (insertPayload.length > 0) {
    await supabase.from('messages').insert(insertPayload);
  }

  for (const message of messagesToUpdate) {
    await supabase
      .from('messages')
      .update({
        timestamp: message.timestamp,
        duration: message.duration,
      })
      .eq('id', message.id)
      .eq('user_id', userId);
  }
}

export function buildMessageDurationUpdate(
  messages: Message[],
  content: string,
  timestamp: number,
  duration: number,
): {
  updatedMessages: Message[];
  targetMessage: Message | null;
} {
  const messageIndex = messages.findIndex((message) =>
    message.mode === 'record' &&
    message.content === content &&
    Math.abs(message.timestamp - timestamp) < 1000,
  );

  if (messageIndex === -1) {
    return { updatedMessages: messages, targetMessage: null };
  }

  const targetMessage = messages[messageIndex];
  const updatedMessages = messages.map((message, index) =>
    index === messageIndex ? { ...message, duration } : message,
  );

  return { updatedMessages, targetMessage };
}

export async function persistMessageDurationUpdate(userId: string, messageId: string, duration: number): Promise<void> {
  await supabase
    .from('messages')
    .update({ duration })
    .eq('id', messageId)
    .eq('user_id', userId);
}

export async function persistMessageToSupabase(
  message: Message,
  userId: string,
  isMood = message.isMood ?? false,
): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .upsert(
      [{ ...toDbMessage(message, userId), is_mood: isMood }],
      { onConflict: 'id' },
    );

  if (error) {
    console.error('Error sending message:', error);
  }
}

export async function triggerMoodDetection(
  messageId: string,
  content: string,
  source: 'auto' | 'manual' | { source: 'auto' | 'manual'; linkedMoodMessageId?: string } = 'auto',
  lang: SupportedLang = resolveLangForText(content),
): Promise<void> {
  const moodStore = useMoodStore.getState();
  moodStore.setMood(messageId, autoDetectMood(content, 0, lang), source);
}
