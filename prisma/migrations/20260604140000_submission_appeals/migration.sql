-- v1.1: manual review / appeal queue
CREATE TABLE "submission_appeals" (
  "id"               TEXT NOT NULL,
  "submission_id"    TEXT NOT NULL,
  "wallet_address"   TEXT NOT NULL,
  "reason"           TEXT NOT NULL,
  "status"           TEXT NOT NULL DEFAULT 'PENDING',
  "admin_notes"      TEXT,
  "reviewed_by"      TEXT,
  "reviewed_at"      TIMESTAMP(3),
  "attestation_uid"  TEXT,
  "tx_hash_approval" TEXT,
  "approve_error"    TEXT,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "submission_appeals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "submission_appeals_submission_id_key" ON "submission_appeals"("submission_id");
CREATE INDEX "submission_appeals_status_idx" ON "submission_appeals"("status");
CREATE INDEX "submission_appeals_wallet_address_idx" ON "submission_appeals"("wallet_address");

ALTER TABLE "submission_appeals"
  ADD CONSTRAINT "submission_appeals_submission_id_fkey"
  FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
