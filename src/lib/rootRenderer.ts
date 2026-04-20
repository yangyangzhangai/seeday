// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/Seeday_植物生长_PRD_v1_8.docx -> docs/Seeday_植物生长_技术实现文档_v1.7.docx
import type { DirectionIndex, FocusLevel, RootSegment } from '../types/plant';

export interface RootRenderActivityInput {
  activityId: string;
  direction: DirectionIndex;
  minutes: number;
  focus?: FocusLevel;
}

export interface RootRendererOptions {
  canvasWidth?: number;
  canvasHeight?: number;
  soilY?: number;
  maxLengthRatio?: number;
  lengthScale?: number;
  jitterPx?: number;
  seedKey?: string;
}

export interface RootPathRenderItem {
  segment: RootSegment;
  path: string;
  strokeWidth: number;
  tip: {
    x: number;
    y: number;
  };
}

const DIRECTION_ANGLES: Record<DirectionIndex, number> = {
  0: -45,
  1: -20,
  2: 0,
  3: 20,
  4: 45,
};

const DIRECTION_ANGLE_RANGES: Record<DirectionIndex, { min: number; max: number }> = {
  0: { min: -55, max: -32.5 },
  1: { min: -32.5, max: -10 },
  2: { min: -10, max: 10 },
  3: { min: 10, max: 32.5 },
  4: { min: 32.5, max: 55 },
};

const DIRECTION_BRANCH_ANGLE_RANGES: Record<DirectionIndex, { min: number; max: number }> = {
  0: { min: -70, max: -20 },
  1: { min: -50, max: 5 },
  2: { min: -25, max: 25 },
  3: { min: -5, max: 50 },
  4: { min: 20, max: 70 },
};

const SOIL_ANCHOR_X_RATIO = 0.5;

const defaultOptions: Required<RootRendererOptions> = {
  canvasWidth: 360,
  canvasHeight: 520,
  soilY: 108,
  maxLengthRatio: 0.6,
  lengthScale: 68,
  jitterPx: 7,
  seedKey: 'default-seed',
};

const ROOT_EDGE_PADDING_PX = 18;
const ROOT_LENGTH_BOUNDARY_SAFETY = 0.9;
const MIN_ORIGIN_LENGTH_PX = 14;
const MIN_BRANCH_LENGTH_PX = 10;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0);
};

const resolveDeterministicSign = (seed: string): number => (hashString(seed) % 2 === 0 ? -1 : 1);

const seededJitter = (seed: string, range: number): number => {
  const value = hashString(seed) % 10000;
  const normalized = value / 10000;
  return (normalized * 2 - 1) * range;
};

const seededRange = (seed: string, min: number, max: number): number => {
  const value = hashString(seed) % 10000;
  const normalized = value / 10000;
  return min + (max - min) * normalized;
};

const mergeOptions = (options?: RootRendererOptions): Required<RootRendererOptions> => ({
  ...defaultOptions,
  ...(options ?? {}),
});

const BRANCH_MINUTES_THRESHOLD = 30;
const MAX_ORIGIN_ROOTS_PER_DIRECTION = 5;

const ORIGIN_MIN_ANGLE_GAP = 6.5;
const BRANCH_MIN_ANGLE_GAP = 8;

const createSegmentId = (seed: string, direction: DirectionIndex, order: number): string => {
  const hash = hashString(`${seed}-${direction}-${order}`).toString(36);
  return `root_${direction}_${order}_${hash.slice(0, 8)}`;
};

const resolveOriginSign = (order: number): number => {
  if (order <= 1) return 0;
  return order % 2 === 0 ? -1 : 1;
};

function resolveSegmentAngle(segment: RootSegment): number {
  const growthMode = segment.growthMode ?? 'origin';
  const baseAngle = DIRECTION_ANGLES[segment.direction];
  const magnitude = growthMode === 'branch'
    ? seededRange(`${segment.id}-branch-angle`, 12, 20)
    : segment.branchOrder <= 1
      ? seededRange(`${segment.id}-origin-angle`, 0.5, 4)
      : seededRange(`${segment.id}-origin-angle`, 6, 11);
  const directionSign = growthMode === 'origin'
    ? resolveOriginSign(segment.branchOrder) || resolveDeterministicSign(`${segment.id}-origin-side`)
    : resolveDeterministicSign(`${segment.parentRootId ?? segment.id}-branch-side`) * (segment.branchOrder % 2 === 0 ? -1 : 1);
  const rawAngle = baseAngle + directionSign * magnitude;
  const bounds = growthMode === 'branch'
    ? DIRECTION_BRANCH_ANGLE_RANGES[segment.direction]
    : DIRECTION_ANGLE_RANGES[segment.direction];
  return clamp(rawAngle, bounds.min, bounds.max);
}

function minAngleDistance(angle: number, used: number[]): number {
  if (used.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...used.map(value => Math.abs(value - angle)));
}

function placeAngleWithGap(
  target: number,
  used: number[],
  bounds: { min: number; max: number },
  minGap: number,
): number {
  if (used.length === 0) return clamp(target, bounds.min, bounds.max);

  const start = clamp(target, bounds.min, bounds.max);
  let best = start;
  let bestScore = minAngleDistance(best, used);
  if (bestScore >= minGap) return best;

  for (let step = 1; step <= 18; step += 1) {
    const delta = step * 1.2;
    const candidates = [
      clamp(start + delta, bounds.min, bounds.max),
      clamp(start - delta, bounds.min, bounds.max),
    ];
    for (const candidate of candidates) {
      const score = minAngleDistance(candidate, used);
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
      if (score >= minGap) return candidate;
    }
  }

  return best;
}

function buildSegmentAnglePlan(segments: RootSegment[]): Map<string, number> {
  const byDirection = new Map<DirectionIndex, RootSegment[]>();
  segments.forEach((segment) => {
    const list = byDirection.get(segment.direction) ?? [];
    list.push(segment);
    byDirection.set(segment.direction, list);
  });

  const plan = new Map<string, number>();

  for (const [direction, directionSegments] of byDirection.entries()) {
    const usedAngles: number[] = [];
    const originBounds = DIRECTION_ANGLE_RANGES[direction];
    const branchBounds = DIRECTION_BRANCH_ANGLE_RANGES[direction];
    const baseAngle = DIRECTION_ANGLES[direction];

    const originSegments = directionSegments
      .filter(segment => (segment.growthMode ?? 'origin') === 'origin')
      .sort((a, b) => a.branchOrder - b.branchOrder);
    originSegments.forEach((segment) => {
      const straightChance = seededRange(`${segment.id}-straight-chance`, 0, 1);
      const magnitude = segment.branchOrder <= 1
        ? straightChance < 0.52
          ? seededRange(`${segment.id}-origin-main-angle`, 0.2, 1.6)
          : seededRange(`${segment.id}-origin-main-angle`, 2.4, 5.2)
        : seededRange(`${segment.id}-origin-secondary-angle`, 6, 10.5);
      const sign = resolveOriginSign(segment.branchOrder) || resolveDeterministicSign(`${segment.id}-origin-side`);
      const target = baseAngle + sign * magnitude;
      const angle = placeAngleWithGap(target, usedAngles, originBounds, ORIGIN_MIN_ANGLE_GAP);
      usedAngles.push(angle);
      plan.set(segment.id, angle);
    });

    const branchSegments = directionSegments
      .filter(segment => (segment.growthMode ?? 'origin') === 'branch');
    branchSegments.forEach((segment) => {
      const parentAngle = segment.parentRootId ? plan.get(segment.parentRootId) ?? baseAngle : baseAngle;
      const split = seededRange(`${segment.id}-branch-split`, 13, 22);
      const sign = resolveDeterministicSign(`${segment.id}-branch-side`);
      const target = parentAngle + sign * split;
      const angle = placeAngleWithGap(target, usedAngles, branchBounds, BRANCH_MIN_ANGLE_GAP);
      usedAngles.push(angle);
      plan.set(segment.id, angle);
    });
  }

  return plan;
}

function resolveBranchRatio(
  parentRootId: string,
  activityId: string,
  existingRatios: number[],
): number {
  if (existingRatios.length === 0) {
    return seededRange(`${parentRootId}-${activityId}-branch-ratio`, 0.34, 0.76);
  }

  let best = 0.5;
  let bestScore = -1;
  for (let index = 0; index < 14; index += 1) {
    const candidate = seededRange(`${parentRootId}-${activityId}-branch-ratio-${index}`, 0.3, 0.8);
    const score = Math.min(...existingRatios.map(value => Math.abs(value - candidate)));
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

export function mapMinutesToVisualLength(minutes: number, options?: RootRendererOptions): number {
  const resolved = mergeOptions(options);
  const maxLength = resolved.canvasHeight * resolved.maxLengthRatio;
  const safeMinutes = Math.max(0, minutes);
  if (safeMinutes === 0) return 0;

  const tau = Math.max(1, resolved.lengthScale);
  const growth = 1 - Math.exp(-safeMinutes / tau);
  const minVisibleLength = Math.min(10, maxLength * 0.2);
  const visualLength = minVisibleLength + (maxLength - minVisibleLength) * growth;
  return Math.max(0, Math.min(maxLength, visualLength));
}

export function buildRootSegments(activities: RootRenderActivityInput[], seedKey = 'default-seed'): RootSegment[] {
  const sorted = activities
    .map(activity => ({ ...activity, minutes: Math.max(0, activity.minutes || 0), focus: activity.focus ?? 'medium' as FocusLevel }))
    .filter(activity => activity.minutes >= 5);
  const originRootsByDirection = new Map<DirectionIndex, RootSegment[]>();
  const branchCountByParent = new Map<string, number>();
  const branchRatiosByParent = new Map<string, number[]>();
  const segmentOrderByDirection = new Map<DirectionIndex, number>();
  const segments: RootSegment[] = [];

  for (const activity of sorted) {
    const roots = originRootsByDirection.get(activity.direction) ?? [];
    const isShortActivity = activity.minutes < BRANCH_MINUTES_THRESHOLD;
    const shouldStartFromOrigin = !isShortActivity || roots.length === 0;

    if (shouldStartFromOrigin) {
      const isAtCapacity = roots.length >= MAX_ORIGIN_ROOTS_PER_DIRECTION;
      if (isAtCapacity) {
        const parentRoot = roots[roots.length - 1]!;
        const segmentOrder = (segmentOrderByDirection.get(activity.direction) ?? 0) + 1;
        segmentOrderByDirection.set(activity.direction, segmentOrder);
        const branchOrder = (branchCountByParent.get(parentRoot.id) ?? 0) + 1;
        branchCountByParent.set(parentRoot.id, branchOrder);
        const existingRatios = branchRatiosByParent.get(parentRoot.id) ?? [];
        const branchRatio = resolveBranchRatio(parentRoot.id, activity.activityId, existingRatios);
        const sideRoot: RootSegment = {
          id: createSegmentId(seedKey + activity.activityId, activity.direction, segmentOrder),
          direction: activity.direction,
          activityId: activity.activityId,
          minutes: activity.minutes,
          focus: activity.focus,
          isMainRoot: false,
          branchOrder,
          growthMode: 'branch',
          branchRatio,
          parentRootId: parentRoot.id,
        };
        existingRatios.push(branchRatio);
        branchRatiosByParent.set(parentRoot.id, existingRatios);
        segments.push(sideRoot);
        continue;
      }

      const segmentOrder = (segmentOrderByDirection.get(activity.direction) ?? 0) + 1;
      segmentOrderByDirection.set(activity.direction, segmentOrder);
      const mainRoot: RootSegment = {
        id: createSegmentId(seedKey + activity.activityId, activity.direction, segmentOrder),
        direction: activity.direction,
        activityId: activity.activityId,
        minutes: activity.minutes,
        focus: activity.focus,
        isMainRoot: true,
        branchOrder: roots.length + 1,
        growthMode: 'origin',
      };
      roots.push(mainRoot);
      originRootsByDirection.set(activity.direction, roots);
      segments.push(mainRoot);
      continue;
    }

    const parentRoot = roots[roots.length - 1]!;
    const segmentOrder = (segmentOrderByDirection.get(activity.direction) ?? 0) + 1;
    segmentOrderByDirection.set(activity.direction, segmentOrder);
    const branchOrder = (branchCountByParent.get(parentRoot.id) ?? 0) + 1;
    branchCountByParent.set(parentRoot.id, branchOrder);
    const existingRatios = branchRatiosByParent.get(parentRoot.id) ?? [];
    const branchRatio = resolveBranchRatio(parentRoot.id, activity.activityId, existingRatios);
    const sideRoot: RootSegment = {
      id: createSegmentId(seedKey + activity.activityId, activity.direction, segmentOrder),
      direction: activity.direction,
      activityId: activity.activityId,
      minutes: activity.minutes,
      focus: activity.focus,
      isMainRoot: false,
      branchOrder,
      growthMode: 'branch',
      branchRatio,
      parentRootId: parentRoot.id,
    };
    existingRatios.push(branchRatio);
    branchRatiosByParent.set(parentRoot.id, existingRatios);
    segments.push(sideRoot);
  }

  return segments;
}

interface Point {
  x: number;
  y: number;
}

interface SegmentGeometry {
  start: Point;
  c1: Point;
  c2: Point;
  end: Point;
}

interface Vector {
  x: number;
  y: number;
}

const resolveMaxLengthByBounds = (
  start: Point,
  direction: Vector,
  options: Required<RootRendererOptions>,
): number => {
  const xMin = ROOT_EDGE_PADDING_PX;
  const xMax = options.canvasWidth - ROOT_EDGE_PADDING_PX;
  const yMin = Math.min(options.canvasHeight - ROOT_EDGE_PADDING_PX, options.soilY + 4);
  const yMax = options.canvasHeight - ROOT_EDGE_PADDING_PX;
  const candidates: number[] = [];

  if (direction.x > 1e-6) {
    candidates.push((xMax - start.x) / direction.x);
  } else if (direction.x < -1e-6) {
    candidates.push((xMin - start.x) / direction.x);
  }

  if (direction.y > 1e-6) {
    candidates.push((yMax - start.y) / direction.y);
  } else if (direction.y < -1e-6) {
    candidates.push((yMin - start.y) / direction.y);
  }

  const positiveCandidates = candidates.filter(value => Number.isFinite(value) && value > 0);
  if (positiveCandidates.length === 0) {
    return options.canvasHeight * options.maxLengthRatio;
  }
  return Math.min(...positiveCandidates);
};

const getAnchorPoint = (_segment: RootSegment, options: Required<RootRendererOptions>): Point => {
  const x = options.canvasWidth * SOIL_ANCHOR_X_RATIO;
  const y = options.soilY;
  return { x, y };
};

const getPointOnCubic = (geometry: SegmentGeometry, t: number): Point => {
  const ratio = clamp(t, 0, 1);
  const oneMinus = 1 - ratio;
  const x = oneMinus ** 3 * geometry.start.x
    + 3 * oneMinus ** 2 * ratio * geometry.c1.x
    + 3 * oneMinus * ratio ** 2 * geometry.c2.x
    + ratio ** 3 * geometry.end.x;
  const y = oneMinus ** 3 * geometry.start.y
    + 3 * oneMinus ** 2 * ratio * geometry.c1.y
    + 3 * oneMinus * ratio ** 2 * geometry.c2.y
    + ratio ** 3 * geometry.end.y;
  return { x, y };
};

const getTangentOnCubic = (geometry: SegmentGeometry, t: number): Point => {
  const ratio = clamp(t, 0, 1);
  const oneMinus = 1 - ratio;
  const x = 3 * oneMinus ** 2 * (geometry.c1.x - geometry.start.x)
    + 6 * oneMinus * ratio * (geometry.c2.x - geometry.c1.x)
    + 3 * ratio ** 2 * (geometry.end.x - geometry.c2.x);
  const y = 3 * oneMinus ** 2 * (geometry.c1.y - geometry.start.y)
    + 6 * oneMinus * ratio * (geometry.c2.y - geometry.c1.y)
    + 3 * ratio ** 2 * (geometry.end.y - geometry.c2.y);
  return { x, y };
};

const normalizeVector = (vector: Vector): Vector => {
  const length = Math.hypot(vector.x, vector.y);
  if (length < 1e-6) return { x: 0, y: 1 };
  return { x: vector.x / length, y: vector.y / length };
};

const signedDistanceAlongNormal = (point: Point, origin: Point, normal: Vector): number => {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  return dx * normal.x + dy * normal.y;
};

const shiftPointAlongNormal = (point: Point, normal: Vector, delta: number): Point => ({
  x: point.x + normal.x * delta,
  y: point.y + normal.y * delta,
});

const enforcePointSide = (
  point: Point,
  origin: Point,
  normal: Vector,
  sideSign: number,
  minDistance: number,
): Point => {
  const signed = signedDistanceAlongNormal(point, origin, normal) * sideSign;
  if (signed >= minDistance) return point;
  return shiftPointAlongNormal(point, normal, (minDistance - signed) * sideSign);
};

const enforceBranchSideLock = (
  geometry: SegmentGeometry,
  tangent: Vector,
  sideSign: number,
): SegmentGeometry => {
  const t = normalizeVector(tangent);
  const normal = { x: t.y, y: -t.x };

  let c1 = enforcePointSide(geometry.c1, geometry.start, normal, sideSign, 4);
  let c2 = enforcePointSide(geometry.c2, geometry.start, normal, sideSign, 7);
  let end = enforcePointSide(geometry.end, geometry.start, normal, sideSign, 11);

  c2 = enforcePointSide(c2, geometry.start, normal, sideSign, 0.75 * signedDistanceAlongNormal(c1, geometry.start, normal) * sideSign);
  end = enforcePointSide(end, geometry.start, normal, sideSign, 1.25 * signedDistanceAlongNormal(c2, geometry.start, normal) * sideSign);

  return { ...geometry, c1, c2, end };
};

const resolveSegmentStartPoint = (
  segment: RootSegment,
  options: Required<RootRendererOptions>,
  geometryById?: Map<string, SegmentGeometry>,
): Point => {
  if ((segment.growthMode ?? 'origin') === 'branch' && segment.parentRootId && geometryById?.has(segment.parentRootId)) {
    const parentGeometry = geometryById.get(segment.parentRootId)!;
    return getPointOnCubic(parentGeometry, segment.branchRatio ?? 0.55);
  }
  return getAnchorPoint(segment, options);
};

const buildControlPoints = (segment: RootSegment, start: Point, end: Point, options: Required<RootRendererOptions>): [number, number, number, number] => {
  const seedBase = `${options.seedKey}-${segment.id}`;
  const isBranch = (segment.growthMode ?? 'origin') === 'branch';
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const tx = dx / length;
  const ty = dy / length;
  const nx = ty;
  const ny = -tx;

  const bend = seededJitter(`${seedBase}-bend`, isBranch ? options.jitterPx * 0.08 : options.jitterPx * 0.18);
  const spread = seededJitter(`${seedBase}-spread`, isBranch ? options.jitterPx * 0.35 : options.jitterPx * 0.3);
  const curveSign = resolveDeterministicSign(`${segment.id}-curve-sign`);
  const baseCurve = isBranch
    ? Math.min(9, Math.max(4, length * 0.09))
    : Math.min(8, Math.max(1.2, length * 0.04));

  const c1Along = isBranch
    ? seededRange(`${seedBase}-c1-along`, 0.15, 0.23)
    : seededRange(`${seedBase}-c1-along`, 0.28, 0.35);
  const c2Along = isBranch
    ? seededRange(`${seedBase}-c2-along`, 0.56, 0.68)
    : seededRange(`${seedBase}-c2-along`, 0.72, 0.8);
  const c1Normal = baseCurve * (isBranch ? 1.05 : 0.65) * curveSign + spread;
  const c2Normal = baseCurve * (isBranch ? 0.62 : 0.55) * curveSign - spread * 0.35;

  const c1x = start.x + dx * c1Along + nx * c1Normal;
  const c1y = start.y + dy * c1Along + ny * c1Normal + bend;
  const c2x = start.x + dx * c2Along + nx * c2Normal;
  const c2y = start.y + dy * c2Along + ny * c2Normal - bend * 0.65;
  return [c1x, c1y, c2x, c2y];
};

const resolveSegmentGeometry = (
  segment: RootSegment,
  options: Required<RootRendererOptions>,
  geometryById?: Map<string, SegmentGeometry>,
  angleById?: Map<string, number>,
): SegmentGeometry => {
  const rawLength = mapMinutesToVisualLength(segment.minutes, options);
  const isBranch = (segment.growthMode ?? 'origin') === 'branch';
  const start = resolveSegmentStartPoint(segment, options, geometryById);
  const ratio = segment.branchRatio ?? 0.55;
  const parentGeometry = isBranch && segment.parentRootId ? geometryById?.get(segment.parentRootId) : undefined;
  const tangent = parentGeometry ? getTangentOnCubic(parentGeometry, ratio) : null;
  const tangentAngle = tangent ? (Math.atan2(tangent.x, tangent.y) * 180) / Math.PI : null;
  const plannedAngle = angleById?.get(segment.id) ?? resolveSegmentAngle(segment);
  const baseAngle = isBranch && tangentAngle !== null
    ? plannedAngle * 0.82 + tangentAngle * 0.18
    : plannedAngle;
  const branchNudge = isBranch ? seededJitter(`${segment.id}-branch-nudge`, 0.8) : seededJitter(`${segment.id}-origin-nudge`, 0.35);
  const bounds = isBranch ? DIRECTION_BRANCH_ANGLE_RANGES[segment.direction] : DIRECTION_ANGLE_RANGES[segment.direction];
  const angle = toRadians(clamp(baseAngle + branchNudge, bounds.min, bounds.max));
  const depthDrift = isBranch ? 0.08 : 0;
  const directionVector = {
    x: Math.sin(angle) * (1 + depthDrift),
    y: Math.cos(angle),
  };
  const maxLengthByBounds = resolveMaxLengthByBounds(start, directionVector, options) * ROOT_LENGTH_BOUNDARY_SAFETY;
  const minLength = isBranch ? MIN_BRANCH_LENGTH_PX : MIN_ORIGIN_LENGTH_PX;
  const desiredLength = Math.max(rawLength, minLength);
  const length = Math.max(0, Math.min(desiredLength, maxLengthByBounds));
  const end = {
    x: start.x + directionVector.x * length,
    y: start.y + Math.cos(angle) * length,
  };
  const [c1x, c1y, c2x, c2y] = buildControlPoints(segment, start, end, options);
  let geometry: SegmentGeometry = {
    start,
    c1: { x: c1x, y: c1y },
    c2: { x: c2x, y: c2y },
    end,
  };

  if (isBranch && tangent) {
    const sideSign = resolveDeterministicSign(`${segment.id}-branch-side-lock`);
    geometry = enforceBranchSideLock(geometry, tangent, sideSign);
  }

  return geometry;
};

const toSvgPath = (geometry: SegmentGeometry): string => {
  return `M ${geometry.start.x.toFixed(2)} ${geometry.start.y.toFixed(2)} C ${geometry.c1.x.toFixed(2)} ${geometry.c1.y.toFixed(2)}, ${geometry.c2.x.toFixed(2)} ${geometry.c2.y.toFixed(2)}, ${geometry.end.x.toFixed(2)} ${geometry.end.y.toFixed(2)}`;
};

export function generateRootPath(segment: RootSegment, options?: RootRendererOptions): string {
  const resolved = mergeOptions(options);
  return toSvgPath(resolveSegmentGeometry(segment, resolved));
}

export function getRootTipPoint(segment: RootSegment, options?: RootRendererOptions): { x: number; y: number } {
  const resolved = mergeOptions(options);
  const geometry = resolveSegmentGeometry(segment, resolved);
  return geometry.end;
}

export function getRootStrokeWidth(focus: FocusLevel): number {
  return focus === 'high' ? 4 : 2.5;
}

export function renderRootSegments(segments: RootSegment[], options?: RootRendererOptions): RootPathRenderItem[] {
  const resolved = mergeOptions(options);
  const geometryById = new Map<string, SegmentGeometry>();
  const angleById = buildSegmentAnglePlan(segments);
  return segments.map((segment) => {
    const geometry = resolveSegmentGeometry(segment, resolved, geometryById, angleById);
    geometryById.set(segment.id, geometry);
    return {
      segment,
      path: toSvgPath(geometry),
      strokeWidth: getRootStrokeWidth(segment.focus),
      tip: geometry.end,
    };
  });
}
