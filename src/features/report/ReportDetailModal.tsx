import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { endOfDay, format, isSameDay, startOfDay } from 'date-fns';
import { enUS, it as itLocale, zhCN } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { Report } from '../../store/useReportStore';
import { useChatStore } from '../../store/useChatStore';
import { useMoodStore } from '../../store/useMoodStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useTodoStore } from '../../store/useTodoStore';
import { useGrowthStore } from '../../store/useGrowthStore';
import type { DailyPlantRecord } from '../../types/plant';
import type { MoodDistributionItem } from './reportPageHelpers';
import type { ActivityDistributionItem } from './reportPageHelpers';
import { getDailyActivityDistribution, getDailyMoodDistribution, getMessagesForReport } from './reportPageHelpers';
import { callPlantGenerateAPI, callPlantHistoryAPI, callShortInsightAPI } from '../../api/client';
import { getMoodDisplayLabel } from '../../lib/moodOptions';
import { computeDailyTodoStats, generateActionSummary, generateMoodSummary } from '../../store/reportHelpers';
import { PlantImage } from './plant/PlantImage';
import growthStarImage from '../../assets/growth/growth-star.png';
import {
  DonutChart, type DataItem,
  ACTIVITY_I18N_KEYS, ACTIVITY_UI_COLORS, MOOD_UI_COLORS,
} from './DiaryDonutChart';

interface ReportDetailModalProps {
  selectedReport: Report | null;
  isPlus: boolean;
  onUpgradeClick: () => void;
  dailyMoodDistribution: MoodDistributionItem[];
  onClose: () => void;
  onBack?: () => void;
  onOpenPlantCard?: (plant: DailyPlantRecord) => void;
  onShowTaskList: (type: 'completed' | 'total') => void;
  generateAIDiary: (reportId: string) => Promise<void>;
  initialPage?: 0 | 1;
  readOnly?: boolean;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  canNavigateNext?: boolean;
}

type Lang = 'zh' | 'en' | 'it';
type ReportGeneratingVariantKey =
  | 'report_generating_variant_1'
  | 'report_generating_variant_2'
  | 'report_generating_variant_3'
  | 'report_generating_variant_4';

const REPORT_GENERATING_VARIANTS: ReportGeneratingVariantKey[] = [
  'report_generating_variant_1',
  'report_generating_variant_2',
  'report_generating_variant_3',
  'report_generating_variant_4',
];

function getCompanionName(mode: string): string {
  if (mode === 'agnes') return 'Agnes';
  if (mode === 'zep') return 'Zep';
  if (mode === 'momo') return 'Momo';
  return 'Van';
}


const COPY: Record<Lang, {
  pageTitle: string;
  sectionActivity: string;
  sectionMood: string;
  sectionTodo: string;
  sectionHabits: string;
  sectionObservation: string;
  sectionMyDiary: string;
  activityLine1: string;
  moodLine1: string;
  todoFallback: string;
  habitsFallback: string;
  observationFallback: string;
  diaryPlaceholder: string;
}> = {
  zh: {
    pageTitle: '日记',
    sectionActivity: '活动',
    sectionMood: '情绪',
    sectionTodo: '待办',
    sectionHabits: '习惯',
    sectionObservation: '观察日记',
    sectionMyDiary: '我的日记',
    activityLine1: '今天主要精力投入在工作上',
    moodLine1: '整体情绪比较轻松愉快',
    todoFallback: '你今天做得很好',
    habitsFallback: '继续保持，进度很稳',
    observationFallback:
      '今天看着这株植物，叶片舒展而有层次，光线落在叶面上很温柔。它安静地生长，也像你今天的状态一样，慢慢变得更稳。愿你继续保持这份耐心与柔软，在自己的节奏里往前走。',
    diaryPlaceholder: '今天还没有写下内容。',
  },
  en: {
    pageTitle: 'diary',
    sectionActivity: 'activity',
    sectionMood: 'mood',
    sectionTodo: 'to-do',
    sectionHabits: 'habits',
    sectionObservation: 'observation',
    sectionMyDiary: 'my diary',
    activityLine1: 'Mostly working today',
    moodLine1: 'Feeling joyful most of the day',
    todoFallback: 'You did great today',
    habitsFallback: 'Nice rhythm, keep going',
    observationFallback:
      'Dear friend, I came to your little room today and was drawn to the photos on the windowsill. Its lush green leaves spread out in layers, each one clear and tender under the light. Looking at this plant, I feel your life is quietly growing too, just like it. I hope you always keep this patience and tenderness, with your plants and with yourself.',
    diaryPlaceholder: 'No diary content yet.',
  },
  it: {
    pageTitle: 'diario',
    sectionActivity: 'attivita',
    sectionMood: 'umore',
    sectionTodo: 'to-do',
    sectionHabits: 'abitudini',
    sectionObservation: 'osservazione',
    sectionMyDiary: 'il mio diario',
    activityLine1: 'Oggi soprattutto lavoro',
    moodLine1: 'Umore positivo per gran parte della giornata',
    todoFallback: 'Hai fatto un ottimo lavoro oggi',
    habitsFallback: 'Continua cosi, ottimo passo',
    observationFallback:
      'Oggi, guardando questa pianta, ho visto foglie aperte e piene di vita, illuminate da una luce morbida. Cresce in silenzio, con costanza, proprio come stai facendo tu. Ti auguro di mantenere sempre questa pazienza e questa gentilezza, con le tue piante e con te stessa.',
    diaryPlaceholder: 'Nessun contenuto del diario per ora.',
  },
};


function clampInsightText(raw: string, maxChars = 20): string {
  const text = raw.trim().replace(/\s+/g, ' ');
  if (!text) return '';
  const chars = Array.from(text);
  if (chars.length <= maxChars) return text;
  return `${chars.slice(0, maxChars).join('')}…`;
}

function isLikelyLegacyClampedSummary(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const chars = Array.from(trimmed);
  if (chars.length < 50) return false;
  const tail = chars[chars.length - 1] || '';
  return !/[。！？.!?…]$/.test(tail);
}

function toPercent(rate: number): number {
  if (!Number.isFinite(rate)) return 0;
  return Math.max(0, Math.min(100, Math.round(rate * 100)));
}

function buildTodoSummary(params: {
  lang: Lang;
  completed: number;
  total: number;
  completionRate: number;
  completedTitles: string[];
  dominantActivity?: { type: string; percent: number };
}): string {
  const {
    lang,
    completed,
    total,
    completionRate,
    completedTitles,
    dominantActivity,
  } = params;
  const rate = toPercent(completionRate);
  const topType = dominantActivity?.type || (lang === 'zh' ? '无' : lang === 'it' ? 'nessuna' : 'none');
  const topPercent = Math.max(0, Math.min(100, Math.round(dominantActivity?.percent ?? 0)));

  if (lang === 'zh') {
    const tasks = completedTitles.slice(0, 3).join('、') || '无';
    return `待办完成${completed}/${total}(${rate}%)；完成项:${tasks}；时间重心:${topType}${topPercent}%`;
  }
  if (lang === 'it') {
    const tasks = completedTitles.slice(0, 3).join(', ') || 'nessuna';
    return `Todo ${completed}/${total} (${rate}%). Svolte: ${tasks}. Tempo su ${topType} ${topPercent}%.`;
  }
  const tasks = completedTitles.slice(0, 3).join(', ') || 'none';
  return `Todo ${completed}/${total} (${rate}%). Done: ${tasks}. Time focus: ${topType} ${topPercent}%.`;
}

function buildHabitSummary(params: {
  lang: Lang;
  habitDone: number;
  habitTotal: number;
  goalDone: number;
  goalTotal: number;
  starsToday: number;
}): string {
  const { lang, habitDone, habitTotal, goalDone, goalTotal, starsToday } = params;
  const total = habitTotal + goalTotal;
  const done = habitDone + goalDone;
  const rate = total > 0 ? toPercent(done / total) : 0;

  if (lang === 'zh') {
    return `习惯${habitDone}/${habitTotal}，目标${goalDone}/${goalTotal}，今日星星${starsToday}颗，总体完成${rate}%`;
  }
  if (lang === 'it') {
    return `Abitudini ${habitDone}/${habitTotal}, obiettivi ${goalDone}/${goalTotal}, stelle oggi ${starsToday}, completamento ${rate}%.`;
  }
  return `Habits ${habitDone}/${habitTotal}, goals ${goalDone}/${goalTotal}, stars today ${starsToday}, completion ${rate}%.`;
}


function NavBar({
  title,
  onLeft,
  onRight,
  rightDisabled,
  onClose,
}: {
  title: string;
  onLeft: () => void;
  onRight: () => void;
  rightDisabled: boolean;
  onClose: () => void;
}) {
  return (
    <div className="h-12 flex items-center justify-between flex-shrink-0" style={{ paddingLeft: '16px', paddingRight: '16px' }}>
      <button className="p-1" onClick={onLeft}>
        <ChevronLeft size={24} strokeWidth={1.5} style={{ color: '#1A1A1A' }} />
      </button>
      <h2 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>{title}</h2>
      {rightDisabled ? (
        <button className="p-1" onClick={onClose}>
          <X size={22} strokeWidth={1.5} style={{ color: '#1A1A1A' }} />
        </button>
      ) : (
        <button className="p-1" onClick={onRight}>
          <ChevronRight size={24} strokeWidth={1.5} style={{ color: '#1A1A1A' }} />
        </button>
      )}
    </div>
  );
}

function DateHeader({ date }: { date: string }) {
  return (
    <div style={{ flexShrink: 0, marginBottom: '8px' }}>
      <h1 className="text-center font-medium" style={{ fontSize: '14px', color: '#1A1A1A', marginBottom: '8px', fontFamily: 'Abhaya Libre, serif' }}>
        {date}
      </h1>
      <div style={{ borderTop: '0.5px solid #AEAABF' }} />
    </div>
  );
}

function WaveDivider() {
  return (
    <div
      style={{
        flexShrink: 0,
        height: '1px',
        backgroundImage: 'repeating-linear-gradient(90deg, #D0D0D0 0, #D0D0D0 3px, transparent 0, transparent 7px)',
        margin: '2px 0',
      }}
    />
  );
}

function SectionRow({ left, lines }: { left: React.ReactNode; lines: string[] }) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 8px 1fr' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>{left}</div>
      <div />
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px', overflow: 'hidden' }}>
        {lines.map((line, index) => (
          <div key={index} className="text-xs leading-relaxed" style={{ color: '#1A1A1A', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{line}</div>
        ))}
      </div>
    </div>
  );
}

export const ReportDetailModal: React.FC<ReportDetailModalProps> = ({
  selectedReport,
  isPlus,
  onUpgradeClick,
  dailyMoodDistribution: _dailyMoodDistribution,
  onClose,
  onBack,
  onOpenPlantCard,
  onShowTaskList: _onShowTaskList,
  generateAIDiary: _generateAIDiary,
  initialPage,
  readOnly: _readOnly,
  onNavigatePrev,
  onNavigateNext,
  canNavigateNext,
}) => {
  const { t, i18n } = useTranslation();
  const chatMessages = useChatStore((state) => state.messages);
  const dateCache = useChatStore((state) => state.dateCache);
  const activityMood = useMoodStore((state) => state.activityMood);
  const customMoodLabel = useMoodStore((state) => state.customMoodLabel);
  const customMoodApplied = useMoodStore((state) => state.customMoodApplied);
  const todos = useTodoStore((state) => state.todos);
  const bottles = useGrowthStore((state) => state.bottles);
  const aiMode = useAuthStore((state) => state.preferences.aiMode);
  const pagesRef = useRef<HTMLDivElement | null>(null);
  const [activePage, setActivePage] = useState(initialPage ?? 0);
  const [todoInsight, setTodoInsight] = useState('');
  const [habitInsight, setHabitInsight] = useState('');
  const [dayPlant, setDayPlant] = useState<DailyPlantRecord | null>(null);
  const [diaryActionHint, setDiaryActionHint] = useState<string | null>(null);
  const [isDiaryGenerating, setIsDiaryGenerating] = useState(false);
  const [reportGeneratingVariantKey, setReportGeneratingVariantKey] =
    useState<ReportGeneratingVariantKey>(REPORT_GENERATING_VARIANTS[0]);
  const plantAutoAttemptedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const page = initialPage ?? 0;
    setActivePage(page);
    requestAnimationFrame(() => {
      if (!pagesRef.current) return;
      pagesRef.current.scrollLeft = page === 1 ? pagesRef.current.clientWidth : 0;
    });
  }, [selectedReport?.id, initialPage]);

  useEffect(() => {
    if (selectedReport?.analysisStatus !== 'generating') return;
    const randomIndex = Math.floor(Math.random() * REPORT_GENERATING_VARIANTS.length);
    setReportGeneratingVariantKey(REPORT_GENERATING_VARIANTS[randomIndex]);
  }, [selectedReport?.id, selectedReport?.analysisStatus]);

  const lang = useMemo<Lang>(() => {
    const raw = i18n.language?.split('-')[0] ?? 'en';
    if (raw === 'zh' || raw === 'it') return raw;
    return 'en';
  }, [i18n.language]);

  const copy = COPY[lang];

  const reportMessages = useMemo(
    () => getMessagesForReport(chatMessages, dateCache, selectedReport),
    [chatMessages, dateCache, selectedReport],
  );
  const activityDistribution = useMemo(
    () => getDailyActivityDistribution(reportMessages, selectedReport),
    [reportMessages, selectedReport],
  );
  const moodDistribution = useMemo(
    () => getDailyMoodDistribution(reportMessages, { activityMood, customMoodLabel, customMoodApplied }, selectedReport),
    [reportMessages, activityMood, customMoodLabel, customMoodApplied, selectedReport],
  );
  const dayMinutes = 24 * 60;
  const isTodayReport = useMemo(
    () => Boolean(selectedReport?.date && isSameDay(new Date(selectedReport.date), new Date())),
    [selectedReport?.date],
  );

  const liveTodayTodoStats = useMemo(() => {
    if (!isTodayReport || !selectedReport?.date) return null;
    const targetDate = new Date(selectedReport.date);
    const dailyStats = computeDailyTodoStats(
      todos,
      bottles.map((b) => ({ id: b.id, name: b.name, type: b.type, stars: b.stars })),
      startOfDay(targetDate),
      endOfDay(targetDate),
    );
    const oneTimeTotal = dailyStats.oneTimeTasks.high.total + dailyStats.oneTimeTasks.medium.total + dailyStats.oneTimeTasks.low.total;
    const oneTimeCompleted = dailyStats.oneTimeTasks.high.completed + dailyStats.oneTimeTasks.medium.completed + dailyStats.oneTimeTasks.low.completed;
    const total = oneTimeTotal + dailyStats.independentRecurring.total + dailyStats.habitCheckin.length + dailyStats.goalProgress.length;
    const completed = oneTimeCompleted + dailyStats.independentRecurring.completed + dailyStats.habitCheckin.filter((item) => item.done).length + dailyStats.goalProgress.filter((item) => item.doneToday).length;
    return {
      completed,
      total,
      oneTimeCompletedTitles: dailyStats.oneTimeTasks.completedTitles,
      habitDoneCount: dailyStats.habitCheckin.filter((item) => item.done).length,
      habitTotalCount: dailyStats.habitCheckin.length,
      goalDoneCount: dailyStats.goalProgress.filter((item) => item.doneToday).length,
      goalTotalCount: dailyStats.goalProgress.length,
    };
  }, [isTodayReport, selectedReport?.date, todos, bottles]);

  const todoCompleted = liveTodayTodoStats?.completed ?? selectedReport?.stats?.completedTodos ?? 0;
  const todoTotal = liveTodayTodoStats?.total ?? selectedReport?.stats?.totalTodos ?? 0;
  const todoCompletionRate = todoTotal > 0
    ? todoCompleted / todoTotal
    : Math.max(0, Math.min(1, selectedReport?.stats?.completionRate ?? 0));
  const todoCompletedTitles = liveTodayTodoStats?.oneTimeCompletedTitles ?? selectedReport?.stats?.oneTimeTasks?.completedTitles ?? [];
  const dominantActivity = useMemo(() => {
    if (activityDistribution.length === 0) return undefined;
    const top = activityDistribution.reduce((best, current) => (
      current.minutes > best.minutes ? current : best
    ), activityDistribution[0]);
    return {
      type: t(ACTIVITY_I18N_KEYS[top.type] || top.type),
      percent: dayMinutes > 0 ? (top.minutes / dayMinutes) * 100 : 0,
    };
  }, [activityDistribution, t]);

  const habitDoneCount = liveTodayTodoStats?.habitDoneCount ?? selectedReport?.stats?.habitCheckin?.filter((item) => item.done).length ?? 0;
  const habitTotalCount = liveTodayTodoStats?.habitTotalCount ?? selectedReport?.stats?.habitCheckin?.length ?? 0;
  const goalDoneCount = liveTodayTodoStats?.goalDoneCount ?? selectedReport?.stats?.goalProgress?.filter((item) => item.doneToday).length ?? 0;
  const goalTotalCount = liveTodayTodoStats?.goalTotalCount ?? selectedReport?.stats?.goalProgress?.length ?? 0;
  const todayStars = habitDoneCount + goalDoneCount;

  const handleGenerateDiaryClick = useCallback(async () => {
    if (!selectedReport) return;
    if (new Date().getHours() < 20) {
      setDiaryActionHint(t('report_early_tip'));
      return;
    }
    setDiaryActionHint(null);
    setIsDiaryGenerating(true);
    try {
      await _generateAIDiary(selectedReport.id);
    } finally {
      setIsDiaryGenerating(false);
    }
  }, [_generateAIDiary, selectedReport, t]);

  const todoInsightSummary = useMemo(() => {
    if (todoTotal <= 0) return '';
    return buildTodoSummary({
      lang,
      completed: todoCompleted,
      total: todoTotal,
      completionRate: todoCompletionRate,
      completedTitles: todoCompletedTitles,
      dominantActivity,
    });
  }, [lang, todoCompleted, todoTotal, todoCompletionRate, todoCompletedTitles, dominantActivity]);

  const habitInsightSummary = useMemo(() => {
    if (habitTotalCount + goalTotalCount <= 0) return '';
    return buildHabitSummary({
      lang,
      habitDone: habitDoneCount,
      habitTotal: habitTotalCount,
      goalDone: goalDoneCount,
      goalTotal: goalTotalCount,
      starsToday: todayStars,
    });
  }, [lang, habitDoneCount, habitTotalCount, goalDoneCount, goalTotalCount, todayStars]);

  useEffect(() => {
    let cancelled = false;
    setTodoInsight('');
    setHabitInsight('');

    if (todoInsightSummary) {
      void callShortInsightAPI({ kind: 'todo', summary: todoInsightSummary, lang }).then((text) => {
        if (!cancelled && text) setTodoInsight(clampInsightText(text, 20));
      });
    }
    if (habitInsightSummary) {
      void callShortInsightAPI({ kind: 'habit', summary: habitInsightSummary, lang }).then((text) => {
        if (!cancelled && text) setHabitInsight(clampInsightText(text, 20));
      });
    }

    return () => {
      cancelled = true;
    };
  }, [selectedReport?.id, todoInsightSummary, habitInsightSummary, lang]);

  useEffect(() => {
    let cancelled = false;
    setDayPlant(null);

    const date = selectedReport?.date;
    if (!date) return () => { cancelled = true; };

    const dayDate = new Date(date);
    const dayStr = format(dayDate, 'yyyy-MM-dd');
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const isPastDay = dayStr < todayStr;
    const langRaw = i18n.language?.toLowerCase() ?? 'en';
    const plantLang: 'zh' | 'en' | 'it' = langRaw.startsWith('zh')
      ? 'zh'
      : langRaw.startsWith('it')
        ? 'it'
        : 'en';

    void callPlantHistoryAPI(dayStr, dayStr)
      .then(async (res) => {
        if (cancelled) return;
        if (res.success && res.records.length > 0) {
          setDayPlant(res.records[0]);
          return;
        }
        if (!isPastDay) return;
        if (plantAutoAttemptedRef.current.has(dayStr)) return;

        plantAutoAttemptedRef.current.add(dayStr);
        try {
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
          const generated = await callPlantGenerateAPI({
            date: dayStr,
            timezone,
            lang: plantLang,
          });
          if (cancelled) return;
          if (generated.plant) {
            setDayPlant(generated.plant);
            return;
          }
          if (generated.status === 'generated' || generated.status === 'already_generated') {
            const refreshed = await callPlantHistoryAPI(dayStr, dayStr);
            if (!cancelled && refreshed.success && refreshed.records.length > 0) {
              setDayPlant(refreshed.records[0]);
            }
          }
        } catch {
          // keep placeholder when generation fails or empty day
        }
      })
      .catch(() => {
        if (!cancelled) setDayPlant(null);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedReport?.id, selectedReport?.date, i18n.language]);

  const dateLabel = useMemo(() => {
    const date = selectedReport?.date ? new Date(selectedReport.date) : new Date();
    const locale = lang === 'zh' ? zhCN : lang === 'it' ? itLocale : enUS;
    const pattern = lang === 'zh' ? 'yyyy年M月d日 EEEE' : 'EEEE, MMMM d, yyyy';
    return format(date, pattern, { locale });
  }, [selectedReport?.date, lang]);

  const scrollToPage = useCallback((page: 0 | 1) => {
    const el = pagesRef.current;
    if (!el) return;
    el.scrollTo({ left: page === 1 ? el.clientWidth : 0, behavior: 'smooth' });
    setActivePage(page);
  }, []);

  const onScroll = useCallback(() => {
    const el = pagesRef.current;
    if (!el) return;
    const next = Math.round(el.scrollLeft / el.clientWidth) >= 1 ? 1 : 0;
    setActivePage(next);
  }, []);

  const handlePrev = useCallback(() => {
    if (onNavigatePrev) {
      onNavigatePrev();
      return;
    }
    if (activePage === 1) {
      scrollToPage(0);
      return;
    }
    (onBack ?? onClose)();
  }, [onNavigatePrev, activePage, scrollToPage, onBack, onClose]);

  const handleNext = useCallback(() => {
    if (onNavigateNext) {
      if (canNavigateNext !== false) onNavigateNext();
      return;
    }
    if (activePage === 0) scrollToPage(1);
  }, [onNavigateNext, canNavigateNext, activePage, scrollToPage]);

  const nextDisabled = useMemo(() => {
    if (onNavigateNext) return canNavigateNext === false;
    return activePage === 1;
  }, [onNavigateNext, canNavigateNext, activePage]);

  const observationText = useMemo(() => {
    const isGenerating = selectedReport?.analysisStatus === 'generating';
    if (isGenerating) {
      return t(reportGeneratingVariantKey, { companion: getCompanionName(aiMode) });
    }
    // Free: show loading state (not fallback) until teaser is generated, to avoid text flicker
    const isFreeWaitingForTeaser = !isPlus && !selectedReport?.teaserText?.trim() && selectedReport?.analysisStatus !== 'error';
    if (isFreeWaitingForTeaser) {
      return t(reportGeneratingVariantKey, { companion: getCompanionName(aiMode) });
    }
    const raw = isPlus
      ? selectedReport?.aiAnalysis?.trim()
      : selectedReport?.teaserText?.trim();
    const text = raw && raw.length > 0 ? raw : copy.observationFallback;
    return text.replace(/\s+/g, ' ');
  }, [
    aiMode,
    copy.observationFallback,
    isPlus,
    reportGeneratingVariantKey,
    selectedReport?.aiAnalysis,
    selectedReport?.analysisStatus,
    selectedReport?.teaserText,
    t,
  ]);
  const shouldShowUpgradeMask = !isPlus && selectedReport?.analysisStatus !== 'generating';

  const myDiaryText = useMemo(() => {
    const raw = selectedReport?.userNote?.trim();
    return raw && raw.length > 0 ? raw : copy.diaryPlaceholder;
  }, [selectedReport?.userNote, copy.diaryPlaceholder]);

  const activityChartData = useMemo<DataItem[]>(() => {
    if (activityDistribution.length === 0) return [{ name: t('no_data'), value: 100, color: '#E5E7EB' }];
    const top = activityDistribution.slice(0, 5);
    const total = top.reduce((sum, item) => sum + item.minutes, 0) || 1;
    const withPercent = top.map((item, index) => ({
      name: t(ACTIVITY_I18N_KEYS[item.type] || item.type).toLowerCase(),
      value: Math.max(1, Math.round((item.minutes / total) * 100)),
      color: ACTIVITY_UI_COLORS[index] || ACTIVITY_UI_COLORS[ACTIVITY_UI_COLORS.length - 1],
    }));
    const sumPercent = withPercent.reduce((sum, item) => sum + item.value, 0);
    if (sumPercent !== 100 && withPercent.length > 0) withPercent[0].value += (100 - sumPercent);
    return withPercent;
  }, [activityDistribution, t]);

  const moodChartData = useMemo<DataItem[]>(() => {
    if (moodDistribution.length === 0) return [{ name: t('no_data'), value: 100, color: '#E5E7EB' }];
    const top = moodDistribution.slice(0, 4);
    const total = top.reduce((sum, item) => sum + item.minutes, 0) || 1;
    const withPercent = top.map((item, index) => ({
      name: getMoodDisplayLabel(item.mood, t).toLowerCase(),
      value: Math.max(1, Math.round((item.minutes / total) * 100)),
      color: MOOD_UI_COLORS[index] || MOOD_UI_COLORS[MOOD_UI_COLORS.length - 1],
    }));
    const sumPercent = withPercent.reduce((sum, item) => sum + item.value, 0);
    if (sumPercent !== 100 && withPercent.length > 0) withPercent[0].value += (100 - sumPercent);
    return withPercent;
  }, [moodDistribution, t]);

  const actionSummaryText = useMemo(() => {
    const stored = typeof selectedReport?.stats?.actionSummary === 'string'
      ? selectedReport.stats.actionSummary.trim()
      : '';
    if (stored && !isLikelyLegacyClampedSummary(stored)) return stored;

    const source = selectedReport?.stats?.actionAnalysis;
    if (!source || source.length === 0) return stored;
    return generateActionSummary(source, lang);
  }, [selectedReport?.stats?.actionSummary, selectedReport?.stats?.actionAnalysis, lang]);

  const moodSummaryText = useMemo(() => {
    const stored = typeof selectedReport?.stats?.moodSummary === 'string'
      ? selectedReport.stats.moodSummary.trim()
      : '';
    if (stored && !isLikelyLegacyClampedSummary(stored)) return stored;

    const source = selectedReport?.stats?.moodDistribution;
    if (!source || source.length === 0) return stored;
    return generateMoodSummary(source, lang);
  }, [selectedReport?.stats?.moodSummary, selectedReport?.stats?.moodDistribution, lang]);

  const activityAnalysisLine1 = actionSummaryText || copy.activityLine1;
  const moodAnalysisLine1 = moodSummaryText || copy.moodLine1;
  const maxAct = activityChartData.reduce((m, c, i, arr) => (c.value > arr[m].value ? i : m), 0);
  const maxMood = moodChartData.reduce((m, c, i, arr) => (c.value > arr[m].value ? i : m), 0);
  const todoSegments = 12;
  const todoLitCount = todoTotal > 0
    ? Math.min(
      todoSegments,
      Math.max(todoCompletionRate > 0 ? 1 : 0, Math.round(todoCompletionRate * todoSegments)),
    )
    : 0;
  const todoAnalysisLine1 = todoInsight || copy.todoFallback;
  const todoAnalysisLine2 = todoTotal > 0 ? `${todoCompleted}/${todoTotal}` : '';
  const habitAnalysisLine1 = habitInsight || copy.habitsFallback;
  const habitAnalysisLine2 = t('diary_star_count', { count: todayStars });

  if (!selectedReport) return null;

  return (
    <div
      className="fixed inset-0 z-[60]"
      style={{
        background: '#FFFFFF',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div
        ref={pagesRef}
        onScroll={onScroll}
        className="flex h-full overflow-x-scroll [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: 'x mandatory' }}
      >
          <div className="w-full h-full shrink-0 flex flex-col overflow-hidden" style={{ background: '#FFFFFF', scrollSnapAlign: 'start' }}>
            <NavBar title={copy.pageTitle} onLeft={handlePrev} onRight={handleNext} rightDisabled={nextDisabled} onClose={onClose} />

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: '12px', paddingBottom: '12px', paddingLeft: '16px', paddingRight: '16px', overflow: 'hidden', minHeight: 0 }}>
              <DateHeader date={dateLabel} />

              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <div className="text-sm font-bold" style={{ flexShrink: 0, alignSelf: 'flex-start', padding: '1px 6px' }}>{copy.sectionActivity}</div>
                  <SectionRow
                    left={<DonutChart data={activityChartData} maxIndex={maxAct} chartId="diary-activity" labelColor="#2D5A30" />}
                    lines={[activityAnalysisLine1]}
                  />
                </div>

                <WaveDivider />

                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <div className="text-sm font-bold" style={{ flexShrink: 0, alignSelf: 'flex-start', padding: '1px 6px' }}>{copy.sectionMood}</div>
                  <SectionRow
                    left={<DonutChart data={moodChartData} maxIndex={maxMood} chartId="diary-mood" labelColor="#A0304A" />}
                    lines={[moodAnalysisLine1]}
                  />
                </div>

                <WaveDivider />

                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <div className="text-sm font-bold" style={{ flexShrink: 0, alignSelf: 'flex-start', padding: '1px 6px' }}>{copy.sectionTodo}</div>
                  <SectionRow
                    left={(
                      <div style={{ display: 'flex', gap: '5px' }}>
                        {Array.from({ length: todoSegments }).map((_, index) => (
                          <div key={index} style={{ width: '6px', height: '3px', borderRadius: '1px', backgroundColor: index < todoLitCount ? '#F5C842' : '#EDE0B0' }} />
                        ))}
                      </div>
                    )}
                    lines={[todoAnalysisLine1, todoAnalysisLine2].filter(Boolean)}
                  />
                </div>

                <WaveDivider />

                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <div className="text-sm font-bold" style={{ flexShrink: 0, alignSelf: 'flex-start', padding: '1px 6px' }}>{copy.sectionHabits}</div>
                  <SectionRow
                    left={(
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                        {[0, 1].map((row) => (
                          <div key={row} style={{ display: 'flex', gap: '4px' }}>
                            {Array.from({ length: 5 }).map((_, col) => {
                              const index = row * 5 + col;
                              return (
                                <img
                                  key={col}
                                  src={growthStarImage}
                                  alt="star"
                                  style={{ width: '20px', height: '20px', objectFit: 'contain', opacity: index < todayStars ? 1 : 0.25 }}
                                />
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    )}
                    lines={[habitAnalysisLine1, habitAnalysisLine2].filter(Boolean)}
                  />
                </div>
              </div>

              <div style={{ flexShrink: 0, borderTop: '0.5px solid #D0D0D0', marginTop: '4px' }} />
            </div>
          </div>

          <div className="w-full h-full shrink-0 flex flex-col overflow-hidden" style={{ background: '#FFFFFF', scrollSnapAlign: 'start' }}>
            <NavBar title={copy.pageTitle} onLeft={handlePrev} onRight={handleNext} rightDisabled={nextDisabled} onClose={onClose} />

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: '12px', paddingBottom: '12px', paddingLeft: '16px', paddingRight: '16px', overflow: 'hidden', minHeight: 0 }}>
              <DateHeader date={dateLabel} />

              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                <div style={{ flex: 2, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <div className="text-sm font-bold" style={{ flexShrink: 0, padding: '1px 0' }}>{copy.sectionObservation}</div>

                  <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', paddingRight: 8 }}>
                    <div style={{ height: '100%', overflow: 'hidden' }}>
                      <div style={{ float: 'left', width: 150, marginRight: 8, background: '#FFFFFF' }}>
                        {dayPlant ? (
                          <button
                            type="button"
                            onClick={() => onOpenPlantCard?.(dayPlant)}
                            style={{ width: '100%', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}
                          >
                            <PlantImage
                              plantId={dayPlant.plantId}
                              rootType={dayPlant.rootType}
                              plantStage={dayPlant.plantStage}
                              imgClassName="w-full h-auto"
                            />
                          </button>
                        ) : (
                          <div style={{ width: '100%', height: 150 }} />
                        )}
                      </div>
                      {!shouldShowUpgradeMask ? (
                        <p className="text-xs leading-relaxed" style={{ margin: 0, padding: 0, color: '#1A1A1A', wordBreak: 'break-all', overflowWrap: 'break-word', whiteSpace: 'pre-wrap' }}>
                          {observationText}
                        </p>
                      ) : (
                        <div style={{ position: 'relative', minHeight: 180 }}>
                          <p className="text-xs leading-relaxed" style={{ margin: 0, padding: 0, color: '#1A1A1A', wordBreak: 'break-all', overflowWrap: 'break-word', whiteSpace: 'pre-wrap' }}>
                            {observationText}
                          </p>
                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              background: 'linear-gradient(180deg, rgba(255,255,255,0) 35%, rgba(255,255,255,0.85) 65%, rgba(255,255,255,1) 100%)',
                              display: 'flex',
                              alignItems: 'flex-end',
                              justifyContent: 'center',
                              paddingBottom: 8,
                            }}
                          >
                            <button
                              type="button"
                              onClick={onUpgradeClick}
                              className="text-xs font-bold"
                            style={{
                                border: 'none',
                                borderRadius: 999,
                                background: '#4f46e5',
                                color: '#fff',
                                padding: '6px 12px',
                              }}
                            >
                              {t('report_teaser_unlock')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <WaveDivider />

                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <div className="text-sm font-bold" style={{ flexShrink: 0, padding: '1px 0' }}>{copy.sectionMyDiary}</div>
                  <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
                    <textarea
                      readOnly
                      value={myDiaryText}
                      className="text-xs"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        outline: 'none',
                        resize: 'none',
                        background: 'transparent',
                        lineHeight: '18px',
                        color: selectedReport.userNote?.trim() ? '#1A1A1A' : '#C8C8C0',
                        padding: '0 4px 0 2px',
                        margin: 0,
                        fontFamily: 'inherit',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ flexShrink: 0, borderTop: '0.5px solid #D0D0D0', marginTop: '4px' }} />
                      </div>
                    </div>
                  </div>

                  {isTodayReport ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingTop: 8 }}>
                      <button
                        type="button"
                        onClick={() => { void handleGenerateDiaryClick(); }}
                        disabled={isDiaryGenerating}
                        className="rounded-full px-5 py-1.5 text-[13px] font-medium transition active:opacity-70 disabled:opacity-55 disabled:cursor-not-allowed"
                        style={{ background: 'rgba(144, 212, 122, 0.2)', color: '#5F7A63', border: 'none', boxShadow: '0px 2px 2px #C8C8C8' }}
                      >
                        {isDiaryGenerating ? t('report_generating', { companion: getCompanionName(aiMode) }) : t('report_generate_button')}
                      </button>
                      {diaryActionHint ? (
                        <p className="text-[10px] font-medium text-center" style={{ color: '#5f6f65', margin: 0 }}>
                          {diaryActionHint}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
  );
};
