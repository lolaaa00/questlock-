// In-process token bucket rate limiter.
// Best-effort only: state is held in module memory and is lost on server
// restart and on serverless cold start. For production durability, swap the
// store backend without changing the public API (allow/check signature).

import type { NextRequest } from "next/server";

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  // Optional namespace, e.g. "proof-submit", so different routes do not
  // collide when keyed by the same wallet.
  scope: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterMs?: number;
}

function purgeExpired(now: number) {
  // Cheap periodic cleanup: every call has a small chance of trimming.
  if (Math.random() > 0.02) return;
  for (const [k, b] of store.entries()) {
    if (b.resetAt <= now) store.delete(k);
  }
}

export function rateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  purgeExpired(now);

  const key = `${config.scope}:${identifier}`;
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    const bucket: Bucket = { count: 1, resetAt: now + config.windowMs };
    store.set(key, bucket);
    return {
      allowed: true,
      remaining: config.max - 1,
      resetAt: bucket.resetAt,
    };
  }

  if (existing.count >= config.max) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterMs: existing.resetAt - now,
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: config.max - existing.count,
    resetAt: existing.resetAt,
  };
}

// Pick a stable identifier for the caller. Priority:
// 1. Explicit override (e.g. wallet address from request body)
// 2. x-wallet-address header
// 3. IP-ish hint from common forwarded headers
// 4. literal "anonymous" — coarse but never crashes
export function identifyRequest(
  req: NextRequest,
  override?: string | null
): string {
  if (override && override.length > 0) return override.toLowerCase();
  const wallet = req.headers.get("x-wallet-address");
  if (wallet) return wallet.toLowerCase();
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "anonymous";
}

// Common config presets used across routes.
export const RATE_LIMITS = {
  proofSubmit: { windowMs: 60_000, max: 3, scope: "proof-submit" },
  relayClaim: { windowMs: 60_000, max: 5, scope: "relay-claim" },
  appeals: { windowMs: 60_000, max: 2, scope: "appeals" },
  oauthStart: { windowMs: 60_000, max: 5, scope: "oauth-start" },
  oauthCallback: { windowMs: 60_000, max: 10, scope: "oauth-callback" },
  discordOauthStart: { windowMs: 60_000, max: 5, scope: "discord-oauth-start" },
  discordOauthCallback: { windowMs: 60_000, max: 10, scope: "discord-oauth-callback" },
  questRequest: { windowMs: 60_000, max: 3, scope: "quest-request-create" },
  manualProofSubmit: { windowMs: 60_000, max: 3, scope: "manual-proof-submit" },
  xProofSubmit: { windowMs: 60_000, max: 3, scope: "x-proof-submit" },
  lmsProofSubmit: { windowMs: 60_000, max: 3, scope: "lms-proof-submit" },
} as const;

// ----------------------------------------------------------------- //
// Durable, Supabase-backed rate limit. Same return shape as the
// in-process limiter. Falls back to in-process on DB error so a
// transient DB blip never locks users out.
// ----------------------------------------------------------------- //
export async function rateLimitDurable(
  identifier: string, config: RateLimitConfig
): Promise<RateLimitResult> {
  try {
    // Lazy import so adding the durable path doesn't require Prisma in code
    // paths that don't need it (tests, edge runtime).
    const { prisma } = await import("./prisma");
    const now = new Date();
    const windowSecs = Math.floor(config.windowMs / 1000);
    // Window start = floor of current time to windowMs boundary.
    const windowStartMs = Math.floor(now.getTime() / config.windowMs) * config.windowMs;
    const windowStart = new Date(windowStartMs);
    const resetAt = windowStartMs + config.windowMs;

    const key = `${config.scope}:${identifier}`;
    // Upsert the bucket atomically (composite unique key).
    const bucket = await prisma.rateLimitBucket.upsert({
      where: { key_route_window_start: { key, route: config.scope, window_start: windowStart } },
      update: { count: { increment: 1 } },
      create: {
        key, route: config.scope, window_start: windowStart,
        window_seconds: windowSecs, count: 1, limit: config.max,
      },
    });

    if (bucket.count > config.max) {
      return { allowed: false, remaining: 0, resetAt, retryAfterMs: resetAt - now.getTime() };
    }
    return { allowed: true, remaining: config.max - bucket.count, resetAt };
  } catch {
    // DB unreachable — fall back to in-process best-effort.
    return rateLimit(identifier, config);
  }
}
