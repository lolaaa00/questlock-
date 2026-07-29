"use client";

// v1.2 — Discord OAuth link card on /me. Mirrors GithubConnectCard.
// Required for any quest with proof_type = "discord_role".

import { useEffect, useState } from "react";

interface Status {
  connected: boolean;
  discord_username?: string;
  discord_avatar_url?: string;
  connected_at?: string;
}

const MESSAGES: Record<string, { text: string; tone: "ok" | "warn" | "error" }> = {
  linked: { text: "Discord linked successfully.", tone: "ok" },
  ratelimit: { text: "Too many attempts. Please wait a moment.", tone: "warn" },
  missing_params: { text: "Discord OAuth returned no code. Please try again.", tone: "error" },
  invalid_state: { text: "OAuth session expired. Please try again.", tone: "error" },
  exchange_failed: { text: "Discord token exchange failed.", tone: "error" },
  already_linked: { text: "That Discord account is already linked to another wallet.", tone: "error" },
  server_error: { text: "Server error while linking. Please try again.", tone: "error" },
};

export default function DiscordConnectCard({ walletAddress }: { walletAddress: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<keyof typeof MESSAGES | null>(null);

  async function refresh() {
    const r = await fetch(`/api/auth/discord/status?wallet=${walletAddress}`);
    if (r.ok) setStatus(await r.json());
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      const v = p.get("discord");
      if (v && v in MESSAGES) {
        setFlash(v as keyof typeof MESSAGES);
        p.delete("discord");
        const q = p.toString();
        window.history.replaceState(null, "", window.location.pathname + (q ? "?" + q : ""));
      }
    }
  }, [walletAddress]);

  async function connect() {
    setBusy(true);
    try {
      const r = await fetch("/api/auth/discord/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });
      const d = await r.json();
      if (!r.ok || !d.url) { setFlash("server_error"); return; }
      window.location.href = d.url;
    } finally { setBusy(false); }
  }

  async function disconnect() {
    if (!confirm("Disconnect Discord from this wallet?")) return;
    setBusy(true);
    try {
      const r = await fetch("/api/auth/discord/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });
      if (r.ok) await refresh();
    } finally { setBusy(false); }
  }

  if (loading) return null;

  const flashMsg = flash ? MESSAGES[flash] : null;
  const flashStyle =
    flashMsg?.tone === "ok"   ? { background: "#D9EDD9", color: "rgba(122,158,111,0.35)" }
    : flashMsg?.tone === "warn" ? { background: "#FFF1D6", color: "#7A5A20" }
    : { background: "#F0DADA", color: "#7A2020" };

  return (
    <div className="rounded-[18px] p-5 mb-6" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      {flashMsg && (
        <div className="text-xs px-3 py-2 rounded-lg mb-4" style={flashStyle}>{flashMsg.text}</div>
      )}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          {status?.connected && status.discord_avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={status.discord_avatar_url} alt={status.discord_username || "Discord"} className="w-10 h-10 rounded-full" />
          ) : (
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "var(--muted)" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--ql-derby)" aria-hidden="true">
                <path d="M20.317 4.369A19.79 19.79 0 0 0 16.558 3a14.96 14.96 0 0 0-.69 1.41 18.45 18.45 0 0 0-5.738 0A14.96 14.96 0 0 0 9.44 3a19.74 19.74 0 0 0-3.76 1.37C2.106 9.687 1.272 14.85 1.604 19.94a19.84 19.84 0 0 0 6.07 3.07c.49-.66.927-1.366 1.305-2.106-.713-.266-1.39-.595-2.027-.984.17-.124.336-.253.498-.387a14.16 14.16 0 0 0 12.1 0c.165.134.33.263.498.387-.638.39-1.317.72-2.03.984.378.74.815 1.446 1.305 2.106a19.7 19.7 0 0 0 6.071-3.07c.391-5.91-.927-11.027-3.957-15.571zM8.02 16.8c-1.183 0-2.157-1.087-2.157-2.42 0-1.333.954-2.42 2.157-2.42 1.21 0 2.176 1.094 2.156 2.42 0 1.333-.954 2.42-2.156 2.42zm7.96 0c-1.183 0-2.156-1.087-2.156-2.42 0-1.333.953-2.42 2.156-2.42 1.21 0 2.176 1.094 2.156 2.42 0 1.333-.946 2.42-2.156 2.42z"/>
              </svg>
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest" style={{ color: "var(--ql-bear)" }}>Discord Account</p>
            {status?.connected ? (
              <p className="font-semibold truncate" style={{ color: "#F0E6E2" }}>{status.discord_username}</p>
            ) : (
              <p className="font-semibold" style={{ color: "#F0E6E2" }}>Not connected</p>
            )}
            {status?.connected_at && (
              <p className="text-xs mt-0.5" style={{ color: "var(--ql-bear)" }}>
                Connected {new Date(status.connected_at).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>

        {status?.connected ? (
          <button onClick={disconnect} disabled={busy}
            className="px-4 py-2 rounded-full text-sm font-medium disabled:opacity-60"
            style={{ background: "var(--muted)", color: "var(--ql-bear)" }}>
            Disconnect
          </button>
        ) : (
          <button onClick={connect} disabled={busy}
            className="px-5 py-2 rounded-full text-sm font-semibold disabled:opacity-60"
            style={{ background: "#5865F2", color: "#F6F1EA" }}>
            {busy ? "Opening Discord…" : "Connect Discord"}
          </button>
        )}
      </div>

      {!status?.connected && (
        <p className="text-xs mt-3" style={{ color: "var(--ql-bear)" }}>
          Required for Discord Role quests. Your Discord handle becomes verifiable in your public proofs.
        </p>
      )}
    </div>
  );
}
