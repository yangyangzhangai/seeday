import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../api/supabase';
import { callChatAPI, callClassifierAPI } from '../api/client';
import { autoDetectMood } from '../lib/mood';
import { toDbMessage } from '../lib/dbMappers';
import { type MoodKey } from '../lib/moodOptions';
import { getSupabaseSession } from '../lib/supabase-utils';
import { useMoodStore } from './useMoodStore';
import { buildChatApiMessages, getAiErrorText } from './chatHelpers';
import i18n from '../i18n';
import type { Message } from './useChatStore';

export async function closePreviousActivity(messages: Message[], now: number): Promise<Message[]> {
  const updatedMessages = [...messages];

  let lastRecordIndex = -1;
  for (let i = updatedMessages.length - 1; i >= 0; i--) {
    if (updatedMessages[i].mode === 'record' && !updatedMessages[i].isMood) {
      lastRecordIndex = i;
      break;
    }
  }

  if (lastRecordIndex === -1) {
    return updatedMessages;
  }

  const lastMessage = updatedMessages[lastRecordIndex];
  const duration = Math.max(0, Math.round((now - lastMessage.timestamp) / (1000 * 60)));
  updatedMessages[lastRecordIndex] = { ...lastMessage, duration };

  const session = await getSupabaseSession();
  if (session) {
    await supabase
      .from('messages')
      .update({ duration })
      .eq('id', lastMessage.id)
      .eq('user_id', session.user.id);
  }

  const moodStore = useMoodStore.getState();
  moodStore.setMood(lastMessage.id, autoDetectMood(lastMessage.content, duration));

  return updatedMessages;
}

export function buildInsertedActivityResult(
  messages: Message[],
  content: string,
  startTime: number,
  endTime: number,
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
    activityType: '待分类',
    mode: 'record',
  };

  const messagesToInsert: Message[] = [newMessage];
  const messagesToUpdate: Message[] = [];

  const currentMessages = messages.map((message) => {
    if (message.mode !== 'record') return message;

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

export async function persistMessageToSupabase(message: Message, userId: string, isMood = false): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .insert([{ ...toDbMessage(message, userId), is_mood: isMood }]);

  if (error) {
    console.error('Error sending message:', error);
  }
}

export async function triggerMoodDetection(messageId: string, content: string): Promise<void> {
  const moodStore = useMoodStore.getState();
  const currentLang = (i18n.language?.split('-')[0] || 'en') as 'zh' | 'en' | 'it';

  try {
    let mood = autoDetectMood(content, 0);
    const response = await callClassifierAPI({ rawInput: content, lang: currentLang });
    const energyLog = response?.data?.energy_log?.[0];

    if (mood === 'calm' && energyLog?.energy_level) {
      const levelToMood: Record<string, MoodKey> = {
        high: 'happy',
        medium: 'calm',
        low: 'tired',
      };
      mood = levelToMood[energyLog.energy_level] || mood;
    }

    moodStore.setMood(messageId, mood);
  } catch {
    moodStore.setMood(messageId, autoDetectMood(content, 0));
  }
}

export async function handleAIChatResponse(messages: Message[], userId?: string): Promise<Message> {
  try {
    const apiMessages = buildChatApiMessages(messages);
    const aiResponse = await callChatAPI({
      messages: apiMessages,
      temperature: 0.9,
      max_tokens: 512,
    });

    const aiMessage: Message = {
      id: uuidv4(),
      content: aiResponse,
      timestamp: Date.now(),
      type: 'ai',
      mode: 'chat',
      activityType: 'chat',
    };

    if (userId) {
      await persistMessageToSupabase(aiMessage, userId);
    }

    return aiMessage;
  } catch (error) {
    console.error('AI Error:', error);
    return {
      id: uuidv4(),
      content: getAiErrorText(),
      timestamp: Date.now(),
      type: 'system',
      mode: 'chat',
      activityType: 'chat',
    };
  }
}
