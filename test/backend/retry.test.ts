import { isRetryableStatus, withRetry } from "../../lib/retry";

describe("retry", () => {
  test("isRetryableStatus covers 5xx, 429, 408, 425", () => {
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(502)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(504)).toBe(true);
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(408)).toBe(true);
    expect(isRetryableStatus(425)).toBe(true);
    expect(isRetryableStatus(404)).toBe(false);
    expect(isRetryableStatus(403)).toBe(false);
    expect(isRetryableStatus(200)).toBe(false);
  });

  test("withRetry returns first success", async () => {
    const fn = jest.fn().mockResolvedValueOnce("ok");
    const out = await withRetry(fn, { retries: 2, baseDelayMs: 1 });
    expect(out).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("withRetry retries until success", async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts < 3) throw new Error("boom");
      return "done";
    };
    const out = await withRetry(fn, { retries: 5, baseDelayMs: 1 });
    expect(out).toBe("done");
    expect(attempts).toBe(3);
  });

  test("withRetry rethrows after exhausting retries", async () => {
    const err = new Error("permanently broken");
    await expect(
      withRetry(async () => { throw err; }, { retries: 2, baseDelayMs: 1 })
    ).rejects.toThrow("permanently broken");
  });

  test("withRetry honours isRetryable", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("bad"));
    await expect(
      withRetry(fn, { retries: 5, baseDelayMs: 1, isRetryable: () => false })
    ).rejects.toThrow("bad");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
