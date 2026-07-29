// v1.2 multi-proof submit. Dispatches to the right adapter by quest.proof_type.
// GitHub proofs still use /api/proof/submit (unchanged behaviour).
// This route handles manual_project / discord_role / x_post / lms_course.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdapter } from "@/lib/adapters/registry";
import { log } from "@/lib/logger";
import { identifyRequest, rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { checkCreatorGuard, CREATOR_GUARD_ERROR_MESSAGE } from "@/lib/creator-guard";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let submissionId: string | null = null;
  try {
    const body = await req.json();
    const { questId, walletAddress, input } = body as {
      questId: string;
      walletAddress: string;
      input: Record<string, unknown>;
    };

    if (!questId || !walletAddress || !input) {
      return NextResponse.json({ error: "Missing questId, walletAddress, or input." }, { status: 400 });
    }

    const rl = rateLimit(identifyRequest(req, walletAddress), RATE_LIMITS.manualProofSubmit);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many submissions.", retryAfterMs: rl.retryAfterMs },
        { status: 429 }
      );
    }

    const quest = await prisma.quest.findUnique({ where: { id: questId } });
    if (!quest) return NextResponse.json({ error: "Quest not found." }, { status: 404 });
    if (quest.status !== "active") return NextResponse.json({ error: "Quest not active." }, { status: 400 });
    if (new Date() > quest.deadline) return NextResponse.json({ error: "Quest deadline passed." }, { status: 400 });

    // GitHub proofs stay on the original route (kept for full v1.1 parity).
    if (quest.proof_type === "github_project") {
      return NextResponse.json(
        { error: "Use /api/proof/submit for GitHub project quests." },
        { status: 400 }
      );
    }

    // Creator/sponsor guard
    const guard = checkCreatorGuard(walletAddress, { created_by: quest.created_by, sponsor_wallet: quest.sponsor_wallet });
    if (guard.blocked) {
      return NextResponse.json(
        { error: CREATOR_GUARD_ERROR_MESSAGE, blockedBy: guard.reason }, { status: 403 }
      );
    }

    const adapter = getAdapter(quest.proof_type);
    if (!adapter) {
      return NextResponse.json({ error: `Unknown proof_type: ${quest.proof_type}` }, { status: 400 });
    }

    // Build context — including linked Discord if relevant.
    let linkedDiscord = null;
    if (quest.proof_type === "discord_role") {
      const dc = await prisma.discordConnection.findUnique({
        where: { wallet_address: walletAddress.toLowerCase() },
      });
      if (dc) linkedDiscord = { id: dc.discord_id, username: dc.discord_username };
    }

    const ctx = {
      questDbId: quest.id, walletAddress,
      linkedDiscord, linkedGithubLogin: null,
      quest: {
        id: quest.id, start_time: quest.start_time, min_score: quest.min_score,
        scoring_rubric_json: quest.scoring_rubric_json,
        requirements_json: quest.requirements_json,
        proof_type: quest.proof_type, contract_version: quest.contract_version ?? 1,
      },
    };

    const validation = adapter.validateInput(input as never, ctx);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.errors[0], errors: validation.errors }, { status: 400 });
    }

    // Already submitted?
    const existing = await prisma.submission.findUnique({
      where: { quest_id_wallet_address: { quest_id: questId, wallet_address: walletAddress } },
    });
    if (existing) {
      return NextResponse.json({ error: "Already submitted.", submissionId: existing.id }, { status: 409 });
    }

    // Ensure user row exists (FK)
    await prisma.user.upsert({
      where: { wallet_address: walletAddress },
      update: {},
      create: { wallet_address: walletAddress },
    });

    const submission = await prisma.submission.create({
      data: {
        quest_id: questId, wallet_address: walletAddress,
        github_username: "", // not applicable
        repo_url: "",        // not applicable
        proof_type: quest.proof_type,
        status: "EVALUATING",
      },
    });
    submissionId = submission.id;

    const evidence = await adapter.fetchEvidence(input as never, ctx);
    const result = await adapter.scoreEvidence(evidence, ctx);

    // Persist adapter outcome
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: result.requiresManualReview ? "PASSED" : (result.passed ? "PASSED" : "FAILED"),
        score: result.score,
        failure_reasons_json: result.failureReasons,
        evidence_json: adapter.buildPrivateEvidence(evidence, result) as object,
      },
    });

    // Per-check rows
    if (result.checks.length > 0) {
      await prisma.proofCheck.createMany({
        data: result.checks.map((c) => ({
          submission_id: submissionId!, check_name: c.check_name,
          passed: c.passed, points_awarded: c.points_awarded,
          max_points: c.max_points, details_json: { details: c.details },
        })),
      });
    }

    await log("info", "proof/multi", "Multi-proof submission recorded", {
      submissionId, questId, proofType: quest.proof_type, requiresManualReview: result.requiresManualReview,
    });

    return NextResponse.json({
      submissionId, status: result.requiresManualReview ? "PENDING_MANUAL_REVIEW" : (result.passed ? "PASSED" : "FAILED"),
      score: result.score, checks: result.checks,
      failureReasons: result.failureReasons,
      requiresManualReview: result.requiresManualReview,
    });
  } catch (err) {
    console.error("[api/proof/multi]", err);
    if (submissionId) {
      await prisma.submission.update({
        where: { id: submissionId },
        data: { status: "FAILED", failure_reasons_json: ["Internal server error."] },
      }).catch(() => {});
    }
    return NextResponse.json({ error: "Submission failed." }, { status: 500 });
  }
}
