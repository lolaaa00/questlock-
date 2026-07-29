// v1.2 — Admin Retry Centre endpoint.
//
// Supports four retry operations, all admin-gated by ADMIN_WALLET_ADDRESS:
//   POST /api/admin/retry/indexer        body: {}                     → re-run event indexer
//   POST /api/admin/retry/proof-check    body: { submissionId }       → re-run github_project proof check
//   POST /api/admin/retry/attestation    body: { submissionId }       → re-attest a submission that has no EAS uid
//   POST /api/admin/retry/onchain-approval body: { submissionId }     → re-run submitAndApprove for an attested submission
//
// All operations are idempotent enough to be re-run on the same submission
// without corrupting state — they short-circuit when the desired field is
// already populated.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { indexContractEvents } from "@/lib/event-indexer";
import { createAttestation } from "@/lib/eas";
import { approveSubmissionOnchain } from "@/lib/approval";
import { getAdapter } from "@/lib/adapters/registry";
import type { AdapterContext } from "@/lib/adapters/types";
import { log } from "@/lib/logger";

function isAdmin(req: NextRequest): boolean {
  const adminWallet = process.env.ADMIN_WALLET_ADDRESS?.toLowerCase();
  const caller = req.headers.get("x-wallet-address")?.toLowerCase();
  return Boolean(adminWallet && caller && adminWallet === caller);
}

async function loadSubmission(submissionId: string) {
  return prisma.submission.findUnique({
    where: { id: submissionId },
    include: { quest: true, user: true },
  });
}

async function retryIndexer() {
  const result = await indexContractEvents();
  return { scanned: result.scanned.toString(), inserted: result.inserted };
}

async function retryProofCheck(submissionId: string) {
  const sub = await loadSubmission(submissionId);
  if (!sub) throw new Error("Submission not found.");
  if (sub.proof_type !== "github_project") {
    throw new Error(`Proof re-check only supported for github_project (got ${sub.proof_type}).`);
  }
  const adapter = getAdapter("github_project");
  if (!adapter) throw new Error("github_project adapter not registered.");

  const ctx: AdapterContext = {
    questDbId: sub.quest_id,
    walletAddress: sub.wallet_address,
    linkedGithubLogin: sub.user?.github_login ?? null,
    linkedDiscord: null,
    quest: {
      id: sub.quest.id,
      start_time: sub.quest.start_time,
      min_score: sub.quest.min_score,
      scoring_rubric_json: sub.quest.scoring_rubric_json,
      requirements_json: sub.quest.requirements_json,
      proof_type: sub.quest.proof_type,
      contract_version: sub.quest.contract_version,
    },
  };
  const input = {
    githubUsername: sub.github_username,
    repoUrl: sub.repo_url,
    demoUrl: sub.demo_url ?? undefined,
    explanation: sub.explanation ?? undefined,
  };
  const evidence = await adapter.fetchEvidence(input, ctx);
  const scored = await adapter.scoreEvidence(evidence, ctx);

  // Update only the derived fields. Do NOT touch attestation/approval/claim
  // fields — those are owned by separate retry endpoints.
  await prisma.submission.update({
    where: { id: sub.id },
    data: {
      score: scored.score,
      failure_reasons_json: scored.failureReasons,
      evidence_json: adapter.buildPrivateEvidence(evidence, scored) as object,
    },
  });
  // Replace proof_checks rows.
  await prisma.proofCheck.deleteMany({ where: { submission_id: sub.id } });
  await prisma.proofCheck.createMany({
    data: scored.checks.map((c) => ({
      submission_id: sub.id,
      check_name: c.check_name,
      passed: c.passed,
      points_awarded: c.points_awarded,
      max_points: c.max_points,
      details_json: { details: c.details },
    })),
  });
  return { score: scored.score, passed: scored.passed, checks: scored.checks.length };
}

async function retryAttestation(submissionId: string) {
  const sub = await loadSubmission(submissionId);
  if (!sub) throw new Error("Submission not found.");
  if (sub.eas_attestation_uid && sub.eas_attestation_uid !== "0x" + "0".repeat(64)) {
    return { skipped: true, reason: "Attestation already exists.", uid: sub.eas_attestation_uid };
  }
  if (!sub.proof_hash) throw new Error("Submission has no proof_hash to attest.");
  if (sub.quest.onchain_quest_id === null) throw new Error("Quest has no onchain id.");

  const uid = await createAttestation({
    questId: sub.quest.onchain_quest_id,
    user: sub.wallet_address,
    proofType: sub.proof_type ?? "github_project",
    proofHash: sub.proof_hash as `0x${string}`,
    score: sub.score ?? 0,
    riskBand: sub.risk_band ?? "UNKNOWN",
    approved: true,
  });
  await prisma.submission.update({
    where: { id: sub.id },
    data: { eas_attestation_uid: uid, status: "ATTESTED" },
  });
  return { uid };
}

async function retryOnchainApproval(submissionId: string) {
  const sub = await loadSubmission(submissionId);
  if (!sub) throw new Error("Submission not found.");
  if (sub.tx_hash_approval) {
    return { skipped: true, reason: "Approval already on-chain.", tx: sub.tx_hash_approval };
  }
  if (!sub.proof_hash) throw new Error("Submission has no proof_hash.");
  if (!sub.eas_attestation_uid) throw new Error("Submission has no attestation. Run retry/attestation first.");
  if (sub.quest.onchain_quest_id === null) throw new Error("Quest has no onchain id.");

  const tx = await approveSubmissionOnchain({
    questId: sub.quest.onchain_quest_id,
    user: sub.wallet_address as `0x${string}`,
    proofHash: sub.proof_hash as `0x${string}`,
    attestationUID: sub.eas_attestation_uid as `0x${string}`,
    score: sub.score ?? 0,
    contractVersion: (sub.quest.contract_version === 2 ? 2 : 1) as 1 | 2,
  });
  await prisma.submission.update({
    where: { id: sub.id },
    data: { tx_hash_approval: tx, status: "APPROVED_ONCHAIN" },
  });
  return { tx };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ op: string }> }
) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const { op } = await params;
  const body = await req.json().catch(() => ({})) as { submissionId?: string };
  try {
    switch (op) {
      case "indexer": {
        const out = await retryIndexer();
        return NextResponse.json({ ok: true, op, ...out });
      }
      case "proof-check": {
        if (!body.submissionId) return NextResponse.json({ error: "submissionId required." }, { status: 400 });
        const out = await retryProofCheck(body.submissionId);
        return NextResponse.json({ ok: true, op, ...out });
      }
      case "attestation": {
        if (!body.submissionId) return NextResponse.json({ error: "submissionId required." }, { status: 400 });
        const out = await retryAttestation(body.submissionId);
        return NextResponse.json({ ok: true, op, ...out });
      }
      case "onchain-approval": {
        if (!body.submissionId) return NextResponse.json({ error: "submissionId required." }, { status: 400 });
        const out = await retryOnchainApproval(body.submissionId);
        return NextResponse.json({ ok: true, op, ...out });
      }
      default:
        return NextResponse.json({ error: `Unknown op: ${op}` }, { status: 400 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Retry failed.";
    await log("error", "api.admin.retry", `op=${op} failed: ${msg}`);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
