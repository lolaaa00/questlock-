// v1.2 — set/clear a wallet's display name. Self-only (wallet must match body).
// No auth signature — testnet trust model: client supplies wallet, we upsert.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MAX_LEN = 40;

// Strip ASCII control characters (0x00-0x1F and 0x7F). Keep Unicode otherwise
// so emoji and non-Latin display names work fine.
function stripControlChars(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code >= 32 && code !== 127) out += s[i];
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const wallet = (body.walletAddress as string | undefined)?.toLowerCase();
    const raw = body.displayName as string | undefined;

    if (!wallet || !/^0x[a-f0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: "Valid walletAddress required." }, { status: 400 });
    }

    let display_name: string | null = null;
    if (typeof raw === "string") {
      const trimmed = raw.trim().slice(0, MAX_LEN);
      if (/^0x[a-f0-9]{40}$/i.test(trimmed)) {
        return NextResponse.json({ error: "Display name cannot be a wallet address." }, { status: 400 });
      }
      const cleaned = stripControlChars(trimmed);
      display_name = cleaned.length > 0 ? cleaned : null;
    }

    await prisma.user.upsert({
      where: { wallet_address: wallet },
      update: { display_name },
      create: { wallet_address: wallet, display_name },
    });

    return NextResponse.json({ ok: true, display_name });
  } catch (err) {
    console.error("[api/users/display-name]", err);
    return NextResponse.json({ error: "Failed to update display name." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet")?.toLowerCase();
  if (!wallet || !/^0x[a-f0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ error: "Valid wallet required." }, { status: 400 });
  }
  const u = await prisma.user.findUnique({
    where: { wallet_address: wallet },
    select: { display_name: true },
  });
  return NextResponse.json({ display_name: u?.display_name ?? null });
}
