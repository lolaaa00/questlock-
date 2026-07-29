import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPublicClient, http, formatUnits, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";
import { CONTRACT_ADDRESSES } from "@/lib/contracts";
import {
  aggregateQuestAnalytics,
  computePoolCoverage,
  potentialOutflowRemaining,
} from "@/lib/analytics";
import { serializeBigInt } from "@/lib/bigint";

function isAdmin(req: NextRequest): boolean {
  const adminWallet = process.env.ADMIN_WALLET_ADDRESS?.toLowerCase();
  const caller = req.headers.get("x-wallet-address")?.toLowerCase();
  return Boolean(adminWallet && caller && adminWallet === caller);
}

export const dynamic = "force-dynamic";

const ERC20_ABI = parseAbi([
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
]);

async function readRewardPool(): Promise<string | null> {
  try {
    const rpcUrl =
      process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
    const client = createPublicClient({
      chain: baseSepolia,
      transport: http(rpcUrl),
    });
    const balance = (await client.readContract({
      address: CONTRACT_ADDRESSES.QUEST_REWARD_TOKEN,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [CONTRACT_ADDRESSES.QUESTLOCK_CORE],
    })) as bigint;
    return formatUnits(balance, 18);
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const quests = await prisma.quest.findMany({
      orderBy: { created_at: "desc" },
      include: {
        submissions: {
          select: {
            status: true,
            score: true,
            failure_reasons_json: true,
          },
        },
      },
    });

    const rewardPoolBalance = await readRewardPool();

    let totalSubmissions = 0;
    let totalClaimed = 0;
    let totalApproved = 0;
    const reasonCounts = new Map<string, number>();

    const perQuest = quests.map((q) => {
      const a = aggregateQuestAnalytics(q.submissions);
      totalSubmissions += a.total_submissions;
      totalClaimed += a.claimed;
      totalApproved += a.approved_onchain;
      for (const fr of a.top_failure_reasons) {
        reasonCounts.set(
          fr.reason,
          (reasonCounts.get(fr.reason) ?? 0) + fr.count
        );
      }
      return {
        id: q.id,
        title: q.title,
        status: q.status,
        onchain_quest_id: q.onchain_quest_id,
        reward_amount: q.reward_amount,
        badge_id: q.badge_id,
        max_claims: q.max_claims,
        deadline: q.deadline,
        created_at: q.created_at,
        analytics: a,
        potential_outflow_remaining: potentialOutflowRemaining({
          maxClaims: q.max_claims,
          totalClaims: a.claimed,
          rewardAmount: q.reward_amount,
        }),
        // v1.2 sponsor-funded fields (null/0 for legacy quests)
        contract_version: q.contract_version ?? 1,
        funded_quest_id: q.funded_quest_id,
        funding_status: q.funding_status,
        sponsor_wallet: q.sponsor_wallet,
        required_funding: q.required_funding,
        funded_amount: q.funded_amount,
        claimed_amount_onchain: q.claimed_amount_onchain,
        withdrawn_amount: q.withdrawn_amount,
      };
    });

    const globalTopReasons = Array.from(reasonCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([reason, count]) => ({ reason, count }));

    // Pool coverage: roll up every active quest's max payout against the live
    // QuestLockCore balance so the admin can spot underfunding.
    const activeMaxPayouts = perQuest
      .filter((q) => q.status === "active")
      .map((q) => q.potential_outflow_remaining);
    const poolCoverage = computePoolCoverage({
      poolBalance: rewardPoolBalance,
      perQuestMaxPayouts: activeMaxPayouts,
    });

    return NextResponse.json(
      serializeBigInt({
        generated_at: new Date().toISOString(),
        reward_pool_balance: rewardPoolBalance,
        pool_coverage: poolCoverage,
        global: {
          total_quests: quests.length,
          total_submissions: totalSubmissions,
          total_approved_onchain: totalApproved,
          total_claimed: totalClaimed,
          global_approval_conversion_rate:
            totalSubmissions === 0 ? null : totalApproved / totalSubmissions,
          global_claim_conversion_rate:
            totalApproved === 0 ? null : totalClaimed / totalApproved,
          top_failure_reasons: globalTopReasons,
        },
        quests: perQuest,
      })
    );
  } catch (err) {
    console.error("[api/ops-ql/analytics]", err);
    return NextResponse.json(
      { error: "Failed to load analytics." },
      { status: 500 }
    );
  }
}
