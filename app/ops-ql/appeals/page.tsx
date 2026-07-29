"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { explorerTxUrl, easAttestationUrl } from "@/lib/chains";

const ADMIN_WALLET = "0x1f63ea74065586af0c7c48428372d88d0a89525b";

interface Appeal {
  id: string;
  submission_id: string;
  wallet_address: string;
  reason: string;
  status: string;
  admin_notes: string | null;
  attestation_uid: string | null;
  tx_hash_approval: string | null;
  approve_error: string | null;
  created_at: string;
  submission: {
    id: string;
    status: string;
    score: number | null;
    risk_band: string | null;
    repo_url: string;
    demo_url: string | null;
    github_username: string;
    failure_reasons_json: unknown;
    quest: {
      id: string;
      title: string;
      onchain_quest_id: string | null;
      min_score: number;
    };
  };
}

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  PENDING: { bg: "#FFF1D6", fg: "#7A5A20" },
  PROCESSING: { bg: "rgba(255,255,255,0.08)", fg: "var(--ql-cafe)" },
  APPROVED: { bg: "rgba(122,158,111,0.35)", fg: "#F6F1EA" },
  REJECTED: { bg: "rgba(196,80,64,0.3)", fg: "#F0DADA" },
  APPROVE_FAILED: { bg: "rgba(196,80,64,0.3)", fg: "#F0DADA" },
};

export default function OpsAppealsPage() {
  const { authenticated, user, login } = usePrivy();
  const [items, setItems] = useState<Appeal[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin =
    authenticated && user?.wallet?.address?.toLowerCase() === ADMIN_WALLET;

  async function refresh() {
    if (!isAdmin) return;
    const r = await fetch("/api/ops-ql/appeals", {
      headers: { "x-wallet-address": user?.wallet?.address || "" },
    });
    if (r.ok) setItems(await r.json());
  }

  useEffect(() => {
    refresh();
  }, [isAdmin]);

  async function callAction(id: string, action: "approve" | "reject", notes?: string) {
    setBusyId(id);
    setError(null);
    try {
      const r = await fetch(`/api/ops-ql/appeals/${id}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": user?.wallet?.address || "",
        },
        body: notes ? JSON.stringify({ notes }) : undefined,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setError(d.error || d.detail || `Action ${action} failed.`);
      await refresh();
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
            Appeals Queue
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
          <p className="text-sm" style={{ color: "var(--ql-cafe)" }}>No appeals yet.</p>
        ) : (
          <div className="space-y-4">
            {items.map((a) => {
              const tone = STATUS_TONE[a.status] || STATUS_TONE.PENDING;
              const reasons = Array.isArray(a.submission.failure_reasons_json)
                ? (a.submission.failure_reasons_json as string[])
                : [];

              return (
                <div
                  key={a.id}
                  className="rounded-[18px] p-6"
                  style={{ background: "var(--ql-night)", border: "1px solid rgba(180,20,40,0.12)" }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-lg" style={{ color: "#F6F1EA" }}>
                        {a.submission.quest.title}
                      </p>
                      <p className="text-xs mt-1 font-mono break-all" style={{ color: "var(--ql-cafe)" }}>
                        {a.wallet_address} · @{a.submission.github_username}
                      </p>
                      <p className="text-xs mt-1" style={{ color: "var(--ql-bear)" }}>
                        Original score: {a.submission.score ?? "—"} / {a.submission.quest.min_score} min · risk {a.submission.risk_band ?? "?"}
                      </p>
                    </div>
                    <span
                      className="text-xs font-semibold uppercase px-3 py-1 rounded-full"
                      style={{ background: tone.bg, color: tone.fg }}
                    >
                      {a.status.replace("_", " ")}
                    </span>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--ql-cafe)" }}>
                        Appeal reason
                      </p>
                      <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--ql-ashen)" }}>
                        {a.reason}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--ql-cafe)" }}>
                        Original failure reasons
                      </p>
                      {reasons.length === 0 ? (
                        <p className="text-xs" style={{ color: "var(--ql-bear)" }}>—</p>
                      ) : (
                        <ul className="space-y-1 text-xs" style={{ color: "var(--ql-ashen)" }}>
                          {reasons.map((r, i) => (
                            <li key={i}>· {r}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 text-xs mb-4" style={{ color: "var(--ql-cafe)" }}>
                    <a href={a.submission.repo_url} target="_blank" rel="noopener noreferrer" style={{ color: "#B01020" }}>
                      Repo →
                    </a>
                    {a.submission.demo_url && (
                      <a href={a.submission.demo_url} target="_blank" rel="noopener noreferrer" style={{ color: "#B01020" }}>
                        Demo →
                      </a>
                    )}
                    <Link href={`/ops-ql/submissions/${a.submission.id}`} style={{ color: "#B01020" }}>
                      Full submission →
                    </Link>
                  </div>

                  {a.attestation_uid && (
                    <p className="text-xs mb-2">
                      <a href={easAttestationUrl(a.attestation_uid)} target="_blank" rel="noopener noreferrer" style={{ color: "#B01020" }}>
                        Attestation →
                      </a>
                    </p>
                  )}
                  {a.tx_hash_approval && (
                    <p className="text-xs mb-2">
                      <a href={explorerTxUrl(a.tx_hash_approval)} target="_blank" rel="noopener noreferrer" style={{ color: "#B01020" }}>
                        Approval tx →
                      </a>
                    </p>
                  )}
                  {a.approve_error && (
                    <p className="text-xs font-mono break-all mb-2" style={{ color: "#F0DADA" }}>
                      Error: {a.approve_error}
                    </p>
                  )}
                  {a.admin_notes && (
                    <p className="text-xs mb-2" style={{ color: "var(--ql-cafe)" }}>
                      Notes: {a.admin_notes}
                    </p>
                  )}

                  {/* Actions */}
                  {(a.status === "PENDING" || a.status === "APPROVE_FAILED") && (
                    <div className="flex flex-wrap gap-3 pt-3" style={{ borderTop: "1px solid rgba(180,20,40,0.08)" }}>
                      <button
                        onClick={() => {
                          if (confirm("Approve this appeal? This will create an EAS attestation and call submitAndApprove onchain.")) {
                            callAction(a.id, "approve");
                          }
                        }}
                        disabled={busyId === a.id}
                        className="px-4 py-2 rounded-full text-xs font-semibold disabled:opacity-60"
                        style={{ background: "#B01020", color: "#F6F1EA" }}
                      >
                        {busyId === a.id ? "Processing…" : a.status === "APPROVE_FAILED" ? "Retry approve" : "Approve onchain"}
                      </button>
                      <button
                        onClick={() => {
                          const notes = prompt("Optional admin notes:");
                          callAction(a.id, "reject", notes || undefined);
                        }}
                        disabled={busyId === a.id}
                        className="px-4 py-2 rounded-full text-xs font-semibold disabled:opacity-60"
                        style={{ background: "rgba(255,255,255,0.08)", color: "#F0DADA" }}
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
