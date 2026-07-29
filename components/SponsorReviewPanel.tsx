"use client";

// v1.2 — Sponsor manual-review panel for their own quest.
// Lists pending submissions (proof_type != github_project, not yet approved
// onchain) and lets the sponsor approve or reject each with a single click.
// Approval reuses the EAS + verifier submitAndApprove pipeline.

import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";

interface ReviewSubmission {
  id: string;
  status: string;
  proof_type: string;
  score: number | null;
  wallet_address: string;
  github_username: string | null;
  repo_url: string | null;
  demo_url: string | null;
  explanation: string | null;
  evidence_json: Record<string, unknown> | null;
  created_at: string;
  quest: { id: string; title: string; min_score: number; proof_type: string };
}

const PROOF_LABEL: Record<string, string> = {
  manual_project: "Manual Project",
  discord_role:   "Discord Role",
  x_post:         "X / Twitter Post",
  lms_course:     "LMS Course",
};

interface SponsorTrust {
  level: "new" | "trusted" | "flagged" | "suspended";
  successful_confirmed_approvals: number;
  approvals_until_trusted: number | null;
}

export default function SponsorReviewPanel({ questId }: { questId: string }) {
  const { authenticated, user } = usePrivy();
  const wallet = user?.wallet?.address;
  const [items, setItems] = useState<ReviewSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [trust, setTrust] = useState<SponsorTrust | null>(null);

  const refresh = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    try {
      const r = await fetch(
        `/api/sponsor/submissions?wallet=${wallet}&quest_id=${questId}`,
        { cache: "no-store" }
      );
      const d = await r.json();
      setItems(Array.isArray(d) ? d : []);
    } finally {
      setLoading(false);
    }
  }, [wallet, questId]);

  useEffect(() => { refresh(); }, [refresh]);

  // v1.2.1 — fetch sponsor trust so we can show what will happen on Approve
  useEffect(() => {
    if (!wallet) return;
    fetch(`/api/sponsor/trust-status?wallet=${wallet}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setTrust(d))
      .catch(() => {});
  }, [wallet]);

  async function act(id: string, action: "approve" | "reject") {
    setBusy(`${action}:${id}`);
    setToast(null);
    try {
      const body: Record<string, unknown> = {};
      if (action === "reject" && rejectReason[id]) body.reason = rejectReason[id];
      const r = await fetch(`/api/sponsor/submissions/${id}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": wallet || "",
        },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) setToast({ kind: "err", msg: d.error || `${action} failed.` });
      else setToast({ kind: "ok", msg: d.skipped ? d.reason : `${action} succeeded.` });
      refresh();
    } catch (e) {
      setToast({ kind: "err", msg: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  if (!authenticated) return null;

  return (
    <div className="rounded-[18px] p-5 mt-6"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-xs uppercase tracking-widest" style={{ color: "var(--ql-bear)" }}>
          Pending submissions for your review
        </p>
        <button onClick={refresh}
          className="text-xs px-3 py-1 rounded-full"
          style={{ background: "var(--muted)", color: "var(--ql-bear)" }}>
          Refresh
        </button>
      </div>

      {toast && (
        <div className="rounded-2xl px-4 py-3 mb-4 text-sm"
          style={toast.kind === "ok"
            ? { background: "#D9EDD9", color: "rgba(122,158,111,0.35)" }
            : { background: "#F0DADA", color: "#7A2020" }}>
          {toast.msg}
        </div>
      )}

      {loading ? (
        <p className="text-xs" style={{ color: "var(--ql-bear)" }}>Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-xs italic" style={{ color: "var(--ql-bear)" }}>
          Nothing waiting for your review on this quest.
          GitHub Project submissions are auto-verified — you only see manual / Discord / X / LMS here.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((s) => {
            const approveKey = `approve:${s.id}`;
            const rejectKey  = `reject:${s.id}`;
            const ev = s.evidence_json ?? {};
            return (
              <li key={s.id} className="rounded-xl p-4"
                style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-widest" style={{ color: "var(--ql-bear)" }}>
                      {PROOF_LABEL[s.proof_type] || s.proof_type}
                    </p>
                    <p className="font-mono text-xs" style={{ color: "#F0E6E2" }}>
                      {s.wallet_address.slice(0, 10)}…{s.wallet_address.slice(-6)}
                    </p>
                  </div>
                  <p className="text-[10px]" style={{ color: "var(--ql-bear)" }}>
                    {new Date(s.created_at).toLocaleString()}
                  </p>
                </div>

                {/* Evidence — render adapter-aware-but-safe summary */}
                <div className="text-xs space-y-1 mb-3" style={{ color: "var(--ql-bear)" }}>
                  {Object.entries(ev).map(([k, v]) => {
                    if (v === null || v === undefined || typeof v === "object") return null;
                    const str = String(v);
                    const isUrl = str.startsWith("http");
                    return (
                      <div key={k} className="flex gap-2">
                        <span className="font-mono opacity-70 shrink-0">{k}:</span>
                        {isUrl ? (
                          <a href={str} target="_blank" rel="noopener noreferrer"
                            className="break-all" style={{ color: "#B01020" }}>{str}</a>
                        ) : (
                          <span className="break-all">{str}</span>
                        )}
                      </div>
                    );
                  })}
                  {s.explanation && (
                    <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                      <p className="opacity-70 mb-0.5">Builder explanation (private):</p>
                      <p>{s.explanation}</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    placeholder="Rejection reason (optional)"
                    value={rejectReason[s.id] ?? ""}
                    onChange={(e) => setRejectReason({ ...rejectReason, [s.id]: e.target.value })}
                    className="flex-1 min-w-[200px] text-xs px-3 py-1.5 rounded-full"
                    style={{ background: "var(--card)", border: "1px solid var(--border)", color: "#F0E6E2" }}
                  />
                  <button
                    onClick={() => act(s.id, "reject")}
                    disabled={busy === rejectKey}
                    className="px-3 py-1.5 rounded-full text-xs font-medium disabled:opacity-50"
                    style={{ background: "rgba(196,80,64,0.3)", color: "#F0DADA" }}>
                    {busy === rejectKey ? "…" : "Reject"}
                  </button>
                  <button
                    onClick={() => act(s.id, "approve")}
                    disabled={busy === approveKey}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold disabled:opacity-50"
                    style={{ background: "#B01020", color: "#F6F1EA" }}>
                    {busy === approveKey ? "Approving…" : "Approve"}
                  </button>
                  <Link href={`/proof/${s.id}`} target="_blank"
                    className="text-xs ml-auto" style={{ color: "var(--ql-bear)" }}>
                    Inspect →
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-[11px] mt-4" style={{ color: "var(--ql-bear)" }}>
        {trust?.level === "trusted" && (
          <>You&apos;re a <span className="font-semibold">trusted sponsor</span> — approvals fire onchain immediately (EAS attestation + <span className="font-mono">submitAndApprove</span>) unless the quest is high-value (reward × max_claims ≥ 500 QUEST), in which case admin co-signs.</>
        )}
        {trust?.level === "new" && (
          <>You&apos;re a <span className="font-semibold">new sponsor</span> — your approvals route to admin confirmation first. <span className="font-mono">{trust.approvals_until_trusted ?? 3}</span> more admin-confirmed approvals until you&apos;re promoted to trusted (then approvals fire directly).</>
        )}
        {trust?.level === "flagged" && (
          <>You&apos;re currently <span className="font-semibold">flagged</span> — all approvals route to admin confirmation until cleared.</>
        )}
        {trust?.level === "suspended" && (
          <>You&apos;re <span className="font-semibold">suspended</span> — you cannot approve right now. Only reject works.</>
        )}
        {!trust && (
          <>Approving issues an EAS attestation tagged <span className="font-mono">MANUAL_REVIEW</span> and runs <span className="font-mono">submitAndApprove</span>.</>
        )}
      </p>
    </div>
  );
}
