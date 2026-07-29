-- v1.2.1 — tiered sponsor trust. Additive only: defaults so existing rows fit.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sponsor_trust_level"            TEXT     NOT NULL DEFAULT 'new';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "successful_confirmed_approvals" INTEGER  NOT NULL DEFAULT 0;
