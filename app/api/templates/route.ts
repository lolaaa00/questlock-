import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const templates = await prisma.questTemplate.findMany({ orderBy: { created_at: "asc" } });
  return NextResponse.json(templates);
}
