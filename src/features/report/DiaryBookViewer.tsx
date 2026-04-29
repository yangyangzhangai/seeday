import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { format, getDaysInMonth, startOfMonth, endOfMonth, startOfDay, endOfDay, isSameDay } from 'date-fns';
import { enUS, it as itLocale, zhCN } from 'date-fns/locale';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { Report } from '../../store/useReportStore';
import { useChatStore } from '../../store/useChatStore';
import type { Message } from '../../store/useChatStore';
import { useMoodStore } from '../../store/useMoodStore';
import { useAuthStore } from '../../store/useAuthStore';
import { normalizeMoodKey } from '../../lib/moodOptions';
import { computeActivityDistribution } from './reportPageHelpers';
import { callPlantHistoryAPI } from '../../api/client';
import type { DailyPlantRecord } from '../../types/plant';
import { usePlantStore } from '../../store/usePlantStore';
import { PlantImage } from './plant/PlantImage';
import { DiaryPlantFlipModal } from './plant/DiaryPlantFlipModal';
import { DiaryBookViewerExpandedView, type ExpandTarget } from './DiaryBookViewerExpandedView';
import { buildPages, DIARY_COPY, type DiaryLang, type PageData } from './diaryBookViewerData';

const ACTIVITY_UI_COLORS = ['#D5E8CE', '#AACBA4', '#85AD80', '#6A9464', '#4E7549'];
const MOOD_UI_COLORS = ['#F8D0DC', '#F0AABE', '#DE8BA2', '#C46E86'];
const DIARY_LINE_SOLID = '1px solid rgba(156, 148, 176, 0.24)';
const DIARY_LINE_DASHED = '1px dashed rgba(156, 148, 176, 0.34)';
const CUSTOM_MOOD_LABELS = new Set(['自定义', 'Custom', 'Personalizzato']);

/* ────────────────────────── tuning constants ────────────────────────── */
const BASE_PAGE_W = 180;
const BASE_PAGE_H = 255; // A5 ratio: 180 × (210/148) ≈ 255
const FLIP_MS = 550;
const BASE_SIDE_GAP = 6;
const MAX_VIS = 4;
const BASE_HEIGHT_SHRINK = 20;
const PAPER_COLOR = '#ffffff';
const SHELF_BG = '#f4f7f4';
const LEATHER_TEXTURE = 'https://images.unsplash.com/photo-1729823546609-2b113553cdcd?q=80&w=1080';
const PARCHMENT_TEXTURE = 'https://images.unsplash.com/photo-1719563015025-83946fb49e49?q=80&w=1080';
const COVER_COLORS = ['#7c4a5a', '#4d7a9e', '#8aac8d', '#3d5244', '#b56740', '#9a7a3a', '#5c5e8a', '#3d6b6d'];
function coverColor(month: Date): string {
  const idx = (month.getFullYear() * 12 + month.getMonth()) % COVER_COLORS.length;
  return COVER_COLORS[idx];
}
const SPINE_STRIP_W = 14;
const BASE_SHEET_SPINE_OVERLAP = 2;
const TRAPEZOID_ANGLE_DEG = Math.atan((BASE_HEIGHT_SHRINK / 2) / BASE_PAGE_W) * (180 / Math.PI);

/* ──────────────────────────────── types ──────────────────────────────── */
interface Props {
  onClose: () => void;
  onBackToShelf?: () => void;
  reports: Report[];
  initialMonth?: Date;
  initialFlippedCount?: number;
  onOpenDiaryPage?: (date: Date, subPage: 0 | 1, flippedCount: number) => void;
}

/* ──────────────────────────── page content ───────────────────────────── */
function PageContent({ page, scale, allMessages, plantRecords, coverBg, onOpenFlipCard }: { page: PageData; scale: number; allMessages: Message[]; plantRecords: DailyPlantRecord[]; coverBg: string; onOpenFlipCard?: (plant: DailyPlantRecord, msgs: Message[]) => void }) {
  const px = (n: number) => n * scale;
  const { i18n, t: tr } = useTranslation();
  const navigate = useNavigate();
  const isPlus = useAuthStore((state) => state.isPlus);
  const activityMood = useMoodStore(state => state.activityMood);
  const customMoodLabel = useMoodStore(state => state.customMoodLabel);
  const customMoodApplied = useMoodStore(state => state.customMoodApplied);
  const trapInset = px(BASE_HEIGHT_SHRINK / 2);
  const langRaw = i18n.language?.split('-')[0] ?? 'en';
  const lang: DiaryLang = langRaw === 'zh' || langRaw === 'it' ? langRaw : 'en';
  const copy = DIARY_COPY[lang];

  const W = BASE_PAGE_W * scale;
  const H_p = BASE_PAGE_H * scale;
  const t = trapInset;
  const lk = H_p / (H_p - 2 * t);
  const leftPageTransform  = `matrix3d(${lk},${(t*lk)/W},0,${(2*t*lk)/(H_p*W)},0,1,0,0,0,0,1,0,0,0,0,1)`;
  const rk = (H_p - 2 * t) / H_p;
  const rightPageTransform = `matrix3d(${rk},${-t/W},0,${-2*t/(H_p*W)},0,${rk},0,0,0,0,1,0,0,${t},0,1)`;

  /* ── cover ── */
  if (page.type === 'cover') {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', backgroundColor: coverBg, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        {/* Spine */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: px(22), background: 'linear-gradient(to right, rgba(0,0,0,0.45), rgba(0,0,0,0.15), transparent)', opacity: 0.8, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.2)', pointerEvents: 'none' }} />
        {/* Texture overlays */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${LEATHER_TEXTURE})`, backgroundSize: 'cover', opacity: 0.12, mixBlendMode: 'overlay', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${PARCHMENT_TEXTURE})`, backgroundSize: 'cover', opacity: 0.35, mixBlendMode: 'multiply', pointerEvents: 'none' }} />
        {/* Sheen */}
        <div style={{ position: 'absolute', left: px(20), right: 0, top: 0, bottom: 0, background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.05), transparent)', transform: 'skewX(-15deg)', pointerEvents: 'none' }} />
        {/* Text */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: px(6) }}>
          <div style={{ fontSize: px(14), fontWeight: 900, letterSpacing: 2, color: 'rgba(255,255,255,0.9)', textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>{tr('report_view_diary_book')}</div>
          <div style={{ fontSize: px(8), fontWeight: 700, letterSpacing: 3, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>{tr('diary_cover_subtitle')}</div>
        </div>
      </div>
    );
  }

  /* ── back cover ── */
  if (page.type === 'back') {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', backgroundColor: coverBg, overflow: 'hidden' }}>
        {/* Spine on right for back */}
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: px(22), background: 'linear-gradient(to left, rgba(0,0,0,0.45), rgba(0,0,0,0.15), transparent)', opacity: 0.8, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.2)', pointerEvents: 'none' }} />
        {/* Texture overlays */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${LEATHER_TEXTURE})`, backgroundSize: 'cover', opacity: 0.12, mixBlendMode: 'overlay', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${PARCHMENT_TEXTURE})`, backgroundSize: 'cover', opacity: 0.35, mixBlendMode: 'multiply', pointerEvents: 'none' }} />
      </div>
    );
  }

  /* ── blank ── */
  if (page.type === 'blank') {
    return <div style={{ width: '100%', height: '100%', background: PAPER_COLOR }} />;
  }

  const dayDate = page.date;
  const dayPlant = dayDate ? plantRecords.find(p => p.date === format(dayDate, 'yyyy-MM-dd')) : null;
  const todayStart = startOfDay(new Date()).getTime();
  const isFutureDay = dayDate ? dayDate.getTime() > todayStart : false;
  if (isFutureDay) {
    return <div style={{ width: '100%', height: '100%', background: PAPER_COLOR }} />;
  }
  const isTodayPage = dayDate ? isSameDay(dayDate, new Date()) : false;
  if (isTodayPage && !dayPlant) {
    return <div style={{ width: '100%', height: '100%', background: PAPER_COLOR }} />;
  }

  const report = page.report;
  if (!report) {
    return <div style={{ width: '100%', height: '100%', background: PAPER_COLOR }} />;
  }
  const dayStart = dayDate ? startOfDay(dayDate).getTime() : 0;
  const dayEnd = dayDate ? endOfDay(dayDate).getTime() : 0;
  const dayMsgs = allMessages
    .filter(m => m.timestamp >= dayStart && m.timestamp <= dayEnd && m.type !== 'system' && m.mode === 'record')
    .sort((a, b) => a.timestamp - b.timestamp);
  const actDist = computeActivityDistribution(dayMsgs);

  const actionAnalysis = (report?.stats?.actionAnalysis ?? [])
    .filter((item) => item.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);

  const moodMinutes: Record<string, number> = {};
  dayMsgs.forEach(msg => {
    if (msg.isActive) return;
    const baseMood = activityMood[msg.id] ?? (msg.moodDescriptions?.[0]?.content);
    const customLabel = customMoodLabel[msg.id];
    const useCustom = customMoodApplied[msg.id] === true;
    const normalizedCustomLabel = customLabel?.trim() ?? '';
    const mood = useCustom && normalizedCustomLabel && !CUSTOM_MOOD_LABELS.has(normalizedCustomLabel)
      ? normalizedCustomLabel
      : baseMood;
    if (mood && msg.duration && msg.duration > 0) {
      const key = normalizeMoodKey(mood) || mood;
      moodMinutes[key] = (moodMinutes[key] || 0) + msg.duration;
    }
  });
  const moodDist = Object.entries(moodMinutes)
    .map(([mood, minutes]) => ({ mood, minutes }))
    .filter(d => d.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);

  const moodDistribution = (report?.stats?.moodDistribution ?? [])
    .filter((item) => item.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);

  const activitySlices = actionAnalysis.length > 0
    ? actionAnalysis.slice(0, 5).map((d, index) => ({
      color: ACTIVITY_UI_COLORS[index] || ACTIVITY_UI_COLORS[ACTIVITY_UI_COLORS.length - 1],
      value: d.minutes,
    }))
    : actDist.length > 0
      ? actDist.slice(0, 5).map((d, index) => ({
      color: ACTIVITY_UI_COLORS[index] || ACTIVITY_UI_COLORS[ACTIVITY_UI_COLORS.length - 1],
      value: d.minutes,
      }))
    : [{ color: '#E5E7EB', value: 1 }];
  const moodSlices = moodDistribution.length > 0
    ? moodDistribution.slice(0, 4).map((d, index) => ({
      color: MOOD_UI_COLORS[index] || MOOD_UI_COLORS[MOOD_UI_COLORS.length - 1],
      value: d.minutes,
    }))
    : moodDist.length > 0
      ? moodDist.slice(0, 4).map((d, index) => ({
      color: MOOD_UI_COLORS[index] || MOOD_UI_COLORS[MOOD_UI_COLORS.length - 1],
      value: d.minutes,
      }))
    : [{ color: '#E5E7EB', value: 1 }];
  const buildConic = (slices: Array<{ color: string; value: number }>) => {
    const total = slices.reduce((sum, item) => sum + item.value, 0) || 1;
    let acc = 0;
    const stops = slices.map((item) => {
      const start = (acc / total) * 100;
      acc += item.value;
      const end = (acc / total) * 100;
      return `${item.color} ${start}% ${end}%`;
    });
    return `conic-gradient(${stops.join(', ')})`;
  };

  const todoCompleted = report?.stats?.completedTodos ?? 0;
  const todoTotal = report?.stats?.totalTodos ?? 0;
  const todoRate = todoTotal > 0 ? (todoCompleted / todoTotal) : 0;
  const todoSegments = 12;
  const todoLitCount = todoTotal > 0 ? Math.max(1, Math.round(todoRate * todoSegments)) : 0;

  const habitDone = report?.stats?.habitCheckin?.filter(item => item.done).length ?? 0;
  const goalDone = report?.stats?.goalProgress?.filter(item => item.doneToday).length ?? 0;
  const starsToday = habitDone + goalDone;
  const starSlots = Math.max(8, starsToday);

  const dateLocale = lang === 'zh' ? zhCN : lang === 'it' ? itLocale : enUS;
  const datePattern = lang === 'zh' ? 'yyyy年M月d日 EEEE' : 'EEEE, MMMM d, yyyy';
  const headerDate = dayDate ? format(dayDate, datePattern, { locale: dateLocale }) : '';
  // Free: show loading state (not fallback) until teaser is generated, to avoid text flicker
  const isFreeWaitingForTeaser = !isPlus && !report?.teaserText?.trim() && report?.analysisStatus !== 'error' && report?.analysisStatus !== 'generating';
  const observationText = isPlus
    ? (report?.aiAnalysis?.trim() || copy.observationFallback)
    : isFreeWaitingForTeaser
      ? tr('report_generating_variant_1', { companion: 'Van' })
      : (report?.teaserText?.trim() || copy.observationFallback);
  const myDiary = report?.userNote?.trim() || copy.diaryPlaceholder;

  const sectionTitleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: px(5.8),
    lineHeight: 1.2,
    fontWeight: 700,
    color: '#232323',
    fontFamily: 'Georgia, "Times New Roman", serif',
  };
  const bodyStyle: React.CSSProperties = {
    margin: 0,
    fontSize: px(5.2),
    lineHeight: 1.45,
    color: '#2f2f2f',
    fontFamily: 'Georgia, "Times New Roman", serif',
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  };
  const donutSize = px(26);

  /* ── day-left: same structure as diary page first screen ── */
  if (page.type === 'day-left') {
    const activitySummary = report?.stats?.actionSummary?.trim() || copy.activityFallback;
    const moodSummary = report?.stats?.moodSummary?.trim() || copy.moodFallback;
    const todoSummary = todoTotal > 0 ? `${todoCompleted}/${todoTotal}` : copy.todoFallback;
    const habitSummary = starsToday > 0 ? tr('diary_star_count', { count: starsToday }) : copy.habitsFallback;

    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', background: PAPER_COLOR }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          boxSizing: 'border-box',
          padding: `${px(8)}px ${px(8)}px ${px(14)}px ${px(8)}px`,
          display: 'flex',
          flexDirection: 'column',
          gap: px(3),
          transform: leftPageTransform,
          transformOrigin: '0 0',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: px(8.2), fontWeight: 700, color: '#202020', fontFamily: 'Georgia, "Times New Roman", serif' }}>{copy.pageTitle}</div>
            <div style={{ marginTop: px(1), fontSize: px(5), color: '#555', fontFamily: 'Georgia, "Times New Roman", serif' }}>{headerDate}</div>
          </div>
          <div style={{ borderTop: DIARY_LINE_SOLID }} />

          <h3 style={sectionTitleStyle}>{copy.sectionActivity}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', alignItems: 'center', gap: px(3), minHeight: px(32) }}>
            <div style={{ width: donutSize, height: donutSize, borderRadius: '50%', background: buildConic(activitySlices), margin: '0 auto', position: 'relative' }}>
              <div style={{ position: 'absolute', inset: '30%', borderRadius: '50%', background: PAPER_COLOR }} />
            </div>
            <p style={bodyStyle}>{activitySummary}</p>
          </div>

          <div style={{ borderTop: DIARY_LINE_DASHED }} />

          <h3 style={sectionTitleStyle}>{copy.sectionMood}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', alignItems: 'center', gap: px(3), minHeight: px(32) }}>
            <div style={{ width: donutSize, height: donutSize, borderRadius: '50%', background: buildConic(moodSlices), margin: '0 auto', position: 'relative' }}>
              <div style={{ position: 'absolute', inset: '30%', borderRadius: '50%', background: PAPER_COLOR }} />
            </div>
            <p style={bodyStyle}>{moodSummary}</p>
          </div>

          <div style={{ borderTop: DIARY_LINE_DASHED }} />

          <h3 style={sectionTitleStyle}>{copy.sectionTodo}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', alignItems: 'center', gap: px(3), minHeight: px(18) }}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${todoSegments}, minmax(0, 1fr))`, gap: px(0.8) }}>
              {Array.from({ length: todoSegments }).map((_, idx) => (
                <span key={idx} style={{ display: 'block', height: px(1.8), borderRadius: 999, background: idx < todoLitCount ? '#F5C842' : '#EDE0B0' }} />
              ))}
            </div>
            <p style={bodyStyle}>{todoSummary}</p>
          </div>

          <div style={{ borderTop: DIARY_LINE_DASHED }} />

          <h3 style={sectionTitleStyle}>{copy.sectionHabits}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', alignItems: 'center', gap: px(3), minHeight: px(20) }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: px(0.8) }}>
              {Array.from({ length: starSlots }).map((_, idx) => (
                <span key={idx} style={{ fontSize: px(5.4), textAlign: 'center', color: idx < starsToday ? '#D1AB3F' : 'rgba(139,139,139,0.45)' }}>★</span>
              ))}
            </div>
            <p style={bodyStyle}>{habitSummary}</p>
          </div>

          <div style={{ position: 'absolute', bottom: px(5), left: 0, right: 0, textAlign: 'center', fontSize: px(5.2), color: 'rgba(0,0,0,0.25)', pointerEvents: 'none' }}>
            {page.dayNum != null ? 2 * page.dayNum - 1 : ''}
          </div>
        </div>
      </div>
    );
  }

  /* ── day-right: same structure as diary page second screen ── */
  if (page.type === 'day-right') {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', background: PAPER_COLOR }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          boxSizing: 'border-box',
          padding: `${px(8)}px ${px(8)}px ${px(14)}px ${px(8)}px`,
          display: 'flex',
          flexDirection: 'column',
          gap: px(3),
          transform: rightPageTransform,
          transformOrigin: '0 0',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: px(8.2), fontWeight: 700, color: '#202020', fontFamily: 'Georgia, "Times New Roman", serif' }}>{copy.pageTitle}</div>
            <div style={{ marginTop: px(1), fontSize: px(5), color: '#555', fontFamily: 'Georgia, "Times New Roman", serif' }}>{headerDate}</div>
          </div>
          <div style={{ borderTop: DIARY_LINE_SOLID }} />

          <h3 style={sectionTitleStyle}>{copy.sectionObservation}</h3>
          <div style={{ minHeight: '64%', fontSize: px(5.2), lineHeight: 1.45, color: '#2f2f2f', fontFamily: 'Georgia, "Times New Roman", serif', textAlign: 'justify', textJustify: 'inter-word', overflow: 'hidden', position: 'relative' }}>
            <div
              style={{
                float: 'left',
                width: px(64),
                height: px(64),
                margin: `0 ${px(3)}px ${px(2)}px 0`,
                opacity: 0.92,
                cursor: dayPlant ? 'pointer' : 'default',
              }}
              onClick={() => dayPlant && onOpenFlipCard?.(dayPlant, dayMsgs)}
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
            {isFreeWaitingForTeaser ? null : (
              !isPlus ? (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(180deg, rgba(255,255,255,0) 36%, rgba(255,255,255,0.9) 68%, rgba(255,255,255,1) 100%)',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    paddingBottom: px(3),
                  }}
                >
                  <button
                    type="button"
                    onClick={() => navigate('/upgrade')}
                    style={{
                      border: 'none',
                      borderRadius: 999,
                      background: '#4f46e5',
                      color: '#fff',
                      fontSize: px(4.4),
                      fontWeight: 700,
                      padding: `${px(1.5)}px ${px(3)}px`,
                    }}
                  >
                    {tr('report_teaser_unlock')}
                  </button>
                </div>
              ) : null
            )}
          </div>

          <div style={{ borderTop: DIARY_LINE_DASHED }} />

          <h3 style={sectionTitleStyle}>{copy.sectionMyDiary}</h3>
          <div style={{ fontSize: px(5.2), lineHeight: 1.45, color: report?.userNote?.trim() ? '#2f2f2f' : 'rgba(95,95,95,0.56)', fontFamily: 'Georgia, "Times New Roman", serif', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>
            {myDiary}
          </div>

          <div style={{ position: 'absolute', bottom: px(5), left: 0, right: 0, textAlign: 'center', fontSize: px(5.2), color: 'rgba(0,0,0,0.25)', pointerEvents: 'none' }}>
            {page.dayNum != null ? 2 * page.dayNum : ''}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

/* ──────────────────────────── main viewer ────────────────────────────── */
export const DiaryBookViewer: React.FC<Props> = ({ onClose, onBackToShelf, reports, initialMonth, initialFlippedCount, onOpenDiaryPage }) => {
  const { t, i18n } = useTranslation();
  const today = new Date();
  const [currentMonth] = useState(() => initialMonth ? startOfMonth(initialMonth) : startOfMonth(today));
  const globalMessages = useChatStore(state => state.messages);
  const dateCache = useChatStore(state => state.dateCache);
  const loadMessagesForDateRange = useChatStore(state => state.loadMessagesForDateRange);
  const todayPlant = usePlantStore(state => state.todayPlant);
  const [plantRecords, setPlantRecords] = useState<DailyPlantRecord[]>([]);

  useEffect(() => {
    loadMessagesForDateRange(startOfMonth(currentMonth), endOfMonth(currentMonth));
  }, [currentMonth, loadMessagesForDateRange]);

  useEffect(() => {
    const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    callPlantHistoryAPI(startDate, endDate)
      .then(res => { if (res.success) setPlantRecords(res.records); })
      .catch(() => {});
  }, [currentMonth]);

  useEffect(() => {
    if (!todayPlant) return;
    setPlantRecords(prev => {
      const idx = prev.findIndex(r => r.date === todayPlant.date);
      if (idx === -1) return [...prev, todayPlant];
      if (prev[idx].plantId === todayPlant.plantId) return prev;
      const next = [...prev];
      next[idx] = todayPlant;
      return next;
    });
  }, [todayPlant]);

  const monthStartStr = (() => {
    const d = startOfMonth(currentMonth);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const allMessages = dateCache[monthStartStr] ?? globalMessages;
  const [flippedCount, setFlippedCount] = useState(initialFlippedCount ?? 0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [lastFlipDir, setLastFlipDir] = useState<'next' | 'prev'>('next');
  const [expandTarget, setExpandTarget] = useState<ExpandTarget>(null);
  const [flipModal, setFlipModal] = useState<{ plant: DailyPlantRecord; dayMessages: Message[] } | null>(null);
  const dblClickTimer = useRef<{ side: 'left' | 'right'; timer: ReturnType<typeof setTimeout> } | null>(null);
  const pointerUpWasDrag = useRef(false); // true when pointer-up followed a real drag
  const dragRef = useRef<{
    side: 'left' | 'right'; sheetIdx: number;
    startClientX: number; lastClientX: number; lastT: number; velDeg: number;
    isDragging: boolean;
  } | null>(null);
  const [liveFlip, setLiveFlip] = useState<{ sheetIdx: number; rotY: number; side: 'left' | 'right' } | null>(null);
  const [snapDur, setSnapDur] = useState<{ sheetIdx: number; ms: number } | null>(null);
  const pageWRef = useRef(BASE_PAGE_W);
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === 'undefined' ? 390 : window.innerWidth,
    height: typeof window === 'undefined' ? 844 : window.innerHeight,
  }));

  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const pages = buildPages(currentMonth, reports);
  const numSheets = pages.length / 2;
  const daysInMonth = getDaysInMonth(currentMonth);
  const isBookOpen = flippedCount > 0 && flippedCount < numSheets;
  const headerLocale = i18n.language?.split('-')[0] === 'zh' ? zhCN : i18n.language?.split('-')[0] === 'it' ? itLocale : enUS;
  const isZhHeader = i18n.language?.split('-')[0] === 'zh';
  const activeHeaderDate = useMemo(() => {
    if (!isBookOpen) return null;
    const leftPage = pages[2 * flippedCount - 1];
    const rightPage = pages[2 * flippedCount];
    return leftPage?.date ?? rightPage?.date ?? null;
  }, [flippedCount, isBookOpen, pages]);

  const flipNext = useCallback(() => {
    if (isAnimating || flippedCount >= numSheets) return;
    setLastFlipDir('next');
    setIsAnimating(true);
    setFlippedCount(f => f + 1);
    setTimeout(() => setIsAnimating(false), FLIP_MS);
  }, [isAnimating, flippedCount, numSheets]);

  const flipPrev = useCallback(() => {
    if (isAnimating || flippedCount <= 0) return;
    setLastFlipDir('prev');
    setIsAnimating(true);
    setFlippedCount(f => f - 1);
    setTimeout(() => setIsAnimating(false), FLIP_MS);
  }, [isAnimating, flippedCount]);

  /* ── double-click / double-tap to expand ── */
  const handleZoneClick = useCallback((side: 'left' | 'right') => {
    if (dblClickTimer.current?.side === side) {
      clearTimeout(dblClickTimer.current.timer);
      dblClickTimer.current = null;
      if (isBookOpen) {
        const leftPage  = pages[2 * flippedCount - 1];
        const rightPage = pages[2 * flippedCount];
        const p = side === 'left' ? leftPage : rightPage;
        if (p?.type === 'day-left' || p?.type === 'day-right') {
          const pageDate = p.date;
          if (!pageDate) return;
          const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          if (pageDate.getTime() > todayStart.getTime()) return; // future dates are not clickable
          if (onOpenDiaryPage) {
            onOpenDiaryPage(pageDate, side === 'left' ? 0 : 1, flippedCount);
          } else {
            setExpandTarget({ side, page: p });
          }
        }
      }
    } else {
      if (dblClickTimer.current) clearTimeout(dblClickTimer.current.timer);
      const flip = side === 'left' ? flipPrev : flipNext;
      dblClickTimer.current = {
        side,
        timer: setTimeout(() => {
          dblClickTimer.current = null;
          flip();
        }, 280),
      };
    }
  }, [isBookOpen, pages, flippedCount, flipPrev, flipNext]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (expandTarget) { if (event.key === 'Escape') setExpandTarget(null); return; }
      if (event.key === 'ArrowRight') { event.preventDefault(); flipNext(); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); flipPrev(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [flipNext, flipPrev, expandTarget]);

  const onZonePointerDown = useCallback((side: 'left' | 'right', e: React.PointerEvent<HTMLDivElement>) => {
    if (isAnimating || liveFlip) return;
    if (side === 'right' && flippedCount >= numSheets) return;
    if (side === 'left' && flippedCount <= 0) return;
    e.preventDefault();
    const sheetIdx = side === 'right' ? flippedCount : flippedCount - 1;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { side, sheetIdx, startClientX: e.clientX, lastClientX: e.clientX, lastT: Date.now(), velDeg: 0, isDragging: false };
  }, [isAnimating, liveFlip, flippedCount, numSheets]);

  const onZonePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const pw = pageWRef.current;
    const deltaX = e.clientX - drag.startClientX;
    if (Math.abs(deltaX) < 4 && !drag.isDragging) return;
    drag.isDragging = true;
    const now = Date.now();
    const dt = Math.max(1, now - drag.lastT);
    drag.velDeg = ((e.clientX - drag.lastClientX) / dt) * (180 / pw);
    drag.lastClientX = e.clientX;
    drag.lastT = now;
    const rotY = drag.side === 'right'
      ? Math.max(-180, Math.min(0, (deltaX / pw) * 180))
      : Math.max(-180, Math.min(0, -180 + (deltaX / pw) * 180));
    setLiveFlip({ sheetIdx: drag.sheetIdx, rotY, side: drag.side });
  }, []);

  const onZonePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    const pw = pageWRef.current;
    const deltaX = e.clientX - drag.startClientX;

    if (!drag.isDragging || Math.abs(deltaX) < 8) {
      setLiveFlip(null);
      pointerUpWasDrag.current = false; // onClick will handle the tap
      return;
    }

    pointerUpWasDrag.current = true; // was a real drag — suppress onClick

    const curRotY = drag.side === 'right'
      ? Math.max(-180, Math.min(0, (deltaX / pw) * 180))
      : Math.max(-180, Math.min(0, -180 + (deltaX / pw) * 180));

    const shouldComplete =
      (drag.side === 'right' && (curRotY < -90 || drag.velDeg < -1)) ||
      (drag.side === 'left' && (curRotY > -90 || drag.velDeg > 1));

    const target = shouldComplete ? (drag.side === 'right' ? -180 : 0) : (drag.side === 'right' ? 0 : -180);
    const remaining = Math.abs(target - curRotY);
    const speed = Math.max(0.5, Math.abs(drag.velDeg));
    const dur = Math.max(60, Math.min(FLIP_MS, remaining / speed));

    setSnapDur({ sheetIdx: drag.sheetIdx, ms: dur });
    setLiveFlip(null);

    if (shouldComplete) {
      setIsAnimating(true);
      setLastFlipDir(drag.side === 'right' ? 'next' : 'prev');
      setFlippedCount(f => f + (drag.side === 'right' ? 1 : -1));
      setTimeout(() => { setIsAnimating(false); setSnapDur(null); }, dur);
    } else {
      setTimeout(() => setSnapDur(null), dur);
    }
  }, []);

  const getIndicator = () => {
    if (flippedCount === 0) return t('diary_cover');
    if (flippedCount >= numSheets) return t('diary_back_cover');
    const l = pages[2 * flippedCount - 1];
    if (l?.dayNum !== undefined) return t('diary_day_n', { day: l.dayNum });
    return `${flippedCount} / ${numSheets}`;
  };

  /* ── scaling ── */
  const baseSideMargin = MAX_VIS * BASE_SIDE_GAP;
  const shelfThumbW = (Math.min(viewport.width, 430) - 48 - 20) / 2;
  const scaleFromCover = shelfThumbW / BASE_PAGE_W;
  const availableH = Math.max(220, viewport.height - 170); // ~90px header + ~80px footer/safe-area
  const scaleH = availableH / BASE_PAGE_H;
  const scale = Math.max(0.62, Math.min(scaleFromCover, scaleH, 1.8));

  const pageW = BASE_PAGE_W * scale;
  pageWRef.current = pageW;
  const pageH = BASE_PAGE_H * scale;
  const sideGap = BASE_SIDE_GAP * scale;
  const heightShrink = BASE_HEIGHT_SHRINK * scale;
  const trapezoidInset = heightShrink / 2;
  const sheetSpineOverlap = Math.max(1, BASE_SHEET_SPINE_OVERLAP * scale);
  const sideMargin = MAX_VIS * sideGap;
  const wrapW = pageW * 2 + sideMargin * 2;
  const spineX = sideMargin + pageW;

  const isEdgeLiveFlip = !!liveFlip && (liveFlip.sheetIdx === 0 || liveFlip.sheetIdx === numSheets - 1);
  const isEdgeSnapAnimating =
    isAnimating &&
    (
      (lastFlipDir === 'next' && (flippedCount === 1 || flippedCount === numSheets)) ||
      (lastFlipDir === 'prev' && (flippedCount === 0 || flippedCount === numSheets - 1))
    );
  const bookShiftX = (() => {
    let effectiveCount = flippedCount;
    if (isEdgeLiveFlip && liveFlip) {
      if (liveFlip.sheetIdx === 0) effectiveCount = flippedCount <= 0 ? 0 : 1;
      else if (liveFlip.sheetIdx === numSheets - 1) effectiveCount = flippedCount >= numSheets ? numSheets : numSheets - 1;
    } else if (isEdgeSnapAnimating) {
      const sourceCount = lastFlipDir === 'next' ? flippedCount - 1 : flippedCount + 1;
      effectiveCount = Math.max(0, Math.min(numSheets, sourceCount));
    }
    if (effectiveCount <= 0) return -pageW / 2;
    if (effectiveCount >= numSheets) return pageW / 2;
    return 0;
  })();

  const isCoverFullyClosed = flippedCount === 0 && !isAnimating && !liveFlip;
  const isBackFullyClosed = flippedCount >= numSheets && !isAnimating && !liveFlip;
  const hideAllEdgeStacks = isCoverFullyClosed || isBackFullyClosed;

  const hideEdgeSpineBarsDuringDrag = !!liveFlip && (flippedCount <= 1 || flippedCount >= numSheets - 1);
  const isNearCoverClosingDrag =
    !!liveFlip && flippedCount === 1 && liveFlip.sheetIdx === 0 && liveFlip.rotY > -18;
  const isNearBackClosingDrag =
    !!liveFlip && flippedCount === numSheets - 1 && liveFlip.sheetIdx === numSheets - 1 && liveFlip.rotY < -162;
  const isolateActiveDragSheet = isNearCoverClosingDrag || isNearBackClosingDrag;
  const liveFlipRevealSheetIdx = liveFlip
    ? (liveFlip.side === 'right' ? liveFlip.sheetIdx + 1 : liveFlip.sheetIdx - 1)
    : null;
  const liveFlipCompanionSheetIdx = liveFlip
    ? (liveFlip.side === 'right' ? liveFlip.sheetIdx - 1 : liveFlip.sheetIdx + 1)
    : null;
  const showFlipEdgeStacks = !hideAllEdgeStacks && (isAnimating || !!liveFlip);
  const potentialLeftStackCount = hideAllEdgeStacks ? 0 : Math.min(MAX_VIS, Math.max(0, flippedCount - 1));
  const potentialRightStackCount = hideAllEdgeStacks ? 0 : Math.min(MAX_VIS, Math.max(0, numSheets - flippedCount - 1));
  const visibleLeftStackLevels = new Set<number>();
  const visibleRightStackLevels = new Set<number>();
  if (showFlipEdgeStacks) {
    for (let i = 0; i < numSheets; i += 1) {
      const isFlippedSheet = i < flippedCount;
      const dist = isFlippedSheet ? (flippedCount - 1 - i) : (i - flippedCount);
      if (dist <= 0 || dist > MAX_VIS) continue;
      const isLiveSheet = liveFlip?.sheetIdx === i;
      const isRevealDuringTurn = liveFlipRevealSheetIdx != null && i === liveFlipRevealSheetIdx;
      const keepDuringDrag = !liveFlip || isLiveSheet || isRevealDuringTurn || i === liveFlipCompanionSheetIdx;
      if (!keepDuringDrag) continue;
      if (isolateActiveDragSheet && liveFlip && i !== liveFlip.sheetIdx) continue;
      if (isCoverFullyClosed && i !== 0) continue;
      if (isBackFullyClosed && i !== numSheets - 1) continue;
      if (isFlippedSheet) visibleLeftStackLevels.add(dist);
      else visibleRightStackLevels.add(dist);
    }
  }
  const hiddenLeftStackLevels = Array.from({ length: potentialLeftStackCount }, (_, idx) => idx + 1)
    .filter((level) => !visibleLeftStackLevels.has(level));
  const hiddenRightStackLevels = Array.from({ length: potentialRightStackCount }, (_, idx) => idx + 1)
    .filter((level) => !visibleRightStackLevels.has(level));

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column',
      background: SHELF_BG, userSelect: 'none', touchAction: 'pan-y',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `calc(env(safe-area-inset-top, 0px) + 12px) 20px 12px` }}>
        <div style={{ width: 72, display: 'flex', justifyContent: 'flex-start' }}>
          {onBackToShelf ? (
            <button
              onClick={onBackToShelf}
              style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a5d4c', background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.8)', borderRadius: 22, backdropFilter: 'blur(12px)', boxShadow: '0 8px 20px rgba(0,0,0,0.04)', cursor: 'pointer' }}
            >
              <ChevronLeft size={20} strokeWidth={2.2} />
            </button>
          ) : null}
        </div>
        <div style={{ textAlign: 'center' }}>
          <div className="font-black" style={{ color: '#4a5d4c', letterSpacing: 1, fontSize: 16 }}>
            {activeHeaderDate
              ? format(activeHeaderDate, isZhHeader ? 'yyyy年 M月d日' : 'PPP', { locale: headerLocale })
              : format(currentMonth, isZhHeader ? 'yyyy年 M月' : 'MMMM yyyy', { locale: headerLocale })}
          </div>
          <div className="font-medium" style={{ color: '#4a5d4c', marginTop: 2, fontSize: 13 }}>
            {activeHeaderDate ? format(activeHeaderDate, 'EEEE', { locale: headerLocale }) : t('diary_days_count', { count: daysInMonth })}
          </div>
        </div>
        <div style={{ width: 72, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a5d4c', background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.8)', borderRadius: 22, backdropFilter: 'blur(12px)', boxShadow: '0 8px 20px rgba(0,0,0,0.04)', cursor: 'pointer' }}
          >
            <X size={20} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      {/* Book area */}
      <div
        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', perspective: 2000, overflow: 'hidden' }}
      >
        <div style={{ position: 'relative', width: wrapW, height: pageH, transformStyle: 'preserve-3d', transform: 'rotateX(0deg)' }}>

          {/* Fixed spine bars */}
          {!hideAllEdgeStacks && !hideEdgeSpineBarsDuringDrag && (isBookOpen || isAnimating || !!liveFlip) && flippedCount > 0 && (
            isAnimating && lastFlipDir === 'prev'
              ? flippedCount < numSheets - 1
              : flippedCount < numSheets
          ) && (
            <div style={{ position: 'absolute', left: spineX + bookShiftX, top: trapezoidInset, width: sideGap + sheetSpineOverlap, height: pageH - trapezoidInset * 2, background: PAPER_COLOR, transform: `translateZ(${(MAX_VIS * 4 - 2) * scale}px)`, pointerEvents: 'none' }} />
          )}
          {!hideAllEdgeStacks && !hideEdgeSpineBarsDuringDrag && (isBookOpen || isAnimating || !!liveFlip) && flippedCount < numSheets && (
            isAnimating && lastFlipDir === 'next'
              ? flippedCount > 1
              : flippedCount > 0
          ) && (
            <div style={{ position: 'absolute', left: spineX + bookShiftX - sideGap - sheetSpineOverlap, top: trapezoidInset, width: sideGap + sheetSpineOverlap, height: pageH - trapezoidInset * 2, background: PAPER_COLOR, transform: `translateZ(${(MAX_VIS * 4 - 2) * scale}px)`, pointerEvents: 'none' }} />
          )}

          {/* Decorative edge stacks during flipping */}
          {showFlipEdgeStacks && hiddenLeftStackLevels.map((vis) => {
            const idx = vis - 1;
            const offset = vis * sideGap;
            const layerShrink = (vis - 1) * heightShrink;
            const top = trapezoidInset + layerShrink / 2;
            const height = pageH - trapezoidInset * 2 - layerShrink;
            const z = (MAX_VIS - vis) * 4 * scale;
            const shadowAlpha = Math.max(0.03, 0.075 - idx * 0.012);
            const borderAlpha = Math.max(0.06, 0.12 - idx * 0.018);
            const radius = Math.round(12 * scale);
            return (
              <div
                key={`flip-edge-stack-left-${vis}`}
                style={{
                  position: 'absolute',
                  left: bookShiftX + sideMargin - offset,
                  top,
                  width: pageW,
                  height,
                  transform: `translateZ(${z}px)`,
                  pointerEvents: 'none',
                  filter: `drop-shadow(0 3px 8px rgba(0,0,0,${shadowAlpha}))`,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: PAPER_COLOR,
                    borderRadius: `${radius}px 0 0 ${radius}px`,
                    borderLeft: '1px solid rgba(255,255,255,0.75)',
                    borderRight: `1px solid rgba(164,156,141,${borderAlpha})`,
                  }}
                />
              </div>
            );
          })}
          {showFlipEdgeStacks && hiddenRightStackLevels.map((vis) => {
            const idx = vis - 1;
            const offset = vis * sideGap;
            const layerShrink = (vis - 1) * heightShrink;
            const top = trapezoidInset + layerShrink / 2;
            const height = pageH - trapezoidInset * 2 - layerShrink;
            const z = (MAX_VIS - vis) * 4 * scale;
            const shadowAlpha = Math.max(0.03, 0.075 - idx * 0.012);
            const borderAlpha = Math.max(0.06, 0.12 - idx * 0.018);
            const radius = Math.round(12 * scale);
            return (
              <div
                key={`flip-edge-stack-right-${vis}`}
                style={{
                  position: 'absolute',
                  left: bookShiftX + sideMargin + pageW + offset,
                  top,
                  width: pageW,
                  height,
                  transform: `translateZ(${z}px)`,
                  pointerEvents: 'none',
                  filter: `drop-shadow(0 3px 8px rgba(0,0,0,${shadowAlpha}))`,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: PAPER_COLOR,
                    borderRadius: `0 ${radius}px ${radius}px 0`,
                    borderLeft: `1px solid rgba(164,156,141,${borderAlpha})`,
                    borderRight: '1px solid rgba(255,255,255,0.75)',
                  }}
                />
              </div>
            );
          })}

          {/* Sheets */}
          {Array.from({ length: numSheets }, (_, i) => {
            const isFlipped = i < flippedCount;
            const dist = isFlipped ? (flippedCount - 1 - i) : (i - flippedCount);
            const isLive = liveFlip?.sheetIdx === i;
            const isRevealDuringTurn = liveFlipRevealSheetIdx != null && i === liveFlipRevealSheetIdx;
            const keepDuringDrag = !liveFlip || isLive || isRevealDuringTurn || i === liveFlipCompanionSheetIdx;
            if (!keepDuringDrag) return null;
            if (isolateActiveDragSheet && liveFlip && i !== liveFlip.sheetIdx) return null;
            if (isCoverFullyClosed && i !== 0) return null;
            if (isBackFullyClosed && i !== numSheets - 1) return null;
            const vis = Math.min(dist, MAX_VIS);
            if (dist > MAX_VIS) return null;

            const stackZ = (MAX_VIS - vis) * 4 * scale;
            const rotY = isFlipped ? -180 : 0;
            const isSnap = snapDur?.sheetIdx === i;
            const effectiveRotY = isLive ? liveFlip!.rotY : rotY;
            const offset = dist === 0 ? 0 : vis * sideGap;
            const isCurrent = dist === 0;
            const useStaticGeometry = isCurrent || isRevealDuringTurn;
            const shiftX = useStaticGeometry
              ? 0
              : ((isEdgeLiveFlip || isEdgeSnapAnimating) ? 0 : (isFlipped ? -offset : offset));
            const layerShrink = useStaticGeometry ? 0 : (dist - 1) * heightShrink;
            const sheetH = useStaticGeometry ? pageH : pageH - 2 * trapezoidInset - layerShrink;
            const topOffset = useStaticGeometry ? 0 : trapezoidInset + layerShrink / 2;
            const isCoverFront = pages[2 * i]?.type === 'cover';
            const isBackCoverBack = pages[2 * i + 1]?.type === 'back';
            const frontClip = (useStaticGeometry && !isCoverFront)
              ? `polygon(0 ${trapezoidInset}px, 100% 0, 100% 100%, 0 calc(100% - ${trapezoidInset}px))` : undefined;
            const backClip = (useStaticGeometry && !isBackCoverBack)
              ? `polygon(0 0, 100% ${trapezoidInset}px, 100% calc(100% - ${trapezoidInset}px), 0 100%)` : undefined;
            const effectiveDur = isSnap ? snapDur!.ms : FLIP_MS;
            return (
              <div key={i} style={{ position: 'absolute', left: spineX + bookShiftX, top: topOffset, width: pageW, height: sheetH, transformOrigin: 'left center', transform: `translateZ(${stackZ}px) translateX(${shiftX}px) rotateY(${effectiveRotY}deg)`, transition: isLive ? 'none' : `transform ${effectiveDur}ms cubic-bezier(0.4, 0, 0.2, 1)`, transformStyle: 'preserve-3d', pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', borderRadius: `0 ${Math.round(12*scale)}px ${Math.round(12*scale)}px 0`, overflow: 'hidden', clipPath: frontClip, filter: frontClip ? undefined : 'drop-shadow(0 3px 5px rgba(0,0,0,0.10))' }}>
                  <PageContent page={pages[2 * i]} scale={scale} allMessages={allMessages} plantRecords={plantRecords} coverBg={coverColor(currentMonth)} onOpenFlipCard={(plant, msgs) => setFlipModal({ plant, dayMessages: msgs })} />
                </div>
                <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', borderRadius: `${Math.round(12*scale)}px 0 0 ${Math.round(12*scale)}px`, overflow: 'hidden', clipPath: backClip, filter: backClip ? undefined : 'drop-shadow(0 3px 5px rgba(0,0,0,0.10))' }}>
                  <PageContent page={pages[2 * i + 1]} scale={scale} allMessages={allMessages} plantRecords={plantRecords} coverBg={coverColor(currentMonth)} />
                </div>
              </div>
            );
          })}

          {/* Center spine divider — thin line between left and right pages */}
          {isBookOpen && !isolateActiveDragSheet && (
            <div style={{
              position: 'absolute',
              left: spineX + bookShiftX,
              top: trapezoidInset,
              width: 0.5,
              height: pageH - trapezoidInset * 2,
              background: 'rgba(0,0,0,0.06)',
              pointerEvents: 'none',
              transform: `translateZ(${(MAX_VIS * 4 + 1) * scale}px)`,
            }} />
          )}

          {/* Interaction zones — drag to flip, tap to flip, double-tap to expand */}
          <div
            onPointerDown={(e) => onZonePointerDown('left', e)}
            onPointerMove={onZonePointerMove}
            onPointerUp={onZonePointerUp}
            onPointerCancel={() => { dragRef.current = null; setLiveFlip(null); pointerUpWasDrag.current = true; }}
            onClick={() => { if (!pointerUpWasDrag.current) handleZoneClick('left'); pointerUpWasDrag.current = false; }}
            style={{ position: 'absolute', left: bookShiftX, top: 0, width: sideMargin + pageW, height: pageH, cursor: liveFlip ? 'grabbing' : flippedCount > 0 ? 'grab' : 'default', transform: `translateZ(${(MAX_VIS + 3) * 18 * scale}px)`, touchAction: 'none' }}
          />
          <div
            onPointerDown={(e) => onZonePointerDown('right', e)}
            onPointerMove={onZonePointerMove}
            onPointerUp={onZonePointerUp}
            onPointerCancel={() => { dragRef.current = null; setLiveFlip(null); pointerUpWasDrag.current = true; }}
            onClick={() => { if (!pointerUpWasDrag.current) handleZoneClick('right'); pointerUpWasDrag.current = false; }}
            style={{ position: 'absolute', left: bookShiftX + sideMargin + pageW, top: 0, width: sideMargin + pageW, height: pageH, cursor: liveFlip ? 'grabbing' : flippedCount < numSheets ? 'grab' : 'default', transform: `translateZ(${(MAX_VIS + 3) * 18 * scale}px)`, touchAction: 'none' }}
          />
        </div>
        {/* Shadow beneath the book */}
        <div style={{ width: wrapW * 0.8, height: 20, marginTop: 2, background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.25) 0%, transparent 70%)', pointerEvents: 'none', flexShrink: 0 }} />
      </div>

      {/* Page indicator + day navigation */}
      <div style={{ textAlign: 'center', paddingBottom: 28 }}>
        {isBookOpen ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <button
              onClick={flipPrev}
              disabled={flippedCount <= 1 || isAnimating}
              style={{
                color: flippedCount <= 1 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.6)',
                background: 'none', border: 'none', padding: '4px 8px', borderRadius: 8,
                cursor: flippedCount <= 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center',
              }}
            >
              <ChevronLeft size={28} strokeWidth={2.2} />
            </button>
            <span className="text-sm" style={{ color: 'rgba(255,255,255,0.55)', minWidth: 56, textAlign: 'center' }}>
              {getIndicator()}
            </span>
            <button
              onClick={flipNext}
              disabled={flippedCount >= daysInMonth || isAnimating}
              style={{
                color: flippedCount >= daysInMonth ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.6)',
                background: 'none', border: 'none', padding: '4px 8px', borderRadius: 8,
                cursor: flippedCount >= daysInMonth ? 'default' : 'pointer', display: 'flex', alignItems: 'center',
              }}
            >
              <ChevronRight size={28} strokeWidth={2.2} />
            </button>
          </div>
        ) : (
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{getIndicator()}</span>
        )}
        {isBookOpen && (
          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.18)', marginTop: 3 }}>
            {onOpenDiaryPage ? t('diary_double_tap_open') : t('diary_double_tap_zoom')}
          </div>
        )}
      </div>

      {/* Expanded overlay */}
      <DiaryBookViewerExpandedView target={expandTarget} onClose={() => setExpandTarget(null)} plantRecords={plantRecords} />
      {flipModal && (
        <DiaryPlantFlipModal
          plant={flipModal.plant}
          dayMessages={flipModal.dayMessages}
          onClose={() => setFlipModal(null)}
        />
      )}
    </div>
  );
};
