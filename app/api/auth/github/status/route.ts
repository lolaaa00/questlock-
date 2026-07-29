import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/auth/github/status?wallet=0x... → { connected, github_login, ... }
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet")?.toLowerCase();
  if (!wallet || !/^0x[a-f0-9]{40}$/.test(wallet)) {
    return NextResponse.json(
      { error: "Valid wallet query param required." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { wallet_address: wallet },
    select: {
      github_login: true,
      github_avatar_url: true,
      github_profile_url: true,
      github_connected_at: true,
    },
  });

  if (!user || !user.github_login) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    github_login: user.github_login,
    github_avatar_url: user.github_avatar_url,
    github_profile_url: user.github_profile_url,
    github_connected_at: user.github_connected_at,
  });
}
