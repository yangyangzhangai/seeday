// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RootPathRenderItem } from '../../../lib/rootRenderer';
import type { PlantCategoryKey } from '../../../types/plant';
import { buildSoilLegendItems } from './soilLegend';
import {
  clampViewportOffset,
  computeFocusOffset,
  getNextScale,
  MAX_SCALE,
  MIN_SCALE,
  SCALE_STEP,
} from './soilCanvasViewport';
import { RootDetailBubble } from './RootDetailBubble';
import { RootSystem } from './RootSystem';

interface SoilCanvasProps {
  items: RootPathRenderItem[];
  selectedRootId: string | null;
  onSelectRoot: (id: string) => void;
  directionOrder: PlantCategoryKey[];
  detailBubble: {
    title: string;
    activity: string;
    category: string;
    timeRange: string;
    duration: string;
    focus: string;
  } | null;
  onCloseDetail: () => void;
}

function toCategoryKey(category: PlantCategoryKey): string {
  switch (category) {
    case 'work_study':
      return 'plant_category_work_study';
    case 'exercise':
      return 'plant_category_exercise';
    case 'social':
      return 'category_social';
    case 'entertainment':
      return 'category_entertainment';
    default:
      return 'category_life';
  }
}

const BASE_WIDTH = 360;
const BASE_HEIGHT = 520;
const TOOLTIP_WIDTH = 264;
const TOOLTIP_MIN_MARGIN = 10;

const SoilCanvasImpl: React.FC<SoilCanvasProps> = ({
  items,
  selectedRootId,
  onSelectRoot,
  directionOrder,
  detailBubble,
  onCloseDetail,
}) => {
  const { t } = useTranslation();
  const [scale, setScale] = useState(1);
  const [viewportOffset, setViewportOffset] = useState({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState(false);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsActive(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!canvasRef.current || typeof ResizeObserver === 'undefined') return;
    const node = canvasRef.current;
    const updateSize = () => {
      setCanvasSize({
        width: node.clientWidth,
        height: node.clientHeight,
      });
    };
    updateSize();
    const observer = new ResizeObserver(() => updateSize());
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const selectedItem = useMemo(
    () => items.find(item => item.segment.id === selectedRootId) ?? null,
    [items, selectedRootId],
  );

  useEffect(() => {
    setViewportOffset(prev => {
      const next = clampViewportOffset(prev, canvasSize, scale);
      if (Math.abs(prev.x - next.x) < 0.01 && Math.abs(prev.y - next.y) < 0.01) {
        return prev;
      }
      return next;
    });
  }, [canvasSize, scale]);

  useEffect(() => {
    if (!selectedItem || canvasSize.width === 0 || canvasSize.height === 0) {
      return;
    }
    const focusPoint = {
      x: (selectedItem.tip.x / BASE_WIDTH) * canvasSize.width,
      y: (selectedItem.tip.y / BASE_HEIGHT) * canvasSize.height,
    };
    setViewportOffset(prev => {
      const next = computeFocusOffset(focusPoint, canvasSize, scale);
      if (Math.abs(prev.x - next.x) < 0.5 && Math.abs(prev.y - next.y) < 0.5) {
        return prev;
      }
      return next;
    });
  }, [canvasSize, scale, selectedItem]);

  const tooltipStyle = useMemo(() => {
    if (!selectedItem || !detailBubble || canvasSize.width === 0 || canvasSize.height === 0) {
      return null;
    }
    const baseX = (selectedItem.tip.x / BASE_WIDTH) * canvasSize.width;
    const baseY = (selectedItem.tip.y / BASE_HEIGHT) * canvasSize.height;
    const scaledX = canvasSize.width / 2 + (baseX - canvasSize.width / 2) * scale + viewportOffset.x;
    const scaledY = canvasSize.height / 2 + (baseY - canvasSize.height / 2) * scale + viewportOffset.y;
    const minLeft = TOOLTIP_MIN_MARGIN;
    const maxLeft = Math.max(minLeft, canvasSize.width - TOOLTIP_WIDTH - TOOLTIP_MIN_MARGIN);
    const left = Math.min(maxLeft, Math.max(minLeft, scaledX + 14));
    const showAbove = scaledY > 118;
    const top = showAbove ? scaledY - 12 : scaledY + 18;
    return {
      left,
      top,
      showAbove,
    };
  }, [canvasSize.height, canvasSize.width, detailBubble, scale, selectedItem, viewportOffset.x, viewportOffset.y]);

  const legendItems = useMemo(() => buildSoilLegendItems(directionOrder), [directionOrder]);

  const isMinScale = scale <= MIN_SCALE + 0.001;
  const isMaxScale = scale >= MAX_SCALE - 0.001;

  return (
    <div
      ref={wrapperRef}
      className="rounded-2xl border border-stone-200/80 p-3 select-none"
      onClick={() => setIsActive(true)}
    >
      <div
        ref={canvasRef}
        className="relative h-[280px] sm:h-[320px] overflow-hidden rounded-xl"
        style={{ backgroundImage: 'url(/assets/soil.png)', backgroundSize: 'cover', backgroundPosition: 'center 20%' }}
      >
        <div
          className="w-full h-full origin-center will-change-transform"
          style={{ transform: `translate3d(${viewportOffset.x}px, ${viewportOffset.y}px, 0) scale(${scale})` }}
        >
          <RootSystem items={items} selectedRootId={selectedRootId} onSelectRoot={onSelectRoot} />
        </div>
        {detailBubble && tooltipStyle ? (
          <div
            className="pointer-events-none absolute z-20"
            style={{
              left: `${tooltipStyle.left}px`,
              top: `${tooltipStyle.top}px`,
              width: `${TOOLTIP_WIDTH}px`,
              transform: tooltipStyle.showAbove ? 'translateY(-100%)' : 'translateY(0)',
            }}
          >
            <RootDetailBubble
              title={detailBubble.title}
              activity={detailBubble.activity}
              category={detailBubble.category}
              timeRange={detailBubble.timeRange}
              duration={detailBubble.duration}
              focus={detailBubble.focus}
              onClose={onCloseDetail}
              className="pointer-events-auto rounded-xl border border-amber-200/90 bg-amber-50/95 p-3 shadow-lg"
            />
          </div>
        ) : null}

        {isActive && (
          <div className="pointer-events-none absolute right-3 bottom-3 z-10 max-w-[72%] rounded-xl border border-stone-300/70 bg-stone-50/82 p-2 shadow-[0_8px_20px_rgba(66,45,24,0.12)] backdrop-blur-[2px]">
            <div className="space-y-1">
              {legendItems.map((item) => (
                <div
                  key={item.slotKey}
                  className="flex items-center gap-1.5 rounded-md bg-white/62 px-1.5 py-1 text-[10px] leading-none text-stone-700"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-stone-500/80" />
                  <span className="font-semibold text-stone-900">{t(item.positionKey)}</span>
                  <span className="text-stone-400">·</span>
                  <span className="truncate">{t(toCategoryKey(item.category))}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {isActive && (
        <div className="mt-3 flex items-center justify-end gap-2">
          <span className="rounded-lg border border-stone-300/70 bg-white/70 px-2 py-1 text-[11px] text-stone-600">
            x{scale.toFixed(2)}
          </span>
          <button
            type="button"
            onClick={() => setScale(prev => getNextScale(prev, -SCALE_STEP))}
            disabled={isMinScale}
            className="min-h-11 min-w-11 rounded-xl border border-stone-300 bg-white text-stone-700 touch-manipulation active:scale-95 transition-transform disabled:opacity-45 disabled:active:scale-100"
            aria-label="Zoom out"
          >
            -
          </button>
          <button
            type="button"
            onClick={() => setScale(prev => getNextScale(prev, SCALE_STEP))}
            disabled={isMaxScale}
            className="min-h-11 min-w-11 rounded-xl border border-stone-300 bg-white text-stone-700 touch-manipulation active:scale-95 transition-transform disabled:opacity-45 disabled:active:scale-100"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => {
              setScale(1);
              setViewportOffset({ x: 0, y: 0 });
            }}
            className="min-h-11 px-4 rounded-xl border border-stone-300 bg-white text-sm text-stone-700 touch-manipulation active:scale-95 transition-transform"
          >
            {t('plant_canvas_reset')}
          </button>
        </div>
      )}
    </div>
  );
};

export const SoilCanvas = memo(SoilCanvasImpl);
