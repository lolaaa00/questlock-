import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseGitHubUrl, normaliseGitHubUrl, fetchRepoData } from "@/lib/github";
import { checkDemoUrl } from "@/lib/demo-url";
import { scoreProof } from "@/lib/scoring";
import { runAntiFarmChecks, hashValue } from "@/lib/antifarm";
import { createProofHash, proofHashToBytes32 } from "@/lib/proof-hash";
import { createAttestation } from "@/lib/eas";
import { approveSubmissionOnchain, rejectSubmissionOnchain } from "@/lib/approval";
import { log } from "@/lib/logger";
import { identifyRequest, rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { checkCreatorGuard, CREATOR_GUARD_ERROR_MESSAGE } from "@/lib/creator-guard";

export async function POST(req: NextRequest) {
  let submissionId: string | null = null;

  try {
    const body = await req.json();
    const { questId, walletAddress, githubUsername, repoUrl, demoUrl, explanation } =
      body;

    // Basic validation
    if (!questId || !walletAddress || !githubUsername || !repoUrl) {
      return NextResponse.json(
        { error: "Missing required fields: questId, walletAddress, githubUsername, repoUrl." },
        { status: 400 }
      );
    }

    // Rate limit by wallet (falls back to IP if missing)
    const rl = rateLimit(
      identifyRequest(req, walletAddress),
      RATE_LIMITS.proofSubmit
    );
    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: "Too many proof submissions. Please try again later.",
          retryAfterMs: rl.retryAfterMs,
        },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil((rl.retryAfterMs ?? 0) / 1000)) },
        }
      );
    }

    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid GitHub repository URL." },
        { status: 400 }
      );
    }

    const normalisedRepoUrl = normaliseGitHubUrl(repoUrl)!;

    // Load quest
    const quest = await prisma.quest.findUnique({ where: { id: questId } });
    if (!quest) {
      return NextResponse.json({ error: "Quest not found." }, { status: 404 });
    }
    if (quest.status !== "active") {
      return NextResponse.json({ error: "Quest is not active." }, { status: 400 });
    }
    if (new Date() > quest.deadline) {
      return NextResponse.json({ error: "Quest deadline has passed." }, { status: 400 });
    }

    // v1.1 creator-guard: block the quest's creator/sponsor from participating
    // in their own quest. Backend-enforced even if the UI is bypassed.
    const guard = checkCreatorGuard(walletAddress, {
      created_by: quest.created_by,
      sponsor_wallet: quest.sponsor_wallet,
    });
    if (guard.blocked) {
      await log("info", "proof/submit", "Blocked by creator-guard", {
        questId,
        walletAddress,
        reason: guard.reason,
      });
      return NextResponse.json(
        { error: CREATOR_GUARD_ERROR_MESSAGE, blockedBy: guard.reason },
        { status: 403 }
      );
    }

    // v1.1: GitHub linking is required. Block submission if the wallet has
    // not linked a GitHub account, and require the submitted GitHub
    // username + repo owner to match the linked github_login exactly.
    const linkedUser = await prisma.user.findUnique({
      where: { wallet_address: walletAddress.toLowerCase() },
      select: { github_login: true },
    });
    if (!linkedUser?.github_login) {
      return NextResponse.json(
        {
          error: "Connect GitHub before submitting proof.",
          requiresGithubLink: true,
        },
        { status: 403 }
      );
    }
    const linkedLogin = linkedUser.github_login.toLowerCase();
    if (githubUsername.toLowerCase() !== linkedLogin) {
      return NextResponse.json(
        {
          error: `Submitted GitHub username must match your linked account (@${linkedUser.github_login}).`,
        },
        { status: 400 }
      );
    }
    if (parsed.owner.toLowerCase() !== linkedLogin) {
      return NextResponse.json(
        {
          error: `Repository owner (${parsed.owner}) must match your linked GitHub account (@${linkedUser.github_login}).`,
        },
        { status: 400 }
      );
    }

    // Check for existing submission
    const existing = await prisma.submission.findUnique({
      where: { quest_id_wallet_address: { quest_id: questId, wallet_address: walletAddress } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "You have already submitted proof for this quest.", submissionId: existing.id },
        { status: 409 }
      );
    }

    // Upsert user FIRST (submission has FK on wallet_address) — preserve linked
    // GitHub fields and only sync the legacy free-text github_username.
    await prisma.user.upsert({
      where: { wallet_address: walletAddress },
      update: { github_username: githubUsername },
      create: { wallet_address: walletAddress, github_username: githubUsername },
    });

    // Create submission record
    const submission = await prisma.submission.create({
      data: {
        quest_id: questId,
        wallet_address: walletAddress,
        github_username: githubUsername,
        repo_url: normalisedRepoUrl,
        demo_url: demoUrl || null,
        explanation: explanation || null,
        status: "FETCHING_PROOF",
      },
    });
    submissionId = submission.id;

    await log("info", "proof/submit", "Proof submission started", {
      submissionId,
      questId,
      walletAddress,
    });

    // === PHASE 1: Anti-farm pre-check ===
    await prisma.submission.update({
      where: { id: submissionId },
      data: { status: "EVALUATING" },
    });

    const antiFarm = await runAntiFarmChecks({
      questId,
      walletAddress,
      githubUsername,
      repoUrl: normalisedRepoUrl,
      demoUrl,
    });

    if (antiFarm.riskBand === "HIGH_RISK") {
      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: "FAILED",
          risk_band: antiFarm.riskBand,
          failure_reasons_json: antiFarm.reasons,
          score: 0,
        },
      });
      return NextResponse.json({
        submissionId,
        status: "FAILED",
        riskBand: antiFarm.riskBand,
        failureReasons: antiFarm.reasons,
        score: 0,
      });
    }

    // === PHASE 2: GitHub proof check ===
    const repoData = await fetchRepoData(
      parsed.owner,
      parsed.repo,
      quest.start_time,
      githubUsername
    );

    // === PHASE 3: Demo URL check ===
    const demoResult = demoUrl
      ? await checkDemoUrl(demoUrl)
      : { passed: false, reason: "No demo URL provided." };

    // === PHASE 4: Score ===
    const isDuplicate = antiFarm.duplicateRepo || antiFarm.duplicateDemoUrl;
    const rubric = (quest.scoring_rubric_json as Record<string, number>) || {};
    const scoringResult = scoreProof(
      repoData,
      demoResult,
      isDuplicate,
      quest.start_time,
      rubric,
      quest.min_score
    );

    // Save proof checks
    await prisma.proofCheck.createMany({
      data: scoringResult.checks.map((c) => ({
        submission_id: submissionId!,
        check_name: c.check_name,
        passed: c.passed,
        points_awarded: c.points_awarded,
        max_points: c.max_points,
        details_json: { details: c.details },
      })),
    });

    const allFailureReasons = [
      ...scoringResult.failureReasons,
      ...antiFarm.reasons,
    ];

    if (!scoringResult.passed || (antiFarm.riskBand as string) === "HIGH_RISK") {
      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: "FAILED",
          score: scoringResult.score,
          risk_band: antiFarm.riskBand,
          failure_reasons_json: allFailureReasons,
          proof_hash: null,
        },
      });

      await log("info", "proof/submit", "Proof failed scoring", {
        submissionId,
        score: scoringResult.score,
        riskBand: antiFarm.riskBand,
      });

      return NextResponse.json({
        submissionId,
        status: "FAILED",
        score: scoringResult.score,
        riskBand: antiFarm.riskBand,
        checks: scoringResult.checks,
        failureReasons: allFailureReasons,
        warnings: scoringResult.warnings,
      });
    }

    // === PHASE 5: Create proof hash ===
    const timestamp = Math.floor(Date.now() / 1000);
    const proofHashHex = createProofHash({
      questId,
      walletAddress,
      repoUrl: normalisedRepoUrl,
      demoUrl,
      score: scoringResult.score,
      timestamp,
    });
    const proofHashBytes32 = proofHashToBytes32(proofHashHex);

    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: "ATTESTING",
        score: scoringResult.score,
        risk_band: antiFarm.riskBand,
        proof_hash: proofHashHex,
      },
    });

    // === PHASE 6: EAS attestation ===
    let attestationUID = "0x" + "0".repeat(64);
    try {
      if (quest.onchain_quest_id) {
        attestationUID = await createAttestation({
          questId: quest.onchain_quest_id,
          user: walletAddress,
          proofType: "github_project",
          proofHash: proofHashBytes32,
          score: scoringResult.score,
          riskBand: antiFarm.riskBand,
          approved: true,
        });
      }
    } catch (easErr) {
      await log("error", "proof/submit", "EAS attestation failed", {
        submissionId,
        error: String(easErr),
      });
    }

    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: "APPROVING_ONCHAIN",
        eas_attestation_uid: attestationUID,
      },
    });

    // === PHASE 7: Onchain approval ===
    let approvalTxHash: string | null = null;
    try {
      // v1.2: route to V2 contract if this is a sponsor-funded quest.
      const onchainQid = quest.contract_version === 2
        ? quest.funded_quest_id
        : quest.onchain_quest_id;
      if (onchainQid) {
        approvalTxHash = await approveSubmissionOnchain({
          questId: onchainQid,
          user: walletAddress as `0x${string}`,
          proofHash: proofHashBytes32,
          attestationUID: (attestationUID.startsWith("0x")
            ? attestationUID
            : "0x" + attestationUID) as `0x${string}`,
          score: scoringResult.score,
          contractVersion: (quest.contract_version ?? 1) as 1 | 2,
        });
      }
    } catch (approvalErr) {
      await log("error", "proof/submit", "Onchain approval failed", {
        submissionId,
        error: String(approvalErr),
      });

      await prisma.submission.update({
        where: { id: submissionId },
        data: { status: "PASSED" },
      });

      return NextResponse.json({
        submissionId,
        status: "PASSED",
        score: scoringResult.score,
        riskBand: antiFarm.riskBand,
        checks: scoringResult.checks,
        easAttestationUid: attestationUID,
        warning: "Onchain approval failed. Admin will retry.",
      });
    }

    // === PHASE 8: Record in duplicate index ===
    await prisma.duplicateIndex.create({
      data: {
        quest_id: questId,
        repo_url_hash: hashValue(normalisedRepoUrl),
        github_username_hash: hashValue(githubUsername),
        demo_url_hash: demoUrl ? hashValue(demoUrl) : null,
        wallet_address: walletAddress,
        submission_id: submissionId,
      },
    });

    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: "APPROVED_ONCHAIN",
        tx_hash_approval: approvalTxHash,
      },
    });

    await log("info", "proof/submit", "Submission approved onchain", {
      submissionId,
      score: scoringResult.score,
      txHash: approvalTxHash,
    });

    return NextResponse.json({
      submissionId,
      status: "APPROVED_ONCHAIN",
      score: scoringResult.score,
      riskBand: antiFarm.riskBand,
      checks: scoringResult.checks,
      easAttestationUid: attestationUID,
      txHashApproval: approvalTxHash,
    });
  } catch (err) {
    console.error("[api/proof/submit]", err);

    if (submissionId) {
      await prisma.submission
        .update({
          where: { id: submissionId },
          data: { status: "FAILED", failure_reasons_json: ["Internal server error."] },
        })
        .catch(() => {});
    }

    return NextResponse.json(
      { error: "Proof submission failed. Please try again." },
      { status: 500 }
    );
  }
}
