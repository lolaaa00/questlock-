// v1.2 Proof Adapter contract. Each proof type implements this interface;
// /api/proof/submit dispatches by quest.proof_type. Existing GitHub flow is
// re-exposed via the github_project adapter with zero behaviour change.

export type ProofType = "github_project" | "manual_project" | "discord_role" | "x_post" | "lms_course";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export interface AdapterScoringResult {
  score: number;
  passed: boolean;
  failureReasons: string[];
  warnings: string[];
  // Per-check breakdown (for github we keep the existing 10 checks; other
  // adapters may emit fewer or a single boolean check).
  checks: Array<{
    check_name: string;
    passed: boolean;
    points_awarded: number;
    max_points: number;
    details: string;
  }>;
  // Whether the adapter wants to defer the final decision to admin review
  // instead of auto-attesting. Manual/Discord/X/LMS use this for unverifiable
  // claims.
  requiresManualReview: boolean;
}

export interface PublicProofPayload {
  // Whitelisted, public-safe fields surfaced on /proof/[id]. Each adapter
  // decides what is OK to expose. NEVER include raw API responses, OAuth
  // tokens, admin notes, or anti-farm internals.
  proof_type: ProofType;
  summary: string;
  fields: Record<string, string | number | boolean | null>;
}

export interface AdapterContext {
  questDbId: string;
  walletAddress: string;
  linkedGithubLogin?: string | null;
  linkedDiscord?: { id: string; username: string } | null;
  quest: {
    id: string;
    start_time: Date;
    min_score: number;
    scoring_rubric_json: unknown;
    requirements_json: unknown;
    proof_type: string;
    contract_version: number;
  };
}

export interface ProofAdapter<TInput = Record<string, unknown>, TEvidence = unknown> {
  proofType: ProofType;
  displayName: string;
  /** Synchronous form validation. */
  validateInput(input: TInput, ctx: AdapterContext): ValidationResult;
  /** Fetch external evidence (GitHub repo, demo URL probe, Discord guild check, etc.). */
  fetchEvidence(input: TInput, ctx: AdapterContext): Promise<TEvidence>;
  /** Score and return a structured result. */
  scoreEvidence(evidence: TEvidence, ctx: AdapterContext): Promise<AdapterScoringResult>;
  /** Build the public-safe payload surfaced on /proof/[id]. */
  buildPublicProofPayload(evidence: TEvidence, result: AdapterScoringResult): PublicProofPayload;
  /** Adapter-specific JSON stored on submission.evidence_json (NOT public). */
  buildPrivateEvidence(evidence: TEvidence, result: AdapterScoringResult): unknown;
  /** True if this adapter always routes to manual review (overrides auto-pass). */
  requiresManualReview(): boolean;
  /** True if this adapter supports auto-pass on a deterministic score >= minScore. */
  supportsAutoApproval(): boolean;
}
