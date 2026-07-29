import { getAdapter, listAdapters } from "../../lib/adapters/registry";

describe("proof adapter registry", () => {
  test("returns null for unknown proof types", () => {
    expect(getAdapter("nonexistent_type")).toBeNull();
  });

  test("registers all five v1.2 adapters", () => {
    const all = listAdapters();
    const types = all.map((a) => a.proofType).sort();
    expect(types).toEqual([
      "discord_role", "github_project", "lms_course", "manual_project", "x_post",
    ]);
  });

  test("each adapter has a displayName + required methods", () => {
    for (const a of listAdapters()) {
      expect(typeof a.displayName).toBe("string");
      expect(typeof a.validateInput).toBe("function");
      expect(typeof a.fetchEvidence).toBe("function");
      expect(typeof a.scoreEvidence).toBe("function");
      expect(typeof a.buildPublicProofPayload).toBe("function");
      expect(typeof a.buildPrivateEvidence).toBe("function");
      expect(typeof a.requiresManualReview).toBe("function");
      expect(typeof a.supportsAutoApproval).toBe("function");
    }
  });

  test("github adapter supports auto-approval; manual/lms always need manual review", () => {
    expect(getAdapter("github_project")!.supportsAutoApproval()).toBe(true);
    expect(getAdapter("github_project")!.requiresManualReview()).toBe(false);
    expect(getAdapter("manual_project")!.requiresManualReview()).toBe(true);
    expect(getAdapter("manual_project")!.supportsAutoApproval()).toBe(false);
    expect(getAdapter("lms_course")!.requiresManualReview()).toBe(true);
    expect(getAdapter("lms_course")!.supportsAutoApproval()).toBe(false);
  });
});
