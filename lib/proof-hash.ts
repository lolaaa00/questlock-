import { createHash } from "crypto";
import { hashValue } from "./antifarm";
import type { keccak256 } from "viem";

export interface ProofHashInput {
  questId: string;
  walletAddress: string;
  repoUrl: string;
  demoUrl?: string;
  score: number;
  timestamp: number;
}

export function createProofHash(input: ProofHashInput): string {
  const repoUrlHash = hashValue(input.repoUrl);
  const demoUrlHash = input.demoUrl ? hashValue(input.demoUrl) : "none";

  const canonical = [
    input.questId,
    input.walletAddress.toLowerCase(),
    repoUrlHash,
    demoUrlHash,
    input.score.toString(),
    input.timestamp.toString(),
  ].join("|");

  return "0x" + createHash("sha256").update(canonical).digest("hex");
}

export function proofHashToBytes32(hexHash: string): `0x${string}` {
  const clean = hexHash.startsWith("0x") ? hexHash.slice(2) : hexHash;
  return `0x${clean.padStart(64, "0")}` as `0x${string}`;
}
