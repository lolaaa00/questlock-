// X/Twitter post proof. Free-tier: URL + handle + post-id validation only;
// deterministic content verification requires paid X API which is explicitly
// out of scope for v1.2. Falls back to manual review by default.

import type { ProofAdapter, ValidationResult, AdapterScoringResult, PublicProofPayload } from "./types";

export interface XInput {
  handle: string;
  postUrl: string;
  evidenceNote?: string;
}
export interface XEvidence {
  handle: string;
  postUrl: string;
  postId: string | null;
  authorMatchesHandle: boolean | null; // null when we can't verify
  reason: string;
}

const X_POST_REGEX = /^https?:\/\/(?:www\.)?(?:twitter|x)\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d{5,25})\b/i;

export function parseXUrl(url: string): { handle: string; postId: string } | null {
  const m = url.match(X_POST_REGEX);
  if (!m) return null;
  return { handle: m[1], postId: m[2] };
}

export const xPostAdapter: ProofAdapter<XInput, XEvidence> = {
  proofType: "x_post",
  displayName: "X / Twitter Post",

  validateInput(input): ValidationResult {
    const errors: string[] = [];
    if (!input.handle?.trim()) errors.push("X handle required.");
    if (!input.postUrl?.trim()) errors.push("Post URL required.");
    else if (!parseXUrl(input.postUrl)) errors.push("URL must look like https://x.com/handle/status/123… or twitter.com/…");
    return { ok: errors.length === 0, errors };
  },

  async fetchEvidence(input): Promise<XEvidence> {
    const parsed = parseXUrl(input.postUrl);
    const authorMatchesHandle =
      parsed ? parsed.handle.toLowerCase() === input.handle.replace(/^@/, "").toLowerCase() : false;
    return {
      handle: input.handle.replace(/^@/, ""),
      postUrl: input.postUrl,
      postId: parsed?.postId ?? null,
      authorMatchesHandle: parsed ? authorMatchesHandle : null,
      reason: parsed
        ? (authorMatchesHandle
            ? "URL author matches submitted handle. Content verification requires manual review."
            : "URL author does not match submitted handle.")
        : "Invalid X URL format.",
    };
  },

  async scoreEvidence(evidence): Promise<AdapterScoringResult> {
    if (!evidence.postId) {
      return {
        score: 0, passed: false,
        failureReasons: [evidence.reason], warnings: [],
        checks: [{ check_name: "x_url_format", passed: false, points_awarded: 0, max_points: 100, details: evidence.reason }],
        requiresManualReview: false,
      };
    }
    if (evidence.authorMatchesHandle === false) {
      return {
        score: 0, passed: false,
        failureReasons: [evidence.reason], warnings: [],
        checks: [{ check_name: "x_author_match", passed: false, points_awarded: 0, max_points: 100, details: evidence.reason }],
        requiresManualReview: false,
      };
    }
    // Defer content verification to admin.
    return {
      score: 0, passed: false,
      failureReasons: ["Awaiting admin review for content (required phrase/hashtag/mention)."],
      warnings: ["X post content cannot be verified deterministically in v1.2 (no paid X API)."],
      checks: [{
        check_name: "x_url_and_author", passed: true,
        points_awarded: 100, max_points: 100,
        details: "URL valid and author matches handle.",
      }],
      requiresManualReview: true,
    };
  },

  buildPublicProofPayload(evidence): PublicProofPayload {
    return {
      proof_type: "x_post",
      summary: `X post by @${evidence.handle}`,
      fields: {
        handle: `@${evidence.handle}`,
        post_url: evidence.postUrl,
        post_id: evidence.postId,
      },
    };
  },

  buildPrivateEvidence(evidence) { return evidence; },
  requiresManualReview() { return true; }, // default route is manual until paid X API is added
  supportsAutoApproval() { return false; },
};
