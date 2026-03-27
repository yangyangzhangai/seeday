import React, { useState, useCallback, useRef, useEffect } from 'react';
import { format, getDaysInMonth, startOfMonth, endOfMonth, startOfDay, endOfDay, isSameDay } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Report } from '../../store/useReportStore';
import { useChatStore } from '../../store/useChatStore';
import type { Message } from '../../store/useChatStore';
import { useMoodStore } from '../../store/useMoodStore';
import { normalizeMoodKey } from '../../lib/moodOptions';
import { computeActivityDistribution } from './reportPageHelpers';
import { ACTIVITY_COLORS } from './ActivityPieChart';
import { callPlantHistoryAPI } from '../../api/client';
import type { DailyPlantRecord } from '../../types/plant';
import { PlantImage } from './plant/PlantImage';

const MOOD_COLORS: Record<string, string> = {
  happy: '#F9A8D4', calm: '#93C5FD', focused: '#86EFAC',
  satisfied: '#FDE68A', tired: '#9CA3AF', bored: '#C7D2FE',
  down: '#60A5FA', anxious: '#9CA3AF',
};

/* ────────────────────────── tuning constants ────────────────────────── */
const BASE_PAGE_W = 180;
const BASE_PAGE_H = 260;
const FLIP_MS = 550;
const BASE_SIDE_GAP = 6;
const MAX_VIS = 4;
const BASE_HEIGHT_SHRINK = 20;
const PAPER_COLOR = '#ffffff';
const COVER_COLOR = 'linear-gradient(160deg, #f5edda 0%, #ecdfc6 100%)';
const SPINE_STRIP_W = 14;
const BASE_SHEET_SPINE_OVERLAP = 2;
const TRAPEZOID_ANGLE_DEG = Math.atan((BASE_HEIGHT_SHRINK / 2) / BASE_PAGE_W) * (180 / Math.PI);

/* ──────────────────────────────── types ──────────────────────────────── */
interface Props {
  onClose: () => void;
  reports: Report[];
  initialMonth?: Date;
  initialFlippedCount?: number;
  onOpenDiaryPage?: (date: Date, subPage: 0 | 1, flippedCount: number) => void;
}

type PageData = {
  type: 'cover' | 'day-left' | 'day-right' | 'blank' | 'back';
  dayNum?: number;
  date?: Date;
  report?: Report;
};

/* ──────────────────────────────── data ───────────────────────────────── */
/** Each day occupies TWO pages: day-left (plant + report) and day-right (AI notes + diary). */
function buildPages(month: Date, reports: Report[]): PageData[] {
  const days = getDaysInMonth(month);
  const pages: PageData[] = [];
  pages.push({ type: 'cover' });
  for (let d = 1; d <= days; d++) {
    const date = new Date(month.getFullYear(), month.getMonth(), d);
    const report = reports.find(r => r.type === 'daily' && isSameDay(new Date(r.date), date));
    pages.push({ type: 'day-left',  dayNum: d, date, report });
    pages.push({ type: 'day-right', dayNum: d, date, report });
  }
  if (pages.length % 2 === 0) pages.push({ type: 'blank' });
  pages.push({ type: 'back' });
  return pages;
}

/* ──────────────────────────── page content ───────────────────────────── */
function PageContent({ page, scale, allMessages, plantRecords }: { page: PageData; scale: number; allMessages: Message[]; plantRecords: DailyPlantRecord[] }) {
  const px = (n: number) => n * scale;
  const activityMood = useMoodStore(state => state.activityMood);
  const trapInset = px(BASE_HEIGHT_SHRINK / 2);

  // Projective (homographic) transforms: map content rectangle corners → trapezoid corners
  // Left page (back face): outer(left) edge tall, spine(right) edge short
  //   (0,0)→(0,0)  (W,0)→(W,t)  (W,H)→(W,H-t)  (0,H)→(0,H)
  // Right page (front face): spine(left) edge short, outer(right) edge tall
  //   (0,0)→(0,t)  (W,0)→(W,0)  (W,H)→(W,H)  (0,H)→(0,H-t)
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
      <div style={{ position: 'relative', width: '100%', height: '100%', background: COVER_COLOR, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#6b5a3e' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: px(SPINE_STRIP_W), height: '100%', background: 'rgba(0,0,0,0.15)', backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.18) 0px, rgba(255,255,255,0.18) 1.5px, transparent 1.5px, transparent 4px)' }} />
        <div style={{ fontSize: px(18), fontWeight: 700, letterSpacing: 3 }}>日记本</div>
        <div style={{ fontSize: px(11), opacity: 0.55, marginTop: px(6) }}>Diary</div>
      </div>
    );
  }

  /* ── back cover ── */
  if (page.type === 'back') {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', background: COVER_COLOR }}>
        <div style={{ position: 'absolute', right: 0, top: 0, width: px(SPINE_STRIP_W), height: '100%', background: 'rgba(0,0,0,0.15)', backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.18) 0px, rgba(255,255,255,0.18) 1.5px, transparent 1.5px, transparent 4px)' }} />
      </div>
    );
  }

  /* ── blank ── */
  if (page.type === 'blank') {
    return <div style={{ width: '100%', height: '100%', background: PAPER_COLOR }} />;
  }

  /* ── day-left: plant image + report stats ── */
  if (page.type === 'day-left') {
    const { date, dayNum, report } = page;
    const dayPlant = date ? plantRecords.find(p => p.date === format(date, 'yyyy-MM-dd')) : null;
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', background: PAPER_COLOR }}>
        {/* Inner content wrapper — projective transform to match trapezoid shape */}
        <div style={{
          position: 'absolute', inset: 0, boxSizing: 'border-box',
          padding: `${px(10)}px ${px(10)}px ${px(16)}px ${px(10)}px`,
          display: 'flex', flexDirection: 'column', gap: px(3),
          transform: leftPageTransform,
          transformOrigin: '0 0',
        }}>

        {/* Date */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: px(3), flexShrink: 0 }}>
          <span style={{ fontSize: px(13), fontWeight: 700, color: '#4a3a2a', lineHeight: 1 }}>{dayNum}</span>
          <span style={{ fontSize: px(6.5), color: '#9a8878' }}>
            {date && format(date, 'M月d日', { locale: zhCN })}
          </span>
        </div>

        {/* Plant image — no border, drawn directly into the page */}
        <div style={{ flexShrink: 0, height: px(65), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {dayPlant ? (
            <PlantImage
              plantId={dayPlant.plantId}
              rootType={dayPlant.rootType}
              plantStage={dayPlant.plantStage}
              imgClassName="max-h-full max-w-full object-contain"
            />
          ) : (
            <span style={{ fontSize: px(14), opacity: 0.2 }}>🌱</span>
          )}
        </div>

        {/* Activity categories + mood spectrum + task stats */}
        {(() => {
          const dayStart = date ? startOfDay(date).getTime() : 0;
          const dayEnd = date ? endOfDay(date).getTime() : 0;
          const dayMsgs = allMessages
            .filter(m => m.timestamp >= dayStart && m.timestamp <= dayEnd && m.type !== 'system' && m.mode === 'record')
            .sort((a, b) => a.timestamp - b.timestamp);

          // Compute mood distribution from messages
          const moodMinutes: Record<string, number> = {};
          dayMsgs.forEach(msg => {
            if (msg.isActive) return;
            const mood = activityMood[msg.id] ?? (msg.moodDescriptions?.[0]?.content);
            if (mood && msg.duration && msg.duration > 0) {
              const key = normalizeMoodKey(mood) || mood;
              moodMinutes[key] = (moodMinutes[key] || 0) + msg.duration;
            }
          });
          const moodDist = Object.entries(moodMinutes)
            .map(([mood, minutes]) => ({ mood, minutes }))
            .filter(d => d.minutes > 0)
            .sort((a, b) => b.minutes - a.minutes);
          const totalMoodMins = moodDist.reduce((s, d) => s + d.minutes, 0);

          // Compute activity distribution — category list (no pie)
          const actDist = computeActivityDistribution(dayMsgs);
          const totalActMins = actDist.reduce((s, d) => s + d.minutes, 0);

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: px(2), overflow: 'hidden', flex: 1 }}>
              {/* Activity category list */}
              {actDist.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: px(1), flexShrink: 0 }}>
                  {actDist.slice(0, 3).map(d => {
                    const pct = totalActMins > 0 ? Math.round(d.minutes / totalActMins * 100) : 0;
                    return (
                      <div key={d.type} style={{ display: 'flex', alignItems: 'center', gap: px(2) }}>
                        <div style={{ width: px(3.5), height: px(3.5), borderRadius: '50%', background: ACTIVITY_COLORS[d.type] || '#9CA3AF', flexShrink: 0 }} />
                        <span style={{ fontSize: px(5), color: '#5a4a3a', flex: 1 }}>{d.type}</span>
                        <div style={{ flex: 2, height: px(3), borderRadius: px(1.5), background: '#f3f4f6', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', borderRadius: px(1.5), background: ACTIVITY_COLORS[d.type] || '#9CA3AF' }} />
                        </div>
                        <span style={{ fontSize: px(4.5), color: '#888', minWidth: px(14), textAlign: 'right' }}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Mood spectrum — mini horizontal bar */}
              {moodDist.length > 0 && (
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: px(5), color: '#888', marginBottom: px(1) }}>心情光谱</div>
                  <div style={{ display: 'flex', height: px(5), borderRadius: px(2), overflow: 'hidden', width: '100%' }}>
                    {moodDist.map(d => (
                      <div key={d.mood} style={{ flex: d.minutes / totalMoodMins, background: MOOD_COLORS[d.mood] || '#93C5FD' }} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: `${px(1)}px ${px(3)}px`, marginTop: px(1.5) }}>
                    {moodDist.slice(0, 3).map(d => (
                      <div key={d.mood} style={{ display: 'flex', alignItems: 'center', gap: px(1.5) }}>
                        <div style={{ width: px(3.5), height: px(3.5), borderRadius: '50%', background: MOOD_COLORS[d.mood] || '#93C5FD', flexShrink: 0 }} />
                        <span style={{ fontSize: px(5), color: '#666' }}>{d.mood} {Math.round(d.minutes / totalMoodMins * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Task stats */}
              {report?.stats && (
                <div style={{ marginTop: 'auto', fontSize: px(5.5), color: '#aaa', flexShrink: 0 }}>
                  ✓ {report.stats.completedTodos}/{report.stats.totalTodos}
                </div>
              )}
            </div>
          );
        })()}
        {/* Page number */}
        <div style={{ position: 'absolute', bottom: px(6), left: 0, right: 0, textAlign: 'center', fontSize: px(5.5), color: 'rgba(0,0,0,0.25)', letterSpacing: 0.5, pointerEvents: 'none' }}>
          {dayNum != null ? 2 * dayNum - 1 : ''}
        </div>
        </div>{/* end inner skewed wrapper */}
      </div>
    );
  }

  /* ── day-right: AI notes + user diary lines ── */
  if (page.type === 'day-right') {
    const { date: rightDate, report } = page;
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', background: PAPER_COLOR }}>
        {/* Inner content wrapper — projective transform to match trapezoid shape */}
        <div style={{
          position: 'absolute', inset: 0, boxSizing: 'border-box',
          padding: `${px(10)}px ${px(10)}px ${px(16)}px ${px(10)}px`,
          display: 'flex', flexDirection: 'column', gap: px(3),
          transform: rightPageTransform,
          transformOrigin: '0 0',
        }}>
        {/* AI 观察日记 — no card background */}
        <div style={{ flexShrink: 0, maxHeight: px(90), overflow: 'hidden' }}>
          <div style={{ fontSize: px(5.5), fontWeight: 700, color: '#333', marginBottom: px(2), display: 'flex', alignItems: 'center', gap: px(1.5) }}>
            ✦ AI 观察日记
          </div>
          {report?.aiAnalysis ? (
            <p style={{ margin: 0, fontSize: px(5.5), color: '#444', lineHeight: 1.55,
              overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 8, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>
              {report.aiAnalysis}
            </p>
          ) : (
            <span style={{ fontSize: px(5.5), color: 'rgba(0,0,0,0.25)', fontStyle: 'italic' }}>
              {report ? '观察员正在整理…' : ''}
            </span>
          )}
        </div>

        {/* 我的日记 — no card background */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontSize: px(5.5), fontWeight: 700, color: '#333', marginBottom: px(2), display: 'flex', alignItems: 'center', gap: px(1.5) }}>
            ✎ 我的日记
          </div>
          {report?.userNote ? (
            <p style={{ margin: 0, fontSize: px(5.5), color: '#444', lineHeight: 1.55,
              overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>
              {report.userNote}
            </p>
          ) : (
            <span style={{ fontSize: px(5.5), color: 'rgba(0,0,0,0.25)', fontStyle: 'italic' }}>
              {report ? '未留下文字…' : ''}
            </span>
          )}
        </div>
        {/* Page number */}
        <div style={{ position: 'absolute', bottom: px(6), left: 0, right: 0, textAlign: 'center', fontSize: px(5.5), color: 'rgba(0,0,0,0.25)', letterSpacing: 0.5, pointerEvents: 'none' }}>
          {page.dayNum != null ? 2 * page.dayNum : ''}
        </div>
        </div>{/* end inner skewed wrapper */}
      </div>
    );
  }

  return null;
}

/* ──────────────────────────── expanded overlay ────────────────────────── */
type ExpandTarget = { side: 'left' | 'right'; page: PageData } | null;

function ExpandedView({ target, onClose, plantRecords }: { target: ExpandTarget; onClose: () => void; plantRecords: DailyPlantRecord[] }) {
  if (!target) return null;
  const { side, page } = target;
  const { date, report } = page;
  const dayPlant = date ? plantRecords.find(p => p.date === format(date, 'yyyy-MM-dd')) : null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end' }}
      onClick={onClose}
    >
      <div
        style={{ width: '100%', maxHeight: '88vh', background: PAPER_COLOR, borderRadius: '16px 16px 0 0', overflowY: 'auto', padding: '20px 20px 48px', boxSizing: 'border-box' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#4a3a2a' }}>
            {date && format(date, 'yyyy年M月d日 EEEE', { locale: zhCN })}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8a7a6a', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {side === 'left' ? (
          /* ── Left expanded: plant + full report ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Plant image — no border, drawn directly into the diary */}
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
              {dayPlant ? (
                <PlantImage
                  plantId={dayPlant.plantId}
                  rootType={dayPlant.rootType}
                  plantStage={dayPlant.plantStage}
                  imgClassName="max-h-40 max-w-full object-contain"
                />
              ) : (
                <span style={{ fontSize: 36, opacity: 0.18 }}>🌱</span>
              )}
            </div>

            {report ? (
              <>
                {report.stats?.actionSummary && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#4a3a2a', marginBottom: 6 }}>活动记录</div>
                    <p style={{ margin: 0, fontSize: 14, color: '#5a4a3a', lineHeight: 1.65 }}>{report.stats.actionSummary}</p>
                  </div>
                )}
                {report.stats?.moodSummary && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#4a3a2a', marginBottom: 6 }}>今日心情</div>
                    <p style={{ margin: 0, fontSize: 14, color: '#7a6a5a', lineHeight: 1.65 }}>{report.stats.moodSummary}</p>
                  </div>
                )}
                {report.stats && (
                  <div style={{ background: 'rgba(0,0,0,0.04)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#8a7a6a' }}>
                    任务完成率：{report.stats.completedTodos}/{report.stats.totalTodos}
                    {report.stats.completionRate !== undefined && `（${Math.round(report.stats.completionRate * 100)}%）`}
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', color: 'rgba(0,0,0,0.3)', fontSize: 14, padding: '24px 0' }}>
                {date && isSameDay(date, new Date()) ? '今日日记将在 20:00 后生成' : '暂无日记记录'}
              </div>
            )}
          </div>
        ) : (
          /* ── Right expanded: AI notes + user diary ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#3d5a8a', marginBottom: 10 }}>AI 观察笔记</div>
              {report?.aiAnalysis ? (
                <p style={{ margin: 0, fontSize: 14, color: '#4a5a7a', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{report.aiAnalysis}</p>
              ) : (
                <p style={{ margin: 0, fontSize: 14, color: 'rgba(61,90,138,0.4)', fontStyle: 'italic' }}>
                  {report ? '观察员正在整理笔记…' : '暂无观察笔记'}
                </p>
              )}
            </div>

            <div style={{ height: 1, background: 'rgba(0,0,0,0.08)' }} />

            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#4a3a2a', marginBottom: 10 }}>我的日记</div>
              {report?.userNote ? (
                <p style={{ margin: 0, fontSize: 14, color: '#4a3a2a', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{report.userNote}</p>
              ) : (
                <p style={{ margin: 0, fontSize: 14, color: 'rgba(0,0,0,0.2)', lineHeight: '28px' }}>
                  {report ? '未留下文字…' : '暂无日记'}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────── main viewer ────────────────────────────── */
export const DiaryBookViewer: React.FC<Props> = ({ onClose, reports, initialMonth, initialFlippedCount, onOpenDiaryPage }) => {
  const today = new Date();
  const [currentMonth] = useState(() => initialMonth ? startOfMonth(initialMonth) : startOfMonth(today));
  const globalMessages = useChatStore(state => state.messages);
  const dateCache = useChatStore(state => state.dateCache);
  const loadMessagesForDateRange = useChatStore(state => state.loadMessagesForDateRange);
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

  // Use cached month messages if available, otherwise fall back to global messages
  const monthStartStr = (() => {
    const d = startOfMonth(currentMonth);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const allMessages = dateCache.get(monthStartStr) ?? globalMessages;
  const [flippedCount, setFlippedCount] = useState(initialFlippedCount ?? 0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [lastFlipDir, setLastFlipDir] = useState<'next' | 'prev'>('next');
  const [expandTarget, setExpandTarget] = useState<ExpandTarget>(null);
  const dblClickTimer = useRef<{ side: 'left' | 'right'; timer: ReturnType<typeof setTimeout> } | null>(null);
  const pointerUpWasDrag = useRef(false); // true when pointer-up followed a real drag
  const dragRef = useRef<{
    side: 'left' | 'right'; sheetIdx: number;
    startClientX: number; lastClientX: number; lastT: number; velDeg: number;
    isDragging: boolean;
  } | null>(null);
  const [liveFlip, setLiveFlip] = useState<{ sheetIdx: number; rotY: number } | null>(null);
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
      // Second tap within 280ms → double click → expand
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
          if (pageDate.getTime() >= todayStart.getTime()) return; // today or future — blank, not clickable
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
    // Don't setLiveFlip yet — wait for actual drag movement to avoid cover-shift flash on simple clicks
    dragRef.current = { side, sheetIdx, startClientX: e.clientX, lastClientX: e.clientX, lastT: Date.now(), velDeg: 0, isDragging: false };
  }, [isAnimating, liveFlip, flippedCount, numSheets]);

  const onZonePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const pw = pageWRef.current;
    const deltaX = e.clientX - drag.startClientX;
    // Only start live-flip once the pointer has moved enough (avoids flash on tap)
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
    setLiveFlip({ sheetIdx: drag.sheetIdx, rotY });
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
    if (flippedCount === 0) return '封面';
    if (flippedCount >= numSheets) return '封底';
    const l = pages[2 * flippedCount - 1];
    if (l?.dayNum !== undefined) return `第 ${l.dayNum} 日`;
    return `${flippedCount} / ${numSheets}`;
  };

  /* ── scaling ── */
  const baseSideMargin = MAX_VIS * BASE_SIDE_GAP;
  const baseWrapW = BASE_PAGE_W * 2 + baseSideMargin * 2;
  const hMargin = Math.max(20, Math.round(viewport.width * 0.05)); // ≥20px, ~5% each side
  const availableW = Math.max(240, viewport.width - hMargin * 2);
  const availableH = Math.max(220, viewport.height - 170); // ~90px header + ~80px footer/safe-area
  const scaleW = availableW / baseWrapW;
  const scaleH = availableH / BASE_PAGE_H;
  const scale = Math.max(0.62, Math.min(scaleW, scaleH, 1.8)); // allow up to 1.8× for large screens

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

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', background: '#7a9b7e', userSelect: 'none', touchAction: 'pan-y' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '40px 20px 12px' }}>
        <button onClick={onClose} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none' }}><X size={20} /></button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600, fontSize: 14, letterSpacing: 1 }}>{format(currentMonth, 'yyyy年 M月', { locale: zhCN })}</div>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 2 }}>{daysInMonth} 天</div>
        </div>
        <div style={{ width: 32 }} />
      </div>

      {/* Book area */}
      <div
        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', perspective: 2000, overflow: 'hidden' }}
      >
        <div style={{ position: 'relative', width: wrapW, height: pageH, transformStyle: 'preserve-3d', transform: 'rotateX(0deg)' }}>

          {/* Fixed spine bars */}
          {(isBookOpen || isAnimating || !!liveFlip) && (
            isAnimating && lastFlipDir === 'prev'
              ? flippedCount < numSheets - 1
              : flippedCount < numSheets
          ) && (
            <div style={{ position: 'absolute', left: spineX, top: trapezoidInset, width: sideGap + sheetSpineOverlap, height: pageH - trapezoidInset * 2, background: PAPER_COLOR, transform: `translateZ(${(MAX_VIS * 4 - 2) * scale}px)`, pointerEvents: 'none' }} />
          )}
          {(isBookOpen || isAnimating || !!liveFlip) && (
            isAnimating && lastFlipDir === 'next'
              ? flippedCount > 1
              : flippedCount > 0
          ) && (
            <div style={{ position: 'absolute', left: spineX - sideGap - sheetSpineOverlap, top: trapezoidInset, width: sideGap + sheetSpineOverlap, height: pageH - trapezoidInset * 2, background: PAPER_COLOR, transform: `translateZ(${(MAX_VIS * 4 - 2) * scale}px)`, pointerEvents: 'none' }} />
          )}

          {/* Sheets */}
          {Array.from({ length: numSheets }, (_, i) => {
            const isFlipped = i < flippedCount;
            const dist = isFlipped ? (flippedCount - 1 - i) : (i - flippedCount);
            const vis = Math.min(dist, MAX_VIS);
            const isOnCover = flippedCount === 0;
            const isOnBackCover = flippedCount >= numSheets;
            const isFullyClosedCover = isOnCover && !isAnimating && liveFlip?.sheetIdx !== i;
            const isFullyClosedBack = isOnBackCover && !isAnimating && liveFlip?.sheetIdx !== i;
            if ((isFullyClosedCover || isFullyClosedBack) && dist > 0) return null;
            if (dist > MAX_VIS) return null;

            const stackZ = (MAX_VIS - vis) * 4 * scale;
            const rotY = isFlipped ? -180 : 0;
            const offset = dist === 0 ? 0 : vis * sideGap;
            const shiftX = isFlipped ? -offset : offset;
            const coverShiftLeft = isFullyClosedCover ? -pageW / 2 : isFullyClosedBack ? pageW / 2 : 0;
            const isCurrent = dist === 0;
            const layerShrink = isCurrent ? 0 : (dist - 1) * heightShrink;
            const sheetH = isCurrent ? pageH : pageH - 2 * trapezoidInset - layerShrink;
            const topOffset = isCurrent ? 0 : trapezoidInset + layerShrink / 2;
            const isCoverFront = pages[2 * i]?.type === 'cover';
            const isBackCoverBack = pages[2 * i + 1]?.type === 'back';
            const frontClip = (isCurrent && !isCoverFront)
              ? `polygon(0 ${trapezoidInset}px, 100% 0, 100% 100%, 0 calc(100% - ${trapezoidInset}px))` : undefined;
            const backClip = (isCurrent && !isBackCoverBack)
              ? `polygon(0 0, 100% ${trapezoidInset}px, 100% calc(100% - ${trapezoidInset}px), 0 100%)` : undefined;

            const isLive = liveFlip?.sheetIdx === i;
            const isSnap = snapDur?.sheetIdx === i;
            const effectiveRotY = isLive ? liveFlip!.rotY : rotY;
            const effectiveDur = isSnap ? snapDur!.ms : FLIP_MS;
            return (
              <div key={i} style={{ position: 'absolute', left: spineX + coverShiftLeft, top: topOffset, width: pageW, height: sheetH, transformOrigin: 'left center', transform: `translateZ(${stackZ}px) translateX(${shiftX}px) rotateY(${effectiveRotY}deg)`, transition: isLive ? 'none' : `transform ${effectiveDur}ms cubic-bezier(0.4, 0, 0.2, 1)`, transformStyle: 'preserve-3d', pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', borderRadius: `0 ${Math.round(12*scale)}px ${Math.round(12*scale)}px 0`, overflow: 'hidden', clipPath: frontClip, filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.10))' }}>
                  <PageContent page={pages[2 * i]} scale={scale} allMessages={allMessages} plantRecords={plantRecords} />
                </div>
                <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', borderRadius: `${Math.round(12*scale)}px 0 0 ${Math.round(12*scale)}px`, overflow: 'hidden', clipPath: backClip, filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.10))' }}>
                  <PageContent page={pages[2 * i + 1]} scale={scale} allMessages={allMessages} plantRecords={plantRecords} />
                </div>
              </div>
            );
          })}

          {/* Center spine divider — thin line between left and right pages */}
          {isBookOpen && (
            <div style={{
              position: 'absolute',
              left: spineX,
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
            style={{ position: 'absolute', left: 0, top: 0, width: sideMargin + pageW, height: pageH, cursor: liveFlip ? 'grabbing' : flippedCount > 0 ? 'grab' : 'default', transform: `translateZ(${(MAX_VIS + 3) * 18 * scale}px)`, touchAction: 'none' }}
          />
          <div
            onPointerDown={(e) => onZonePointerDown('right', e)}
            onPointerMove={onZonePointerMove}
            onPointerUp={onZonePointerUp}
            onPointerCancel={() => { dragRef.current = null; setLiveFlip(null); pointerUpWasDrag.current = true; }}
            onClick={() => { if (!pointerUpWasDrag.current) handleZoneClick('right'); pointerUpWasDrag.current = false; }}
            style={{ position: 'absolute', left: sideMargin + pageW, top: 0, width: sideMargin + pageW, height: pageH, cursor: liveFlip ? 'grabbing' : flippedCount < numSheets ? 'grab' : 'default', transform: `translateZ(${(MAX_VIS + 3) * 18 * scale}px)`, touchAction: 'none' }}
          />
        </div>
        {/* Shadow beneath the book */}
        <div style={{ width: wrapW * 0.8, height: 20, marginTop: 2, background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.25) 0%, transparent 70%)', pointerEvents: 'none', flexShrink: 0 }} />
      </div>

      {/* Page indicator + day navigation */}
      <div style={{ textAlign: 'center', paddingBottom: 44 }}>
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
              <ChevronLeft size={18} />
            </button>
            <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, minWidth: 56, textAlign: 'center' }}>
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
              <ChevronRight size={18} />
            </button>
          </div>
        ) : (
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>{getIndicator()}</span>
        )}
        {isBookOpen && (
          <div style={{ color: 'rgba(255,255,255,0.18)', fontSize: 10, marginTop: 3 }}>
            {onOpenDiaryPage ? '双击页面可进入日记' : '双击页面可放大查看'}
          </div>
        )}
      </div>

      {/* Expanded overlay */}
      <ExpandedView target={expandTarget} onClose={() => setExpandTarget(null)} plantRecords={plantRecords} />
    </div>
  );
};
