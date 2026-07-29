import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeBigInt } from "@/lib/bigint";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        proof_checks: {
          orderBy: { created_at: "asc" },
        },
        quest: {
          select: {
            id: true,
            title: true,
            onchain_quest_id: true,
            reward_amount: true,
            badge_id: true,
            min_score: true,
          },
        },
      },
    });

    if (!submission) {
      return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    }

    return NextResponse.json(
      serializeBigInt({
        id: submission.id,
        status: submission.status,
        score: submission.score,
        riskBand: submission.risk_band,
        failureReasons: submission.failure_reasons_json,
        easAttestationUid: submission.eas_attestation_uid,
        txHashApproval: submission.tx_hash_approval,
        txHashClaim: submission.tx_hash_claim,
        proofChecks: submission.proof_checks,
        quest: submission.quest,
        createdAt: submission.created_at,
        updatedAt: submission.updated_at,
      })
    );
  } catch (err) {
    console.error("[api/proof/status/[id]]", err);
    return NextResponse.json({ error: "Failed to fetch submission." }, { status: 500 });
  }
}
