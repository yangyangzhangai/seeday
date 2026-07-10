// DOC-DEPS: src/features/report/README.md, docs/PROJECT_MAP.md, docs/CURRENT_TASK.md
import React from 'react';
import { format, startOfDay, endOfDay, isSameDay } from 'date-fns';
import { enUS, it as itLocale, zhCN } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMoodStore } from '../../store/useMoodStore';
import { useAuthStore } from '../../store/useAuthStore';
import { normalizeMoodKey } from '../../lib/moodOptions';
import { computeActivityDistribution } from './reportPageHelpers';
import type { DailyPlantRecord } from '../../types/plant';
import { PlantImage } from './plant/PlantImage';
import { generateActionSummary, generateMoodSummary } from '../../store/reportHelpers';
import { DIARY_COPY, type DiaryLang, type PageData } from './diaryBookViewerData';
import {
  ACTIVITY_UI_COLORS,
  MOOD_UI_COLORS,
  DIARY_LINE_SOLID,
  DIARY_LINE_DASHED,
  CUSTOM_MOOD_LABELS,
  BASE_PAGE_W,
  BASE_PAGE_H,
  BASE_HEIGHT_SHRINK,
  LEATHER_TEXTURE,
  PARCHMENT_TEXTURE,
  PAPER_COLOR,
  shouldUseStoredLocalizedSummary,
} from './diaryBookViewerTheme';
import type { Message } from '../../store/useChatStore';

type PageContentProps = {
  page: PageData;
  scale: number;
  allMessages: Message[];
  plantRecords: DailyPlantRecord[];
  coverBg: string;
  onOpenFlipCard?: (plant: DailyPlantRecord, msgs: Message[]) => void;
};

export function DiaryBookViewerPageContent({
  page,
  scale,
  allMessages,
  plantRecords,
  coverBg,
  onOpenFlipCard,
}: PageContentProps) {
  const px = (n: number) => n * scale;
  const { i18n, t: tr } = useTranslation();
  const navigate = useNavigate();
  const isPlus = useAuthStore((state) => state.isPlus);
  const activityMood = useMoodStore((state) => state.activityMood);
  const customMoodLabel = useMoodStore((state) => state.customMoodLabel);
  const customMoodApplied = useMoodStore((state) => state.customMoodApplied);
  const trapInset = px(BASE_HEIGHT_SHRINK / 2);
  const langRaw = i18n.language?.split('-')[0] ?? 'en';
  const lang: DiaryLang = langRaw === 'zh' || langRaw === 'it' ? langRaw : 'en';
  const copy = DIARY_COPY[lang];

  const pageWidth = BASE_PAGE_W * scale;
  const pageHeight = BASE_PAGE_H * scale;
  const lk = pageHeight / (pageHeight - 2 * trapInset);
  const leftPageTransform = `matrix3d(${lk},${(trapInset * lk) / pageWidth},0,${(2 * trapInset * lk) / (pageHeight * pageWidth)},0,1,0,0,0,0,1,0,0,0,0,1)`;
  const rk = (pageHeight - 2 * trapInset) / pageHeight;
  const rightPageTransform = `matrix3d(${rk},${-trapInset / pageWidth},0,${(-2 * trapInset) / (pageHeight * pageWidth)},0,${rk},0,0,0,0,1,0,0,${trapInset},0,1)`;

  if (page.type === 'cover') {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', backgroundColor: coverBg, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: px(22), background: 'linear-gradient(to right, rgba(0,0,0,0.45), rgba(0,0,0,0.15), transparent)', opacity: 0.8, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.2)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${LEATHER_TEXTURE})`, backgroundSize: 'cover', opacity: 0.12, mixBlendMode: 'overlay', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${PARCHMENT_TEXTURE})`, backgroundSize: 'cover', opacity: 0.35, mixBlendMode: 'multiply', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: px(20), right: 0, top: 0, bottom: 0, background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.05), transparent)', transform: 'skewX(-15deg)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: px(6) }}>
          <div style={{ fontSize: px(14), fontWeight: 900, letterSpacing: 2, color: 'rgba(255,255,255,0.9)', textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>{tr('report_view_diary_book')}</div>
          <div style={{ fontSize: px(8), fontWeight: 700, letterSpacing: 3, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>{tr('diary_cover_subtitle')}</div>
        </div>
      </div>
    );
  }

  if (page.type === 'back') {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', backgroundColor: coverBg, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: px(22), background: 'linear-gradient(to left, rgba(0,0,0,0.45), rgba(0,0,0,0.15), transparent)', opacity: 0.8, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.2)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${LEATHER_TEXTURE})`, backgroundSize: 'cover', opacity: 0.12, mixBlendMode: 'overlay', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${PARCHMENT_TEXTURE})`, backgroundSize: 'cover', opacity: 0.35, mixBlendMode: 'multiply', pointerEvents: 'none' }} />
      </div>
    );
  }

  if (page.type === 'blank') {
    return <div style={{ width: '100%', height: '100%', background: PAPER_COLOR }} />;
  }

  const dayDate = page.date;
  const dayPlant = dayDate ? plantRecords.find((p) => p.date === format(dayDate, 'yyyy-MM-dd')) : null;
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
    .filter((m) => m.timestamp >= dayStart && m.timestamp <= dayEnd && m.type !== 'system' && m.mode === 'record')
    .sort((a, b) => a.timestamp - b.timestamp);
  const actDist = computeActivityDistribution(dayMsgs);

  const actionAnalysis = (report.stats?.actionAnalysis ?? [])
    .filter((item) => item.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);

  const moodMinutes: Record<string, number> = {};
  dayMsgs.forEach((msg) => {
    if (msg.isActive) return;
    const baseMood = activityMood[msg.id] ?? msg.moodDescriptions?.[0]?.content;
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
    .filter((item) => item.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);

  const moodDistribution = (report.stats?.moodDistribution ?? [])
    .filter((item) => item.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);

  const activitySlices = actionAnalysis.length > 0
    ? actionAnalysis.slice(0, 5).map((item, index) => ({
      color: ACTIVITY_UI_COLORS[index] || ACTIVITY_UI_COLORS[ACTIVITY_UI_COLORS.length - 1],
      value: item.minutes,
    }))
    : actDist.length > 0
      ? actDist.slice(0, 5).map((item, index) => ({
        color: ACTIVITY_UI_COLORS[index] || ACTIVITY_UI_COLORS[ACTIVITY_UI_COLORS.length - 1],
        value: item.minutes,
      }))
      : [{ color: '#E5E7EB', value: 1 }];
  const moodSlices = moodDistribution.length > 0
    ? moodDistribution.slice(0, 4).map((item, index) => ({
      color: MOOD_UI_COLORS[index] || MOOD_UI_COLORS[MOOD_UI_COLORS.length - 1],
      value: item.minutes,
    }))
    : moodDist.length > 0
      ? moodDist.slice(0, 4).map((item, index) => ({
        color: MOOD_UI_COLORS[index] || MOOD_UI_COLORS[MOOD_UI_COLORS.length - 1],
        value: item.minutes,
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

  const todoCompleted = report.stats?.completedTodos ?? 0;
  const todoTotal = report.stats?.totalTodos ?? 0;
  const todoRate = todoTotal > 0 ? todoCompleted / todoTotal : 0;
  const todoSegments = 12;
  const todoLitCount = todoTotal > 0 ? Math.max(1, Math.round(todoRate * todoSegments)) : 0;
  const habitDone = report.stats?.habitCheckin?.filter((item) => item.done).length ?? 0;
  const goalDone = report.stats?.goalProgress?.filter((item) => item.doneToday).length ?? 0;
  const starsToday = habitDone + goalDone;
  const starSlots = Math.max(8, starsToday);

  const dateLocale = lang === 'zh' ? zhCN : lang === 'it' ? itLocale : enUS;
  const datePattern = lang === 'zh' ? 'yyyy年M月d日 EEEE' : 'EEEE, MMMM d, yyyy';
  const headerDate = dayDate ? format(dayDate, datePattern, { locale: dateLocale }) : '';
  const isFreeWaitingForTeaser = !isPlus && !report.teaserText?.trim() && report.analysisStatus !== 'error' && report.analysisStatus !== 'generating';
  const observationText = isPlus
    ? report.aiAnalysis?.trim() || copy.observationFallback
    : isFreeWaitingForTeaser
      ? tr('report_generating_variant_1', { companion: 'Van' })
      : report.teaserText?.trim() || copy.observationFallback;
  const myDiary = report.userNote?.trim() || copy.diaryPlaceholder;

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
  const observationTextStyle: React.CSSProperties = {
    minHeight: '64%',
    fontSize: px(5.2),
    lineHeight: 1.45,
    color: '#2f2f2f',
    fontFamily: 'Georgia, "Times New Roman", serif',
    textAlign: lang === 'zh' ? 'justify' : 'left',
    textJustify: lang === 'zh' ? 'inter-word' : 'auto',
    wordBreak: 'normal',
    overflowWrap: 'break-word',
    overflowY: 'auto',
    overflowX: 'hidden',
    WebkitOverflowScrolling: 'touch',
    position: 'relative',
  };
  const donutSize = px(26);

  if (page.type === 'day-left') {
    const storedActivitySummary = report.stats?.actionSummary?.trim() || '';
    const storedMoodSummary = report.stats?.moodSummary?.trim() || '';
    const activitySummary = shouldUseStoredLocalizedSummary(storedActivitySummary, lang)
      ? storedActivitySummary
      : actionAnalysis.length > 0
        ? generateActionSummary(actionAnalysis, lang)
        : copy.activityFallback;
    const moodSummary = shouldUseStoredLocalizedSummary(storedMoodSummary, lang)
      ? storedMoodSummary
      : moodDistribution.length > 0
        ? generateMoodSummary(moodDistribution, lang)
        : moodDist.length > 0
          ? generateMoodSummary(moodDist, lang)
          : copy.moodFallback;
    const todoSummary = todoTotal > 0 ? `${todoCompleted}/${todoTotal}` : copy.todoFallback;
    const habitSummary = starsToday > 0 ? tr('diary_star_count', { count: starsToday }) : copy.habitsFallback;

    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', background: PAPER_COLOR }}>
        <div style={{ position: 'absolute', inset: 0, boxSizing: 'border-box', padding: `${px(8)}px ${px(8)}px ${px(14)}px ${px(8)}px`, display: 'flex', flexDirection: 'column', gap: px(3), transform: leftPageTransform, transformOrigin: '0 0' }}>
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

  if (page.type === 'day-right') {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', background: PAPER_COLOR }}>
        <div style={{ position: 'absolute', inset: 0, boxSizing: 'border-box', padding: `${px(8)}px ${px(8)}px ${px(14)}px ${px(8)}px`, display: 'flex', flexDirection: 'column', gap: px(3), transform: rightPageTransform, transformOrigin: '0 0' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: px(8.2), fontWeight: 700, color: '#202020', fontFamily: 'Georgia, "Times New Roman", serif' }}>{copy.pageTitle}</div>
            <div style={{ marginTop: px(1), fontSize: px(5), color: '#555', fontFamily: 'Georgia, "Times New Roman", serif' }}>{headerDate}</div>
          </div>
          <div style={{ borderTop: DIARY_LINE_SOLID }} />

          <h3 style={sectionTitleStyle}>{copy.sectionObservation}</h3>
          <div style={observationTextStyle}>
            <div style={{ float: 'left', width: px(64), height: px(64), margin: `0 ${px(3)}px ${px(2)}px 0`, opacity: 0.92, cursor: dayPlant ? 'pointer' : 'default' }} onClick={() => dayPlant && onOpenFlipCard?.(dayPlant, dayMsgs)}>
              {dayPlant ? (
                <PlantImage plantId={dayPlant.plantId} rootType={dayPlant.rootType} plantStage={dayPlant.plantStage} imgClassName="h-full w-full object-contain" />
              ) : (
                <div style={{ width: '100%', height: '100%' }} />
              )}
            </div>
            {observationText}
            <div style={{ clear: 'both' }} />
            {isFreeWaitingForTeaser ? null : !isPlus ? (
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0) 36%, rgba(255,255,255,0.9) 68%, rgba(255,255,255,1) 100%)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: px(3) }}>
                <button type="button" onClick={() => navigate('/upgrade')} style={{ border: 'none', borderRadius: 999, background: '#4f46e5', color: '#fff', fontSize: px(4.4), fontWeight: 700, padding: `${px(1.5)}px ${px(3)}px` }}>
                  {tr('report_teaser_unlock')}
                </button>
              </div>
            ) : null}
          </div>

          <div style={{ borderTop: DIARY_LINE_DASHED }} />

          <h3 style={sectionTitleStyle}>{copy.sectionMyDiary}</h3>
          <div style={{ fontSize: px(5.2), lineHeight: 1.45, color: report.userNote?.trim() ? '#2f2f2f' : 'rgba(95,95,95,0.56)', fontFamily: 'Georgia, "Times New Roman", serif', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>
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
