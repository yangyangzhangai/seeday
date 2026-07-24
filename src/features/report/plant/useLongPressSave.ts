// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import type React from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { triggerHaptic } from '../../../lib/haptics';

const LONG_PRESS_DELAY_MS = 650;
const MOVE_TOLERANCE_PX = 10;

interface UseLongPressSaveOptions {
  enabled: boolean;
  onSave: () => void | Promise<void>;
}

export function useLongPressSave({ enabled, onSave }: UseLongPressSaveOptions) {
  const timerRef = useRef<number | null>(null);
  const originRef = useRef({ x: 0, y: 0 });
  const armedRef = useRef(false);
  const triggeredRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current === null) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const cancel = useCallback(() => {
    clearTimer();
    armedRef.current = false;
    triggeredRef.current = false;
  }, [clearTimer]);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (!enabled || event.button !== 0 || target.closest('button')) {
      cancel();
      return;
    }
    clearTimer();
    originRef.current = { x: event.clientX, y: event.clientY };
    armedRef.current = true;
    triggeredRef.current = false;
    timerRef.current = window.setTimeout(() => {
      if (!armedRef.current) return;
      triggeredRef.current = true;
      triggerHaptic('medium');
    }, LONG_PRESS_DELAY_MS);
  }, [cancel, clearTimer, enabled]);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!armedRef.current) return;
    const dx = event.clientX - originRef.current.x;
    const dy = event.clientY - originRef.current.y;
    if (Math.hypot(dx, dy) <= MOVE_TOLERANCE_PX) return;
    cancel();
  }, [cancel]);

  const onPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    clearTimer();
    armedRef.current = false;
    if (!triggeredRef.current) return;
    event.preventDefault();
    void onSave();
  }, [clearTimer, onSave]);

  const onClickCapture = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!triggeredRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    triggeredRef.current = false;
  }, []);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: cancel,
    onClickCapture,
    onContextMenu: (event: React.MouseEvent<HTMLDivElement>) => {
      if (enabled) event.preventDefault();
    },
    onDragStart: (event: React.DragEvent<HTMLDivElement>) => {
      if (enabled) event.preventDefault();
    },
  };
}
