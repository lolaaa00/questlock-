import type { GitHubRepoData } from "./github";
import type { DemoUrlResult } from "./demo-url";

export interface ScoringRubric {
  repo_exists: number;
  owner_matches: number;
  repo_updated_after_start: number;
  commits_after_start: number;
  readme_exists: number;
  readme_length: number;
  frontend_files: number;
  contract_files: number;
  demo_url_loads: number;
  not_previously_submitted: number;
}

// Same defaults as v1 — keep the 100-point ceiling stable so existing data
// remains comparable.
export const DEFAULT_RUBRIC: ScoringRubric = {
  repo_exists: 10,
  owner_matches: 10,
  repo_updated_after_start: 10,
  commits_after_start: 15,
  readme_exists: 10,
  readme_length: 10,
  frontend_files: 10,
  contract_files: 10,
  demo_url_loads: 10,
  not_previously_submitted: 5,
};

export interface ProofCheckResult {
  check_name: string;
  passed: boolean;
  points_awarded: number;
  max_points: number;
  details: string;
}

export interface ScoringResult {
  score: number;
  checks: ProofCheckResult[];
  failureReasons: string[];
  warnings: string[];
  passed: boolean;
}

export function scoreProof(
  repoData: GitHubRepoData,
  demoResult: DemoUrlResult,
  isDuplicate: boolean,
  questStartTime: Date,
  rubric: Partial<ScoringRubric> = {},
  minScore = 70
): ScoringResult {
  const r = { ...DEFAULT_RUBRIC, ...rubric };
  const checks: ProofCheckResult[] = [];
  const failureReasons: string[] = [];

  function check(
    name: string,
    passed: boolean,
    maxPts: number,
    passDetail: string,
    failDetail: string
  ) {
    const pts = passed ? maxPts : 0;
    checks.push({
      check_name: name,
      passed,
      points_awarded: pts,
      max_points: maxPts,
      details: passed ? passDetail : failDetail,
    });
    if (!passed && maxPts > 0) failureReasons.push(failDetail);
  }

  // 1. Repo exists
  check(
    "repo_exists",
    repoData.exists,
    r.repo_exists,
    "Repository found on GitHub.",
    repoData.error || "Repository not found or is private."
  );

  // 2. Owner matches submitted username
  const ownerMatches =
    repoData.exists &&
    repoData.ownerLogin.toLowerCase() === repoData.owner.toLowerCase();
  check(
    "owner_matches",
    ownerMatches,
    r.owner_matches,
    "Repository owner matches submitted GitHub username.",
    `Repository owner (${repoData.ownerLogin || "?"}) does not match submitted username (${repoData.owner}).`
  );

  // 3. Updated after start
  const repoUpdated =
    repoData.exists &&
    repoData.pushedAt != null &&
    new Date(repoData.pushedAt) > questStartTime;
  check(
    "repo_updated_after_start",
    repoUpdated,
    r.repo_updated_after_start,
    "Repository was updated after quest started.",
    "Repository has not been pushed since the quest started."
  );

  // 4. At least 3 commits after start — AND if there are commits, at least one
  //    must be attributable to the submitting GitHub user. A pile of merge
  //    commits from someone else (typical fork pattern) should not pass.
  let commitsPass = repoData.exists && repoData.commitCountAfterStart >= 3;
  let commitsDetail: string;
  if (!repoData.exists) {
    commitsDetail = "Repository not reachable; cannot count commits.";
  } else if (repoData.commitCountAfterStart < 3) {
    commitsDetail = `Only ${repoData.commitCountAfterStart} commits found after quest start (need at least 3).`;
  } else if (repoData.commitsByOwnerCount === 0) {
    commitsPass = false;
    commitsDetail = `${repoData.commitCountAfterStart} commits found, but none are attributed to @${repoData.owner}.`;
  } else {
    commitsDetail = `${repoData.commitCountAfterStart} commits found after quest start (${repoData.commitsByOwnerCount} by @${repoData.owner}).`;
  }
  check(
    "commits_after_start",
    commitsPass,
    r.commits_after_start,
    commitsDetail,
    commitsDetail
  );

  // 5. README exists
  check(
    "readme_exists",
    repoData.hasReadme,
    r.readme_exists,
    "README file found.",
    "No README file found in repository."
  );

  // 6. README length
  const readmeLong = repoData.hasReadme && repoData.readmeCharCount >= 500;
  const readmeDetail = readmeLong
    ? `README has ${repoData.readmeCharCount} characters and ${repoData.readmeSectionCount} section heading(s).`
    : `README too short: ${repoData.readmeCharCount} characters (need at least 500).`;
  check(
    "readme_length",
    readmeLong,
    r.readme_length,
    readmeDetail,
    readmeDetail
  );

  // 7. Frontend files
  const frontendDetail = repoData.hasFrontendFiles
    ? `Frontend files detected${repoData.packageManager !== "unknown" ? ` (package manager: ${repoData.packageManager})` : ""}.`
    : "No frontend files detected (package.json, src/, pages/, components/, *.tsx, etc.).";
  check(
    "frontend_files",
    repoData.hasFrontendFiles,
    r.frontend_files,
    frontendDetail,
    frontendDetail
  );

  // 8. Contract/backend files
  const contractDetail = repoData.hasContractFiles
    ? "Contract or backend files detected."
    : "No contract or backend files detected (contracts/, *.sol, hardhat.config, server/, backend/, api/, etc.).";
  check(
    "contract_files",
    repoData.hasContractFiles,
    r.contract_files,
    contractDetail,
    contractDetail
  );

  // 9. Demo URL
  const demoDetail = demoResult.passed
    ? `Demo URL loaded successfully${demoResult.attempts && demoResult.attempts > 1 ? ` after ${demoResult.attempts} attempts` : ""}.`
    : demoResult.reason || "Demo URL did not load.";
  check(
    "demo_url_loads",
    demoResult.passed,
    r.demo_url_loads,
    demoDetail,
    demoDetail
  );

  // 10. Not previously submitted
  check(
    "not_previously_submitted",
    !isDuplicate,
    r.not_previously_submitted,
    "Repository not previously submitted for this quest.",
    "Repository has already been submitted for this quest by another wallet."
  );

  const score = checks.reduce((sum, c) => sum + c.points_awarded, 0);
  const passed = score >= minScore && !isDuplicate && repoData.exists;

  return {
    score,
    checks,
    failureReasons,
    warnings: repoData.warnings || [],
    passed,
  };
}
