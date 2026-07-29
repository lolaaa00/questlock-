"use client";

const STEPS = [
  { key: "SUBMITTED",      label: "Proof Submitted" },
  { key: "EVALUATING",     label: "Evaluating" },
  { key: "PASSED",         label: "Proof Passed" },
  { key: "ATTESTED",       label: "Attestation Issued" },
  { key: "APPROVED_ONCHAIN", label: "Reward Unlocked" },
  { key: "CLAIMED",        label: "Reward Claimed" },
];

// Map non-step statuses to the nearest step index they belong to
const STATUS_TO_STEP_INDEX: Record<string, number> = {
  SUBMITTED:        0,
  FETCHING_PROOF:   1,
  EVALUATING:       1,
  PASSED:           2,
  ATTESTING:        2,  // between passed and attested — show passed as active
  ATTESTED:         3,
  APPROVING_ONCHAIN: 3, // between attested and approved — show attested as active
  APPROVED_ONCHAIN: 4,
  CLAIMING:         4,
  CLAIMED:          5,
  CLAIM_FAILED:     4,
};

const FAILED_KEYS = new Set(["FAILED", "REJECTED", "CLAIM_FAILED"]);

const IN_PROGRESS_KEYS = new Set([
  "FETCHING_PROOF",
  "EVALUATING",
  "ATTESTING",
  "APPROVING_ONCHAIN",
  "CLAIMING",
]);

function stepState(
  stepIdx: number,
  currentStatus: string
): "done" | "active" | "pending" | "failed" {
  if (FAILED_KEYS.has(currentStatus) && currentStatus !== "CLAIM_FAILED") {
    // Full failure — everything is failed
    return stepIdx <= 2 ? "failed" : "pending";
  }

  const currentIdx = STATUS_TO_STEP_INDEX[currentStatus] ?? -1;

  if (currentIdx === -1) return "pending";

  if (stepIdx < currentIdx) return "done";
  if (stepIdx === currentIdx) return "active";
  return "pending";
}

export default function ProofTimeline({ status }: { status: string }) {
  const isFailed = FAILED_KEYS.has(status) && status !== "CLAIM_FAILED";
  const isInProgress = IN_PROGRESS_KEYS.has(status);

  return (
    <div className="flex flex-col gap-0">
      {STEPS.map((step, i) => {
        const state = stepState(i, status);
        const isLast = i === STEPS.length - 1;
        const isCurrentlyActive = state === "active" && isInProgress;

        return (
          <div key={step.key} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                  state === "done"
                    ? "timeline-step-done"
                    : state === "active"
                    ? `timeline-step-active ${isCurrentlyActive ? "animate-pulse" : ""}`
                    : state === "failed"
                    ? "timeline-step-failed"
                    : "timeline-step-pending"
                }`}
              >
                {state === "done" ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2 6l3 3 5-5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : state === "failed" ? (
                  "✕"
                ) : (
                  i + 1
                )}
              </div>
              {!isLast && (
                <div
                  className="w-0.5 h-6 mt-0.5"
                  style={{
                    background: state === "done" ? "rgba(122,158,111,0.35)" : "var(--border)",
                  }}
                />
              )}
            </div>
            <div className="pb-4">
              <p
                className={`text-sm font-medium leading-none mt-1.5`}
                style={{
                  color:
                    state === "active"
                      ? "#B01020"
                      : state === "done"
                      ? "rgba(122,158,111,0.35)"
                      : state === "failed"
                      ? "#7A2020"
                      : "var(--ql-bear)",
                }}
              >
                {step.label}
              </p>
              {state === "active" && isInProgress && (
                <p className="text-xs mt-0.5" style={{ color: "var(--ql-bear)" }}>
                  In progress…
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
