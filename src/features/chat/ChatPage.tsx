import { Fragment, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../store/useChatStore';
import { useTodoStore } from '../../store/useTodoStore';
import { useStardustStore } from '../../store/useStardustStore';
import { Activity, ChevronUp, Loader2 } from 'lucide-react';
import { formatDuration } from '../../lib/time';
import { format, isSameDay } from 'date-fns';
import { zhCN, enUS, it } from 'date-fns/locale';
import { StardustCard } from '../../components/feedback/StardustCard';
import type { StardustCardData } from '../../types/stardust';
import { useMoodStore } from '../../store/useMoodStore';
import { useShallow } from 'zustand/react/shallow';

// Sub-components
import { MessageItem } from './MessageItem';
import { MoodPickerModal } from './MoodPickerModal';
import { EditInsertModal } from './EditInsertModal';
import { ChatInputBar } from './ChatInputBar';

export const ChatPage = () => {
  const {
    messages, sendAutoRecognizedInput, fetchMessages, fetchOlderMessages, checkAndRefreshForNewDay,
    updateActivity, insertActivity, deleteActivity, endActivity, isLoading, isLoadingMore,
    hasMoreHistory, yesterdaySummary,
    hasInitialized, setHasInitialized, updateMessageDuration,
  } = useChatStore();
  const { activeTodoId, completeActiveTodo, todos } = useTodoStore();
  const getStardustByMessageId = useStardustStore(state => state.getStardustByMessageId);
  const [searchParams, setSearchParams] = useSearchParams();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [currentDuration, setCurrentDuration] = useState(0);
  const [moodPickerFor, setMoodPickerFor] = useState<string | null>(null);
  const [customMoodInput, setCustomMoodInput] = useState('');
  const [customLabelInput, setCustomLabelInput] = useState('');
  const [showCustomLabelInput, setShowCustomLabelInput] = useState(false);
  const [selectedMoodOpt, setSelectedMoodOpt] = useState<string | null>(null);
  const [moodPickerReadonly, setMoodPickerReadonly] = useState(false);
  const { t, i18n } = useTranslation();
  const [expandedActionsId, setExpandedActionsId] = useState<string | null>(null);

  const customLabelDefault = t('chat_custom_label_default');
  const isDefaultCustomLabel = (label: string) => !label || label === customLabelDefault || label === '自定义';

  const saveCustomLabel = (value: string) => {
    const next = value.trim() || customLabelDefault;
    setCustomLabelInput(next);
    if (moodPickerFor) {
      setCustomMoodLabel(moodPickerFor, next);
      const applied = !isDefaultCustomLabel(next);
      setCustomMoodApplied(moodPickerFor, applied);
      if (applied) setSelectedMoodOpt('__custom__');
    }
    setShowCustomLabelInput(false);
  };

  // Edit/Insert State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [insertingAfterId, setInsertingAfterId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');

  // Stardust Card State
  const [selectedStardust, setSelectedStardust] = useState<{
    data: StardustCardData;
    position: { x: number; y: number };
  } | null>(null);
  const {
    activityMood,
    setMood,
    customMoodLabel,
    setCustomMoodLabel,
    customMoodApplied,
    setCustomMoodApplied,
    moodNote,
    setMoodNote,
  } = useMoodStore(
    useShallow((state) => ({
      activityMood: state.activityMood,
      setMood: state.setMood,
      customMoodLabel: state.customMoodLabel,
      setCustomMoodLabel: state.setCustomMoodLabel,
      customMoodApplied: state.customMoodApplied,
      setCustomMoodApplied: state.setCustomMoodApplied,
      moodNote: state.moodNote,
      setMoodNote: state.setMoodNote,
    }))
  );


  // ── 初始化 ──────────────────────────────────────────────────
  useEffect(() => {
    setHasInitialized(false);
    fetchMessages();
  }, []);

  // ── URL 参数清理 ────────────────────────────────────────────
  useEffect(() => {
    const todoId = searchParams.get('todoId');
    if (todoId) {
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // ── 跨天自动刷新 ────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      checkAndRefreshForNewDay();
    }, 30_000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkAndRefreshForNewDay();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [checkAndRefreshForNewDay]);

  // ── 点击卡片加载上一天记录（仅一次） ───────────────────────
  const handleLoadMore = useCallback(async () => {
    const container = scrollContainerRef.current;
    if (!container || !hasMoreHistory || isLoadingMore) return;

    const prevScrollHeight = container.scrollHeight;
    await fetchOlderMessages();

    requestAnimationFrame(() => {
      const newScrollHeight = container.scrollHeight;
      container.scrollTop += newScrollHeight - prevScrollHeight;
    });
  }, [hasMoreHistory, isLoadingMore, fetchOlderMessages]);

  // ── 新消息滚动到底部 ────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const activeRecord = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.mode === 'record' && !message.isMood && message.duration === undefined) {
        return message;
      }
    }
    return undefined;
  }, [messages]);

  // ── 当前活动计时器 ──────────────────────────────────────────
  useEffect(() => {
    if (!activeRecord) {
      setCurrentDuration(0);
      return;
    }

    const updateDuration = () => {
      const duration = Math.floor((Date.now() - activeRecord.timestamp) / (1000 * 60));
      setCurrentDuration(duration);
    };

    updateDuration();
    const interval = setInterval(updateDuration, 1000);
    return () => clearInterval(interval);
  }, [activeRecord?.id, activeRecord?.timestamp]);

  // ── 编辑 / 插入 handlers ────────────────────────────────────
  const handleEditClick = (msg: any) => {
    setEditingId(msg.id);
    setInsertingAfterId(null);
    setEditContent(msg.content);
    setEditStartTime(format(msg.timestamp, "yyyy-MM-dd'T'HH:mm"));
    const endTime = msg.timestamp + (msg.duration || 0) * 60 * 1000;
    setEditEndTime(format(endTime, "yyyy-MM-dd'T'HH:mm"));
  };

  const handleInsertClick = (prevMsg: any) => {
    setInsertingAfterId(prevMsg.id);
    setEditingId(null);
    setEditContent('');
    setEditStartTime(format(prevMsg.timestamp, "yyyy-MM-dd'T'HH:mm"));

    const index = messages.findIndex(m => m.id === prevMsg.id);
    const nextMsg = messages[index + 1];
    if (nextMsg) {
      const nextEnd = nextMsg.timestamp + (nextMsg.duration || 0) * 60 * 1000;
      setEditEndTime(format(nextEnd, "yyyy-MM-dd'T'HH:mm"));
    } else {
      setEditEndTime(format(Date.now(), "yyyy-MM-dd'T'HH:mm"));
    }
  };

  const handleSave = async () => {
    if (!editContent || !editStartTime || !editEndTime) return;
    const parseTime = (s: string) => new Date(s).getTime();

    if (editingId) {
      const msg = messages.find(m => m.id === editingId);
      if (msg) {
        await updateActivity(editingId, editContent, parseTime(editStartTime), parseTime(editEndTime));
      }
    } else if (insertingAfterId) {
      const prevMsg = messages.find(m => m.id === insertingAfterId);
      if (prevMsg) {
        const index = messages.findIndex(m => m.id === insertingAfterId);
        const nextMsg = messages[index + 1];
        await insertActivity(insertingAfterId, nextMsg?.id || null, editContent, parseTime(editStartTime), parseTime(editEndTime));
      }
    }
    setEditingId(null);
    setInsertingAfterId(null);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t('chat_confirm_delete'))) {
      await deleteActivity(id);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const todoToComplete = activeTodoId ? todos.find(t => t.id === activeTodoId) : null;

    const classification = await sendAutoRecognizedInput(input);

    if (classification?.kind === 'activity' && activeTodoId) {
      await completeActiveTodo();
      if (todoToComplete && todoToComplete.startedAt) {
        const duration = Math.round((Date.now() - todoToComplete.startedAt) / (1000 * 60));
        await updateMessageDuration(todoToComplete.content, todoToComplete.startedAt, duration);
      }
    }

    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── 辅助：计算日期分隔线 ─────────────────────────────────────
  const getDateLabel = (ts: number) => {
    const currentLang = i18n.language?.split('-')[0] || 'en';
    const locale = currentLang === 'zh' ? zhCN : currentLang === 'it' ? it : enUS;
    const datePattern =
      currentLang === 'zh'
        ? 'M月d日 EEEE'
        : currentLang === 'it'
          ? 'd MMMM EEEE'
          : 'MMMM d, EEEE';
    return format(ts, datePattern, { locale });
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-center sticky top-0 z-10">
        <h1 className="text-lg font-semibold text-gray-800">{t('chat_title')}</h1>
      </header>

      {/* Messages Area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoadingMore && (
          <div className="flex items-center justify-center py-3 gap-2 text-gray-400 text-sm">
            <Loader2 size={16} className="animate-spin" />
            <span>{t('chat_load_more_records')}</span>
          </div>
        )}

        {!hasMoreHistory && messages.length > 0 && (
          <div className="flex items-center justify-center py-3 text-xs text-gray-300">
            {t('chat_reached_oldest')}
          </div>
        )}

        {yesterdaySummary && (
          <div
            onClick={handleLoadMore}
            className="rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 px-4 py-3 flex items-start gap-3 shadow-sm cursor-pointer hover:border-indigo-300 hover:shadow-md active:scale-[0.98] transition-all"
          >
            <div className="text-2xl mt-0.5">🌙</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-indigo-800">
                {yesterdaySummary.isYesterday
                  ? t('yesterday_summary', { count: yesterdaySummary.count })
                  : t('previous_day_summary', {
                      date: getDateLabel(yesterdaySummary.dateStartMs),
                      count: yesterdaySummary.count,
                    })}
              </p>
              <p className="text-xs text-indigo-500 mt-0.5 truncate">
                {t('yesterday_last_activity', { content: yesterdaySummary.lastContent })}
              </p>
              {hasMoreHistory && (
                <p className="text-xs text-indigo-400 mt-1.5 flex items-center gap-1">
                  <ChevronUp size={12} />
                  {t('yesterday_tap_to_view')}
                </p>
              )}
            </div>
          </div>
        )}

        {messages.length === 0 && !isLoading && hasInitialized && !yesterdaySummary && (
          <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
            <div className="text-4xl mb-3">✨</div>
            <p className="text-sm font-medium">{t('new_day_start')}</p>
            <p className="text-xs mt-1 text-gray-300">{t('record_what_you_do')}</p>
          </div>
        )}

        {messages.map((msg, index) => {
          const prevMsg = messages[index - 1];
          const showDateSep = !prevMsg || !isSameDay(msg.timestamp, prevMsg.timestamp);

          return (
            <Fragment key={msg.id}>
              {showDateSep && (
                <div className="flex items-center gap-2 py-1">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {getDateLabel(msg.timestamp)}
                  </span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
              )}

              <div className="flex flex-col space-y-1">
                <MessageItem
                  msg={msg}
                  activityMood={activityMood}
                  customMoodLabel={customMoodLabel}
                  customMoodApplied={customMoodApplied}
                  moodNote={moodNote}
                  getStardustByMessageId={getStardustByMessageId}
                  onEditClick={handleEditClick}
                  onInsertClick={handleInsertClick}
                  onDelete={handleDelete}
                  onMoodPickerOpen={(msgId) => {
                    setMoodPickerFor(msgId);
                    setMoodPickerReadonly(false);
                    setCustomMoodInput(moodNote[msgId] || '');
                    setCustomLabelInput(customMoodLabel[msgId] || '');
                    setShowCustomLabelInput(false);
                  }}
                  onStardustSelect={(data, position) => setSelectedStardust({ data, position })}
                  onEndActivity={endActivity}
                  isActionsExpanded={expandedActionsId === msg.id}
                  onToggleActions={(id) => {
                    setExpandedActionsId(prev => (prev === id ? null : id));
                  }}
                />
              </div>
            </Fragment>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Current Activity Indicator */}
      {(activeRecord || activeTodoId) && (
        <div className="px-4 py-2 bg-green-50 border-t border-green-100 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-green-700">
            <Activity size={16} className="animate-pulse" />
            <span className="text-sm font-medium">
              {t('chat_current_activity')}<span className="font-bold">
                {activeTodoId
                  ? todos.find(t => t.id === activeTodoId)?.content || activeRecord?.content
                  : activeRecord?.content}
              </span>
            </span>
          </div>
          <span className="text-sm font-bold text-green-600">{t('elapsed_label', { duration: formatDuration(currentDuration, t) })}</span>
        </div>
      )}

      {/* Edit/Insert Modal */}
      {(editingId || insertingAfterId) && (
        <EditInsertModal
          editingId={editingId}
          insertingAfterId={insertingAfterId}
          editContent={editContent}
          editStartTime={editStartTime}
          editEndTime={editEndTime}
          onContentChange={setEditContent}
          onStartTimeChange={setEditStartTime}
          onEndTimeChange={setEditEndTime}
          onSave={handleSave}
          onClose={() => { setEditingId(null); setInsertingAfterId(null); }}
        />
      )}

      {/* Mood Picker Modal */}
      {moodPickerFor && (
        <MoodPickerModal
          moodPickerFor={moodPickerFor}
          moodPickerReadonly={moodPickerReadonly}
          selectedMoodOpt={selectedMoodOpt}
          customMoodInput={customMoodInput}
          customLabelInput={customLabelInput}
          showCustomLabelInput={showCustomLabelInput}
          customMoodLabel={customMoodLabel}
          customMoodApplied={customMoodApplied}
          onClose={() => setMoodPickerFor(null)}
          onSelectMood={(msgId, opt) => {
            setMood(msgId, opt);
            setCustomMoodApplied(msgId, false);
            setShowCustomLabelInput(false);
            setSelectedMoodOpt(opt);
          }}
          onCustomLabelClick={() => {
            if (!moodPickerFor) return;
            setShowCustomLabelInput(true);
            const next = customMoodLabel[moodPickerFor] || customLabelInput || customLabelDefault;
            setCustomLabelInput(next);
            setCustomMoodLabel(moodPickerFor, next);
            const applied = !isDefaultCustomLabel(next);
            setCustomMoodApplied(moodPickerFor, applied);
            if (applied) setSelectedMoodOpt('__custom__');
          }}
          onCustomLabelChange={(value) => {
            setCustomLabelInput(value);
            if (moodPickerFor) {
              const next = value.trim() || customLabelDefault;
              setCustomMoodLabel(moodPickerFor, next);
              const applied = !isDefaultCustomLabel(next);
              setCustomMoodApplied(moodPickerFor, applied);
              if (applied) setSelectedMoodOpt('__custom__');
            }
          }}
          onCustomLabelSave={saveCustomLabel}
          onMoodNoteChange={(value) => {
            setCustomMoodInput(value);
            if (moodPickerFor) {
              setMoodNote(moodPickerFor, value);
            }
          }}
        />
      )}

      {/* Input Area */}
      <ChatInputBar
        input={input}
        isLoading={isLoading}
        onInputChange={setInput}
        onSend={handleSend}
        onKeyDown={handleKeyDown}
      />

      {/* 星尘珍藏查看卡片 */}
      <StardustCard
        isOpen={!!selectedStardust}
        data={selectedStardust?.data}
        position={selectedStardust?.position}
        onClose={() => setSelectedStardust(null)}
      />
    </div>
  );
};
