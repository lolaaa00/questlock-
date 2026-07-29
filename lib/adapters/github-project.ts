// GitHub adapter — wraps the existing v1.1 hardened GitHub flow without
// behaviour change. Score/anti-farm/EAS/onchain calls stay in /api/proof/submit
// for now; this adapter exposes the standard ProofAdapter interface so future
// callers can route uniformly.

import type {
  ProofAdapter, AdapterContext, ValidationResult,
  AdapterScoringResult, PublicProofPayload,
} from "./types";
import { parseGitHubUrl, normaliseGitHubUrl, fetchRepoData, type GitHubRepoData } from "../github";
import { checkDemoUrl, type DemoUrlResult } from "../demo-url";
import { scoreProof, type ScoringResult } from "../scoring";

export interface GhInput {
  githubUsername: string;
  repoUrl: string;
  demoUrl?: string;
  explanation?: string;
}

export interface GhEvidence {
  repo: GitHubRepoData;
  demo: DemoUrlResult;
  repoUrlNormalised: string;
  isDuplicate: boolean;
}

export const githubProjectAdapter: ProofAdapter<GhInput, GhEvidence> = {
  proofType: "github_project",
  displayName: "GitHub Project",

  validateInput(input: GhInput): ValidationResult {
    const errors: string[] = [];
    if (!input.githubUsername?.trim()) errors.push("GitHub username required.");
    if (!input.repoUrl?.trim()) errors.push("Repository URL required.");
    else if (!parseGitHubUrl(input.repoUrl)) errors.push("Invalid GitHub URL.");
    if (input.demoUrl && !input.demoUrl.startsWith("http")) errors.push("Demo URL must start with http(s).");
    return { ok: errors.length === 0, errors };
  },

  async fetchEvidence(input: GhInput, ctx: AdapterContext): Promise<GhEvidence> {
    const parsed = parseGitHubUrl(input.repoUrl)!;
    const repoUrlNormalised = normaliseGitHubUrl(input.repoUrl)!;
    const repo = await fetchRepoData(parsed.owner, parsed.repo, ctx.quest.start_time, input.githubUsername);
    const demo = input.demoUrl
      ? await checkDemoUrl(input.demoUrl)
      : { passed: false, reason: "No demo URL provided." } as DemoUrlResult;
    return { repo, demo, repoUrlNormalised, isDuplicate: false };
  },

  async scoreEvidence(evidence: GhEvidence, ctx: AdapterContext): Promise<AdapterScoringResult> {
    const rubric = (ctx.quest.scoring_rubric_json as Record<string, number>) || {};
    const res: ScoringResult = scoreProof(
      evidence.repo, evidence.demo, evidence.isDuplicate,
      ctx.quest.start_time, rubric, ctx.quest.min_score
    );
    return {
      score: res.score,
      passed: res.passed,
      failureReasons: res.failureReasons,
      warnings: res.warnings,
      checks: res.checks,
      requiresManualReview: false,
    };
  },

  buildPublicProofPayload(evidence, result): PublicProofPayload {
    return {
      proof_type: "github_project",
      summary: `Verified GitHub project · score ${result.score}/100`,
      fields: {
        repo_url: evidence.repoUrlNormalised,
        demo_url: evidence.repo.exists ? (evidence.demo.passed ? "loaded" : "not loaded") : "n/a",
        default_branch: evidence.repo.defaultBranch,
        language: evidence.repo.language,
        readme_chars: evidence.repo.readmeCharCount,
        commits_after_start: evidence.repo.commitCountAfterStart,
      },
    };
  },

  buildPrivateEvidence(evidence, result) {
    // Compact private evidence — not exposed publicly.
    return {
      repo: {
        owner: evidence.repo.owner, repo: evidence.repo.repo, isForked: evidence.repo.isForked,
        commitCountAfterStart: evidence.repo.commitCountAfterStart,
        commitsByOwnerCount: evidence.repo.commitsByOwnerCount,
      },
      demo: { passed: evidence.demo.passed, status: evidence.demo.status ?? null, attempts: evidence.demo.attempts ?? null },
      score: result.score,
    };
  },

  requiresManualReview() { return false; },
  supportsAutoApproval() { return true; },
};
