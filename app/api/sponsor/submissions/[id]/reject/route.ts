// v1.2 — Sponsor rejects their own quest's manual submission.
// Updates DB only — does NOT call rejectSubmission onchain (preserves the
// existing v1.1 invariant that the verifier never writes onchain REJECTED
// since that would foreclose any future appeal).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = req.headers.get("x-wallet-address")?.toLowerCase();
  if (!caller || !/^0x[a-f0-9]{40}$/.test(caller)) {
    return NextResponse.json({ error: "Connect a wallet." }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const reason = (body.reason as string | undefined)?.trim().slice(0, 500) || null;

  const sub = await prisma.submission.findUnique({
    where: { id }, include: { quest: true },
  });
  if (!sub) return NextResponse.json({ error: "Submission not found." }, { status: 404 });

  const sponsor = sub.quest.sponsor_wallet?.toLowerCase();
  if (!sponsor || sponsor !== caller) {
    return NextResponse.json(
      { error: "Only the quest sponsor can reject submissions on this quest." },
      { status: 403 }
    );
  }
  if (sub.tx_hash_approval) {
    return NextResponse.json(
      { error: "Submission is already approved onchain — cannot reject." },
      { status: 400 }
    );
  }

  const existingReasons = Array.isArray(sub.failure_reasons_json) ? sub.failure_reasons_json as unknown[] : [];
  const nextReasons = reason
    ? [...existingReasons, `Sponsor rejection: ${reason}`]
    : [...existingReasons, "Sponsor rejected the submission."];

  await prisma.submission.update({
    where: { id: sub.id },
    data: { status: "REJECTED", failure_reasons_json: nextReasons as object },
  });

  await log("info", "sponsor.submissions.reject", "Sponsor rejected submission", {
    submissionId: sub.id, sponsor, reason,
  });

  return NextResponse.json({ ok: true });
}
