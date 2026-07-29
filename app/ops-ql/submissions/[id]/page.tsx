"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { easAttestationUrl, explorerTxUrl, explorerAddressUrl } from "@/lib/chains";
import StatusBadge from "@/components/StatusBadge";

const ADMIN_WALLET = "0x1f63ea74065586af0c7c48428372d88d0a89525b";

interface ProofCheck {
  id: string;
  check_name: string;
  passed: boolean;
  points_awarded: number;
  max_points: number;
  details_json: { details?: string } | null;
}

interface SubmissionDetail {
  id: string;
  status: string;
  score: number | null;
  risk_band: string | null;
  proof_hash: string | null;
  eas_attestation_uid: string | null;
  tx_hash_approval: string | null;
  tx_hash_claim: string | null;
  failure_reasons_json: string[] | null;
  wallet_address: string;
  github_username: string;
  repo_url: string;
  demo_url: string | null;
  explanation: string | null;
  created_at: string;
  updated_at: string;
  proof_checks: ProofCheck[];
  quest: {
    id: string;
    title: string;
    reward_amount: string;
    badge_id: string;
    min_score: number;
    onchain_quest_id: string | null;
  };
}

const CHECK_LABELS: Record<string, string> = {
  repo_exists: "Repository exists",
  owner_matches: "Owner matches",
  repo_updated_after_start: "Updated after start",
  commits_after_start: "Commits after start",
  readme_exists: "README present",
  readme_length: "README length OK",
  frontend_files: "Frontend files",
  contract_files: "Contract/backend files",
  demo_url_loads: "Demo URL loads",
  not_previously_submitted: "Not duplicate",
};

export default function AdminSubmissionDetail() {
  const params = useParams<{ id: string }>();
  const { authenticated, user, login } = usePrivy();
  const [data, setData] = useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin =
    authenticated && user?.wallet?.address?.toLowerCase() === ADMIN_WALLET;

  useEffect(() => {
    if (!isAdmin || !params.id) return;
    fetch(`/api/ops-ql/submissions/${params.id}`, {
      headers: { "x-wallet-address": user?.wallet?.address || "" },
    })
      .then(async (r) => {
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          throw new Error(e.error || "Failed to load");
        }
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [isAdmin, params.id, user?.wallet?.address]);

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
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ql-bighorn)" }}>
        <p style={{ color: "#F6F1EA" }}>Access denied.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ql-bighorn)" }}>
        <p style={{ color: "var(--ql-cafe)" }}>Loading…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ql-bighorn)" }}>
        <p style={{ color: "#F0DADA" }}>{error || "Not found"}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-6 sm:py-10 px-4 sm:px-6" style={{ background: "var(--ql-bighorn)" }}>
      <div className="max-w-4xl mx-auto">
        <Link href="/ops-ql" className="text-sm mb-6 inline-block" style={{ color: "var(--ql-cafe)" }}>
          ← Back to Admin
        </Link>

        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--ql-cafe)" }}>
              Submission · {data.id.slice(0, 8)}
            </p>
            <h1 className="font-sans text-2xl font-bold" style={{ color: "#F6F1EA" }}>
              {data.quest.title}
            </h1>
          </div>
          <StatusBadge status={data.status} />
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Submitter */}
          <div className="rounded-[18px] p-5" style={{ background: "var(--ql-night)", border: "1px solid rgba(180,20,40,0.12)" }}>
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--ql-cafe)" }}>Submitter</p>
            <p className="text-xs" style={{ color: "var(--ql-cafe)" }}>Wallet</p>
            <a href={explorerAddressUrl(data.wallet_address)} target="_blank" rel="noopener noreferrer" className="font-mono text-xs block mb-3" style={{ color: "#F6F1EA" }}>
              {data.wallet_address} →
            </a>
            <p className="text-xs" style={{ color: "var(--ql-cafe)" }}>GitHub</p>
            <p className="text-sm mb-3" style={{ color: "#F6F1EA" }}>@{data.github_username}</p>
            <p className="text-xs" style={{ color: "var(--ql-cafe)" }}>Repository</p>
            <a href={data.repo_url} target="_blank" rel="noopener noreferrer" className="text-sm block mb-3 break-all" style={{ color: "#B01020" }}>
              {data.repo_url}
            </a>
            {data.demo_url && (
              <>
                <p className="text-xs" style={{ color: "var(--ql-cafe)" }}>Demo URL</p>
                <a href={data.demo_url} target="_blank" rel="noopener noreferrer" className="text-sm break-all" style={{ color: "#B01020" }}>
                  {data.demo_url}
                </a>
              </>
            )}
          </div>

          {/* Outcome */}
          <div className="rounded-[18px] p-5" style={{ background: "var(--ql-night)", border: "1px solid rgba(180,20,40,0.12)" }}>
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--ql-cafe)" }}>Outcome</p>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <p className="text-xs" style={{ color: "var(--ql-cafe)" }}>Score</p>
                <p className="text-3xl font-bold font-mono" style={{ color: "#F6F1EA" }}>{data.score ?? "—"}</p>
                <p className="text-xs" style={{ color: "var(--ql-bear)" }}>min {data.quest.min_score}</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: "var(--ql-cafe)" }}>Risk Band</p>
                <p className="text-sm font-semibold uppercase mt-2" style={{ color: data.risk_band === "HIGH_RISK" ? "#F0DADA" : "#F6F1EA" }}>
                  {data.risk_band?.replace("_RISK", "") || "—"}
                </p>
              </div>
            </div>
            <div className="pt-3 space-y-2" style={{ borderTop: "1px solid rgba(180,20,40,0.12)" }}>
              {data.proof_hash && (
                <div>
                  <p className="text-xs" style={{ color: "var(--ql-cafe)" }}>Proof Hash</p>
                  <p className="font-mono text-xs break-all" style={{ color: "#F6F1EA" }}>{data.proof_hash}</p>
                </div>
              )}
              {data.eas_attestation_uid && data.eas_attestation_uid !== "0x" + "0".repeat(64) && (
                <a href={easAttestationUrl(data.eas_attestation_uid)} target="_blank" rel="noopener noreferrer" className="block text-xs" style={{ color: "#B01020" }}>
                  EAS Attestation →
                </a>
              )}
              {data.tx_hash_approval && (
                <a href={explorerTxUrl(data.tx_hash_approval)} target="_blank" rel="noopener noreferrer" className="block text-xs" style={{ color: "#B01020" }}>
                  Approval tx →
                </a>
              )}
              {data.tx_hash_claim && (
                <a href={explorerTxUrl(data.tx_hash_claim)} target="_blank" rel="noopener noreferrer" className="block text-xs" style={{ color: "#B01020" }}>
                  Claim tx →
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Failure reasons */}
        {data.failure_reasons_json && Array.isArray(data.failure_reasons_json) && data.failure_reasons_json.length > 0 && (
          <div className="rounded-[18px] p-5 mb-6" style={{ background: "rgba(196,80,64,0.1)", border: "1px solid rgba(196,80,64,0.3)" }}>
            <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "#F0DADA" }}>Failure Reasons</p>
            <ul className="space-y-1">
              {data.failure_reasons_json.map((r, i) => (
                <li key={i} className="text-sm" style={{ color: "#F0DADA" }}>· {r}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Proof checks */}
        <div className="rounded-[18px] overflow-hidden" style={{ border: "1px solid rgba(180,20,40,0.12)" }}>
          <div className="px-5 py-3" style={{ background: "var(--ql-night)" }}>
            <p className="text-xs uppercase tracking-widest" style={{ color: "var(--ql-cafe)" }}>Proof Checks</p>
          </div>
          {data.proof_checks.length === 0 ? (
            <div className="px-5 py-6 text-sm text-center" style={{ background: "rgba(255,255,255,0.02)", color: "var(--ql-bear)" }}>
              No proof checks recorded.
            </div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {data.proof_checks.map((c, i) => (
                  <tr key={c.id} style={{ borderTop: i > 0 ? "1px solid rgba(180,20,40,0.08)" : undefined, background: "rgba(255,255,255,0.02)" }}>
                    <td className="px-5 py-3">
                      <p style={{ color: "#F6F1EA" }}>{CHECK_LABELS[c.check_name] || c.check_name}</p>
                      {c.details_json?.details && (
                        <p className="text-xs mt-0.5" style={{ color: c.passed ? "var(--ql-bear)" : "#F0DADA" }}>{c.details_json.details}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center w-16">
                      <span className="inline-block w-5 h-5 rounded-full text-xs font-bold leading-5" style={c.passed ? { background: "rgba(122,158,111,0.35)", color: "#F6F1EA" } : { background: "rgba(196,80,64,0.3)", color: "#F0DADA" }}>
                        {c.passed ? "✓" : "✕"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs w-20" style={{ color: c.passed ? "#F6F1EA" : "#F0DADA" }}>
                      {c.points_awarded}/{c.max_points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {data.explanation && (
          <div className="rounded-[18px] p-5 mt-6" style={{ background: "var(--ql-night)", border: "1px solid rgba(180,20,40,0.12)" }}>
            <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--ql-cafe)" }}>Submitter Explanation</p>
            <p className="text-sm leading-relaxed" style={{ color: "#F6F1EA" }}>{data.explanation}</p>
          </div>
        )}
      </div>
    </div>
  );
}
