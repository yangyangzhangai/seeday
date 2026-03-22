// DOC-DEPS: LLM.md -> docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md -> src/features/chat/README.md
import type { LiveInputContext, LiveInputContextMessage, RecentActivityContext } from './types';

const CONTEXT_WINDOW_MS = 30 * 60 * 1000;

function toRecentActivity(message: LiveInputContextMessage): RecentActivityContext {
  return {
    id: message.id,
    content: message.content,
    timestamp: message.timestamp,
    isOngoing: message.duration === undefined,
  };
}

export function getLiveInputContext(messages: LiveInputContextMessage[], now = Date.now()): LiveInputContext {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.isMood) {
      continue;
    }

    const candidate = toRecentActivity(message);
    if (candidate.isOngoing) {
      return { now, recentActivity: candidate };
    }

    const age = now - candidate.timestamp;
    if (age <= CONTEXT_WINDOW_MS) {
      return { now, recentActivity: candidate };
    }

    break;
  }

  return { now };
}
