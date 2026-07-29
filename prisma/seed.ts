import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

interface TemplateSeed {
  key: string;
  title: string;
  description: string;
  proof_type: string;
  requirements_json: Prisma.InputJsonValue;
  scoring_rubric_json: Prisma.InputJsonValue;
  default_min_score: number;
  default_badge_id: number;
  default_reward_amount: string;
  default_max_claims: number;
  default_deadline_days: number;
  suggested_copy_json: Prisma.InputJsonValue;
}

// v1.2 — five quest templates, one per proof adapter. Each is upserted by `key`
// so reseeding never duplicates and lets us edit defaults safely.
const TEMPLATES: TemplateSeed[] = [
  {
    key: "github_builder_quest",
    title: "GitHub Builder Quest",
    description:
      "Ship a working onchain project on GitHub. The repo must have a README, frontend + contract files, and at least 3 commits authored by you after the quest starts. A live demo URL is required.",
    proof_type: "github_project",
    requirements_json: {
      githubRepo: true,
      publicRepo: true,
      minCommits: 3,
      readme: true,
      demo: true,
      contracts: true,
      frontend: true,
    },
    scoring_rubric_json: {
      repo_exists: 10,
      owner_matches: 10,
      repo_updated_after_start: 10,
      commits_after_start: 15,
      readme_exists: 10,
      readme_length: 10,
      frontend_files: 10,
      contract_files: 10,
      demo_url_loads: 10,
      not_previously_submitted: 5,
    },
    default_min_score: 70,
    default_badge_id: 1,
    default_reward_amount: "10",
    default_max_claims: 50,
    default_deadline_days: 30,
    suggested_copy_json: {
      cta: "Submit your repo URL + demo URL",
      hint: "Demo must be publicly reachable and return HTTP 200.",
    },
  },
  {
    key: "manual_project_quest",
    title: "Manual Project Quest",
    description:
      "Submit a project that is verified by the QuestLock admin team. Use this for hackathon entries, design work, content drops, or builds that do not fit the GitHub auto-checker. An admin reviews your submission and approves it onchain.",
    proof_type: "manual_project",
    requirements_json: {
      manualReview: true,
      requiresDemoUrl: true,
      minExplanationChars: 30,
    },
    scoring_rubric_json: { manual_review_required: 0 },
    default_min_score: 0,
    default_badge_id: 1,
    default_reward_amount: "10",
    default_max_claims: 50,
    default_deadline_days: 30,
    suggested_copy_json: {
      cta: "Submit project title + demo URL + a short writeup",
      hint: "Reviews typically resolve within 72 hours.",
    },
  },
  {
    key: "discord_role_quest",
    title: "Discord Role Quest",
    description:
      "Verify membership of a Discord community and possession of a specific role. Best for ecosystem hubs, contributor circles, and event attendees. Connect Discord on your profile, then claim — deterministic when a bot token is configured, manual review otherwise.",
    proof_type: "discord_role",
    requirements_json: {
      guildId: "REPLACE_WITH_GUILD_ID",
      roleId: "REPLACE_WITH_ROLE_ID",
      requireDiscordLink: true,
    },
    scoring_rubric_json: { discord_role: 100 },
    default_min_score: 100,
    default_badge_id: 2,
    default_reward_amount: "5",
    default_max_claims: 200,
    default_deadline_days: 30,
    suggested_copy_json: {
      cta: "Connect Discord then claim",
      hint: "If the operator has not configured a bot token, an admin verifies manually.",
    },
  },
  {
    key: "x_post_quest",
    title: "X Post Quest",
    description:
      "Post on X (Twitter) about the sponsor / quest with a required hashtag or mention, then submit the post URL. URL + handle are validated deterministically; post content is verified by an admin (v1.2 free tier — no paid X API).",
    proof_type: "x_post",
    requirements_json: {
      requiredHashtag: "#REPLACE_WITH_HASHTAG",
      requiredMention: "@REPLACE_WITH_MENTION",
      minLikes: 0,
    },
    scoring_rubric_json: { x_url_and_author: 100 },
    default_min_score: 100,
    default_badge_id: 2,
    default_reward_amount: "2",
    default_max_claims: 500,
    default_deadline_days: 14,
    suggested_copy_json: {
      cta: "Submit your X handle + post URL",
      hint: "Post must remain live until reviewed. Deleted posts are auto-rejected.",
    },
  },
  {
    key: "lms_course_quest",
    title: "LMS Course Quest",
    description:
      "Complete an external course or training module and submit the certificate URL. Best for partner academies, ecosystem onboarding paths, and accredited learning programmes. Admin-verified.",
    proof_type: "lms_course",
    requirements_json: {
      platform: "REPLACE_WITH_COURSE_PLATFORM",
      requireCertificateUrl: true,
      minExplanationChars: 30,
    },
    scoring_rubric_json: { lms_manual_review: 0 },
    default_min_score: 0,
    default_badge_id: 4,
    default_reward_amount: "8",
    default_max_claims: 100,
    default_deadline_days: 60,
    suggested_copy_json: {
      cta: "Submit course platform + certificate URL + summary",
      hint: "Certificates that hide the learner name will be rejected.",
    },
  },
];

async function main() {
  console.log("Seeding database...");

  const adminWallet = process.env.ADMIN_WALLET_ADDRESS || "0x0000000000000000000000000000000000000001";

  // Upsert admin user
  await prisma.user.upsert({
    where: { wallet_address: adminWallet },
    update: {},
    create: {
      wallet_address: adminWallet,
      github_username: "questlock-admin",
    },
  });

  // ---- Quest templates (v1.2) ----
  console.log(`Seeding ${TEMPLATES.length} quest templates...`);
  for (const t of TEMPLATES) {
    await prisma.questTemplate.upsert({
      where: { key: t.key },
      update: {
        title: t.title,
        description: t.description,
        proof_type: t.proof_type,
        requirements_json: t.requirements_json,
        scoring_rubric_json: t.scoring_rubric_json,
        default_min_score: t.default_min_score,
        default_badge_id: t.default_badge_id,
        default_reward_amount: t.default_reward_amount,
        default_max_claims: t.default_max_claims,
        default_deadline_days: t.default_deadline_days,
        suggested_copy_json: t.suggested_copy_json,
      },
      create: {
        key: t.key,
        title: t.title,
        description: t.description,
        proof_type: t.proof_type,
        requirements_json: t.requirements_json,
        scoring_rubric_json: t.scoring_rubric_json,
        default_min_score: t.default_min_score,
        default_badge_id: t.default_badge_id,
        default_reward_amount: t.default_reward_amount,
        default_max_claims: t.default_max_claims,
        default_deadline_days: t.default_deadline_days,
        suggested_copy_json: t.suggested_copy_json,
      },
    });
    console.log(`  ✓ ${t.key}`);
  }

  // ---- Sample quest (existing) ----
  const existing = await prisma.quest.findFirst({
    where: { title: "Build a Simple Onchain Guestbook" },
  });

  if (!existing) {
    const startTime = new Date();
    const deadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.quest.create({
      data: {
        title: "Build a Simple Onchain Guestbook",
        description:
          "Build and deploy a simple onchain guestbook. Your project must include a Solidity contract, a frontend interface, and a working demo. Push at least 3 commits after the quest starts.",
        quest_type: "github_project",
        requirements_json: {
          githubRepo: true,
          publicRepo: true,
          minCommits: 3,
          readme: true,
          demo: true,
          contracts: true,
          frontend: true,
        },
        scoring_rubric_json: {
          repo_exists: 10,
          owner_matches: 10,
          repo_updated_after_start: 10,
          commits_after_start: 15,
          readme_exists: 10,
          readme_length: 10,
          frontend_files: 10,
          contract_files: 10,
          demo_url_loads: 10,
          not_previously_submitted: 5,
        },
        min_score: 70,
        reward_amount: "10",
        badge_id: 1n,
        start_time: startTime,
        deadline,
        max_claims: 100,
        status: "active",
        created_by: adminWallet,
      },
    });

    console.log("Sample quest created.");
  } else {
    console.log("Sample quest already exists.");
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
