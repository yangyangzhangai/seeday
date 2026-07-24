// DOC-DEPS: src/features/report/README.md, docs/PROJECT_MAP.md, docs/CURRENT_TASK.md
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { format, getDaysInMonth, startOfMonth, endOfMonth } from 'date-fns';
import { enUS, it as itLocale, zhCN } from 'date-fns/locale';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useReportStore, type Report } from '../../store/useReportStore';
import { useChatStore } from '../../store/useChatStore';
import type { Message } from '../../store/useChatStore';
import type { DailyPlantRecord } from '../../types/plant';
import { usePlantStore } from '../../store/usePlantStore';
import { useAuthStore } from '../../store/useAuthStore';
import { DiaryPlantFlipModal } from './plant/DiaryPlantFlipModal';
import { DiaryBookViewerExpandedView, type ExpandTarget } from './DiaryBookViewerExpandedView';
import { buildPages } from './diaryBookViewerData';
import { DiaryBookViewerPageContent } from './DiaryBookViewerPageContent';
import { APP_GLASS_BUTTON_BASE_STYLE } from '../../lib/modalTheme';
import {
  BASE_PAGE_W,
  BASE_PAGE_H,
  FLIP_MS,
  BASE_SIDE_GAP,
  MAX_VIS,
  BASE_HEIGHT_SHRINK,
  PAPER_COLOR,
  SHELF_BG,
  coverColor,
  SPINE_STRIP_W,
  BASE_SHEET_SPINE_OVERLAP,
  TRAPEZOID_ANGLE_DEG,
} from './diaryBookViewerTheme';

/* ──────────────────────────────── types ──────────────────────────────── */
interface Props {
  onClose: () => void;
  onBackToShelf?: () => void;
  reports: Report[];
  initialMonth?: Date;
  initialFlippedCount?: number;
  onOpenDiaryPage?: (date: Date, subPage: 0 | 1, flippedCount: number) => void;
}

/* ──────────────────────────── main viewer ────────────────────────────── */
export const DiaryBookViewer: React.FC<Props> = ({ onClose, onBackToShelf, reports, initialMonth, initialFlippedCount, onOpenDiaryPage }) => {
  const { t, i18n } = useTranslation();
  const today = new Date();
  const [currentMonth] = useState(() => initialMonth ? startOfMonth(initialMonth) : startOfMonth(today));
  const globalMessages = useChatStore(state => state.messages);
  const dateCache = useChatStore(state => state.dateCache);
  const loadMessagesForDateRange = useChatStore(state => state.loadMessagesForDateRange);
  const userId = useAuthStore(state => state.user?.id ?? null);
  const todayPlant = usePlantStore(state => state.todayPlant);
  const historyUserId = usePlantStore(state => state.historyUserId);
  const historyPlantsByDate = usePlantStore(state => state.historyPlantsByDate);
  const loadPlantHistory = usePlantStore(state => state.loadPlantHistory);
  const ensureDiaryPageSnapshot = useReportStore(state => state.ensureDiaryPageSnapshot);

  useEffect(() => {
    loadMessagesForDateRange(startOfMonth(currentMonth), endOfMonth(currentMonth));
  }, [currentMonth, loadMessagesForDateRange]);

  useEffect(() => {
    const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    void loadPlantHistory(startDate, endDate);
  }, [currentMonth, loadPlantHistory]);

  useEffect(() => {
    reports.forEach((report) => {
      if (report.type !== 'daily' || report.stats?.diaryPageSnapshot?.version === 2) return;
      if (!report.aiAnalysis?.trim() && !report.teaserText?.trim()) return;
      ensureDiaryPageSnapshot(report.id);
    });
  }, [ensureDiaryPageSnapshot, reports]);

  const plantRecords = useMemo(() => {
    const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    const records = historyUserId === userId
      ? Object.values(historyPlantsByDate).filter(
        plant => plant.date >= startDate && plant.date <= endDate,
      )
      : [];
    const todayDate = format(new Date(), 'yyyy-MM-dd');
    if (
      todayPlant?.date === todayDate
      && todayPlant.date >= startDate
      && todayPlant.date <= endDate
      && !records.some(plant => plant.date === todayPlant.date)
    ) {
      records.push(todayPlant);
    }
    return records;
  }, [currentMonth, historyPlantsByDate, historyUserId, todayPlant, userId]);

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
              style={{ ...APP_GLASS_BUTTON_BASE_STYLE, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a5d4c', background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.8)', borderRadius: 22, boxShadow: '0 8px 20px rgba(0,0,0,0.04)', cursor: 'pointer' }}
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
            style={{ ...APP_GLASS_BUTTON_BASE_STYLE, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a5d4c', background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.8)', borderRadius: 22, boxShadow: '0 8px 20px rgba(0,0,0,0.04)', cursor: 'pointer' }}
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
                  <DiaryBookViewerPageContent page={pages[2 * i]} scale={scale} allMessages={allMessages} plantRecords={plantRecords} coverBg={coverColor(currentMonth)} onOpenFlipCard={(plant, msgs) => setFlipModal({ plant, dayMessages: msgs })} />
                </div>
                <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', borderRadius: `${Math.round(12*scale)}px 0 0 ${Math.round(12*scale)}px`, overflow: 'hidden', clipPath: backClip, filter: backClip ? undefined : 'drop-shadow(0 3px 5px rgba(0,0,0,0.10))' }}>
                  <DiaryBookViewerPageContent page={pages[2 * i + 1]} scale={scale} allMessages={allMessages} plantRecords={plantRecords} coverBg={coverColor(currentMonth)} />
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
