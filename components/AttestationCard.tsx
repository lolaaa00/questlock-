import { easAttestationUrl } from "@/lib/chains";

interface AttestationCardProps {
  uid: string;
  score: number;
  riskBand: string;
  questId?: string;
}

export default function AttestationCard({
  uid,
  score,
  riskBand,
  questId,
}: AttestationCardProps) {
  const shortUid = uid.length > 16 ? `${uid.slice(0, 10)}…${uid.slice(-6)}` : uid;
  const isNull = uid === "0x" + "0".repeat(64);

  if (isNull) return null;

  return (
    <div
      className="rounded-[18px] p-6 border"
      style={{
        background: "var(--ql-bighorn)",
        borderColor: "rgba(180,20,40,0.18)",
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-1"
            style={{ color: "var(--ql-cafe)" }}
          >
            EAS Attestation
          </p>
          <p
            className="font-serif text-lg font-semibold"
            style={{ color: "#F6F1EA" }}
          >
            Proof Certificate
          </p>
        </div>
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: "#B01020" }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M9 2L11.5 6.5L16.5 7.5L13 11L13.8 16L9 13.5L4.2 16L5 11L1.5 7.5L6.5 6.5L9 2Z"
              fill="#F6F1EA"
            />
          </svg>
        </div>
      </div>

      <div className="space-y-3 mb-5">
        <div className="flex justify-between text-sm">
          <span style={{ color: "var(--ql-cafe)" }}>Attestation UID</span>
          <span className="font-mono text-xs" style={{ color: "#F6F1EA" }}>
            {shortUid}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span style={{ color: "var(--ql-cafe)" }}>Proof Score</span>
          <span className="font-semibold" style={{ color: "#F6F1EA" }}>
            {score}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span style={{ color: "var(--ql-cafe)" }}>Risk Band</span>
          <span
            className="text-xs font-semibold uppercase px-2 py-0.5 rounded-full"
            style={{ background: "rgba(255,255,255,0.1)", color: "#F6F1EA" }}
          >
            {riskBand.replace("_RISK", "")}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span style={{ color: "var(--ql-cafe)" }}>Network</span>
          <span style={{ color: "#F6F1EA" }}>Base Sepolia</span>
        </div>
      </div>

      <a
        href={easAttestationUrl(uid)}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full text-center py-2.5 rounded-full text-sm font-medium transition-opacity hover:opacity-90"
        style={{ background: "#B01020", color: "#F6F1EA" }}
      >
        View on EASScan →
      </a>
    </div>
  );
}
