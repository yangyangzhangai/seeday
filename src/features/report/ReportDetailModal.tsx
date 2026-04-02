import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, isSameDay } from 'date-fns';
import { zhCN, enUS, it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Report } from '../../store/useReportStore';
import { useReportStore } from '../../store/useReportStore';
import { useChatStore } from '../../store/useChatStore';
import { useMoodStore } from '../../store/useMoodStore';
import { usePlantStore } from '../../store/usePlantStore';
import { useAuthStore } from '../../store/useAuthStore';
import type { MoodDistributionItem, ActivityDistributionItem } from './reportPageHelpers';
import { getDailyActivityDistribution, getDailyMoodDistribution, getMessagesForReport } from './reportPageHelpers';
import { PlantImage } from './plant/PlantImage';
import starImage from '../../assets/growth/growth-star.png';

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

type PieItem = { name: string; value: number; color: string };

const ACTIVITY_COLOR_MAP: Record<string, string> = {
  work: '#D5E8CE',
  health: '#AACBA4',
  study: '#85AD80',
  social: '#6A9464',
  life: '#4E7549',
  entertainment: '#93B28D',
};

const MOOD_COLOR_MAP: Record<string, string> = {
  happy: '#F8D0DC',
  calm: '#F0AABE',
  satisfied: '#DE8BA2',
  focused: '#C46E86',
  anxious: '#DFA7B8',
  tired: '#BC7286',
  down: '#9E4E64',
  bored: '#E0B8C4',
};

const LINE_H = 18;

function lightenHex(hex: string, amount: number): string {
  const clean = hex.replace('#', '');
  const num = Number.parseInt(clean, 16);
  const r = Math.min(255, (num >> 16) + Math.round(255 * amount));
  const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * amount));
  const b = Math.min(255, (num & 0xff) + Math.round(255 * amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function DonutChart({
  data,
  maxIndex,
  chartId,
  labelColor,
  size = 110,
  innerRadius = 20,
  outerRadius = 44,
}: {
  data: PieItem[];
  maxIndex: number;
  chartId: string;
  labelColor: string;
  size?: number;
  innerRadius?: number;
  outerRadius?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) {
    return <div style={{ width: size, height: size }} />;
  }

  const halfSize = size / 2;
  const maxOuter = outerRadius + 10;
  const innerRatio = `${((innerRadius / halfSize) * 100).toFixed(1)}%`;
  const outerRatio = `${((maxOuter / halfSize) * 100).toFixed(1)}%`;

  const polar = (r: number, deg: number) => ({
    x: cx + r * Math.cos((deg * Math.PI) / 180),
    y: cy + r * Math.sin((deg * Math.PI) / 180),
  });

  let cursor = -90;
  const segments = data.map((item, index) => {
    const start = cursor;
    const sweep = (item.value / total) * 360;
    cursor += sweep;
    const end = cursor;
    const mid = (start + end) / 2;
    const isMax = index === maxIndex;
    const adjustedOuter = isMax ? outerRadius + 6 : outerRadius;
    const midRad = (mid * Math.PI) / 180;
    const ox = isMax ? Math.cos(midRad) * 3 : 0;
    const oy = isMax ? Math.sin(midRad) * 3 : 0;
    const large = sweep > 180 ? 1 : 0;
    const o1 = polar(adjustedOuter, start);
    const o2 = polar(adjustedOuter, end);
    const i1 = polar(innerRadius, end);
    const i2 = polar(innerRadius, start);
    const pathD = [
      `M ${o1.x + ox} ${o1.y + oy}`,
      `A ${adjustedOuter} ${adjustedOuter} 0 ${large} 1 ${o2.x + ox} ${o2.y + oy}`,
      `L ${i1.x + ox} ${i1.y + oy}`,
      `A ${innerRadius} ${innerRadius} 0 ${large} 0 ${i2.x + ox} ${i2.y + oy}`,
      'Z',
    ].join(' ');
    const midR = (innerRadius + adjustedOuter) / 2;
    return {
      ...item,
      pathD,
      textX: cx + ox + midR * Math.cos(midRad),
      textY: cy + oy + midR * Math.sin(midRad),
      sweep,
      isMax,
    };
  });

  return (
    <svg width={size} height={size} style={{ overflow: 'visible' }}>
      <defs>
        {segments.map((seg, idx) => (
          <radialGradient key={idx} id={`${chartId}-rg-${idx}`} cx="50%" cy="50%" r={outerRatio} fx="50%" fy="50%" gradientUnits="objectBoundingBox">
            <stop offset={innerRatio} stopColor={seg.color} stopOpacity="1" />
            <stop offset="100%" stopColor={lightenHex(seg.color, 0.18)} stopOpacity="1" />
          </radialGradient>
        ))}
      </defs>
      {segments.map((seg, idx) => (
        <path key={idx} d={seg.pathD} fill={`url(#${chartId}-rg-${idx})`} stroke={seg.isMax ? '#ffffff' : 'none'} strokeWidth={seg.isMax ? 1.5 : 0} />
      ))}
      {segments.map((seg, idx) =>
        seg.sweep < 25 ? null : (
          <text key={idx} x={seg.textX} y={seg.textY} textAnchor="middle" fill={labelColor} style={{ fontSize: '8px', fontWeight: 700, pointerEvents: 'none' }}>
            <tspan x={seg.textX} dy="-0.55em">{seg.name}</tspan>
            <tspan x={seg.textX} dy="1.2em">{seg.value}%</tspan>
          </text>
        )
      )}
    </svg>
  );
}

function WaveDivider() {
  return (
    <div
      style={{
        flexShrink: 0,
        height: 1,
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
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, overflow: 'hidden' }}>
        {lines.map((line, idx) => (
          <div key={idx} style={{ fontSize: 12, color: '#1A1A1A', lineHeight: `${LINE_H}px` }}>{line}</div>
        ))}
      </div>
    </div>
  );
}

function toPercentDist(data: ActivityDistributionItem[] | MoodDistributionItem[], colorMap: Record<string, string>, keyField: 'type' | 'mood'): PieItem[] {
  const total = data.reduce((sum, item) => sum + item.minutes, 0);
  if (total <= 0) return [];
  return data.slice(0, 5).map((item) => {
    const key = String(item[keyField]);
    const value = Math.max(1, Math.round((item.minutes / total) * 100));
    return { name: key, value, color: colorMap[key] || '#C7C7C7' };
  });
}

export const ReportDetailModal: React.FC<ReportDetailModalProps> = ({
  selectedReport,
  dailyMoodDistribution,
  onClose,
  onBack,
  onShowTaskList,
  generateAIDiary,
  initialPage,
  readOnly,
  onNavigatePrev,
  onNavigateNext,
  canNavigateNext,
}) => {
  const { t, i18n } = useTranslation();
  const { updateReport } = useReportStore();
  const messages = useChatStore((state) => state.messages);
  const dateCache = useChatStore((state) => state.dateCache);
  const activityMood = useMoodStore((state) => state.activityMood);
  const todayPlant = usePlantStore((state) => state.todayPlant);
  const isPlus = useAuthStore((state) => state.isPlus);
  const [activePage, setActivePage] = useState<0 | 1>(0);
  const [noteValue, setNoteValue] = useState('');

  useEffect(() => {
    setActivePage(initialPage ?? 0);
    setNoteValue(selectedReport?.userNote ?? '');
  }, [selectedReport?.id, initialPage]);

  const locale = i18n.language?.startsWith('zh') ? zhCN : i18n.language?.startsWith('it') ? it : enUS;

  const reportMessages = useMemo(
    () => getMessagesForReport(messages, dateCache, selectedReport),
    [messages, dateCache, selectedReport]
  );

  const activityDistribution = selectedReport
    ? getDailyActivityDistribution(reportMessages, selectedReport)
    : [];

  const moodDistribution = selectedReport
    ? getDailyMoodDistribution(reportMessages, activityMood, selectedReport)
    : dailyMoodDistribution;

  const activityData = toPercentDist(activityDistribution, ACTIVITY_COLOR_MAP, 'type');
  const moodData = toPercentDist(moodDistribution, MOOD_COLOR_MAP, 'mood');
  const maxAct = activityData.length > 0 ? activityData.reduce((m, c, i, arr) => (c.value > arr[m].value ? i : m), 0) : 0;
  const maxMood = moodData.length > 0 ? moodData.reduce((m, c, i, arr) => (c.value > arr[m].value ? i : m), 0) : 0;

  const completedTodos = selectedReport?.stats?.completedTodos ?? 0;
  const totalTodos = selectedReport?.stats?.totalTodos ?? 0;
  const todoRate = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;
  const remainingTodos = Math.max(0, totalTodos - completedTodos);

  const stars = Math.min(10, (selectedReport?.stats?.goalProgress?.reduce((sum, item) => sum + item.currentStars, 0) ?? 0) || completedTodos);
  const starRows = [0, 1].map((row) => Array.from({ length: 5 }).map((_, col) => row * 5 + col));

  const isToday = selectedReport ? isSameDay(new Date(selectedReport.date), new Date()) : false;

  if (!selectedReport) return null;

  const saveNote = () => updateReport(selectedReport.id, { userNote: noteValue });

  return (
    <div className="fixed inset-0 z-[60]" style={{ background: '#ffffff' }}>
      <div className="h-full flex justify-center items-start" style={{ background: '#ffffff' }}>
        <div className="w-full max-w-[430px] h-full relative flex flex-col overflow-hidden" style={{ background: '#ffffff' }}>
          <div className="h-12 flex items-center justify-between flex-shrink-0" style={{ paddingLeft: 16, paddingRight: 16, marginTop: 'env(safe-area-inset-top)' }}>
            <button className="p-1" onClick={onBack ?? onClose}>
              <ChevronLeft className="w-6 h-6" style={{ color: '#1A1A1A' }} />
            </button>
            <h2 style={{ color: '#1A1A1A', fontSize: 22, fontWeight: 700 }}>{t('report_my_diary')}</h2>
            <button className="p-1" onClick={() => setActivePage(activePage === 0 ? 1 : 0)}>
              {activePage === 0 ? (
                <ChevronRight className="w-6 h-6" style={{ color: '#1A1A1A' }} />
              ) : (
                <ChevronLeft className="w-6 h-6" style={{ color: '#1A1A1A' }} />
              )}
            </button>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: 12, paddingBottom: 12, paddingLeft: 16, paddingRight: 16, overflow: 'hidden', minHeight: 0 }}>
            <div style={{ flexShrink: 0, marginBottom: 8 }}>
              <h1 style={{ color: '#1A1A1A', marginBottom: 8, fontSize: 16, fontWeight: 700, textAlign: 'center' }}>
                {format(new Date(selectedReport.date), i18n.language?.startsWith('zh') ? 'yyyy年M月d日 EEEE' : 'EEEE, MMMM d, yyyy', { locale })}
              </h1>
              <div style={{ borderTop: '0.5px solid #AEAABF' }} />
            </div>

            {activePage === 0 ? (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ flexShrink: 0, alignSelf: 'flex-start', fontSize: 13, fontWeight: 700, padding: '1px 6px' }}>{t('report_activity_category')}</div>
                  <SectionRow
                    left={<DonutChart data={activityData} maxIndex={maxAct} chartId="activity" labelColor="#2D5A30" />}
                    lines={activityData.length > 0 ? [`${activityData[0].name} ${activityData[0].value}%`, t('report_swipe_hint')] : [t('report_no_data'), t('report_no_data')]}
                  />
                </div>

                <WaveDivider />

                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ flexShrink: 0, alignSelf: 'flex-start', fontSize: 13, fontWeight: 700, padding: '1px 6px' }}>{t('report_today_mood_spectrum')}</div>
                  <SectionRow
                    left={<DonutChart data={moodData} maxIndex={maxMood} chartId="mood" labelColor="#A0304A" />}
                    lines={moodData.length > 0 ? [`${moodData[0].name} ${moodData[0].value}%`, t('report_swipe_hint')] : [t('report_no_data'), t('report_no_data')]}
                  />
                </div>

                <WaveDivider />

                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ flexShrink: 0, alignSelf: 'flex-start', fontSize: 13, fontWeight: 700, padding: '1px 6px' }}>{t('report_task_completion_rate')}</div>
                  <SectionRow
                    left={
                      <button onClick={() => onShowTaskList('total')} style={{ display: 'flex', gap: 5, background: 'transparent', border: 'none', padding: 0 }}>
                        {Array.from({ length: 12 }).map((_, idx) => (
                          <div key={idx} style={{ width: 6, height: 3, borderRadius: 1, backgroundColor: idx < Math.round((todoRate / 100) * 12) ? '#F5C842' : '#EDE0B0' }} />
                        ))}
                      </button>
                    }
                    lines={[`${todoRate}% ${t('report_completed')}`, `${remainingTodos} ${t('report_pending')}`]}
                  />
                </div>

                <WaveDivider />

                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ flexShrink: 0, alignSelf: 'flex-start', fontSize: 13, fontWeight: 700, padding: '1px 6px' }}>{t('growth_habits')}</div>
                  <SectionRow
                    left={
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                        {starRows.map((row, rowIdx) => (
                          <div key={rowIdx} style={{ display: 'flex', gap: 4 }}>
                            {row.map((idx) => (
                              <img key={idx} src={starImage} alt="star" style={{ width: 20, height: 20, objectFit: 'contain', opacity: idx < stars ? 1 : 0.25 }} />
                            ))}
                          </div>
                        ))}
                      </div>
                    }
                    lines={[t('report_habit_goal_streak'), `${stars}/10`]} 
                  />
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                <div style={{ flex: 2, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ flexShrink: 0, fontSize: 13, fontWeight: 700, padding: '1px 0' }}>{t('report_ai_diary_analysis')}</div>
                  <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', paddingRight: 8 }}>
                    {isToday && todayPlant ? (
                      <div style={{ float: 'left', width: 150, marginRight: 8, background: '#FFFFFF' }}>
                        <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <PlantImage
                            plantId={todayPlant.plantId}
                            rootType={todayPlant.rootType}
                            plantStage={todayPlant.plantStage}
                            imgClassName="h-full w-full object-contain"
                          />
                        </div>
                      </div>
                    ) : null}

                    {selectedReport.analysisStatus === 'idle' || (!selectedReport.analysisStatus && !selectedReport.aiAnalysis) ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <p style={{ margin: 0, fontSize: 12, lineHeight: '18px', color: '#1A1A1A' }}>{t('report_ai_diary_waiting')}</p>
                        <button
                          onClick={() => {
                            if (!isPlus) return;
                            generateAIDiary(selectedReport.id);
                          }}
                          disabled={!isPlus}
                          style={{
                            width: 'fit-content',
                            background: isPlus ? '#5a7a4a' : '#c8c8c8',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 8,
                            padding: '6px 10px',
                            fontSize: 12,
                          }}
                        >
                          {isPlus ? t('report_generate_diary') : t('report_upgrade_title')}
                        </button>
                      </div>
                    ) : selectedReport.analysisStatus === 'generating' ? (
                      <p style={{ margin: 0, fontSize: 12, lineHeight: '18px', color: '#1A1A1A' }}>{t('report_generating')}</p>
                    ) : (
                      <p style={{ margin: 0, padding: 0, fontSize: 12, lineHeight: '18px', color: '#1A1A1A', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {selectedReport.aiAnalysis || t('report_no_data')}
                      </p>
                    )}
                  </div>
                </div>

                <WaveDivider />

                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ flexShrink: 0, fontSize: 13, fontWeight: 700, padding: '1px 0' }}>{t('report_my_diary')}</div>
                  {readOnly ? (
                    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', fontSize: 12, lineHeight: '18px', color: '#1A1A1A', whiteSpace: 'pre-wrap' }}>
                      {noteValue || t('report_diary_empty')}
                    </div>
                  ) : (
                    <textarea
                      placeholder={t('report_diary_placeholder')}
                      value={noteValue}
                      onChange={(e) => setNoteValue(e.target.value)}
                      onBlur={saveNote}
                      style={{
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        outline: 'none',
                        resize: 'none',
                        background: 'transparent',
                        lineHeight: `${LINE_H}px`,
                        fontSize: 12,
                        color: '#1A1A1A',
                        padding: 0,
                        margin: 0,
                        fontFamily: 'inherit',
                        boxSizing: 'border-box',
                      }}
                    />
                  )}
                </div>
              </div>
            )}

            <div style={{ flexShrink: 0, borderTop: '0.5px solid #D0D0D0', marginTop: 4 }} />

            {(onNavigatePrev || onNavigateNext) && (
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center', gap: 12 }}>
                <button onClick={onNavigatePrev} style={{ border: 'none', background: 'transparent', color: '#6b5a3e', fontSize: 12 }}>
                  {t('diary_nav_prev')}
                </button>
                <button onClick={onNavigateNext} disabled={!canNavigateNext} style={{ border: 'none', background: 'transparent', color: canNavigateNext ? '#6b5a3e' : '#bdbdbd', fontSize: 12 }}>
                  {t('diary_nav_next')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
