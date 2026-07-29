// v1.2.1 — Admin queue of submissions awaiting confirmation after a sponsor
// approved them. Admin reviews, then confirms (fires onchain) or rejects
// (overrides the sponsor).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeBigInt } from "@/lib/bigint";
import { SUBMISSION_STATUS, getSponsorTrust } from "@/lib/sponsor-trust";

function isAdmin(req: NextRequest): boolean {
  const adminWallet = process.env.ADMIN_WALLET_ADDRESS?.toLowerCase();
  const caller = req.headers.get("x-wallet-address")?.toLowerCase();
  return Boolean(adminWallet && caller && adminWallet === caller);
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const items = await prisma.submission.findMany({
    where: { status: SUBMISSION_STATUS.SPONSOR_APPROVED_PENDING_ADMIN },
    orderBy: { updated_at: "desc" },
    take: 100,
    include: {
      quest: {
        select: {
          id: true, title: true, proof_type: true, badge_id: true,
          min_score: true, reward_amount: true, max_claims: true,
          sponsor_wallet: true, contract_version: true,
        },
      },
    },
  });

  // Pull current trust state for each unique sponsor so the admin sees who
  // they're confirming for. Batched.
  const sponsors = Array.from(new Set(
    items.map((i) => i.quest.sponsor_wallet?.toLowerCase()).filter(Boolean) as string[]
  ));
  const trustMap = new Map<string, Awaited<ReturnType<typeof getSponsorTrust>>>();
  for (const w of sponsors) {
    trustMap.set(w, await getSponsorTrust(w));
  }

  const decorated = items.map((i) => ({
    ...i,
    sponsor_trust: i.quest.sponsor_wallet
      ? trustMap.get(i.quest.sponsor_wallet.toLowerCase()) ?? null
      : null,
  }));

  return NextResponse.json(serializeBigInt(decorated));
}
