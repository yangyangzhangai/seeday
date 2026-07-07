// DOC-DEPS: LLM.md -> src/store/README.md
import { formatUserFacingDiagnostic, logDiagnostic } from './diagnostics';

const RETRY_DELAYS_MS = [1000, 3000];

/**
 * Runs fn() with up to 2 automatic retries on failure.
 * Logs an error to console if all attempts are exhausted.
 */
export async function withDbRetry(tag: string, fn: () => Promise<void>): Promise<boolean> {
  const startedAt = Date.now();
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const attemptStartedAt = Date.now();
    try {
      logDiagnostic('info', 'db_retry.attempt.start', {
        tag,
        attempt: attempt + 1,
        maxAttempts: RETRY_DELAYS_MS.length + 1,
      });
      await fn();
      logDiagnostic('info', 'db_retry.attempt.success', {
        tag,
        attempt: attempt + 1,
        elapsedMs: Date.now() - attemptStartedAt,
        totalElapsedMs: Date.now() - startedAt,
      });
      return true;
    } catch (err) {
      if (attempt < RETRY_DELAYS_MS.length) {
        logDiagnostic('warn', 'db_retry.attempt.failed_will_retry', {
          tag,
          attempt: attempt + 1,
          elapsedMs: Date.now() - attemptStartedAt,
          nextDelayMs: RETRY_DELAYS_MS[attempt],
          error: err,
          userFacing: formatUserFacingDiagnostic(`Supabase ${tag}`, err, {
            path: tag,
            elapsedMs: Date.now() - attemptStartedAt,
          }),
        });
        await new Promise(r => setTimeout(r, RETRY_DELAYS_MS[attempt]));
      } else {
        logDiagnostic('error', 'db_retry.failed_after_retries', {
          tag,
          attempt: attempt + 1,
          totalElapsedMs: Date.now() - startedAt,
          error: err,
          userFacing: formatUserFacingDiagnostic(`Supabase ${tag}`, err, {
            path: tag,
            elapsedMs: Date.now() - startedAt,
          }),
        });
        return false;
      }
    }
  }

  return false;
}
