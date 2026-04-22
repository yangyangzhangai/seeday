// DOC-DEPS: LLM.md -> src/store/README.md
const RETRY_DELAYS_MS = [1000, 3000];

/**
 * Runs fn() with up to 2 automatic retries on failure.
 * Logs an error to console if all attempts are exhausted.
 */
export async function withDbRetry(tag: string, fn: () => Promise<void>): Promise<boolean> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      await fn();
      return true;
    } catch (err) {
      if (attempt < RETRY_DELAYS_MS.length) {
        await new Promise(r => setTimeout(r, RETRY_DELAYS_MS[attempt]));
      } else {
        console.error(`[${tag}] Supabase write failed after retries`, err);
        return false;
      }
    }
  }

  return false;
}
