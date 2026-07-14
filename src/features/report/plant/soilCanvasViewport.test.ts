// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import { describe, expect, it } from 'vitest';
import {
  applyViewportDrag,
  clampScale,
  clampViewportOffset,
  computeFocusOffset,
  computeRootCanvasLayout,
  getNextScale,
  getViewportBounds,
  MAX_SCALE,
  MIN_SCALE,
  SCALE_STEP,
} from './soilCanvasViewport';

describe('soilCanvasViewport', () => {
  it('clamps zoom scale between min and max', () => {
    expect(clampScale(MIN_SCALE - 0.5)).toBe(MIN_SCALE);
    expect(clampScale(MAX_SCALE + 0.5)).toBe(MAX_SCALE);
    expect(getNextScale(1, SCALE_STEP)).toBe(1.1);
  });

  it('returns zero draggable bounds when scale is <= 1', () => {
    const bounds = getViewportBounds({ width: 320, height: 280 }, 1);
    expect(bounds).toEqual({ maxX: 0, maxY: 0 });
  });

  it('clamps drag offset under zoomed viewport', () => {
    const size = { width: 320, height: 280 };
    const scale = 1.5;
    const dragged = applyViewportDrag({ x: 0, y: 0 }, { x: 1000, y: -1000 }, size, scale);

    const bounds = getViewportBounds(size, scale);
    expect(dragged.x).toBe(bounds.maxX);
    expect(dragged.y).toBe(-bounds.maxY);
  });

  it('computes focus offset and keeps it within viewport bounds', () => {
    const size = { width: 360, height: 320 };
    const scale = 1.8;
    const focused = computeFocusOffset({ x: 335, y: 300 }, size, scale);
    const bounds = getViewportBounds(size, scale);

    expect(Math.abs(focused.x)).toBeLessThanOrEqual(bounds.maxX);
    expect(Math.abs(focused.y)).toBeLessThanOrEqual(bounds.maxY);
  });

  it('resets offset to center when scale shrinks back to baseline', () => {
    const size = { width: 360, height: 320 };
    const clamped = clampViewportOffset({ x: 80, y: -60 }, size, 1);
    expect(clamped).toEqual({ x: 0, y: 0 });
  });

  it('keeps the root canvas proportional and centered on wide screens', () => {
    const layout = computeRootCanvasLayout({ width: 1268, height: 670 });

    expect(layout.width / layout.height).toBeCloseTo(360 / 520);
    expect(layout.left).toBeCloseTo((1268 - layout.width) / 2);
    expect(layout.top + 108 * layout.scale).toBeCloseTo(160 * (670 / 770));
  });

  it('anchors the root origin to the soil surface on mobile screens', () => {
    const layout = computeRootCanvasLayout({ width: 455, height: 376 });
    const soilScale = 376 / 770;

    expect(layout.top + 108 * layout.scale).toBeCloseTo(160 * soilScale);
    expect(layout.top + layout.height).toBeCloseTo(376);
  });
});
