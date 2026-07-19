// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/chat/README.md
export type ChatImageSlot = 'imageUrl' | 'imageUrl2';

export function resolveChatImageStoragePath(messageId: string, slot: ChatImageSlot): string {
  return slot === 'imageUrl' ? `${messageId}.jpg` : `${messageId}-2.jpg`;
}
