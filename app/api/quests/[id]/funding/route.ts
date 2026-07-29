// v1.2: read live funding state for a quest. Public — read-only, no secrets.
// Also POST refreshes the cached funded/claimed/withdrawn from the V2 contract.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPublicClient, http, formatUnits } from "viem";
import { baseSepolia } from "viem/chains";
import { CONTRACT_ADDRESSES, QUEST_LOCK_CORE_V2_ABI } from "@/lib/contracts";
import { serializeBigInt } from "@/lib/bigint";

export const dynamic = "force-dynamic";

async function readOnchainFunding(fundedQuestId: bigint) {
  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
  const client = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) });
  if (!CONTRACT_ADDRESSES.QUESTLOCK_CORE_V2) return null;
  const result = (await client.readContract({
    address: CONTRACT_ADDRESSES.QUESTLOCK_CORE_V2,
    abi: QUEST_LOCK_CORE_V2_ABI,
    functionName: "getQuestFunding",
    args: [fundedQuestId],
  })) as readonly [bigint, bigint, bigint, bigint];
  return {
    funded: result[0],
    claimed: result[1],
    withdrawn: result[2],
    remaining: result[3],
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quest = await prisma.quest.findUnique({
    where: { id },
    select: {
      id: true, title: true, contract_version: true,
      funded_quest_id: true, onchain_quest_id: true,
      reward_amount: true, max_claims: true,
      required_funding: true, funded_amount: true,
      claimed_amount_onchain: true, withdrawn_amount: true,
      funding_status: true, sponsor_wallet: true, deadline: true,
    },
  });
  if (!quest) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(serializeBigInt(quest));
}

/** POST refreshes the cached fundedAmount/claimedAmount/withdrawnAmount from V2. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quest = await prisma.quest.findUnique({ where: { id } });
  if (!quest) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (quest.contract_version !== 2 || !quest.funded_quest_id) {
    return NextResponse.json({ error: "not a v1.2 funded quest" }, { status: 400 });
  }
  const onchain = await readOnchainFunding(quest.funded_quest_id);
  if (!onchain) {
    return NextResponse.json({ error: "V2 not configured" }, { status: 500 });
  }
  // Derive funding_status by comparison with required
  const required = BigInt(quest.required_funding || "0");
  const reward = BigInt(quest.reward_amount || "0") * BigInt(10) ** BigInt(18);
  let status: string;
  if (onchain.funded === 0n) status = "UNFUNDED";
  else if (onchain.funded >= required) status = "FUNDED";
  else if (onchain.remaining < reward) status = "UNDERFUNDED";
  else status = "PARTIALLY_FUNDED";

  const updated = await prisma.quest.update({
    where: { id },
    data: {
      funded_amount: onchain.funded.toString(),
      claimed_amount_onchain: onchain.claimed.toString(),
      withdrawn_amount: onchain.withdrawn.toString(),
      funding_status: status,
    },
  });
  return NextResponse.json(serializeBigInt({
    id: updated.id,
    funding_status: updated.funding_status,
    funded_amount: formatUnits(onchain.funded, 18),
    claimed_amount: formatUnits(onchain.claimed, 18),
    withdrawn_amount: formatUnits(onchain.withdrawn, 18),
    remaining: formatUnits(onchain.remaining, 18),
  }));
}
