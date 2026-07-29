"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";

interface SponsorQuest {
  id: string;
  title: string;
  contract_version: number;
  funding_status: string;
  reward_amount: string;
  max_claims: number;
  funded_amount: string | null;
  required_funding: string | null;
  status: string;
  deadline: string;
  _count: { submissions: number };
}

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  FUNDED: { bg: "rgba(122,158,111,0.35)", fg: "#F6F1EA" },
  PARTIALLY_FUNDED: { bg: "#7A5A20", fg: "#FFF1D6" },
  UNFUNDED: { bg: "#7A5A20", fg: "#FFF1D6" },
  UNDERFUNDED: { bg: "rgba(196,80,64,0.3)", fg: "#F0DADA" },
  CLOSED: { bg: "#3a3a3a", fg: "var(--ql-cafe)" },
  REFUNDED: { bg: "#3a3a3a", fg: "var(--ql-cafe)" },
  LEGACY_SHARED: { bg: "rgba(255,255,255,0.06)", fg: "var(--ql-cafe)" },
};

export default function SponsorHome() {
  const { authenticated, user, login } = usePrivy();
  const [quests, setQuests] = useState<SponsorQuest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trust, setTrust] = useState<{
    level: "new" | "trusted" | "flagged" | "suspended";
    successful_confirmed_approvals: number;
    approvals_until_trusted: number | null;
  } | null>(null);
  const wallet = user?.wallet?.address;

  useEffect(() => {
    if (!wallet) return;
    setLoading(true);
    setError(null);
    fetch(`/api/sponsor/quests?wallet=${wallet}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`Failed (HTTP ${r.status})`);
        return r.json();
      })
      .then((d) => setQuests(Array.isArray(d) ? d : []))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
    // v1.2.1 — pull sponsor trust tier alongside the quest list
    fetch(`/api/sponsor/trust-status?wallet=${wallet}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setTrust(d))
      .catch(() => {});
  }, [wallet]);

  if (!authenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: "var(--background)" }}>
        <p className="font-sans text-2xl mb-3" style={{ color: "#F0E6E2" }}>
          Connect to view your sponsored quests
        </p>
        <button onClick={login} className="px-6 py-3 rounded-full font-medium text-sm"
          style={{ background: "#B01020", color: "#F6F1EA" }}>Connect Wallet</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-6 sm:py-10 px-4 sm:px-6" style={{ background: "var(--background)" }}>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-sans text-3xl font-bold" style={{ color: "#F0E6E2" }}>
              Sponsor Dashboard
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--ql-bear)" }}>
              Quests where you are recorded as sponsor.
            </p>
          </div>
          <Link href="/create" className="px-5 py-2.5 rounded-full text-sm font-semibold"
            style={{ background: "#B01020", color: "#F6F1EA" }}>+ Request quest</Link>
        </div>

        {/* v1.2.1 — Sponsor trust banner */}
        {trust && (
          <div className="rounded-[18px] px-5 py-4 mb-6 flex items-center justify-between gap-3 flex-wrap"
            style={
              trust.level === "trusted"
                ? { background: "#D9EDD9", color: "rgba(122,158,111,0.35)", border: "1px solid #2D5A2D" }
                : trust.level === "flagged"
                ? { background: "#F0DADA", color: "#7A2020", border: "1px solid rgba(196,80,64,0.3)" }
                : trust.level === "suspended"
                ? { background: "rgba(196,80,64,0.3)", color: "#F0DADA", border: "1px solid rgba(196,80,64,0.3)" }
                : { background: "#FFF1D6", color: "#7A5A20", border: "1px solid #7A5A20" }
            }>
            <div>
              <p className="text-xs uppercase tracking-widest font-semibold mb-1">
                Sponsor trust · {trust.level}
              </p>
              <p className="text-sm">
                {trust.level === "new" && (
                  <>Your first {trust.approvals_until_trusted ?? 3} manual approval{(trust.approvals_until_trusted ?? 3) === 1 ? "" : "s"} require admin confirmation before reward fires.</>
                )}
                {trust.level === "trusted" && (
                  <>Your approvals fire onchain immediately for standard-value quests. High-value quests (reward × max_claims ≥ 500 QUEST) still need admin sign-off.</>
                )}
                {trust.level === "flagged" && (
                  <>Your approvals are temporarily routed back to admin confirmation. Contact admin to clear.</>
                )}
                {trust.level === "suspended" && (
                  <>You cannot approve submissions right now. Reject still works. Contact admin.</>
                )}
              </p>
            </div>
            <span className="text-xs font-mono opacity-80">
              {trust.successful_confirmed_approvals} confirmed approval{trust.successful_confirmed_approvals === 1 ? "" : "s"}
            </span>
          </div>
        )}

        {loading ? (
          <div className="space-y-4" aria-label="Loading sponsored quests">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-[18px] p-6 animate-pulse"
                style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <div className="h-4 w-2/3 rounded mb-3" style={{ background: "var(--muted)" }} />
                <div className="h-3 w-1/3 rounded" style={{ background: "var(--muted)" }} />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-[18px] p-6 text-center"
            style={{ background: "rgba(196,80,64,0.1)", border: "1px solid rgba(196,80,64,0.3)", color: "#F0DADA" }}>
            <p className="text-sm mb-3">Couldn&apos;t load your sponsored quests.</p>
            <p className="text-xs mb-4 opacity-80">{error}</p>
            <button onClick={() => location.reload()} className="px-4 py-2 rounded-full text-xs font-medium"
              style={{ background: "#B01020", color: "#F6F1EA" }}>Retry</button>
          </div>
        ) : quests.length === 0 ? (
          <div className="rounded-[18px] p-10 text-center"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <p className="font-sans text-lg mb-2" style={{ color: "#F0E6E2" }}>
              No sponsored quests yet
            </p>
            <p className="text-sm mb-4" style={{ color: "var(--ql-bear)" }}>
              Request a quest at <Link href="/create" className="underline" style={{ color: "#B01020" }}>/create</Link> —
              once an admin approves and publishes it, it will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {quests.map((q) => {
              const tone = STATUS_TONE[q.funding_status] || STATUS_TONE.LEGACY_SHARED;
              return (
                <Link key={q.id} href={`/sponsor/quests/${q.id}`}
                  className="block rounded-[18px] p-6 transition-opacity hover:opacity-90"
                  style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                    <p className="font-semibold text-lg" style={{ color: "#F0E6E2" }}>{q.title}</p>
                    <div className="flex items-center gap-2">
                      {q.contract_version === 2 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full"
                          style={{ background: "var(--muted)", color: "var(--ql-bear)" }}>v1.2 funded</span>
                      )}
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{ background: tone.bg, color: tone.fg }}>
                        {q.funding_status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs" style={{ color: "var(--ql-bear)" }}>
                    {q.reward_amount} QUEST · {q._count.submissions}/{q.max_claims} claimed
                    {q.contract_version === 2 && q.funded_amount && q.required_funding && (
                      <> · funded {q.funded_amount}/{q.required_funding}</>
                    )}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
