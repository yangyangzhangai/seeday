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
const MAX_SPEED = 165;
const AIR_DRAG = 0.988;
const BOUNCE_DAMPING = 0.82;
const DRIFT_STRENGTH = 24;
const GRAVITY_STRENGTH = 250;
const SHAKE_GAIN = 0.028;
const SHAKE_THRESHOLD = 1.7;

interface BubblePhysicsState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  phaseSpeed: number;
}

export interface BubbleMotionController {
  containerRef: React.RefObject<HTMLDivElement>;
  setBubbleRef: (index: number) => (node: HTMLDivElement | null) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function useBubbleMotionController(): BubbleMotionController {
  const containerRef = useRef<HTMLDivElement>(null);
  const bubbleRefs = useRef<Array<HTMLDivElement | null>>([null, null]);
  const areaRef = useRef({ width: 0, height: 0 });
  const gravityRef = useRef<TiltVector>({ x: 0, y: 0 });
  const shakeRef = useRef({ x: 0, y: 0 });
  const lastAccelRef = useRef<TiltVector | null>(null);
  const statesRef = useRef<BubblePhysicsState[]>([
    { x: 28, y: 16, vx: 20, vy: -10, phase: 0.2, phaseSpeed: 0.84 },
    { x: 170, y: 72, vx: -18, vy: 12, phase: 2.4, phaseSpeed: 0.72 },
  ]);
  const motionReadyRef = useRef(false);

  const updateArea = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    areaRef.current = { width: el.clientWidth, height: el.clientHeight };
    const maxX = Math.max(EDGE_PADDING, areaRef.current.width - BUBBLE_SIZE - EDGE_PADDING);
    const maxY = Math.max(EDGE_PADDING, areaRef.current.height - BUBBLE_SIZE - EDGE_PADDING);
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
          state.phase += state.phaseSpeed * dt;
          const driftX = Math.cos(state.phase + index * 0.8) * DRIFT_STRENGTH;
          const driftY = Math.sin(state.phase * 0.9 + index) * DRIFT_STRENGTH;
          const ax = driftX + gravityRef.current.x * GRAVITY_STRENGTH + shakeRef.current.x * 430;
          const ay = driftY + gravityRef.current.y * GRAVITY_STRENGTH + shakeRef.current.y * 430 - 6;
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
