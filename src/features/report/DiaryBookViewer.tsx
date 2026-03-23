import React, { useState, useCallback, useRef } from 'react';
import { format, getDaysInMonth, startOfMonth, isSameDay } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { X } from 'lucide-react';
import type { Report } from '../../store/useReportStore';

/* ────────────────────────── tuning constants ────────────────────────── */
const PAGE_W = 180;
const PAGE_H = 260;
const FLIP_MS = 550;

// Stacking
const SIDE_GAP = 6;           // px gap between stacked page edges
const MAX_VIS = 4;            // max visible stacked pages per side
const HEIGHT_SHRINK = 20;     // px — each stacked page shrinks in height (top & bottom each = HEIGHT_SHRINK/2)
// Trapezoid inset equals one stacking step so spine-edge diagonal is uniform across all layers
const TRAPEZOID_INSET = HEIGHT_SHRINK / 2;  // = 6px

/* ──────────────────────────────── types ──────────────────────────────── */
interface Props { onClose: () => void; reports: Report[]; }

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
      <div style={{ width: '100%', height: '100%', background: 'linear-gradient(145deg, #5c3a28 0%, #3b2014 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#d4b896' }}>
        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 3 }}>日记本</div>
        <div style={{ fontSize: 11, opacity: 0.55, marginTop: 6 }}>Diary</div>
      </div>
    );
  }
  if (page.type === 'back') {
    return <div style={{ width: '100%', height: '100%', background: 'linear-gradient(145deg, #5c3a28 0%, #3b2014 100%)' }} />;
  }
  if (page.type === 'blank') {
    return <div style={{ width: '100%', height: '100%', background: '#faf7f2' }} />;
  }
  return <div style={{ width: '100%', height: '100%', background: '#faf7f2' }} />;
}

/* ──────────────────────────── main viewer ────────────────────────────── */
export const DiaryBookViewer: React.FC<Props> = ({ onClose, reports }) => {
  const today = new Date();
  const [currentMonth] = useState(startOfMonth(today));
  const [flippedCount, setFlippedCount] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animatingSheet, setAnimatingSheet] = useState<number | null>(null);
  const touchStartX = useRef(0);

  const pages = buildPages(currentMonth, reports);
  const numSheets = pages.length / 2;
  const daysInMonth = getDaysInMonth(currentMonth);
  const isBookOpen = flippedCount > 0 && flippedCount < numSheets;

  const flipNext = useCallback(() => {
    if (isAnimating || flippedCount >= numSheets) return;
    setAnimatingSheet(flippedCount);
    setIsAnimating(true);
    setFlippedCount(f => f + 1);
    setTimeout(() => { setIsAnimating(false); setAnimatingSheet(null); }, FLIP_MS);
  }, [isAnimating, flippedCount, numSheets]);

  const flipPrev = useCallback(() => {
    if (isAnimating || flippedCount <= 0) return;
    setAnimatingSheet(flippedCount - 1);
    setIsAnimating(true);
    setFlippedCount(f => f - 1);
    setTimeout(() => { setIsAnimating(false); setAnimatingSheet(null); }, FLIP_MS);
  }, [isAnimating, flippedCount]);

  const onTouchStart = useCallback((e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; }, []);
  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) { dx < 0 ? flipNext() : flipPrev(); }
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
  const sideMargin = MAX_VIS * SIDE_GAP;
  const wrapW = PAGE_W * 2 + sideMargin * 2;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', background: '#1c2b4a', userSelect: 'none', touchAction: 'pan-y' }}>
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
          height: PAGE_H,
          transformStyle: 'preserve-3d',
          transform: 'rotateX(0deg)',
        }}>
          {/* ─── sheets ─── */}
          {Array.from({ length: numSheets }, (_, i) => {
            const isFlipped = i < flippedCount;
            const dist = isFlipped ? (flippedCount - 1 - i) : (i - flippedCount);
            const vis = Math.min(dist, MAX_VIS);

            const isOnCover = flippedCount === 0;
            const isOnBackCover = flippedCount >= numSheets;

            // On cover/back-cover: hide all stacked pages, only show the current one
            if ((isOnCover || isOnBackCover) && dist > 0) return null;

            /* ── Z stacking: front page highest Z ── */
            const stackZ = (MAX_VIS - vis) * 4;

            /* ── rotation: all pages lay flat; animation handled by CSS transition ── */
            const rotY = isFlipped ? -180 : 0;

            /* ── horizontal offset: stacked pages peek out on sides ── */
            const offset = dist === 0 ? 0 : vis * SIDE_GAP;
            const shiftX = isFlipped ? -offset : offset;

            /* spine = center of wrapper.
               On cover/back-cover, shift to center the single page. */
            const spineX = sideMargin + PAGE_W;
            const centerShift = isOnCover ? -PAGE_W / 2 : isOnBackCover ? PAGE_W / 2 : 0;

            /* ── sizing:
               Current page (dist=0): full height, no topOffset, trapezoid clip.
               Stacked pages: top aligned to TRAPEZOID_INSET so they never poke above
               the trapezoid's spine-side cut; height shrinks with each layer. ── */
            const isCurrent = dist === 0;
            // Both top and bottom shrink symmetrically per layer
            const layerShrink = isCurrent ? 0 : (dist - 1) * HEIGHT_SHRINK;
            const pageH = isCurrent
              ? PAGE_H
              : PAGE_H - 2 * TRAPEZOID_INSET - layerShrink;
            // Top steps down by half the shrink each layer (bottom steps up by the other half)
            const topOffset = isCurrent ? 0 : TRAPEZOID_INSET + layerShrink / 2;

            /* Cover face (front of sheet 0) and back-cover face (back of last sheet) get no trapezoid.
               Their opposite faces (cover's back = first day page, back-cover's front = last day page)
               DO get the trapezoid as normal. */
            const isCoverFront = pages[2 * i]?.type === 'cover';
            const isBackCoverBack = pages[2 * i + 1]?.type === 'back';
            /* Front face: spine is local-left(0%) → make it shorter
               Back face: mirrored polygon so spine appears shorter after double-flip */
            const frontClip = (isCurrent && !isCoverFront)
              ? `polygon(0 ${TRAPEZOID_INSET}px, 100% 0, 100% 100%, 0 calc(100% - ${TRAPEZOID_INSET}px))`
              : undefined;
            const backClip = (isCurrent && !isBackCoverBack)
              ? `polygon(0 0, 100% ${TRAPEZOID_INSET}px, 100% calc(100% - ${TRAPEZOID_INSET}px), 0 100%)`
              : undefined;

            return (
              <div key={i} style={{
                position: 'absolute',
                left: spineX,
                top: topOffset,
                width: PAGE_W,
                height: pageH,
                transformOrigin: 'left center',
                transform: `translateZ(${stackZ}px) translateX(${shiftX + centerShift}px) rotateY(${rotY}deg)`,
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
            width: sideMargin + PAGE_W, height: PAGE_H,
            cursor: flippedCount > 0 ? 'pointer' : 'default',
            transform: `translateZ(${(MAX_VIS + 3) * 18}px)`,
          }} />
          <div onClick={flipNext} style={{
            position: 'absolute', left: sideMargin + PAGE_W, top: 0,
            width: sideMargin + PAGE_W, height: PAGE_H,
            cursor: flippedCount < numSheets ? 'pointer' : 'default',
            transform: `translateZ(${(MAX_VIS + 3) * 18}px)`,
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
