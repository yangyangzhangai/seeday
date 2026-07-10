// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/chat/README.md
import type { Message } from '../../../store/useChatStore';

export type EventCardImageSlot = 'imageUrl' | 'imageUrl2';

export function getVisibleEventCardImageSlots(
  message: Pick<Message, 'imageUrl' | 'imageUrl2'>,
): EventCardImageSlot[] {
  const slots: EventCardImageSlot[] = [];
  if (message.imageUrl) slots.push('imageUrl');
  if (message.imageUrl2) slots.push('imageUrl2');
  return slots;
}
