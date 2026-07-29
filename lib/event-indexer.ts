import { createPublicClient, http, parseAbiItem } from "viem";
import { baseSepolia } from "viem/chains";
import { CONTRACT_ADDRESSES } from "./contracts";
import { prisma } from "./prisma";
import { serializeBigInt } from "./bigint";

const EVENT_SIGNATURES = [
  parseAbiItem(
    "event QuestCreated(uint256 indexed questId, address indexed creator, address rewardToken, uint256 rewardAmount, uint256 deadline)"
  ),
  parseAbiItem(
    "event ProofSubmitted(uint256 indexed questId, address indexed user, bytes32 proofHash)"
  ),
  parseAbiItem(
    "event SubmissionApproved(uint256 indexed questId, address indexed user, bytes32 attestationUID, uint16 score)"
  ),
  parseAbiItem(
    "event SubmissionRejected(uint256 indexed questId, address indexed user)"
  ),
  parseAbiItem(
    "event RewardClaimed(uint256 indexed questId, address indexed user, uint256 rewardAmount, uint256 badgeId)"
  ),
];

// Public Base Sepolia RPC caps eth_getLogs at 2000 blocks per call.
// CHUNK_SIZE stays comfortably under that. INITIAL_LOOKBACK is the cold-start
// window used on the very first run (no events indexed yet). MAX_CHUNKS_PER_RUN
// bounds the work a single cron tick will do — if there's a huge backlog, the
// next tick picks up where this one stopped (idempotent — we resume from the
// max indexed block).
const CHUNK_SIZE = 1900n;
const INITIAL_LOOKBACK = 1900n;
const MAX_CHUNKS_PER_RUN = 10;

export async function indexContractEvents(): Promise<{
  scanned: bigint;
  inserted: number;
}> {
  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  // Find the most recent indexed block, or start from now - INITIAL_LOOKBACK
  const latestEvent = await prisma.contractEvent.findFirst({
    orderBy: { block_number: "desc" },
  });

  const tipBlock = await publicClient.getBlockNumber();
  let fromBlock = latestEvent
    ? BigInt(latestEvent.block_number) + 1n
    : tipBlock > INITIAL_LOOKBACK
    ? tipBlock - INITIAL_LOOKBACK
    : 0n;

  // If nothing new, return early — avoids issuing one no-op eth_getLogs per
  // event signature against the RPC.
  if (fromBlock > tipBlock) {
    return { scanned: 0n, inserted: 0 };
  }

  const startBlock = fromBlock;
  let inserted = 0;
  let chunks = 0;

  while (fromBlock <= tipBlock && chunks < MAX_CHUNKS_PER_RUN) {
    const toBlock = fromBlock + CHUNK_SIZE - 1n > tipBlock
      ? tipBlock
      : fromBlock + CHUNK_SIZE - 1n;

    for (const event of EVENT_SIGNATURES) {
      const logs = await publicClient.getLogs({
        address: CONTRACT_ADDRESSES.QUESTLOCK_CORE,
        event,
        fromBlock,
        toBlock,
      });

      for (const log of logs) {
        const exists = await prisma.contractEvent.findFirst({
          where: {
            tx_hash: log.transactionHash,
            event_name: event.name,
          },
        });
        if (exists) continue;

        const args = (log as unknown as { args: Record<string, unknown> }).args || {};

        await prisma.contractEvent.create({
          data: {
            event_name: event.name,
            tx_hash: log.transactionHash,
            block_number: BigInt(log.blockNumber),
            quest_id: (args.questId as bigint | undefined)?.toString() || null,
            wallet_address:
              (args.user as string | undefined) ||
              (args.creator as string | undefined) ||
              null,
            payload_json: serializeBigInt(args) as object,
          },
        });
        inserted++;
      }
    }

    fromBlock = toBlock + 1n;
    chunks++;
  }

  return { scanned: fromBlock - startBlock, inserted };
}
