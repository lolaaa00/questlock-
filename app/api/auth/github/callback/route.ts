import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForUser, verifyState } from "@/lib/github-oauth";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import { identifyRequest, rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

// GET /api/auth/github/callback?code=...&state=...
// GitHub bounces here after the user authorises. We exchange the code for the
// GitHub identity, persist it on the wallet's user row, and redirect back to
// /me with a status query param. We never expose the access token.
export async function GET(req: NextRequest) {
  const appBase = getEnv("NEXT_PUBLIC_APP_URL") || "http://localhost:3000";

  const rl = rateLimit(identifyRequest(req, null), RATE_LIMITS.oauthCallback);
  if (!rl.allowed) {
    return NextResponse.redirect(`${appBase}/me?github=ratelimit`);
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(`${appBase}/me?github=missing_params`);
  }

  const payload = verifyState(state);
  if (!payload) {
    await log("warn", "auth/github/callback", "Invalid or expired state", {
      hadCode: Boolean(code),
    });
    return NextResponse.redirect(`${appBase}/me?github=invalid_state`);
  }

  let ghUser;
  try {
    ghUser = await exchangeCodeForUser(code);
  } catch (err) {
    await log("error", "auth/github/callback", "Token exchange failed", {
      error: err instanceof Error ? err.message : String(err),
      wallet: payload.wallet,
    });
    return NextResponse.redirect(`${appBase}/me?github=exchange_failed`);
  }

  try {
    // Disallow linking the same GitHub identity to multiple wallets.
    const conflict = await prisma.user.findFirst({
      where: {
        OR: [
          { github_id: String(ghUser.id) },
          { github_login: ghUser.login },
        ],
        NOT: { wallet_address: payload.wallet },
      },
      select: { wallet_address: true },
    });
    if (conflict) {
      return NextResponse.redirect(`${appBase}/me?github=already_linked`);
    }

    await prisma.user.upsert({
      where: { wallet_address: payload.wallet },
      update: {
        github_id: String(ghUser.id),
        github_login: ghUser.login,
        github_avatar_url: ghUser.avatar_url,
        github_profile_url: ghUser.html_url,
        github_connected_at: new Date(),
        // Keep the legacy free-text github_username in sync so it does not
        // drift from the linked login.
        github_username: ghUser.login,
      },
      create: {
        wallet_address: payload.wallet,
        github_id: String(ghUser.id),
        github_login: ghUser.login,
        github_avatar_url: ghUser.avatar_url,
        github_profile_url: ghUser.html_url,
        github_connected_at: new Date(),
        github_username: ghUser.login,
      },
    });

    await log("info", "auth/github/callback", "GitHub linked", {
      wallet: payload.wallet,
      login: ghUser.login,
    });

    return NextResponse.redirect(`${appBase}/me?github=linked`);
  } catch (err) {
    await log("error", "auth/github/callback", "Persistence failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.redirect(`${appBase}/me?github=server_error`);
  }
}
