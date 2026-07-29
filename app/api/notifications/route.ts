import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet")?.toLowerCase();
  if (!wallet || !/^0x[a-f0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ error: "Valid wallet required." }, { status: 400 });
  }
  const items = await prisma.notification.findMany({
    where: { wallet_address: wallet },
    orderBy: { created_at: "desc" }, take: 50,
  });
  const unread = await prisma.notification.count({
    where: { wallet_address: wallet, read_at: null },
  });
  return NextResponse.json({ unread, items });
}

export async function POST(req: NextRequest) {
  // Mark notifications as read. body: { walletAddress, id? }  — if id missing, mark all read.
  try {
    const body = await req.json();
    const wallet = (body.walletAddress as string | undefined)?.toLowerCase();
    if (!wallet || !/^0x[a-f0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: "Valid walletAddress required." }, { status: 400 });
    }
    const id = body.id as string | undefined;
    if (id) {
      await prisma.notification.updateMany({
        where: { id, wallet_address: wallet }, data: { read_at: new Date() },
      });
    } else {
      await prisma.notification.updateMany({
        where: { wallet_address: wallet, read_at: null }, data: { read_at: new Date() },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/notifications POST]", err);
    return NextResponse.json({ error: "Failed." }, { status: 500 });
  }
}
