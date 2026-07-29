import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeBigInt } from "@/lib/bigint";

function isAdmin(req: NextRequest): boolean {
  const adminWallet = process.env.ADMIN_WALLET_ADDRESS?.toLowerCase();
  const caller = req.headers.get("x-wallet-address")?.toLowerCase();
  return Boolean(adminWallet && caller && adminWallet === caller);
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const appeals = await prisma.submissionAppeal.findMany({
    orderBy: { created_at: "desc" },
    include: {
      submission: {
        select: {
          id: true,
          status: true,
          score: true,
          risk_band: true,
          repo_url: true,
          demo_url: true,
          github_username: true,
          failure_reasons_json: true,
          quest: {
            select: {
              id: true,
              title: true,
              onchain_quest_id: true,
              min_score: true,
            },
          },
        },
      },
    },
  });
  return NextResponse.json(serializeBigInt(appeals));
}
