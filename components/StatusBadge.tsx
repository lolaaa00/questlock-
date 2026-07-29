type Status =
  | "SUBMITTED"
  | "FETCHING_PROOF"
  | "EVALUATING"
  | "PASSED"
  | "FAILED"
  | "ATTESTING"
  | "ATTESTED"
  | "APPROVING_ONCHAIN"
  | "APPROVED_ONCHAIN"
  | "CLAIMING"
  | "CLAIMED"
  | "CLAIM_FAILED"
  | "REJECTED"
  | string;

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  SUBMITTED: { label: "Proof Submitted", className: "badge-submitted" },
  FETCHING_PROOF: { label: "Checking Proof", className: "badge-checking" },
  EVALUATING: { label: "Evaluating", className: "badge-checking" },
  PASSED: { label: "Proof Passed", className: "badge-passed" },
  FAILED: { label: "Proof Failed", className: "badge-failed" },
  ATTESTING: { label: "Issuing Attestation", className: "badge-checking" },
  ATTESTED: { label: "Attestation Issued", className: "badge-attested" },
  APPROVING_ONCHAIN: { label: "Approving Onchain", className: "badge-checking" },
  SPONSOR_APPROVED_PENDING_ADMIN: { label: "Pending Admin Confirmation", className: "badge-checking" },
  APPROVED_ONCHAIN: { label: "Reward Unlocked", className: "badge-claimable" },
  CLAIMING: { label: "Claiming…", className: "badge-checking" },
  CLAIMED: { label: "Reward Claimed", className: "badge-claimed" },
  CLAIM_FAILED: { label: "Claim Failed", className: "badge-failed" },
  REJECTED: { label: "Rejected", className: "badge-rejected" },
};

export default function StatusBadge({ status }: { status: Status }) {
  const { label, className } = STATUS_MAP[status] ?? {
    label: status,
    className: "badge-submitted",
  };

  return (
    <span
      className={`inline-block text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full ${className}`}
    >
      {label}
    </span>
  );
}
