import {
  aggregateQuestAnalytics,
  computePoolCoverage,
  potentialOutflowRemaining,
} from "../../lib/analytics";

describe("aggregateQuestAnalytics", () => {
  test("empty input yields zero everything and null rates", () => {
    const a = aggregateQuestAnalytics([]);
    expect(a.total_submissions).toBe(0);
    expect(a.passed).toBe(0);
    expect(a.failed).toBe(0);
    expect(a.approved_onchain).toBe(0);
    expect(a.claimable).toBe(0);
    expect(a.claimed).toBe(0);
    expect(a.average_score).toBeNull();
    expect(a.approval_conversion_rate).toBeNull();
    expect(a.claim_conversion_rate).toBeNull();
    expect(a.top_failure_reasons).toEqual([]);
  });

  test("happy mix: counts statuses, computes both conversion rates", () => {
    const a = aggregateQuestAnalytics([
      { status: "FAILED",           score: 50, failure_reasons_json: ["No README"] },
      { status: "FAILED",           score: 40, failure_reasons_json: ["No README"] },
      { status: "PASSED",           score: 80, failure_reasons_json: [] },
      { status: "APPROVED_ONCHAIN", score: 85, failure_reasons_json: [] },
      { status: "CLAIMED",          score: 95, failure_reasons_json: [] },
    ]);
    expect(a.total_submissions).toBe(5);
    expect(a.failed).toBe(2);
    expect(a.passed).toBe(3); // PASSED + APPROVED_ONCHAIN + CLAIMED
    expect(a.approved_onchain).toBe(2); // APPROVED_ONCHAIN + CLAIMED
    expect(a.claimed).toBe(1);
    expect(a.claimable).toBe(1); // approved - claimed
    expect(a.average_score).toBe(70);
    // approval rate = 2/5 = 0.4; claim rate = 1/2 = 0.5
    expect(a.approval_conversion_rate).toBeCloseTo(0.4, 5);
    expect(a.claim_conversion_rate).toBeCloseTo(0.5, 5);
  });

  test("top failure reasons are sorted and capped at 5", () => {
    const submissions = Array.from({ length: 30 }, (_, i) => {
      const reasons =
        i % 3 === 0
          ? ["No README"]
          : i % 3 === 1
          ? ["No demo URL", "Short README"]
          : ["No frontend files"];
      return {
        status: "FAILED",
        score: 30,
        failure_reasons_json: reasons,
      };
    });
    const a = aggregateQuestAnalytics(submissions);
    expect(a.top_failure_reasons.length).toBeLessThanOrEqual(5);
    expect(a.top_failure_reasons[0].count).toBeGreaterThanOrEqual(
      a.top_failure_reasons[a.top_failure_reasons.length - 1].count
    );
  });

  test("ignores non-array failure_reasons_json safely", () => {
    const a = aggregateQuestAnalytics([
      { status: "FAILED", score: 10, failure_reasons_json: null },
      { status: "FAILED", score: 20, failure_reasons_json: "not an array" },
      { status: "FAILED", score: 30, failure_reasons_json: undefined },
    ]);
    expect(a.failed).toBe(3);
    expect(a.top_failure_reasons).toEqual([]);
  });

  test("in_progress bucket counts pre-PASSED states (e.g. EVALUATING)", () => {
    const a = aggregateQuestAnalytics([
      { status: "SUBMITTED",      score: null, failure_reasons_json: [] },
      { status: "FETCHING_PROOF", score: null, failure_reasons_json: [] },
      { status: "EVALUATING",     score: null, failure_reasons_json: [] },
      // ATTESTING already passed the scoring gate, so it does NOT count as
      // in_progress — it counts as passed.
      { status: "ATTESTING",      score: 80,   failure_reasons_json: [] },
      { status: "PASSED",         score: 80,   failure_reasons_json: [] },
    ]);
    expect(a.in_progress).toBe(3);
    expect(a.passed).toBe(2);
  });
});

describe("potentialOutflowRemaining", () => {
  test("computes remaining slots * reward", () => {
    expect(
      potentialOutflowRemaining({ maxClaims: 100, totalClaims: 10, rewardAmount: "10" })
    ).toBe("900");
  });
  test("zero when maxed out", () => {
    expect(
      potentialOutflowRemaining({ maxClaims: 5, totalClaims: 5, rewardAmount: "10" })
    ).toBe("0");
  });
  test("clamps to zero when overdrawn (defensive)", () => {
    expect(
      potentialOutflowRemaining({ maxClaims: 5, totalClaims: 10, rewardAmount: "10" })
    ).toBe("0");
  });
});

describe("computePoolCoverage", () => {
  test("fully_covered when balance >= total max payout", () => {
    const c = computePoolCoverage({
      poolBalance: "1500",
      perQuestMaxPayouts: ["500", "500"],
    });
    expect(c.coverage_pct).toBe(150);
    expect(c.shortfall).toBe("0");
    expect(c.status).toBe("fully_covered");
  });

  test("underfunded_warning when coverage in [75%, 100%)", () => {
    const c = computePoolCoverage({
      poolBalance: "800",
      perQuestMaxPayouts: ["1000"],
    });
    expect(c.coverage_pct).toBe(80);
    expect(c.shortfall).toBe("200");
    expect(c.status).toBe("underfunded_warning");
  });

  test("needs_topup when coverage < 75%", () => {
    const c = computePoolCoverage({
      poolBalance: "500",
      perQuestMaxPayouts: ["1000"],
    });
    expect(c.coverage_pct).toBe(50);
    expect(c.shortfall).toBe("500");
    expect(c.status).toBe("needs_topup");
  });

  test("example from spec: 990 / 1240 → 79.8% underfunded", () => {
    const c = computePoolCoverage({
      poolBalance: "990",
      perQuestMaxPayouts: ["250", "990"],
    });
    expect(c.coverage_pct).toBe(79.8);
    expect(c.shortfall).toBe("250");
    expect(c.status).toBe("underfunded_warning");
  });

  test("boundary: exactly 100% is fully_covered", () => {
    const c = computePoolCoverage({
      poolBalance: "1000",
      perQuestMaxPayouts: ["1000"],
    });
    expect(c.status).toBe("fully_covered");
    expect(c.shortfall).toBe("0");
  });

  test("boundary: exactly 75% is underfunded_warning, just below is needs_topup", () => {
    expect(
      computePoolCoverage({ poolBalance: "750", perQuestMaxPayouts: ["1000"] }).status
    ).toBe("underfunded_warning");
    expect(
      computePoolCoverage({ poolBalance: "749", perQuestMaxPayouts: ["1000"] }).status
    ).toBe("needs_topup");
  });

  test("no active obligations → fully_covered with null ratio", () => {
    const c = computePoolCoverage({
      poolBalance: "1000",
      perQuestMaxPayouts: [],
    });
    expect(c.status).toBe("fully_covered");
    expect(c.coverage_ratio).toBeNull();
    expect(c.coverage_pct).toBeNull();
    expect(c.shortfall).toBe("0");
  });

  test("null poolBalance (e.g. RPC unreachable) → null status, no throw", () => {
    const c = computePoolCoverage({
      poolBalance: null,
      perQuestMaxPayouts: ["1000"],
    });
    expect(c.status).toBeNull();
    expect(c.coverage_ratio).toBeNull();
    expect(c.coverage_pct).toBeNull();
  });

  test("ignores non-numeric per-quest values defensively", () => {
    const c = computePoolCoverage({
      poolBalance: "1000",
      perQuestMaxPayouts: ["500", "garbage", "500"],
    });
    expect(c.coverage_pct).toBe(100);
    expect(c.status).toBe("fully_covered");
  });
});
