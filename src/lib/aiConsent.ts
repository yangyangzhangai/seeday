// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/AI_USAGE_INVENTORY.md
import type { UserAccountState } from '../types/userAccountState.js';

export const AI_CONSENT_VERSION = '2026-07-31.v1';

export const AI_CONSENT_REQUIRED_EVENT = 'seeday:ai-consent-required';

export function hasCurrentAiConsent(
  state: Pick<UserAccountState, 'aiConsentStatus' | 'aiConsentVersion'> | null | undefined,
): boolean {
  return state?.aiConsentStatus === 'granted'
    && state.aiConsentVersion === AI_CONSENT_VERSION;
}

export function requestAiConsentReview(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(AI_CONSENT_REQUIRED_EVENT));
}
