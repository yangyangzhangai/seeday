// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
export interface CanvasSize {
  width: number;
  height: number;
}

export interface CanvasPoint {
  x: number;
  y: number;
}

export interface ViewportOffset {
  x: number;
  y: number;
}

export const MIN_SCALE = 0.75;
export const MAX_SCALE = 1.8;
export const SCALE_STEP = 0.1;

const SCALE_EPSILON = 0.001;

const normalizeZero = (value: number): number => (Math.abs(value) < 0.000001 ? 0 : value);

export const clampScale = (value: number): number => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));

export function getNextScale(currentScale: number, stepDelta: number): number {
  return clampScale(currentScale + stepDelta);
}

export function getViewportBounds(size: CanvasSize, scale: number): { maxX: number; maxY: number } {
  if (size.width <= 0 || size.height <= 0) {
    return { maxX: 0, maxY: 0 };
  }
  const resolvedScale = clampScale(scale);
  if (resolvedScale <= 1 + SCALE_EPSILON) {
    return { maxX: 0, maxY: 0 };
  }
  return {
    maxX: (size.width * resolvedScale - size.width) / 2,
    maxY: (size.height * resolvedScale - size.height) / 2,
  };
}

export function clampViewportOffset(offset: ViewportOffset, size: CanvasSize, scale: number): ViewportOffset {
  const { maxX, maxY } = getViewportBounds(size, scale);
  return {
    x: normalizeZero(Math.min(maxX, Math.max(-maxX, offset.x))),
    y: normalizeZero(Math.min(maxY, Math.max(-maxY, offset.y))),
  };
}

export function applyViewportDrag(
  currentOffset: ViewportOffset,
  delta: ViewportOffset,
  size: CanvasSize,
  scale: number,
): ViewportOffset {
  return clampViewportOffset(
    {
      x: currentOffset.x + delta.x,
      y: currentOffset.y + delta.y,
    },
    size,
    scale,
  );
}

export function computeFocusOffset(point: CanvasPoint, size: CanvasSize, scale: number): ViewportOffset {
  if (size.width <= 0 || size.height <= 0) {
    return { x: 0, y: 0 };
  }
  const centerX = size.width / 2;
  const centerY = size.height / 2;
  const targetOffset: ViewportOffset = {
    x: -((point.x - centerX) * scale),
    y: -((point.y - centerY) * scale),
  };
  return clampViewportOffset(targetOffset, size, scale);
}
