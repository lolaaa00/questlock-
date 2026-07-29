// Verifier-signed approval + reject for both V1 (legacy shared-pool) and V2
// (sponsor-funded). Routes by quest.contract_version. The function shape is
// identical across both contracts.

import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { coreAddressFor } from "./contracts";

const APPROVAL_ABI = parseAbi([
  "function submitProofHashFor(uint256 questId, address user, bytes32 proofHash) external",
  "function submitAndApprove(uint256 questId, address user, bytes32 proofHash, bytes32 attestationUID, uint16 score) external",
  "function approveSubmission(uint256 questId, address user, bytes32 proofHash, bytes32 attestationUID, uint16 score) external",
  "function rejectSubmission(uint256 questId, address user) external",
]);

function getVerifierClient() {
  if (!process.env.VERIFIER_PRIVATE_KEY) throw new Error("VERIFIER_PRIVATE_KEY not set");
  const account = privateKeyToAccount(process.env.VERIFIER_PRIVATE_KEY as `0x${string}`);
  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
  const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(rpcUrl) });
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) });
  return { walletClient, publicClient };
}

export interface ApproveParams {
  questId: bigint;
  user: `0x${string}`;
  proofHash: `0x${string}`;
  attestationUID: `0x${string}`;
  score: number;
  contractVersion?: 1 | 2;  // defaults to 1 (legacy)
}

export async function approveSubmissionOnchain(params: ApproveParams): Promise<string> {
  const { walletClient, publicClient } = getVerifierClient();
  const address = coreAddressFor(params.contractVersion ?? 1);

  const hash = await walletClient.writeContract({
    address, abi: APPROVAL_ABI, functionName: "submitAndApprove",
    args: [params.questId, params.user, params.proofHash, params.attestationUID, params.score],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === "reverted") {
    throw new Error(`submitAndApprove reverted on contract v${params.contractVersion ?? 1}. tx=${hash}`);
  }
  return hash;
}

export async function rejectSubmissionOnchain(params: {
  questId: bigint;
  user: `0x${string}`;
  contractVersion?: 1 | 2;
}): Promise<string> {
  const { walletClient, publicClient } = getVerifierClient();
  const address = coreAddressFor(params.contractVersion ?? 1);
  const hash = await walletClient.writeContract({
    address, abi: APPROVAL_ABI, functionName: "rejectSubmission",
    args: [params.questId, params.user],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}
