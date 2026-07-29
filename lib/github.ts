// GitHub proof fetcher. v1.1 hardening:
//   - retry transient 5xx/429 via lib/retry
//   - capture fork, language, default branch, primary topics
//   - authorship signal: was at least one of the post-start commits
//     authored by the submitting GitHub user?
//   - README structure: section count, length
//   - file tree depth + package manager + broader frontend/contract patterns
//
// The point allocations in scoring.ts are unchanged so existing data is still
// readable; we feed richer signals into the same checks and improve the
// failure-reason copy.

import { withRetry, isRetryableStatus } from "./retry";

export interface GitHubRepoData {
  owner: string;
  repo: string;
  exists: boolean;
  ownerLogin: string;
  isForked: boolean;
  isEmpty: boolean;
  pushedAt: string | null;
  updatedAt: string | null;
  defaultBranch: string;
  language: string | null;
  commitCountAfterStart: number;
  commitsByOwnerCount: number;
  hasReadme: boolean;
  readmeCharCount: number;
  readmeSectionCount: number;
  hasFrontendFiles: boolean;
  hasContractFiles: boolean;
  packageManager: "npm" | "pnpm" | "yarn" | "bun" | "unknown";
  fileCount: number;
  directoryDepth: number;
  error?: string;
  // Soft warnings — surfaced in the UI but do not by themselves fail a check.
  warnings: string[];
}

const GITHUB_API = "https://api.github.com";

function githubHeaders(): HeadersInit {
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) {
    headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const cleaned = url.trim().replace(/\.git$/, "");
    const match = cleaned.match(
      /github\.com[/:]([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/
    );
    if (!match) return null;
    return { owner: match[1], repo: match[2] };
  } catch {
    return null;
  }
}

export function normaliseGitHubUrl(url: string): string | null {
  const parsed = parseGitHubUrl(url);
  if (!parsed) return null;
  return `https://github.com/${parsed.owner}/${parsed.repo}`;
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function apiGetOnce(path: string): Promise<unknown> {
  // The `next: { revalidate: 0 }` option is Next.js-specific. Cast through
  // unknown so tsc with the plain DOM `RequestInit` accepts it (Next strips
  // the extra field server-side, native fetch ignores it client-side).
  const init = {
    headers: githubHeaders(),
    next: { revalidate: 0 },
  } as unknown as RequestInit;
  const res = await fetch(`${GITHUB_API}${path}`, init);
  if (!res.ok) throw new HttpError(res.status, `GitHub ${path} -> ${res.status}`);
  return res.json();
}

interface ApiResult { ok: boolean; status: number; data: unknown; }

async function apiGet(path: string): Promise<ApiResult> {
  try {
    const data = await withRetry((attempt) => apiGetOnce(path), {
      retries: 2,
      baseDelayMs: 400,
      isRetryable: (err) =>
        err instanceof HttpError ? isRetryableStatus(err.status) : true,
    });
    return { ok: true, status: 200, data };
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, status: err.status, data: null };
    return { ok: false, status: 0, data: null };
  }
}

function countReadmeSections(text: string): number {
  // Headings of form "# title", "## title", "### title" (markdown-flavoured)
  const lines = text.split(/\r?\n/);
  return lines.filter((l) => /^#{1,6}\s+\S/.test(l)).length;
}

function detectPackageManager(paths: string[]): GitHubRepoData["packageManager"] {
  if (paths.includes("pnpm-lock.yaml")) return "pnpm";
  if (paths.includes("yarn.lock")) return "yarn";
  if (paths.includes("bun.lockb") || paths.includes("bun.lock")) return "bun";
  if (paths.includes("package-lock.json")) return "npm";
  return "unknown";
}

const FRONTEND_PATTERNS: RegExp[] = [
  /(^|\/)package\.json$/,
  /(^|\/)index\.(html|tsx|jsx|ts|js)$/,
  /(^|\/)app\//,
  /(^|\/)pages\//,
  /(^|\/)src\//,
  /(^|\/)components\//,
  /(^|\/)next\.config\.(ts|js|mjs|cjs)$/,
  /(^|\/)vite\.config\.(ts|js|mjs|cjs)$/,
  /(^|\/)svelte\.config\.(ts|js)$/,
  /(^|\/)nuxt\.config\.(ts|js)$/,
  /(^|\/)tailwind\.config\.(ts|js)$/,
  /\.(tsx|jsx)$/,
];

const CONTRACT_BACKEND_PATTERNS: RegExp[] = [
  /(^|\/)contracts?\//,
  /\.sol$/,
  /(^|\/)hardhat\.config\.(ts|js|mjs|cjs)$/,
  /(^|\/)foundry\.toml$/,
  /(^|\/)truffle-config\.(js|ts)$/,
  /(^|\/)remappings\.txt$/,
  /(^|\/)server\//,
  /(^|\/)backend\//,
  /(^|\/)api\//,
  /(^|\/)prisma\//,
  /(^|\/)main\.go$/,
  /(^|\/)main\.rs$/,
  /(^|\/)cargo\.toml$/i,
  /(^|\/)pom\.xml$/i,
];

export async function fetchRepoData(
  owner: string,
  repo: string,
  questStartTime: Date,
  submittedGithubUsername: string
): Promise<GitHubRepoData> {
  const base: GitHubRepoData = {
    owner,
    repo,
    exists: false,
    ownerLogin: "",
    isForked: false,
    isEmpty: false,
    pushedAt: null,
    updatedAt: null,
    defaultBranch: "main",
    language: null,
    commitCountAfterStart: 0,
    commitsByOwnerCount: 0,
    hasReadme: false,
    readmeCharCount: 0,
    readmeSectionCount: 0,
    hasFrontendFiles: false,
    hasContractFiles: false,
    packageManager: "unknown",
    fileCount: 0,
    directoryDepth: 0,
    warnings: [],
  };

  // 1. Repo metadata
  const repoRes = await apiGet(`/repos/${owner}/${repo}`);
  if (!repoRes.ok) {
    base.error =
      repoRes.status === 404
        ? "Repository not found or is private."
        : repoRes.status === 429
        ? "GitHub rate limit hit. Please retry shortly."
        : repoRes.status === 0
        ? "Could not reach GitHub. Please retry."
        : `GitHub API error: ${repoRes.status}`;
    return base;
  }

  const repoData = repoRes.data as Record<string, unknown>;
  base.exists = true;
  base.ownerLogin = (repoData.owner as Record<string, string>)?.login || "";
  base.isForked = Boolean(repoData.fork);
  base.isEmpty = Boolean(repoData.size === 0);
  base.pushedAt = (repoData.pushed_at as string | null) ?? null;
  base.updatedAt = (repoData.updated_at as string | null) ?? null;
  base.defaultBranch = (repoData.default_branch as string) || "main";
  base.language = (repoData.language as string | null) ?? null;

  if (base.isForked) {
    base.warnings.push(
      "Repository is a fork. Make sure the meaningful work is in commits authored by you after the quest start."
    );
  }
  if (base.isEmpty) {
    base.warnings.push("Repository is empty.");
  }

  if (base.ownerLogin.toLowerCase() !== submittedGithubUsername.toLowerCase()) {
    base.error = `Repository owner (${base.ownerLogin}) does not match submitted GitHub username (${submittedGithubUsername}).`;
  }

  // 2. Commits since quest start — capture authorship signal too.
  const since = questStartTime.toISOString();
  const commitsRes = await apiGet(
    `/repos/${owner}/${repo}/commits?since=${since}&per_page=100`
  );
  if (commitsRes.ok) {
    const commits = commitsRes.data as Array<Record<string, unknown>>;
    if (Array.isArray(commits)) {
      base.commitCountAfterStart = commits.length;
      const submittedLower = submittedGithubUsername.toLowerCase();
      base.commitsByOwnerCount = commits.filter((c) => {
        const author = c.author as { login?: string } | null;
        const committer = c.committer as { login?: string } | null;
        const commitObj = c.commit as { author?: { name?: string; email?: string } } | undefined;
        const login = (author?.login || committer?.login || "").toLowerCase();
        if (login === submittedLower) return true;
        // Fall back to email/name heuristics in case GitHub did not link
        // the commit to the user's account.
        const commitAuthorName = (commitObj?.author?.name || "").toLowerCase();
        const commitAuthorEmail = (commitObj?.author?.email || "").toLowerCase();
        return (
          commitAuthorName.includes(submittedLower) ||
          commitAuthorEmail.includes(submittedLower)
        );
      }).length;

      if (base.commitCountAfterStart > 0 && base.commitsByOwnerCount === 0) {
        base.warnings.push(
          "Commits since quest start are not attributed to your GitHub account."
        );
      }
    }
  }

  // 3. README content + section structure
  const readmeRes = await apiGet(`/repos/${owner}/${repo}/readme`);
  if (readmeRes.ok) {
    base.hasReadme = true;
    const readmeData = readmeRes.data as Record<string, string>;
    if (readmeData.content) {
      try {
        const decoded = Buffer.from(readmeData.content, "base64").toString("utf-8");
        base.readmeCharCount = decoded.replace(/\s+/g, " ").trim().length;
        base.readmeSectionCount = countReadmeSections(decoded);
      } catch {
        base.readmeCharCount = 0;
      }
    }
  }

  // 4. File tree (recursive on default branch)
  const treeRes = await apiGet(
    `/repos/${owner}/${repo}/git/trees/${base.defaultBranch}?recursive=1`
  );
  if (treeRes.ok) {
    const treeData = treeRes.data as { tree?: Array<{ path: string; type: string }> };
    const entries = treeData.tree || [];
    const filePaths = entries
      .filter((e) => e.type === "blob")
      .map((e) => e.path);
    const lowerPaths = filePaths.map((p) => p.toLowerCase());

    base.fileCount = filePaths.length;
    base.directoryDepth = filePaths.reduce(
      (max, p) => Math.max(max, p.split("/").length - 1),
      0
    );

    base.hasFrontendFiles = FRONTEND_PATTERNS.some((re) =>
      lowerPaths.some((p) => re.test(p))
    );
    base.hasContractFiles = CONTRACT_BACKEND_PATTERNS.some((re) =>
      lowerPaths.some((p) => re.test(p))
    );

    // Just the basenames for package manager detection.
    const basenames = lowerPaths.map((p) => p.split("/").pop() || "");
    base.packageManager = detectPackageManager(basenames);
  }

  return base;
}
