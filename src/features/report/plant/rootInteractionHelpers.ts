// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
export const ROOT_LONG_PRESS_MS = 350;
export const MIN_ROOT_HIT_STROKE_WIDTH = 16;

export interface TimerLike {
  setTimeout: (handler: () => void, timeout: number) => number;
  clearTimeout: (id: number) => void;
}

interface LongPressController {
  start: () => void;
  cancel: () => void;
}

const browserTimer: TimerLike = {
  setTimeout: (handler, timeout) => globalThis.setTimeout(handler, timeout) as unknown as number,
  clearTimeout: id => globalThis.clearTimeout(id),
};

export function createLongPressController(
  onTrigger: () => void,
  timerApi: TimerLike = browserTimer,
  delayMs = ROOT_LONG_PRESS_MS,
): LongPressController {
  let timerId: number | null = null;

  const cancel = () => {
    if (timerId !== null) {
      timerApi.clearTimeout(timerId);
      timerId = null;
    }
  };

  const start = () => {
    cancel();
    timerId = timerApi.setTimeout(() => {
      timerId = null;
      onTrigger();
    }, delayMs);
  };

  return { start, cancel };
}

export function resolveRootHitStrokeWidth(visibleStrokeWidth: number): number {
  return Math.max(MIN_ROOT_HIT_STROKE_WIDTH, visibleStrokeWidth + 12);
}
