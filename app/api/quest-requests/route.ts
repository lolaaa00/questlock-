import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import { identifyRequest, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const REQUEST_RATE = {
  windowMs: 60_000,
  max: 3,
  scope: "quest-request-create",
} as const;

// POST /api/quest-requests — public sponsor submission
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title,
      description,
      requirements,
      reward_amount,
      reward_token_address,
      badge_id,
      min_score,
      max_claims,
      deadline_days,
      sponsor_name,
      sponsor_email,
      sponsor_wallet,
      proof_type,                   // v1.2 — adapter selection
    } = body;

    if (!title || !description || !reward_amount || !sponsor_wallet) {
      return NextResponse.json(
        { error: "title, description, reward_amount and sponsor_wallet are required." },
        { status: 400 }
      );
    }

    const wallet = String(sponsor_wallet).toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: "Invalid sponsor_wallet." }, { status: 400 });
    }

    const rl = rateLimit(identifyRequest(req, wallet), REQUEST_RATE);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many quest requests. Please slow down.", retryAfterMs: rl.retryAfterMs },
        { status: 429 }
      );
    }

    const created = await prisma.questRequest.create({
      data: {
        title: String(title).slice(0, 200),
        description: String(description).slice(0, 4000),
        requirements: requirements ? String(requirements).slice(0, 4000) : null,
        reward_amount: String(reward_amount),
        reward_token_address: reward_token_address || null,
        badge_id: Number(badge_id ?? 1),
        min_score: Math.min(100, Math.max(0, Number(min_score ?? 70))),
        max_claims: Math.max(1, Number(max_claims ?? 100)),
        deadline_days: Math.max(1, Number(deadline_days ?? 30)),
        sponsor_name: sponsor_name ? String(sponsor_name).slice(0, 120) : null,
        sponsor_email: sponsor_email ? String(sponsor_email).slice(0, 200) : null,
        sponsor_wallet: wallet,
        proof_type: ["github_project","manual_project","discord_role","x_post","lms_course"].includes(String(proof_type))
          ? String(proof_type)
          : "github_project",
        status: "PENDING_REVIEW",
      },
    });

    await log("info", "quest-requests", "Quest request submitted", {
      id: created.id,
      wallet,
    });

    return NextResponse.json({ id: created.id, status: created.status }, { status: 201 });
  } catch (err) {
    console.error("[api/quest-requests POST]", err);
    return NextResponse.json({ error: "Failed to submit quest request." }, { status: 500 });
  }
}

// GET /api/quest-requests?wallet= — sponsor can list their own requests
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet")?.toLowerCase();
  if (!wallet || !/^0x[a-f0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ error: "Valid wallet query param required." }, { status: 400 });
  }
  const items = await prisma.questRequest.findMany({
    where: { sponsor_wallet: wallet },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      title: true,
      reward_amount: true,
      status: true,
      onchain_quest_id: true,
      published_quest_id: true,
      rejection_reason: true,
      created_at: true,
      updated_at: true,
    },
  });
  return NextResponse.json(
    items.map((i) => ({
      ...i,
      onchain_quest_id: i.onchain_quest_id ? i.onchain_quest_id.toString() : null,
    }))
  );
}
