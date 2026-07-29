import type { ProofAdapter, ProofType } from "./types";
import { githubProjectAdapter } from "./github-project";
import { manualProjectAdapter } from "./manual-project";
import { discordRoleAdapter } from "./discord-role";
import { xPostAdapter } from "./x-post";
import { lmsCourseAdapter } from "./lms-course";

// Centralised adapter registry. Add new proof types by registering them here.
const REGISTRY: Record<ProofType, ProofAdapter<any, any>> = {
  github_project: githubProjectAdapter,
  manual_project: manualProjectAdapter,
  discord_role:   discordRoleAdapter,
  x_post:         xPostAdapter,
  lms_course:     lmsCourseAdapter,
};

export function getAdapter(proofType: string): ProofAdapter<any, any> | null {
  if (proofType in REGISTRY) return REGISTRY[proofType as ProofType];
  return null;
}

export function listAdapters(): ProofAdapter<any, any>[] {
  return Object.values(REGISTRY);
}
