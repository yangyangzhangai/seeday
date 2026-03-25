import type { ActivityRecordType, ActivityType } from '../lib/activityType';
import type { LiveInputClassification } from '../services/input/types';

export type MessageType = 'text' | 'system' | 'ai';

export interface MoodDescription {
  id: string;
  content: string;
  timestamp: number;
}

export interface Message {
  id: string;
  content: string;
  timestamp: number;
  type: MessageType;
  duration?: number;
  activityType?: ActivityType;
  mode?: 'record';
  isMood?: boolean;
  stardustId?: string;
  stardustEmoji?: string;
  imageUrl?: string | null;
  imageUrl2?: string | null;
  moodDescriptions?: MoodDescription[] | null;
  isActive?: boolean;
  detached?: boolean;
}

export interface YesterdaySummary {
  count: number;
  lastContent: string;
  dateStr: string;
  dateStartMs: number;
  dateEndMs: number;
  isYesterday: boolean;
}

export interface ChatState {
  messages: Message[];
  lastActivityTime: number | null;
  isMoodMode: boolean;
  isLoading: boolean;
  hasInitialized: boolean;
  oldestLoadedDate: string | null;
  hasMoreHistory: boolean;
  isLoadingMore: boolean;
  yesterdaySummary: YesterdaySummary | null;
  currentDateStr: string | null;
  activeViewDateStr: string | null;
  dateCache: Map<string, Message[]>;
  fetchMessages: () => Promise<void>;
  fetchOlderMessages: () => Promise<void>;
  fetchMessagesByDate: (dateStr: string) => Promise<void>;
  checkAndRefreshForNewDay: () => void;
  sendMessage: (
    content: string,
    customTimestamp?: number,
    options?: { skipMoodDetection?: boolean; activityTypeOverride?: ActivityRecordType }
  ) => Promise<string | null>;
  sendMood: (content: string, options?: { relatedActivityId?: string }) => Promise<string | null>;
  sendAutoRecognizedInput: (content: string) => Promise<LiveInputClassification | null>;
  reclassifyRecentInput: (messageId: string, nextKind: 'activity' | 'mood') => Promise<void>;
  insertActivity: (prevId: string | null, nextId: string | null, content: string, startTime: number, endTime: number) => Promise<void>;
  updateActivity: (id: string, content: string, startTime: number, endTime: number) => Promise<void>;
  endActivity: (id: string, opts?: { skipBottleStar?: boolean }) => Promise<void>;
  deleteActivity: (id: string) => Promise<void>;
  updateMessageDuration: (content: string, timestamp: number, duration: number) => Promise<void>;
  updateMessageImage: (id: string, slot: 'imageUrl' | 'imageUrl2', url: string | null) => Promise<void>;
  getMessagesForDateRange: (start: Date, end: Date) => Promise<Message[]>;
  loadMessagesForDateRange: (start: Date, end: Date) => Promise<void>;
  setHasInitialized: (value: boolean) => void;
  clearHistory: () => Promise<void>;
  attachStardustToMessage: (messageId: string, stardustId: string, stardustEmoji: string) => void;
  detachMoodFromEvent: (eventId: string, moodMsgId: string) => void;
  reattachMoodToEvent: (moodMsgId: string) => Promise<void>;
  convertMoodToEvent: (moodMsgId: string) => Promise<void>;
}
