import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditEnv } from "@/lib/env";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

export const dynamic = "force-dynamic";

interface CheckResult {
  ok: boolean;
  detail?: string;
  latency_ms?: number;
}

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T | null; ms: number; error?: string }> {
  const start = Date.now();
  try {
    const value = await fn();
    return { value, ms: Date.now() - start };
  } catch (err) {
    return {
      value: null,
      ms: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function GET() {
  const env = auditEnv();

  // DB ping
  const dbCheck: CheckResult = await (async () => {
    const r = await timed(() => prisma.$queryRaw`SELECT 1`);
    return r.error
      ? { ok: false, detail: r.error, latency_ms: r.ms }
      : { ok: true, latency_ms: r.ms };
  })();

  // RPC ping
  const rpcCheck: CheckResult = await (async () => {
    const rpcUrl =
      process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
    const client = createPublicClient({
      chain: baseSepolia,
      transport: http(rpcUrl),
    });
    const r = await timed(() => client.getBlockNumber());
    return r.error
      ? { ok: false, detail: r.error, latency_ms: r.ms }
      : { ok: true, latency_ms: r.ms, detail: `block ${r.value}` };
  })();

  const allOk = env.ok && dbCheck.ok && rpcCheck.ok;

  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      checks: {
        env: { ok: env.ok, missing: env.required_missing },
        database: dbCheck,
        rpc: rpcCheck,
      },
    },
    { status: allOk ? 200 : 503 }
  );
}
