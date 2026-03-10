// DOC-DEPS: LLM.md -> docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md -> src/features/chat/README.md
type ReclassifyKind = 'activity' | 'mood';

type ReclassifyRecentInputFn = (
  messageId: string,
  nextKind: ReclassifyKind,
) => Promise<void>;

type SetExpandedActionsIdFn = (next: string | null) => void;

export async function handleLatestMessageReclassify(
  messageId: string,
  nextKind: ReclassifyKind,
  reclassifyRecentInput: ReclassifyRecentInputFn,
  setExpandedActionsId: SetExpandedActionsIdFn,
): Promise<void> {
  await reclassifyRecentInput(messageId, nextKind);
  setExpandedActionsId(null);
}
