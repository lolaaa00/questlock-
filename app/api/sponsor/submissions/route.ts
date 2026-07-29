// v1.2 — Sponsor's review queue: pending manual submissions on quests they
// sponsor. Sponsor wallet is sourced from `quests.sponsor_wallet`.
//
// Returns submissions that:
//   - belong to a quest where caller.wallet = quest.sponsor_wallet
//   - have proof_type != github_project (github is fully deterministic)
//   - have not yet been approved or rejected onchain
//     (no tx_hash_approval, status in SUBMITTED / SCORED / FAILED for manual flows)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeBigInt } from "@/lib/bigint";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet")?.toLowerCase();
  if (!wallet || !/^0x[a-f0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ error: "Valid wallet required." }, { status: 400 });
  }
  const questIdFilter = req.nextUrl.searchParams.get("quest_id") || undefined;

  const items = await prisma.submission.findMany({
    where: {
      tx_hash_approval: null,
      proof_type: { not: "github_project" },
      quest: {
        sponsor_wallet: wallet,
        ...(questIdFilter ? { id: questIdFilter } : {}),
      },
    },
    orderBy: { created_at: "desc" },
    take: 100,
    include: {
      quest: { select: { id: true, title: true, proof_type: true, badge_id: true, min_score: true } },
    },
  });
  return NextResponse.json(serializeBigInt(items));
}
