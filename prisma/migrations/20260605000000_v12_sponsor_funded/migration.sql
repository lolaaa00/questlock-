-- v1.2: sponsor-funded per-quest pools + multi-proof + ops infrastructure.
-- All additive. No drops, no renames, no destructive changes.
-- Legacy v1.1.4 quests stay readable; defaults backfill them as
-- contract_version=1, proof_type=github_project, funding_status=LEGACY_SHARED.

-- 1. quests: per-quest funding accounting + V2 routing
ALTER TABLE "quests"
  ADD COLUMN "contract_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "funded_quest_id" BIGINT,
  ADD COLUMN "funding_status" TEXT NOT NULL DEFAULT 'LEGACY_SHARED',
  ADD COLUMN "required_funding" TEXT,
  ADD COLUMN "funded_amount" TEXT DEFAULT '0',
  ADD COLUMN "claimed_amount_onchain" TEXT DEFAULT '0',
  ADD COLUMN "withdrawn_amount" TEXT DEFAULT '0',
  ADD COLUMN "proof_type" TEXT NOT NULL DEFAULT 'github_project';

CREATE INDEX "quests_contract_version_idx" ON "quests"("contract_version");
CREATE INDEX "quests_funding_status_idx"   ON "quests"("funding_status");
CREATE INDEX "quests_proof_type_idx"       ON "quests"("proof_type");

-- 2. submissions: adapter dispatch + generic evidence
ALTER TABLE "submissions"
  ADD COLUMN "proof_type"    TEXT NOT NULL DEFAULT 'github_project',
  ADD COLUMN "evidence_json" JSONB DEFAULT '{}';

-- 3. quest_requests: funding fields for sponsor flow
ALTER TABLE "quest_requests"
  ADD COLUMN "proof_type"       TEXT NOT NULL DEFAULT 'github_project',
  ADD COLUMN "required_funding" TEXT,
  ADD COLUMN "funded_amount"    TEXT DEFAULT '0';

-- 4. rate_limit_buckets — durable supabase-backed rate limiter
CREATE TABLE "rate_limit_buckets" (
  "id"             TEXT NOT NULL,
  "key"            TEXT NOT NULL,
  "route"          TEXT NOT NULL,
  "window_start"   TIMESTAMP(3) NOT NULL,
  "window_seconds" INTEGER NOT NULL,
  "count"          INTEGER NOT NULL DEFAULT 0,
  "limit"          INTEGER NOT NULL,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "rate_limit_buckets_key_route_window_start_key"
  ON "rate_limit_buckets"("key", "route", "window_start");

-- 5. notifications — in-app notification feed
CREATE TABLE "notifications" (
  "id"             TEXT NOT NULL,
  "wallet_address" TEXT NOT NULL,
  "type"           TEXT NOT NULL,
  "title"          TEXT NOT NULL,
  "message"        TEXT NOT NULL,
  "metadata_json"  JSONB DEFAULT '{}',
  "read_at"        TIMESTAMP(3),
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notifications_wallet_address_read_at_idx"
  ON "notifications"("wallet_address", "read_at");

-- 6. discord_connections — Discord OAuth linking
CREATE TABLE "discord_connections" (
  "id"                 TEXT NOT NULL,
  "wallet_address"     TEXT NOT NULL,
  "discord_id"         TEXT NOT NULL,
  "discord_username"   TEXT NOT NULL,
  "discord_avatar_url" TEXT,
  "connected_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at"         TIMESTAMP(3),
  CONSTRAINT "discord_connections_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "discord_connections_wallet_address_key" ON "discord_connections"("wallet_address");
CREATE UNIQUE INDEX "discord_connections_discord_id_key" ON "discord_connections"("discord_id");

-- 7. quest_templates — admin/sponsor preset starting points
CREATE TABLE "quest_templates" (
  "id"                    TEXT NOT NULL,
  "key"                   TEXT NOT NULL,
  "title"                 TEXT NOT NULL,
  "description"           TEXT NOT NULL,
  "proof_type"            TEXT NOT NULL,
  "requirements_json"     JSONB DEFAULT '{}',
  "scoring_rubric_json"   JSONB DEFAULT '{}',
  "default_min_score"     INTEGER NOT NULL DEFAULT 70,
  "default_badge_id"      INTEGER NOT NULL DEFAULT 1,
  "default_reward_amount" TEXT NOT NULL DEFAULT '10',
  "default_max_claims"    INTEGER NOT NULL DEFAULT 50,
  "default_deadline_days" INTEGER NOT NULL DEFAULT 30,
  "suggested_copy_json"   JSONB DEFAULT '{}',
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quest_templates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "quest_templates_key_key" ON "quest_templates"("key");
