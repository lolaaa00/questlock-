// Contract registry. v1.2 introduces dual-contract routing — legacy quests
// stay on V1, new sponsor-funded quests live on V2.

export const CONTRACT_ADDRESSES = {
  QUESTLOCK_CORE: process.env.NEXT_PUBLIC_QUESTLOCK_CORE_ADDRESS as `0x${string}`,
  QUESTLOCK_CORE_V2: process.env.NEXT_PUBLIC_QUESTLOCK_CORE_V2_ADDRESS as `0x${string}` | undefined,
  QUEST_REWARD_TOKEN: process.env.NEXT_PUBLIC_QUEST_REWARD_TOKEN_ADDRESS as `0x${string}`,
  QUEST_BADGE: process.env.NEXT_PUBLIC_QUEST_BADGE_ADDRESS as `0x${string}`,
  EAS: (process.env.NEXT_PUBLIC_EAS_CONTRACT_ADDRESS ||
    "0x4200000000000000000000000000000000000021") as `0x${string}`,
};

/** Resolve the on-chain core address for a given quest's contract version. */
export function coreAddressFor(contractVersion: number | null | undefined): `0x${string}` {
  if (contractVersion === 2) {
    if (!CONTRACT_ADDRESSES.QUESTLOCK_CORE_V2) {
      throw new Error("QuestLockCoreV2 address missing — set NEXT_PUBLIC_QUESTLOCK_CORE_V2_ADDRESS");
    }
    return CONTRACT_ADDRESSES.QUESTLOCK_CORE_V2;
  }
  return CONTRACT_ADDRESSES.QUESTLOCK_CORE;
}

// V1 ABI (unchanged from v1.1.4)
export const QUEST_LOCK_CORE_ABI = [
  { inputs: [{ name: "questId", type: "uint256" }], name: "claimReward",
    outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "questId", type: "uint256" }, { name: "proofHash", type: "bytes32" }],
    name: "submitProofHash", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "questId", type: "uint256" }], name: "getQuest",
    outputs: [{ components: [
      { name: "id", type: "uint256" }, { name: "creator", type: "address" },
      { name: "rewardToken", type: "address" }, { name: "rewardAmount", type: "uint256" },
      { name: "badgeId", type: "uint256" }, { name: "startTime", type: "uint256" },
      { name: "deadline", type: "uint256" }, { name: "maxClaims", type: "uint256" },
      { name: "totalClaims", type: "uint256" }, { name: "minScore", type: "uint16" },
      { name: "active", type: "bool" },
    ], name: "", type: "tuple" }], stateMutability: "view", type: "function" },
] as const;

// V2 minimal ABI used by backend routes (full ABI is in typechain)
export const QUEST_LOCK_CORE_V2_ABI = [
  // Funding
  { inputs: [{ name: "questId", type: "uint256" }, { name: "amount", type: "uint256" }],
    name: "fundQuest", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "questId", type: "uint256" }, { name: "amount", type: "uint256" }],
    name: "topUpQuest", outputs: [], stateMutability: "nonpayable", type: "function" },
  // Submission / approval / claim
  { inputs: [
      { name: "questId", type: "uint256" }, { name: "user", type: "address" },
      { name: "proofHash", type: "bytes32" }, { name: "attestationUID", type: "bytes32" },
      { name: "score", type: "uint16" } ],
    name: "submitAndApprove", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "questId", type: "uint256" }, { name: "user", type: "address" }],
    name: "claimRewardFor", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "questId", type: "uint256" }, { name: "user", type: "address" }],
    name: "rejectSubmission", outputs: [], stateMutability: "nonpayable", type: "function" },
  // Withdrawal / close
  { inputs: [{ name: "questId", type: "uint256" }, { name: "amount", type: "uint256" }],
    name: "withdrawUnusedQuestFunds", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "questId", type: "uint256" }], name: "closeQuest",
    outputs: [], stateMutability: "nonpayable", type: "function" },
  // Creation
  { inputs: [
      { name: "sponsor", type: "address" }, { name: "rewardToken", type: "address" },
      { name: "rewardAmount", type: "uint256" }, { name: "badgeId", type: "uint256" },
      { name: "startTime", type: "uint256" }, { name: "deadline", type: "uint256" },
      { name: "maxClaims", type: "uint256" }, { name: "minScore", type: "uint16" } ],
    name: "createFundedQuest", outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable", type: "function" },
  // Views
  { inputs: [{ name: "questId", type: "uint256" }], name: "getQuestFunding",
    outputs: [
      { name: "funded", type: "uint256" }, { name: "claimed", type: "uint256" },
      { name: "withdrawn", type: "uint256" }, { name: "remaining", type: "uint256" },
    ], stateMutability: "view", type: "function" },
  // Event
  { anonymous: false, inputs: [
      { indexed: true, name: "questId", type: "uint256" },
      { indexed: true, name: "sponsor", type: "address" },
      { indexed: true, name: "creator", type: "address" },
      { indexed: false, name: "rewardToken", type: "address" },
      { indexed: false, name: "rewardAmount", type: "uint256" },
      { indexed: false, name: "maxClaims", type: "uint256" },
      { indexed: false, name: "deadline", type: "uint256" },
      { indexed: false, name: "requiredFunding", type: "uint256" },
    ], name: "FundedQuestCreated", type: "event" },
] as const;
