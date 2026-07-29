// Backend guard preventing a quest's creator or sponsor from submitting
// proof to their own quest. Backend-enforced for v1.1 — no contract change.
// Case-insensitive comparison is intentional: wallets render in mixed case
// across Privy / wagmi / Etherscan but are byte-equal lowercased.

export interface CreatorGuardQuest {
  created_by: string | null;
  sponsor_wallet?: string | null;
}

export interface CreatorGuardResult {
  blocked: boolean;
  reason: "creator" | "sponsor" | null;
}

const CREATOR_GUARD_MESSAGE =
  "You cannot submit proof for a quest you created or sponsored.";

export function checkCreatorGuard(
  walletAddress: string,
  quest: CreatorGuardQuest
): CreatorGuardResult {
  if (!walletAddress) return { blocked: false, reason: null };
  const wallet = walletAddress.toLowerCase();

  if (quest.created_by && quest.created_by.toLowerCase() === wallet) {
    return { blocked: true, reason: "creator" };
  }
  if (quest.sponsor_wallet && quest.sponsor_wallet.toLowerCase() === wallet) {
    return { blocked: true, reason: "sponsor" };
  }
  return { blocked: false, reason: null };
}

export const CREATOR_GUARD_ERROR_MESSAGE = CREATOR_GUARD_MESSAGE;
