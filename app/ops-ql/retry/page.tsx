"use client";

// v1.2 — Admin Retry Centre.
//
// One-click recovery for the four pipelines that can get stuck:
//   1. Proof check  (github_project only)  — re-fetches + re-scores
//   2. Attestation                         — re-issues EAS attestation
//   3. Onchain approval                    — re-runs submitAndApprove
//   4. Indexer                             — re-scans contract events
//
// Each section shows the top 25 stuck submissions and a per-row Retry button.
// Indexer is a single button. Admin wallet gating mirrors /ops-ql.

import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";

const ADMIN_WALLET = "0x1f63ea74065586af0c7c48428372d88d0a89525b";

interface QuestRef { title: string; min_score?: number }
interface StuckRow {
  id: string;
  wallet_address: string;
  status: string;
  score: number | null;
  proof_type: string;
  created_at: string;
  proof_hash: string | null;
  eas_attestation_uid: string | null;
  tx_hash_approval: string | null;
  quest: QuestRef;
}
interface QueueResponse {
  proof_recheck: StuckRow[];
  attestation: StuckRow[];
  onchain_approval: StuckRow[];
  indexer: { block_number: string; event_name: string; created_at: string } | null;
}

type Op = "indexer" | "proof-check" | "attestation" | "onchain-approval";

export default function RetryCentre() {
  const { authenticated, user, login } = usePrivy();
  const wallet = user?.wallet?.address?.toLowerCase();
  const isAdmin = authenticated && wallet === ADMIN_WALLET;

  const [queue, setQueue] = useState<QueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null); // op:id key
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const refresh = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/retry/queue", {
        headers: { "x-wallet-address": user?.wallet?.address || "" },
        cache: "no-store",
      });
      if (res.ok) setQueue(await res.json());
    } finally {
      setLoading(false);
    }
  }, [isAdmin, user?.wallet?.address]);

  useEffect(() => { refresh(); }, [refresh]);

  async function runRetry(op: Op, submissionId?: string) {
    const key = `${op}:${submissionId ?? "_"}`;
    setBusy(key);
    setToast(null);
    try {
      const res = await fetch(`/api/admin/retry/${op}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": user?.wallet?.address || "",
        },
        body: JSON.stringify(submissionId ? { submissionId } : {}),
      });
      const body = await res.json();
      if (!res.ok) {
        setToast({ kind: "err", msg: body.error || `Retry ${op} failed.` });
      } else if (body.skipped) {
        setToast({ kind: "ok", msg: `${op}: ${body.reason}` });
      } else {
        setToast({ kind: "ok", msg: `${op} succeeded.` });
      }
      refresh();
    } catch (e) {
      setToast({ kind: "err", msg: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: "var(--ql-bighorn)" }}>
        <p className="font-serif text-2xl mb-4" style={{ color: "#F6F1EA" }}>Connect wallet</p>
        <button onClick={login} className="px-6 py-3 rounded-full text-sm" style={{ background: "#B01020", color: "#F6F1EA" }}>
          Connect Wallet
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
    <div className="min-h-screen py-6 sm:py-10 px-4 sm:px-6" style={{ background: "var(--ql-bighorn)" }}>
      <div className="max-w-5xl mx-auto">
        <Link href="/ops-ql" className="text-sm mb-4 inline-block" style={{ color: "var(--ql-cafe)" }}>
          ← Admin
        </Link>
        <h1 className="font-serif text-3xl font-bold mb-2" style={{ color: "#F6F1EA" }}>
          Retry Centre
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--ql-cafe)" }}>
          Re-run any pipeline that got stuck. All operations are idempotent.
        </p>

        {toast && (
          <div
            className="rounded-2xl px-4 py-3 mb-6 text-sm"
            style={
              toast.kind === "ok"
                ? { background: "rgba(122,158,111,0.1)", color: "#D9EDD9", border: "1px solid #2D5A2D" }
                : { background: "rgba(196,80,64,0.1)", color: "#F0DADA", border: "1px solid rgba(196,80,64,0.3)" }
            }
          >
            {toast.msg}
          </div>
        )}

        {/* Indexer */}
        <Section title="1 · Event indexer">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="text-xs" style={{ color: "var(--ql-ashen)" }}>
              {queue?.indexer ? (
                <>
                  Last event <span className="font-mono">{queue.indexer.event_name}</span> at block{" "}
                  <span className="font-mono">{queue.indexer.block_number}</span> ·{" "}
                  {new Date(queue.indexer.created_at).toLocaleString()}
                </>
              ) : (
                "No events indexed yet."
              )}
            </div>
            <button
              onClick={() => runRetry("indexer")}
              disabled={busy === "indexer:_"}
              className="px-4 py-2 rounded-full text-xs font-medium disabled:opacity-60"
              style={{ background: "#B01020", color: "#F6F1EA" }}
            >
              {busy === "indexer:_" ? "Indexing…" : "Run indexer now"}
            </button>
          </div>
        </Section>

        {/* Proof recheck */}
        <Section title="2 · Proof check (GitHub Project)">
          <Table
            rows={queue?.proof_recheck ?? []}
            loading={loading}
            emptyText="No github_project submissions awaiting recheck."
            actionLabel="Re-run proof check"
            disabledForType={(r) => r.proof_type !== "github_project"}
            onAction={(r) => runRetry("proof-check", r.id)}
            busy={busy}
            opKey="proof-check"
          />
        </Section>

        {/* Attestation */}
        <Section title="3 · EAS attestation">
          <Table
            rows={queue?.attestation ?? []}
            loading={loading}
            emptyText="No submissions waiting for attestation."
            actionLabel="Re-issue attestation"
            onAction={(r) => runRetry("attestation", r.id)}
            busy={busy}
            opKey="attestation"
          />
        </Section>

        {/* Onchain approval */}
        <Section title="4 · Onchain approval">
          <Table
            rows={queue?.onchain_approval ?? []}
            loading={loading}
            emptyText="No attested submissions waiting for onchain approval."
            actionLabel="Re-run submitAndApprove"
            onAction={(r) => runRetry("onchain-approval", r.id)}
            busy={busy}
            opKey="onchain-approval"
          />
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-[18px] p-5 mb-6"
      style={{ background: "var(--ql-night)", border: "1px solid rgba(180,20,40,0.12)" }}
    >
      <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "var(--ql-cafe)" }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function Table({
  rows, loading, emptyText, actionLabel, onAction, busy, opKey, disabledForType,
}: {
  rows: StuckRow[];
  loading: boolean;
  emptyText: string;
  actionLabel: string;
  onAction: (r: StuckRow) => void;
  busy: string | null;
  opKey: Op;
  disabledForType?: (r: StuckRow) => boolean;
}) {
  if (loading) return <p className="text-xs" style={{ color: "var(--ql-bear)" }}>Loading…</p>;
  if (rows.length === 0) {
    return <p className="text-xs italic" style={{ color: "var(--ql-bear)" }}>{emptyText}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr style={{ color: "var(--ql-cafe)" }}>
            <th className="px-2 py-2 text-left font-medium">Quest</th>
            <th className="px-2 py-2 text-left font-medium">Wallet</th>
            <th className="px-2 py-2 text-left font-medium">Type</th>
            <th className="px-2 py-2 text-left font-medium">Status</th>
            <th className="px-2 py-2 text-left font-medium">Score</th>
            <th className="px-2 py-2 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const key = `${opKey}:${r.id}`;
            const isBusy = busy === key;
            const isDisabled = disabledForType ? disabledForType(r) : false;
            return (
              <tr key={r.id} style={{ borderTop: "1px solid rgba(180,20,40,0.08)" }}>
                <td className="px-2 py-2" style={{ color: "#F6F1EA" }}>{r.quest.title}</td>
                <td className="px-2 py-2 font-mono" style={{ color: "var(--ql-ashen)" }}>
                  {r.wallet_address.slice(0, 8)}…{r.wallet_address.slice(-4)}
                </td>
                <td className="px-2 py-2" style={{ color: "var(--ql-ashen)" }}>{r.proof_type}</td>
                <td className="px-2 py-2" style={{ color: "var(--ql-ashen)" }}>{r.status}</td>
                <td className="px-2 py-2 font-mono" style={{ color: "var(--ql-ashen)" }}>{r.score ?? "—"}</td>
                <td className="px-2 py-2 text-right">
                  <button
                    onClick={() => onAction(r)}
                    disabled={isBusy || isDisabled}
                    className="px-3 py-1 rounded-full font-medium disabled:opacity-50"
                    style={{ background: "#B01020", color: "#F6F1EA" }}
                  >
                    {isBusy ? "Working…" : actionLabel}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
