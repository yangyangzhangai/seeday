// DOC-DEPS: LLM.md -> docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md -> src/features/chat/README.md
import type { LiveInputContext, LiveInputContextMessage, RecentActivityContext } from './types';

const CONTEXT_WINDOW_MS = 30 * 60 * 1000;
const ACTIVITY_HISTORY_LIMIT = 50;

function toRecentActivity(message: LiveInputContextMessage): RecentActivityContext {
  return {
    id: message.id,
    content: message.content,
    timestamp: message.timestamp,
    isOngoing: message.duration === undefined,
  };
}

function getKnownActivityPhrases(messages: LiveInputContextMessage[]): string[] {
  const phrases = new Set<string>();
  for (let i = messages.length - 1; i >= 0 && phrases.size < ACTIVITY_HISTORY_LIMIT; i--) {
    const message = messages[i];
    if (message.isMood) continue;
    const normalized = message.content.trim().replace(/\s+/g, ' ').toLowerCase();
    if (normalized) phrases.add(normalized);
  }
  return Array.from(phrases);
}

function buildContext(
  now: number,
  knownActivityPhrases: string[],
  recentActivity?: RecentActivityContext,
): LiveInputContext {
  return { now, recentActivity, knownActivityPhrases };
}

export function getLiveInputContext(messages: LiveInputContextMessage[], now = Date.now()): LiveInputContext {
  const knownActivityPhrases = getKnownActivityPhrases(messages);
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.isMood) {
      continue;
    }

    const candidate = toRecentActivity(message);
    if (candidate.isOngoing) {
      return buildContext(now, knownActivityPhrases, candidate);
    }

    const age = now - candidate.timestamp;
    if (age <= CONTEXT_WINDOW_MS) {
      return buildContext(now, knownActivityPhrases, candidate);
    }

    break;
  }

  return buildContext(now, knownActivityPhrases);
}
