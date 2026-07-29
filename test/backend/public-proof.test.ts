import { isPubliclyVisible, toPublicProof } from "../../lib/public-proof";

const baseSubmission = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "sub-1",
  status: "CLAIMED",
  score: 90,
  risk_band: "MEDIUM_RISK",
  wallet_address: "0xabc",
  repo_url: "https://github.com/u/r",
  demo_url: "https://demo",
  proof_hash: "0xdead",
  eas_attestation_uid: "0xbeef",
  tx_hash_approval: "0xa1",
  tx_hash_claim: "0xc1",
  created_at: new Date("2026-06-04T00:00:00Z"),
  updated_at: new Date("2026-06-04T01:00:00Z"),
  proof_checks: [
    { check_name: "repo_exists", passed: true, points_awarded: 10, max_points: 10 },
  ],
  quest: {
    id: "q-1",
    title: "Build a Guestbook",
    description: "desc",
    reward_amount: "10",
    badge_id: 1n,
    min_score: 70,
  },
  user: {
    github_login: "alice",
    github_avatar_url: "https://avatars/alice.png",
    github_profile_url: "https://github.com/alice",
  },
  // Fields that MUST NOT leak into the public payload:
  explanation: "secret notes about implementation",
  failure_reasons_json: ["private failure reason"],
  github_username: "alice",
  ...overrides,
});

describe("public-proof", () => {
  test("isPubliclyVisible allows attested/approved/claimed statuses", () => {
    expect(isPubliclyVisible("CLAIMED")).toBe(true);
    expect(isPubliclyVisible("APPROVED_ONCHAIN")).toBe(true);
    expect(isPubliclyVisible("CLAIMING")).toBe(true);
    expect(isPubliclyVisible("ATTESTED")).toBe(true);
  });

  test("isPubliclyVisible blocks failed/evaluating statuses", () => {
    expect(isPubliclyVisible("FAILED")).toBe(false);
    expect(isPubliclyVisible("REJECTED")).toBe(false);
    expect(isPubliclyVisible("EVALUATING")).toBe(false);
    expect(isPubliclyVisible("SUBMITTED")).toBe(false);
    expect(isPubliclyVisible("ATTESTING")).toBe(false);
  });

  test("toPublicProof exposes whitelisted fields only", () => {
    const out = toPublicProof(baseSubmission() as never);
    const keys = Object.keys(out);
    expect(keys).toContain("score");
    expect(keys).toContain("eas_attestation_uid");
    expect(keys).toContain("tx_hash_claim");

    // The private fields must not appear at the top level.
    expect(keys).not.toContain("explanation");
    expect(keys).not.toContain("failure_reasons_json");
    expect(keys).not.toContain("github_username");
  });

  test("toPublicProof preserves linked GitHub identity when available", () => {
    const out = toPublicProof(baseSubmission() as never);
    expect(out.github_login).toBe("alice");
    expect(out.github_avatar_url).toContain("alice");
  });

  test("toPublicProof tolerates missing GitHub identity", () => {
    const out = toPublicProof(baseSubmission({ user: null }) as never);
    expect(out.github_login).toBeNull();
    expect(out.github_avatar_url).toBeNull();
  });

  test("badge_id is serialised as string", () => {
    const out = toPublicProof(baseSubmission() as never);
    expect(out.quest.badge_id).toBe("1");
  });
});
