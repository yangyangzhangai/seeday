import { supabase } from '../api/supabase';
import { getSupabaseSession } from '../lib/supabase-utils';
import { autoDetectMood } from '../lib/mood';
import { classifyRecordActivityType } from '../lib/activityType';
import type { Message, MoodDescription } from './useChatStore.types';
import { useMoodStore } from './useMoodStore';
import { useAnnotationStore } from './useAnnotationStore';
import { useTodoStore } from './useTodoStore';
import { useGrowthStore } from './useGrowthStore';
import {
  buildInsertedActivityResult,
  buildMessageDurationUpdate,
  persistInsertedActivityResult,
  persistMessageDurationUpdate,
  persistMessageToSupabase,
} from './chatActions';
import { getLocalDateString } from './chatHelpers';
import { pruneDateCache } from './chatPersistenceHelpers';
import { projectMessagesForDate } from './chatSyncHelpers';
import i18n from '../i18n';
import type { SupportedLang } from '../services/input/lexicon/getLexicon';
import { resolveAutoActivityEndMs, resolveAutoActivityDurationMinutes } from './chatDayBoundary';

function resolveCurrentLang(): SupportedLang {
  const lang = i18n.language?.toLowerCase() ?? 'zh';
  if (lang.startsWith('en')) return 'en';
  if (lang.startsWith('it')) return 'it';
  return 'zh';
}

function resolveLangForText(content: string): SupportedLang {
  if (/[\u3400-\u9fff]/.test(content)) return 'zh';
  const lowered = content.toLowerCase();
  if (/\b(sono|sto|stanco|stanca|felice|ansioso|ansiosa|sollevato|sollevata|sollievo|riunione|lezione|lavorando|studiando)\b/.test(lowered)) {
    return 'it';
  }
  if (/[A-Za-z\u00C0-\u017F]/.test(content)) return 'en';
  return resolveCurrentLang();
}

type TimelineState = {
  messages: Message[];
  pendingManualEnds?: Record<string, number>;
  dateCache: Record<string, Message[]>;
};
type Setter = (partial: Partial<TimelineState> | ((state: TimelineState) => Partial<TimelineState>)) => void;
type Getter = () => TimelineState;

export interface ChatTimelineActions {
  insertActivity: (prevId: string | null, nextId: string | null, content: string, startTime: number, endTime: number) => Promise<void>;
  updateActivity: (id: string, content: string, startTime: number, endTime: number, options?: { keepOngoing?: boolean }) => Promise<void>;
  deleteActivity: (id: string) => Promise<void>;
  updateMessageDuration: (content: string, timestamp: number, duration: number) => Promise<void>;
  updateMessageImage: (id: string, slot: 'imageUrl' | 'imageUrl2', url: string | null) => Promise<void>;
  detachMoodFromEvent: (eventId: string, moodMsgId: string) => void;
  reattachMoodToEvent: (moodMsgId: string) => Promise<void>;
  convertMoodToEvent: (moodMsgId: string) => Promise<void>;
  detachMoodMessage: (moodId: string) => Promise<void>;
}

export class OngoingActivityOverlapError extends Error {
  activityContent: string;

  constructor(activityContent: string) {
    super('overlap_with_ongoing_activity');
    this.name = 'OngoingActivityOverlapError';
    this.activityContent = activityContent;
  }
}

function assertNoOngoingActivityOverlap(
  messages: Message[],
  startTime: number,
  endTime: number,
  ignoreId?: string,
): void {
  const now = Date.now();
  const conflict = messages.find((message) => {
    if (message.id === ignoreId || message.isMood || message.mode !== 'record' || message.duration !== undefined) {
      return false;
    }
    const ongoingEnd = resolveAutoActivityEndMs(message.timestamp, now);
    return startTime < ongoingEnd && endTime > message.timestamp;
  });

  if (conflict) {
    throw new OngoingActivityOverlapError(conflict.content);
  }
}

export function createChatTimelineActions(
  set: Setter,
  get: Getter,
): ChatTimelineActions {
  const detachMoodFromEvent = (eventId: string, moodMsgId: string) => {
    const moodMessage = get().messages.find(m => m.id === moodMsgId);
    set(state => ({
      messages: state.messages.map(m => {
        if (m.id === eventId) {
          return {
            ...m,
            moodDescriptions: (m.moodDescriptions || []).filter(d => d.id !== moodMsgId),
          };
        }
        if (m.id === moodMsgId) return { ...m, detached: true };
        return m;
      }),
    }));

    if (!moodMessage) return;
    const moodStore = useMoodStore.getState();
    const hasManualMood = moodStore.activityMoodMeta[moodMsgId]?.source === 'manual';
    const hasManualCustomLabel = moodStore.customMoodApplied[moodMsgId] === true;
    if (!hasManualMood && !hasManualCustomLabel && !moodStore.getMood(moodMsgId)) {
      moodStore.setMood(moodMsgId, autoDetectMood(moodMessage.content, 0, resolveLangForText(moodMessage.content)), 'auto');
    }
  };

  const reattachMoodToEvent = async (moodMsgId: string) => {
    const { messages } = get();
    const moodMsg = messages.find(m => m.id === moodMsgId && m.isMood);
    if (!moodMsg) return;
    const latestEvent = [...messages]
      .filter(m => !m.isMood && m.mode === 'record')
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    if (!latestEvent) return;
    const newDesc: MoodDescription = {
      id: moodMsg.id, content: moodMsg.content, timestamp: moodMsg.timestamp,
    };
    set(state => ({
      messages: state.messages.map(m => {
        if (m.id === latestEvent.id) {
          return { ...m, moodDescriptions: [...(m.moodDescriptions || []), newDesc] };
        }
        if (m.id === moodMsgId) return { ...m, detached: false };
        return m;
      }),
    }));

    const session = await getSupabaseSession();
    if (!session) return;

    const updatedMessages = get().messages;
    const idsToPersist = new Set<string>([moodMsgId, latestEvent.id]);
    for (const id of idsToPersist) {
      const message = updatedMessages.find((candidate) => candidate.id === id);
      if (!message) continue;
      await persistMessageToSupabase(message, session.user.id);
    }
  };

  const convertMoodToEvent = async (moodMsgId: string) => {
    const currentMessages = get().messages;
    const moodTarget = currentMessages.find(
      m => m.id === moodMsgId && m.mode === 'record' && m.type === 'text' && m.isMood,
    );
    if (!moodTarget) {
      return;
    }

    const latestRecordMessage = [...currentMessages]
      .filter(m => m.mode === 'record' && m.type === 'text')
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    const isLatestRecordMessage = latestRecordMessage?.id === moodMsgId;
    const isMoodOnToday = getLocalDateString(new Date(moodTarget.timestamp)) === getLocalDateString(new Date());
    const shouldStartAsActiveEvent = isLatestRecordMessage && isMoodOnToday;
    const now = Date.now();
    const prevActive = shouldStartAsActiveEvent
      ? (currentMessages.find(m => m.isActive && !m.isMood) ?? null)
      : null;

    set(state => ({
      messages: state.messages.map(m => {
        if (shouldStartAsActiveEvent && m.isActive && !m.isMood) {
          return { ...m, isActive: false, duration: Math.max(0, Math.round((now - m.timestamp) / 60000)) };
        }
        if (m.id === moodMsgId) {
          return {
            ...m,
            isMood: false,
            detached: false,
            isActive: shouldStartAsActiveEvent,
            duration: shouldStartAsActiveEvent ? undefined : (m.duration ?? 0),
            activityType: classifyRecordActivityType(m.content, resolveLangForText(m.content)).activityType,
          };
        }
        return m;
      }),
    }));

    if (prevActive) {
      const moodStore = useMoodStore.getState();
      const isCustomApplied = moodStore.customMoodApplied[prevActive.id];
      if (!isCustomApplied) {
        const duration = Math.max(0, Math.round((now - prevActive.timestamp) / 60000));
        moodStore.setMood(prevActive.id, autoDetectMood(prevActive.content, duration, resolveLangForText(prevActive.content)), 'auto');
      }
    }

    const newEvent = get().messages.find(m => m.id === moodMsgId);
    if (newEvent) {
      const moodStore = useMoodStore.getState();
      const hasManualMood = moodStore.activityMoodMeta[moodMsgId]?.source === 'manual';
      const hasManualCustomLabel = moodStore.customMoodApplied[moodMsgId] === true;
      if (!hasManualMood && !hasManualCustomLabel) {
        moodStore.setMood(moodMsgId, autoDetectMood(newEvent.content, 0, resolveLangForText(newEvent.content)), 'auto');
      }
    }

    const session = await getSupabaseSession();
    if (session) {
      const updated = get().messages;
      const idsToPersist = new Set<string>([moodMsgId]);
      if (prevActive) idsToPersist.add(prevActive.id);
      for (const id of idsToPersist) {
        const message = updated.find(m => m.id === id);
        if (!message) continue;
        await persistMessageToSupabase(message, session.user.id);
      }
    }
  };

  const insertActivity = async (prevId: string | null, nextId: string | null, content: string, startTime: number, endTime: number) => {
    assertNoOngoingActivityOverlap(get().messages, startTime, endTime);
    const { finalMessages, messagesToInsert, messagesToUpdate } = buildInsertedActivityResult(
      get().messages,
      content,
      startTime,
      endTime,
      resolveLangForText(content),
    );

    set({ messages: finalMessages });
    const insertedPrimary = messagesToInsert[0];

    const session = await getSupabaseSession();
    if (session) {
      await persistInsertedActivityResult(session.user.id, messagesToInsert, messagesToUpdate);
    }

    if (insertedPrimary && !useMoodStore.getState().getMood(insertedPrimary.id)) {
      useMoodStore.getState().setMood(
        insertedPrimary.id,
        autoDetectMood(insertedPrimary.content, insertedPrimary.duration ?? 0, resolveLangForText(insertedPrimary.content)),
        'auto',
      );
    }
  };

  const updateActivity = async (
    id: string,
    content: string,
    startTime: number,
    endTime: number,
    options?: { keepOngoing?: boolean },
  ) => {
    const existing = get().messages.find((message) => message.id === id);
    if (!existing) return;

    const keepOngoing = options?.keepOngoing === true;
    const overlapEndTime = keepOngoing ? resolveAutoActivityEndMs(startTime, Date.now()) : endTime;
    assertNoOngoingActivityOverlap(get().messages, startTime, overlapEndTime, id);

    const nextDuration = keepOngoing ? undefined : Math.round((endTime - startTime) / (1000 * 60));
    const nextIsActive = keepOngoing && existing.mode === 'record' && !existing.isMood;
    const nextActivityType = existing.mode === 'record' && !existing.isMood
      ? classifyRecordActivityType(content, resolveLangForText(content)).activityType
      : existing.activityType;
    const oldDateStr = getLocalDateString(new Date(existing.timestamp));
    const newDateStr = getLocalDateString(new Date(startTime));

    set((state) => {
      const nextMessages = state.messages.map((message) => (
        message.id === id
          ? {
            ...message,
            content,
            timestamp: startTime,
            duration: nextDuration,
            isActive: nextIsActive,
            activityType: nextActivityType,
          }
          : message
      )).sort((a, b) => a.timestamp - b.timestamp);

      return {
        messages: nextMessages,
        dateCache: pruneDateCache({
          ...state.dateCache,
          [oldDateStr]: projectMessagesForDate(nextMessages, oldDateStr),
          [newDateStr]: projectMessagesForDate(nextMessages, newDateStr),
        }),
      };
    });

    const session = await getSupabaseSession();
    if (session) {
      await supabase.from('messages').update({
        content,
        timestamp: startTime,
        duration: nextDuration ?? null,
        is_active: nextIsActive,
        activity_type: nextActivityType,
      }).eq('id', id).eq('user_id', session.user.id);
    }

    const moodStore = useMoodStore.getState();
    const moodMeta = moodStore.activityMoodMeta[id];
    const isCustomApplied = moodStore.customMoodApplied[id] === true;
    if (!keepOngoing && moodMeta?.source === 'auto' && !isCustomApplied) {
      moodStore.setMood(id, autoDetectMood(content, nextDuration ?? 0, resolveLangForText(content)), 'auto');
    }
    if (keepOngoing && !moodStore.getMood(id)) {
      moodStore.setMood(id, autoDetectMood(content, resolveAutoActivityDurationMinutes(startTime, Date.now()), resolveLangForText(content)), 'auto');
    }
  };

  const deleteActivity = async (id: string) => {
    const reward = useTodoStore.getState().consumeBottleStarRewardByMessage(id);
    if (reward) {
      useGrowthStore.getState().decrementBottleStars(reward.bottleId, reward.stars);
    }
    set(state => ({
      messages: state.messages.filter(m => m.id !== id),
      pendingManualEnds: Object.fromEntries(
        Object.entries(state.pendingManualEnds || {}).filter(([messageId]) => messageId !== id)
      ),
    }));
    useAnnotationStore.getState().removeEventsByMessageId(id);

    const session = await getSupabaseSession();
    if (session) {
      await supabase.from('messages').delete().eq('id', id).eq('user_id', session.user.id);
    }
  };

  const updateMessageDuration = async (content: string, timestamp: number, duration: number) => {
    const { updatedMessages, targetMessage } = buildMessageDurationUpdate(
      get().messages,
      content,
      timestamp,
      duration,
    );

    if (!targetMessage) {
      return;
    }
    set({ messages: updatedMessages });
    const session = await getSupabaseSession();
    if (session) {
      await persistMessageDurationUpdate(session.user.id, targetMessage.id, duration);
    }
  };

  const updateMessageImage = async (id: string, slot: 'imageUrl' | 'imageUrl2', url: string | null) => {
    const dbCol = slot === 'imageUrl' ? 'image_url' : 'image_url_2';
    set(state => ({
      messages: state.messages.map(m =>
        m.id === id ? { ...m, [slot]: url } : m,
      ),
    }));
    const session = await getSupabaseSession();
    if (session) {
      await supabase
        .from('messages')
        .update({ [dbCol]: url })
        .eq('id', id)
        .eq('user_id', session.user.id);
    }
  };

  const detachMoodMessage = async (moodId: string) => {
    const parentId = get().messages.find(m => m.moodDescriptions?.some(d => d.id === moodId))?.id;
    detachMoodFromEvent(parentId ?? '', moodId);
    const session = await getSupabaseSession();
    if (!session) return;
    const mood = get().messages.find(m => m.id === moodId);
    if (mood) await persistMessageToSupabase(mood, session.user.id, true);
    if (parentId) {
      const parent = get().messages.find(m => m.id === parentId);
      if (parent) await persistMessageToSupabase(parent, session.user.id);
    }
  };

  return {
    insertActivity,
    updateActivity,
    deleteActivity,
    updateMessageDuration,
    updateMessageImage,
    detachMoodFromEvent,
    reattachMoodToEvent,
    convertMoodToEvent,
    detachMoodMessage,
  };
}
