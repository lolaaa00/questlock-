// Appeal lifecycle state machine + onchain-score lift-to-minimum logic.

type AppealStatus = "PENDING" | "PROCESSING" | "APPROVED" | "REJECTED" | "APPROVE_FAILED";

interface Appeal { status: AppealStatus; }

function canApprove(a: Appeal): boolean {
  return a.status === "PENDING" || a.status === "APPROVE_FAILED";
}
function canReject(a: Appeal): boolean {
  return a.status !== "APPROVED" && a.status !== "REJECTED";
}

// The contract enforces score >= quest.minScore. The appeal path bumps
// the onchain score to clear that bar without overwriting the real score
// recorded in the EAS attestation.
function liftScoreForOnchain(score: number, minScore: number): number {
  return Math.max(score, minScore);
}

describe("appeal lifecycle", () => {
  test("approval allowed from PENDING and APPROVE_FAILED (retry)", () => {
    expect(canApprove({ status: "PENDING" })).toBe(true);
    expect(canApprove({ status: "APPROVE_FAILED" })).toBe(true);
    expect(canApprove({ status: "PROCESSING" })).toBe(false);
    expect(canApprove({ status: "APPROVED" })).toBe(false);
    expect(canApprove({ status: "REJECTED" })).toBe(false);
  });

  test("rejection allowed unless already terminal", () => {
    expect(canReject({ status: "PENDING" })).toBe(true);
    expect(canReject({ status: "PROCESSING" })).toBe(true);
    expect(canReject({ status: "APPROVE_FAILED" })).toBe(true);
    expect(canReject({ status: "APPROVED" })).toBe(false);
    expect(canReject({ status: "REJECTED" })).toBe(false);
  });
});

describe("appeal score lift", () => {
  test("lifts a below-minimum score to the quest minimum", () => {
    expect(liftScoreForOnchain(45, 70)).toBe(70);
  });
  test("does not lift when score already meets the minimum", () => {
    expect(liftScoreForOnchain(85, 70)).toBe(85);
  });
  test("exact-min score is unchanged", () => {
    expect(liftScoreForOnchain(60, 60)).toBe(60);
  });
});
