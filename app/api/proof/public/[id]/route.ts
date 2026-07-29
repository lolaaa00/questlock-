import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPubliclyVisible, toPublicProof } from "@/lib/public-proof";

export const dynamic = "force-dynamic";

// Public endpoint — no auth required. Returns ONLY whitelisted fields.
// 404 for submissions that have not reached an attested/approved/claimed
// state, so we never leak failed submissions or in-progress evaluations.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        proof_checks: { orderBy: { created_at: "asc" } },
        quest: {
          select: {
            id: true,
            title: true,
            description: true,
            reward_amount: true,
            badge_id: true,
            min_score: true,
          },
        },
        user: {
          select: {
            github_login: true,
            github_avatar_url: true,
            github_profile_url: true,
          },
        },
      },
    });

    if (!submission || !isPubliclyVisible(submission.status)) {
      return NextResponse.json(
        { error: "Proof not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(toPublicProof(submission));
  } catch (err) {
    console.error("[api/proof/public/[id]]", err);
    return NextResponse.json(
      { error: "Failed to load proof." },
      { status: 500 }
    );
  }
}
