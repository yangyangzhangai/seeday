import React from 'react';
import { motion } from 'framer-motion';

interface StardustEmojiProps {
  emoji: string;                    // Emoji字符
  onClick?: (e?: React.MouseEvent) => void;  // 点击回调
  size?: 'sm' | 'md' | 'lg';       // 尺寸
  isError?: boolean;               // 是否显示错误状态（红色感叹号）
  className?: string;
}

/**
 * 星尘珍藏Emoji组件
 * 
 * 展示在消息左下角的外挂Emoji图标
 * - 40pt显示区域，44pt点击热区
 * - 轻微呼吸动画（透明度变化）
 * - 点击时缩放反馈
 * - 支持错误状态显示
 */
export const StardustEmoji: React.FC<StardustEmojiProps> = ({
  emoji,
  onClick,
  size = 'md',
  isError = false,
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-5 h-5 text-base',
    md: 'w-6 h-6 text-lg',
    lg: 'w-8 h-8 text-2xl',
  };

  return (
    <motion.button
      onClick={(e) => {
        e.stopPropagation(); // 阻止事件冒泡
        onClick?.(e);
      }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className={`
        relative flex items-center justify-center
        ${sizeClasses[size]}
        cursor-pointer
        transition-all duration-200
        filter drop-shadow-sm
        hover:drop-shadow-md
        ${className}
      `}
      title="点击查看珍藏"
    >
      {/* Emoji字符 */}
      <motion.span
        className="leading-none"
        animate={{
          opacity: [0.85, 1, 0.85],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.5))',
        }}
      >
        {emoji}
      </motion.span>

      {/* 错误状态指示器 */}
      {isError && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full 
                     flex items-center justify-center text-white text-[8px] font-bold"
        >
          !
        </motion.span>
      )}

      {/* 悬停光晕 */}
      <motion.div
        className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-400/20 to-blue-400/20 blur-sm -z-10"
        initial={{ opacity: 0, scale: 0.8 }}
        whileHover={{ opacity: 1, scale: 1.2 }}
        transition={{ duration: 0.2 }}
      />
    </motion.button>
  );
};

/**
 * StardustEmoji 容器组件
 * 用于包裹在消息卡片中，处理布局
 */
interface StardustEmojiContainerProps {
  children: React.ReactNode;
  hasDuration?: boolean;  // 是否有耗时信息显示
}

export const StardustEmojiContainer: React.FC<StardustEmojiContainerProps> = ({
  children,
  hasDuration = true,
}) => {
  return (
    <div className={`
      flex items-center space-x-2
      ${hasDuration ? '' : 'mt-1'}
    `}>
      {children}
    </div>
  );
};

export default StardustEmoji;
