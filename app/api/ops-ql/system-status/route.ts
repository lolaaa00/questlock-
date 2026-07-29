import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditEnv } from "@/lib/env";
import { serializeBigInt } from "@/lib/bigint";

function isAdmin(req: NextRequest): boolean {
  const adminWallet = process.env.ADMIN_WALLET_ADDRESS?.toLowerCase();
  const caller = req.headers.get("x-wallet-address")?.toLowerCase();
  return Boolean(adminWallet && caller && adminWallet === caller);
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const env = auditEnv();

  const [submissionCounts, latestEvent, recentLogs, totalEvents] =
    await Promise.all([
      prisma.submission.groupBy({
        by: ["status"],
        _count: { status: true },
      }),
      prisma.contractEvent.findFirst({
        orderBy: { block_number: "desc" },
        select: { block_number: true, event_name: true, created_at: true },
      }),
      prisma.systemLog.findMany({
        orderBy: { created_at: "desc" },
        take: 25,
      }),
      prisma.contractEvent.count(),
    ]);

  return NextResponse.json(
    serializeBigInt({
      env: {
        ok: env.ok,
        required_missing: env.required_missing,
        optional_missing: env.optional_missing,
      },
      submissions: {
        by_status: submissionCounts.map((g) => ({
          status: g.status,
          count: g._count.status,
        })),
      },
      indexer: {
        last_block: latestEvent?.block_number ?? null,
        last_event: latestEvent?.event_name ?? null,
        last_event_at: latestEvent?.created_at ?? null,
        total_events: totalEvents,
      },
      logs: recentLogs,
    })
  );
}
