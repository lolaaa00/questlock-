interface ProofCheck {
  check_name: string;
  passed: boolean;
  points_awarded: number;
  max_points: number;
  details_json: { details?: string } | null;
}

const CHECK_LABELS: Record<string, string> = {
  repo_exists: "Repository found",
  owner_matches: "Owner matches GitHub username",
  repo_updated_after_start: "Updated after quest start",
  commits_after_start: "Commits after quest start (min 3)",
  readme_exists: "README file present",
  readme_length: "README has 500+ characters",
  frontend_files: "Frontend files detected",
  contract_files: "Contract/backend files detected",
  demo_url_loads: "Demo URL loads",
  not_previously_submitted: "Repo not previously submitted",
};

export default function ScoreBreakdown({
  checks,
  totalScore,
  minScore,
}: {
  checks: ProofCheck[];
  totalScore: number;
  minScore: number;
}) {
  const passed = totalScore >= minScore;
  const maxPossible = checks.reduce((s, c) => s + c.max_points, 0);

  return (
    <div
      className="rounded-[18px] overflow-hidden border"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
    >
      <div
        className="px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <span
          className="font-serif text-base font-semibold"
          style={{ color: "#F0E6E2" }}
        >
          Score Breakdown
        </span>
        <div className="flex items-center gap-3">
          <span
            className="text-2xl font-bold tabular-nums"
            style={{ color: passed ? "rgba(122,158,111,0.35)" : "#7A2020" }}
          >
            {totalScore}
          </span>
          <span style={{ color: "var(--ql-bear)" }}>/ {maxPossible}</span>
          <span
            className="text-xs font-semibold uppercase px-2 py-0.5 rounded-full"
            style={
              passed
                ? { background: "#D9EDD9", color: "rgba(122,158,111,0.35)" }
                : { background: "#F0DADA", color: "#7A2020" }
            }
          >
            {passed ? "Pass" : `Fail (min ${minScore})`}
          </span>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: "var(--muted)" }}>
            <th
              className="px-6 py-2 text-left font-medium text-xs uppercase tracking-wider"
              style={{ color: "var(--ql-bear)" }}
            >
              Check
            </th>
            <th
              className="px-4 py-2 text-center font-medium text-xs uppercase tracking-wider"
              style={{ color: "var(--ql-bear)" }}
            >
              Result
            </th>
            <th
              className="px-6 py-2 text-right font-medium text-xs uppercase tracking-wider"
              style={{ color: "var(--ql-bear)" }}
            >
              Points
            </th>
          </tr>
        </thead>
        <tbody>
          {checks.map((c, i) => (
            <tr
              key={c.check_name}
              style={{
                borderTop: i > 0 ? "1px solid var(--border)" : undefined,
              }}
            >
              <td className="px-6 py-3">
                <p style={{ color: "#F0E6E2" }}>
                  {CHECK_LABELS[c.check_name] || c.check_name}
                </p>
                {!c.passed && c.details_json?.details && (
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: "#7A2020" }}
                  >
                    {c.details_json.details}
                  </p>
                )}
              </td>
              <td className="px-4 py-3 text-center">
                <span
                  className="inline-block w-5 h-5 rounded-full text-xs font-bold leading-5 text-center"
                  style={
                    c.passed
                      ? { background: "#D9EDD9", color: "rgba(122,158,111,0.35)" }
                      : { background: "#F0DADA", color: "#7A2020" }
                  }
                >
                  {c.passed ? "✓" : "✕"}
                </span>
              </td>
              <td
                className="px-6 py-3 text-right font-mono font-medium"
                style={{ color: c.passed ? "rgba(122,158,111,0.35)" : "#7A2020" }}
              >
                {c.points_awarded}/{c.max_points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
