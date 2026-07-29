// Manual review path. When an admin approves an appeal we:
//   1. Reuse the existing proof_hash if present, otherwise mint a new one
//      against (questId, wallet, repo, demo, score, now).
//   2. Issue an EAS attestation with riskBand = "MANUAL_REVIEW" so the
//      public certificate clearly shows this was not a pure deterministic
//      pass.
//   3. Call QuestLockCore.submitAndApprove via the verifier wallet — same
//      function v1 already uses — so we do not need a contract redeploy.
//   4. The contract enforces score >= quest.minScore, so if the original
//      deterministic score was below the bar we lift the onchain score
//      reported to minScore. The EAS attestation still records the actual
//      score so nothing is hidden.
//
// LIMITATION: the contract has no way to flip an existing onchain REJECTED
// status into APPROVED. submitAndApprove requires the user's current
// onchain submission status to be NONE. v1 failed submissions never get
// recorded onchain so this is fine in practice, but if a verifier ever
// called rejectSubmission for this user/quest the appeal cannot be
// resolved without a contract change. We surface that as APPROVE_FAILED.

import { createAttestation } from "./eas";
import { approveSubmissionOnchain } from "./approval";
import { createProofHash, proofHashToBytes32 } from "./proof-hash";

interface AppealApproveInput {
  questOnchainId: bigint;
  questMinScore: number;
  walletAddress: `0x${string}`;
  repoUrl: string;
  demoUrl?: string | null;
  score: number;
  existingProofHash: string | null;
  questDbId: string;
  contractVersion?: 1 | 2;  // v1.2 routing
}

export interface AppealApproveResult {
  attestationUid: string;
  txHashApproval: string;
  proofHashUsed: string;
  scoreOnchain: number;
}

export async function approveAppealOnchain(
  input: AppealApproveInput
): Promise<AppealApproveResult> {
  // 1. Decide proof hash — reuse the one stored at evaluation time if any,
  //    otherwise produce one now. Either way the same bytes32 is sent both
  //    to EAS and to the onchain submitAndApprove call so they line up.
  const timestamp = Math.floor(Date.now() / 1000);
  const proofHashHex =
    input.existingProofHash ||
    createProofHash({
      questId: input.questDbId,
      walletAddress: input.walletAddress,
      repoUrl: input.repoUrl,
      demoUrl: input.demoUrl || undefined,
      score: input.score,
      timestamp,
    });
  const proofHashBytes32 = proofHashToBytes32(proofHashHex);

  // 2. Bump the onchain score to clear minScore if the original was below.
  const scoreOnchain = Math.max(input.score, input.questMinScore);

  // 3. EAS attestation tagged MANUAL_REVIEW. Records the real score so
  //    nothing about the manual override is hidden from public view.
  const attestationUid = await createAttestation({
    questId: input.questOnchainId,
    user: input.walletAddress,
    proofType: "github_project",
    proofHash: proofHashBytes32,
    score: input.score,
    riskBand: "MANUAL_REVIEW",
    approved: true,
  });

  // 4. Onchain approval via the verifier wallet. Reuses the existing
  //    submitAndApprove path so no contract redeploy is needed.
  const txHashApproval = await approveSubmissionOnchain({
    questId: input.questOnchainId,
    user: input.walletAddress,
    proofHash: proofHashBytes32,
    attestationUID: attestationUid as `0x${string}`,
    score: scoreOnchain,
    contractVersion: input.contractVersion ?? 1,
  });

  return {
    attestationUid,
    txHashApproval,
    proofHashUsed: proofHashHex,
    scoreOnchain,
  };
}
