import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeBigInt } from "@/lib/bigint";

function isAdmin(req: NextRequest): boolean {
  const adminWallet = process.env.ADMIN_WALLET_ADDRESS?.toLowerCase();
  const caller = req.headers.get("x-wallet-address")?.toLowerCase();
  return Boolean(adminWallet && caller && adminWallet === caller);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

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
            reward_amount: true,
            badge_id: true,
            min_score: true,
            onchain_quest_id: true,
          },
        },
      },
    });

    if (!submission) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    return NextResponse.json(serializeBigInt(submission));
  } catch (err) {
    console.error("[api/ops-ql/submissions/[id]]", err);
    return NextResponse.json({ error: "Failed to fetch." }, { status: 500 });
  }
}
