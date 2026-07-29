import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";

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
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const notes = body.notes ? String(body.notes).slice(0, 1000) : null;

    const existing = await prisma.submissionAppeal.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (["APPROVED", "REJECTED"].includes(existing.status)) {
      return NextResponse.json(
        { error: `Cannot reject in status ${existing.status}` },
        { status: 400 }
      );
    }

    const adminWallet = req.headers.get("x-wallet-address") || null;
    await prisma.submissionAppeal.update({
      where: { id },
      data: {
        status: "REJECTED",
        admin_notes: notes,
        reviewed_by: adminWallet,
        reviewed_at: new Date(),
      },
    });

    await log("info", "ops-ql/appeals", "Appeal rejected", { id, adminWallet });
    return NextResponse.json({ id, status: "REJECTED" });
  } catch (err) {
    console.error("[appeals/reject]", err);
    return NextResponse.json({ error: "Failed to reject appeal." }, { status: 500 });
  }
}
