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
    const adminNotes = body.admin_notes ? String(body.admin_notes).slice(0, 1000) : null;

    const existing = await prisma.questRequest.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    if (existing.status !== "PENDING_REVIEW") {
      return NextResponse.json(
        { error: `Cannot approve in current status: ${existing.status}` },
        { status: 400 }
      );
    }

    const adminWallet = req.headers.get("x-wallet-address") || null;
    const updated = await prisma.questRequest.update({
      where: { id },
      data: {
        status: "APPROVED",
        admin_notes: adminNotes,
        reviewed_by: adminWallet,
        reviewed_at: new Date(),
      },
    });

    await log("info", "ops-ql/quest-requests", "Quest request approved", {
      id,
      adminWallet,
    });

    return NextResponse.json({ id: updated.id, status: updated.status });
  } catch (err) {
    console.error("[approve]", err);
    return NextResponse.json({ error: "Failed to approve." }, { status: 500 });
  }
}
