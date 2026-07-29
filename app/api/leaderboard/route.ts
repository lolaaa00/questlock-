// Public leaderboard — strictly public-safe data only.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const proofType = req.nextUrl.searchParams.get("proof_type");
  const badgeIdRaw = req.nextUrl.searchParams.get("badge_id");

  // v1.2 — Submission table doesn't carry badge_id directly; filter via the
  // quest relation.
  const where: Record<string, unknown> = { status: "CLAIMED" };
  if (proofType) where.proof_type = proofType;
  if (badgeIdRaw && /^\d+$/.test(badgeIdRaw)) {
    where.quest = { badge_id: BigInt(badgeIdRaw) };
  }

  const rows = await prisma.submission.groupBy({
    by: ["wallet_address"],
    where,
    _count: { wallet_address: true },
    _avg: { score: true },
    orderBy: { _count: { wallet_address: "desc" } },
    take: 50,
  });

  const wallets = rows.map((r) => r.wallet_address);
  const users = wallets.length === 0 ? [] : await prisma.user.findMany({
    where: { wallet_address: { in: wallets } },
    select: { wallet_address: true, github_login: true, display_name: true },
  });
  const discords = wallets.length === 0 ? [] : await prisma.discordConnection.findMany({
    where: { wallet_address: { in: wallets }, revoked_at: null },
    select: { wallet_address: true, discord_username: true },
  });
  const userMap = new Map(users.map((u) => [u.wallet_address.toLowerCase(), u]));
  const discordMap = new Map(discords.map((d) => [d.wallet_address.toLowerCase(), d]));

  const leaderboard = rows.map((r, idx) => {
    const w = r.wallet_address.toLowerCase();
    const u = userMap.get(w);
    return {
      rank: idx + 1,
      wallet_short: `${r.wallet_address.slice(0, 6)}…${r.wallet_address.slice(-4)}`,
      // v1.2 fallback chain: display_name → github_login → short wallet
      display_name: u?.display_name ?? null,
      github_login: u?.github_login ?? null,
      discord_username: discordMap.get(w)?.discord_username ?? null,
      completed_quests: r._count.wallet_address,
      average_score: r._avg.score !== null
        ? Math.round((r._avg.score as number) * 10) / 10 : null,
    };
  });
  return NextResponse.json({
    leaderboard,
    filters: { proof_type: proofType, badge_id: badgeIdRaw },
  });
}
