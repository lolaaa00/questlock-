"use client";

// v1.2 — set your display name. Shows on the leaderboard, public proof page,
// and anywhere else we render a builder identity. Wallet address always stays
// visible (copyable) — display name is additive cosmetic identity only.

import { useEffect, useState } from "react";

export default function DisplayNameCard({ walletAddress }: { walletAddress: string }) {
  const [name, setName] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  async function refresh() {
    try {
      const r = await fetch(`/api/users/display-name?wallet=${walletAddress}`);
      if (r.ok) {
        const d = await r.json();
        setSaved(d.display_name ?? null);
        setName(d.display_name ?? "");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, [walletAddress]);

  async function save() {
    setSaving(true);
    setError(null);
    setFlash(null);
    try {
      const r = await fetch("/api/users/display-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, displayName: name }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "Failed to save.");
        return;
      }
      setSaved(d.display_name ?? null);
      setName(d.display_name ?? "");
      setFlash(d.display_name ? "Saved." : "Display name cleared.");
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  async function clearName() {
    setName("");
    setSaving(true);
    setError(null);
    setFlash(null);
    try {
      const r = await fetch("/api/users/display-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, displayName: "" }),
      });
      if (r.ok) {
        setSaved(null);
        setFlash("Display name cleared.");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  const dirty = (name || "").trim() !== (saved || "");

  return (
    <div className="rounded-[18px] p-5 mb-6"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--ql-bear)" }}>
        Display Name
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="How should you show up on leaderboards?"
          className="flex-1 min-w-[200px] px-4 py-2 rounded-xl text-sm outline-none"
          style={{ background: "var(--muted)", border: "1px solid var(--ql-cafe)", color: "#F0E6E2" }}
        />
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-50"
          style={{ background: "#B01020", color: "#F6F1EA" }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {saved && (
          <button
            onClick={clearName}
            disabled={saving}
            className="px-3 py-2 rounded-full text-xs font-medium disabled:opacity-50"
            style={{ background: "var(--muted)", color: "var(--ql-bear)" }}
          >
            Clear
          </button>
        )}
      </div>

      {error && <p className="text-xs mt-2" style={{ color: "#7A2020" }}>{error}</p>}
      {flash && <p className="text-xs mt-2" style={{ color: "rgba(122,158,111,0.35)" }}>{flash}</p>}

      <p className="text-xs mt-3" style={{ color: "var(--ql-bear)" }}>
        Optional. Shows on leaderboards and your public proof certificate.
        Your wallet stays visible and copyable everywhere.
        {saved
          ? <> Currently set to <span className="font-semibold" style={{ color: "#F0E6E2" }}>{saved}</span>.</>
          : <> Leave empty to fall back to GitHub login or short wallet.</>}
      </p>
    </div>
  );
}
