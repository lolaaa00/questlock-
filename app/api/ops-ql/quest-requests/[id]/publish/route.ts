import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishQuestOnchain } from "@/lib/quest-publish";
import { publishFundedQuestOnchain } from "@/lib/quest-publish-v2";
import { log } from "@/lib/logger";
import { CONTRACT_ADDRESSES } from "@/lib/contracts";

function isAdmin(req: NextRequest): boolean {
  const adminWallet = process.env.ADMIN_WALLET_ADDRESS?.toLowerCase();
  const caller = req.headers.get("x-wallet-address")?.toLowerCase();
  return Boolean(adminWallet && caller && adminWallet === caller);
}

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.questRequest.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (!["APPROVED", "PUBLISH_FAILED"].includes(existing.status)) {
    return NextResponse.json(
      { error: `Cannot publish in current status: ${existing.status}` },
      { status: 400 }
    );
  }

  // Mark as publishing so concurrent clicks cannot fire it again.
  await prisma.questRequest.update({
    where: { id },
    data: { status: "PUBLISHING", publish_error: null },
  });

  try {
    // v1.2: sponsor-published quests default to V2 (sponsor-funded pool).
    // Legacy `publishQuestOnchain` is kept as a fallback if explicitly requested
    // via existing.publish_error containing the marker — but day-1 behaviour
    // is V2 for every new sponsor request.
    const useV2 = Boolean(CONTRACT_ADDRESSES.QUESTLOCK_CORE_V2);

    let onchainQuestId: bigint;
    let txHash: string;
    let requiredFunding: bigint | null = null;

    if (useV2) {
      const v2 = await publishFundedQuestOnchain({
        sponsor: existing.sponsor_wallet.toLowerCase() as `0x${string}`,
        rewardAmount: existing.reward_amount,
        rewardTokenAddress: existing.reward_token_address || CONTRACT_ADDRESSES.QUEST_REWARD_TOKEN,
        badgeId: existing.badge_id,
        minScore: existing.min_score,
        maxClaims: existing.max_claims,
        deadlineDays: existing.deadline_days,
      });
      onchainQuestId = v2.onchainQuestId;
      txHash = v2.txHash;
      requiredFunding = v2.requiredFunding;
    } else {
      const v1 = await publishQuestOnchain({
        rewardAmount: existing.reward_amount,
        rewardTokenAddress: existing.reward_token_address || CONTRACT_ADDRESSES.QUEST_REWARD_TOKEN,
        badgeId: existing.badge_id,
        minScore: existing.min_score,
        maxClaims: existing.max_claims,
        deadlineDays: existing.deadline_days,
      });
      onchainQuestId = v1.onchainQuestId;
      txHash = v1.txHash;
    }

    const startTime = new Date();
    const deadline = new Date(
      Date.now() + existing.deadline_days * 24 * 60 * 60 * 1000
    );

    const adminWallet = req.headers.get("x-wallet-address") || "ops-ql";
    const publishedQuest = await prisma.quest.create({
      data: {
        title: existing.title,
        description: existing.description,
        quest_type: existing.proof_type || "github_project",
        requirements_json: existing.requirements ? { text: existing.requirements } : {},
        scoring_rubric_json: {},
        min_score: existing.min_score,
        reward_amount: existing.reward_amount,
        reward_token_address: existing.reward_token_address || CONTRACT_ADDRESSES.QUEST_REWARD_TOKEN,
        badge_id: BigInt(existing.badge_id),
        start_time: startTime,
        deadline,
        max_claims: existing.max_claims,
        created_by: adminWallet,
        sponsor_wallet: existing.sponsor_wallet.toLowerCase(),
        status: "active",
        proof_type: existing.proof_type || "github_project",
        // v1.2 routing
        contract_version: useV2 ? 2 : 1,
        onchain_quest_id: useV2 ? null : onchainQuestId,
        funded_quest_id:  useV2 ? onchainQuestId : null,
        funding_status:   useV2 ? "UNFUNDED" : "LEGACY_SHARED",
        required_funding: requiredFunding ? requiredFunding.toString() : null,
        funded_amount: "0",
        claimed_amount_onchain: "0",
        withdrawn_amount: "0",
      },
    });

    await prisma.questRequest.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        onchain_quest_id: onchainQuestId,
        published_quest_id: publishedQuest.id,
        publish_tx_hash: txHash,
        published_at: new Date(),
      },
    });

    await log("info", "ops-ql/quest-requests", "Quest published onchain", {
      id,
      onchainQuestId: onchainQuestId.toString(),
      txHash,
    });

    return NextResponse.json({
      id,
      status: "PUBLISHED",
      onchain_quest_id: onchainQuestId.toString(),
      quest_id: publishedQuest.id,
      tx_hash: txHash,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.questRequest.update({
      where: { id },
      data: { status: "PUBLISH_FAILED", publish_error: message },
    });
    await log("error", "ops-ql/quest-requests", "Publish failed", { id, message });
    return NextResponse.json(
      { error: "Publish failed.", detail: message },
      { status: 500 }
    );
  }
}
