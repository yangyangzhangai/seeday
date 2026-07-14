// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import {
  ROOT_CANVAS_HEIGHT,
  ROOT_CANVAS_WIDTH,
  ROOT_SOIL_Y,
} from '../../../lib/rootRenderer';

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

export interface RootCanvasLayout {
  height: number;
  left: number;
  scale: number;
  top: number;
  width: number;
}

export const MIN_SCALE = 0.75;
export const MAX_SCALE = 1.8;
export const SCALE_STEP = 0.1;

const SCALE_EPSILON = 0.001;
const SOIL_IMAGE_HEIGHT = 770;
const SOIL_SURFACE_Y = 160;

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

export function computeRootCanvasLayout(size: CanvasSize): RootCanvasLayout {
  if (size.width <= 0 || size.height <= 0) {
    return { height: 0, left: 0, scale: 0, top: 0, width: 0 };
  }

  const soilSurfaceY = SOIL_SURFACE_Y * (size.height / SOIL_IMAGE_HEIGHT);
  const availableBelowSoil = Math.max(0, size.height - soilSurfaceY);
  const rootDepth = ROOT_CANVAS_HEIGHT - ROOT_SOIL_Y;
  const rootScale = Math.min(size.width / ROOT_CANVAS_WIDTH, availableBelowSoil / rootDepth);
  const width = ROOT_CANVAS_WIDTH * rootScale;
  const height = ROOT_CANVAS_HEIGHT * rootScale;

  return {
    height,
    left: (size.width - width) / 2,
    scale: rootScale,
    top: soilSurfaceY - ROOT_SOIL_Y * rootScale,
    width,
  };
}
