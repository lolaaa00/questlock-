import { NextRequest, NextResponse } from "next/server";
import { buildState, authorizeUrl } from "@/lib/github-oauth";
import { identifyRequest, rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// POST { walletAddress } → { url }
// Frontend redirects the browser to `url`, GitHub bounces back to /callback.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const wallet = (body.walletAddress as string | undefined)?.toLowerCase();
    if (!wallet || !/^0x[a-f0-9]{40}$/.test(wallet)) {
      return NextResponse.json(
        { error: "Valid walletAddress required." },
        { status: 400 }
      );
    }

    const rl = rateLimit(identifyRequest(req, wallet), RATE_LIMITS.oauthStart);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests.", retryAfterMs: rl.retryAfterMs },
        { status: 429 }
      );
    }

    const state = buildState(wallet);
    const url = authorizeUrl(state);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[auth/github/start]", err);
    return NextResponse.json(
      { error: "Failed to start GitHub OAuth." },
      { status: 500 }
    );
  }
}
