// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import { describe, expect, it, vi } from 'vitest';
import {
  createLongPressController,
  MIN_ROOT_HIT_STROKE_WIDTH,
  ROOT_LONG_PRESS_MS,
  resolveRootHitStrokeWidth,
} from './rootInteractionHelpers';

describe('rootInteractionHelpers', () => {
  it('triggers selection when long-press reaches threshold', () => {
    vi.useFakeTimers();
    const onTrigger = vi.fn();
    const controller = createLongPressController(onTrigger);

    controller.start();
    vi.advanceTimersByTime(ROOT_LONG_PRESS_MS + 1);

    expect(onTrigger).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('does not trigger selection when press is cancelled before threshold', () => {
    vi.useFakeTimers();
    const onTrigger = vi.fn();
    const controller = createLongPressController(onTrigger);

    controller.start();
    vi.advanceTimersByTime(ROOT_LONG_PRESS_MS - 50);
    controller.cancel();
    vi.advanceTimersByTime(100);

    expect(onTrigger).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('resets timer when a new press starts', () => {
    vi.useFakeTimers();
    const onTrigger = vi.fn();
    const controller = createLongPressController(onTrigger);

    controller.start();
    vi.advanceTimersByTime(ROOT_LONG_PRESS_MS - 120);
    controller.start();
    vi.advanceTimersByTime(ROOT_LONG_PRESS_MS - 40);
    expect(onTrigger).not.toHaveBeenCalled();

    vi.advanceTimersByTime(41);
    expect(onTrigger).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('enlarges root hit area to avoid missed taps on thin segments', () => {
    expect(resolveRootHitStrokeWidth(2.5)).toBe(MIN_ROOT_HIT_STROKE_WIDTH);
    expect(resolveRootHitStrokeWidth(8)).toBe(20);
  });
});
