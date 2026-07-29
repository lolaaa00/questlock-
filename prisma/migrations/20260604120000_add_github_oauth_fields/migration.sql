-- v1.1: GitHub OAuth linking columns on users
ALTER TABLE "users"
  ADD COLUMN "github_id" TEXT,
  ADD COLUMN "github_login" TEXT,
  ADD COLUMN "github_avatar_url" TEXT,
  ADD COLUMN "github_profile_url" TEXT,
  ADD COLUMN "github_connected_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "users_github_id_key" ON "users"("github_id");
CREATE UNIQUE INDEX "users_github_login_key" ON "users"("github_login");
