export interface RetryOptions {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    /** Called before each retry attempt with attempt number and wait time */
    onRetry?: (attempt: number, waitMs: number, error: string) => void;
}
export declare function withRetry<T>(label: string, fn: () => Promise<T>, options?: RetryOptions): Promise<T>;
/**
 * Circuit breaker: pauses all tasks for a cooldown period
 * after consecutive failures to prevent hammering a failing API.
 */
declare class CircuitBreaker {
    private consecutiveFailures;
    private readonly threshold;
    private readonly cooldownMs;
    private openUntil;
    isOpen(): boolean;
    getCooldownMs(): number;
    recordSuccess(): void;
    recordFailure(): void;
    reset(): void;
}
export declare const circuitBreaker: CircuitBreaker;
export {};
