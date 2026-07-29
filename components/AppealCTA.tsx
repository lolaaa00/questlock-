"use client";

import { useEffect, useState } from "react";

interface Props {
  submissionId: string;
  walletAddress: string;
}

interface AppealRow {
  id: string;
  status: string;
  reason: string;
  admin_notes: string | null;
  tx_hash_approval: string | null;
  attestation_uid: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending review",
  PROCESSING: "Processing onchain…",
  APPROVED: "Appeal approved",
  REJECTED: "Appeal rejected",
  APPROVE_FAILED: "Approval failed",
};

export default function AppealCTA({ submissionId, walletAddress }: Props) {
  const [existing, setExisting] = useState<AppealRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const r = await fetch(`/api/appeals?wallet=${walletAddress}`);
    if (!r.ok) return;
    const all = (await r.json()) as Array<AppealRow & { submission_id: string }>;
    const match = all.find((a) => a.submission_id === submissionId);
    setExisting(match ?? null);
  }

  useEffect(() => {
    refresh();
  }, [walletAddress, submissionId]);

  async function submit() {
    setError(null);
    if (reason.trim().length < 10) {
      setError("Please give a short explanation (at least 10 characters).");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/appeals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, walletAddress, reason: reason.trim() }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "Failed to submit appeal.");
        return;
      }
      setShowForm(false);
      setReason("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (existing) {
    const tone =
      existing.status === "APPROVED"
        ? { background: "#D9EDD9", color: "rgba(122,158,111,0.35)" }
        : existing.status === "REJECTED" || existing.status === "APPROVE_FAILED"
        ? { background: "#F0DADA", color: "#7A2020" }
        : { background: "#FFF1D6", color: "#7A5A20" };

    return (
      <div
        className="rounded-[18px] p-5"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs uppercase tracking-widest" style={{ color: "var(--ql-bear)" }}>
            Appeal
          </p>
          <span
            className="text-xs font-semibold px-3 py-1 rounded-full"
            style={tone}
          >
            {STATUS_LABEL[existing.status] || existing.status}
          </span>
        </div>
        <p className="text-sm mb-2" style={{ color: "var(--ql-bear)" }}>
          {existing.reason}
        </p>
        {existing.admin_notes && (
          <p className="text-xs" style={{ color: "var(--ql-bear)" }}>
            Admin notes: {existing.admin_notes}
          </p>
        )}
        {existing.status === "APPROVED" && (
          <p className="text-xs mt-3" style={{ color: "rgba(122,158,111,0.35)" }}>
            Reward is now claimable. Refresh this page if the claim button is not visible yet.
          </p>
        )}
      </div>
    );
  }

  if (!showForm) {
    return (
      <div
        className="rounded-[18px] p-5 flex items-center justify-between gap-4"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div>
          <p className="text-sm font-semibold" style={{ color: "#F0E6E2" }}>
            Believe this was a mistake?
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--ql-bear)" }}>
            Request manual review. An admin will inspect your proof and decide.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="shrink-0 px-4 py-2 rounded-full text-xs font-semibold"
          style={{ background: "#1A0A08", color: "#F6F1EA" }}
        >
          Request review
        </button>
      </div>
    );
  }

  return (
    <div
      className="rounded-[18px] p-5"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      <label
        className="block text-xs uppercase tracking-widest mb-2"
        style={{ color: "var(--ql-bear)" }}
      >
        Reason for appeal
      </label>
      <textarea
        rows={4}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Explain why your proof should be reviewed manually…"
        className="w-full px-3 py-2 rounded-xl text-sm outline-none"
        style={{
          background: "var(--card)",
          border: "1px solid var(--ql-cafe)",
          color: "#F0E6E2",
        }}
      />
      {error && (
        <p className="text-xs mt-2" style={{ color: "#7A2020" }}>{error}</p>
      )}
      <div className="flex gap-3 mt-3">
        <button
          onClick={submit}
          disabled={busy}
          className="px-5 py-2 rounded-full text-xs font-semibold disabled:opacity-60"
          style={{ background: "#B01020", color: "#F6F1EA" }}
        >
          {busy ? "Submitting…" : "Submit appeal"}
        </button>
        <button
          onClick={() => setShowForm(false)}
          disabled={busy}
          className="px-5 py-2 rounded-full text-xs font-medium"
          style={{ background: "var(--muted)", color: "var(--ql-bear)" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
