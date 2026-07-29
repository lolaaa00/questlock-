// Calls QuestLockCore.createQuest using the deployer wallet (which holds
// QUEST_CREATOR_ROLE) and returns the new onchain quest id parsed from the
// QuestCreated event log. This is invoked from the admin "Publish onchain"
// flow after a quest request has been reviewed.

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  decodeEventLog,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { CONTRACT_ADDRESSES } from "./contracts";
import { requireEnv, getEnv } from "./env";

const QUEST_LOCK_CORE_ABI = parseAbi([
  "function createQuest(address rewardToken, uint256 rewardAmount, uint256 badgeId, uint256 startTime, uint256 deadline, uint256 maxClaims, uint16 minScore) external returns (uint256)",
  "event QuestCreated(uint256 indexed questId, address indexed creator, address rewardToken, uint256 rewardAmount, uint256 deadline)",
]);

export interface PublishParams {
  rewardAmount: string; // human-readable QUEST amount, e.g. "10"
  rewardTokenAddress?: string;
  badgeId: number;
  minScore: number;
  maxClaims: number;
  deadlineDays: number;
}

export interface PublishResult {
  onchainQuestId: bigint;
  txHash: `0x${string}`;
}

export async function publishQuestOnchain(
  params: PublishParams
): Promise<PublishResult> {
  // We reuse DEPLOYER_PRIVATE_KEY because the deployer wallet was granted
  // QUEST_CREATOR_ROLE at deploy time. A dedicated creator key can be
  // swapped in later without touching the rest of the code.
  const creatorKey = requireEnv("DEPLOYER_PRIVATE_KEY");
  const account = privateKeyToAccount(creatorKey as `0x${string}`);
  const rpcUrl = getEnv("BASE_SEPOLIA_RPC_URL") || "https://sepolia.base.org";

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(rpcUrl),
  });
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  const rewardTokenAddress = (params.rewardTokenAddress ||
    CONTRACT_ADDRESSES.QUEST_REWARD_TOKEN) as `0x${string}`;

  const now = Math.floor(Date.now() / 1000);
  const deadline = BigInt(now + params.deadlineDays * 24 * 60 * 60);
  const rewardAmount = parseUnits(params.rewardAmount, 18);

  const txHash = await walletClient.writeContract({
    address: CONTRACT_ADDRESSES.QUESTLOCK_CORE,
    abi: QUEST_LOCK_CORE_ABI,
    functionName: "createQuest",
    args: [
      rewardTokenAddress,
      rewardAmount,
      BigInt(params.badgeId),
      BigInt(now),
      deadline,
      BigInt(params.maxClaims),
      params.minScore,
    ],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === "reverted") {
    throw new Error(`createQuest reverted. tx=${txHash}`);
  }

  // Parse QuestCreated → questId
  let onchainQuestId: bigint | null = null;
  for (const log of receipt.logs) {
    if (
      log.address.toLowerCase() !==
      CONTRACT_ADDRESSES.QUESTLOCK_CORE.toLowerCase()
    ) continue;
    try {
      const parsed = decodeEventLog({
        abi: QUEST_LOCK_CORE_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (parsed.eventName === "QuestCreated") {
        onchainQuestId = parsed.args.questId as bigint;
        break;
      }
    } catch {
      /* not this log */
    }
  }

  if (onchainQuestId === null) {
    throw new Error(
      `QuestCreated event not found in receipt logs. tx=${txHash}`
    );
  }

  return { onchainQuestId, txHash };
}
