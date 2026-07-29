import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { identifyRequest, rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import { serializeBigInt } from "@/lib/bigint";

export const dynamic = "force-dynamic";

// POST /api/appeals — user requests review for their own failed submission
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const submissionId = String(body.submissionId || "");
    const walletAddress = String(body.walletAddress || "").toLowerCase();
    const reason = String(body.reason || "").slice(0, 2000);

    if (!submissionId || !walletAddress || !reason.trim()) {
      return NextResponse.json(
        { error: "submissionId, walletAddress, reason are required." },
        { status: 400 }
      );
    }
    if (!/^0x[a-f0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json({ error: "Invalid walletAddress." }, { status: 400 });
    }

    const rl = rateLimit(identifyRequest(req, walletAddress), RATE_LIMITS.appeals);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many appeals. Please try again later.", retryAfterMs: rl.retryAfterMs },
        { status: 429 }
      );
    }

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { appeal: true },
    });
    if (!submission) {
      return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    }
    if (submission.wallet_address.toLowerCase() !== walletAddress) {
      return NextResponse.json({ error: "Wallet mismatch." }, { status: 403 });
    }
    if (!["FAILED", "REJECTED"].includes(submission.status)) {
      return NextResponse.json(
        { error: "Only failed submissions can be appealed." },
        { status: 400 }
      );
    }
    if (submission.appeal) {
      return NextResponse.json(
        { error: "An appeal already exists for this submission.", appealId: submission.appeal.id },
        { status: 409 }
      );
    }

    const appeal = await prisma.submissionAppeal.create({
      data: {
        submission_id: submissionId,
        wallet_address: walletAddress,
        reason,
        status: "PENDING",
      },
    });

    await log("info", "appeals", "Appeal created", {
      appealId: appeal.id,
      submissionId,
      walletAddress,
    });

    return NextResponse.json({ id: appeal.id, status: appeal.status }, { status: 201 });
  } catch (err) {
    console.error("[api/appeals POST]", err);
    return NextResponse.json({ error: "Failed to create appeal." }, { status: 500 });
  }
}

// GET /api/appeals?wallet=  — user's own appeals
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet")?.toLowerCase();
  if (!wallet || !/^0x[a-f0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ error: "Valid wallet param required." }, { status: 400 });
  }
  const appeals = await prisma.submissionAppeal.findMany({
    where: { wallet_address: wallet },
    orderBy: { created_at: "desc" },
    include: {
      submission: {
        select: {
          id: true,
          status: true,
          score: true,
          quest: { select: { id: true, title: true } },
        },
      },
    },
  });
  return NextResponse.json(serializeBigInt(appeals));
}
