// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/auth/README.md
import { describe, expect, it } from 'vitest';
import { getResendCooldownRemaining } from './useResendCodeCooldown';

describe('getResendCooldownRemaining', () => {
  it('rounds partial seconds up for the visible countdown', () => {
    expect(getResendCooldownRemaining(60_000, 1)).toBe(60);
  });

  it('returns zero after the cooldown expires', () => {
    expect(getResendCooldownRemaining(60_000, 60_001)).toBe(0);
  });
});
