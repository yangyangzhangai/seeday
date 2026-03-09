// DOC-DEPS: LLM.md -> docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md -> src/features/chat/README.md
import type { MoodKey } from '../../lib/moodOptions';

export type LiveInputKind = 'activity' | 'mood';

export type InternalLiveInputKind =
  | 'new_activity'
  | 'activity_with_mood'
  | 'standalone_mood'
  | 'mood_about_last_activity';

export type LiveInputConfidence = 'high' | 'medium' | 'low';

export interface NormalizedLiveInput {
  rawContent: string;
  normalizedContent: string;
  isMeaningful: boolean;
}

export interface LiveInputScore {
  activity: number;
  mood: number;
}

export interface LiveInputContextMessage {
  id: string;
  content: string;
  timestamp: number;
  duration?: number;
  mode?: 'chat' | 'record';
  isMood?: boolean;
}

export interface RecentActivityContext {
  id: string;
  content: string;
  timestamp: number;
  isOngoing: boolean;
}

export interface LiveInputContext {
  now: number;
  recentActivity?: RecentActivityContext;
}

export interface LiveInputClassification {
  kind: LiveInputKind;
  internalKind: InternalLiveInputKind;
  confidence: LiveInputConfidence;
  scores: LiveInputScore;
  reasons: string[];
  relatedActivityId?: string;
  containsMoodSignal?: boolean;
  extractedMood?: MoodKey;
  moodNote?: string;
}
