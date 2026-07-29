import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeBigInt } from "@/lib/bigint";

function isAdmin(req: NextRequest): boolean {
  const adminWallet = process.env.ADMIN_WALLET_ADDRESS?.toLowerCase();
  const caller = req.headers.get("x-wallet-address")?.toLowerCase();
  return Boolean(adminWallet && caller && adminWallet === caller);
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const submissions = await prisma.submission.findMany({
      orderBy: { created_at: "desc" },
      take: 100,
      include: {
        quest: { select: { title: true } },
      },
    });
    return NextResponse.json(serializeBigInt(submissions));
  } catch (err) {
    console.error("[api/admin/submissions GET]", err);
    return NextResponse.json({ error: "Failed to fetch submissions." }, { status: 500 });
  }
}
