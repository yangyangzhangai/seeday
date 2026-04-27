// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/chat/README.md
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { playSound } from '../../services/sound/soundService';
import { useSearchParams } from 'react-router-dom';
import imgBirdZep02 from '../../assets/zep02.png';
import imgBirdZep03 from '../../assets/zep03.png';
import imgVan01 from '../../assets/morning-glory-01.png';
import imgVan02 from '../../assets/morning-glory-02.png';
import imgAgnes01 from '../../assets/dragon-blood-tree-01.png';
import imgAgnes02 from '../../assets/dragon-blood-tree-02.png';
import imgMomo01 from '../../assets/momo-chat-01.png';
import imgMomo02 from '../../assets/momo-chat-02.png';
import { useAuthStore } from '../../store/useAuthStore';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../store/useChatStore';
import { useTodoStore } from '../../store/useTodoStore';
import { useAnnotationStore } from '../../store/useAnnotationStore';
import { useStardustStore } from '../../store/useStardustStore';
import { useMoodStore } from '../../store/useMoodStore';
import { useShallow } from 'zustand/react/shallow';

import { StardustCard } from '../../components/feedback/StardustCard';
import type { StardustCardData } from '../../types/stardust';

import { ChatInputBar } from './ChatInputBar';
import { MagicPenSheet } from './MagicPenSheet';
import { MagicPenUpgradeModal } from './MagicPenUpgradeModal';
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
import {
  getScopedClientStorageKey,
  isMultiAccountIsolationV2Enabled,
  resolveStorageScopeForUser,
} from '../../store/storageScope';

export const ChatPage = () => {
  const todayStr = toLocalDateStr(new Date());
  const {
    messages, sendAutoRecognizedInput, sendMessage, sendMood, fetchMessages, fetchMessagesByDate,
    checkAndRefreshForNewDay, updateActivity, insertActivity, deleteActivity,
    endActivity, reclassifyRecentInput, isLoading,
    hasInitialized, setHasInitialized, updateMessageDuration,
    activeViewDateStr,
  } = useChatStore();

  const { activeTodoId, completeActiveTodo, todos } = useTodoStore();
  const pendingSuggestionIntent = useAnnotationStore(s => s.pendingSuggestionIntent);
  const consumePendingSuggestionIntent = useAnnotationStore(s => s.consumePendingSuggestionIntent);
  const getStardustByMessageId = useStardustStore(state => state.getStardustByMessageId);
  const syncPendingStardusts = useStardustStore(state => state.syncPendingStardusts);
  const fetchStardusts = useStardustStore(state => state.fetchStardusts);
  const [searchParams, setSearchParams] = useSearchParams();
  const [input, setInput] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isLoadingDate, setIsLoadingDate] = useState(false);
  const [isMagicPenOpen, setIsMagicPenOpen] = useState(false);
  const [isMagicPenModeOn, setIsMagicPenModeOn] = useState(false);
  const [isMagicPenUpgradeOpen, setIsMagicPenUpgradeOpen] = useState(false);
  const [isMagicPenSending, setIsMagicPenSending] = useState(false);
  const [isSending, setIsSending] = useState(false);
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

  const aiMode = useAuthStore(state => state.preferences.aiMode);
  const isPlus = useAuthStore(state => state.isPlus);
  const userId = useAuthStore(state => state.user?.id);
  const draftStorageKey = useMemo(
    () => getScopedClientStorageKey('chat_input_draft', resolveStorageScopeForUser(userId ?? null)),
    [userId],
  );

  const personaImages: Record<string, [string, string]> = {
    van: [imgVan01, imgVan02],
    agnes: [imgAgnes01, imgAgnes02],
    zep: [imgBirdZep02, imgBirdZep03],
    momo: [imgMomo01, imgMomo02],
  };
  const [personaImg1, personaImg2] = personaImages[aiMode] ?? [imgBirdZep02, imgBirdZep03];

  const sendingRef = useRef(false);
  const sendingStartedAtRef = useRef<number | null>(null);
  const chatFrameRef = useRef<HTMLDivElement | null>(null);
  const [birdOpen, setBirdOpen] = useState(false);
  const [birdAnchor, setBirdAnchor] = useState<{ left: number; bottom: number }>({
    left: 16,
    bottom: 124,
  });

  useEffect(() => { setBirdOpen(false); }, [aiMode]);

  useEffect(() => {
    const updateBirdAnchor = () => {
      const frame = chatFrameRef.current;
      const inputBox = document.querySelector<HTMLElement>('[data-chat-input-box]');
      if (!frame || !inputBox) return;

      const frameRect = frame.getBoundingClientRect();
      const inputRect = inputBox.getBoundingClientRect();
      const bottom = Math.max(96, window.innerHeight - inputRect.top);
      const left = frameRect.left + 10;

      setBirdAnchor({ left, bottom });
    };

    updateBirdAnchor();
    const rafId = window.requestAnimationFrame(updateBirdAnchor);
    window.addEventListener('resize', updateBirdAnchor);
    window.addEventListener('orientationchange', updateBirdAnchor);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updateBirdAnchor);
      window.removeEventListener('orientationchange', updateBirdAnchor);
    };
  }, [selectedDate, isLoading, isLoadingDate, isMagicPenOpen]);

  useEffect(() => {
    if (!isPlus && isMagicPenModeOn) {
      setIsMagicPenModeOn(false);
    }
  }, [isPlus, isMagicPenModeOn]);

  useEffect(() => {
    setSelectedDate(new Date());
  }, []);

  // ── 草稿持久化 ─────────────────────────────────────────────
  useEffect(() => {
    try {
      const scopedDraft = localStorage.getItem(draftStorageKey);
      const legacyDraft = isMultiAccountIsolationV2Enabled() ? localStorage.getItem('chat_input_draft') : null;
      const resolvedDraft = scopedDraft ?? legacyDraft ?? '';
      if (!scopedDraft && legacyDraft) {
        localStorage.setItem(draftStorageKey, legacyDraft);
        localStorage.removeItem('chat_input_draft');
      }
      setInput(resolvedDraft);
    } catch {
      setInput('');
    }
  }, [draftStorageKey]);

  useEffect(() => {
    if (input) {
      localStorage.setItem(draftStorageKey, input);
    } else {
      localStorage.removeItem(draftStorageKey);
    }
  }, [input, draftStorageKey]);

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
  // If hasInitialized is persisted but the date has changed (new day), trigger a refresh.
  useEffect(() => {
    if (hasInitialized) {
      checkAndRefreshForNewDay();
      if (messages.length === 0) {
        // Fallback: persisted state may be marked initialized but contain no
        // usable timeline rows after hydration/recovery.
        fetchMessages();
      }
      return;
    }
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

  // ── AI 活动建议意图：直接开始计时 ─────────────────────────
  useEffect(() => {
    if (!pendingSuggestionIntent || pendingSuggestionIntent.type !== 'activity') return;
    const intent = consumePendingSuggestionIntent({ type: 'activity', maxAgeMs: 30_000 });
    if (intent?.activityName) {
      void sendMessage(intent.activityName);
    }
  }, [pendingSuggestionIntent, consumePendingSuggestionIntent, sendMessage]);

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
      const { activeViewDateStr: viewDate, dateCache } = useChatStore.getState();
      if (viewDate && viewDate !== dateStr) {
        if (dateCache[dateStr]) {
          void fetchMessagesByDate(dateStr);
        } else {
          void fetchMessages();
        }
      }
      return;
    }

    // Non-today date: dateCache 持久化在 localStorage，命中即无 loading
    if (useChatStore.getState().dateCache[dateStr]) {
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

  const handleStardustSelect = useCallback((data: StardustCardData, position: { x: number; y: number }) => {
    setSelectedStardust({ data, position });
  }, []);

  const handleSave = async () => {
    if (!editContent || !editStartTime || !editEndTime) return;
    const parseTime = (s: string) => new Date(s).getTime();
    const startMs = parseTime(editStartTime);
    const endMs = parseTime(editEndTime);
    if (startMs > Date.now()) {
      window.alert(t('chat_start_time_no_future'));
      return;
    }

    let shouldCloseModal = false;
    try {
      if (editingId) {
        await updateActivity(editingId, editContent, startMs, endMs);
        shouldCloseModal = true;
      } else if (insertingAfterId) {
        const idx = messages.findIndex(m => m.id === insertingAfterId);
        const nextMsg = messages[idx + 1];
        await insertActivity(insertingAfterId, nextMsg?.id || null, editContent, startMs, endMs);
        shouldCloseModal = true;
      }
    } finally {
      if (shouldCloseModal) {
        setEditingId(null);
        setInsertingAfterId(null);
      }
    }
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
    setCustomLabelInput(isCustom && label ? label : '');
    setShowCustomLabelInput(false);
  }, [customLabelDefault]);

  const saveCustomLabel = (value: string) => {
    const next = value.trim();
    setCustomLabelInput(next);
    if (moodPickerFor) {
      if (!next) {
        setCustomMoodLabel(moodPickerFor, undefined);
        setCustomMoodApplied(moodPickerFor, false);
        const moodState = useMoodStore.getState();
        setSelectedMoodOpt(moodState.activityMood[moodPickerFor] || null);
      } else {
        setCustomMoodLabel(moodPickerFor, next);
        setCustomMoodApplied(moodPickerFor, !isDefaultCustomLabel(next));
        setSelectedMoodOpt('__custom__');
      }
    }
    setShowCustomLabelInput(false);
  };

  // ── Send ──────────────────────────────────────────────────
  const handleSend = async () => {
    const SEND_STUCK_RECOVERY_MS = 20_000;
    const SEND_TIMEOUT_MS = 18_000;

    if (!isSelectedDateToday) return;
    if (!input.trim()) return;
    if (sendingRef.current) {
      const startedAt = sendingStartedAtRef.current ?? 0;
      if (Date.now() - startedAt < SEND_STUCK_RECOVERY_MS) return;
      // Self-heal: previous send likely hung on network. Force unlock.
      sendingRef.current = false;
      sendingStartedAtRef.current = null;
      setIsSending(false);
    }

    const textToSend = input;
    setInput('');
    playSound('bubble');
    sendingRef.current = true;
    sendingStartedAtRef.current = Date.now();
    setIsSending(true);

    try {
      const sendTask = (async () => {
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
            writeMagicPenAutoItem: async (item) => {
              if (item.kind === 'mood') {
                const messageId = await sendMood(item.content);
                return { messageId: messageId ?? undefined };
              }

              const messageId = await sendMessage(item.content);
              if (item.linkedMoodContent && messageId) {
                await sendMood(item.linkedMoodContent, { relatedActivityId: messageId });
              }
              return { messageId: messageId ?? undefined };
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
      })();

      const timeoutTask = new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error('chat_send_timeout')), SEND_TIMEOUT_MS);
      });

      await Promise.race([sendTask, timeoutTask]);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[ChatPage] send failed/unlocked:', error);
      }
      // Restore unsent text only if user hasn't started typing a new draft.
      setInput((current) => (current.trim().length > 0 ? current : textToSend));
    } finally {
      sendingRef.current = false;
      sendingStartedAtRef.current = null;
      setIsSending(false);
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
    <div className="flex h-full items-center justify-center bg-transparent px-0 md:px-8">
      {/* Chat container */}
      <div
        ref={chatFrameRef}
        className="app-mobile-page-frame relative flex h-full w-full max-w-[430px] flex-col overflow-hidden text-slate-900 [box-shadow:0_0_0_1px_rgba(0,0,0,0.06),0_24px_64px_rgba(0,0,0,0.1)] md:h-[calc(100%-24px)] md:max-w-[980px] md:rounded-[30px] md:border md:border-white/70 md:bg-[#fcfaf7]/85 md:[box-shadow:0_0_0_1px_rgba(255,255,255,0.45),0_24px_64px_rgba(15,23,42,0.12)]"
      >

        {/* Bird character */}
        <button
          type="button"
          onClick={() => setBirdOpen(v => !v)}
          aria-label="toggle bird"
          style={{
            position: 'fixed',
            left: birdAnchor.left,
            bottom: birdAnchor.bottom,
            width: 98, height: 98, border: 'none', background: 'transparent',
            padding: 0, cursor: 'pointer', zIndex: 24,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <img
            src={birdOpen ? personaImg2 : personaImg1}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center bottom', opacity: 0.96,
              filter: 'drop-shadow(0 6px 14px rgba(148,163,184,0.14))' }}
          />
        </button>

        {/* Header — frosted glass */}
        <header
          className="app-mobile-page-header sticky top-0 z-20 px-4 pb-3 pt-11"
          style={{
            background: 'rgba(252,250,247,0.38)',
            backdropFilter: 'blur(14px) saturate(150%)',
            WebkitBackdropFilter: 'blur(14px) saturate(150%)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <DatePicker selectedDate={selectedDate} onDateChange={setSelectedDate} />
        </header>

        {/* Timeline */}
        <TimelineView
          messages={messages}
          selectedDate={selectedDate}
          isLoading={isLoading || isLoadingDate}
          onMoodClick={handleMoodClick}
          onStardustSelect={handleStardustSelect}
          onTimeClick={handleTimeClick}
        />

        {/* Input + Nav (fixed bottom, inside phone container via portal-like fixed) */}
        <ChatInputBar
          input={input}
          isLoading={isLoading || isMagicPenSending || isSending}
          isReadOnly={!isSelectedDateToday}
          readOnlyMessage={!isSelectedDateToday ? t('chat_historical_read_only') : undefined}
          isMagicPenModeOn={isMagicPenModeOn}
          onInputChange={setInput}
          onSend={() => { void handleSend(); }}
          onKeyDown={handleKeyDown}
          onToggleMagicPenMode={() => {
            if (!isPlus) {
              setIsMagicPenUpgradeOpen(true);
              return;
            }
            playSound('star');
            setIsMagicPenModeOn(v => !v);
          }}
        />

        <MagicPenUpgradeModal
          isOpen={isMagicPenUpgradeOpen}
          onClose={() => setIsMagicPenUpgradeOpen(false)}
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
              const existing = (customMoodApplied[moodPickerFor] && customMoodLabel[moodPickerFor])
                ? (customMoodLabel[moodPickerFor] || '')
                : '';
              setCustomLabelInput(existing);
              setSelectedMoodOpt('__custom__');
            }}
            onCustomLabelChange={(value) => {
              setCustomLabelInput(value);
              if (moodPickerFor) {
                const next = value.trim();
                setCustomMoodLabel(moodPickerFor, next || undefined);
                const applied = !!next && !isDefaultCustomLabel(next);
                setCustomMoodApplied(moodPickerFor, applied);
                setSelectedMoodOpt('__custom__');
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

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }
      `}</style>
    </div>
  );
};
