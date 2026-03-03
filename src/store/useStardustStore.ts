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

/**
 * 生成AI Prompt用于选择Emoji
 */
export function generateEmojiPrompt(message: string, userRawContent?: string): string {
  return `Based on the following user activity and AI annotation, choose a single Unicode Emoji character that best represents this emotional moment.

User Activity/Mood: ${userRawContent || 'None'}
AI Annotation: ${message}

Rules:
1. Choose an emoji with clear, specific imagery (e.g. 🌙🌟🫧🕊️) and avoid generic basic symbols (e.g. ❤️😊).
2. ONLY output ONE single Emoji character. No markdown, no explanations, no other text.
3. Choose a symbol that evokes a poetic and visual feeling.

Output: exactly one string character.`;
}

/**
 * 从AI响应中提取Emoji字符
 * 处理各种可能的格式：带解释、带引号、多空格等
 */
function extractEmojiFromResponse(content: string | null | undefined): string | null {
  // 处理 null/undefined/空字符串
  if (!content || typeof content !== 'string') {
    console.warn('[Stardust] extractEmojiFromResponse: 内容为空或非字符串');
    return null;
  }

  // 去除空白字符
  const trimmed = content.trim();

  if (!trimmed) {
    console.warn('[Stardust] extractEmojiFromResponse: trim后内容为空');
    return null;
  }

  // Emoji Unicode 范围正则 (常用Emoji范围)
  // 匹配单个Emoji或Emoji组合
  const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{231A}-\u{231B}]|[\u{23E9}-\u{23F3}]|[\u{23F8}-\u{23FA}]|[\u{25AA}-\u{25AB}]|[\u{25B6}]|[\u{25C0}]|[\u{25FB}-\u{25FE}]|[\u{2614}-\u{2615}]|[\u{2648}-\u{2653}]|[\u{267F}]|[\u{2693}]|[\u{26A1}]|[\u{26AA}-\u{26AB}]|[\u{26BD}-\u{26BE}]|[\u{26C4}-\u{26C5}]|[\u{26D4}]|[\u{26EA}]|[\u{26F2}-\u{26F3}]|[\u{26F5}]|[\u{26FA}]|[\u{26FD}]|[\u{2702}]|[\u{2705}]|[\u{2708}-\u{270D}]|[\u{270F}]|[\u{2712}]|[\u{2714}]|[\u{2716}]|[\u{271D}]|[\u{2721}]|[\u{2728}]|[\u{2733}-\u{2734}]|[\u{2744}]|[\u{2747}]|[\u{274C}]|[\u{274E}]|[\u{2753}-\u{2755}]|[\u{2757}]|[\u{2763}-\u{2764}]|[\u{2795}-\u{2797}]|[\u{27A1}]|[\u{27B0}]|[\u{27BF}]|[\u{2934}-\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{2B1B}-\u{2B1C}]|[\u{2B50}]|[\u{2B55}]|[\u{3030}]|[\u{303D}]|[\u{3297}]|[\u{3299}]/gu;

  // 尝试提取第一个Emoji
  const matches = trimmed.match(emojiRegex);
  if (matches && matches.length > 0) {
    return matches[0];
  }

  // 如果没有匹配到标准Emoji范围，检查是否整个内容就是一个字符
  // 去除引号、括号等常见包装字符
  const cleaned = trimmed.replace(/^["'`（(「【『]+|["'`）)」】』]+$/g, '');

  // 如果清理后是一个或两个字符（考虑组合Emoji），尝试返回
  if (cleaned.length > 0 && cleaned.length <= 8) {
    // 进一步检查是否包含可见字符（非控制字符）
    const hasVisibleChar = [...cleaned].some(char => {
      const code = char.codePointAt(0);
      return code && code > 0x1F && code !== 0x20 && code !== 0xA0;
    });

    if (hasVisibleChar) {
      return cleaned;
    }
  }

  console.warn('[Stardust] extractEmojiFromResponse: 无法从内容中提取Emoji:', trimmed.substring(0, 50));
  return null;
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
            isGenerating: false,
          }));

          // 1.5 更新ChatStore中的消息，添加stardust关联
          try {
            const chatStore = useChatStore.getState();
            const updatedMessages = chatStore.messages.map((msg) =>
              msg.id === messageId
                ? { ...msg, stardustId: stardust.id, stardustEmoji: stardust.emojiChar }
                : msg
            );
            useChatStore.setState({ messages: updatedMessages });
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
        return get().memories.find((m) => m.messageId === messageId);
      },

      /**
       * 检查消息是否已有珍藏
       */
      hasStardust: (messageId: string) => {
        return get().memories.some((m) => m.messageId === messageId);
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

          set({ memories });
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
