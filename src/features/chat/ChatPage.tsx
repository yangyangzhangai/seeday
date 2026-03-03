import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../store/useChatStore';
import { useTodoStore } from '../../store/useTodoStore';
import { useStardustStore } from '../../store/useStardustStore';
import { Send, Activity, Edit2, Plus, Trash2, X, Save, ChevronUp, Heart, Loader2, Umbrella, Pencil } from 'lucide-react';
import { cn, formatDuration } from '../../lib/utils';
import { getMoodColor } from '../../lib/moodColor';
import { format, isSameDay } from 'date-fns';
import { zhCN, enUS, it } from 'date-fns/locale';
import { StardustEmoji } from '../../components/StardustEmoji';
import { StardustCard } from '../../components/StardustCard';
import type { StardustCardData } from '../../types/stardust';
import { useMoodStore } from '../../store/useMoodStore';
import { useAnnotationStore } from '../../store/useAnnotationStore';
import { useReportStore } from '../../store/useReportStore';
import { allMoodOptions } from '../../lib/mood';

export const ChatPage = () => {
  const {
    messages, sendMessage, fetchMessages, fetchOlderMessages, checkAndRefreshForNewDay,
    updateActivity, insertActivity, deleteActivity, endActivity, isLoading, isLoadingMore,
    hasMoreHistory, yesterdaySummary,
    hasInitialized, setHasInitialized, updateMessageDuration,
  } = useChatStore();
  const { addTodo, activeTodoId, completeActiveTodo, setActiveTodoId, todos } = useTodoStore();
  const stardustMemories = useStardustStore(state => state.memories);
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
  const customMoodOptions = useMoodStore(state => state.customMoodOptions);
  const addCustomMoodOption = useMoodStore(state => state.addCustomMoodOption);
  const moodNote = useMoodStore(state => state.moodNote);
  const setMoodNote = useMoodStore(state => state.setMoodNote);
  const annotations = useAnnotationStore(state => state.annotations);

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
    // 每 30 秒检查一次是否跨过凌晨
    const interval = setInterval(() => {
      checkAndRefreshForNewDay();
    }, 30_000);

    // 从后台切回时也检查
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

  // ── 跨天自动生成“前一日”日报（含今日行动分析与心情简评） ───────────
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

    // 记录加载前的滚动高度，加载后补偿位置
    const prevScrollHeight = container.scrollHeight;
    await fetchOlderMessages();

    // 使用 rAF 确保在 DOM 更新后调整滚动位置
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

        {/* ── 顶部哨兵：触发上滑加载 ── */}
        <div ref={topSentinelRef} className="h-1" />

        {/* ── 加载旧消息 Loading ── */}
        {isLoadingMore && (
          <div className="flex items-center justify-center py-3 gap-2 text-gray-400 text-sm">
            <Loader2 size={16} className="animate-spin" />
            <span>加载更多记录…</span>
          </div>
        )}

        {/* ── 没有更多历史 ── */}
        {!hasMoreHistory && messages.length > 0 && (
          <div className="flex items-center justify-center py-3 text-xs text-gray-300">
            — 已是最早的记录 —
          </div>
        )}

        {/* ── 昨日回顾引导区 ── */}
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

        {/* ── 今天没有消息时的空状态 ── */}
        {messages.length === 0 && !isLoading && hasInitialized && !yesterdaySummary && (
          <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
            <div className="text-4xl mb-3">✨</div>
            <p className="text-sm font-medium">新的一天，从一条记录开始</p>
            <p className="text-xs mt-1 text-gray-300">记录你正在做的事情</p>
          </div>
        )}

        {/* ── 消息列表（含日期分隔线）── */}
        {messages.map((msg, index) => {
          const prevMsg = messages[index - 1];
          const showDateSep = !prevMsg || !isSameDay(msg.timestamp, prevMsg.timestamp);

          return (
            <React.Fragment key={msg.id}>
              {/* 日期分隔线 */}
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
                {msg.isMood ? (
                  // Mood Record
                  <div data-message-id={msg.id} className="group relative flex items-center justify-between bg-sky-200/70 p-2 rounded-lg transition-colors">
                    <div className="flex items-center space-x-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                      <div className="flex flex-col">
                        <span className="font-mood text-sm text-gray-900" style={{ fontFamily: 'Songti SC, SimSun, STSong, serif' }}>{msg.content}</span>
                        {(() => {
                          const stardust = getStardustByMessageId(msg.id);
                          return stardust ? (
                            <div className="mt-1">
                              <StardustEmoji
                                emoji={stardust.emojiChar}
                                size="sm"
                                className="scale-90"
                                onClick={(e) => {
                                  const rect = (e.target as HTMLElement).getBoundingClientRect();
                                  setSelectedStardust({
                                    data: {
                                      emojiChar: stardust.emojiChar,
                                      message: stardust.message,
                                      alienName: stardust.alienName || 'T.S',
                                      createdAt: stardust.createdAt,
                                    },
                                    position: { x: rect.left + rect.width / 2, y: rect.top },
                                  });
                                }}
                              />
                            </div>
                          ) : null;
                        })()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-gray-500">
                        {format(msg.timestamp, 'HH:mm')}
                      </div>
                    </div>
                    <div className="absolute right-2 top-2 hidden group-hover:flex space-x-1 bg-white/80 backdrop-blur-sm rounded p-1 shadow-sm border border-gray-100">
                      <button onClick={() => handleDelete(msg.id)} className="p-1 text-gray-500 hover:text-red-600" title="删除"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ) : (
                  // Activity Record
                  <div data-message-id={msg.id} className="group relative flex items-start justify-between bg-white p-2 rounded-lg border border-gray-200 hover:border-blue-200 transition-colors">
                    <div className="flex items-start space-x-2 flex-1 min-w-0">
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={
                          (() => {
                            const label = (customMoodApplied[msg.id] && customMoodLabel[msg.id] && customMoodLabel[msg.id] !== '自定义')
                              ? customMoodLabel[msg.id]!
                              : activityMood[msg.id];
                            if (label === '焦虑') {
                              return {
                                background: 'repeating-linear-gradient(45deg,#E5E7EB 0,#E5E7EB 1px,#9CA3AF 1px,#9CA3AF 2px,#6B7280 2px,#6B7280 3px)',
                              } as React.CSSProperties;
                            }
                            return { backgroundColor: getMoodColor(label) || '#10B981' } as React.CSSProperties;
                          })()
                        }
                      />
                      <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex items-center gap-4 min-w-0">
                          <span
                            className="text-sm text-gray-900 truncate"
                            style={{ fontFamily: '"Source Han Serif SC","Noto Serif SC","Songti SC","SimSun","STSong",serif' }}
                          >
                            {msg.content}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setMoodPickerFor(msg.id);
                              setMoodPickerReadonly(false);
                              setCustomMoodInput(moodNote[msg.id] || '');
                              setCustomLabelInput(customMoodLabel[msg.id] || '');
                              setShowCustomLabelInput(false);
                            }}
                            className={cn(
                              'inline-flex items-center justify-center px-2.5 py-[3px] text-[10px] rounded-full whitespace-nowrap shadow-sm transition-colors',
                              customMoodLabel[msg.id] || activityMood[msg.id]
                                ? 'text-slate-700'
                                : 'bg-gray-50 text-gray-400 border border-gray-200'
                            )}
                            style={
                              (() => {
                                const label = (customMoodApplied[msg.id] && customMoodLabel[msg.id] && customMoodLabel[msg.id] !== '自定义')
                                  ? customMoodLabel[msg.id]!
                                  : activityMood[msg.id];
                                if (label === '焦虑') {
                                  return {
                                    background: 'repeating-linear-gradient(45deg,#E5E7EB 0,#E5E7EB 1px,#9CA3AF 1px,#9CA3AF 2px,#6B7280 2px,#6B7280 3px)',
                                    border: 'none',
                                  } as React.CSSProperties;
                                }
                                const bg = label ? getMoodColor(label) : undefined;
                                return bg ? { backgroundColor: bg, border: 'none' } as React.CSSProperties : { } as React.CSSProperties;
                              })()
                            }
                            title="调整心情标签"
                          >
                            <span style={{ fontFamily: 'Songti SC, SimSun, STSong, serif' }}>
                              {(() => {
                                const label = (customMoodApplied[msg.id] && customMoodLabel[msg.id] && customMoodLabel[msg.id] !== '自定义')
                                  ? customMoodLabel[msg.id]!
                                  : activityMood[msg.id];
                                return label || '待识别';
                              })()}
                            </span>
                          </button>
                        </div>
                        {(() => {
                          const stardust = getStardustByMessageId(msg.id);
                          return stardust ? (
                            <div className="mt-1">
                              <StardustEmoji
                                emoji={stardust.emojiChar}
                                size="sm"
                                onClick={(e) => {
                                  const rect = (e.target as HTMLElement).getBoundingClientRect();
                                  setSelectedStardust({
                                    data: {
                                      emojiChar: stardust.emojiChar,
                                      message: stardust.message,
                                      alienName: stardust.alienName || 'T.S',
                                      createdAt: stardust.createdAt,
                                    },
                                    position: { x: rect.left + rect.width / 2, y: rect.top },
                                  });
                                }}
                              />
                            </div>
                          ) : null;
                        })()}
                      </div>
                    </div>
                    <div className="text-right w-28 shrink-0 flex flex-col items-end -mt-0.5 relative">
                      <div className="flex items-center gap-1">
                        {msg.duration === undefined && (
                          <button
                            onClick={() => endActivity(msg.id)}
                            className="text-[9px] text-gray-500 border border-gray-200 rounded-full px-2 py-0.5 hover:bg-gray-50"
                          >
                            结束
                          </button>
                        )}
                        <div className="text-[10px] text-gray-500 whitespace-nowrap relative group/time cursor-pointer flex flex-col items-end">
                          <div>
                            {format(msg.timestamp, 'HH:mm')} - {msg.duration !== undefined
                              ? `${format(msg.timestamp + msg.duration * 60 * 1000, 'HH:mm')}`
                              : '进行中'}
                          </div>
                          {msg.duration !== undefined && (
                            <div className="mt-1">
                              <div
                                className="inline-flex items-center justify-center rounded-full border border-sky-300 text-sky-700 bg-white/80 text-[9px] font-semibold shadow-sm px-2 py-0.5 text-center"
                                style={{ minWidth: '9em' }}
                              >
                                {formatDuration(msg.duration)}
                              </div>
                            </div>
                          )}
                          <div className="absolute -top-4 right-0 hidden group-hover/time:flex space-x-0.5 bg-white/90 backdrop-blur-sm rounded-full p-0.5 shadow-sm border border-gray-200">
                            <button onClick={() => handleEditClick(msg)} className="p-0.5 text-gray-500 hover:text-blue-600" title="编辑"><Edit2 size={12} /></button>
                            <button onClick={() => handleInsertClick(msg)} className="p-0.5 text-gray-500 hover:text-green-600" title="在此后插入"><Plus size={12} /></button>
                            <button onClick={() => handleDelete(msg.id)} className="p-0.5 text-gray-500 hover:text-red-600" title="删除"><Trash2 size={12} /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </React.Fragment>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">{editingId ? t('chat_edit_record') : t('chat_insert_record')}</h3>
              <button onClick={() => { setEditingId(null); setInsertingAfterId(null); }} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('chat_label_content')}</label>
                <input
                  type="text"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('chat_placeholder_content')}
                />
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('chat_label_start_time')}</label>
                  <input
                    type="datetime-local"
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('chat_label_end_time')}</label>
                  <input
                    type="datetime-local"
                    value={editEndTime}
                    onChange={(e) => setEditEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
            <button
              onClick={handleSave}
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
            >
              <Save size={16} />
              <span>{t('save')}</span>
            </button>
          </div>
        </div>
      )}

      {moodPickerFor && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4"
          onClick={() => setMoodPickerFor(null)}
        >
          <div
            className="bg-pink-50 w-full max-w-xs rounded-xl p-4 shadow-lg relative border border-pink-100"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setMoodPickerFor(null)}
              className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
            <h3
              className="text-sm font-light text-gray-500 mb-3 pr-6 flex items-center gap-1.5"
              style={{ fontFamily: 'PingFang SC, -apple-system, system-ui, sans-serif' }}
            >
              <span>选择这条记录的心情</span>
              <span className="inline-flex items-center justify-center p-[3px] text-sky-400">
                <Umbrella size={12} className="stroke-[1.8] text-sky-400" />
              </span>
            </h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {allMoodOptions().map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      if (moodPickerReadonly) return;
                      if (!moodPickerFor) return;
                      setMood(moodPickerFor, opt);
                      // 不清除自定义内容，只是切换为标准标签
                      setCustomMoodApplied(moodPickerFor, false);
                      setShowCustomLabelInput(false);
                      setSelectedMoodOpt(opt);
                    }}
                    className={cn(
                      "inline-flex items-center justify-center px-2.5 py-[3px] text-[10px] rounded-full border shadow-sm transition-colors",
                      selectedMoodOpt === opt
                        ? "bg-rose-100 text-rose-700 border-rose-300 ring-1 ring-rose-200"
                        : "bg-white text-slate-700 border-gray-200 hover:bg-gray-50",
                      moodPickerReadonly && "opacity-60 cursor-not-allowed hover:bg-white"
                    )}
                    style={{ fontFamily: 'Songti SC, SimSun, STSong, serif' }}
                    disabled={moodPickerReadonly}
                  >
                    {opt}
                  </button>
                ))}
              <button
                type="button"
                onClick={() => {
                  if (moodPickerReadonly) return;
                  setShowCustomLabelInput(true);
                  const next = customMoodLabel[moodPickerFor] || customLabelInput || '自定义';
                  setCustomLabelInput(next);
                  setCustomMoodLabel(moodPickerFor, next);
                  setCustomMoodApplied(moodPickerFor, !!next && next !== '自定义');
                  if (!!next && next !== '自定义') setSelectedMoodOpt('__custom__');
                }}
                className={cn(
                  "inline-flex items-center justify-center px-2.5 py-[3px] text-[10px] rounded-full border shadow-sm transition-colors",
                  (showCustomLabelInput || (moodPickerFor && customMoodApplied[moodPickerFor]))
                    ? "bg-rose-100 text-rose-700 border-rose-300 ring-1 ring-rose-200"
                    : "bg-sky-50 text-sky-600 border-sky-200",
                  moodPickerReadonly && "opacity-60 cursor-not-allowed"
                )}
                style={{ fontFamily: 'Songti SC, SimSun, STSong, serif' }}
                disabled={moodPickerReadonly}
              >
                {!moodPickerReadonly && showCustomLabelInput ? (
                  <input
                    type="text"
                    value={customLabelInput}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCustomLabelInput(value);
                      if (moodPickerFor) {
                        setCustomMoodLabel(moodPickerFor, value.trim() || '自定义');
                        const applied = !!value.trim() && value.trim() !== '自定义';
                        setCustomMoodApplied(moodPickerFor, applied);
                        if (applied) setSelectedMoodOpt('__custom__');
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        saveCustomLabel(customLabelInput);
                      }
                    }}
                    onBlur={() => saveCustomLabel(customLabelInput)}
                    className="w-16 bg-transparent text-[10px] text-rose-700 focus:outline-none"
                    autoFocus
                  />
                ) : (
                  customMoodLabel[moodPickerFor] || '自定义'
                )}
              </button>
            </div>
            <div className="border-t border-gray-100 pt-3 mt-2">
              <div
                className="flex items-center gap-1 text-sm font-light text-gray-500 mb-1"
                style={{ fontFamily: 'PingFang SC, -apple-system, system-ui, sans-serif' }}
              >
                <span>心情记录</span>
                {!moodPickerReadonly && <Pencil size={12} className="stroke-[1.8] text-sky-400" />}
              </div>
              <div className="mb-1">
                <textarea
                  value={customMoodInput}
                  onChange={(e) => {
                    if (moodPickerReadonly) return;
                    const value = e.target.value;
                    setCustomMoodInput(value);
                    if (moodPickerFor) {
                      setMoodNote(moodPickerFor, value);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (!moodPickerReadonly && e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      setMoodPickerFor(null);
                    }
                  }}
                  className={`w-full border rounded-lg px-2 py-1 text-xs resize-none max-h-24 overflow-y-auto leading-snug ${moodPickerReadonly ? 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed' : 'border-gray-200 focus:outline-none focus:ring-1 focus:ring-rose-300'}`}
                  readOnly={moodPickerReadonly}
                  disabled={moodPickerReadonly}
                  rows={2}
                  placeholder="写下你做这件事时的心情..."
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 p-4 pb-safe">
        <div className={cn(
          "flex items-center space-x-2 rounded-full px-4 py-2 transition-all duration-300",
          isMoodMode
            ? "bg-pink-50 border border-pink-400"
            : "bg-gray-100"
        )}>
          <button
            onClick={() => setIsMoodMode(!isMoodMode)}
            className={cn(
              "transition-all duration-300",
              isMoodMode
                ? "text-pink-500 animate-pulse scale-110"
                : "text-gray-400 hover:text-gray-600"
            )}
            title={isMoodMode ? t('chat_switch_to_activity') : t('chat_switch_to_mood')}
          >
            <Heart size={18} fill={isMoodMode ? "currentColor" : "none"} />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isMoodMode ? t('chat_placeholder_mood') : t('chat_placeholder_activity')}
            className="flex-1 bg-transparent border-none focus:outline-none text-sm"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-300"
          >
            {isLoading ? <Activity className="animate-spin" size={16} /> : <Send size={16} />}
          </button>
        </div>
      </div>

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
