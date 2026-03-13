export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Called before each retry attempt with attempt number and wait time */
  onRetry?: (attempt: number, waitMs: number, error: string) => void;
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
  const { maxAttempts = 5, baseDelayMs = 2000, maxDelayMs = 60000, onRetry } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Check circuit breaker before attempting
      if (circuitBreaker.isOpen()) {
        const cooldownMs = circuitBreaker.getCooldownMs();
        if (onRetry) {
          onRetry(attempt, cooldownMs, "Circuit breaker open — cooling down");
        }
        await new Promise((r) => setTimeout(r, cooldownMs));
      }

      const result = await fn();
      circuitBreaker.recordSuccess();
      return result;
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);

      if (!isRetryableError(err)) {
        // Non-retryable: fail immediately
        circuitBreaker.recordFailure();
        throw err;
      }

      circuitBreaker.recordFailure();

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

      if (onRetry) {
        onRetry(attempt, waitMs, msg.slice(0, 100));
      }

      await new Promise((r) => setTimeout(r, waitMs));
    }
  }

  throw lastError;
}

/**
 * Circuit breaker: pauses all tasks for a cooldown period
 * after consecutive failures to prevent hammering a failing API.
 */
class CircuitBreaker {
  private consecutiveFailures = 0;
  private readonly threshold = 3;
  private readonly cooldownMs = 30_000;
  private openUntil = 0;

  isOpen(): boolean {
    return Date.now() < this.openUntil;
  }

  getCooldownMs(): number {
    const remaining = this.openUntil - Date.now();
    return Math.max(0, remaining);
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
  }

  recordFailure(): void {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.threshold) {
      this.openUntil = Date.now() + this.cooldownMs;
      this.consecutiveFailures = 0;
    }
  }

  reset(): void {
    this.consecutiveFailures = 0;
    this.openUntil = 0;
  }
}

export const circuitBreaker = new CircuitBreaker();
