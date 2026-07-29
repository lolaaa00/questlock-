import { NextRequest, NextResponse } from "next/server";
import { buildDiscordState, discordAuthorizeUrl } from "@/lib/discord-oauth";
import { identifyRequest, rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const wallet = (body.walletAddress as string | undefined)?.toLowerCase();
    if (!wallet || !/^0x[a-f0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: "Valid walletAddress required." }, { status: 400 });
    }
    const rl = rateLimit(identifyRequest(req, wallet), RATE_LIMITS.discordOauthStart);
    if (!rl.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    const state = buildDiscordState(wallet);
    return NextResponse.json({ url: discordAuthorizeUrl(state) });
  } catch (err) {
    console.error("[auth/discord/start]", err);
    return NextResponse.json({ error: "Failed to start Discord OAuth." }, { status: 500 });
  }
}
