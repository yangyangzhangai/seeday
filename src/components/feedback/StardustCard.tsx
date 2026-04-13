import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import type { StardustCardData } from '../../types/stardust';

interface StardustCardProps {
  isOpen: boolean;
  data?: StardustCardData;
  position?: { x: number; y: number }; // 弹出位置（相对于视口）
  onClose: () => void;
  onRetry?: () => void; // 重试回调（用于错误状态）
}

/**
 * 星尘珍藏查看卡片
 * 
 * 特点：
 * - 毛玻璃背景效果（backdrop-blur）
 * - 从Emoji位置附近弹出
 * - 显示珍藏的完整信息
 * - 支持加载状态和错误状态
 * - 点击外部关闭
 */
export const StardustCard: React.FC<StardustCardProps> = ({
  isOpen,
  data,
  position,
  onClose,
  onRetry,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const { t } = useTranslation();

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // ESC键关闭
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setIsExpanded(false);
    }
  }, [isOpen, data?.createdAt]);

  // 计算卡片位置（优先显示在Emoji上方，空间不足则显示在下方）
  const getCardPosition = () => {
    if (!position) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

    const cardWidth = 280;
    const cardHeight = 150; // 预估高度
    const margin = 8;

    let top: number | string = position.y - cardHeight - margin;
    let left = position.x - cardWidth / 2;

    // 如果上方空间不足，显示在下方
    if (typeof top === 'number' && top < margin) {
      top = position.y + margin + 24; // 24是Emoji大致高度
    }

    // 边界检查（确保不超出视口）
    const viewportWidth = window.innerWidth;
    if (left < margin) left = margin;
    if (left + cardWidth > viewportWidth - margin) {
      left = viewportWidth - cardWidth - margin;
    }

    return { top, left };
  };

  const cardPos = getCardPosition();
  const cardTop = typeof cardPos.top === 'number' ? cardPos.top : 0;
  const positionY = position?.y || 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={cardRef}
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 10 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          style={{
            position: 'fixed',
            ...cardPos,
            zIndex: 100,
          }}
          className="w-[280px] max-w-[90vw]"
        >
          {/* 毛玻璃卡片 */}
          <div
            className="relative bg-white/80 backdrop-blur-lg rounded-2xl p-4 
                       shadow-2xl border border-white/50 overflow-hidden"
            style={{
              boxShadow: '0 8px 32px rgba(31, 38, 135, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.3)',
            }}
          >
            {/* 关闭按钮 */}
            <button
              onClick={onClose}
              className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center
                         text-gray-400 hover:text-gray-600 transition-colors rounded-full
                         hover:bg-gray-100/50"
            >
              <X size={16} />
            </button>

            {/* 加载状态 */}
            {!data && (
              <div className="flex flex-col items-center justify-center py-8 space-y-3">
                <Loader2 size={24} className="text-purple-500 animate-spin" />
                <span className="text-sm text-gray-500">{t('stardust_loading')}</span>
              </div>
            )}

            {/* 错误状态 */}
            {data?.isError && (
              <div className="flex flex-col items-center justify-center py-6 space-y-3">
                <AlertCircle size={32} className="text-red-400" />
                <p className="text-sm text-gray-600 text-center px-2">
                  {data.message || t('stardust_error_default')}
                </p>
                {onRetry && (
                  <button
                    onClick={onRetry}
                    className="flex items-center space-x-1 text-sm text-purple-600 
                               hover:text-purple-700 transition-colors"
                  >
                    <RefreshCw size={14} />
                    <span>{t('retry')}</span>
                  </button>
                )}
              </div>
            )}

            {/* 正常内容 */}
            {data && !data.isError && (
              <div className="space-y-3">
                {/* Emoji标题 */}
                <div className="flex items-start space-x-3">
                  <span className="text-3xl filter drop-shadow-sm">{data.emojiChar}</span>
                  <div className="flex-1 min-w-0 pt-1">
                    <p className="text-xs text-gray-500">
                      {t('stardust_from', { name: data.alienName, date: format(data.createdAt, 'MM-dd HH:mm') })}
                    </p>
                  </div>
                </div>

                {/* 消息内容 */}
                <div className="relative">
                  <p className={`text-sm text-gray-800 leading-relaxed ${isExpanded ? '' : 'line-clamp-4'}`}>
                    {data.message}
                  </p>
                  {data.message.length > 200 && (
                    <button
                      className="text-xs text-purple-600 hover:text-purple-700 mt-1"
                      onClick={() => setIsExpanded((prev) => !prev)}
                    >
                      {isExpanded ? t('report_section_collapse') : t('expand')}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 装饰性光晕 */}
            <div
              className="absolute -inset-1 bg-gradient-to-r from-purple-400/10 to-blue-400/10 
                         rounded-2xl blur-xl -z-10 pointer-events-none"
            />
          </div>

          {/* 指向Emoji的小三角 */}
          <div
            className="absolute w-3 h-3 bg-white/80 border-l border-t border-white/50
                       transform rotate-45 -z-10"
            style={{
              top: cardTop < positionY ? '100%' : '-6px',
              left: '50%',
              marginLeft: '-6px',
              marginTop: cardTop < positionY ? '-6px' : '0',
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StardustCard;
