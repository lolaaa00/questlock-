import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet")?.toLowerCase();
  if (!wallet || !/^0x[a-f0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ error: "Valid wallet required." }, { status: 400 });
  }
  const dc = await prisma.discordConnection.findUnique({ where: { wallet_address: wallet } });
  if (!dc || dc.revoked_at) return NextResponse.json({ connected: false });
  return NextResponse.json({
    connected: true,
    discord_username: dc.discord_username,
    discord_avatar_url: dc.discord_avatar_url,
    connected_at: dc.connected_at,
  });
}
