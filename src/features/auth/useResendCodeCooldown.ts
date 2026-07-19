// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/auth/README.md
import React from 'react';

export const RESEND_CODE_COOLDOWN_SECONDS = 60;

export function getResendCooldownRemaining(deadlineMs: number, nowMs = Date.now()): number {
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
}

export function useResendCodeCooldown() {
  const [deadlineMs, setDeadlineMs] = React.useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = React.useState(0);

  React.useEffect(() => {
    if (deadlineMs === null) return;

    const updateRemaining = () => {
      const remaining = getResendCooldownRemaining(deadlineMs);
      setRemainingSeconds(remaining);
      if (remaining === 0) setDeadlineMs(null);
    };

    updateRemaining();
    const timerId = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timerId);
  }, [deadlineMs]);

  const start = React.useCallback(() => {
    setDeadlineMs(Date.now() + RESEND_CODE_COOLDOWN_SECONDS * 1000);
    setRemainingSeconds(RESEND_CODE_COOLDOWN_SECONDS);
  }, []);

  const reset = React.useCallback(() => {
    setDeadlineMs(null);
    setRemainingSeconds(0);
  }, []);

  return {
    isCoolingDown: remainingSeconds > 0,
    remainingSeconds,
    start,
    reset,
  };
}
