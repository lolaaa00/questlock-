-- v1.1: track original sponsor wallet on sponsor-published quests so the
-- creator-guard can block both the publishing admin and the sponsor from
-- submitting proof for their own quest. Nullable so v1 sample quests and
-- direct-API created quests stay valid without backfill.
ALTER TABLE "quests" ADD COLUMN "sponsor_wallet" TEXT;
CREATE INDEX "quests_sponsor_wallet_idx" ON "quests"("sponsor_wallet");
