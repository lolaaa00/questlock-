import Link from "next/link";
import StatusBadge from "./StatusBadge";

interface QuestCardProps {
  id: string;
  title: string;
  description: string;
  rewardAmount: string;
  badgeId: number;
  deadline: string;
  minScore: number;
  maxClaims: number;
  claimCount?: number;
  status: string;
}

const BADGE_NAMES: Record<number, string> = {
  1: "Verified Builder",
  2: "GitHub Contributor",
  3: "Protocol Researcher",
  4: "Serious Learner",
};

export default function QuestCard({
  id,
  title,
  description,
  rewardAmount,
  badgeId,
  deadline,
  minScore,
  maxClaims,
  claimCount = 0,
  status,
}: QuestCardProps) {
  const deadlineDate = new Date(deadline);
  const isExpired = deadlineDate < new Date();
  const daysLeft = Math.max(
    0,
    Math.ceil((deadlineDate.getTime() - Date.now()) / 86_400_000)
  );

  return (
    <Link href={`/quests/${id}`} className="block quest-card p-6 group">
      <div className="flex items-start justify-between gap-4 mb-3">
        <h3
          className="font-serif text-lg font-semibold leading-snug group-hover:text-[#B01020] transition-colors"
          style={{ color: "#F0E6E2" }}
        >
          {title}
        </h3>
        <span
          className="shrink-0 font-semibold text-sm px-3 py-1 rounded-full"
          style={{ background: "#B01020", color: "#F6F1EA" }}
        >
          {rewardAmount} QUEST
        </span>
      </div>

      <p
        className="text-sm leading-relaxed mb-4 line-clamp-2"
        style={{ color: "var(--ql-bear)" }}
      >
        {description}
      </p>

      <div className="flex flex-wrap gap-2 text-xs mb-4">
        <span
          className="px-2 py-0.5 rounded"
          style={{ background: "var(--muted)", color: "var(--ql-bear)" }}
        >
          GitHub Project
        </span>
        <span
          className="px-2 py-0.5 rounded"
          style={{ background: "var(--muted)", color: "var(--ql-bear)" }}
        >
          Min score: {minScore}
        </span>
        <span
          className="px-2 py-0.5 rounded"
          style={{ background: "var(--muted)", color: "var(--ql-bear)" }}
        >
          {BADGE_NAMES[badgeId] || `Badge #${badgeId}`}
        </span>
      </div>

      <div
        className="flex items-center justify-between text-xs pt-3 border-t"
        style={{ borderColor: "var(--border)" }}
      >
        <span style={{ color: "var(--ql-bear)" }}>
          {isExpired
            ? "Expired"
            : daysLeft === 0
            ? "Expires today"
            : `${daysLeft}d left`}
        </span>
        <span style={{ color: "var(--ql-bear)" }}>
          {claimCount} / {maxClaims} claimed
        </span>
      </div>
    </Link>
  );
}
