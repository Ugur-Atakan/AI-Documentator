export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

function parseRetryAfterMs(errorMessage: string): number | null {
  // Gemini: "Please retry in 9.381487337s."
  const match = errorMessage.match(/retry in ([\d.]+)s/i);
  if (match) {
    return Math.ceil(parseFloat(match[1]) * 1000) + 500; // +500ms buffer
  }
  return null;
}

function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("exceeded")
  );
}

function isRetryableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    isRateLimitError(err) ||
    msg.includes("503") ||
    msg.includes("502") ||
    msg.includes("500") ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("timeout") ||
    msg.includes("ECONNRESET") ||
    msg.includes("ENOTFOUND")
  );
}

export async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxAttempts = 5, baseDelayMs = 2000, maxDelayMs = 60000 } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);

      if (!isRetryableError(err)) {
        // Non-retryable: fail immediately
        throw err;
      }

      if (attempt === maxAttempts) break;

      // Determine wait time
      let waitMs: number;
      if (isRateLimitError(err)) {
        waitMs = parseRetryAfterMs(msg) ?? Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      } else {
        // Exponential backoff with jitter for other errors
        const base = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
        waitMs = base + Math.random() * 1000;
      }

      await new Promise((r) => setTimeout(r, waitMs));
    }
  }

  throw lastError;
}
