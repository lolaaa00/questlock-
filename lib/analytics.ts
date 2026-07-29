// Quest analytics derivation. We keep the math here in a pure function so
// the API route stays thin and the logic is unit-testable without spinning
// up Prisma or the chain.

// Statuses considered "passed proof checks". Anything from PASSED onwards in
// the lifecycle counts — once the engine said yes we count it, regardless of
// whether the user has claimed yet.
const PASSED_STATUSES = new Set([
  "PASSED",
  "ATTESTING",
  "ATTESTED",
  "APPROVING_ONCHAIN",
  "APPROVED_ONCHAIN",
  "CLAIMING",
  "CLAIMED",
]);

const APPROVED_ONCHAIN_STATUSES = new Set([
  "APPROVED_ONCHAIN",
  "CLAIMING",
  "CLAIMED",
]);

const CLAIMED_STATUSES = new Set(["CLAIMED"]);
const FAILED_STATUSES = new Set(["FAILED", "REJECTED"]);

export interface SubmissionLite {
  status: string;
  score: number | null;
  failure_reasons_json: unknown;
}

export interface QuestAnalytics {
  total_submissions: number;
  passed: number;
  failed: number;
  approved_onchain: number;
  claimable: number; // approved but not yet claimed
  claimed: number;
  in_progress: number; // anything still being evaluated
  average_score: number | null;
  top_failure_reasons: Array<{ reason: string; count: number }>;
  // 0–1 floats, null when denominator is 0
  approval_conversion_rate: number | null; // approved_onchain / total
  claim_conversion_rate: number | null;    // claimed / approved_onchain
}

export function aggregateQuestAnalytics(
  submissions: SubmissionLite[]
): QuestAnalytics {
  const total = submissions.length;
  let passed = 0;
  let failed = 0;
  let approvedOnchain = 0;
  let claimed = 0;
  let inProgress = 0;
  const scoreValues: number[] = [];
  const reasonCounts = new Map<string, number>();

  for (const s of submissions) {
    if (PASSED_STATUSES.has(s.status)) passed++;
    if (FAILED_STATUSES.has(s.status)) failed++;
    if (APPROVED_ONCHAIN_STATUSES.has(s.status)) approvedOnchain++;
    if (CLAIMED_STATUSES.has(s.status)) claimed++;
    if (
      !PASSED_STATUSES.has(s.status) &&
      !FAILED_STATUSES.has(s.status)
    ) {
      inProgress++;
    }

    if (typeof s.score === "number") scoreValues.push(s.score);

    if (Array.isArray(s.failure_reasons_json)) {
      for (const r of s.failure_reasons_json as unknown[]) {
        if (typeof r === "string" && r.trim().length > 0) {
          reasonCounts.set(r, (reasonCounts.get(r) ?? 0) + 1);
        }
      }
    }
  }

  const claimable = approvedOnchain - claimed;
  const averageScore =
    scoreValues.length === 0
      ? null
      : Math.round(
          (scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length) * 10
        ) / 10;

  const topFailureReasons = Array.from(reasonCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, count]) => ({ reason, count }));

  return {
    total_submissions: total,
    passed,
    failed,
    approved_onchain: approvedOnchain,
    claimable,
    claimed,
    in_progress: inProgress,
    average_score: averageScore,
    top_failure_reasons: topFailureReasons,
    approval_conversion_rate:
      total === 0 ? null : approvedOnchain / total,
    claim_conversion_rate:
      approvedOnchain === 0 ? null : claimed / approvedOnchain,
  };
}

// Onchain reward pool deductions are uniform per claim, so per-quest "potential
// outflow remaining" = remaining slots * reward. Useful for spotting quests
// that will drain the contract.
export function potentialOutflowRemaining(args: {
  maxClaims: number;
  totalClaims: number;
  rewardAmount: string;
}): string {
  const slotsLeft = Math.max(0, args.maxClaims - args.totalClaims);
  // String arithmetic keeps us safe if rewardAmount has more decimals than
  // JS Number can hold. We do the multiplication as bigint via parseFloat
  // for the simple case (no decimal beyond what fits in Number).
  // Reward amounts in v1 are integer QUEST values, so Number is fine.
  const reward = Number(args.rewardAmount);
  if (!Number.isFinite(reward)) return "0";
  return String(slotsLeft * reward);
}

export type PoolCoverageStatus = "fully_covered" | "underfunded_warning" | "needs_topup";

export interface PoolCoverage {
  pool_balance: string;          // current QuestLockCore QUEST balance (string for precision)
  total_max_payout: string;      // sum of per-quest max payouts if every remaining slot fills
  coverage_ratio: number | null; // pool_balance / total_max_payout, null when total_max_payout = 0
  coverage_pct: number | null;   // coverage_ratio * 100, rounded to 1 dp
  shortfall: string;             // max(0, total_max_payout - pool_balance)
  status: PoolCoverageStatus | null;
}

// QuestLockCore uses a single shared QUEST pool. This helper rolls up every
// per-quest "max payout if fully claimed" and compares it against the live
// pool balance so the admin can spot when the contract needs a top-up.
//
// Status thresholds (per spec):
//   >= 100%  fully_covered
//   75–99%   underfunded_warning
//   < 75%    needs_topup
//
// null pool_balance (e.g. RPC unreachable) returns null status without throwing.
export function computePoolCoverage(args: {
  poolBalance: string | null;
  perQuestMaxPayouts: string[];
}): PoolCoverage {
  const totalMax = args.perQuestMaxPayouts.reduce((sum, v) => {
    const n = Number(v);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);

  const balance = args.poolBalance !== null ? Number(args.poolBalance) : NaN;
  const balanceValid = Number.isFinite(balance);

  let coverage_ratio: number | null = null;
  let coverage_pct: number | null = null;
  let shortfall = 0;
  let status: PoolCoverageStatus | null = null;

  if (balanceValid && totalMax > 0) {
    coverage_ratio = balance / totalMax;
    coverage_pct = Math.round(coverage_ratio * 1000) / 10;
    shortfall = Math.max(0, totalMax - balance);
    status =
      coverage_ratio >= 1
        ? "fully_covered"
        : coverage_ratio >= 0.75
        ? "underfunded_warning"
        : "needs_topup";
  } else if (balanceValid && totalMax === 0) {
    // No active obligations — coverage is undefined but the pool is fine.
    coverage_ratio = null;
    coverage_pct = null;
    shortfall = 0;
    status = "fully_covered";
  }

  return {
    pool_balance: args.poolBalance ?? "0",
    total_max_payout: String(totalMax),
    coverage_ratio,
    coverage_pct,
    shortfall: String(shortfall),
    status,
  };
}
