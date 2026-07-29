import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";

// POST /api/auth/github/disconnect
// Body: { walletAddress }
// The user is asking to disconnect their own GitHub. Privy ensures the
// wallet is the caller's by virtue of being signed-in client-side; we trust
// the wallet supplied here for v1.1 (same model as the rest of the app).
// A signed-message check can be layered on later if needed.
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

    const user = await prisma.user.findUnique({
      where: { wallet_address: wallet },
      select: { github_login: true },
    });
    if (!user || !user.github_login) {
      return NextResponse.json({ ok: true, alreadyDisconnected: true });
    }

    await prisma.user.update({
      where: { wallet_address: wallet },
      data: {
        github_id: null,
        github_login: null,
        github_avatar_url: null,
        github_profile_url: null,
        github_connected_at: null,
      },
    });

    await log("info", "auth/github/disconnect", "GitHub unlinked", {
      wallet,
      login: user.github_login,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[auth/github/disconnect]", err);
    return NextResponse.json(
      { error: "Failed to disconnect GitHub." },
      { status: 500 }
    );
  }
}
