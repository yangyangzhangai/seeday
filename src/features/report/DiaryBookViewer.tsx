import React, { useState, useCallback, useRef, useEffect } from 'react';
import { format, getDaysInMonth, startOfMonth, isSameDay } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { X } from 'lucide-react';
import type { Report } from '../../store/useReportStore';

/* ────────────────────────── tuning constants ────────────────────────── */
const BASE_PAGE_W = 180;
const BASE_PAGE_H = 260;
const FLIP_MS = 550;

// Stacking
const BASE_SIDE_GAP = 6;      // px gap between stacked page edges
const MAX_VIS = 4;            // max visible stacked pages per side
const BASE_HEIGHT_SHRINK = 20; // px — each stacked page shrinks in height (top & bottom each = HEIGHT_SHRINK/2)
const PAPER_COLOR = '#faf7f2';
const COVER_COLOR = 'linear-gradient(160deg, #f5edda 0%, #ecdfc6 100%)';
const SPINE_STRIP_W = 14; // px — decorative spine strip width inside the page
const BASE_SHEET_SPINE_OVERLAP = 2;

/* ──────────────────────────────── types ──────────────────────────────── */
interface Props { onClose: () => void; reports: Report[]; initialMonth?: Date; }

/* ──────────────────────────────── data ───────────────────────────────── */
function buildPages(month: Date, reports: Report[]) {
  const days = getDaysInMonth(month);
  const pages: { type: 'cover' | 'day' | 'blank' | 'back'; dayNum?: number; date?: Date; report?: Report }[] = [];
  pages.push({ type: 'cover' });
  for (let d = 1; d <= days; d++) {
    const date = new Date(month.getFullYear(), month.getMonth(), d);
    const report = reports.find(r => r.type === 'daily' && isSameDay(new Date(r.date), date));
    pages.push({ type: 'day', dayNum: d, date, report });
  }
  // Ensure back cover lands at an ODD index (back-face slot) so it shows when fully flipped.
  // If pages.length is even, add a blank first so the next push goes to an odd index.
  if (pages.length % 2 === 0) pages.push({ type: 'blank' });
  pages.push({ type: 'back' });
  // pages.length is now even (odd index + 1)
  return pages;
}

/* ──────────────────────────── page content ───────────────────────────── */
function PageContent({ page }: { page: ReturnType<typeof buildPages>[number] }) {
  if (page.type === 'cover') {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', background: COVER_COLOR, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#6b5a3e' }}>
        {/* Spine strip on left edge — vertical stripes */}
        <div style={{ position: 'absolute', left: 0, top: 0, width: SPINE_STRIP_W, height: '100%', background: 'rgba(0,0,0,0.15)', backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.18) 0px, rgba(255,255,255,0.18) 1.5px, transparent 1.5px, transparent 4px)' }} />
        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 3 }}>日记本</div>
        <div style={{ fontSize: 11, opacity: 0.55, marginTop: 6 }}>Diary</div>
      </div>
    );
  }
  if (page.type === 'back') {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', background: COVER_COLOR }}>
        {/* Spine strip on right edge — vertical stripes */}
        <div style={{ position: 'absolute', right: 0, top: 0, width: SPINE_STRIP_W, height: '100%', background: 'rgba(0,0,0,0.15)', backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.18) 0px, rgba(255,255,255,0.18) 1.5px, transparent 1.5px, transparent 4px)' }} />
      </div>
    );
  }
  if (page.type === 'blank') {
    return <div style={{ width: '100%', height: '100%', background: PAPER_COLOR }} />;
  }
  return <div style={{ width: '100%', height: '100%', background: PAPER_COLOR }} />;
}

/* ──────────────────────────── main viewer ────────────────────────────── */
export const DiaryBookViewer: React.FC<Props> = ({ onClose, reports, initialMonth }) => {
  const today = new Date();
  const [currentMonth] = useState(() => initialMonth ? startOfMonth(initialMonth) : startOfMonth(today));
  const [flippedCount, setFlippedCount] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [lastFlipDir, setLastFlipDir] = useState<'next' | 'prev'>('next');
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === 'undefined' ? 390 : window.innerWidth,
    height: typeof window === 'undefined' ? 844 : window.innerHeight,
  }));

  useEffect(() => {
    const onResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
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
    setTimeout(() => { setIsAnimating(false); }, FLIP_MS);
  }, [isAnimating, flippedCount, numSheets]);

  const flipPrev = useCallback(() => {
    if (isAnimating || flippedCount <= 0) return;
    setLastFlipDir('prev');
    setIsAnimating(true);
    setFlippedCount(f => f - 1);
    setTimeout(() => { setIsAnimating(false); }, FLIP_MS);
  }, [isAnimating, flippedCount]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        flipNext();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        flipPrev();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [flipNext, flipPrev]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);
  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    const isHorizontalSwipe = Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy) * 1.2;
    if (isHorizontalSwipe) { dx < 0 ? flipNext() : flipPrev(); }
  }, [flipNext, flipPrev]);

  const getIndicator = () => {
    if (flippedCount === 0) return '封面';
    if (flippedCount >= numSheets) return '封底';
    const l = pages[2 * flippedCount - 1];
    const r = pages[2 * flippedCount];
    const p: string[] = [];
    if (l?.type === 'day') p.push(`${l.dayNum}`);
    if (r?.type === 'day') p.push(`${r.dayNum}`);
    return p.length ? `第 ${p.join(' - ')} 日` : `${flippedCount} / ${numSheets}`;
  };

  /* total width of book wrapper = pages + side margins for stacking */
  const baseSideMargin = MAX_VIS * BASE_SIDE_GAP;
  const baseWrapW = BASE_PAGE_W * 2 + baseSideMargin * 2;
  const availableW = Math.max(240, viewport.width - 24);
  const availableH = Math.max(220, viewport.height - 220);
  const scaleW = availableW / baseWrapW;
  const scaleH = availableH / BASE_PAGE_H;
  const scale = Math.min(1, Math.max(0.62, Math.min(scaleW, scaleH)));

  const pageW = BASE_PAGE_W * scale;
  const pageH = BASE_PAGE_H * scale;
  const sideGap = BASE_SIDE_GAP * scale;
  const heightShrink = BASE_HEIGHT_SHRINK * scale;
  const trapezoidInset = heightShrink / 2;
  const sheetSpineW = trapezoidInset + sideGap;
  const sheetSpineOverlap = Math.max(1, BASE_SHEET_SPINE_OVERLAP * scale);

  const sideMargin = MAX_VIS * sideGap;
  const wrapW = pageW * 2 + sideMargin * 2;
  const spineX = sideMargin + pageW;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', background: '#7a9b7e', userSelect: 'none', touchAction: 'pan-y' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '40px 20px 12px' }}>
        <button onClick={onClose} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none' }}><X size={20} /></button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600, fontSize: 14, letterSpacing: 1 }}>{format(currentMonth, 'yyyy年 M月', { locale: zhCN })}</div>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 2 }}>{daysInMonth} 页</div>
        </div>
        <div style={{ width: 32 }} />
      </div>

      {/* book area — NO rotateX to avoid vertical shift during flips */}
      <div
        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', perspective: 2000, overflow: 'hidden' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div style={{
          position: 'relative',
          width: wrapW,
          height: pageH,
          transformStyle: 'preserve-3d',
          transform: 'rotateX(0deg)',
        }}>
          {/* ─── Fixed spine bars — fill the gap between pages during flips.
               Direction-aware conditions prevent white strips against dark background:
               • Right bar: during backward flip, only show when a right STACKED page exists
                 (flippedCount < numSheets-1). During forward flip it's always covered by
                 the new right current page so showing is harmless (flippedCount < numSheets).
               • Left bar: during forward flip, only show when a left STACKED page exists
                 (flippedCount > 1). During backward flip even flippedCount=1 is fine since
                 the current left page covers the bar (flippedCount > 0). ─── */}
          {(isBookOpen || isAnimating) && (
            isAnimating && lastFlipDir === 'prev'
              ? flippedCount < numSheets - 1   // backward: need a right stacked page
              : flippedCount < numSheets        // forward/static: right current page covers it
          ) && (
            <div style={{
              position: 'absolute',
              left: spineX,
              top: trapezoidInset,
              width: sideGap + sheetSpineOverlap,
              height: pageH - trapezoidInset * 2,
              background: PAPER_COLOR,
              transform: `translateZ(${(MAX_VIS * 4 - 2) * scale}px)`,
              pointerEvents: 'none',
            }} />
          )}
          {(isBookOpen || isAnimating) && (
            isAnimating && lastFlipDir === 'next'
              ? flippedCount > 1   // forward: need a left stacked page (hide during cover-open)
              : flippedCount > 0   // backward/static: current left page covers it
          ) && (
            <div style={{
              position: 'absolute',
              left: spineX - sideGap - sheetSpineOverlap,
              top: trapezoidInset,
              width: sideGap + sheetSpineOverlap,
              height: pageH - trapezoidInset * 2,
              background: PAPER_COLOR,
              transform: `translateZ(${(MAX_VIS * 4 - 2) * scale}px)`,
              pointerEvents: 'none',
            }} />
          )}

          {/* ─── sheets ─── */}
          {Array.from({ length: numSheets }, (_, i) => {
            const isFlipped = i < flippedCount;
            const dist = isFlipped ? (flippedCount - 1 - i) : (i - flippedCount);
            const vis = Math.min(dist, MAX_VIS);

            const isOnCover = flippedCount === 0;
            const isOnBackCover = flippedCount >= numSheets;
            const isFullyClosedCover = isOnCover && !isAnimating;
            const isFullyClosedBack = isOnBackCover && !isAnimating;

            // After the closing animation ends, switch to top-down single-page view.
            if ((isFullyClosedCover || isFullyClosedBack) && dist > 0) return null;

            // Only render sheets within MAX_VIS distance — cover/back-cover naturally
            // become the outermost stacked page when within range, hidden otherwise.
            if (dist > MAX_VIS) return null;

            /* ── Z stacking: front page highest Z ── */
            const stackZ = (MAX_VIS - vis) * 4 * scale;

            /* ── rotation: all pages lay flat; animation handled by CSS transition ── */
            const rotY = isFlipped ? -180 : 0;

            /* ── horizontal offset: stacked pages peek out on sides ── */
            const offset = dist === 0 ? 0 : vis * sideGap;
            const shiftX = isFlipped ? -offset : offset;

            /* spine = center of wrapper.
               On cover/back-cover, shift to center the single page.
               Use `left` (not translateX) so the centering snap is instant — no transition. */
            const coverShiftLeft = isFullyClosedCover ? -pageW / 2 : isFullyClosedBack ? pageW / 2 : 0;

            /* ── sizing:
               Current page (dist=0): full height, no topOffset, trapezoid clip.
               Stacked pages: top aligned to TRAPEZOID_INSET so they never poke above
               the trapezoid's spine-side cut; height shrinks with each layer. ── */
            const isCurrent = dist === 0;
            // Both top and bottom shrink symmetrically per layer
            const layerShrink = isCurrent ? 0 : (dist - 1) * heightShrink;
            const sheetH = isCurrent
              ? pageH
              : pageH - 2 * trapezoidInset - layerShrink;
            // Top steps down by half the shrink each layer (bottom steps up by the other half)
            const topOffset = isCurrent ? 0 : trapezoidInset + layerShrink / 2;

            /* Cover face (front of sheet 0) and back-cover face (back of last sheet) get no trapezoid.
               Their opposite faces (cover's back = first day page, back-cover's front = last day page)
               DO get the trapezoid as normal. */
            const isCoverFront = pages[2 * i]?.type === 'cover';
            const isBackCoverBack = pages[2 * i + 1]?.type === 'back';
            /* Front face: spine is local-left(0%) → make it shorter
               Back face: mirrored polygon so spine appears shorter after double-flip */
            const frontClip = (isCurrent && !isCoverFront)
              ? `polygon(0 ${trapezoidInset}px, 100% 0, 100% 100%, 0 calc(100% - ${trapezoidInset}px))`
              : undefined;
            const backClip = (isCurrent && !isBackCoverBack)
              ? `polygon(0 0, 100% ${trapezoidInset}px, 100% calc(100% - ${trapezoidInset}px), 0 100%)`
              : undefined;

            return (
              <div key={i} style={{
                position: 'absolute',
                left: spineX + coverShiftLeft,
                top: topOffset,
                width: pageW,
                height: sheetH,
                transformOrigin: 'left center',
                transform: `translateZ(${stackZ}px) translateX(${shiftX}px) rotateY(${rotY}deg)`,
                transition: `transform ${FLIP_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
                transformStyle: 'preserve-3d',
                pointerEvents: 'none',
              }}>
                {/* front face — shadow only on outer (right) side */}
                <div style={{
                  position: 'absolute', inset: 0,
                  backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                  borderRadius: '0 4px 4px 0', overflow: 'hidden',
                  boxShadow: dist === 0 ? '4px 0 12px rgba(0,0,0,0.22)' : '2px 0 6px rgba(0,0,0,0.1)',
                  clipPath: frontClip,
                }}>
                  <PageContent page={pages[2 * i]} />
                </div>
                {/* back face — shadow only on outer (left) side */}
                <div style={{
                  position: 'absolute', inset: 0,
                  backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  borderRadius: '4px 0 0 4px', overflow: 'hidden',
                  boxShadow: dist === 0 ? '-4px 0 12px rgba(0,0,0,0.22)' : '-2px 0 6px rgba(0,0,0,0.1)',
                  clipPath: backClip,
                }}>
                  <PageContent page={pages[2 * i + 1]} />
                </div>
              </div>
            );
          })}



          {/* click zones — fully cover left & right halves */}
          <div onClick={flipPrev} style={{
            position: 'absolute', left: 0, top: 0,
            width: sideMargin + pageW, height: pageH,
            cursor: flippedCount > 0 ? 'pointer' : 'default',
            transform: `translateZ(${(MAX_VIS + 3) * 18 * scale}px)`,
          }} />
          <div onClick={flipNext} style={{
            position: 'absolute', left: sideMargin + pageW, top: 0,
            width: sideMargin + pageW, height: pageH,
            cursor: flippedCount < numSheets ? 'pointer' : 'default',
            transform: `translateZ(${(MAX_VIS + 3) * 18 * scale}px)`,
          }} />
        </div>
      </div>

      {/* indicator */}
      <div style={{ textAlign: 'center', paddingBottom: 44 }}>
        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>{getIndicator()}</span>
      </div>
    </div>
  );
};
