// Centralised env validation. Import getEnv() / requireEnv() instead of reading
// process.env directly in business logic. Missing required vars throw with a
// clear message at first use; optional vars return undefined.

type EnvKey =
  // Public (browser-visible)
  | "NEXT_PUBLIC_APP_URL"
  | "NEXT_PUBLIC_CHAIN_ID"
  | "NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL"
  | "NEXT_PUBLIC_PRIVY_APP_ID"
  | "NEXT_PUBLIC_QUESTLOCK_CORE_ADDRESS"
  | "NEXT_PUBLIC_QUEST_REWARD_TOKEN_ADDRESS"
  | "NEXT_PUBLIC_QUEST_BADGE_ADDRESS"
  | "NEXT_PUBLIC_EAS_CONTRACT_ADDRESS"
  | "NEXT_PUBLIC_EAS_SCHEMA_UID"
  // Server-only
  | "DATABASE_URL"
  | "DIRECT_URL"
  | "BASE_SEPOLIA_RPC_URL"
  | "VERIFIER_PRIVATE_KEY"
  | "DEPLOYER_PRIVATE_KEY"
  | "GITHUB_TOKEN"
  | "ADMIN_WALLET_ADDRESS"
  | "INDEXER_SECRET"
  // Optional (added by later features)
  | "GITHUB_OAUTH_CLIENT_ID"
  | "GITHUB_OAUTH_CLIENT_SECRET"
  | "GITHUB_OAUTH_REDIRECT_URI"
  // v1.2
  | "NEXT_PUBLIC_QUESTLOCK_CORE_V2_ADDRESS"
  | "DISCORD_OAUTH_CLIENT_ID"
  | "DISCORD_OAUTH_CLIENT_SECRET"
  | "DISCORD_OAUTH_REDIRECT_URI"
  | "DISCORD_BOT_TOKEN";

const REQUIRED_RUNTIME: EnvKey[] = [
  "DATABASE_URL",
  "BASE_SEPOLIA_RPC_URL",
  "VERIFIER_PRIVATE_KEY",
  "ADMIN_WALLET_ADDRESS",
  "NEXT_PUBLIC_QUESTLOCK_CORE_ADDRESS",
  "NEXT_PUBLIC_QUEST_REWARD_TOKEN_ADDRESS",
  "NEXT_PUBLIC_QUEST_BADGE_ADDRESS",
  "NEXT_PUBLIC_EAS_SCHEMA_UID",
];

const OPTIONAL: EnvKey[] = [
  "DIRECT_URL",
  "GITHUB_TOKEN",
  "INDEXER_SECRET",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_CHAIN_ID",
  "NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL",
  "NEXT_PUBLIC_PRIVY_APP_ID",
  "NEXT_PUBLIC_EAS_CONTRACT_ADDRESS",
  "DEPLOYER_PRIVATE_KEY",
  "GITHUB_OAUTH_CLIENT_ID",
  "GITHUB_OAUTH_CLIENT_SECRET",
  "GITHUB_OAUTH_REDIRECT_URI",
  "NEXT_PUBLIC_QUESTLOCK_CORE_V2_ADDRESS",
  "DISCORD_OAUTH_CLIENT_ID",
  "DISCORD_OAUTH_CLIENT_SECRET",
  "DISCORD_OAUTH_REDIRECT_URI",
  "DISCORD_BOT_TOKEN",
];

export function getEnv(key: EnvKey): string | undefined {
  const v = process.env[key];
  return v && v.length > 0 ? v : undefined;
}

export function requireEnv(key: EnvKey): string {
  const v = getEnv(key);
  if (!v) {
    throw new Error(
      `Missing required environment variable: ${key}. ` +
        `Set it in .env (see .env.example).`
    );
  }
  return v;
}

export interface EnvAudit {
  ok: boolean;
  required_present: EnvKey[];
  required_missing: EnvKey[];
  optional_present: EnvKey[];
  optional_missing: EnvKey[];
}

export function auditEnv(): EnvAudit {
  const required_present: EnvKey[] = [];
  const required_missing: EnvKey[] = [];
  const optional_present: EnvKey[] = [];
  const optional_missing: EnvKey[] = [];

  for (const k of REQUIRED_RUNTIME) {
    (getEnv(k) ? required_present : required_missing).push(k);
  }
  for (const k of OPTIONAL) {
    (getEnv(k) ? optional_present : optional_missing).push(k);
  }

  return {
    ok: required_missing.length === 0,
    required_present,
    required_missing,
    optional_present,
    optional_missing,
  };
}
