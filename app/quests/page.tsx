import QuestCard from "@/components/QuestCard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getQuests() {
  try {
    const quests = await prisma.quest.findMany({
      where: { status: "active" },
      orderBy: { created_at: "desc" },
      include: {
        _count: {
          select: { submissions: { where: { status: "CLAIMED" } } },
        },
      },
    });
    return quests;
  } catch {
    return [];
  }
}

export default async function QuestsPage() {
  const quests = await getQuests();

  return (
    <div className="min-h-screen py-10 sm:py-16 px-4 sm:px-6" style={{ background: "var(--background)" }}>
      <div className="max-w-5xl mx-auto">
        <div className="mb-12">
          <h1 className="font-sans text-4xl font-bold mb-3" style={{ color: "#F0E6E2" }}>
            Open Quests
          </h1>
          <p style={{ color: "var(--ql-bear)" }}>
            Submit proof, pass objective checks, claim rewards on Base Sepolia.
          </p>
        </div>

        {quests.length === 0 ? (
          <div
            className="text-center py-20 rounded-[18px]"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <p className="font-sans text-xl mb-2" style={{ color: "#F0E6E2" }}>
              No active quests
            </p>
            <p className="text-sm" style={{ color: "var(--ql-bear)" }}>
              Check back soon or create a quest in the admin panel.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quests.map((q) => (
              <QuestCard
                key={q.id}
                id={q.id}
                title={q.title}
                description={q.description || ""}
                rewardAmount={q.reward_amount}
                badgeId={Number(q.badge_id)}
                deadline={q.deadline.toISOString()}
                minScore={q.min_score}
                maxClaims={q.max_claims}
                claimCount={q._count.submissions}
                status={q.status}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
