import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../api/supabase';
import { getSupabaseSession } from '../lib/supabase-utils';
import { useChatStore } from './useChatStore';
import { callStardustAPI } from '../api/client';
import type {
  StardustMemory,
  CreateStardustRequest,
  SyncStatus
} from '../types/stardust';

interface StardustStore {
  // State
  memories: StardustMemory[];
  memoryIdByMessageId: Record<string, string>;
  isGenerating: boolean;
  generationError: string | null;

  // Actions
  createStardust: (request: CreateStardustRequest) => Promise<StardustMemory | null>;
  updateEmoji: (id: string, emojiChar: string) => Promise<void>;
  deleteStardust: (id: string) => Promise<void>;
  getStardustByMessageId: (messageId: string) => StardustMemory | undefined;
  hasStardust: (messageId: string) => boolean;

  // Sync
  syncPendingStardusts: () => Promise<void>;
  fetchStardusts: () => Promise<void>;
  getPendingSyncCount: () => number;

  // Generation state
  setGenerating: (isGenerating: boolean) => void;
  setGenerationError: (error: string | null) => void;
}

/**
 * 创建默认Emoji（兜底方案）
 */
const DEFAULT_EMOJI = '✨';

function buildMemoryIdByMessageId(memories: StardustMemory[]): Record<string, string> {
  return memories.reduce<Record<string, string>>((acc, memory) => {
    acc[memory.messageId] = memory.id;
    return acc;
  }, {});
}

/**
 * 调用 AI 生成 Emoji（通过 /api/stardust serverless 中转，不暴露密钥）
 */
async function generateEmojiWithAI(userRawContent: string, message: string): Promise<string> {
  try {
    console.log('[Stardust] 开始通过 serverless 生成 Emoji...');
    const result = await callStardustAPI({ userRawContent, message });
    console.log('[Stardust] Emoji 生成成功:', result.emojiChar);
    return result.emojiChar || DEFAULT_EMOJI;
  } catch (error) {
    console.error('[Stardust] generateEmojiWithAI 失败，使用默认 Emoji:', error);
    return DEFAULT_EMOJI;
  }
}

export const useStardustStore = create<StardustStore>()(
  persist(
    (set, get) => ({
      memories: [],
      memoryIdByMessageId: {},
      isGenerating: false,
      generationError: null,

      /**
       * 创建星尘珍藏
       * Local-First策略：先写入本地，再异步同步到云端
       */
      createStardust: async (request: CreateStardustRequest) => {
        const { messageId, message, userRawContent, emojiChar } = request;

        // 检查是否已存在
        if (get().hasStardust(messageId)) {
          console.log('[Stardust] 该消息已有珍藏，跳过');
          return null;
        }

        set({ isGenerating: true, generationError: null });

        try {
          // 如果没有提供emoji，调用AI生成
          let finalEmoji = emojiChar;
          if (!finalEmoji) {
            finalEmoji = await generateEmojiWithAI(userRawContent, message);
          }

          const session = await getSupabaseSession();
          const userId = session?.user?.id || 'anonymous';

          // 创建珍藏对象
          const stardust: StardustMemory = {
            id: uuidv4(),
            messageId,
            userId,
            message,
            emojiChar: finalEmoji,
            userRawContent,
            createdAt: Date.now(),
            alienName: 'T.S',
            syncStatus: 'pending_sync',
          };

          // 1. 先写入本地状态（立即响应UI）
          set((state) => ({
            memories: [...state.memories, stardust],
            memoryIdByMessageId: {
              ...state.memoryIdByMessageId,
              [stardust.messageId]: stardust.id,
            },
            isGenerating: false,
          }));

          // 1.5 更新ChatStore中的消息，添加stardust关联
          try {
            const chatStore = useChatStore.getState();
            chatStore.attachStardustToMessage(messageId, stardust.id, stardust.emojiChar);
          } catch (e) {
            console.error('[Stardust] 更新ChatStore失败:', e);
          }

          // 2. 异步提交到服务器
          if (session) {
            try {
              const { error } = await supabase.from('stardust_memories').insert([{
                id: stardust.id,
                message_id: stardust.messageId,
                user_id: stardust.userId,
                message: stardust.message,
                emoji_char: stardust.emojiChar,
                user_raw_content: stardust.userRawContent,
                created_at: new Date(stardust.createdAt).toISOString(),
                alien_name: stardust.alienName,
              }]);

              if (error) {
                throw error;
              }

              // 同步成功，更新状态
              set((state) => ({
                memories: state.memories.map((m) =>
                  m.id === stardust.id ? { ...m, syncStatus: 'synced' as SyncStatus } : m
                ),
              }));
            } catch (syncError) {
              console.error('[Stardust] 同步到服务器失败:', syncError);
              // 保持pending_sync状态，下次自动重试
            }
          }

          return stardust;
        } catch (error) {
          console.error('[Stardust] 创建珍藏失败:', error);
          set({
            isGenerating: false,
            generationError: error instanceof Error ? error.message : '创建失败'
          });
          return null;
        }
      },

      /**
       * 更新Emoji（用于竞态场景兜底或重试）
       */
      updateEmoji: async (id: string, emojiChar: string) => {
        set((state) => ({
          memories: state.memories.map((m) =>
            m.id === id ? { ...m, emojiChar, syncStatus: 'pending_sync' as SyncStatus } : m
          ),
        }));

        // 同步到服务器
        const session = await getSupabaseSession();
        if (session) {
          try {
            await supabase
              .from('stardust_memories')
              .update({ emoji_char: emojiChar })
              .eq('id', id)
              .eq('user_id', session.user.id);

            set((state) => ({
              memories: state.memories.map((m) =>
                m.id === id ? { ...m, syncStatus: 'synced' as SyncStatus } : m
              ),
            }));
          } catch (error) {
            console.error('[Stardust] 更新Emoji失败:', error);
          }
        }
      },

      /**
       * 删除珍藏
       */
      deleteStardust: async (id: string) => {
        set((state) => ({
          memories: state.memories.filter((m) => m.id !== id),
          memoryIdByMessageId: buildMemoryIdByMessageId(
            state.memories.filter((m) => m.id !== id)
          ),
        }));

        // 同步删除到服务器
        const session = await getSupabaseSession();
        if (session) {
          try {
            await supabase
              .from('stardust_memories')
              .delete()
              .eq('id', id)
              .eq('user_id', session.user.id);
          } catch (error) {
            console.error('[Stardust] 删除同步失败:', error);
          }
        }
      },

      /**
       * 根据消息ID获取珍藏
       */
      getStardustByMessageId: (messageId: string) => {
        const state = get();
        const memoryId = state.memoryIdByMessageId[messageId];
        if (!memoryId) return undefined;
        return state.memories.find((memory) => memory.id === memoryId);
      },

      /**
       * 检查消息是否已有珍藏
       */
      hasStardust: (messageId: string) => {
        return !!get().memoryIdByMessageId[messageId];
      },

      /**
       * 同步所有待同步的珍藏
       * 在网络恢复或应用启动时调用
       */
      syncPendingStardusts: async () => {
        const pending = get().memories.filter((m) => m.syncStatus === 'pending_sync');
        if (pending.length === 0) return;

        const session = await getSupabaseSession();
        if (!session) return;

        for (const stardust of pending) {
          try {
            const { error } = await supabase.from('stardust_memories').upsert([{
              id: stardust.id,
              message_id: stardust.messageId,
              user_id: stardust.userId,
              message: stardust.message,
              emoji_char: stardust.emojiChar,
              user_raw_content: stardust.userRawContent,
              created_at: new Date(stardust.createdAt).toISOString(),
              alien_name: stardust.alienName,
            }]);

            if (!error) {
              set((state) => ({
                memories: state.memories.map((m) =>
                  m.id === stardust.id ? { ...m, syncStatus: 'synced' as SyncStatus } : m
                ),
                memoryIdByMessageId: {
                  ...state.memoryIdByMessageId,
                  [stardust.messageId]: stardust.id,
                },
              }));
            }
          } catch (error) {
            console.error(`[Stardust] 同步失败 ${stardust.id}:`, error);
          }
        }
      },

      /**
       * 获取待同步数量
       */
      getPendingSyncCount: () => {
        return get().memories.filter((m) => m.syncStatus === 'pending_sync').length;
      },

      /**
       * 从云端拉取星尘珍藏（跨设备同步）
       * 注意：调用前应先执行 syncPendingStardusts，确保本地 pending 已推送
       */
      fetchStardusts: async () => {
        const session = await getSupabaseSession();
        if (!session) return;

        const { data, error } = await supabase
          .from('stardust_memories')
          .select('*')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('[Stardust] 拉取珍藏失败:', error);
          return;
        }

        if (data) {
          const memories: StardustMemory[] = data.map((row: any) => ({
            id: row.id,
            messageId: row.message_id,
            userId: row.user_id,
            message: row.message,
            emojiChar: row.emoji_char,
            userRawContent: row.user_raw_content,
            createdAt: new Date(row.created_at).getTime(),
            alienName: row.alien_name,
            syncStatus: 'synced' as SyncStatus,
          }));

          set({
            memories,
            memoryIdByMessageId: buildMemoryIdByMessageId(memories),
          });
          console.log(`[Stardust] 已拉取 ${memories.length} 条珍藏`);
        }
      },

      /**
       * 设置生成状态
       */
      setGenerating: (isGenerating: boolean) => {
        set({ isGenerating });
      },

      /**
       * 设置生成错误
       */
      setGenerationError: (error: string | null) => {
        set({ generationError: error });
      },
    }),
    {
      name: 'stardust-storage',
      partialize: (state) => ({
        memories: state.memories,
      }),
    }
  )
);

// 导出辅助函数
export { generateEmojiWithAI, DEFAULT_EMOJI };
