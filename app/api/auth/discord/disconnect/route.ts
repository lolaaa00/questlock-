import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const wallet = (body.walletAddress as string | undefined)?.toLowerCase();
    if (!wallet || !/^0x[a-f0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: "Valid walletAddress required." }, { status: 400 });
    }
    const dc = await prisma.discordConnection.findUnique({ where: { wallet_address: wallet } });
    if (!dc) return NextResponse.json({ ok: true, alreadyDisconnected: true });
    await prisma.discordConnection.update({
      where: { wallet_address: wallet },
      data: { revoked_at: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[auth/discord/disconnect]", err);
    return NextResponse.json({ error: "Failed to disconnect." }, { status: 500 });
  }
}
