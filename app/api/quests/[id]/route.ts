import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeBigInt } from "@/lib/bigint";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const quest = await prisma.quest.findUnique({
      where: { id },
      include: {
        _count: { select: { submissions: { where: { status: "CLAIMED" } } } },
      },
    });

    if (!quest) {
      return NextResponse.json({ error: "Quest not found." }, { status: 404 });
    }

    return NextResponse.json(serializeBigInt(quest));
  } catch (err) {
    console.error("[api/quests/[id] GET]", err);
    return NextResponse.json({ error: "Failed to fetch quest." }, { status: 500 });
  }
}
