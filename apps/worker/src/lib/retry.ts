/**
 * @module retry
 * Exponential backoff retry logic for database and API operations.
 * 
 * Used for:
 * - Chat message persistence (VideoRoom)
 * - Poll creation and voting (VideoRoom)
 * - Webhook processing (critical for payments)
 */

/**
 * Configuration for retry behavior.
 */
export interface RetryConfig {
  /** Maximum number of attempts (including the first try) */
  maxAttempts: number;
  /** Initial delay in milliseconds */
  initialDelayMs: number;
  /** Maximum delay in milliseconds (backoff caps at this value) */
  maxDelayMs: number;
  /** Multiplier for exponential backoff (default 2) */
  backoffMultiplier: number;
  /** Optional jitter (0-1) to randomize delays and avoid thundering herd */
  jitterFraction: number;
}

/**
 * Default retry configuration for transient failures.
 * - 3 attempts total
 * - 100ms initial, capping at 1s
 * - 20% jitter to spread retry load
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 1000,
  backoffMultiplier: 2,
  jitterFraction: 0.2,
};

/**
 * Calculate delay for a given attempt using exponential backoff with jitter.
 * 
 * @param attempt - Attempt number (0-indexed)
 * @param config - Retry configuration
 * @returns Delay in milliseconds before next attempt
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = Math.min(
    config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt),
    config.maxDelayMs,
  );

  const jitter = exponentialDelay * config.jitterFraction * Math.random();
  return exponentialDelay + jitter;
}

/**
 * Sleep helper for delays between retries.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff and jitter.
 * 
 * @example
 * ```typescript
 * const result = await retryAsync(
 *   () => db.insert(chatMessages).values({ ... }),
 *   { maxAttempts: 3 }
 * );
 * ```
 * 
 * @param fn - Async function to retry
 * @param config - Retry configuration (uses defaults if partial)
 * @returns Result of the function if successful
 * @throws Last error if all attempts fail
 */
export async function retryAsync<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < finalConfig.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < finalConfig.maxAttempts - 1) {
        const delayMs = calculateDelay(attempt, finalConfig);
        await sleep(delayMs);
      }
    }
  }

  throw lastError ?? new Error("Unknown retry error");
}

/**
 * Fire-and-forget retry wrapper for non-critical operations.
 * Logs errors but doesn't throw or block.
 * 
 * @example
 * ```typescript
 * // In VideoRoom.ts, after sending chat message to DO:
 * persistWithRetry(
 *   () => db.insert(chatMessages).values({ ... }),
 *   "chat_message"
 * );
 * ```
 * 
 * @param fn - Async function to retry
 * @param operationName - Name for logging
 * @param config - Retry configuration
 */
export function persistWithRetry(
  fn: () => Promise<void>,
  operationName: string,
  config: Partial<RetryConfig> = {},
): void {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };

  // Run retries sequentially without delay to avoid reliance on setTimeout,
  // which may not fire after Durable Object hibernation/eviction.
  const runWithRetries = async () => {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < finalConfig.maxAttempts; attempt++) {
      try {
        await fn();
        return; // Success
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(
          `[${operationName}] Attempt ${attempt + 1}/${finalConfig.maxAttempts} failed: ${lastError.message}`,
        );
      }
    }
    // All retries exhausted
    console.error(
      `[${operationName}] Persistence failed after ${finalConfig.maxAttempts} attempts: ${lastError?.message}`,
    );
    console.error(`[${operationName}] CRITICAL: Operation failed permanently. Manual intervention required.`, {
      operationName,
      attempts: finalConfig.maxAttempts,
      errorMessage: lastError?.message,
      timestamp: new Date().toISOString(),
    });
  };

  // Fire-and-forget: errors are fully handled inside runWithRetries via console.error.
  void runWithRetries();
}
