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
    const quests = await prisma.quest.findMany({
      orderBy: { created_at: "desc" },
      include: {
        _count: { select: { submissions: true } },
      },
    });
    return NextResponse.json(serializeBigInt(quests));
  } catch (err) {
    console.error("[api/admin/quests GET]", err);
    return NextResponse.json({ error: "Failed to fetch quests." }, { status: 500 });
  }
}
