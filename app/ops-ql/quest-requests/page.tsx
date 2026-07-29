"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { explorerTxUrl } from "@/lib/chains";

const ADMIN_WALLET = "0x1f63ea74065586af0c7c48428372d88d0a89525b";

interface QuestRequest {
  id: string;
  title: string;
  description: string;
  requirements: string | null;
  reward_amount: string;
  badge_id: number;
  min_score: number;
  max_claims: number;
  deadline_days: number;
  sponsor_name: string | null;
  sponsor_email: string | null;
  sponsor_wallet: string;
  status: string;
  admin_notes: string | null;
  rejection_reason: string | null;
  publish_tx_hash: string | null;
  publish_error: string | null;
  onchain_quest_id: string | null;
  published_quest_id: string | null;
  created_at: string;
}

const BADGE_NAMES: Record<number, string> = {
  1: "Verified Builder",
  2: "GitHub Contributor",
  3: "Protocol Researcher",
  4: "Serious Learner",
};

export default function OpsQuestRequestsPage() {
  const { authenticated, user, login } = usePrivy();
  const [items, setItems] = useState<QuestRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin =
    authenticated && user?.wallet?.address?.toLowerCase() === ADMIN_WALLET;

  async function refresh() {
    if (!isAdmin) return;
    const r = await fetch("/api/ops-ql/quest-requests", {
      headers: { "x-wallet-address": user?.wallet?.address || "" },
    });
    if (r.ok) setItems(await r.json());
  }

  useEffect(() => {
    refresh();
  }, [isAdmin]);

  async function callAction(
    id: string,
    action: "approve" | "reject" | "publish",
    body?: Record<string, string>
  ) {
    setBusyId(id);
    setError(null);
    try {
      const r = await fetch(`/api/ops-ql/quest-requests/${id}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": user?.wallet?.address || "",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error || `Action ${action} failed.`);
      } else {
        await refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

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
      <div className="max-w-5xl mx-auto py-6 sm:py-10 px-4 sm:px-6">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-sans text-3xl font-bold" style={{ color: "#F6F1EA" }}>
            Quest Requests
          </h1>
          <Link href="/ops-ql" className="text-sm" style={{ color: "var(--ql-cafe)" }}>
            ← Admin
          </Link>
        </div>

        {error && (
          <div className="rounded-xl px-4 py-3 mb-6 text-sm" style={{ background: "rgba(196,80,64,0.1)", color: "#F0DADA" }}>
            {error}
          </div>
        )}

        {items.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--ql-cafe)" }}>No requests yet.</p>
        ) : (
          <div className="space-y-4">
            {items.map((r) => (
              <div key={r.id} className="rounded-[18px] p-6"
                style={{ background: "var(--ql-night)", border: "1px solid rgba(180,20,40,0.12)" }}>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-lg" style={{ color: "#F6F1EA" }}>{r.title}</p>
                    <p className="text-xs mt-1" style={{ color: "var(--ql-cafe)" }}>
                      {r.reward_amount} QUEST · {BADGE_NAMES[r.badge_id]} · min {r.min_score} · {r.max_claims} claims · {r.deadline_days}d deadline
                    </p>
                    <p className="text-xs mt-1 font-mono break-all" style={{ color: "var(--ql-bear)" }}>
                      Sponsor: {r.sponsor_name || "—"} · {r.sponsor_wallet}
                    </p>
                    {r.sponsor_email && (
                      <p className="text-xs" style={{ color: "var(--ql-bear)" }}>{r.sponsor_email}</p>
                    )}
                  </div>
                  <span className="text-xs font-semibold uppercase px-3 py-1 rounded-full"
                    style={
                      r.status === "PUBLISHED" ? { background: "rgba(122,158,111,0.35)", color: "#F6F1EA" } :
                      r.status === "REJECTED" || r.status === "PUBLISH_FAILED" ? { background: "rgba(196,80,64,0.3)", color: "#F0DADA" } :
                      r.status === "APPROVED" ? { background: "#B01020", color: "#F6F1EA" } :
                      r.status === "PUBLISHING" ? { background: "rgba(255,255,255,0.08)", color: "var(--ql-cafe)" } :
                      { background: "#FFF1D6", color: "#7A5A20" }
                    }>
                    {r.status.replace("_", " ")}
                  </span>
                </div>

                <p className="text-sm mb-3" style={{ color: "var(--ql-ashen)" }}>{r.description}</p>

                {r.requirements && (
                  <div className="rounded-lg px-4 py-3 mb-3 text-xs whitespace-pre-wrap"
                    style={{ background: "rgba(255,255,255,0.04)", color: "var(--ql-cafe)" }}>
                    <strong>Requirements:</strong> {r.requirements}
                  </div>
                )}

                {r.rejection_reason && (
                  <p className="text-xs mb-3" style={{ color: "#F0DADA" }}>
                    Rejection reason: {r.rejection_reason}
                  </p>
                )}
                {r.publish_error && (
                  <p className="text-xs font-mono mb-3 break-all" style={{ color: "#F0DADA" }}>
                    Publish error: {r.publish_error}
                  </p>
                )}
                {r.publish_tx_hash && (
                  <p className="text-xs mb-3">
                    <a href={explorerTxUrl(r.publish_tx_hash)} target="_blank" rel="noopener noreferrer" style={{ color: "#B01020" }}>
                      Publish tx →
                    </a>
                    {r.onchain_quest_id && (
                      <span className="ml-3 font-mono" style={{ color: "var(--ql-cafe)" }}>
                        onchain quest #{r.onchain_quest_id}
                      </span>
                    )}
                  </p>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-3 pt-3" style={{ borderTop: "1px solid rgba(180,20,40,0.08)" }}>
                  {r.status === "PENDING_REVIEW" && (
                    <>
                      <button
                        onClick={() => callAction(r.id, "approve")}
                        disabled={busyId === r.id}
                        className="px-4 py-2 rounded-full text-xs font-semibold disabled:opacity-60"
                        style={{ background: "#B01020", color: "#F6F1EA" }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          const reason = prompt("Rejection reason:");
                          if (reason) callAction(r.id, "reject", { reason });
                        }}
                        disabled={busyId === r.id}
                        className="px-4 py-2 rounded-full text-xs font-semibold disabled:opacity-60"
                        style={{ background: "rgba(255,255,255,0.08)", color: "#F0DADA" }}
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {(r.status === "APPROVED" || r.status === "PUBLISH_FAILED") && (
                    <button
                      onClick={() => {
                        if (confirm("Publish this quest onchain? This will spend gas.")) {
                          callAction(r.id, "publish");
                        }
                      }}
                      disabled={busyId === r.id}
                      className="px-4 py-2 rounded-full text-xs font-semibold disabled:opacity-60"
                      style={{ background: "#B01020", color: "#F6F1EA" }}
                    >
                      {busyId === r.id ? "Publishing…" : r.status === "PUBLISH_FAILED" ? "Retry publish" : "Publish onchain"}
                    </button>
                  )}
                  {r.status === "PUBLISHED" && r.published_quest_id && (
                    <Link
                      href={`/quests/${r.published_quest_id}`}
                      className="px-4 py-2 rounded-full text-xs font-semibold"
                      style={{ background: "rgba(255,255,255,0.08)", color: "#F6F1EA" }}
                    >
                      View quest →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
