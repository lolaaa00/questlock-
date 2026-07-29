"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import StatusBadge from "@/components/StatusBadge";
import GithubConnectCard from "@/components/GithubConnectCard";
import DiscordConnectCard from "@/components/DiscordConnectCard";
import DisplayNameCard from "@/components/DisplayNameCard";
import { easAttestationUrl, explorerTxUrl } from "@/lib/chains";
import Link from "next/link";

interface Submission {
  id: string;
  status: string;
  score: number | null;
  repo_url: string;
  demo_url: string | null;
  eas_attestation_uid: string | null;
  tx_hash_approval: string | null;
  tx_hash_claim: string | null;
  created_at: string;
  quest: {
    title: string;
    reward_amount: string;
    badge_id: number;
  };
}

const BADGE_NAMES: Record<number, string> = {
  1: "Verified Builder",
  2: "GitHub Contributor",
  3: "Protocol Researcher",
  4: "Serious Learner",
};

export default function ProfilePage() {
  const { authenticated, user, login } = usePrivy();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  // v1.2.x — pull display name + github link for the header identity fallback chain.
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [githubLogin, setGithubLogin] = useState<string | null>(null);
  const [githubAvatar, setGithubAvatar] = useState<string | null>(null);
  // v1.2.x — role chips: count of quests this wallet sponsors
  const [sponsoredCount, setSponsoredCount] = useState<number>(0);

  const walletAddress = user?.wallet?.address;
  const shortAddr = walletAddress
    ? `${walletAddress.slice(0, 8)}…${walletAddress.slice(-6)}`
    : null;

  useEffect(() => {
    if (!walletAddress) return;
    setLoading(true);
    fetch(`/api/submissions?wallet=${walletAddress}`)
      .then((r) => r.json())
      .then((d) => setSubmissions(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
    fetch(`/api/users/display-name?wallet=${walletAddress}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setDisplayName(d.display_name ?? null))
      .catch(() => {});
    fetch(`/api/auth/github/status?wallet=${walletAddress}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.connected) {
          setGithubLogin(d.github_login ?? null);
          setGithubAvatar(d.github_avatar_url ?? null);
        }
      })
      .catch(() => {});
    fetch(`/api/sponsor/quests?wallet=${walletAddress}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setSponsoredCount(Array.isArray(d) ? d.length : 0))
      .catch(() => {});
  }, [walletAddress]);

  const ADMIN_WALLET = "0x1f63ea74065586af0c7c48428372d88d0a89525b";
  const isAdmin = walletAddress?.toLowerCase() === ADMIN_WALLET;

  // Identity fallback chain: display_name → @github_login → short wallet
  const primaryIdentity =
    displayName || (githubLogin ? `@${githubLogin}` : shortAddr);
  // Avatar initial: first 2 chars of the primary identity, uppercased.
  // Drops the leading "@" / "0x" if present so we get readable letters.
  const avatarInitial =
    (displayName?.replace(/^@/, "") ?? githubLogin ?? shortAddr?.slice(2) ?? "")
      .slice(0, 2)
      .toUpperCase();

  if (!authenticated) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center py-16 px-6"
        style={{ background: "var(--background)" }}
      >
        <p
          className="font-serif text-2xl mb-3"
          style={{ color: "#F0E6E2" }}
        >
          Connect to view your profile
        </p>
        <button
          onClick={login}
          className="px-6 py-3 rounded-full font-medium text-sm"
          style={{ background: "#B01020", color: "#F6F1EA" }}
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  const completed = submissions.filter((s) => s.status === "CLAIMED");
  const pending = submissions.filter((s) =>
    ["SUBMITTED", "FETCHING_PROOF", "EVALUATING", "ATTESTING", "APPROVING_ONCHAIN", "PASSED", "ATTESTED"].includes(s.status)
  );
  const claimable = submissions.filter((s) => s.status === "APPROVED_ONCHAIN");
  const failed = submissions.filter((s) =>
    ["FAILED", "REJECTED", "CLAIM_FAILED"].includes(s.status)
  );

  return (
    <div
      className="min-h-screen py-6 sm:py-10 px-4 sm:px-6"
      style={{ background: "var(--background)" }}
    >
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div
          className="rounded-[18px] p-8 mb-8 flex flex-wrap items-center gap-6"
          style={{ background: "var(--ql-bighorn)" }}
        >
          {githubAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={githubAvatar}
              alt={githubLogin || "avatar"}
              className="w-16 h-16 rounded-full"
            />
          ) : (
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold"
              style={{ background: "#B01020", color: "#F6F1EA" }}
            >
              {avatarInitial}
            </div>
          )}
          <div>
            <p
              className="text-xs uppercase tracking-widest mb-1"
              style={{ color: "var(--ql-cafe)" }}
            >
              Profile
            </p>
            <p
              className={`text-lg font-bold ${displayName || githubLogin ? "" : "font-mono"}`}
              style={{ color: "#F6F1EA" }}
            >
              {primaryIdentity}
            </p>
            {(displayName || githubLogin) && (
              <p className="font-mono text-xs mt-0.5" style={{ color: "var(--ql-cafe)" }}>
                {shortAddr}
              </p>
            )}
            {user?.wallet?.address && (
              <p className="text-xs mt-0.5" style={{ color: "var(--ql-bear)" }}>
                {user.wallet.address}
              </p>
            )}
            {/* v1.2.x — role chips: only render roles that actually apply */}
            {(submissions.length > 0 || sponsoredCount > 0 || isAdmin) && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {submissions.length > 0 && (
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(176,16,32,0.25)", color: "#F6F1EA", border: "1px solid rgba(176,16,32,0.6)" }}
                  >
                    Builder
                  </span>
                )}
                {sponsoredCount > 0 && (
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(45,90,45,0.25)", color: "#D9EDD9", border: "1px solid rgba(45,90,45,0.6)" }}
                  >
                    Sponsor
                  </span>
                )}
                {isAdmin && (
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(122,90,32,0.25)", color: "#FFF1D6", border: "1px solid rgba(122,90,32,0.6)" }}
                  >
                    Admin
                  </span>
                )}
              </div>
            )}
          </div>
          <div
            className="ml-auto flex gap-6 text-center"
          >
            <div>
              <p className="text-2xl font-bold font-mono" style={{ color: "#F6F1EA" }}>
                {completed.length}
              </p>
              <p className="text-xs" style={{ color: "var(--ql-cafe)" }}>Completed</p>
            </div>
            <div>
              <p className="text-2xl font-bold font-mono" style={{ color: "#B01020" }}>
                {claimable.length}
              </p>
              <p className="text-xs" style={{ color: "var(--ql-cafe)" }}>Claimable</p>
            </div>
            <div>
              <p className="text-2xl font-bold font-mono" style={{ color: "var(--ql-cafe)" }}>
                {pending.length}
              </p>
              <p className="text-xs" style={{ color: "var(--ql-cafe)" }}>Pending</p>
            </div>
          </div>
        </div>

        {walletAddress && <DisplayNameCard walletAddress={walletAddress} />}
        {walletAddress && <GithubConnectCard walletAddress={walletAddress} />}
        {walletAddress && <DiscordConnectCard walletAddress={walletAddress} />}

        {loading ? (
          <p className="text-center py-12" style={{ color: "var(--ql-bear)" }}>
            Loading submissions…
          </p>
        ) : submissions.length === 0 ? (
          <div
            className="text-center py-20 rounded-[18px]"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <p
              className="font-serif text-xl mb-2"
              style={{ color: "#F0E6E2" }}
            >
              No submissions yet
            </p>
            <p className="text-sm mb-4" style={{ color: "var(--ql-bear)" }}>
              Submit proof for an open quest to get started.
            </p>
            <Link
              href="/quests"
              className="inline-block px-6 py-2.5 rounded-full text-sm font-medium"
              style={{ background: "#B01020", color: "#F6F1EA" }}
            >
              Browse Quests
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {[
              { label: "Claimable Rewards", items: claimable },
              { label: "Completed Quests", items: completed },
              { label: "Pending", items: pending },
              { label: "Rejected / Failed", items: failed },
            ].map(({ label, items }) =>
              items.length === 0 ? null : (
                <section key={label}>
                  <h2
                    className="font-serif text-lg font-semibold mb-3"
                    style={{ color: "#F0E6E2" }}
                  >
                    {label}
                  </h2>
                  <div className="space-y-3">
                    {items.map((s) => (
                      <div
                        key={s.id}
                        className="rounded-[18px] p-5"
                        style={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                          <div>
                            <p
                              className="font-medium"
                              style={{ color: "#F0E6E2" }}
                            >
                              {s.quest.title}
                            </p>
                            <p
                              className="text-xs mt-0.5"
                              style={{ color: "var(--ql-bear)" }}
                            >
                              {s.quest.reward_amount} QUEST ·{" "}
                              {BADGE_NAMES[Number(s.quest.badge_id)] || "Badge"} ·
                              Score: {s.score ?? "—"}
                            </p>
                          </div>
                          <StatusBadge status={s.status} />
                        </div>

                        <div className="flex flex-wrap gap-3 text-xs">
                          {s.eas_attestation_uid && (
                            <a
                              href={easAttestationUrl(s.eas_attestation_uid)}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: "#B01020" }}
                            >
                              Attestation →
                            </a>
                          )}
                          {s.tx_hash_claim && (
                            <a
                              href={explorerTxUrl(s.tx_hash_claim)}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: "#B01020" }}
                            >
                              Claim tx →
                            </a>
                          )}
                          {s.tx_hash_approval && (
                            <a
                              href={explorerTxUrl(s.tx_hash_approval)}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: "var(--ql-bear)" }}
                            >
                              Approval tx →
                            </a>
                          )}
                          {s.status === "APPROVED_ONCHAIN" && (
                            <Link
                              href={`/submit/${s.quest}?submissionId=${s.id}`}
                              className="font-semibold"
                              style={{ color: "#B01020" }}
                            >
                              Claim reward →
                            </Link>
                          )}
                          {["APPROVED_ONCHAIN", "CLAIMING", "CLAIMED", "ATTESTED"].includes(s.status) && (
                            <Link
                              href={`/proof/${s.id}`}
                              style={{ color: "#B01020" }}
                            >
                              Public proof →
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
