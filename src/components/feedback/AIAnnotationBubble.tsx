import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Check, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAnnotationStore } from '../../store/useAnnotationStore';
import { useStardustStore } from '../../store/useStardustStore';
import type { Message } from '../../store/useChatStore';
import { useAuthStore } from '../../store/useAuthStore';
import { AI_COMPANION_VISUALS } from '../../constants/aiCompanionVisuals';
import { normalizeAiCompanionMode } from '../../lib/aiCompanion';
import momoBubbleAvatar from '../../assets/ai-companions/momo-bubble.png';
import { playSound } from '../../services/sound/soundService';

const SAGE_GREEN_DEEP = '#5F7A63';
const SEND_BUTTON_BG = 'rgba(144.67, 212.06, 122.21, 0.20)';
const SEND_BUTTON_SHADOW = '0px 2px 2px #C8C8C8';

interface AIAnnotationBubbleProps {
  relatedMessage?: Message; // 关联的消息对象，用于创建珍藏
  onCondense?: (emojiChar?: string) => void; // 凝结按钮点击回调，传递emoji用于动画
}

interface SuggestionAcceptFlowParams {
  annotationId: string;
  suggestion: NonNullable<ReturnType<typeof useAnnotationStore.getState>['currentAnnotation']>['suggestion'];
  isSuggestionAccepted: boolean;
  navigate: (path: string) => void;
  setPendingSuggestionIntent: ReturnType<typeof useAnnotationStore.getState>['setPendingSuggestionIntent'];
  recordSuggestionOutcome: (annotationId: string, accepted: boolean) => Promise<void>;
  handleCondense: () => Promise<void>;
  markSuggestionAccepted: () => void;
  emitEvent?: (event: Event) => boolean;
}

export async function runSuggestionAcceptFlow({
  annotationId,
  suggestion,
  isSuggestionAccepted,
  navigate,
  setPendingSuggestionIntent,
  recordSuggestionOutcome,
  handleCondense,
  markSuggestionAccepted,
  emitEvent = (event) => window.dispatchEvent(event),
}: SuggestionAcceptFlowParams): Promise<boolean> {
  if (!suggestion || isSuggestionAccepted) return false;

  if (suggestion.type === 'activity' && suggestion.activityName) {
    setPendingSuggestionIntent({
      type: 'activity',
      annotationId,
      activityName: suggestion.activityName,
      createdAt: Date.now(),
    });
    navigate('/chat');
    markSuggestionAccepted();
  } else if (suggestion.type === 'todo' && suggestion.todoId) {
    const decomposeSteps = Array.isArray(suggestion.decomposeSteps)
      ? suggestion.decomposeSteps
        .map((step) => ({
          title: String(step.title || '').trim(),
          suggestedDuration: Math.min(90, Math.max(5, Number(step.durationMinutes) || 15)),
        }))
        .filter((step) => step.title)
      : undefined;
    setPendingSuggestionIntent({
      type: 'todo',
      annotationId,
      todoId: suggestion.todoId,
      todoTitle: suggestion.todoTitle,
      createdAt: Date.now(),
      decomposeSteps: decomposeSteps && decomposeSteps.length > 0 ? decomposeSteps : undefined,
    });
    navigate('/growth');
    emitEvent(new CustomEvent('suggestion-highlight-todo', {
      detail: { todoId: suggestion.todoId },
    }));
    markSuggestionAccepted();
  } else {
    return false;
  }

  await recordSuggestionOutcome(annotationId, true);
  await handleCondense();
  return true;
}

/**
 * AI 批注气泡组件
 * 
 * 特点：
 * - 屏幕右侧边缘显示
 * - 毛玻璃背景效果
 * - 8秒后自动消失
 * - 点击可提前关闭
 * - 悬停暂停计时
 * - 支持【凝结】按钮将批注保存为珍藏
 */
export const AIAnnotationBubble: React.FC<AIAnnotationBubbleProps> = ({
  relatedMessage,
  onCondense,
}) => {
  const {
    currentAnnotation,
    dismissAnnotation,
    recordSuggestionOutcome,
    setPendingSuggestionIntent,
  } = useAnnotationStore();
  const { hasStardust, createStardust, isGenerating } = useStardustStore();
  const aiMode = useAuthStore((state) => state.preferences.aiMode);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const [progress, setProgress] = useState(100);
  const [isCondensed, setIsCondensed] = useState(false);
  const [isSuggestionAccepted, setIsSuggestionAccepted] = useState(false);
  const lastAnnotationIdRef = useRef<string | null>(null);
  const [supportsHover, setSupportsHover] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  });
  const currentModeVisual = AI_COMPANION_VISUALS[normalizeAiCompanionMode(aiMode)];
  const bubbleAvatar = normalizeAiCompanionMode(aiMode) === 'momo'
    ? momoBubbleAvatar
    : currentModeVisual.avatar;
  const suggestion = currentAnnotation?.suggestion;

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    const syncHoverCapability = (event?: MediaQueryListEvent) => {
      const nextSupportsHover = event?.matches ?? mediaQuery.matches;
      setSupportsHover(nextSupportsHover);
      if (!nextSupportsHover) {
        setIsHovered(false);
      }
    };

    syncHoverCapability();
    mediaQuery.addEventListener('change', syncHoverCapability);

    return () => {
      mediaQuery.removeEventListener('change', syncHoverCapability);
    };
  }, []);

  // 当批注变化时，重置进度并播放水滴声
  useEffect(() => {
    if (currentAnnotation) {
      playSound('waterDrop');
      setProgress(100);
      setIsCondensed(false);
      setIsSuggestionAccepted(currentAnnotation.suggestionAccepted === true);
      lastAnnotationIdRef.current = null;
    } else {
      setProgress(100);
      setIsHovered(false);
      lastAnnotationIdRef.current = null;
    }
  }, [currentAnnotation?.id]);

  // 检查关联消息是否已有珍藏
  useEffect(() => {
    if (relatedMessage?.id) {
      setIsCondensed(hasStardust(relatedMessage.id));
    }
  }, [relatedMessage?.id, hasStardust]);

  // 处理进度倒计时
  useEffect(() => {
    if (!currentAnnotation || (supportsHover && isHovered)) return;

    const displayDuration = currentAnnotation.displayDuration || 8000;
    const isNewAnnotation = lastAnnotationIdRef.current !== currentAnnotation.id;
    const startProgress = isNewAnnotation ? 100 : progress;
    const remainingDuration = Math.max(0, (startProgress / 100) * displayDuration);
    const endTime = Date.now() + remainingDuration;
    lastAnnotationIdRef.current = currentAnnotation.id;

    const updateProgress = () => {
      const remaining = Math.max(0, endTime - Date.now());
      setProgress((remaining / displayDuration) * 100);
    };

    updateProgress();
    const timer = window.setInterval(updateProgress, 100);

    return () => clearInterval(timer);
  }, [currentAnnotation?.id, isHovered, supportsHover]);

  // 当进度为 0 时关闭批注（避免在渲染过程中调用 setState）
  const handleDismiss = useCallback(() => {
    if (currentAnnotation?.suggestion && !isSuggestionAccepted) {
      void recordSuggestionOutcome(currentAnnotation.id, false);
    }
    dismissAnnotation();
  }, [currentAnnotation, dismissAnnotation, isSuggestionAccepted, recordSuggestionOutcome]);

  useEffect(() => {
    if (progress <= 0 && currentAnnotation) {
      handleDismiss();
    }
  }, [progress, currentAnnotation, handleDismiss]);

  // 从批注内容中提取 emoji（覆盖组合 emoji / 旗帜 / keycap）
  const extractEmojiFromContent = (content: string): string | undefined => {
    const emojiRegex = /(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?)*)/gu;
    const matches = content.match(emojiRegex);
    return matches && matches.length > 0 ? matches[0] : undefined;
  };

  // 处理凝结按钮点击
  const handleCondense = async () => {
    if (!relatedMessage || !currentAnnotation || isCondensed || isGenerating) return;

    // 从批注内容中提取emoji
    const emojiChar = extractEmojiFromContent(currentAnnotation.content);

    // 调用外部回调（用于触发动画等），传递emoji
    onCondense?.(emojiChar);

    // 创建珍藏
    await createStardust({
      messageId: relatedMessage.id,
      message: currentAnnotation.content,
      userRawContent: relatedMessage.content,
      emojiChar, // 传递提取的emoji
      alienName: currentModeVisual.name,
    });

    setIsCondensed(true);
  };

  // 处理建议按钮点击
  const handleSuggestionAccept = useCallback(async () => {
    if (!currentAnnotation?.suggestion) return;
    await runSuggestionAcceptFlow({
      annotationId: currentAnnotation.id,
      suggestion: currentAnnotation.suggestion,
      isSuggestionAccepted,
      navigate,
      setPendingSuggestionIntent,
      recordSuggestionOutcome,
      handleCondense,
      markSuggestionAccepted: () => setIsSuggestionAccepted(true),
    });
  }, [
    currentAnnotation,
    isSuggestionAccepted,
    navigate,
    setPendingSuggestionIntent,
    recordSuggestionOutcome,
    handleCondense,
  ]);

  // 如果没有批注，不渲染
  if (!currentAnnotation) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 100, opacity: 0 }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 25
        }}
        data-stardust-bubble
        className="pointer-events-none fixed top-[20%] z-[120]"
        style={{
          right: 'max(12px, calc((100vw - 960px) / 2 + 12px))',
          width: 'min(20rem, calc(100vw - 24px))',
        }}
        onMouseEnter={() => supportsHover && setIsHovered(true)}
        onMouseLeave={() => supportsHover && setIsHovered(false)}
      >
        {/* 毛玻璃气泡 */}
        <div
          className="pointer-events-auto relative rounded-2xl border border-white/60 p-4 pr-10 shadow-xl backdrop-blur-xl"
          style={{
            background:
              'linear-gradient(135deg, rgba(250,245,255,0.94) 0%, rgba(237,233,254,0.90) 44%, rgba(216,180,254,0.76) 100%)',
            boxShadow: '0 14px 36px rgba(126, 34, 206, 0.18), inset 0 1px 0 rgba(255,255,255,0.72)',
          }}
        >
          {/* 关闭按钮 */}
          <button
            onClick={handleDismiss}
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/55 text-violet-500 shadow-sm transition-colors hover:bg-white/80"
          >
            <X size={14} />
          </button>

          {/* 外星人头像（放大并半悬浮到气泡外） */}
          <div className="pointer-events-none absolute -left-8 -top-8 h-16 w-16 md:h-20 md:w-20">
            <img
              src={bubbleAvatar}
              alt={`${currentModeVisual.name} avatar`}
              className="h-full w-full object-contain drop-shadow-lg"
            />
          </div>

          {/* 批注内容 */}
          <div className="min-w-0 pl-8">
            <p className="text-sm leading-relaxed text-violet-950/85">
              {currentAnnotation.content}
            </p>
          </div>

          {/* 建议模式按钮 */}
          {suggestion && !isSuggestionAccepted && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
               onClick={() => { void handleSuggestionAccept(); }}
              className="mt-3 w-full flex items-center justify-center space-x-2 py-2 px-4
                         text-white text-sm font-medium rounded-full
                         transition-all duration-300"
              style={{
                background: 'linear-gradient(135deg, rgba(168,85,247,0.30) 0%, rgba(139,92,246,0.24) 50%, rgba(217,70,239,0.20) 100%)',
                boxShadow: '0px 2px 8px rgba(168,85,247,0.22)',
                color: '#7c3aed',
                border: '1px solid rgba(168,85,247,0.28)',
              }}
            >
              <Play size={16} />
              <span>{suggestion.actionLabel}</span>
            </motion.button>
          )}

          {/* 建议已接受状态 */}
          {suggestion && isSuggestionAccepted && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-3 flex items-center justify-center space-x-2 py-2 px-4
                         bg-gray-100 text-gray-500 text-sm font-medium rounded-full"
            >
              <Check size={16} className="text-green-500" />
              <span>{t('annotation_suggestion_started')}</span>
            </motion.div>
          )}

          {/* 凝结按钮（非建议模式） */}
          {!suggestion && relatedMessage && !isCondensed && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              onClick={handleCondense}
              disabled={isGenerating}
              className="mt-3 flex w-full items-center justify-center space-x-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, rgba(168,85,247,0.30) 0%, rgba(139,92,246,0.24) 50%, rgba(217,70,239,0.20) 100%)',
                boxShadow: '0px 2px 8px rgba(168,85,247,0.22)',
                color: '#7c3aed',
                border: '1px solid rgba(168,85,247,0.28)',
              }}
            >
              {isGenerating ? (
                <>
                  <div
                    className="h-4 w-4 animate-spin rounded-full border-2 border-current/25 border-t-current"
                    aria-hidden="true"
                  />
                  <span>{t('annotation_condensing')}</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>{t('annotation_condense')}</span>
                </>
              )}
            </motion.button>
          )}

          {/* 已凝结状态（非建议模式） */}
          {!suggestion && isCondensed && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-3 flex items-center justify-center space-x-2 py-2 px-4
                         bg-gray-100 text-gray-500 text-sm font-medium rounded-full"
            >
              <Check size={16} className="text-green-500" />
              <span>{t('annotation_condensed')}</span>
            </motion.div>
          )}

          {/* 进度条 */}
          <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden rounded-b-2xl bg-white/45">
            <motion.div
              className="h-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-purple-500"
              style={{ width: `${progress}%` }}
              transition={{ duration: 0 }}
            />
          </div>

          {/* 悬停提示 */}
          {supportsHover && isHovered && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-xs text-gray-500 whitespace-nowrap"
            >
              {t('annotation_hover_pause')}
            </motion.div>
          )}
        </div>

        {/* 装饰性光晕 */}
        <div
          className="pointer-events-none absolute -inset-1 -z-10 rounded-2xl bg-gradient-to-r from-violet-400/35 via-fuchsia-300/25 to-purple-500/30 blur-xl"
          style={{
            animation: 'pulse 3s ease-in-out infinite',
          }}
        />
      </motion.div>
    </AnimatePresence>
  );
};

export default AIAnnotationBubble;
