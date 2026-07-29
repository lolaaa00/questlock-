-- v1.1: sponsor / creator quest request queue
CREATE TABLE "quest_requests" (
  "id"                   TEXT NOT NULL,
  "title"                TEXT NOT NULL,
  "description"          TEXT NOT NULL,
  "requirements"         TEXT,
  "reward_amount"        TEXT NOT NULL,
  "reward_token_address" TEXT,
  "badge_id"             INTEGER NOT NULL DEFAULT 1,
  "min_score"            INTEGER NOT NULL DEFAULT 70,
  "max_claims"           INTEGER NOT NULL DEFAULT 100,
  "deadline_days"        INTEGER NOT NULL DEFAULT 30,
  "sponsor_name"         TEXT,
  "sponsor_email"        TEXT,
  "sponsor_wallet"       TEXT NOT NULL,
  "status"               TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  "admin_notes"          TEXT,
  "rejection_reason"     TEXT,
  "onchain_quest_id"     BIGINT,
  "published_quest_id"   TEXT,
  "publish_tx_hash"      TEXT,
  "publish_error"        TEXT,
  "published_at"         TIMESTAMP(3),
  "reviewed_by"          TEXT,
  "reviewed_at"          TIMESTAMP(3),
  "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "quest_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "quest_requests_status_idx" ON "quest_requests"("status");
CREATE INDEX "quest_requests_sponsor_wallet_idx" ON "quest_requests"("sponsor_wallet");
