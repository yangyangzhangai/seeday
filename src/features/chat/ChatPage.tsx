// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/chat/README.md
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../store/useChatStore';
import { useTodoStore } from '../../store/useTodoStore';
import { useStardustStore } from '../../store/useStardustStore';
import { useMoodStore } from '../../store/useMoodStore';
import { useShallow } from 'zustand/react/shallow';

import { StardustCard } from '../../components/feedback/StardustCard';
import type { StardustCardData } from '../../types/stardust';

import { ChatInputBar } from './ChatInputBar';
import { MagicPenSheet } from './MagicPenSheet';
import { EditInsertModal } from './EditInsertModal';
import { MoodPickerModal } from './MoodPickerModal';
import { DatePicker } from './components/DatePicker';
import { TimelineView } from './components/TimelineView';
import { YesterdaySummaryPopup } from './components/YesterdaySummaryPopup';

import { parseMagicPenInput } from '../../services/input/magicPenParser';
import type { MagicPenAutoWrittenItem, MagicPenDraftItem } from '../../services/input/magicPenTypes';
import { handleMagicPenModeSend, handleLatestMessageReclassify } from './chatPageActions';
import { toLocalDateStr } from '../../lib/dateUtils';
import { format } from 'date-fns';

export const ChatPage = () => {
  const todayStr = toLocalDateStr(new Date());
  const {
    messages, sendAutoRecognizedInput, fetchMessages, fetchMessagesByDate,
    checkAndRefreshForNewDay, updateActivity, insertActivity, deleteActivity,
    endActivity, reclassifyRecentInput, isLoading,
    hasInitialized, setHasInitialized, updateMessageDuration, dateCache,
    activeViewDateStr,
  } = useChatStore();

  const { activeTodoId, completeActiveTodo, todos } = useTodoStore();
  const getStardustByMessageId = useStardustStore(state => state.getStardustByMessageId);
  const syncPendingStardusts = useStardustStore(state => state.syncPendingStardusts);
  const fetchStardusts = useStardustStore(state => state.fetchStardusts);
  const [searchParams, setSearchParams] = useSearchParams();
  const [input, setInput] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isLoadingDate, setIsLoadingDate] = useState(false);
  const [isMagicPenOpen, setIsMagicPenOpen] = useState(false);
  const [isMagicPenModeOn, setIsMagicPenModeOn] = useState(false);
  const [isMagicPenSending, setIsMagicPenSending] = useState(false);
  const [magicPenSeedDrafts, setMagicPenSeedDrafts] = useState<MagicPenDraftItem[]>([]);
  const [magicPenSeedUnparsed, setMagicPenSeedUnparsed] = useState<string[]>([]);
  const [magicPenSeedAutoWritten, setMagicPenSeedAutoWritten] = useState<MagicPenAutoWrittenItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [insertingAfterId, setInsertingAfterId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [moodPickerFor, setMoodPickerFor] = useState<string | null>(null);
  const [customLabelInput, setCustomLabelInput] = useState('');
  const [showCustomLabelInput, setShowCustomLabelInput] = useState(false);
  const [selectedMoodOpt, setSelectedMoodOpt] = useState<string | null>(null);
  const [moodPickerReadonly] = useState(false);
  const [selectedStardust, setSelectedStardust] = useState<{
    data: StardustCardData; position: { x: number; y: number };
  } | null>(null);

  const sendingRef = useRef(false);

  const { t, i18n } = useTranslation();
  const customLabelDefault = t('chat_custom_label_default');
  const isDefaultCustomLabel = (label: string) =>
    !label || label === customLabelDefault || label === '自定义';

  const {
    setMood, customMoodLabel, setCustomMoodLabel,
    customMoodApplied, setCustomMoodApplied,
  } = useMoodStore(useShallow(s => ({
    setMood: s.setMood,
    customMoodLabel: s.customMoodLabel,
    setCustomMoodLabel: s.setCustomMoodLabel,
    customMoodApplied: s.customMoodApplied,
    setCustomMoodApplied: s.setCustomMoodApplied,
  })));

  // ── 初始化 ─────────────────────────────────────────────────
  // Skip re-fetch if we already have today's data in memory.
  // This prevents flicker and skeleton flash when navigating back to the chat page,
  // and preserves any optimistic messages added while on other pages (e.g. todo start).
  useEffect(() => {
    if (hasInitialized) return;
    fetchMessages();
  }, []);

  // Ensure stardust emojis survive refresh/login and cross-device sync.
  useEffect(() => {
    void (async () => {
      await syncPendingStardusts();
      await fetchStardusts();
    })();
  }, [syncPendingStardusts, fetchStardusts]);

  // ── URL 参数清理 ───────────────────────────────────────────
  useEffect(() => {
    if (searchParams.get('todoId')) setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  // ── 跨天自动刷新 ──────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(checkAndRefreshForNewDay, 30_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkAndRefreshForNewDay();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, [checkAndRefreshForNewDay]);

  // ── 日期切换加载 ───────────────────────────────────────────
  useEffect(() => {
    const dateStr = toLocalDateStr(selectedDate);
    const isToday = dateStr === todayStr;

    if (isToday) {
      // First load is handled by the init useEffect — skip
      if (!hasInitialized) return;
      // Only restore today's data if the store is currently showing a different date.
      // Use getState() to read fresh store value (not the stale closure).
      const { activeViewDateStr: viewDate } = useChatStore.getState();
      if (viewDate && viewDate !== dateStr) {
        // Was showing another date — restore today instantly from cache or re-fetch
        const cached = useChatStore.getState().dateCache.get(dateStr);
        if (cached) {
          void fetchMessagesByDate(dateStr);
        } else {
          void fetchMessages();
        }
      }
      return;
    }

    // Non-today date: use cache for instant switch, show loading only on first fetch
    if (useChatStore.getState().dateCache.get(dateStr)) {
      void fetchMessagesByDate(dateStr);
      return;
    }

    setIsLoadingDate(true);
    fetchMessagesByDate(dateStr).finally(() => setIsLoadingDate(false));
  }, [selectedDate, todayStr]);

  const isSelectedDateToday = toLocalDateStr(selectedDate) === todayStr;
  const maxEditableDateTime = format(new Date(), "yyyy-MM-dd'T'HH:mm");

  const handleTimeClick = useCallback((msg: any) => {
    if (!isSelectedDateToday) return;
    setEditingId(msg.id);
    setInsertingAfterId(null);
    setEditContent(msg.content);
    setEditStartTime(format(msg.timestamp, "yyyy-MM-dd'T'HH:mm"));
    setEditEndTime(format(msg.timestamp + (msg.duration || 0) * 60000, "yyyy-MM-dd'T'HH:mm"));
  }, [isSelectedDateToday]);

  const handleSave = async () => {
    if (!editContent || !editStartTime || !editEndTime) return;
    const parseTime = (s: string) => new Date(s).getTime();
    const startMs = parseTime(editStartTime);
    const endMs = parseTime(editEndTime);
    if (startMs > Date.now()) {
      window.alert(t('chat_start_time_no_future'));
      return;
    }
    if (editingId) {
      await updateActivity(editingId, editContent, startMs, endMs);
    } else if (insertingAfterId) {
      const idx = messages.findIndex(m => m.id === insertingAfterId);
      const nextMsg = messages[idx + 1];
      await insertActivity(insertingAfterId, nextMsg?.id || null, editContent, startMs, endMs);
    }
    setEditingId(null);
    setInsertingAfterId(null);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t('chat_confirm_delete'))) await deleteActivity(id);
  };

  const handleReclassify = async (messageId: string, nextKind: 'activity' | 'mood') => {
    await handleLatestMessageReclassify(messageId, nextKind, reclassifyRecentInput, () => {});
  };

  /** Open mood picker for a card — pre-fill the currently selected option */
  const handleMoodClick = useCallback((msgId: string) => {
    setMoodPickerFor(msgId);
    const ms = useMoodStore.getState();
    const isCustom = ms.customMoodApplied[msgId];
    const current  = ms.activityMood[msgId] || null;
    setSelectedMoodOpt(isCustom ? '__custom__' : current);
    const label = ms.customMoodLabel[msgId] || '';
    setCustomLabelInput(isCustom && label ? label : customLabelDefault);
    setShowCustomLabelInput(false);
  }, [customLabelDefault]);

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

  // ── Send ──────────────────────────────────────────────────
  const handleSend = async () => {
    if (!isSelectedDateToday) return;
    if (!input.trim()) return;
    if (sendingRef.current) return;

    const textToSend = input;
    setInput('');
    sendingRef.current = true;

    try {
      if (isMagicPenModeOn) {
        await handleMagicPenModeSend({
          input: textToSend, lang: i18n.language?.split('-')[0] || 'zh',
          isMagicPenSending, messages, activeTodoId,
          todos: todos.map(t => ({ id: t.id, content: t.title, startedAt: t.startedAt })),
          sendAutoRecognizedInput: async (content) => {
            const before = useChatStore.getState().messages;
            const beforeIds = new Set(before.map(m => m.id));
            const classification = await sendAutoRecognizedInput(content);
            const after = useChatStore.getState().messages;
            const createdMessage = [...after].reverse().find(m => !beforeIds.has(m.id));
            return { classification, messageId: createdMessage?.id };
          },
          completeActiveTodo, updateMessageDuration, parseMagicPenInput,
          setIsMagicPenSending, setMagicPenSeedDrafts, setMagicPenSeedUnparsed,
          setMagicPenSeedAutoWritten, setIsMagicPenOpen, setInput,
        });
        return;
      }

      const todoToComplete = activeTodoId ? todos.find(t => t.id === activeTodoId) : null;
      const classification = await sendAutoRecognizedInput(textToSend);

      if (classification?.kind === 'activity' && activeTodoId) {
        await completeActiveTodo();
        if (todoToComplete?.startedAt) {
          const dur = Math.round((Date.now() - todoToComplete.startedAt) / 60000);
          await updateMessageDuration(todoToComplete.title, todoToComplete.startedAt, dur);
        }
      }
    } finally {
      sendingRef.current = false;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleCloseMagicPen = () => {
    setIsMagicPenOpen(false);
    setMagicPenSeedDrafts([]);
    setMagicPenSeedUnparsed([]);
    setMagicPenSeedAutoWritten([]);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-center sticky top-0 z-10">
        <h1 className="text-lg font-semibold text-gray-800">{t('chat_title')}</h1>
      </header>

      {/* Date Picker */}
      <DatePicker selectedDate={selectedDate} onDateChange={setSelectedDate} />

      {/* Timeline */}
      <TimelineView
        messages={messages}
        selectedDate={selectedDate}
        isLoading={isLoading || isLoadingDate}
        onMoodClick={handleMoodClick}
        onTimeClick={handleTimeClick}
      />

      {/* Input Area */}
      <ChatInputBar
        input={input}
        isLoading={isLoading || isMagicPenSending}
        isReadOnly={!isSelectedDateToday}
        readOnlyMessage="已切换到历史日期，切换回今日可继续记录"
        isMagicPenModeOn={isMagicPenModeOn}
        onInputChange={setInput}
        onSend={() => { void handleSend(); }}
        onKeyDown={handleKeyDown}
        onToggleMagicPenMode={() => setIsMagicPenModeOn(v => !v)}
      />

      {/* Edit/Insert Modal */}
      {(editingId || insertingAfterId) && (
        <EditInsertModal
          editingId={editingId}
          insertingAfterId={insertingAfterId}
          editContent={editContent}
          editStartTime={editStartTime}
          editEndTime={editEndTime}
          maxDateTime={maxEditableDateTime}
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
          customLabelInput={customLabelInput}
          showCustomLabelInput={showCustomLabelInput}
          customMoodLabel={customMoodLabel}
          customMoodApplied={customMoodApplied}
          onClose={() => setMoodPickerFor(null)}
          onSelectMood={(msgId, opt) => {
            setMood(msgId, opt, 'manual');
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
        />
      )}

      {/* Magic Pen */}
      <MagicPenSheet
        isOpen={isMagicPenOpen}
        initialDrafts={magicPenSeedDrafts}
        initialUnparsedSegments={magicPenSeedUnparsed}
        initialAutoWrittenItems={magicPenSeedAutoWritten}
        messages={messages}
        onUndoAutoWritten={async (item: MagicPenAutoWrittenItem) => {
          if (item.messageId) await deleteActivity(item.messageId);
        }}
        onClose={handleCloseMagicPen}
      />

      {/* Stardust Card */}
      <StardustCard
        isOpen={!!selectedStardust}
        data={selectedStardust?.data}
        position={selectedStardust?.position}
        onClose={() => setSelectedStardust(null)}
      />

      {/* Yesterday Summary Popup */}
      <YesterdaySummaryPopup />
    </div>
  );
};
