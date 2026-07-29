// v1.2 — feeds the Admin Retry Centre. Returns up to 25 candidates per bucket.
//
//   needs_proof_recheck:  status=SUBMITTED|SCORED with score=null OR score<min_score for github_project
//   needs_attestation:    proof_hash IS NOT NULL AND eas_attestation_uid IS NULL
//   needs_onchain_approval: eas_attestation_uid IS NOT NULL AND tx_hash_approval IS NULL

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeBigInt } from "@/lib/bigint";

function isAdmin(req: NextRequest): boolean {
  const adminWallet = process.env.ADMIN_WALLET_ADDRESS?.toLowerCase();
  const caller = req.headers.get("x-wallet-address")?.toLowerCase();
  return Boolean(adminWallet && caller && adminWallet === caller);
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const [proofRecheck, attestation, approval, indexerEvent] = await Promise.all([
    prisma.submission.findMany({
      where: {
        proof_type: "github_project",
        status: { in: ["SUBMITTED", "SCORED", "REJECTED"] },
        OR: [{ score: null }, { score: { lt: 70 } }],
      },
      orderBy: { created_at: "desc" },
      take: 25,
      include: { quest: { select: { title: true, min_score: true } } },
    }),
    prisma.submission.findMany({
      where: { proof_hash: { not: null }, eas_attestation_uid: null },
      orderBy: { created_at: "desc" },
      take: 25,
      include: { quest: { select: { title: true } } },
    }),
    prisma.submission.findMany({
      where: { eas_attestation_uid: { not: null }, tx_hash_approval: null },
      orderBy: { created_at: "desc" },
      take: 25,
      include: { quest: { select: { title: true } } },
    }),
    prisma.contractEvent.findFirst({
      orderBy: { block_number: "desc" },
      select: { block_number: true, event_name: true, created_at: true },
    }),
  ]);

  return NextResponse.json(
    serializeBigInt({
      proof_recheck: proofRecheck,
      attestation,
      onchain_approval: approval,
      indexer: indexerEvent,
    })
  );
}
