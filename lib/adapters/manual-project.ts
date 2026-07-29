// Manual project proof — admin reviews and approves. No automated scoring.
import type { ProofAdapter, ValidationResult, AdapterScoringResult, PublicProofPayload } from "./types";

export interface ManualInput {
  projectTitle: string;
  demoUrl: string;
  explanation: string;
  repoUrl?: string;
  supportingLink?: string;
  evidenceNote?: string;
}
export interface ManualEvidence extends ManualInput { receivedAt: number; }

export const manualProjectAdapter: ProofAdapter<ManualInput, ManualEvidence> = {
  proofType: "manual_project",
  displayName: "Manual Project",

  validateInput(input): ValidationResult {
    const errors: string[] = [];
    if (!input.projectTitle?.trim()) errors.push("Project title required.");
    if (!input.demoUrl?.trim() || !input.demoUrl.startsWith("http")) errors.push("Valid demo URL required.");
    if (!input.explanation?.trim() || input.explanation.trim().length < 30) errors.push("Explanation required (min 30 chars).");
    if (input.supportingLink && !input.supportingLink.startsWith("http")) errors.push("Supporting link must be http(s).");
    return { ok: errors.length === 0, errors };
  },

  async fetchEvidence(input): Promise<ManualEvidence> {
    return { ...input, receivedAt: Date.now() };
  },

  async scoreEvidence(): Promise<AdapterScoringResult> {
    // Manual proofs always defer to admin review.
    return {
      score: 0, passed: false,
      failureReasons: ["Awaiting manual admin review."],
      warnings: [],
      checks: [{
        check_name: "manual_review_required", passed: false,
        points_awarded: 0, max_points: 0,
        details: "Manual proofs require admin verification before approval.",
      }],
      requiresManualReview: true,
    };
  },

  buildPublicProofPayload(evidence): PublicProofPayload {
    return {
      proof_type: "manual_project",
      summary: `Manual project: ${evidence.projectTitle}`,
      fields: {
        project_title: evidence.projectTitle,
        demo_url: evidence.demoUrl,
        supporting_link: evidence.supportingLink ?? null,
        // explanation is NOT exposed by default — admin notes/internal text stay private
      },
    };
  },

  buildPrivateEvidence(evidence) { return evidence; },
  requiresManualReview() { return true; },
  supportsAutoApproval() { return false; },
};
