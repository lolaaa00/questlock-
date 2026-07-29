// v1.2.1 — Admin overrides a sponsor's approval. DB-only reject (no onchain
// rejectSubmission call — preserves v1.1 invariant). Does NOT auto-flag the
// sponsor; that's a separate admin action via /api/admin/sponsors/[wallet]/flag.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import { SUBMISSION_STATUS } from "@/lib/sponsor-trust";

function isAdmin(req: NextRequest): boolean {
  const adminWallet = process.env.ADMIN_WALLET_ADDRESS?.toLowerCase();
  const caller = req.headers.get("x-wallet-address")?.toLowerCase();
  return Boolean(adminWallet && caller && adminWallet === caller);
}

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const reason = (body.reason as string | undefined)?.trim().slice(0, 500) || null;

  const sub = await prisma.submission.findUnique({ where: { id }, include: { quest: true } });
  if (!sub) return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  if (sub.tx_hash_approval) {
    return NextResponse.json({ error: "Already approved onchain." }, { status: 400 });
  }
  if (sub.status !== SUBMISSION_STATUS.SPONSOR_APPROVED_PENDING_ADMIN) {
    return NextResponse.json({
      error: `Not awaiting admin confirmation (current status: ${sub.status}).`,
    }, { status: 400 });
  }

  const existing = Array.isArray(sub.failure_reasons_json) ? sub.failure_reasons_json as unknown[] : [];
  const nextReasons = [
    ...existing,
    reason ? `Admin override of sponsor approval: ${reason}` : "Admin overrode sponsor approval.",
  ];

  await prisma.submission.update({
    where: { id: sub.id },
    data: { status: "REJECTED", failure_reasons_json: nextReasons as object },
  });

  await log("info", "admin.confirmations.reject", "Admin overrode sponsor approval", {
    submissionId: sub.id, sponsor: sub.quest.sponsor_wallet, reason,
  });

  return NextResponse.json({ ok: true });
}
