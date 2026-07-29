// v1.2.1 — Tiered sponsor trust.
//
// Sponsor levels:
//   - "new"       : sponsor approval moves submission to SPONSOR_APPROVED_PENDING_ADMIN.
//                   admin must confirm before reward fires. promotion to "trusted"
//                   happens after THRESHOLD_TRUSTED admin-confirmed approvals.
//   - "trusted"   : sponsor approval fires onchain immediately UNLESS the quest is
//                   high-value (see isHighValueQuest below), in which case admin
//                   must still confirm.
//   - "flagged"   : sponsor can still approve, but every approval routes back to
//                   admin confirmation regardless of quest value. counter is reset.
//   - "suspended" : sponsor cannot approve at all. only reject is allowed.
//
// Admin always has the final override via the appeals queue.

import { prisma } from "./prisma";

export type SponsorTrustLevel = "new" | "trusted" | "flagged" | "suspended";

export const SPONSOR_TRUST = {
  /** Admin-confirmed approvals required to promote `new` -> `trusted`. */
  THRESHOLD_TRUSTED: 3,
  /** Quest is "high-value" when potential outflow (reward × max_claims) ≥ this many QUEST. */
  HIGH_VALUE_QUEST_QUEST: 500,
} as const;

export const SUBMISSION_STATUS = {
  /** New v1.2.1 status — sponsor approved, awaiting admin confirmation before onchain. */
  SPONSOR_APPROVED_PENDING_ADMIN: "SPONSOR_APPROVED_PENDING_ADMIN",
} as const;

export interface SponsorTrust {
  wallet: string;
  level: SponsorTrustLevel;
  successful_confirmed_approvals: number;
  /** How many more admin confirmations until promotion to trusted. null if not new. */
  approvals_until_trusted: number | null;
}

export async function getSponsorTrust(wallet: string): Promise<SponsorTrust> {
  const w = wallet.toLowerCase();
  // Upsert ensures every sponsor wallet has a row so we can show their trust
  // even if they haven't done anything else on the platform yet.
  const u = await prisma.user.upsert({
    where: { wallet_address: w },
    update: {},
    create: { wallet_address: w },
    select: { sponsor_trust_level: true, successful_confirmed_approvals: true },
  });
  const level = (u.sponsor_trust_level || "new") as SponsorTrustLevel;
  const approvals_until_trusted = level === "new"
    ? Math.max(0, SPONSOR_TRUST.THRESHOLD_TRUSTED - u.successful_confirmed_approvals)
    : null;
  return {
    wallet: w,
    level,
    successful_confirmed_approvals: u.successful_confirmed_approvals,
    approvals_until_trusted,
  };
}

export function isHighValueQuest(input: { reward_amount: string; max_claims: number }): boolean {
  // reward_amount is a stringified integer (no decimals on testnet QUEST).
  const reward = Number(input.reward_amount) || 0;
  const maxClaims = input.max_claims || 0;
  return reward * maxClaims >= SPONSOR_TRUST.HIGH_VALUE_QUEST_QUEST;
}

/**
 * Decide whether a sponsor's approval should fire onchain immediately or
 * route to admin confirmation. Returns a discriminated result so the caller
 * can both act and explain the decision in logs / UI.
 */
export function decideApprovalRoute(opts: {
  sponsor: SponsorTrust;
  quest: { reward_amount: string; max_claims: number };
}): { route: "onchain" | "admin_confirm"; reason: string } {
  if (opts.sponsor.level === "suspended") {
    return { route: "admin_confirm", reason: "Sponsor is suspended — admin must decide." };
  }
  if (opts.sponsor.level === "flagged") {
    return { route: "admin_confirm", reason: "Sponsor is flagged — admin confirmation required." };
  }
  if (opts.sponsor.level === "new") {
    return {
      route: "admin_confirm",
      reason: `New sponsor — ${opts.sponsor.approvals_until_trusted ?? "n"} more admin-confirmed approvals until trusted.`,
    };
  }
  // trusted
  if (isHighValueQuest(opts.quest)) {
    return {
      route: "admin_confirm",
      reason: `High-value quest (reward × max_claims ≥ ${SPONSOR_TRUST.HIGH_VALUE_QUEST_QUEST} QUEST) — admin confirmation required.`,
    };
  }
  return { route: "onchain", reason: "Trusted sponsor on a standard-value quest." };
}

/**
 * Called after an admin successfully confirms a sponsor's pending approval.
 * Bumps the counter and promotes to "trusted" if the threshold is hit.
 * Idempotent: takes the submission id and only counts each submission once
 * even if the admin somehow re-runs confirm (the submission's tx_hash_approval
 * being non-null is the real idempotency check; this helper assumes the caller
 * already gated on that).
 */
export async function recordAdminConfirmedApproval(sponsorWallet: string): Promise<{
  newCount: number;
  promoted: boolean;
}> {
  const w = sponsorWallet.toLowerCase();
  const u = await prisma.user.findUnique({
    where: { wallet_address: w },
    select: { sponsor_trust_level: true, successful_confirmed_approvals: true },
  });
  if (!u) {
    // First-time row; create at count=1.
    await prisma.user.create({
      data: { wallet_address: w, successful_confirmed_approvals: 1 },
    });
    return { newCount: 1, promoted: false };
  }
  const next = u.successful_confirmed_approvals + 1;
  const shouldPromote = u.sponsor_trust_level === "new" && next >= SPONSOR_TRUST.THRESHOLD_TRUSTED;
  await prisma.user.update({
    where: { wallet_address: w },
    data: {
      successful_confirmed_approvals: next,
      sponsor_trust_level: shouldPromote ? "trusted" : u.sponsor_trust_level,
    },
  });
  return { newCount: next, promoted: shouldPromote };
}

/** Admin flips a sponsor's trust level. flagging also resets the counter. */
export async function setSponsorTrustLevel(
  sponsorWallet: string,
  level: SponsorTrustLevel
): Promise<void> {
  const w = sponsorWallet.toLowerCase();
  const resetCounter = level === "flagged" || level === "suspended" || level === "new";
  await prisma.user.upsert({
    where: { wallet_address: w },
    update: {
      sponsor_trust_level: level,
      ...(resetCounter ? { successful_confirmed_approvals: 0 } : {}),
    },
    create: {
      wallet_address: w,
      sponsor_trust_level: level,
      successful_confirmed_approvals: 0,
    },
  });
}
