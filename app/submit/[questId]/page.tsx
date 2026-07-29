"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import ProofTimeline from "@/components/ProofTimeline";
import ScoreBreakdown from "@/components/ScoreBreakdown";
import AttestationCard from "@/components/AttestationCard";
import GaslessClaimButton from "@/components/GaslessClaimButton";
import StatusBadge from "@/components/StatusBadge";
import AppealCTA from "@/components/AppealCTA";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";

interface SubmissionData {
  id: string;
  status: string;
  score?: number;
  riskBand?: string;
  failureReasons?: string[];
  easAttestationUid?: string;
  txHashApproval?: string;
  txHashClaim?: string;
  proofChecks?: Array<{
    check_name: string;
    passed: boolean;
    points_awarded: number;
    max_points: number;
    details_json: { details?: string } | null;
  }>;
  quest?: {
    title: string;
    reward_amount: string;
    min_score?: number;
  };
}

const POLLING_STATUSES = new Set([
  "SUBMITTED",
  "FETCHING_PROOF",
  "EVALUATING",
  "ATTESTING",
  "APPROVING_ONCHAIN",
  "CLAIMING",
]);

export default function SubmitResultPage() {
  const { user } = usePrivy();
  const searchParams = useSearchParams();
  const submissionId = searchParams.get("submissionId");
  const [data, setData] = useState<SubmissionData | null>(null);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    if (!submissionId) return;

    let interval: ReturnType<typeof setInterval> | null = null;

    async function fetchStatus() {
      const res = await fetch(`/api/proof/status/${submissionId}`);
      if (!res.ok) return;
      const json = await res.json();
      setData(json);

      if (!POLLING_STATUSES.has(json.status)) {
        if (interval) clearInterval(interval);
      }
    }

    fetchStatus();
    interval = setInterval(fetchStatus, 4000);
    return () => { if (interval) clearInterval(interval); };
  }, [submissionId]);

  if (!submissionId) {
    return (
      <div className="min-h-screen py-16 px-6 text-center" style={{ background: "var(--background)" }}>
        <p style={{ color: "var(--ql-bear)" }}>No submission ID found.</p>
        <Link href="/quests" className="text-sm mt-4 block" style={{ color: "#B01020" }}>
          ← Browse Quests
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen py-16 px-6 flex items-center justify-center" style={{ background: "var(--background)" }}>
        <div className="text-center">
          <div
            className="w-10 h-10 border-2 rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: "var(--ql-chocolate)", borderTopColor: "transparent" }}
          />
          <p style={{ color: "var(--ql-bear)" }}>Loading submission…</p>
        </div>
      </div>
    );
  }

  const isClaimable = data.status === "APPROVED_ONCHAIN" && !claimed;
  const minScore = data.quest?.min_score ?? 70;

  return (
    <div className="min-h-screen py-6 sm:py-10 px-4 sm:px-6" style={{ background: "var(--background)" }}>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-serif text-2xl font-bold" style={{ color: "#F0E6E2" }}>
            {data.quest?.title || "Quest Submission"}
          </h1>
          <StatusBadge status={claimed ? "CLAIMED" : data.status} />
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Timeline */}
          <div className="md:col-span-1">
            <div
              className="rounded-[18px] p-6"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              <h2
                className="font-serif text-base font-semibold mb-5"
                style={{ color: "#F0E6E2" }}
              >
                Proof Status
              </h2>
              <ProofTimeline status={claimed ? "CLAIMED" : data.status} />

              {POLLING_STATUSES.has(data.status) && (
                <div
                  className="mt-4 flex items-center gap-2 text-xs"
                  style={{ color: "var(--ql-bear)" }}
                >
                  <div
                    className="w-3 h-3 border rounded-full animate-spin"
                    style={{
                      borderColor: "var(--ql-chocolate)",
                      borderTopColor: "transparent",
                    }}
                  />
                  Checking…
                </div>
              )}
            </div>
          </div>

          {/* Right */}
          <div className="md:col-span-2 space-y-6">
            {/* Score breakdown */}
            {data.proofChecks && data.proofChecks.length > 0 && (
              <ScoreBreakdown
                checks={data.proofChecks}
                totalScore={data.score ?? 0}
                minScore={minScore}
              />
            )}

            {/* Failure reasons */}
            {data.failureReasons && data.failureReasons.length > 0 && (
              <div
                className="rounded-[18px] p-6"
                style={{ background: "#F0DADA", border: "1px solid #C9A0A0" }}
              >
                <p className="font-semibold text-sm mb-3" style={{ color: "#5A0000" }}>
                  Proof failed: see checks below
                </p>
                <ul className="space-y-1">
                  {data.failureReasons.map((r, i) => (
                    <li key={i} className="text-xs" style={{ color: "#7A2020" }}>
                      · {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Appeal CTA — only when this is the submitter's own failed proof */}
            {["FAILED", "REJECTED"].includes(data.status) &&
              user?.wallet?.address && (
                <AppealCTA
                  submissionId={data.id}
                  walletAddress={user.wallet.address}
                />
              )}

            {/* Attestation */}
            {data.easAttestationUid && !data.easAttestationUid.includes("0".repeat(32)) && (
              <AttestationCard
                uid={data.easAttestationUid}
                score={data.score ?? 0}
                riskBand={data.riskBand || "LOW_RISK"}
              />
            )}

            {/* Claim */}
            {isClaimable && user?.wallet?.address && (
              <div
                className="rounded-[18px] p-6"
                style={{ background: "var(--card)", border: "1px solid var(--border)" }}
              >
                <h2
                  className="font-serif text-lg font-semibold mb-1"
                  style={{ color: "#F0E6E2" }}
                >
                  Reward unlocked
                </h2>
                <p className="text-sm mb-5" style={{ color: "var(--ql-bear)" }}>
                  Proof passed. Claim your{" "}
                  <strong>{data.quest?.reward_amount} QUEST</strong> tokens and
                  badge gaslessly.
                </p>
                <GaslessClaimButton
                  submissionId={data.id}
                  walletAddress={user.wallet.address}
                  onClaimed={() => setClaimed(true)}
                />
              </div>
            )}

            {/* Claimed success */}
            {(data.status === "CLAIMED" || claimed) && (
              <div
                className="rounded-[18px] p-6 text-center"
                style={{ background: "var(--ql-bighorn)" }}
              >
                <p
                  className="font-serif text-xl font-semibold mb-2"
                  style={{ color: "#F6F1EA" }}
                >
                  Reward claimed
                </p>
                <p className="text-sm mb-4" style={{ color: "var(--ql-cafe)" }}>
                  Tokens and badge have been delivered to your wallet.
                </p>
                <div className="flex flex-wrap gap-3 justify-center">
                  <Link
                    href={`/proof/${data.id}`}
                    className="inline-block px-6 py-2.5 rounded-full text-sm font-medium"
                    style={{ background: "#B01020", color: "#F6F1EA" }}
                  >
                    Share Public Proof →
                  </Link>
                  <Link
                    href="/me"
                    className="inline-block px-6 py-2.5 rounded-full text-sm font-medium"
                    style={{ background: "rgba(255,255,255,0.08)", color: "#F6F1EA" }}
                  >
                    View Profile
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
