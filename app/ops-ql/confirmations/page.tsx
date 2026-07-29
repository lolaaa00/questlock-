"use client";

// v1.2.1 — Admin Confirmations queue.
// Submissions that a sponsor approved but need admin sign-off because the
// sponsor is new/flagged or the quest is high-value.

import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";

const ADMIN_WALLET = "0x1f63ea74065586af0c7c48428372d88d0a89525b";

interface SponsorTrust {
  level: "new" | "trusted" | "flagged" | "suspended";
  successful_confirmed_approvals: number;
  approvals_until_trusted: number | null;
}

interface Row {
  id: string;
  proof_type: string;
  wallet_address: string;
  score: number | null;
  evidence_json: Record<string, unknown> | null;
  explanation: string | null;
  created_at: string;
  updated_at: string;
  quest: {
    id: string;
    title: string;
    proof_type: string;
    badge_id: string;
    reward_amount: string;
    max_claims: number;
    sponsor_wallet: string | null;
  };
  sponsor_trust: SponsorTrust | null;
}

const PROOF_LABEL: Record<string, string> = {
  manual_project: "Manual Project",
  discord_role:   "Discord Role",
  x_post:         "X / Twitter Post",
  lms_course:     "LMS Course",
};

function TrustChip({ trust }: { trust: SponsorTrust | null }) {
  if (!trust) return null;
  const map: Record<string, { bg: string; fg: string }> = {
    new:       { bg: "#FFF1D6", fg: "#7A5A20" },
    trusted:   { bg: "#D9EDD9", fg: "rgba(122,158,111,0.35)" },
    flagged:   { bg: "#F0DADA", fg: "#7A2020" },
    suspended: { bg: "rgba(196,80,64,0.3)", fg: "#F0DADA" },
  };
  const s = map[trust.level] || map.new;
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.fg }}>
      {trust.level}
      {trust.level === "new" && trust.approvals_until_trusted !== null && (
        <> · {trust.approvals_until_trusted} to trusted</>
      )}
    </span>
  );
}

export default function ConfirmationsPage() {
  const { authenticated, user, login } = usePrivy();
  const wallet = user?.wallet?.address?.toLowerCase();
  const isAdmin = authenticated && wallet === ADMIN_WALLET;

  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const r = await fetch("/api/admin/confirmations", {
        headers: { "x-wallet-address": user?.wallet?.address || "" },
        cache: "no-store",
      });
      if (r.ok) setItems(await r.json());
    } finally {
      setLoading(false);
    }
  }, [isAdmin, user?.wallet?.address]);

  useEffect(() => { refresh(); }, [refresh]);

  async function act(id: string, action: "confirm" | "reject") {
    setBusy(`${action}:${id}`); setToast(null);
    try {
      const body: Record<string, unknown> = {};
      if (action === "reject" && rejectReason[id]) body.reason = rejectReason[id];
      const r = await fetch(`/api/admin/confirmations/${id}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": user?.wallet?.address || "",
        },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) setToast({ kind: "err", msg: d.error || `${action} failed.` });
      else if (d.skipped) setToast({ kind: "ok", msg: d.reason });
      else {
        let msg = `${action === "confirm" ? "Confirmed" : "Rejected"} successfully.`;
        if (action === "confirm" && d.sponsor_trust) {
          msg += ` Sponsor: ${d.sponsor_trust.newCount} confirmed approvals${d.sponsor_trust.promoted ? " — PROMOTED TO TRUSTED 🎉" : ""}.`;
        }
        setToast({ kind: "ok", msg });
      }
      refresh();
    } catch (e) {
      setToast({ kind: "err", msg: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function setTrust(sponsorWallet: string, level: string) {
    if (!confirm(`Set sponsor ${sponsorWallet.slice(0,8)}… to ${level}?`)) return;
    setBusy(`trust:${sponsorWallet}`); setToast(null);
    try {
      const r = await fetch(`/api/admin/sponsors/${sponsorWallet}/trust`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": user?.wallet?.address || "",
        },
        body: JSON.stringify({ level }),
      });
      const d = await r.json();
      if (!r.ok) setToast({ kind: "err", msg: d.error });
      else setToast({ kind: "ok", msg: `Sponsor now: ${d.level}` });
      refresh();
    } finally { setBusy(null); }
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: "var(--ql-bighorn)" }}>
        <button onClick={login} className="px-6 py-3 rounded-full text-sm" style={{ background: "#B01020", color: "#F6F1EA" }}>
          Connect Wallet
        </button>
      </div>
    );
  }
  if (!isAdmin) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ql-bighorn)" }}>
      <p style={{ color: "#F6F1EA" }}>Access denied.</p>
    </div>;
  }

  return (
    <div className="min-h-screen py-6 sm:py-10 px-4 sm:px-6" style={{ background: "var(--ql-bighorn)" }}>
      <div className="max-w-5xl mx-auto">
        <Link href="/ops-ql" className="text-sm mb-4 inline-block" style={{ color: "var(--ql-cafe)" }}>
          ← Admin
        </Link>
        <h1 className="font-serif text-3xl font-bold mb-2" style={{ color: "#F6F1EA" }}>
          Sponsor Approval Confirmations
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--ql-cafe)" }}>
          Submissions a sponsor approved that need your sign-off (new/flagged sponsor, or high-value quest).
        </p>

        {toast && (
          <div className="rounded-2xl px-4 py-3 mb-6 text-sm"
            style={toast.kind === "ok"
              ? { background: "rgba(122,158,111,0.1)", color: "#D9EDD9", border: "1px solid #2D5A2D" }
              : { background: "rgba(196,80,64,0.1)", color: "#F0DADA", border: "1px solid rgba(196,80,64,0.3)" }}>
            {toast.msg}
          </div>
        )}

        {loading ? (
          <p className="text-xs" style={{ color: "var(--ql-bear)" }}>Loading…</p>
        ) : items.length === 0 ? (
          <div className="rounded-[18px] p-10 text-center"
            style={{ background: "var(--ql-night)", border: "1px solid rgba(180,20,40,0.12)" }}>
            <p style={{ color: "#F6F1EA" }}>Nothing waiting for admin confirmation.</p>
            <p className="text-xs mt-2" style={{ color: "var(--ql-bear)" }}>
              When a new sponsor approves a submission, or when a trusted sponsor approves a high-value quest, it lands here for your sign-off.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {items.map((s) => {
              const ev = s.evidence_json ?? {};
              const sponsor = s.quest.sponsor_wallet;
              return (
                <li key={s.id} className="rounded-[18px] p-5"
                  style={{ background: "var(--ql-night)", border: "1px solid rgba(180,20,40,0.12)" }}>
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--ql-cafe)" }}>
                        {PROOF_LABEL[s.proof_type] || s.proof_type} · {s.quest.reward_amount} QUEST × {s.quest.max_claims} max
                      </p>
                      <p className="font-semibold" style={{ color: "#F6F1EA" }}>{s.quest.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--ql-bear)" }}>
                        Builder: <span className="font-mono">{s.wallet_address.slice(0, 10)}…{s.wallet_address.slice(-6)}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <span className="text-[10px] uppercase" style={{ color: "var(--ql-bear)" }}>Sponsor</span>
                        <TrustChip trust={s.sponsor_trust} />
                      </div>
                      {sponsor && (
                        <p className="font-mono text-[11px] mt-1" style={{ color: "var(--ql-cafe)" }}>
                          {sponsor.slice(0, 8)}…{sponsor.slice(-6)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-xs space-y-1 mb-3" style={{ color: "var(--ql-ashen)" }}>
                    {Object.entries(ev).map(([k, v]) => {
                      if (v === null || v === undefined || typeof v === "object") return null;
                      const str = String(v);
                      const isUrl = str.startsWith("http");
                      return (
                        <div key={k} className="flex gap-2">
                          <span className="font-mono opacity-70 shrink-0">{k}:</span>
                          {isUrl
                            ? <a href={str} target="_blank" rel="noopener noreferrer" className="break-all" style={{ color: "#F0C97D" }}>{str}</a>
                            : <span className="break-all">{str}</span>}
                        </div>
                      );
                    })}
                    {s.explanation && (
                      <div className="mt-2 pt-2" style={{ borderTop: "1px solid rgba(180,20,40,0.12)" }}>
                        <p className="opacity-70 mb-0.5">Builder explanation (private):</p>
                        <p>{s.explanation}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 items-center">
                    <input
                      placeholder="Override reason (optional)"
                      value={rejectReason[s.id] ?? ""}
                      onChange={(e) => setRejectReason({ ...rejectReason, [s.id]: e.target.value })}
                      className="flex-1 min-w-[200px] text-xs px-3 py-1.5 rounded-full"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(180,20,40,0.18)", color: "#F6F1EA" }}
                    />
                    <button onClick={() => act(s.id, "reject")} disabled={busy === `reject:${s.id}`}
                      className="px-3 py-1.5 rounded-full text-xs font-medium disabled:opacity-50"
                      style={{ background: "rgba(196,80,64,0.3)", color: "#F0DADA" }}>
                      {busy === `reject:${s.id}` ? "…" : "Override → Reject"}
                    </button>
                    <button onClick={() => act(s.id, "confirm")} disabled={busy === `confirm:${s.id}`}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold disabled:opacity-50"
                      style={{ background: "#B01020", color: "#F6F1EA" }}>
                      {busy === `confirm:${s.id}` ? "Confirming…" : "Confirm → Fire onchain"}
                    </button>
                  </div>

                  {sponsor && (
                    <div className="flex items-center gap-2 mt-3 pt-3 flex-wrap"
                      style={{ borderTop: "1px solid rgba(180,20,40,0.12)" }}>
                      <span className="text-[10px] uppercase" style={{ color: "var(--ql-bear)" }}>Sponsor actions:</span>
                      {(["trusted", "flagged", "suspended", "new"] as const).map((lvl) => (
                        <button key={lvl} onClick={() => setTrust(sponsor, lvl)}
                          disabled={busy === `trust:${sponsor}` || s.sponsor_trust?.level === lvl}
                          className="text-[10px] px-2 py-0.5 rounded-full font-medium disabled:opacity-30"
                          style={{ background: "rgba(255,255,255,0.07)", color: "var(--ql-ashen)" }}>
                          Set {lvl}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
