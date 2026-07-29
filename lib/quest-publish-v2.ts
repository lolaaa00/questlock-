// v1.2: publish a sponsor-funded quest on QuestLockCoreV2.
// Funded quest is created UNFUNDED — sponsor (or admin) funds it separately.
//
// Reuses the deployer/admin wallet (holds QUEST_CREATOR_ROLE on V2) to call
// createFundedQuest. Returns the new onchainQuestId from the event log.

import {
  createPublicClient,
  createWalletClient,
  http,
  decodeEventLog,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { CONTRACT_ADDRESSES, QUEST_LOCK_CORE_V2_ABI } from "./contracts";
import { requireEnv, getEnv } from "./env";

export interface PublishV2Params {
  sponsor: `0x${string}`;
  rewardAmount: string;        // human-readable QUEST (e.g. "10")
  rewardTokenAddress?: string; // defaults to QuestRewardToken
  badgeId: number;
  minScore: number;
  maxClaims: number;
  deadlineDays: number;
}

export interface PublishV2Result {
  onchainQuestId: bigint;
  txHash: `0x${string}`;
  requiredFunding: bigint;
}

export async function publishFundedQuestOnchain(
  params: PublishV2Params
): Promise<PublishV2Result> {
  const creatorKey = requireEnv("DEPLOYER_PRIVATE_KEY");
  const account = privateKeyToAccount(creatorKey as `0x${string}`);
  const rpcUrl = getEnv("BASE_SEPOLIA_RPC_URL") || "https://sepolia.base.org";

  const walletClient = createWalletClient({
    account, chain: baseSepolia, transport: http(rpcUrl),
  });
  const publicClient = createPublicClient({
    chain: baseSepolia, transport: http(rpcUrl),
  });

  const rewardToken = (params.rewardTokenAddress ||
    CONTRACT_ADDRESSES.QUEST_REWARD_TOKEN) as `0x${string}`;
  const rewardAmount = parseUnits(params.rewardAmount, 18);
  const now = Math.floor(Date.now() / 1000);
  const deadline = BigInt(now + params.deadlineDays * 24 * 60 * 60);

  if (!CONTRACT_ADDRESSES.QUESTLOCK_CORE_V2) {
    throw new Error("V2 address missing: set NEXT_PUBLIC_QUESTLOCK_CORE_V2_ADDRESS");
  }

  const txHash = await walletClient.writeContract({
    address: CONTRACT_ADDRESSES.QUESTLOCK_CORE_V2,
    abi: QUEST_LOCK_CORE_V2_ABI,
    functionName: "createFundedQuest",
    args: [
      params.sponsor, rewardToken, rewardAmount,
      BigInt(params.badgeId), BigInt(now), deadline,
      BigInt(params.maxClaims), params.minScore,
    ],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === "reverted") {
    throw new Error(`createFundedQuest reverted. tx=${txHash}`);
  }

  // Parse FundedQuestCreated event
  let onchainQuestId: bigint | null = null;
  let requiredFunding = 0n;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== CONTRACT_ADDRESSES.QUESTLOCK_CORE_V2!.toLowerCase()) continue;
    try {
      const parsed = decodeEventLog({
        abi: QUEST_LOCK_CORE_V2_ABI, data: log.data, topics: log.topics,
      });
      if (parsed.eventName === "FundedQuestCreated") {
        onchainQuestId = parsed.args.questId as bigint;
        requiredFunding = parsed.args.requiredFunding as bigint;
        break;
      }
    } catch { /* not this log */ }
  }
  if (onchainQuestId === null) {
    throw new Error(`FundedQuestCreated event not found in receipt. tx=${txHash}`);
  }
  return { onchainQuestId, txHash, requiredFunding };
}
