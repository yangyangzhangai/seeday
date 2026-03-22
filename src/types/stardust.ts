/**
 * 星尘珍藏 (Stardust Memories) 类型定义
 * 
 * 用于管理用户保存的AI批注消息：
 * - 每条消息可珍藏为一个Emoji图标
 * - Local-First存储策略
 * - 支持离线同步补偿
 * 
 * @version 1.0.0
 */

export type SyncStatus = 'synced' | 'pending_sync' | 'error';

export interface StardustMemory {
  id: string;                      // 珍藏唯一标识
  
  // 关联信息
  messageId: string;               // 关联的消息/活动记录ID
  userId: string;                  // 用户唯一标识
  
  // 珍藏内容
  message: string;                 // 保存的AI批注原文
  emojiChar: string;               // AI生成的Unicode Emoji字符（如🫧）
  userRawContent: string;          // 用户原始记录内容（用于重试时重新作为Prompt输入）
  
  // 元数据
  createdAt: number;               // 保存时间戳
  alienName?: string;              // 外星人昵称（可选）
  alienAvatar?: string;            // 外星人头像URL（可选）
  
  // 同步状态（Local-First补偿机制）
  syncStatus: SyncStatus;          // synced / pending_sync / error
  lastSyncAttempt?: number;        // 上次同步尝试时间
  syncErrorCount?: number;         // 同步失败次数（用于重试策略）
  
  // 预留字段（未来扩展）
  order?: number;                  // 珍藏排序字段（多条珍藏时使用）
  collectionId?: string;           // 珍藏集合ID（星尘集功能）
}

// 创建珍藏请求
export interface CreateStardustRequest {
  messageId: string;
  message: string;
  userRawContent: string;
  emojiChar?: string;              // 可选，如未提供则使用默认✨
  alienName?: string;
}

// Emoji生成请求
export interface GenerateEmojiRequest {
  userRawContent: string;          // 用户原始记录内容
  message: string;                 // AI批注内容
}

// Emoji生成响应
export interface GenerateEmojiResponse {
  emojiChar: string;               // 生成的Unicode Emoji
  reasoning?: string;              // AI决策理由（调试用）
}

// 珍藏状态（用于组件状态管理）
export interface StardustState {
  memories: StardustMemory[];
  pendingSyncIds: string[];        // 待同步的珍藏ID列表
  isGenerating: boolean;           // 是否正在生成Emoji
  generationError: string | null;  // 生成错误信息
}

// 动画状态
export interface StardustAnimationState {
  isAnimating: boolean;
  sourceRect: DOMRect | null;      // 动画起点（气泡位置）
  targetRect: DOMRect | null;      // 动画终点（消息卡片位置）
  emojiChar: string | null;        // 当前动画的Emoji
}

// 珍藏卡片展示数据
export interface StardustCardData {
  emojiChar: string;
  message: string;
  alienName: string;
  createdAt: number;
  isLoading?: boolean;
  isError?: boolean;
}
