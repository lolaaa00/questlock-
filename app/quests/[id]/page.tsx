import { notFound } from "next/navigation";
import Link from "next/link";
import ProofSubmissionForm from "@/components/ProofSubmissionForm";
import CreatorGuardNotice from "@/components/CreatorGuardNotice";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getQuest(id: string) {
  try {
    return await prisma.quest.findUnique({
      where: { id },
      include: {
        _count: { select: { submissions: { where: { status: "CLAIMED" } } } },
      },
    });
  } catch {
    return null;
  }
}

const BADGE_NAMES: Record<number, string> = {
  1: "Verified Builder",
  2: "GitHub Contributor",
  3: "Protocol Researcher",
  4: "Serious Learner",
};

const CHECK_LABELS: Record<string, string> = {
  repo_exists: "Repository exists and is public",
  owner_matches: "Owner matches submitted GitHub username",
  repo_updated_after_start: "Updated after quest start date",
  commits_after_start: "At least 3 commits after quest start",
  readme_exists: "README file present",
  readme_length: "README has 500+ characters",
  frontend_files: "Frontend files detected",
  contract_files: "Contract or backend files detected",
  demo_url_loads: "Demo URL loads successfully",
  not_previously_submitted: "Not previously submitted for this quest",
};

export default async function QuestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const quest = await getQuest(id);
  if (!quest) notFound();

  const deadline = quest.deadline instanceof Date ? quest.deadline : new Date(quest.deadline);
  const isExpired = deadline < new Date();
  const daysLeft = Math.max(
    0,
    Math.ceil((deadline.getTime() - Date.now()) / 86_400_000)
  );

  const rubric = (quest.scoring_rubric_json as Record<string, number>) || {};
  const checks = Object.entries(CHECK_LABELS).map(([key, label]) => ({
    key,
    label,
    points: rubric[key] ?? { repo_exists: 10, owner_matches: 10, repo_updated_after_start: 10, commits_after_start: 15, readme_exists: 10, readme_length: 10, frontend_files: 10, contract_files: 10, demo_url_loads: 10, not_previously_submitted: 5 }[key] ?? 0,
  }));

  return (
    <div className="min-h-screen py-6 sm:py-10 px-4 sm:px-6" style={{ background: "var(--background)" }}>
      <div className="max-w-4xl mx-auto">
        <Link
          href="/quests"
          className="text-sm mb-8 inline-block"
          style={{ color: "var(--ql-bear)" }}
        >
          ← Back to Quests
        </Link>

        {/* Header */}
        <div
          className="rounded-[18px] p-8 mb-8"
          style={{ background: "var(--ql-bighorn)" }}
        >
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <p
                className="text-xs uppercase tracking-widest mb-2"
                style={{ color: "var(--ql-cafe)" }}
              >
                GitHub Project Quest
              </p>
              <h1
                className="font-serif text-3xl md:text-4xl font-bold"
                style={{ color: "#F6F1EA" }}
              >
                {quest.title}
              </h1>
            </div>
            <div className="text-right">
              <p
                className="text-3xl font-bold font-mono"
                style={{ color: "#B01020" }}
              >
                {quest.reward_amount} QUEST
              </p>
              <p className="text-sm mt-1" style={{ color: "var(--ql-cafe)" }}>
                {BADGE_NAMES[Number(quest.badge_id)] || `Badge #${quest.badge_id}`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm" style={{ color: "var(--ql-cafe)" }}>
            <span>
              {isExpired
                ? "Expired"
                : daysLeft === 0
                ? "Expires today"
                : `${daysLeft} days left`}{" "}
              · Deadline {deadline.toLocaleDateString()}
            </span>
            <span>
              {quest._count?.submissions || 0} / {quest.max_claims} claimed
            </span>
            <span>Min score: {quest.min_score}</span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Left */}
          <div className="space-y-6">
            {/* Description */}
            <div
              className="rounded-[18px] p-6"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              <h2
                className="font-serif text-lg font-semibold mb-3"
                style={{ color: "#F0E6E2" }}
              >
                Description
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: "var(--ql-bear)" }}>
                {quest.description || "No description provided."}
              </p>
            </div>

            {/* Scoring rubric */}
            <div
              className="rounded-[18px] overflow-hidden"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              <div
                className="px-6 py-4"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <h2
                  className="font-serif text-lg font-semibold"
                  style={{ color: "#F0E6E2" }}
                >
                  Scoring Rubric
                </h2>
                <p className="text-xs mt-1" style={{ color: "var(--ql-bear)" }}>
                  Pass mark: {quest.min_score} / 100
                </p>
              </div>
              {checks.map(({ key, label, points }) => (
                <div
                  key={key}
                  className="flex items-center justify-between px-6 py-3 text-sm border-t"
                  style={{ borderColor: "var(--border)" }}
                >
                  <span style={{ color: "var(--ql-bear)" }}>{label}</span>
                  <span
                    className="font-mono font-semibold shrink-0 ml-4"
                    style={{ color: "var(--ql-chocolate)" }}
                  >
                    {points} pts
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Submit proof */}
          <div>
            {isExpired ? (
              <div
                className="rounded-[18px] p-6 text-center"
                style={{ background: "var(--card)", border: "1px solid var(--border)" }}
              >
                <p
                  className="font-serif text-lg mb-2"
                  style={{ color: "#F0E6E2" }}
                >
                  Quest expired
                </p>
                <p className="text-sm" style={{ color: "var(--ql-bear)" }}>
                  This quest is no longer accepting submissions.
                </p>
              </div>
            ) : (
              <div
                className="rounded-[18px] p-6"
                style={{ background: "var(--card)", border: "1px solid var(--border)" }}
              >
                <CreatorGuardNotice
                  created_by={quest.created_by}
                  sponsor_wallet={quest.sponsor_wallet ?? null}
                />
                <h2
                  className="font-serif text-lg font-semibold mb-5"
                  style={{ color: "#F0E6E2" }}
                >
                  Submit Proof
                </h2>
                <ProofSubmissionForm
                  questId={quest.id}
                  questTitle={quest.title}
                  createdBy={quest.created_by}
                  sponsorWallet={quest.sponsor_wallet ?? null}
                  proofType={quest.proof_type}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
