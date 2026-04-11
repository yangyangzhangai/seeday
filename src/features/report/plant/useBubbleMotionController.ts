// DOC-DEPS: src/features/report/README.md
import { useCallback, useEffect, useRef } from 'react';
import {
  listenToDeviceTilt,
  requestMotionPermissionIfNeeded,
  supportsDeviceTilt,
  type TiltVector,
} from '../../../services/native/motionService';

const BUBBLE_SIZE = 100;
const EDGE_PADDING = 4;
const MAX_SPEED = 65;
const AIR_DRAG = 0.992;
const BOUNCE_DAMPING = 0.82;
const DRIFT_STRENGTH = 10;
const GRAVITY_STRENGTH = 100;
const SHAKE_GAIN = 0.028;
const SHAKE_THRESHOLD = 1.7;
const OVERLAP_THRESHOLD = BUBBLE_SIZE * (2 / 3);
const WANDER_CHANGE_MIN = 1.8;
const WANDER_CHANGE_MAX = 3.6;
const WANDER_SMOOTHING = 0.08;

interface BubblePhysicsState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  wanderX: number;
  wanderY: number;
  wanderTargetX: number;
  wanderTargetY: number;
  wanderTimer: number;
}

export interface BubbleMotionController {
  containerRef: React.RefObject<HTMLDivElement>;
  setBubbleRef: (index: number) => (node: HTMLDivElement | null) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function randomDirection(): { x: number; y: number } {
  const angle = Math.random() * Math.PI * 2;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomPosition(maxX: number, maxY: number): { x: number; y: number } {
  return {
    x: randomRange(EDGE_PADDING, maxX),
    y: randomRange(EDGE_PADDING, maxY),
  };
}

function randomSeparatedPosition(
  maxX: number,
  maxY: number,
  otherX: number,
  otherY: number,
): { x: number; y: number } {
  for (let i = 0; i < 6; i += 1) {
    const candidate = randomPosition(maxX, maxY);
    if (Math.hypot(candidate.x - otherX, candidate.y - otherY) >= OVERLAP_THRESHOLD) return candidate;
  }
  return {
    x: otherX < maxX / 2 ? maxX : EDGE_PADDING,
    y: otherY < maxY / 2 ? maxY : EDGE_PADDING,
  };
}

function seedWander(state: BubblePhysicsState): void {
  const dir = randomDirection();
  const strength = DRIFT_STRENGTH * randomRange(0.7, 1.2);
  state.wanderTargetX = dir.x * strength;
  state.wanderTargetY = dir.y * strength;
  state.wanderX = state.wanderTargetX * 0.6;
  state.wanderY = state.wanderTargetY * 0.6;
  state.wanderTimer = randomRange(WANDER_CHANGE_MIN, WANDER_CHANGE_MAX);
}

function updateWander(state: BubblePhysicsState, dt: number, index: number): void {
  state.wanderTimer -= dt;
  if (state.wanderTimer <= 0) {
    const dir = randomDirection();
    const strength = DRIFT_STRENGTH * randomRange(0.7, 1.2);
    state.wanderTargetX = dir.x * strength;
    state.wanderTargetY = dir.y * strength;
    state.wanderTimer = randomRange(WANDER_CHANGE_MIN, WANDER_CHANGE_MAX) + index * 0.2;
  }
  state.wanderX = lerp(state.wanderX, state.wanderTargetX, WANDER_SMOOTHING);
  state.wanderY = lerp(state.wanderY, state.wanderTargetY, WANDER_SMOOTHING);
}

function resolveOverlap(a: BubblePhysicsState, b: BubblePhysicsState): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let dist = Math.hypot(dx, dy);
  if (dist >= OVERLAP_THRESHOLD) return;
  if (dist < 0.001) {
    const dir = randomDirection();
    dist = 0.001;
    a.x -= dir.x * 0.5;
    a.y -= dir.y * 0.5;
    b.x += dir.x * 0.5;
    b.y += dir.y * 0.5;
  }
  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = OVERLAP_THRESHOLD - dist;
  const push = overlap * 0.5;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  const impulse = overlap * 2.4;
  a.vx -= nx * impulse;
  a.vy -= ny * impulse;
  b.vx += nx * impulse;
  b.vy += ny * impulse;
  a.vx *= BOUNCE_DAMPING;
  a.vy *= BOUNCE_DAMPING;
  b.vx *= BOUNCE_DAMPING;
  b.vy *= BOUNCE_DAMPING;
}

export function useBubbleMotionController(): BubbleMotionController {
  const containerRef = useRef<HTMLDivElement>(null);
  const bubbleRefs = useRef<Array<HTMLDivElement | null>>([null, null]);
  const areaRef = useRef({ width: 0, height: 0 });
  const gravityRef = useRef<TiltVector>({ x: 0, y: 0 });
  const shakeRef = useRef({ x: 0, y: 0 });
  const lastAccelRef = useRef<TiltVector | null>(null);
  const statesRef = useRef<BubblePhysicsState[]>([
    { x: 28, y: 16, vx: 6, vy: -4, wanderX: 0, wanderY: 0, wanderTargetX: 6, wanderTargetY: -4, wanderTimer: 2.2 },
    { x: 170, y: 72, vx: -6, vy: 5, wanderX: 0, wanderY: 0, wanderTargetX: -5, wanderTargetY: 5, wanderTimer: 2.6 },
  ]);
  const motionReadyRef = useRef(false);
  const initPositionsRef = useRef(false);

  const updateArea = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    areaRef.current = { width: el.clientWidth, height: el.clientHeight };
    const maxX = Math.max(EDGE_PADDING, areaRef.current.width - BUBBLE_SIZE - EDGE_PADDING);
    const maxY = Math.max(EDGE_PADDING, areaRef.current.height - BUBBLE_SIZE - EDGE_PADDING);
    if (!initPositionsRef.current && maxX > EDGE_PADDING && maxY > EDGE_PADDING) {
      const first = statesRef.current[0];
      const second = statesRef.current[1];
      const startA = randomPosition(maxX, maxY);
      const startB = randomSeparatedPosition(maxX, maxY, startA.x, startA.y);
      first.x = startA.x;
      first.y = startA.y;
      second.x = startB.x;
      second.y = startB.y;
      seedWander(first);
      seedWander(second);
      initPositionsRef.current = true;
    }
    statesRef.current = statesRef.current.map((state) => ({
      ...state,
      x: clamp(state.x, EDGE_PADDING, maxX),
      y: clamp(state.y, EDGE_PADDING, maxY),
    }));
  }, []);

  useEffect(() => {
    updateArea();
    const host = containerRef.current;
    if (!host || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => updateArea());
    observer.observe(host);
    return () => observer.disconnect();
  }, [updateArea]);

  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();
    const render = (now: number) => {
      const dt = clamp((now - lastTs) / 1000, 0.008, 0.034);
      lastTs = now;
      const { width, height } = areaRef.current;
      if (width > 0 && height > 0) {
        const maxX = Math.max(EDGE_PADDING, width - BUBBLE_SIZE - EDGE_PADDING);
        const maxY = Math.max(EDGE_PADDING, height - BUBBLE_SIZE - EDGE_PADDING);
        statesRef.current.forEach((state, index) => {
          updateWander(state, dt, index);
          const ax = state.wanderX + gravityRef.current.x * GRAVITY_STRENGTH + shakeRef.current.x * 430;
          const ay = state.wanderY + gravityRef.current.y * GRAVITY_STRENGTH + shakeRef.current.y * 430 - 3;
          state.vx = clamp((state.vx + ax * dt) * Math.pow(AIR_DRAG, dt * 60), -MAX_SPEED, MAX_SPEED);
          state.vy = clamp((state.vy + ay * dt) * Math.pow(AIR_DRAG, dt * 60), -MAX_SPEED, MAX_SPEED);
          state.x += state.vx * dt;
          state.y += state.vy * dt;
          if (state.x <= EDGE_PADDING || state.x >= maxX) {
            state.x = clamp(state.x, EDGE_PADDING, maxX);
            state.vx *= -BOUNCE_DAMPING;
          }
          if (state.y <= EDGE_PADDING || state.y >= maxY) {
            state.y = clamp(state.y, EDGE_PADDING, maxY);
            state.vy *= -BOUNCE_DAMPING;
          }
        });
        resolveOverlap(statesRef.current[0], statesRef.current[1]);
        statesRef.current.forEach((state) => {
          state.x = clamp(state.x, EDGE_PADDING, maxX);
          state.y = clamp(state.y, EDGE_PADDING, maxY);
        });
        statesRef.current.forEach((state, index) => {
          const node = bubbleRefs.current[index];
          if (node) node.style.transform = `translate3d(${state.x}px, ${state.y}px, 0)`;
        });
        shakeRef.current.x *= Math.pow(0.42, dt * 10);
        shakeRef.current.y *= Math.pow(0.42, dt * 10);
      }
      rafId = window.requestAnimationFrame(render);
    };
    rafId = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    if (!supportsDeviceTilt()) return;
    let stopTilt = () => {};
    const activateTilt = async () => {
      if (motionReadyRef.current) return;
      const granted = await requestMotionPermissionIfNeeded();
      if (!granted) return;
      motionReadyRef.current = true;
      stopTilt = listenToDeviceTilt((vector) => {
        gravityRef.current = vector;
      });
    };

    const host = containerRef.current;
    const handlePointerDown = () => {
      void activateTilt();
    };
    if (host) host.addEventListener('pointerdown', handlePointerDown, { passive: true });
    void activateTilt();

    const handleMotion = (event: DeviceMotionEvent) => {
      const acceleration = event.accelerationIncludingGravity;
      if (!acceleration) return;
      const current = { x: acceleration.x ?? 0, y: acceleration.y ?? 0 };
      const previous = lastAccelRef.current;
      lastAccelRef.current = current;
      if (!previous) return;
      const dx = current.x - previous.x;
      const dy = current.y - previous.y;
      if (Math.hypot(dx, dy) < SHAKE_THRESHOLD) return;
      shakeRef.current.x = clamp(shakeRef.current.x + dx * SHAKE_GAIN, -0.9, 0.9);
      shakeRef.current.y = clamp(shakeRef.current.y + dy * SHAKE_GAIN, -0.9, 0.9);
    };
    window.addEventListener('devicemotion', handleMotion, { passive: true });

    return () => {
      if (host) host.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('devicemotion', handleMotion);
      stopTilt();
    };
  }, []);

  const setBubbleRef = useCallback((index: number) => (node: HTMLDivElement | null) => {
    bubbleRefs.current[index] = node;
  }, []);

  return { containerRef, setBubbleRef };
}
