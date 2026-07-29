import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeBigInt } from "@/lib/bigint";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet")?.toLowerCase();
  if (!wallet || !/^0x[a-f0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ error: "Valid wallet required." }, { status: 400 });
  }
  // A sponsor sees only their own quests
  const quests = await prisma.quest.findMany({
    where: { sponsor_wallet: wallet },
    orderBy: { created_at: "desc" },
    select: {
      id: true, title: true, description: true,
      contract_version: true, funding_status: true,
      reward_amount: true, max_claims: true, deadline: true,
      onchain_quest_id: true, funded_quest_id: true,
      required_funding: true, funded_amount: true,
      claimed_amount_onchain: true, withdrawn_amount: true,
      proof_type: true, status: true, created_at: true,
      _count: { select: { submissions: { where: { status: "CLAIMED" } } } },
    },
  });
  return NextResponse.json(serializeBigInt(quests));
}
