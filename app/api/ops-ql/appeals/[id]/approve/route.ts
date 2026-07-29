import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { approveAppealOnchain } from "@/lib/appeal-approve";
import { log } from "@/lib/logger";

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
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.submissionAppeal.findUnique({
    where: { id },
    include: {
      submission: {
        include: {
          quest: true,
        },
      },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (!["PENDING", "APPROVE_FAILED"].includes(existing.status)) {
    return NextResponse.json(
      { error: `Cannot approve in status ${existing.status}` },
      { status: 400 }
    );
  }

  const submission = existing.submission;
  const quest = submission.quest;
  // v1.2: route to V1 or V2 contract by quest.contract_version
  const isV2 = quest.contract_version === 2;
  const onchainQid = isV2 ? quest.funded_quest_id : quest.onchain_quest_id;
  if (!onchainQid) {
    return NextResponse.json(
      { error: "Quest has no onchain id; cannot approve onchain." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const notes = body.notes ? String(body.notes).slice(0, 1000) : null;
  const adminWallet = req.headers.get("x-wallet-address") || null;

  // Move to PROCESSING so concurrent clicks cannot double-fire onchain.
  await prisma.submissionAppeal.update({
    where: { id },
    data: { status: "PROCESSING", approve_error: null },
  });

  try {
    const result = await approveAppealOnchain({
      questOnchainId: onchainQid,
      questMinScore: quest.min_score,
      walletAddress: submission.wallet_address as `0x${string}`,
      repoUrl: submission.repo_url,
      demoUrl: submission.demo_url,
      score: submission.score ?? 0,
      existingProofHash: submission.proof_hash,
      questDbId: quest.id,
      contractVersion: (isV2 ? 2 : 1) as 1 | 2,
    });

    // Update the underlying submission so /me, /proof/[id], and the admin
    // submission view all reflect the manual approval.
    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: "APPROVED_ONCHAIN",
        proof_hash: result.proofHashUsed,
        eas_attestation_uid: result.attestationUid,
        tx_hash_approval: result.txHashApproval,
        risk_band: "MANUAL_REVIEW",
      },
    });

    await prisma.submissionAppeal.update({
      where: { id },
      data: {
        status: "APPROVED",
        admin_notes: notes,
        attestation_uid: result.attestationUid,
        tx_hash_approval: result.txHashApproval,
        reviewed_by: adminWallet,
        reviewed_at: new Date(),
      },
    });

    await log("info", "ops-ql/appeals", "Appeal approved onchain", {
      id,
      submissionId: submission.id,
      txHash: result.txHashApproval,
    });

    return NextResponse.json({
      id,
      status: "APPROVED",
      submissionId: submission.id,
      attestationUid: result.attestationUid,
      txHashApproval: result.txHashApproval,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.submissionAppeal.update({
      where: { id },
      data: { status: "APPROVE_FAILED", approve_error: message },
    });
    await log("error", "ops-ql/appeals", "Appeal approve failed", { id, message });
    return NextResponse.json(
      { error: "Appeal approval failed.", detail: message },
      { status: 500 }
    );
  }
}
