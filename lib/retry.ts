// Tiny exponential-backoff retry helper. Used by the GitHub fetcher and the
// demo-URL probe so a single transient 5xx or socket hangup does not nuke a
// real submission. Total wait is bounded by the sum of `delays`.

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  isRetryable?: (err: unknown, attempt: number) => boolean;
}

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const retries = opts.retries ?? 2;
  const baseDelay = opts.baseDelayMs ?? 400;
  const isRetryable =
    opts.isRetryable ?? (() => true); // by default everything is retryable

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !isRetryable(err, attempt)) {
        throw err;
      }
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  // unreachable
  throw lastErr;
}

// HTTP responses worth retrying: 408 timeout, 425 too early, 429 rate limit,
// 500/502/503/504 transient server errors.
export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599);
}
