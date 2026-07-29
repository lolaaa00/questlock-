import { NextRequest, NextResponse } from "next/server";
import { indexContractEvents } from "@/lib/event-indexer";

// /api/indexer
// Authorised by `x-indexer-secret` header matching the INDEXER_SECRET env var.
// Two callers in production:
//   1. Manual admin trigger via the Retry Centre ("Run indexer now" button).
//   2. External cron service (e.g. cron-job.org) hitting this URL with the
//      `x-indexer-secret` header. Vercel native cron was removed because the
//      Hobby tier caps it at one run/day which was too coarse for our needs.
function authorise(req: NextRequest): boolean {
  const header = req.headers.get("x-indexer-secret");
  return Boolean(process.env.INDEXER_SECRET && header === process.env.INDEXER_SECRET);
}

async function run(req: NextRequest) {
  if (!authorise(req)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  try {
    const result = await indexContractEvents();
    return NextResponse.json({
      ok: true,
      scanned: result.scanned.toString(),
      inserted: result.inserted,
    });
  } catch (err) {
    console.error("[api/indexer]", err);
    return NextResponse.json({ error: "Indexer failed." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) { return run(req); }
export async function POST(req: NextRequest) { return run(req); }
