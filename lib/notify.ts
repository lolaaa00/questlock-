// v1.2 — tiny notification helper used by other libs/routes.
import { prisma } from "./prisma";

export type NotificationType =
  | "proof_submitted" | "proof_passed" | "proof_failed"
  | "claim_available" | "claim_succeeded" | "badge_minted"
  | "appeal_submitted" | "appeal_approved" | "appeal_rejected"
  | "request_submitted" | "request_approved" | "request_rejected" | "request_published"
  | "quest_funded" | "quest_underfunded" | "quest_closed" | "funds_withdrawn"
  | "needs_topup";

export async function notify(args: {
  walletAddress: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        wallet_address: args.walletAddress.toLowerCase(),
        type: args.type, title: args.title, message: args.message,
        metadata_json: (args.metadata ?? {}) as object,
      },
    });
  } catch {
    // Non-blocking — notification failure must never affect the caller.
  }
}
