import { auditEnv, getEnv, requireEnv } from "../../lib/env";

describe("env validation", () => {
  const ORIGINAL = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  test("getEnv returns undefined for missing", () => {
    delete process.env.GITHUB_OAUTH_CLIENT_ID;
    expect(getEnv("GITHUB_OAUTH_CLIENT_ID")).toBeUndefined();
  });

  test("getEnv returns value when set", () => {
    process.env.GITHUB_OAUTH_CLIENT_ID = "abc123";
    expect(getEnv("GITHUB_OAUTH_CLIENT_ID")).toBe("abc123");
  });

  test("requireEnv throws when missing", () => {
    delete process.env.DATABASE_URL;
    expect(() => requireEnv("DATABASE_URL")).toThrow(/DATABASE_URL/);
  });

  test("auditEnv reports missing required vars", () => {
    delete process.env.DATABASE_URL;
    const a = auditEnv();
    expect(a.ok).toBe(false);
    expect(a.required_missing).toContain("DATABASE_URL");
  });

  test("auditEnv is ok when all required set", () => {
    process.env.DATABASE_URL = "x";
    process.env.BASE_SEPOLIA_RPC_URL = "x";
    process.env.VERIFIER_PRIVATE_KEY = "x";
    process.env.ADMIN_WALLET_ADDRESS = "x";
    process.env.NEXT_PUBLIC_QUESTLOCK_CORE_ADDRESS = "x";
    process.env.NEXT_PUBLIC_QUEST_REWARD_TOKEN_ADDRESS = "x";
    process.env.NEXT_PUBLIC_QUEST_BADGE_ADDRESS = "x";
    process.env.NEXT_PUBLIC_EAS_SCHEMA_UID = "x";
    const a = auditEnv();
    expect(a.required_missing).toEqual([]);
    expect(a.ok).toBe(true);
  });
});
