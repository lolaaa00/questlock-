import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeBigInt } from "@/lib/bigint";

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) {
    return NextResponse.json({ error: "Missing wallet parameter." }, { status: 400 });
  }

  try {
    const submissions = await prisma.submission.findMany({
      where: {
        wallet_address: { equals: wallet, mode: "insensitive" },
      },
      orderBy: { created_at: "desc" },
      include: {
        quest: {
          select: {
            id: true,
            title: true,
            reward_amount: true,
            badge_id: true,
          },
        },
      },
    });

    return NextResponse.json(serializeBigInt(submissions));
  } catch (err) {
    console.error("[api/submissions GET]", err);
    return NextResponse.json({ error: "Failed to fetch submissions." }, { status: 500 });
  }
}
