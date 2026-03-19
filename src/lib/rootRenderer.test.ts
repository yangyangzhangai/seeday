import { describe, expect, it } from 'vitest';
import { buildRootSegments, generateRootPath, mapMinutesToVisualLength, renderRootSegments } from './rootRenderer';

function parsePathStart(path: string): { x: number; y: number } {
  const matched = path.match(/^M\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/);
  if (!matched) throw new Error(`Invalid path: ${path}`);
  return { x: Number(matched[1]), y: Number(matched[2]) };
}

interface CubicPath {
  start: { x: number; y: number };
  c1: { x: number; y: number };
  c2: { x: number; y: number };
  end: { x: number; y: number };
}

function parseCubicPath(path: string): CubicPath {
  const matched = path.match(/^M\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+C\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?),\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?),\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)$/);
  if (!matched) throw new Error(`Invalid cubic path: ${path}`);
  return {
    start: { x: Number(matched[1]), y: Number(matched[2]) },
    c1: { x: Number(matched[3]), y: Number(matched[4]) },
    c2: { x: Number(matched[5]), y: Number(matched[6]) },
    end: { x: Number(matched[7]), y: Number(matched[8]) },
  };
}

function pointOnCubic(curve: CubicPath, t: number): { x: number; y: number } {
  const oneMinus = 1 - t;
  return {
    x: oneMinus ** 3 * curve.start.x
      + 3 * oneMinus ** 2 * t * curve.c1.x
      + 3 * oneMinus * t ** 2 * curve.c2.x
      + t ** 3 * curve.end.x,
    y: oneMinus ** 3 * curve.start.y
      + 3 * oneMinus ** 2 * t * curve.c1.y
      + 3 * oneMinus * t ** 2 * curve.c2.y
      + t ** 3 * curve.end.y,
  };
}

function tangentOnCubic(curve: CubicPath, t: number): { x: number; y: number } {
  const oneMinus = 1 - t;
  return {
    x: 3 * oneMinus ** 2 * (curve.c1.x - curve.start.x)
      + 6 * oneMinus * t * (curve.c2.x - curve.c1.x)
      + 3 * t ** 2 * (curve.end.x - curve.c2.x),
    y: 3 * oneMinus ** 2 * (curve.c1.y - curve.start.y)
      + 6 * oneMinus * t * (curve.c2.y - curve.c1.y)
      + 3 * t ** 2 * (curve.end.y - curve.c2.y),
  };
}

function nearestTOnCurve(curve: CubicPath, target: { x: number; y: number }): number {
  let bestT = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let index = 0; index <= 200; index += 1) {
    const t = index / 200;
    const point = pointOnCubic(curve, t);
    const dx = point.x - target.x;
    const dy = point.y - target.y;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      bestT = t;
    }
  }
  return bestT;
}

describe('rootRenderer', () => {
  it('branches short activities from existing main root and caps new origin roots', () => {
    const segments = buildRootSegments([
      { activityId: 'a1', direction: 2, minutes: 40, focus: 'medium' },
      { activityId: 'a2', direction: 2, minutes: 20, focus: 'high' },
      { activityId: 'a3', direction: 2, minutes: 35, focus: 'medium' },
      { activityId: 'a4', direction: 2, minutes: 50, focus: 'medium' },
      { activityId: 'a5', direction: 2, minutes: 45, focus: 'high' },
    ], '2026-03-18');

    const originRoots = segments.filter(segment => (segment.growthMode ?? 'origin') === 'origin');
    const branchRoots = segments.filter(segment => (segment.growthMode ?? 'origin') === 'branch');

    expect(segments).toHaveLength(4);
    expect(originRoots).toHaveLength(3);
    expect(branchRoots).toHaveLength(1);
    expect(branchRoots[0]!.parentRootId).toBe(originRoots[0]!.id);
    expect(originRoots[2]!.minutes).toBe(95);
    expect(originRoots[2]!.focus).toBe('high');
  });

  it('starts branch roots from parent middle instead of soil origin', () => {
    const segments = buildRootSegments([
      { activityId: 'd1', direction: 2, minutes: 45, focus: 'high' },
      { activityId: 'd2', direction: 2, minutes: 15, focus: 'medium' },
    ], '2026-03-18');
    const rendered = renderRootSegments(segments, { seedKey: '2026-03-18' });
    const origin = rendered.find(item => (item.segment.growthMode ?? 'origin') === 'origin')!;
    const branch = rendered.find(item => (item.segment.growthMode ?? 'origin') === 'branch')!;
    const originStart = parsePathStart(origin.path);
    const branchStart = parsePathStart(branch.path);

    expect(originStart.y).toBe(52);
    expect(branchStart.y).toBeGreaterThan(52);
    expect(branchStart.y).toBeLessThan(branch.tip.y);
  });

  it('separates same-direction origin roots with deterministic angle offsets', () => {
    const segments = buildRootSegments([
      { activityId: 'e1', direction: 2, minutes: 120, focus: 'high' },
      { activityId: 'e2', direction: 2, minutes: 55, focus: 'medium' },
      { activityId: 'e3', direction: 2, minutes: 50, focus: 'medium' },
    ], '2026-03-18');
    const rendered = renderRootSegments(segments, { seedKey: '2026-03-18' });
    const tipsX = rendered.map(item => item.tip.x);
    const uniqueTips = new Set(tipsX.map(value => value.toFixed(2)));

    expect(uniqueTips.size).toBe(3);

    const renderedAgain = renderRootSegments(segments, { seedKey: '2026-03-18' });
    expect(renderedAgain.map(item => item.tip)).toEqual(rendered.map(item => item.tip));
  });

  it('keeps branch curves on one side of parent tangent', () => {
    const segments = buildRootSegments([
      { activityId: 's1', direction: 2, minutes: 55, focus: 'high' },
      { activityId: 's2', direction: 2, minutes: 18, focus: 'medium' },
      { activityId: 's3', direction: 2, minutes: 16, focus: 'medium' },
    ], '2026-03-19');
    const rendered = renderRootSegments(segments, { seedKey: '2026-03-19' });
    const parent = rendered.find(item => (item.segment.growthMode ?? 'origin') === 'origin');
    const branches = rendered.filter(item => (item.segment.growthMode ?? 'origin') === 'branch');
    expect(parent).toBeTruthy();
    expect(branches.length).toBeGreaterThan(0);

    const parentCurve = parseCubicPath(parent!.path);

    branches.forEach((branch) => {
      const branchCurve = parseCubicPath(branch.path);
      const t = nearestTOnCurve(parentCurve, branchCurve.start);
      const tangent = tangentOnCubic(parentCurve, t);
      const tangentLen = Math.hypot(tangent.x, tangent.y) || 1;
      const nx = tangent.y / tangentLen;
      const ny = -tangent.x / tangentLen;

      const projection = (point: { x: number; y: number }) => {
        const dx = point.x - branchCurve.start.x;
        const dy = point.y - branchCurve.start.y;
        return dx * nx + dy * ny;
      };

      const endProj = projection(branchCurve.end);
      const sideSign = endProj >= 0 ? 1 : -1;
      const c1Proj = projection(branchCurve.c1) * sideSign;
      const c2Proj = projection(branchCurve.c2) * sideSign;
      const tipProj = endProj * sideSign;

      expect(c1Proj).toBeGreaterThan(1.2);
      expect(c2Proj).toBeGreaterThan(2.5);
      expect(tipProj).toBeGreaterThan(4);
    });
  });

  it('keeps deterministic path for same seed and segment', () => {
    const [segment] = buildRootSegments([{ activityId: 'b1', direction: 1, minutes: 90, focus: 'medium' }], '2026-03-18');
    const pathA = generateRootPath(segment, { seedKey: '2026-03-18' });
    const pathB = generateRootPath(segment, { seedKey: '2026-03-18' });

    expect(pathA).toBe(pathB);
  });

  it('uses logarithmic mapping with visible saturation', () => {
    const shortLength = mapMinutesToVisualLength(30, { canvasHeight: 500 });
    const mediumLength = mapMinutesToVisualLength(180, { canvasHeight: 500 });
    const veryLongLength = mapMinutesToVisualLength(900, { canvasHeight: 500 });

    expect(shortLength).toBeGreaterThan(0);
    expect(mediumLength).toBeGreaterThan(shortLength);
    expect(veryLongLength).toBeLessThanOrEqual(500 * 0.6);
  });

  it('renders path and stroke width payload for svg usage', () => {
    const segments = buildRootSegments([
      { activityId: 'c1', direction: 0, minutes: 70, focus: 'medium' },
      { activityId: 'c2', direction: 4, minutes: 110, focus: 'high' },
    ], '2026-03-18');
    const rendered = renderRootSegments(segments, { seedKey: '2026-03-18' });

    expect(rendered).toHaveLength(2);
    expect(rendered[0]!.path.startsWith('M ')).toBe(true);
    expect(rendered.some(item => item.strokeWidth === 4)).toBe(true);
  });
});
