// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/chat/README.md
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../api/supabase';
import { getSupabaseSession } from '../lib/supabase-utils';
import { fromDbStardust, toDbStardust } from '../lib/dbMappers';
import { useChatStore } from './useChatStore';
import { PERSIST_KEYS, LEGACY_PERSIST_KEYS } from './persistKeys';
import { readLegacyPersistedState } from './persistMigrationHelpers';
import type {
  StardustMemory,
  CreateStardustRequest,
  SyncStatus
} from '../types/stardust';

interface StardustStore {
  // State
  memories: StardustMemory[];
  memoryIdByMessageId: Record<string, string>;
  lastFetchedAt: number | null;
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
  clear: () => void;

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

function toDbStardustForUser(memory: StardustMemory, userId: string): Record<string, unknown> {
  return {
    ...toDbStardust({ ...memory, userId }),
    user_id: userId,
  };
}

/**
 * 从批注内容中提取 emoji（覆盖组合 emoji / 旗帜 / keycap）
 */
function extractEmojiFromAnnotation(content: string): string | null {
  const emojiRegex = /(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?)*)/gu;
  const matches = content.match(emojiRegex);
  return matches && matches.length > 0 ? matches[0] : null;
}

export const useStardustStore = create<StardustStore>()(
  persist(
    (set, get) => ({
      memories: [],
      memoryIdByMessageId: {},
      lastFetchedAt: null,
      isGenerating: false,
      generationError: null,

      /**
       * 创建星尘珍藏
       * Local-First策略：先写入本地，再异步同步到云端
       */
      createStardust: async (request: CreateStardustRequest) => {
        const { messageId, message, userRawContent, emojiChar, alienName } = request;

        // 检查是否已存在
        if (get().hasStardust(messageId)) {
          console.log('[Stardust] 该消息已有珍藏，跳过');
          return null;
        }

        set({ isGenerating: true, generationError: null });

        try {
          const finalEmoji = emojiChar || extractEmojiFromAnnotation(message) || DEFAULT_EMOJI;

          const session = await getSupabaseSession();
          const userId = session?.user?.id ?? '';

          // 创建珍藏对象
          const stardust: StardustMemory = {
            id: uuidv4(),
            messageId,
            userId,
            message,
            emojiChar: finalEmoji,
            userRawContent,
            createdAt: Date.now(),
            alienName: alienName?.trim() || 'Van',
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
                ...toDbStardustForUser(stardust, session.user.id),
              }]);

              if (error) {
                throw error;
              }

              // 同步成功，更新状态
              set((state) => ({
                memories: state.memories.map((m) =>
                  m.id === stardust.id
                    ? { ...m, userId: session.user.id, syncStatus: 'synced' as SyncStatus }
                    : m
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
        if (memoryId) {
          return state.memories.find((memory) => memory.id === memoryId);
        }

        // 兼容旧版持久化数据（仅有 memories，没有 memoryIdByMessageId）
        return state.memories.find((memory) => memory.messageId === messageId);
      },

      /**
       * 检查消息是否已有珍藏
       */
      hasStardust: (messageId: string) => {
        const state = get();
        return !!state.memoryIdByMessageId[messageId] || state.memories.some((memory) => memory.messageId === messageId);
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
              ...toDbStardustForUser(stardust, session.user.id),
            }], {
              onConflict: 'id',
            });

            if (!error) {
              set((state) => ({
                memories: state.memories.map((m) =>
                  m.id === stardust.id
                    ? { ...m, userId: session.user.id, syncStatus: 'synced' as SyncStatus }
                    : m
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

      clear: () => {
        set({
          memories: [],
          memoryIdByMessageId: {},
          lastFetchedAt: null,
          isGenerating: false,
          generationError: null,
        });
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
          const cloudMemories: StardustMemory[] = data.map(fromDbStardust);

          // Merge instead of blind replace:
          // keep local-only memories (especially pending sync items) so emoji won't disappear
          // when cloud replication/API responds late.
          set((state) => {
            const cloudMessageIds = new Set(cloudMemories.map((m) => m.messageId));
            const localOnly = state.memories.filter(
              (m) =>
                !cloudMessageIds.has(m.messageId)
                && (m.syncStatus === 'pending_sync' || !m.userId || m.userId === session.user.id),
            );
            const memories = [...cloudMemories, ...localOnly];
            return {
              memories,
              memoryIdByMessageId: buildMemoryIdByMessageId(memories),
              lastFetchedAt: Date.now(),
            };
          });
          console.log(`[Stardust] 已拉取 ${cloudMemories.length} 条珍藏`);
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
      name: PERSIST_KEYS.stardust,
      partialize: (state) => ({
        memories: state.memories,
        memoryIdByMessageId: state.memoryIdByMessageId,
        lastFetchedAt: state.lastFetchedAt,
      }),
      merge: (persistedState, currentState) => {
        const legacyState = readLegacyPersistedState<StardustStore>(LEGACY_PERSIST_KEYS.stardust);
        const merged = {
          ...currentState,
          ...(legacyState || {}),
          ...(persistedState as Partial<StardustStore>),
        };

        return {
          ...merged,
          memoryIdByMessageId: buildMemoryIdByMessageId(merged.memories || []),
        } as StardustStore;
      },
    }
  )
);

// 导出辅助函数
export { DEFAULT_EMOJI, extractEmojiFromAnnotation };
