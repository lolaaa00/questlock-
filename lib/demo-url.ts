import { withRetry, isRetryableStatus } from "./retry";

export interface DemoUrlResult {
  passed: boolean;
  status?: number;
  reason?: string;
  attempts?: number;
}

const TIMEOUT_MS = 10_000;
const BLOCKED_PATTERNS = [
  /^localhost/i,
  /^127\./,
  /^0\.0\.0\.0/,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
];

export async function checkDemoUrl(url: string): Promise<DemoUrlResult> {
  if (!url || url.trim() === "") {
    return { passed: false, reason: "Demo URL is empty." };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { passed: false, reason: "Demo URL is not a valid URL." };
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { passed: false, reason: "Demo URL must use http or https." };
  }

  const hostname = parsed.hostname;
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(hostname)) {
      return { passed: false, reason: "Demo URL points to a private/local address." };
    }
  }

  let attempts = 0;

  // Retry transient failures (5xx, 429, network errors). One-shot for terminal
  // failures (4xx other than rate limit, abort, empty body).
  try {
    return await withRetry<DemoUrlResult>(
      async (attempt) => {
        attempts = attempt + 1;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        let res: Response;
        try {
          res = await fetch(url, {
            method: "GET",
            signal: controller.signal,
            redirect: "follow",
            headers: { "User-Agent": "QuestLock-Proof-Checker/1.0" },
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (res.status >= 400) {
          if (isRetryableStatus(res.status)) {
            throw Object.assign(new Error(`HTTP ${res.status}`), { httpStatus: res.status });
          }
          return {
            passed: false,
            status: res.status,
            reason: `Demo URL returned HTTP ${res.status}.`,
            attempts,
          };
        }

        const text = await res.text();
        if (!text || text.trim().length < 100) {
          return {
            passed: false,
            status: res.status,
            reason: "Demo URL loaded but page appears to be empty.",
            attempts,
          };
        }
        return { passed: true, status: res.status, attempts };
      },
      {
        retries: 2,
        baseDelayMs: 500,
        isRetryable: (err) => {
          if (err instanceof Error) {
            if (err.name === "AbortError") return true; // timeout — try again
            const status = (err as { httpStatus?: number }).httpStatus;
            if (typeof status === "number") return isRetryableStatus(status);
            return true; // network error
          }
          return false;
        },
      }
    );
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return { passed: false, reason: "Demo URL timed out after 10 seconds.", attempts };
    }
    const status = (err as { httpStatus?: number }).httpStatus;
    if (typeof status === "number") {
      return {
        passed: false,
        status,
        reason: `Demo URL returned HTTP ${status} after ${attempts} attempts.`,
        attempts,
      };
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { passed: false, reason: `Demo URL unreachable: ${msg}`, attempts };
  }
}
