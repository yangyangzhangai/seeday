// DOC-DEPS: LLM.md -> docs/SUPABASE_PERSISTENCE_INVENTORY.md -> src/store/README.md
import { supabase } from '../api/supabase';
import type { Message } from './useChatStore.types';

const CLOUD_MESSAGE_BATCH_SIZE = 100;

export type MoodParentPartition = {
  validIds: Set<string>;
  orphanIds: Set<string>;
  unresolvedIds: Set<string>;
};

export type CloudMessageIdResult = {
  ids: Set<string>;
  complete: boolean;
  error?: unknown;
};

export function collectUniqueMessages(
  messages: Message[],
  dateCache: Record<string, Message[]>,
): Message[] {
  const byId = new Map<string, Message>();
  for (const message of [...messages, ...Object.values(dateCache).flat()]) {
    byId.set(message.id, message);
  }
  return Array.from(byId.values());
}

export function partitionMoodParentIds(
  moodIds: string[],
  localMessageIds: Set<string>,
  cloudResult: CloudMessageIdResult,
): MoodParentPartition {
  const validIds = new Set(moodIds.filter((id) => cloudResult.ids.has(id)));
  const orphanIds = new Set(
    cloudResult.complete
      ? moodIds.filter((id) => !localMessageIds.has(id) && !validIds.has(id))
      : [],
  );
  const unresolvedIds = new Set(
    moodIds.filter((id) => !validIds.has(id) && !orphanIds.has(id)),
  );
  return { validIds, orphanIds, unresolvedIds };
}

export async function fetchExistingCloudMessageIds(
  userId: string,
  messageIds: string[],
): Promise<CloudMessageIdResult> {
  const ids = new Set<string>();
  for (let index = 0; index < messageIds.length; index += CLOUD_MESSAGE_BATCH_SIZE) {
    const batch = messageIds.slice(index, index + CLOUD_MESSAGE_BATCH_SIZE);
    const { data, error } = await supabase
      .from('messages')
      .select('id')
      .eq('user_id', userId)
      .in('id', batch);
    if (error) return { ids, complete: false, error };
    for (const row of data ?? []) ids.add(row.id as string);
  }
  return { ids, complete: true };
}
