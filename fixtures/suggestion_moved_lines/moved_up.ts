// moved_up: retry helper used by the sync worker.

export interface RetryOptions {
  attempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}


export const defaultRetryOptions: RetryOptions = {
  attempts: 3,
  baseDelayMs: 200,
  maxDelayMs: 5_000,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function backoffDelay(attempt: number, options: RetryOptions) {
  const exponential = options.baseDelayMs * 2 ** attempt;
  return Math.min(exponential, options.maxDelayMs);
}

export function isRetryable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /timeout|ECONNRESET|429|503/.test(error.message);
}

export async function withRetry<T>(
  run: () => Promise<T>,
  options: RetryOptions = defaultRetryOptions
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < options.attempts; attempt++) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (!isRetryable(error)) throw error;
      await sleep(backoffDelay(attempt, options));
    }
  }
  throw lastError;
}

export function describeRetry(options: RetryOptions): string {
  const { attempts, baseDelayMs, maxDelayMs } = options;
  return `${attempts} attempts, ${baseDelayMs}ms to ${maxDelayMs}ms`;
}

export function totalBudgetMs(options: RetryOptions): number {
  let total = 0;
  for (let attempt = 0; attempt < options.attempts; attempt++) {
    total += backoffDelay(attempt, options);
  }
  return total;
}
