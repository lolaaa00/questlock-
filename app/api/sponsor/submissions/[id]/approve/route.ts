// v1.2 — Sponsor approves their own quest's manual submission.
// v1.2.1 — Branching:
//   - Trusted sponsor + non-high-value quest → fire onchain immediately
//     (EAS attestation + verifier submitAndApprove). Same as v1.2.
//   - Otherwise → flip status to SPONSOR_APPROVED_PENDING_ADMIN and wait
//     for admin confirmation. Onchain firing happens in
//     /api/admin/confirmations/[id]/confirm.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { approveAppealOnchain } from "@/lib/appeal-approve";
import { log } from "@/lib/logger";
import {
  getSponsorTrust,
  decideApprovalRoute,
  SUBMISSION_STATUS,
} from "@/lib/sponsor-trust";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = req.headers.get("x-wallet-address")?.toLowerCase();
  if (!caller || !/^0x[a-f0-9]{40}$/.test(caller)) {
    return NextResponse.json({ error: "Connect a wallet." }, { status: 401 });
  }

  const { id } = await params;
  const sub = await prisma.submission.findUnique({
    where: { id },
    include: { quest: true },
  });
  if (!sub) return NextResponse.json({ error: "Submission not found." }, { status: 404 });

  const sponsor = sub.quest.sponsor_wallet?.toLowerCase();
  if (!sponsor || sponsor !== caller) {
    return NextResponse.json(
      { error: "Only the quest sponsor can approve submissions on this quest." },
      { status: 403 }
    );
  }

  if (sub.tx_hash_approval) {
    return NextResponse.json({
      ok: true, skipped: true,
      reason: "Submission already approved onchain.",
      tx: sub.tx_hash_approval,
    });
  }
  if (sub.status === SUBMISSION_STATUS.SPONSOR_APPROVED_PENDING_ADMIN) {
    return NextResponse.json({
      ok: true, skipped: true,
      reason: "Already awaiting admin confirmation.",
      route: "admin_confirm",
    });
  }
  if (sub.quest.onchain_quest_id === null && sub.quest.funded_quest_id === null) {
    return NextResponse.json(
      { error: "Quest has no onchain id — cannot approve." },
      { status: 400 }
    );
  }

  // --- v1.2.1 trust gate ---
  const trust = await getSponsorTrust(sponsor);
  if (trust.level === "suspended") {
    return NextResponse.json(
      { error: "Your sponsor account is suspended. Contact admin." },
      { status: 403 }
    );
  }
  const decision = decideApprovalRoute({ sponsor: trust, quest: sub.quest });

  // ---- Route A: admin confirmation required ----
  if (decision.route === "admin_confirm") {
    await prisma.submission.update({
      where: { id: sub.id },
      data: { status: SUBMISSION_STATUS.SPONSOR_APPROVED_PENDING_ADMIN },
    });
    await log("info", "sponsor.submissions.approve", "Routed to admin confirmation", {
      submissionId: sub.id, sponsor, reason: decision.reason, trust_level: trust.level,
    });
    return NextResponse.json({
      ok: true,
      route: "admin_confirm",
      reason: decision.reason,
      trust_level: trust.level,
      approvals_until_trusted: trust.approvals_until_trusted,
    });
  }

  // ---- Route B: fire onchain directly (trusted + standard-value) ----
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

    await log("info", "sponsor.submissions.approve", "Sponsor approved (direct)", {
      submissionId: sub.id, sponsor, tx: result.txHashApproval, trust_level: trust.level,
    });

    return NextResponse.json({
      ok: true,
      route: "onchain",
      tx: result.txHashApproval,
      uid: result.attestationUid,
      reason: decision.reason,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await log("error", "sponsor.submissions.approve", "Approval failed", {
      submissionId: sub.id, sponsor, error: message,
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
