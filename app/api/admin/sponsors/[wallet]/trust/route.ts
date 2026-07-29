// v1.2.1 — Admin sets a sponsor's trust level. Admin-only.
// POST body: { level: "new" | "trusted" | "flagged" | "suspended" }
// GET returns current trust state.

import { NextRequest, NextResponse } from "next/server";
import { getSponsorTrust, setSponsorTrustLevel, type SponsorTrustLevel } from "@/lib/sponsor-trust";
import { log } from "@/lib/logger";

function isAdmin(req: NextRequest): boolean {
  const adminWallet = process.env.ADMIN_WALLET_ADDRESS?.toLowerCase();
  const caller = req.headers.get("x-wallet-address")?.toLowerCase();
  return Boolean(adminWallet && caller && adminWallet === caller);
}

export const dynamic = "force-dynamic";

const ALLOWED: SponsorTrustLevel[] = ["new", "trusted", "flagged", "suspended"];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const { wallet } = await params;
  if (!/^0x[a-f0-9]{40}$/i.test(wallet)) {
    return NextResponse.json({ error: "Invalid wallet." }, { status: 400 });
  }
  return NextResponse.json(await getSponsorTrust(wallet));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const { wallet } = await params;
  if (!/^0x[a-f0-9]{40}$/i.test(wallet)) {
    return NextResponse.json({ error: "Invalid wallet." }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  const level = body.level as string | undefined;
  if (!level || !ALLOWED.includes(level as SponsorTrustLevel)) {
    return NextResponse.json({
      error: `level must be one of: ${ALLOWED.join(", ")}`,
    }, { status: 400 });
  }
  await setSponsorTrustLevel(wallet, level as SponsorTrustLevel);
  await log("info", "admin.sponsors.trust", "Sponsor trust level changed", {
    wallet: wallet.toLowerCase(), level,
  });
  return NextResponse.json(await getSponsorTrust(wallet));
}
