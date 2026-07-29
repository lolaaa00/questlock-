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
    const reason = body.reason
      ? String(body.reason).slice(0, 500)
      : "Rejected by admin.";

    const existing = await prisma.questRequest.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (["PUBLISHED", "REJECTED"].includes(existing.status)) {
      return NextResponse.json(
        { error: `Cannot reject in current status: ${existing.status}` },
        { status: 400 }
      );
    }

    const adminWallet = req.headers.get("x-wallet-address") || null;
    await prisma.questRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejection_reason: reason,
        reviewed_by: adminWallet,
        reviewed_at: new Date(),
      },
    });

    await log("info", "ops-ql/quest-requests", "Quest request rejected", {
      id,
      adminWallet,
      reason,
    });

    return NextResponse.json({ id, status: "REJECTED" });
  } catch (err) {
    console.error("[reject]", err);
    return NextResponse.json({ error: "Failed to reject." }, { status: 500 });
  }
}
