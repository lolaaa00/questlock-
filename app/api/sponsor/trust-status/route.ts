// v1.2.1 — Sponsor self-check of their own trust tier.
import { NextRequest, NextResponse } from "next/server";
import { getSponsorTrust } from "@/lib/sponsor-trust";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet")?.toLowerCase();
  if (!wallet || !/^0x[a-f0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ error: "Valid wallet required." }, { status: 400 });
  }
  const trust = await getSponsorTrust(wallet);
  return NextResponse.json(trust);
}
