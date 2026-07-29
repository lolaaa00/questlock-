import { rateLimit } from "../../lib/rate-limit";

describe("rate-limit", () => {
  test("allows up to max within window", () => {
    const cfg = { windowMs: 1000, max: 3, scope: "test-a" };
    expect(rateLimit("u1", cfg).allowed).toBe(true);
    expect(rateLimit("u1", cfg).allowed).toBe(true);
    expect(rateLimit("u1", cfg).allowed).toBe(true);
  });

  test("blocks after max", () => {
    const cfg = { windowMs: 1000, max: 2, scope: "test-b" };
    rateLimit("u2", cfg);
    rateLimit("u2", cfg);
    const r = rateLimit("u2", cfg);
    expect(r.allowed).toBe(false);
    expect(r.retryAfterMs).toBeGreaterThan(0);
  });

  test("separate identifiers have independent buckets", () => {
    const cfg = { windowMs: 1000, max: 1, scope: "test-c" };
    expect(rateLimit("u3", cfg).allowed).toBe(true);
    expect(rateLimit("u4", cfg).allowed).toBe(true);
  });

  test("separate scopes have independent buckets", () => {
    const cfgA = { windowMs: 1000, max: 1, scope: "test-d-a" };
    const cfgB = { windowMs: 1000, max: 1, scope: "test-d-b" };
    expect(rateLimit("u5", cfgA).allowed).toBe(true);
    expect(rateLimit("u5", cfgB).allowed).toBe(true);
  });
});
