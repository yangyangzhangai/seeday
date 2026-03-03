import { Fragment, useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../store/useChatStore';
import { useTodoStore } from '../../store/useTodoStore';
import { useStardustStore } from '../../store/useStardustStore';
import { Activity, ChevronUp, Loader2 } from 'lucide-react';
import { formatDuration } from '../../lib/time';
import { format, isSameDay } from 'date-fns';
import { zhCN, enUS, it } from 'date-fns/locale';
import { StardustCard } from '../../components/StardustCard';
import type { StardustCardData } from '../../types/stardust';
import { useMoodStore } from '../../store/useMoodStore';
import { useReportStore } from '../../store/useReportStore';

// Sub-components
import { MessageItem } from './MessageItem';
import { MoodPickerModal } from './MoodPickerModal';
import { EditInsertModal } from './EditInsertModal';
import { ChatInputBar } from './ChatInputBar';

export const ChatPage = () => {
  const {
    messages, sendMessage, fetchMessages, fetchOlderMessages, checkAndRefreshForNewDay,
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
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const [currentDuration, setCurrentDuration] = useState(0);
  const [moodPickerFor, setMoodPickerFor] = useState<string | null>(null);
  const [customMoodInput, setCustomMoodInput] = useState('');
  const [customLabelInput, setCustomLabelInput] = useState('');
  const [showCustomLabelInput, setShowCustomLabelInput] = useState(false);
  const [selectedMoodOpt, setSelectedMoodOpt] = useState<string | null>(null);
  const [moodPickerReadonly, setMoodPickerReadonly] = useState(false);
  const { t, i18n } = useTranslation();
  const [isMoodMode, setIsMoodMode] = useState(false);

  const saveCustomLabel = (value: string) => {
    const next = value.trim() || '自定义';
    setCustomLabelInput(next);
    if (moodPickerFor) {
      setCustomMoodLabel(moodPickerFor, next);
      const applied = !!next && next !== '自定义';
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
  const activityMood = useMoodStore(state => state.activityMood);
  const setMood = useMoodStore(state => state.setMood);
  const customMoodLabel = useMoodStore(state => state.customMoodLabel);
  const setCustomMoodLabel = useMoodStore(state => state.setCustomMoodLabel);
  const customMoodApplied = useMoodStore(state => state.customMoodApplied);
  const setCustomMoodApplied = useMoodStore(state => state.setCustomMoodApplied);
  const moodNote = useMoodStore(state => state.moodNote);
  const setMoodNote = useMoodStore(state => state.setMoodNote);


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

  // ── 跨天自动生成"前一日"日报 ───────────
  useEffect(() => {
    const reportStore = useReportStore.getState();
    let lastDay = new Date().toDateString();
    const gen = () => {
      const nowStr = new Date().toDateString();
      if (nowStr !== lastDay) {
        const prev = new Date();
        prev.setDate(prev.getDate() - 1);
        reportStore.generateReport('daily', prev.getTime());
        lastDay = nowStr;
      }
    };
    const t = setInterval(gen, 60_000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') gen();
    });
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', gen as any);
    };
  }, []);

  // ── 上滑加载更多 (IntersectionObserver) ─────────────────────
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

  useEffect(() => {
    const sentinel = topSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreHistory && !isLoadingMore) {
          handleLoadMore();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleLoadMore, hasMoreHistory, isLoadingMore]);

  // ── 新消息滚动到底部 ────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // ── 当前活动计时器 ──────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const activeRecord = [...messages].reverse().find(m => m.mode === 'record' && !m.isMood && m.duration === undefined);
      if (activeRecord) {
        const duration = Math.floor((Date.now() - activeRecord.timestamp) / (1000 * 60));
        setCurrentDuration(duration);
      } else {
        setCurrentDuration(0);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [messages]);

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

    if (!isMoodMode && activeTodoId) {
      await completeActiveTodo();
      if (todoToComplete && todoToComplete.startedAt) {
        const duration = Math.round((Date.now() - todoToComplete.startedAt) / (1000 * 60));
        await updateMessageDuration(todoToComplete.content, todoToComplete.startedAt, duration);
      }
    }

    await sendMessage(input);
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

  const activeRecord = [...messages].reverse().find(m => m.mode === 'record' && !m.isMood && m.duration === undefined);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-center sticky top-0 z-10">
        <h1 className="text-lg font-semibold text-gray-800">{t('chat_title')}</h1>
      </header>

      {/* Messages Area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        <div ref={topSentinelRef} className="h-1" />

        {isLoadingMore && (
          <div className="flex items-center justify-center py-3 gap-2 text-gray-400 text-sm">
            <Loader2 size={16} className="animate-spin" />
            <span>加载更多记录…</span>
          </div>
        )}

        {!hasMoreHistory && messages.length > 0 && (
          <div className="flex items-center justify-center py-3 text-xs text-gray-300">
            — 已是最早的记录 —
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
                昨天你记录了 {yesterdaySummary.count} 件事
              </p>
              <p className="text-xs text-indigo-500 mt-0.5 truncate">
                最后在做：{yesterdaySummary.lastContent}
              </p>
              {hasMoreHistory && (
                <p className="text-xs text-indigo-400 mt-1.5 flex items-center gap-1">
                  <ChevronUp size={12} />
                  点击或上滑查看昨天的记录
                </p>
              )}
            </div>
          </div>
        )}

        {messages.length === 0 && !isLoading && hasInitialized && !yesterdaySummary && (
          <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
            <div className="text-4xl mb-3">✨</div>
            <p className="text-sm font-medium">新的一天，从一条记录开始</p>
            <p className="text-xs mt-1 text-gray-300">记录你正在做的事情</p>
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
            const next = customMoodLabel[moodPickerFor] || customLabelInput || '自定义';
            setCustomLabelInput(next);
            setCustomMoodLabel(moodPickerFor, next);
            setCustomMoodApplied(moodPickerFor, !!next && next !== '自定义');
            if (!!next && next !== '自定义') setSelectedMoodOpt('__custom__');
          }}
          onCustomLabelChange={(value) => {
            setCustomLabelInput(value);
            if (moodPickerFor) {
              setCustomMoodLabel(moodPickerFor, value.trim() || '自定义');
              const applied = !!value.trim() && value.trim() !== '自定义';
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
        isMoodMode={isMoodMode}
        isLoading={isLoading}
        onInputChange={setInput}
        onSend={handleSend}
        onKeyDown={handleKeyDown}
        onToggleMoodMode={() => setIsMoodMode(!isMoodMode)}
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
