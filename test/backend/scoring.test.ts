import { scoreProof } from "../../lib/scoring";
import type { GitHubRepoData } from "../../lib/github";
import type { DemoUrlResult } from "../../lib/demo-url";

const QUEST_START = new Date("2026-01-01T00:00:00Z");

function baseRepo(overrides: Partial<GitHubRepoData> = {}): GitHubRepoData {
  return {
    owner: "alice",
    repo: "proj",
    exists: true,
    ownerLogin: "alice",
    isForked: false,
    isEmpty: false,
    pushedAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
    defaultBranch: "main",
    language: "TypeScript",
    commitCountAfterStart: 5,
    commitsByOwnerCount: 5,
    hasReadme: true,
    readmeCharCount: 800,
    readmeSectionCount: 4,
    hasFrontendFiles: true,
    hasContractFiles: true,
    packageManager: "npm",
    fileCount: 50,
    directoryDepth: 3,
    warnings: [],
    ...overrides,
  };
}

const goodDemo: DemoUrlResult = { passed: true, status: 200, attempts: 1 };
const badDemo: DemoUrlResult = { passed: false, reason: "timeout", attempts: 3 };

describe("scoring", () => {
  test("happy path scores 100/100 and passes at min 70", () => {
    const result = scoreProof(baseRepo(), goodDemo, false, QUEST_START, {}, 70);
    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
    expect(result.failureReasons).toEqual([]);
  });

  test("missing README + short README zero out 20 pts", () => {
    const result = scoreProof(
      baseRepo({ hasReadme: false, readmeCharCount: 0 }),
      goodDemo,
      false,
      QUEST_START,
      {},
      70
    );
    expect(result.score).toBe(80);
    expect(result.passed).toBe(true); // still above 70
  });

  test("commits exist but none by the owner → commits check fails", () => {
    const result = scoreProof(
      baseRepo({ commitCountAfterStart: 10, commitsByOwnerCount: 0 }),
      goodDemo,
      false,
      QUEST_START,
      {},
      70
    );
    const commitCheck = result.checks.find((c) => c.check_name === "commits_after_start")!;
    expect(commitCheck.passed).toBe(false);
    expect(commitCheck.details).toContain("none are attributed");
  });

  test("fork warning surfaces but does not zero a check", () => {
    const repo = baseRepo({
      isForked: true,
      warnings: ["Repository is a fork. Make sure the meaningful work is in commits authored by you after the quest start."],
    });
    const result = scoreProof(repo, goodDemo, false, QUEST_START, {}, 70);
    expect(result.passed).toBe(true);
    expect(result.warnings.some((w) => w.toLowerCase().includes("fork"))).toBe(true);
  });

  test("duplicate repo always fails the gate even with a perfect score", () => {
    const result = scoreProof(baseRepo(), goodDemo, true, QUEST_START, {}, 70);
    expect(result.score).toBe(95); // duplicate check is worth 5 pts
    expect(result.passed).toBe(false);
  });

  test("demo URL failure surfaces the actual reason", () => {
    const result = scoreProof(baseRepo(), badDemo, false, QUEST_START, {}, 70);
    const demoCheck = result.checks.find((c) => c.check_name === "demo_url_loads")!;
    expect(demoCheck.passed).toBe(false);
    expect(demoCheck.details).toContain("timeout");
  });

  test("missing repo → all subsequent checks fail cleanly", () => {
    const result = scoreProof(
      baseRepo({ exists: false, error: "Repository not found or is private." }),
      goodDemo,
      false,
      QUEST_START,
      {},
      70
    );
    const repoCheck = result.checks.find((c) => c.check_name === "repo_exists")!;
    expect(repoCheck.passed).toBe(false);
    expect(result.passed).toBe(false);
  });
});
