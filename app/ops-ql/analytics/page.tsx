"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import RewardPoolTopUp from "@/components/RewardPoolTopUp";

const ADMIN_WALLET = "0x1f63ea74065586af0c7c48428372d88d0a89525b";

interface QuestAnalytics {
  total_submissions: number;
  passed: number;
  failed: number;
  approved_onchain: number;
  claimable: number;
  claimed: number;
  in_progress: number;
  average_score: number | null;
  top_failure_reasons: Array<{ reason: string; count: number }>;
  approval_conversion_rate: number | null;
  claim_conversion_rate: number | null;
}

interface QuestRow {
  id: string;
  title: string;
  status: string;
  onchain_quest_id: string | null;
  reward_amount: string;
  badge_id: string;
  max_claims: number;
  deadline: string;
  analytics: QuestAnalytics;
  potential_outflow_remaining: string;
}

interface PoolCoverage {
  pool_balance: string;
  total_max_payout: string;
  coverage_ratio: number | null;
  coverage_pct: number | null;
  shortfall: string;
  status: "fully_covered" | "underfunded_warning" | "needs_topup" | null;
}

interface Payload {
  generated_at: string;
  reward_pool_balance: string | null;
  pool_coverage: PoolCoverage;
  global: {
    total_quests: number;
    total_submissions: number;
    total_approved_onchain: number;
    total_claimed: number;
    global_approval_conversion_rate: number | null;
    global_claim_conversion_rate: number | null;
    top_failure_reasons: Array<{ reason: string; count: number }>;
  };
  quests: QuestRow[];
}

function pct(v: number | null): string {
  if (v === null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

export default function AnalyticsPage() {
  const { authenticated, user, login } = usePrivy();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);
  const isAdmin =
    authenticated && user?.wallet?.address?.toLowerCase() === ADMIN_WALLET;

  async function load() {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const r = await fetch("/api/ops-ql/analytics", {
        headers: { "x-wallet-address": user?.wallet?.address || "" },
      });
      if (r.ok) setData(await r.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [isAdmin]);

  if (!authenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: "var(--ql-bighorn)" }}>
        <p className="font-sans text-2xl mb-4" style={{ color: "#F6F1EA" }}>Connect wallet</p>
        <button onClick={login} className="px-6 py-3 rounded-full text-sm" style={{ background: "#B01020", color: "#F6F1EA" }}>
          Connect
        </button>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ql-bighorn)" }}>
        <p style={{ color: "#F6F1EA" }}>Access denied.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--ql-bighorn)" }}>
      <div className="max-w-6xl mx-auto py-6 sm:py-10 px-4 sm:px-6">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-sans text-3xl font-bold" style={{ color: "#F6F1EA" }}>
            Analytics
          </h1>
          <div className="flex items-center gap-4">
            <button
              onClick={load}
              disabled={loading}
              className="text-xs px-4 py-2 rounded-full disabled:opacity-60"
              style={{ background: "rgba(255,255,255,0.08)", color: "var(--ql-ashen)" }}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            <Link href="/ops-ql" className="text-sm" style={{ color: "var(--ql-cafe)" }}>
              ← Admin
            </Link>
          </div>
        </div>

        {!data ? (
          <p className="text-sm" style={{ color: "var(--ql-cafe)" }}>Loading…</p>
        ) : (
          <>
            {/* Global tiles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: "Quests", value: data.global.total_quests },
                { label: "Submissions", value: data.global.total_submissions },
                { label: "Approved onchain", value: data.global.total_approved_onchain },
                { label: "Claimed", value: data.global.total_claimed },
              ].map((t) => (
                <div
                  key={t.label}
                  className="rounded-[18px] p-5"
                  style={{ background: "var(--ql-night)", border: "1px solid rgba(180,20,40,0.12)" }}
                >
                  <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--ql-cafe)" }}>
                    {t.label}
                  </p>
                  <p className="text-3xl font-bold font-mono" style={{ color: "#F6F1EA" }}>
                    {t.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="rounded-[18px] p-5" style={{ background: "var(--ql-night)", border: "1px solid rgba(180,20,40,0.12)" }}>
                <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--ql-cafe)" }}>
                  Approval conversion
                </p>
                <p className="text-2xl font-bold font-mono" style={{ color: "#F6F1EA" }}>
                  {pct(data.global.global_approval_conversion_rate)}
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--ql-bear)" }}>
                  approved / submitted
                </p>
              </div>
              <div className="rounded-[18px] p-5" style={{ background: "var(--ql-night)", border: "1px solid rgba(180,20,40,0.12)" }}>
                <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--ql-cafe)" }}>
                  Claim conversion
                </p>
                <p className="text-2xl font-bold font-mono" style={{ color: "#F6F1EA" }}>
                  {pct(data.global.global_claim_conversion_rate)}
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--ql-bear)" }}>
                  claimed / approved
                </p>
              </div>
              <div className="rounded-[18px] p-5" style={{ background: "var(--ql-night)", border: "1px solid rgba(180,20,40,0.12)" }}>
                <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--ql-cafe)" }}>
                  Reward pool (QUEST)
                </p>
                <p className="text-2xl font-bold font-mono" style={{ color: "#F6F1EA" }}>
                  {data.reward_pool_balance ?? "—"}
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--ql-bear)" }}>
                  QuestLockCore balance
                </p>
              </div>
              {(() => {
                const c = data.pool_coverage;
                const tone =
                  c.status === "fully_covered"
                    ? { bg: "rgba(122,158,111,0.35)", fg: "#F6F1EA", label: "Fully covered" }
                    : c.status === "underfunded_warning"
                    ? { bg: "#7A5A20", fg: "#FFF1D6", label: "Underfunded warning" }
                    : c.status === "needs_topup"
                    ? { bg: "rgba(196,80,64,0.3)", fg: "#F0DADA", label: "Pool needs top-up" }
                    : { bg: "rgba(255,255,255,0.05)", fg: "var(--ql-cafe)", label: "—" };
                return (
                  <div className="rounded-[18px] p-5" style={{ background: "var(--ql-night)", border: "1px solid rgba(180,20,40,0.12)" }}>
                    <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--ql-cafe)" }}>
                      Pool coverage
                    </p>
                    <p className="text-2xl font-bold font-mono" style={{ color: "#F6F1EA" }}>
                      {c.coverage_pct !== null ? `${c.coverage_pct}%` : "—"}
                    </p>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{ background: tone.bg, color: tone.fg }}
                      >
                        {tone.label}
                      </span>
                      {Number(c.shortfall) > 0 && (
                        <span className="text-xs font-mono" style={{ color: "#F0DADA" }}>
                          Shortfall: {c.shortfall} QUEST
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] mt-2" style={{ color: "var(--ql-bear)" }}>
                      balance / total max payout
                    </p>
                  </div>
                );
              })()}
            </div>

            {/* Global top failure reasons */}
            {data.global.top_failure_reasons.length > 0 && (
              <div
                className="rounded-[18px] overflow-hidden mb-8"
                style={{ border: "1px solid rgba(180,20,40,0.12)" }}
              >
                <div className="px-5 py-3" style={{ background: "var(--ql-night)" }}>
                  <p className="text-xs uppercase tracking-widest" style={{ color: "var(--ql-cafe)" }}>
                    Top failure reasons (all quests)
                  </p>
                </div>
                <table className="w-full text-sm" style={{ background: "rgba(255,255,255,0.02)" }}>
                  <tbody>
                    {data.global.top_failure_reasons.map((r, i) => (
                      <tr
                        key={i}
                        style={{ borderTop: i > 0 ? "1px solid rgba(180,20,40,0.08)" : undefined }}
                      >
                        <td className="px-5 py-2" style={{ color: "var(--ql-ashen)" }}>{r.reason}</td>
                        <td className="px-5 py-2 text-right font-mono" style={{ color: "var(--ql-cafe)" }}>{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Per-quest cards */}
            {/* Reward pool management (admin-only, wallet-signed) */}
            <RewardPoolTopUp
              adminWallet={ADMIN_WALLET}
              poolBalance={data.reward_pool_balance}
              totalMaxPayout={data.pool_coverage.total_max_payout}
              shortfall={data.pool_coverage.shortfall}
              poolCoveragePct={data.pool_coverage.coverage_pct}
              onSuccess={load}
            />

            <h2 className="font-sans text-xl font-semibold mb-1" style={{ color: "#F6F1EA" }}>
              Per quest
            </h2>
            <p className="text-xs mb-4" style={{ color: "var(--ql-bear)" }}>
              QuestLockCore holds one shared QUEST pool — there is no per-quest escrow.
              The number below is the maximum QUEST this quest could still pay out if
              every remaining claim slot is approved. It is not a reserved per-quest balance.
            </p>
            <div className="space-y-4">
              {data.quests.map((q) => (
                <div
                  key={q.id}
                  className="rounded-[18px] p-6"
                  style={{ background: "var(--ql-night)", border: "1px solid rgba(180,20,40,0.12)" }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div>
                      <p className="font-semibold text-lg" style={{ color: "#F6F1EA" }}>
                        {q.title}
                      </p>
                      <p className="text-xs mt-1" style={{ color: "var(--ql-cafe)" }}>
                        {q.reward_amount} QUEST · {q.analytics.claimed}/{q.max_claims} claimed · deadline {new Date(q.deadline).toLocaleDateString()}
                      </p>
                    </div>
                    <Link
                      href={`/quests/${q.id}`}
                      className="text-xs"
                      style={{ color: "#B01020" }}
                    >
                      View quest →
                    </Link>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
                    {[
                      { label: "Submitted", value: q.analytics.total_submissions },
                      { label: "Passed", value: q.analytics.passed },
                      { label: "Failed", value: q.analytics.failed },
                      { label: "Claimable", value: q.analytics.claimable },
                      { label: "Claimed", value: q.analytics.claimed },
                      { label: "Avg score", value: q.analytics.average_score ?? "—" },
                    ].map((t) => (
                      <div
                        key={t.label}
                        className="px-3 py-2 rounded-lg"
                        style={{ background: "rgba(255,255,255,0.04)" }}
                      >
                        <p className="text-[10px] uppercase tracking-widest" style={{ color: "var(--ql-cafe)" }}>
                          {t.label}
                        </p>
                        <p className="font-mono font-semibold" style={{ color: "#F6F1EA" }}>
                          {t.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-4 text-xs mb-4" style={{ color: "var(--ql-cafe)" }}>
                    <span>Approval: <span className="font-mono" style={{ color: "#F6F1EA" }}>{pct(q.analytics.approval_conversion_rate)}</span></span>
                    <span>Claim: <span className="font-mono" style={{ color: "#F6F1EA" }}>{pct(q.analytics.claim_conversion_rate)}</span></span>
                    <span>Max payout if fully claimed: <span className="font-mono" style={{ color: "#F6F1EA" }}>{q.potential_outflow_remaining} QUEST</span></span>
                  </div>

                  {q.analytics.top_failure_reasons.length > 0 && (
                    <div
                      className="rounded-lg overflow-hidden"
                      style={{ background: "rgba(255,255,255,0.03)" }}
                    >
                      <div className="px-3 py-2 text-[10px] uppercase tracking-widest" style={{ color: "var(--ql-cafe)" }}>
                        Top failure reasons
                      </div>
                      {q.analytics.top_failure_reasons.map((r, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between px-3 py-1.5 text-xs"
                          style={{ borderTop: "1px solid rgba(180,20,40,0.06)" }}
                        >
                          <span style={{ color: "var(--ql-ashen)" }}>{r.reason}</span>
                          <span className="font-mono shrink-0 ml-3" style={{ color: "var(--ql-cafe)" }}>{r.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <p className="text-[11px] text-center mt-8" style={{ color: "var(--ql-bear)" }}>
              Generated {new Date(data.generated_at).toLocaleString()} · Read-only · Cached briefly client-side
            </p>
          </>
        )}
      </div>
    </div>
  );
}
