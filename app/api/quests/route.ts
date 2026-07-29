import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeBigInt } from "@/lib/bigint";

export async function GET() {
  try {
    const quests = await prisma.quest.findMany({
      where: { status: "active" },
      orderBy: { created_at: "desc" },
      include: {
        _count: {
          select: { submissions: true },
        },
      },
    });
    return NextResponse.json(serializeBigInt(quests));
  } catch (err) {
    console.error("[api/quests GET]", err);
    return NextResponse.json({ error: "Failed to fetch quests." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title,
      description,
      quest_type = "github_project",
      proof_type,                   // v1.2 — adapter selection
      contract_version = 2,         // v1.2 — default V2 (V1 retired from new quests)
      requirements_json = {},
      scoring_rubric_json = {},
      min_score = 70,
      reward_amount,
      reward_token_address,
      badge_id = 1,
      start_time,
      deadline,
      max_claims = 100,
      onchain_quest_id,
      created_by,
      sponsor_wallet,
    } = body;

    if (!title || !reward_amount || !deadline || !created_by) {
      return NextResponse.json(
        { error: "Missing required fields: title, reward_amount, deadline, created_by." },
        { status: 400 }
      );
    }

    // v1.2 — proof_type defaults to legacy quest_type so old admin calls keep working.
    const resolvedProofType = proof_type ?? quest_type ?? "github_project";
    const resolvedVersion = Number(contract_version) === 1 ? 1 : 2;

    const quest = await prisma.quest.create({
      data: {
        title,
        description: description || "",
        quest_type,
        proof_type: resolvedProofType,
        contract_version: resolvedVersion,
        requirements_json,
        scoring_rubric_json,
        min_score,
        reward_amount: reward_amount.toString(),
        reward_token_address,
        badge_id: BigInt(badge_id),
        start_time: start_time ? new Date(start_time) : new Date(),
        deadline: new Date(deadline),
        max_claims,
        onchain_quest_id: onchain_quest_id ? BigInt(onchain_quest_id) : null,
        created_by,
        sponsor_wallet: sponsor_wallet ? String(sponsor_wallet).toLowerCase() : null,
        status: "active",
        funding_status: resolvedVersion === 2 ? "UNFUNDED" : "LEGACY_SHARED",
      },
    });

    return NextResponse.json(serializeBigInt(quest), { status: 201 });
  } catch (err) {
    console.error("[api/quests POST]", err);
    return NextResponse.json({ error: "Failed to create quest." }, { status: 500 });
  }
}
