"use client";

import { useEffect, useState } from "react";

interface Status {
  connected: boolean;
  github_login?: string;
  github_avatar_url?: string;
  github_profile_url?: string;
  github_connected_at?: string;
}

const MESSAGES: Record<string, { text: string; tone: "ok" | "warn" | "error" }> = {
  linked: { text: "GitHub linked successfully.", tone: "ok" },
  ratelimit: { text: "Too many attempts. Please wait a moment.", tone: "warn" },
  missing_params: { text: "GitHub OAuth returned no code. Please try again.", tone: "error" },
  invalid_state: { text: "OAuth session expired. Please try again.", tone: "error" },
  exchange_failed: { text: "GitHub token exchange failed.", tone: "error" },
  already_linked: { text: "That GitHub account is already linked to another wallet.", tone: "error" },
  server_error: { text: "Server error while linking. Please try again.", tone: "error" },
};

export default function GithubConnectCard({
  walletAddress,
}: {
  walletAddress: string;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<keyof typeof MESSAGES | null>(null);

  async function refresh() {
    const r = await fetch(`/api/auth/github/status?wallet=${walletAddress}`);
    if (r.ok) setStatus(await r.json());
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // Read ?github=... bounce
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      const v = p.get("github");
      if (v && v in MESSAGES) {
        setFlash(v as keyof typeof MESSAGES);
        // Clean URL
        p.delete("github");
        const q = p.toString();
        window.history.replaceState(null, "", window.location.pathname + (q ? "?" + q : ""));
      }
    }
  }, [walletAddress]);

  async function connect() {
    setBusy(true);
    try {
      const r = await fetch("/api/auth/github/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });
      const d = await r.json();
      if (!r.ok) {
        setFlash("server_error");
        return;
      }
      window.location.href = d.url;
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!confirm("Disconnect GitHub from this wallet?")) return;
    setBusy(true);
    try {
      const r = await fetch("/api/auth/github/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });
      if (r.ok) await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  const flashMsg = flash ? MESSAGES[flash] : null;
  const flashStyle =
    flashMsg?.tone === "ok"
      ? { background: "#D9EDD9", color: "rgba(122,158,111,0.35)" }
      : flashMsg?.tone === "warn"
      ? { background: "#FFF1D6", color: "#7A5A20" }
      : { background: "#F0DADA", color: "#7A2020" };

  return (
    <div
      className="rounded-[18px] p-5 mb-6"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      {flashMsg && (
        <div className="text-xs px-3 py-2 rounded-lg mb-4" style={flashStyle}>
          {flashMsg.text}
        </div>
      )}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          {status?.connected && status.github_avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={status.github_avatar_url}
              alt={status.github_login || "GitHub"}
              className="w-10 h-10 rounded-full"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: "var(--muted)" }}
            >
              <svg width="20" height="20" viewBox="0 0 16 16" fill="var(--ql-derby)">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
              </svg>
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest" style={{ color: "var(--ql-bear)" }}>
              GitHub Account
            </p>
            {status?.connected ? (
              <a
                href={status.github_profile_url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold truncate block"
                style={{ color: "#F0E6E2" }}
              >
                @{status.github_login}
              </a>
            ) : (
              <p className="font-semibold" style={{ color: "#F0E6E2" }}>
                Not connected
              </p>
            )}
            {status?.github_connected_at && (
              <p className="text-xs mt-0.5" style={{ color: "var(--ql-bear)" }}>
                Connected {new Date(status.github_connected_at).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>

        {status?.connected ? (
          <button
            onClick={disconnect}
            disabled={busy}
            className="px-4 py-2 rounded-full text-sm font-medium disabled:opacity-60"
            style={{ background: "var(--muted)", color: "var(--ql-bear)" }}
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={connect}
            disabled={busy}
            className="px-5 py-2 rounded-full text-sm font-semibold disabled:opacity-60"
            style={{ background: "#1A0A08", color: "#F6F1EA" }}
          >
            {busy ? "Opening GitHub…" : "Connect GitHub"}
          </button>
        )}
      </div>

      {!status?.connected && (
        <p className="text-xs mt-3" style={{ color: "var(--ql-bear)" }}>
          Required to submit proof. Repository owner must match your linked GitHub login.
        </p>
      )}
    </div>
  );
}
