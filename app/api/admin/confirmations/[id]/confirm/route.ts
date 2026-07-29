// v1.2.1 — Admin confirms a sponsor's pending approval. Fires onchain via
// the verifier + EAS attestation, then bumps the sponsor's confirmed-approval
// counter (and promotes to trusted on threshold).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { approveAppealOnchain } from "@/lib/appeal-approve";
import { log } from "@/lib/logger";
import { recordAdminConfirmedApproval, SUBMISSION_STATUS } from "@/lib/sponsor-trust";

function isAdmin(req: NextRequest): boolean {
  const adminWallet = process.env.ADMIN_WALLET_ADDRESS?.toLowerCase();
  const caller = req.headers.get("x-wallet-address")?.toLowerCase();
  return Boolean(adminWallet && caller && adminWallet === caller);
}

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const { id } = await params;
  const sub = await prisma.submission.findUnique({
    where: { id }, include: { quest: true },
  });
  if (!sub) return NextResponse.json({ error: "Submission not found." }, { status: 404 });

  if (sub.tx_hash_approval) {
    return NextResponse.json({
      ok: true, skipped: true,
      reason: "Already approved onchain.", tx: sub.tx_hash_approval,
    });
  }
  if (sub.status !== SUBMISSION_STATUS.SPONSOR_APPROVED_PENDING_ADMIN) {
    return NextResponse.json({
      error: `Not awaiting admin confirmation (current status: ${sub.status}).`,
    }, { status: 400 });
  }
  if (sub.quest.onchain_quest_id === null && sub.quest.funded_quest_id === null) {
    return NextResponse.json({ error: "Quest has no onchain id." }, { status: 400 });
  }

  try {
    const onchainQuestId = sub.quest.contract_version === 2
      ? sub.quest.funded_quest_id!
      : sub.quest.onchain_quest_id!;

    const result = await approveAppealOnchain({
      questOnchainId: onchainQuestId,
      questMinScore: sub.quest.min_score,
      walletAddress: sub.wallet_address as `0x${string}`,
      repoUrl: sub.repo_url,
      demoUrl: sub.demo_url,
      score: Math.max(sub.score ?? 0, sub.quest.min_score),
      existingProofHash: sub.proof_hash,
      questDbId: sub.quest.id,
      contractVersion: (sub.quest.contract_version === 2 ? 2 : 1) as 1 | 2,
    });

    await prisma.submission.update({
      where: { id: sub.id },
      data: {
        proof_hash: result.proofHashUsed,
        eas_attestation_uid: result.attestationUid,
        tx_hash_approval: result.txHashApproval,
        risk_band: "MANUAL_REVIEW",
        status: "APPROVED_ONCHAIN",
        score: sub.score ?? sub.quest.min_score,
      },
    });

    // Trust counter bump (and possible promotion).
    let trustUpdate: { newCount: number; promoted: boolean } | null = null;
    if (sub.quest.sponsor_wallet) {
      trustUpdate = await recordAdminConfirmedApproval(sub.quest.sponsor_wallet);
    }

    await log("info", "admin.confirmations.confirm", "Admin confirmed sponsor approval", {
      submissionId: sub.id, sponsor: sub.quest.sponsor_wallet,
      tx: result.txHashApproval, trustUpdate,
    });

    return NextResponse.json({
      ok: true, tx: result.txHashApproval, uid: result.attestationUid,
      sponsor_trust: trustUpdate,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await log("error", "admin.confirmations.confirm", "Confirm failed", {
      submissionId: sub.id, error: message,
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
