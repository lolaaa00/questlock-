// LMS course completion proof. Manual review.
import type { ProofAdapter, ValidationResult, AdapterScoringResult, PublicProofPayload } from "./types";

export interface LmsInput {
  platform: string;
  certificateUrl: string;
  completionId?: string;
  supportingLink?: string;
  explanation: string;
}
export interface LmsEvidence extends LmsInput { receivedAt: number; }

export const lmsCourseAdapter: ProofAdapter<LmsInput, LmsEvidence> = {
  proofType: "lms_course",
  displayName: "LMS / Course Completion",

  validateInput(input): ValidationResult {
    const errors: string[] = [];
    if (!input.platform?.trim()) errors.push("Platform / course name required.");
    if (!input.certificateUrl?.trim() || !input.certificateUrl.startsWith("http"))
      errors.push("Valid certificate URL required.");
    if (input.supportingLink && !input.supportingLink.startsWith("http"))
      errors.push("Supporting link must be http(s).");
    if (!input.explanation?.trim() || input.explanation.trim().length < 30)
      errors.push("Explanation required (min 30 chars).");
    return { ok: errors.length === 0, errors };
  },

  async fetchEvidence(input): Promise<LmsEvidence> {
    return { ...input, receivedAt: Date.now() };
  },

  async scoreEvidence(): Promise<AdapterScoringResult> {
    return {
      score: 0, passed: false,
      failureReasons: ["Awaiting manual admin review."],
      warnings: [],
      checks: [{
        check_name: "lms_manual_review", passed: false,
        points_awarded: 0, max_points: 0,
        details: "Course completions are admin-verified.",
      }],
      requiresManualReview: true,
    };
  },

  buildPublicProofPayload(evidence): PublicProofPayload {
    return {
      proof_type: "lms_course",
      summary: `Completed ${evidence.platform}`,
      fields: {
        platform: evidence.platform,
        certificate_url: evidence.certificateUrl,
        completion_id: evidence.completionId ?? null,
      },
    };
  },

  buildPrivateEvidence(evidence) { return evidence; },
  requiresManualReview() { return true; },
  supportsAutoApproval() { return false; },
};
