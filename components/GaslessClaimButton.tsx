"use client";

import { useState } from "react";
import { explorerTxUrl } from "@/lib/chains";

interface GaslessClaimButtonProps {
  submissionId: string;
  walletAddress: string;
  onClaimed?: (txHash: string) => void;
}

export default function GaslessClaimButton({
  submissionId,
  walletAddress,
  onClaimed,
}: GaslessClaimButtonProps) {
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error" | "blocked">("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClaim() {
    setState("submitting");
    setError(null);

    try {
      const res = await fetch("/api/relay/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, walletAddress }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setState("blocked");
          setError(data.error || "This reward can't be claimed.");
          return;
        }
        throw new Error(data.error || "Claim failed.");
      }

      if (data.success && data.txHash) {
        setState("success");
        setTxHash(data.txHash);
        if (onClaimed) onClaimed(data.txHash);
      } else {
        throw new Error("Unexpected response from claim API.");
      }
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Unknown error.");
    }
  }

  if (state === "blocked") {
    return (
      <div
        className="rounded-[18px] p-6 text-center"
        style={{ background: "#1A0A08" }}
      >
        <p className="font-semibold text-lg mb-1" style={{ color: "#F6F1EA" }}>
          Claim unavailable
        </p>
        <p className="text-sm" style={{ color: "var(--ql-cafe)" }}>
          {error}
        </p>
      </div>
    );
  }

  if (state === "success") {
    return (
      <div
        className="rounded-[18px] p-6 text-center"
        style={{ background: "#1A0A08" }}
      >
        <p
          className="font-semibold text-lg mb-1"
          style={{ color: "#F6F1EA" }}
        >
          Reward Claimed
        </p>
        <p className="text-sm mb-4" style={{ color: "var(--ql-cafe)" }}>
          QUEST tokens and badge delivered to your wallet.
        </p>
        {txHash && (
          <a
            href={explorerTxUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline"
            style={{ color: "var(--ql-chocolate)" }}
          >
            View transaction →
          </a>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={handleClaim}
        disabled={state === "submitting"}
        className="w-full py-4 rounded-full font-semibold text-base transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
        style={{
          background: state === "submitting" ? "var(--ql-derby)" : "#B01020",
          color: "#F6F1EA",
        }}
      >
        {state === "idle" ? "Claim Reward (Gasless)" : "Processing Claim…"}
      </button>

      {state === "error" && error && (
        <p className="text-xs text-center mt-2" style={{ color: "#7A2020" }}>
          {error}
        </p>
      )}
    </div>
  );
}
