"use client";

// v1.2 — Public leaderboard with proof-type + badge filters and display-name
// fallback chain.

import { useCallback, useEffect, useState } from "react";

interface Row {
  rank: number;
  wallet_short: string;
  display_name: string | null;
  github_login: string | null;
  discord_username: string | null;
  completed_quests: number;
  average_score: number | null;
}

const PROOF_FILTERS: Array<{ value: string; label: string }> = [
  { value: "",                label: "All" },
  { value: "github_project",  label: "GitHub" },
  { value: "manual_project",  label: "Manual" },
  { value: "discord_role",    label: "Discord" },
  { value: "x_post",          label: "X / Twitter" },
  { value: "lms_course",      label: "LMS" },
];

const BADGE_FILTERS: Array<{ value: string; label: string }> = [
  { value: "",  label: "All badges" },
  { value: "1", label: "Verified Builder" },
  { value: "2", label: "GitHub Contributor" },
  { value: "3", label: "Protocol Researcher" },
  { value: "4", label: "Serious Learner" },
];

export default function LeaderboardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [proofType, setProofType] = useState("");
  const [badgeId, setBadgeId] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (proofType) params.set("proof_type", proofType);
    if (badgeId)   params.set("badge_id",  badgeId);
    try {
      const r = await fetch(`/api/leaderboard${params.toString() ? `?${params}` : ""}`, { cache: "no-store" });
      const d = await r.json();
      setRows(Array.isArray(d.leaderboard) ? d.leaderboard : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [proofType, badgeId]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="min-h-screen py-16 px-4 sm:px-6" style={{ background: "var(--background)" }}>
      <div className="max-w-3xl mx-auto">
        <h1 className="font-sans text-4xl font-bold mb-2" style={{ color: "#F0E6E2" }}>
          Leaderboard
        </h1>
        <p className="mb-8" style={{ color: "var(--ql-bear)" }}>
          Public, proof-backed. Only completed quests count. No private data exposed.
        </p>

        {/* Filters */}
        <div className="rounded-[18px] p-4 mb-6"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-xs uppercase tracking-widest mr-2" style={{ color: "var(--ql-bear)" }}>
              Proof type
            </span>
            {PROOF_FILTERS.map((f) => {
              const active = f.value === proofType;
              return (
                <button key={f.value || "all"} onClick={() => setProofType(f.value)}
                  className="text-xs px-3 py-1.5 rounded-full transition-opacity"
                  style={
                    active
                      ? { background: "#B01020", color: "#F6F1EA" }
                      : { background: "var(--muted)", color: "var(--ql-bear)", border: "1px solid var(--border)" }
                  }>
                  {f.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-widest mr-2" style={{ color: "var(--ql-bear)" }}>
              Badge
            </span>
            <select value={badgeId} onChange={(e) => setBadgeId(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-full"
              style={{ background: "var(--muted)", color: "var(--ql-bear)", border: "1px solid var(--border)" }}>
              {BADGE_FILTERS.map((b) => (
                <option key={b.value || "all"} value={b.value}>{b.label}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <p className="text-center py-12 text-sm" style={{ color: "var(--ql-bear)" }}>Loading…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-[18px] p-10 text-center"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <p className="font-sans text-lg mb-2" style={{ color: "#F0E6E2" }}>
              No claims {proofType || badgeId ? "in this filter" : "yet"}
            </p>
            <p className="text-sm mb-4" style={{ color: "var(--ql-bear)" }}>
              {proofType || badgeId
                ? "Try a different proof type or badge — or remove the filter."
                : "Be the first verified builder. Pass a quest and your wallet appears here automatically."}
            </p>
            {!proofType && !badgeId && (
              <a href="/quests" className="inline-block px-5 py-2.5 rounded-full text-sm font-semibold"
                style={{ background: "#B01020", color: "#F6F1EA" }}>
                Browse open quests →
              </a>
            )}
          </div>
        ) : (
          <div className="rounded-[18px] overflow-x-auto"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr style={{ background: "var(--muted)" }}>
                  {["#", "Builder", "Completed", "Avg score"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs uppercase tracking-wider"
                      style={{ color: "var(--ql-bear)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  // Display fallback: display_name → @github_login → short wallet
                  const primary = r.display_name || (r.github_login ? `@${r.github_login}` : r.wallet_short);
                  return (
                    <tr key={i} style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
                      <td className="px-5 py-3 font-mono" style={{ color: "var(--ql-bear)" }}>{r.rank}</td>
                      <td className="px-5 py-3">
                        <p className="font-medium" style={{ color: "#F0E6E2" }}>{primary}</p>
                        <p className="text-xs font-mono" style={{ color: "var(--ql-bear)" }}>
                          {r.wallet_short}
                          {r.discord_username && <> · discord: {r.discord_username}</>}
                        </p>
                      </td>
                      <td className="px-5 py-3 font-mono" style={{ color: "var(--ql-bear)" }}>{r.completed_quests}</td>
                      <td className="px-5 py-3 font-mono" style={{ color: "var(--ql-bear)" }}>
                        {r.average_score !== null ? r.average_score : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
