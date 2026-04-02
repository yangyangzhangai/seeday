import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { enUS, it as itLocale, zhCN } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Report } from '../../store/useReportStore';
import { useChatStore } from '../../store/useChatStore';
import { useMoodStore } from '../../store/useMoodStore';
import type { DailyPlantRecord } from '../../types/plant';
import type { MoodDistributionItem } from './reportPageHelpers';
import type { ActivityDistributionItem } from './reportPageHelpers';
import { getDailyActivityDistribution, getDailyMoodDistribution, getMessagesForReport } from './reportPageHelpers';
import { callPlantGenerateAPI, callPlantHistoryAPI, callShortInsightAPI } from '../../api/client';
import { ACTIVITY_COLORS } from './ActivityPieChart';
import { getMoodDisplayLabel, normalizeMoodKey } from '../../lib/moodOptions';
import { PlantImage } from './plant/PlantImage';

interface ReportDetailModalProps {
  selectedReport: Report | null;
  dailyMoodDistribution: MoodDistributionItem[];
  onClose: () => void;
  onBack?: () => void;
  onShowTaskList: (type: 'completed' | 'total') => void;
  generateAIDiary: (reportId: string) => Promise<void>;
  initialPage?: 0 | 1;
  readOnly?: boolean;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  canNavigateNext?: boolean;
}

type Lang = 'zh' | 'en' | 'it';

type DonutSegment = {
  color: string;
  value: number;
  showLabel?: boolean;
};

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

const ACTIVITY_I18N_KEYS: Record<string, string> = {
  study: 'category_study',
  work: 'category_work',
  social: 'category_social',
  life: 'category_life',
  entertainment: 'category_entertainment',
  health: 'category_health',
};

const MOOD_COLORS: Record<string, string> = {
  happy: '#f2c8d6',
  calm: '#efb7cb',
  focused: '#e79db8',
  satisfied: '#f6dce5',
  tired: '#c8cfda',
  anxious: '#d5d5d5',
  bored: '#d9def4',
  down: '#b9c5f0',
};

const DIARY_LINE_SOLID = '1px solid rgba(156, 148, 176, 0.24)';
const DIARY_LINE_DASHED = '1px dashed rgba(156, 148, 176, 0.34)';
const DIARY_BG = 'rgba(252,250,247,0.96)';

function buildActivitySummary(dist: ActivityDistributionItem[]): string {
  return dist.map((d) => `${d.type}${Math.round(d.minutes)}min`).join('、');
}

function buildMoodSummary(dist: MoodDistributionItem[]): string {
  return dist.map((d) => `${d.mood}${Math.round(d.minutes)}min`).join('、');
}

function clampInsightText(raw: string, maxChars = 20): string {
  const text = raw.trim().replace(/\s+/g, ' ');
  if (!text) return '';
  const chars = Array.from(text);
  if (chars.length <= maxChars) return text;
  return `${chars.slice(0, maxChars).join('')}…`;
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

function MiniDonut({
  segments,
  holeColor,
  emptyLabel,
}: {
  segments: Array<DonutSegment & { label: string }>;
  holeColor: string;
  emptyLabel: string;
}) {
  const safeSegments = segments.length > 0
    ? segments
    : [{ color: '#d9dde2', value: 100, label: '', showLabel: false }];
  const total = safeSegments.reduce((sum, segment) => sum + segment.value, 0) || 1;

  const size = 122;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 56;
  const innerR = 22;
  const labelR = 38;

  if (safeSegments.length === 1) {
    const only = safeSegments[0];
    const percent = Math.round((only.value / total) * 100);
    const showPercent = only.label.trim().length > 0 && only.label !== emptyLabel;
    return (
      <div style={{ width: 'min(34vw, 122px)', height: 'min(34vw, 122px)' }}>
        <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%">
          <circle cx={cx} cy={cy} r={outerR} fill={only.color} />
          <circle cx={cx} cy={cy} r={innerR} fill={holeColor} />
          {only.showLabel !== false ? (
            <text
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="7.2"
              fill="rgba(40,40,40,0.74)"
              fontWeight="600"
              style={{ pointerEvents: 'none' }}
            >
              <tspan x={cx} dy={showPercent ? '-0.35em' : '0'}>{only.label}</tspan>
              {showPercent ? <tspan x={cx} dy="1.1em">{percent}%</tspan> : null}
            </text>
          ) : null}
        </svg>
      </div>
    );
  }

  let startAngle = -90;
  const items = safeSegments.map((segment, idx) => {
    const sweep = (segment.value / total) * 360;
    const endAngle = startAngle + sweep;
    const midAngle = startAngle + sweep / 2;
    const midRad = (midAngle * Math.PI) / 180;
    const ox1 = cx + outerR * Math.cos((startAngle * Math.PI) / 180);
    const oy1 = cy + outerR * Math.sin((startAngle * Math.PI) / 180);
    const ox2 = cx + outerR * Math.cos((endAngle * Math.PI) / 180);
    const oy2 = cy + outerR * Math.sin((endAngle * Math.PI) / 180);
    const ix1 = cx + innerR * Math.cos((startAngle * Math.PI) / 180);
    const iy1 = cy + innerR * Math.sin((startAngle * Math.PI) / 180);
    const ix2 = cx + innerR * Math.cos((endAngle * Math.PI) / 180);
    const iy2 = cy + innerR * Math.sin((endAngle * Math.PI) / 180);
    const largeArc = sweep > 180 ? 1 : 0;
    const lx = cx + labelR * Math.cos(midRad);
    const ly = cy + labelR * Math.sin(midRad);
    const percent = Math.round((segment.value / total) * 100);
    const result = {
      key: `${segment.label}-${idx}`,
      path: [
        `M ${ox1} ${oy1}`,
        `A ${outerR} ${outerR} 0 ${largeArc} 1 ${ox2} ${oy2}`,
        `L ${ix2} ${iy2}`,
        `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix1} ${iy1}`,
        'Z',
      ].join(' '),
      color: segment.color,
      label: segment.label,
      percent,
      lx,
      ly,
      showLabel: segment.showLabel !== false,
    };
    startAngle = endAngle;
    return result;
  });

  return (
    <div style={{ width: 'min(34vw, 122px)', height: 'min(34vw, 122px)' }}>
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%">
        {items.map((item) => (
          <path key={item.key} d={item.path} fill={item.color} />
        ))}
        <circle cx={cx} cy={cy} r={innerR} fill={holeColor} />
        {items.map((item) => (
          item.showLabel ? (
            <text
              key={`txt-${item.key}`}
              x={item.lx}
              y={item.ly}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="7.2"
              fill="rgba(40,40,40,0.74)"
              fontWeight="600"
              style={{ pointerEvents: 'none' }}
            >
              <tspan x={item.lx} dy="-0.35em">{item.label}</tspan>
              <tspan x={item.lx} dy="1.1em">{item.percent}%</tspan>
            </text>
          ) : null
        ))}
      </svg>
    </div>
  );
}

function Header({
  title,
  dateLabel,
  onPrev,
  onNext,
  nextDisabled,
}: {
  title: string;
  dateLabel: string;
  onPrev: () => void;
  onNext: () => void;
  nextDisabled: boolean;
}) {
  return (
    <div className="sticky top-0 z-10" style={{ background: DIARY_BG }}>
      <div className="relative flex items-center justify-center px-2 pt-5">
        <button
          onClick={onPrev}
          className="absolute left-1 flex h-8 w-8 items-center justify-center rounded-full active:opacity-60"
          style={{ color: '#2d2d2d' }}
          aria-label="previous"
        >
          <ChevronLeft size={21} strokeWidth={2.3} />
        </button>

        <h2
          style={{
            margin: 0,
            fontSize: 33,
            lineHeight: 1,
            fontWeight: 700,
            color: '#202020',
            fontFamily: 'Georgia, "Times New Roman", serif',
          }}
        >
          {title}
        </h2>

        <button
          onClick={onNext}
          disabled={nextDisabled}
          className="absolute right-1 flex h-8 w-8 items-center justify-center rounded-full active:opacity-60 disabled:opacity-35"
          style={{ color: '#2d2d2d' }}
          aria-label="next"
        >
          <ChevronRight size={21} strokeWidth={2.3} />
        </button>
      </div>

      <p
        style={{
          margin: '8px 0 0 0',
          textAlign: 'center',
          fontSize: 18,
          lineHeight: 1.2,
          fontWeight: 700,
          color: '#333',
          fontFamily: 'Georgia, "Times New Roman", serif',
        }}
      >
        {dateLabel}
      </p>

      <div style={{ marginTop: 10, borderBottom: DIARY_LINE_SOLID }} />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        margin: 0,
        fontSize: 17,
        lineHeight: 1.2,
        fontWeight: 700,
        color: '#232323',
        fontFamily: 'Georgia, "Times New Roman", serif',
      }}
    >
      {children}
    </h3>
  );
}

function SectionDivider() {
  return <div style={{ margin: '14px 0 12px', borderTop: DIARY_LINE_DASHED }} />;
}

function Row({
  left,
  line1,
  line2,
}: {
  left: React.ReactNode;
  line1: string;
  line2?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 108 }}>
      <div style={{ flex: '1 1 0', display: 'flex', justifyContent: 'center' }}>{left}</div>
      <div style={{ flex: '1 1 0' }}>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: '#2f2f2f', fontFamily: 'Georgia, "Times New Roman", serif' }}>
          {line1}
        </p>
        {line2 ? (
          <p style={{ margin: '10px 0 0 0', fontSize: 15, lineHeight: 1.5, color: '#2f2f2f', fontFamily: 'Georgia, "Times New Roman", serif' }}>
            {line2}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export const ReportDetailModal: React.FC<ReportDetailModalProps> = ({
  selectedReport,
  dailyMoodDistribution: _dailyMoodDistribution,
  onClose,
  onBack,
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
  const pagesRef = useRef<HTMLDivElement | null>(null);
  const [activePage, setActivePage] = useState(initialPage ?? 0);
  const [activityInsight, setActivityInsight] = useState('');
  const [moodInsight, setMoodInsight] = useState('');
  const [todoInsight, setTodoInsight] = useState('');
  const [habitInsight, setHabitInsight] = useState('');
  const [dayPlant, setDayPlant] = useState<DailyPlantRecord | null>(null);
  const plantAutoAttemptedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const page = initialPage ?? 0;
    setActivePage(page);
    requestAnimationFrame(() => {
      if (!pagesRef.current) return;
      pagesRef.current.scrollLeft = page === 1 ? pagesRef.current.clientWidth : 0;
    });
  }, [selectedReport?.id, initialPage]);

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
    () => getDailyMoodDistribution(reportMessages, activityMood, selectedReport),
    [reportMessages, activityMood, selectedReport],
  );
  const activitySummary = useMemo(
    () => buildActivitySummary(activityDistribution),
    [activityDistribution],
  );
  const moodSummary = useMemo(
    () => buildMoodSummary(moodDistribution),
    [moodDistribution],
  );
  const dayMinutes = 24 * 60;
  const todoCompleted = selectedReport?.stats?.completedTodos ?? 0;
  const todoTotal = selectedReport?.stats?.totalTodos ?? 0;
  const todoCompletionRate = todoTotal > 0
    ? todoCompleted / todoTotal
    : Math.max(0, Math.min(1, selectedReport?.stats?.completionRate ?? 0));
  const todoCompletedTitles = selectedReport?.stats?.oneTimeTasks?.completedTitles ?? [];
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

  const habitDoneCount = selectedReport?.stats?.habitCheckin?.filter((item) => item.done).length ?? 0;
  const habitTotalCount = selectedReport?.stats?.habitCheckin?.length ?? 0;
  const goalDoneCount = selectedReport?.stats?.goalProgress?.filter((item) => item.doneToday).length ?? 0;
  const goalTotalCount = selectedReport?.stats?.goalProgress?.length ?? 0;
  const todayStars = habitDoneCount + goalDoneCount;

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
    setActivityInsight('');
    setMoodInsight('');
    setTodoInsight('');
    setHabitInsight('');

    if (activitySummary) {
      void callShortInsightAPI({ kind: 'activity', summary: activitySummary, lang }).then((text) => {
        if (!cancelled && text) setActivityInsight(clampInsightText(text, 20));
      });
    }
    if (moodSummary) {
      void callShortInsightAPI({ kind: 'mood', summary: moodSummary, lang }).then((text) => {
        if (!cancelled && text) setMoodInsight(clampInsightText(text, 20));
      });
    }
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
  }, [selectedReport?.id, activitySummary, moodSummary, todoInsightSummary, habitInsightSummary, lang]);

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
    setActivePage(Math.round(el.scrollLeft / el.clientWidth));
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
    const raw = selectedReport?.aiAnalysis?.trim();
    const text = raw && raw.length > 0 ? raw : copy.observationFallback;
    return text.replace(/\s+/g, ' ');
  }, [selectedReport?.aiAnalysis, copy.observationFallback]);

  const myDiaryText = useMemo(() => {
    const raw = selectedReport?.userNote?.trim();
    return raw && raw.length > 0 ? raw : copy.diaryPlaceholder;
  }, [selectedReport?.userNote, copy.diaryPlaceholder]);

  const activityDonutSegments = useMemo(
    () => {
      if (activityDistribution.length === 0) {
        return [{ value: dayMinutes, color: '#e5e7eb', label: '', showLabel: false }];
      }
      const base = activityDistribution.map((d) => ({
        value: d.minutes,
        color: ACTIVITY_COLORS[d.type] || '#9ca3af',
        label: t(ACTIVITY_I18N_KEYS[d.type] || d.type),
      }));
      const used = activityDistribution.reduce((sum, d) => sum + d.minutes, 0);
      const remaining = Math.max(dayMinutes - used, 0);
      if (remaining > 0) {
        base.push({
          value: remaining,
          color: '#e5e7eb',
          label: '',
          showLabel: false,
        });
      }
      return base;
    },
    [activityDistribution, t],
  );
  const moodDonutSegments = useMemo(
    () => {
      if (moodDistribution.length === 0) {
        return [{ value: dayMinutes, color: '#e5e7eb', label: '', showLabel: false }];
      }
      const base = moodDistribution.map((d) => {
        const key = normalizeMoodKey(d.mood) || d.mood;
        return {
          value: d.minutes,
          color: MOOD_COLORS[key] || '#c5ccda',
          label: getMoodDisplayLabel(d.mood, t),
        };
      });
      const used = moodDistribution.reduce((sum, d) => sum + d.minutes, 0);
      const remaining = Math.max(dayMinutes - used, 0);
      if (remaining > 0) {
        base.push({
          value: remaining,
          color: '#e5e7eb',
          label: '',
          showLabel: false,
        });
      }
      return base;
    },
    [moodDistribution, t],
  );

  const actionSummaryText = typeof selectedReport?.stats?.actionSummary === 'string'
    ? selectedReport.stats.actionSummary.trim()
    : '';
  const moodSummaryText = typeof selectedReport?.stats?.moodSummary === 'string'
    ? selectedReport.stats.moodSummary.trim()
    : '';

  const activityAnalysisLine1 = actionSummaryText || copy.activityLine1;
  const activityAnalysisLine2 = activityInsight;
  const moodAnalysisLine1 = moodSummaryText || copy.moodLine1;
  const moodAnalysisLine2 = moodInsight;
  const todoSegments = 10;
  const todoLitCount = todoTotal > 0
    ? Math.min(
      todoSegments,
      Math.max(todoCompletionRate > 0 ? 1 : 0, Math.round(todoCompletionRate * todoSegments)),
    )
    : 0;
  const todoAnalysisLine1 = todoInsight || copy.todoFallback;
  const habitAnalysisLine1 = habitInsight || copy.habitsFallback;
  const starSlots = Math.max(10, todayStars);

  if (!selectedReport) return null;

  return (
    <div
      className="fixed inset-0 z-[60]"
      style={{
        background: DIARY_BG,
        backdropFilter: 'blur(8px) saturate(140%)',
        WebkitBackdropFilter: 'blur(8px) saturate(140%)',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="h-full w-full">
        <div
          ref={pagesRef}
          onScroll={onScroll}
          className="flex h-full overflow-x-scroll [&::-webkit-scrollbar]:hidden"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {/* Page 1 */}
          <div className="h-full w-full shrink-0 overflow-y-auto px-4 pb-16" style={{ scrollSnapAlign: 'start' }}>
            <Header title={copy.pageTitle} dateLabel={dateLabel} onPrev={handlePrev} onNext={handleNext} nextDisabled={nextDisabled} />

            <div style={{ paddingTop: 12 }}>
              <SectionTitle>{copy.sectionActivity}</SectionTitle>
              <Row
                left={(
                  <MiniDonut
                    segments={activityDonutSegments}
                    holeColor={DIARY_BG}
                    emptyLabel={t('no_data')}
                  />
                )}
                line1={activityAnalysisLine1}
                line2={activityAnalysisLine2}
              />

              <SectionDivider />

              <SectionTitle>{copy.sectionMood}</SectionTitle>
              <Row
                left={(
                  <MiniDonut
                    segments={moodDonutSegments}
                    holeColor={DIARY_BG}
                    emptyLabel={t('no_data')}
                  />
                )}
                line1={moodAnalysisLine1}
                line2={moodAnalysisLine2}
              />

              <SectionDivider />

              <SectionTitle>{copy.sectionTodo}</SectionTitle>
              <Row
                left={(
                  <div
                    style={{
                      width: 'min(38vw, 160px)',
                      display: 'grid',
                      gridTemplateColumns: `repeat(${todoSegments}, minmax(0, 1fr))`,
                      gap: 4,
                    }}
                  >
                    {Array.from({ length: todoSegments }).map((_, idx) => {
                      const lit = idx < todoLitCount;
                      return (
                        <span
                          key={`todo-seg-${idx}`}
                          style={{
                            display: 'block',
                            height: 6,
                            borderRadius: 999,
                            background: lit ? '#deb540' : 'rgba(108,108,108,0.45)',
                          }}
                        />
                      );
                    })}
                  </div>
                )}
                line1={todoAnalysisLine1}
              />

              <SectionDivider />

              <SectionTitle>{copy.sectionHabits}</SectionTitle>
              <Row
                left={(
                  <div
                    style={{
                      width: 'min(36vw, 140px)',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                      gap: 6,
                    }}
                  >
                    {Array.from({ length: starSlots }).map((_, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: 18,
                          textAlign: 'center',
                          color: idx < todayStars ? '#d1ab3f' : 'rgba(139,139,139,0.45)',
                          opacity: idx < todayStars ? 0.95 : 0.55,
                        }}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                )}
                line1={habitAnalysisLine1}
              />

              <div style={{ marginTop: 18, borderTop: DIARY_LINE_SOLID }} />
            </div>
          </div>

          {/* Page 2 */}
          <div className="h-full w-full shrink-0 overflow-y-auto px-4 pb-16" style={{ scrollSnapAlign: 'start' }}>
            <Header title={copy.pageTitle} dateLabel={dateLabel} onPrev={handlePrev} onNext={handleNext} nextDisabled={nextDisabled} />

            <div style={{ paddingTop: 12 }}>
              <div style={{ minHeight: '64vh', display: 'flex', flexDirection: 'column' }}>
                <SectionTitle>{copy.sectionObservation}</SectionTitle>

                <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.85, color: '#2f2f2f', fontFamily: 'Georgia, "Times New Roman", serif', textAlign: 'justify', textJustify: 'inter-word', flex: 1 }}>
                  <div
                    style={{
                      float: 'left',
                      width: 'clamp(150px, 44vw, 220px)',
                      height: 'clamp(150px, 44vw, 220px)',
                      margin: '2px 14px 8px 0',
                      opacity: 0.92,
                    }}
                  >
                    {dayPlant ? (
                      <PlantImage
                        plantId={dayPlant.plantId}
                        rootType={dayPlant.rootType}
                        plantStage={dayPlant.plantStage}
                        imgClassName="h-full w-full object-contain"
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%' }} />
                    )}
                  </div>
                  {observationText}
                  <div style={{ clear: 'both' }} />
                </div>
              </div>

              <div style={{ margin: '8px 0 8px', borderTop: DIARY_LINE_DASHED }} />

              <SectionTitle>{copy.sectionMyDiary}</SectionTitle>

              <div
                style={{
                  marginTop: 8,
                  minHeight: 180,
                  fontSize: 15,
                  lineHeight: 1.8,
                  color: selectedReport.userNote?.trim() ? '#2f2f2f' : 'rgba(95,95,95,0.56)',
                  fontFamily: 'Georgia, "Times New Roman", serif',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {myDiaryText}
              </div>

              <div style={{ marginTop: 24, borderTop: DIARY_LINE_SOLID }} />
            </div>
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 96,
            height: 8,
            borderRadius: 999,
            background: 'rgba(92,92,92,0.4)',
          }}
        />
      </div>
    </div>
  );
};
