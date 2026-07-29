-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "github_username" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quests" (
    "id" TEXT NOT NULL,
    "onchain_quest_id" BIGINT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quest_type" TEXT NOT NULL DEFAULT 'github_project',
    "requirements_json" JSONB NOT NULL DEFAULT '{}',
    "scoring_rubric_json" JSONB NOT NULL DEFAULT '{}',
    "min_score" INTEGER NOT NULL DEFAULT 70,
    "reward_amount" TEXT NOT NULL,
    "reward_token_address" TEXT,
    "badge_id" BIGINT NOT NULL DEFAULT 1,
    "start_time" TIMESTAMP(3) NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "max_claims" INTEGER NOT NULL DEFAULT 100,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "quest_id" TEXT NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "github_username" TEXT NOT NULL,
    "repo_url" TEXT NOT NULL,
    "demo_url" TEXT,
    "explanation" TEXT,
    "proof_hash" TEXT,
    "score" INTEGER,
    "risk_band" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "failure_reasons_json" JSONB NOT NULL DEFAULT '[]',
    "eas_attestation_uid" TEXT,
    "tx_hash_approval" TEXT,
    "tx_hash_claim" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proof_checks" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "check_name" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "points_awarded" INTEGER NOT NULL,
    "max_points" INTEGER NOT NULL,
    "details_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proof_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duplicate_index" (
    "id" TEXT NOT NULL,
    "quest_id" TEXT NOT NULL,
    "repo_url_hash" TEXT,
    "github_username_hash" TEXT,
    "demo_url_hash" TEXT,
    "wallet_address" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "duplicate_index_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_events" (
    "id" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "tx_hash" TEXT NOT NULL,
    "block_number" BIGINT NOT NULL,
    "quest_id" TEXT,
    "wallet_address" TEXT,
    "payload_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_logs" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_wallet_address_key" ON "users"("wallet_address");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_quest_id_wallet_address_key" ON "submissions"("quest_id", "wallet_address");

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_quest_id_fkey" FOREIGN KEY ("quest_id") REFERENCES "quests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_wallet_address_fkey" FOREIGN KEY ("wallet_address") REFERENCES "users"("wallet_address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_checks" ADD CONSTRAINT "proof_checks_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duplicate_index" ADD CONSTRAINT "duplicate_index_quest_id_fkey" FOREIGN KEY ("quest_id") REFERENCES "quests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
