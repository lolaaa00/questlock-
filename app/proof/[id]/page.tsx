import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { isPubliclyVisible, toPublicProof } from "@/lib/public-proof";
import {
  easAttestationUrl,
  explorerTxUrl,
  explorerAddressUrl,
} from "@/lib/chains";

export const dynamic = "force-dynamic";

const BADGE_NAMES: Record<string, string> = {
  "1": "Verified Builder",
  "2": "GitHub Contributor",
  "3": "Protocol Researcher",
  "4": "Serious Learner",
};

const CHECK_LABELS: Record<string, string> = {
  repo_exists: "Repository found",
  owner_matches: "Owner matches GitHub username",
  repo_updated_after_start: "Updated after quest start",
  commits_after_start: "Commits after quest start",
  readme_exists: "README present",
  readme_length: "README has 500+ characters",
  frontend_files: "Frontend files detected",
  contract_files: "Contract/backend files detected",
  demo_url_loads: "Demo URL loads",
  not_previously_submitted: "Not previously submitted",
};

async function getPublicProof(id: string) {
  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      proof_checks: { orderBy: { created_at: "asc" } },
      quest: {
        select: {
          id: true,
          title: true,
          description: true,
          reward_amount: true,
          badge_id: true,
          min_score: true,
        },
      },
      user: {
        select: {
          display_name: true,
          github_login: true,
          github_avatar_url: true,
          github_profile_url: true,
        },
      },
    },
  });
  if (!submission || !isPubliclyVisible(submission.status)) return null;
  // toPublicProof tolerates the extra proof_type / evidence_json fields.
  return toPublicProof(submission as Parameters<typeof toPublicProof>[0]);
}

const PROOF_TYPE_LABELS: Record<string, string> = {
  github_project: "GitHub Project",
  manual_project: "Manual Project",
  discord_role:   "Discord Role",
  x_post:         "X / Twitter Post",
  lms_course:     "LMS / Course Completion",
};

function SubmittedArtefacts({ proof }: { proof: NonNullable<Awaited<ReturnType<typeof getPublicProof>>> }) {
  const ev = proof.evidence_public ?? {};
  // Common header
  const wrapperStyle = { background: "var(--card)", border: "1px solid var(--border)" };

  // Render per proof type. Each block stays in the public-safe whitelist.
  if (proof.proof_type === "github_project") {
    return (
      <div className="rounded-[18px] p-6 mb-6" style={wrapperStyle}>
        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--ql-bear)" }}>
          Submitted Work · GitHub Project
        </p>
        <div className="space-y-2 text-sm">
          <a href={proof.repo_url} target="_blank" rel="noopener noreferrer" className="block break-all" style={{ color: "#B01020" }}>
            {proof.repo_url}
          </a>
          {proof.demo_url && (
            <a href={proof.demo_url} target="_blank" rel="noopener noreferrer" className="block break-all" style={{ color: "#B01020" }}>
              {proof.demo_url}
            </a>
          )}
          {(ev.language || ev.default_branch || ev.commits_after_start) && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 text-xs" style={{ borderTop: "1px solid var(--border)" }}>
              {ev.language && <FactCell k="Language" v={String(ev.language)} />}
              {ev.default_branch && <FactCell k="Default branch" v={String(ev.default_branch)} />}
              {ev.commits_after_start !== null && ev.commits_after_start !== undefined && (
                <FactCell k="Commits after start" v={String(ev.commits_after_start)} />
              )}
              {ev.readme_chars !== null && ev.readme_chars !== undefined && (
                <FactCell k="README chars" v={String(ev.readme_chars)} />
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (proof.proof_type === "manual_project") {
    return (
      <div className="rounded-[18px] p-6 mb-6" style={wrapperStyle}>
        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--ql-bear)" }}>
          Submitted Work · Manual Project
        </p>
        <div className="space-y-2 text-sm">
          {ev.project_title && (
            <p className="font-semibold" style={{ color: "#F0E6E2" }}>{String(ev.project_title)}</p>
          )}
          {ev.demo_url && (
            <a href={String(ev.demo_url)} target="_blank" rel="noopener noreferrer" className="block break-all" style={{ color: "#B01020" }}>
              {String(ev.demo_url)}
            </a>
          )}
          {ev.supporting_link && (
            <a href={String(ev.supporting_link)} target="_blank" rel="noopener noreferrer" className="block break-all text-xs" style={{ color: "#B01020" }}>
              Supporting: {String(ev.supporting_link)}
            </a>
          )}
          <p className="text-xs pt-2 italic" style={{ color: "var(--ql-bear)" }}>
            Admin-reviewed. Submitter explanation kept private.
          </p>
        </div>
      </div>
    );
  }

  if (proof.proof_type === "discord_role") {
    return (
      <div className="rounded-[18px] p-6 mb-6" style={wrapperStyle}>
        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--ql-bear)" }}>
          Submitted Work · Discord Role
        </p>
        <div className="space-y-2 text-sm">
          {ev.discord_username && <FactRow k="Discord handle" v={String(ev.discord_username)} />}
          {ev.guild_name && <FactRow k="Guild" v={String(ev.guild_name)} />}
          {ev.role_name && <FactRow k="Role" v={String(ev.role_name)} />}
          {!ev.discord_username && !ev.guild_name && !ev.role_name && (
            <p className="text-xs italic" style={{ color: "var(--ql-bear)" }}>
              Discord membership verified.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (proof.proof_type === "x_post") {
    return (
      <div className="rounded-[18px] p-6 mb-6" style={wrapperStyle}>
        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--ql-bear)" }}>
          Submitted Work · X / Twitter Post
        </p>
        <div className="space-y-2 text-sm">
          {ev.handle && <FactRow k="Handle" v={String(ev.handle)} />}
          {ev.post_url && (
            <a href={String(ev.post_url)} target="_blank" rel="noopener noreferrer" className="block break-all" style={{ color: "#B01020" }}>
              {String(ev.post_url)}
            </a>
          )}
          {ev.post_id && <FactRow k="Post ID" v={String(ev.post_id)} />}
        </div>
      </div>
    );
  }

  if (proof.proof_type === "lms_course") {
    return (
      <div className="rounded-[18px] p-6 mb-6" style={wrapperStyle}>
        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--ql-bear)" }}>
          Submitted Work · Course Completion
        </p>
        <div className="space-y-2 text-sm">
          {ev.platform && <FactRow k="Platform" v={String(ev.platform)} />}
          {ev.certificate_url && (
            <a href={String(ev.certificate_url)} target="_blank" rel="noopener noreferrer" className="block break-all" style={{ color: "#B01020" }}>
              {String(ev.certificate_url)}
            </a>
          )}
          {ev.completion_id && <FactRow k="Completion ID" v={String(ev.completion_id)} />}
        </div>
      </div>
    );
  }

  // Unknown proof type — graceful fallback.
  return (
    <div className="rounded-[18px] p-6 mb-6" style={wrapperStyle}>
      <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--ql-bear)" }}>
        Submitted Work
      </p>
      <p className="text-sm" style={{ color: "var(--ql-bear)" }}>
        Proof type: {PROOF_TYPE_LABELS[proof.proof_type] || proof.proof_type}
      </p>
    </div>
  );
}

function FactCell({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase" style={{ color: "var(--ql-bear)" }}>{k}</p>
      <p className="text-xs font-mono" style={{ color: "#F0E6E2" }}>{v}</p>
    </div>
  );
}

function FactRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span style={{ color: "var(--ql-bear)" }}>{k}</span>
      <span className="font-mono text-xs" style={{ color: "#F0E6E2" }}>{v}</span>
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const proof = await getPublicProof(id);
  if (!proof) return { title: "QuestLock — Proof Not Found" };

  const who = proof.github_login ? `@${proof.github_login}` : "Anonymous builder";
  return {
    title: `${who} passed ${proof.quest.title} — QuestLock`,
    description: `Score ${proof.score} / 100 · ${proof.risk_band.replace("_RISK", "")} risk · Verified on Base Sepolia via EAS.`,
    openGraph: {
      title: `${who} passed ${proof.quest.title}`,
      description: `Score ${proof.score} / 100 on QuestLock. Proof verified on Base Sepolia.`,
      type: "article",
    },
  };
}

export default async function PublicProofPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const proof = await getPublicProof(id);
  if (!proof) notFound();

  const badgeName = BADGE_NAMES[proof.quest.badge_id] || `Badge #${proof.quest.badge_id}`;
  const shortWallet = `${proof.wallet_address.slice(0, 8)}…${proof.wallet_address.slice(-6)}`;
  const totalMax = proof.proof_checks.reduce((s, c) => s + c.max_points, 0);

  // v1.2 fallback chain: display_name → @github_login → short wallet
  const subjectLabel = proof.display_name
    || (proof.github_login ? `@${proof.github_login}` : shortWallet);

  return (
    <div className="min-h-screen py-6 sm:py-10 px-4 sm:px-6" style={{ background: "var(--background)" }}>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link href="/quests" className="text-sm" style={{ color: "var(--ql-bear)" }}>
            ← QuestLock
          </Link>
          <span
            className="text-xs uppercase tracking-widest font-semibold px-3 py-1 rounded-full"
            style={
              proof.status === "CLAIMED"
                ? { background: "#1A0A08", color: "#F6F1EA" }
                : { background: "#B01020", color: "#F6F1EA" }
            }
          >
            {proof.status === "CLAIMED" ? "Reward Claimed" : "Reward Unlocked"}
          </span>
        </div>

        {/* Hero certificate card */}
        <div
          className="rounded-[18px] p-6 sm:p-10 mb-6"
          style={{ background: "var(--ql-bighorn)" }}
        >
          <p
            className="text-xs uppercase tracking-widest mb-3"
            style={{ color: "var(--ql-cafe)" }}
          >
            Proof of Build · QuestLock
          </p>
          <h1
            className="font-sans text-3xl md:text-4xl font-bold leading-tight mb-4"
            style={{ color: "#F6F1EA" }}
          >
            {subjectLabel} passed{" "}
            <span style={{ color: "#B01020" }}>{proof.quest.title}</span>
          </h1>
          <div className="flex flex-wrap items-center gap-4 mb-6">
            {proof.github_avatar_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={proof.github_avatar_url}
                alt={proof.github_login || ""}
                className="w-12 h-12 rounded-full"
              />
            )}
            <div>
              {proof.github_login && (
                <a
                  href={proof.github_profile_url || `https://github.com/${proof.github_login}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold"
                  style={{ color: "#F6F1EA" }}
                >
                  @{proof.github_login}
                </a>
              )}
              <a
                href={explorerAddressUrl(proof.wallet_address)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs block"
                style={{ color: "var(--ql-cafe)" }}
              >
                {shortWallet}
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs uppercase" style={{ color: "var(--ql-cafe)" }}>Score</p>
              <p className="text-3xl font-bold font-mono" style={{ color: "#F6F1EA" }}>
                {proof.score}
                <span className="text-base font-normal" style={{ color: "var(--ql-bear)" }}>
                  /{totalMax}
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs uppercase" style={{ color: "var(--ql-cafe)" }}>Risk</p>
              <p className="text-lg font-semibold" style={{ color: "#F6F1EA" }}>
                {proof.risk_band.replace("_RISK", "")}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase" style={{ color: "var(--ql-cafe)" }}>Reward</p>
              <p className="text-lg font-semibold font-mono" style={{ color: "#F6F1EA" }}>
                {proof.quest.reward_amount} QUEST
              </p>
            </div>
            <div>
              <p className="text-xs uppercase" style={{ color: "var(--ql-cafe)" }}>Badge</p>
              <p className="text-lg font-semibold" style={{ color: "#F6F1EA" }}>{badgeName}</p>
            </div>
          </div>
        </div>

        {/* Onchain links */}
        <div
          className="rounded-[18px] p-6 mb-6"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <p
            className="text-xs uppercase tracking-widest mb-4"
            style={{ color: "var(--ql-bear)" }}
          >
            Onchain Verification
          </p>
          <div className="space-y-3 text-sm">
            {proof.eas_attestation_uid &&
              proof.eas_attestation_uid !== "0x" + "0".repeat(64) && (
                <div className="flex justify-between gap-3">
                  <span style={{ color: "var(--ql-bear)" }}>EAS attestation</span>
                  <a
                    href={easAttestationUrl(proof.eas_attestation_uid)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs truncate ml-2"
                    style={{ color: "#B01020" }}
                  >
                    {proof.eas_attestation_uid.slice(0, 12)}…{proof.eas_attestation_uid.slice(-6)} →
                  </a>
                </div>
              )}
            {proof.tx_hash_approval && (
              <div className="flex justify-between gap-3">
                <span style={{ color: "var(--ql-bear)" }}>Approval transaction</span>
                <a
                  href={explorerTxUrl(proof.tx_hash_approval)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs"
                  style={{ color: "#B01020" }}
                >
                  {proof.tx_hash_approval.slice(0, 12)}…{proof.tx_hash_approval.slice(-6)} →
                </a>
              </div>
            )}
            {proof.tx_hash_claim && (
              <div className="flex justify-between gap-3">
                <span style={{ color: "var(--ql-bear)" }}>Claim transaction</span>
                <a
                  href={explorerTxUrl(proof.tx_hash_claim)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs"
                  style={{ color: "#B01020" }}
                >
                  {proof.tx_hash_claim.slice(0, 12)}…{proof.tx_hash_claim.slice(-6)} →
                </a>
              </div>
            )}
            {proof.proof_hash && (
              <div className="flex justify-between gap-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                <span style={{ color: "var(--ql-bear)" }}>Proof hash</span>
                <span className="font-mono text-xs" style={{ color: "var(--ql-bear)" }}>
                  {proof.proof_hash.slice(0, 12)}…{proof.proof_hash.slice(-6)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Submitted artefacts — adapter-aware */}
        <SubmittedArtefacts proof={proof} />

        {/* Proof type chip */}
        <div className="mb-6 flex items-center gap-2 text-xs">
          <span className="uppercase tracking-widest" style={{ color: "var(--ql-bear)" }}>Proof type</span>
          <span
            className="px-2 py-0.5 rounded-full font-semibold"
            style={{ background: "#1A0A08", color: "#F6F1EA" }}
          >
            {PROOF_TYPE_LABELS[proof.proof_type] || proof.proof_type}
          </span>
        </div>

        {/* Proof checks */}
        <div
          className="rounded-[18px] overflow-hidden"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <p className="font-sans text-base font-semibold" style={{ color: "#F0E6E2" }}>
              Proof Checks
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--ql-bear)" }}>
              {proof.proof_type === "github_project"
                ? `Pass mark: ${proof.quest.min_score} / ${totalMax} · all checks are deterministic`
                : proof.proof_type === "discord_role"
                ? `Pass mark: ${proof.quest.min_score} / ${totalMax} · deterministic when bot token configured, otherwise admin-verified`
                : `Pass mark: ${proof.quest.min_score} / ${totalMax} · admin-verified proof`}
            </p>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {proof.proof_checks.map((c, i) => (
                <tr
                  key={c.check_name}
                  style={{
                    borderTop: i > 0 ? "1px solid var(--border)" : undefined,
                  }}
                >
                  <td className="px-6 py-3" style={{ color: "#F0E6E2" }}>
                    {CHECK_LABELS[c.check_name] || c.check_name}
                  </td>
                  <td className="px-4 py-3 text-center w-16">
                    <span
                      className="inline-block w-5 h-5 rounded-full text-xs font-bold leading-5 text-center"
                      style={
                        c.passed
                          ? { background: "#D9EDD9", color: "rgba(122,158,111,0.35)" }
                          : { background: "#F0DADA", color: "#7A2020" }
                      }
                    >
                      {c.passed ? "✓" : "✕"}
                    </span>
                  </td>
                  <td
                    className="px-6 py-3 text-right font-mono text-xs"
                    style={{ color: c.passed ? "rgba(122,158,111,0.35)" : "#7A2020" }}
                  >
                    {c.points_awarded}/{c.max_points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-center mt-6" style={{ color: "var(--ql-bear)" }}>
          Issued by QuestLock on Base Sepolia · Verifiable via EAS · Rewards follow proof, not farming.
        </p>
      </div>
    </div>
  );
}
