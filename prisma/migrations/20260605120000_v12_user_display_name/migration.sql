-- v1.2 follow-up — optional user display name.
-- Additive only: nullable column, no backfill, no constraint change.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "display_name" TEXT;
