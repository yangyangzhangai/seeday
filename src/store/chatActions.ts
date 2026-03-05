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
