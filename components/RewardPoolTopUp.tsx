"use client";

// Admin pool top-up. The transfer is signed by the connected admin wallet
// directly — the backend verifier key is never used for this. The component
// reads admin's QUEST balance and the live pool balance via wagmi, then calls
// QuestRewardToken.transfer(QuestLockCore, amount).

import { useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits, formatUnits, parseAbi } from "viem";
import { CONTRACT_ADDRESSES } from "@/lib/contracts";
import { explorerTxUrl } from "@/lib/chains";
import { evaluateTopUp, topUpBlockMessage } from "@/lib/pool-topup";

const QUEST_ABI = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

const EXPECTED_CHAIN_ID = 84532;

interface Props {
  adminWallet: string;
  poolBalance: string | null;       // e.g. "990"
  totalMaxPayout: string;            // e.g. "1240"
  shortfall: string;                 // e.g. "250"
  poolCoveragePct: number | null;
  onSuccess?: () => void;
}

const QUICK = [
  { key: "shortfall", label: "Top up shortfall" },
  { key: "500", label: "Top up 500 QUEST" },
  { key: "1000", label: "Top up 1000 QUEST" },
] as const;

export default function RewardPoolTopUp({
  adminWallet,
  poolBalance,
  totalMaxPayout,
  shortfall,
  poolCoveragePct,
  onSuccess,
}: Props) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: switching } = useSwitchChain();
  const [amount, setAmount] = useState<string>(
    Number(shortfall) > 0 ? shortfall : "500"
  );

  // Read admin's QUEST balance (refetches when wallet changes)
  const { data: balanceRaw } = useReadContract({
    address: CONTRACT_ADDRESSES.QUEST_REWARD_TOKEN,
    abi: QUEST_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const adminBalanceQuest = useMemo(() => {
    if (balanceRaw === undefined) return null;
    try {
      return formatUnits(balanceRaw as bigint, 18);
    } catch {
      return null;
    }
  }, [balanceRaw]);

  // Transaction lifecycle
  const { writeContractAsync, data: txHash, reset: resetTx } = useWriteContract();
  const {
    data: receipt,
    isLoading: waitingForReceipt,
    isSuccess: txSuccess,
  } = useWaitForTransactionReceipt({ hash: txHash });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Notify parent on success so the analytics panel reloads
  useEffect(() => {
    if (txSuccess && receipt && onSuccess) onSuccess();
  }, [txSuccess, receipt, onSuccess]);

  // Re-pick a sensible default when shortfall changes (e.g. after a successful top-up)
  useEffect(() => {
    if (Number(shortfall) > 0) setAmount(shortfall);
  }, [shortfall]);

  const decision = evaluateTopUp({
    connectedWallet: address ?? null,
    adminWallet,
    chainId: chainId ?? null,
    expectedChainId: EXPECTED_CHAIN_ID,
    amountQuest: amount,
    adminBalanceQuest,
    txPending: submitting || waitingForReceipt,
  });

  const isWrongNetwork =
    isConnected && chainId !== EXPECTED_CHAIN_ID;
  const isWrongWallet =
    isConnected && address?.toLowerCase() !== adminWallet.toLowerCase();

  async function handleTransfer() {
    setErrorMsg(null);
    if (!decision.canSubmit) return;
    setSubmitting(true);
    try {
      const value = parseUnits(amount, 18);
      await writeContractAsync({
        address: CONTRACT_ADDRESSES.QUEST_REWARD_TOKEN,
        abi: QUEST_ABI,
        functionName: "transfer",
        args: [CONTRACT_ADDRESSES.QUESTLOCK_CORE, value],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transaction rejected.";
      setErrorMsg(msg.split("\n")[0]); // first line only — wagmi errors are verbose
    } finally {
      setSubmitting(false);
    }
  }

  function applyQuick(key: (typeof QUICK)[number]["key"]) {
    if (key === "shortfall") {
      setAmount(Number(shortfall) > 0 ? shortfall : "0");
    } else {
      setAmount(key);
    }
  }

  const labelStyle = {
    color: "var(--ql-cafe)",
    fontSize: "11px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
  };

  return (
    <div
      className="rounded-[18px] p-6 mb-8"
      style={{
        background: "var(--ql-night)",
        border: "1px solid rgba(180,20,40,0.12)",
      }}
    >
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2
            className="font-sans text-lg font-semibold"
            style={{ color: "#F6F1EA" }}
          >
            Reward Pool Management
          </h2>
          <p className="text-xs mt-1" style={{ color: "var(--ql-bear)" }}>
            Top up shared reward pool — this sends QUEST from the connected
            admin wallet to QuestLockCore. It does not create per-quest escrow.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Tile label="Pool balance" value={poolBalance ?? "—"} suffix="QUEST" />
        <Tile label="Max payout if fully claimed" value={totalMaxPayout} suffix="QUEST" />
        <Tile
          label="Pool coverage"
          value={poolCoveragePct !== null ? `${poolCoveragePct}%` : "—"}
        />
        <Tile
          label="Shortfall"
          value={Number(shortfall) > 0 ? shortfall : "0"}
          suffix="QUEST"
          tone={Number(shortfall) > 0 ? "warn" : "ok"}
        />
      </div>

      <div
        className="rounded-lg p-3 mb-4 text-xs font-mono break-all"
        style={{
          background: "rgba(255,255,255,0.04)",
          color: "var(--ql-ashen)",
        }}
      >
        QuestLockCore · {CONTRACT_ADDRESSES.QUESTLOCK_CORE}
      </div>

      {/* Wrong-network bar */}
      {isWrongNetwork && (
        <div
          className="flex items-center justify-between gap-3 rounded-lg px-4 py-3 mb-4 text-sm"
          style={{ background: "#7A5A20", color: "#FFF1D6" }}
        >
          <span>Connected to chain {chainId}. Switch to Base Sepolia (84532).</span>
          <button
            onClick={() => switchChain({ chainId: EXPECTED_CHAIN_ID })}
            disabled={switching}
            className="px-3 py-1 rounded-full text-xs font-semibold disabled:opacity-60"
            style={{ background: "#FFF1D6", color: "#7A5A20" }}
          >
            {switching ? "Switching…" : "Switch network"}
          </button>
        </div>
      )}

      {/* Wrong-wallet bar */}
      {isWrongWallet && (
        <div
          className="rounded-lg px-4 py-3 mb-4 text-xs"
          style={{ background: "rgba(196,80,64,0.3)", color: "#F0DADA" }}
        >
          Connected wallet {address?.slice(0, 8)}…{address?.slice(-4)} is not
          the admin wallet. Connect{" "}
          <span className="font-mono">
            {adminWallet.slice(0, 8)}…{adminWallet.slice(-4)}
          </span>{" "}
          to top up.
        </div>
      )}

      {/* Admin balance */}
      {!isWrongWallet && isConnected && (
        <div
          className="flex items-center justify-between gap-3 rounded-lg px-4 py-2 mb-4 text-xs"
          style={{ background: "rgba(255,255,255,0.04)", color: "var(--ql-cafe)" }}
        >
          <span>Admin wallet QUEST balance</span>
          <span className="font-mono" style={{ color: "#F6F1EA" }}>
            {adminBalanceQuest ?? "…"} QUEST
          </span>
        </div>
      )}

      {/* Amount input + quick buttons */}
      <div className="mb-4">
        <label style={labelStyle}>Amount (QUEST)</label>
        <input
          type="number"
          min={0}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full mt-1 px-4 py-2.5 rounded-xl text-sm font-mono outline-none"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(180,20,40,0.18)",
            color: "#F6F1EA",
          }}
        />
        <div className="flex flex-wrap gap-2 mt-2">
          {QUICK.map((q) => (
            <button
              key={q.key}
              type="button"
              onClick={() => applyQuick(q.key)}
              disabled={q.key === "shortfall" && Number(shortfall) <= 0}
              className="px-3 py-1.5 rounded-full text-xs font-medium disabled:opacity-50"
              style={{
                background: "rgba(255,255,255,0.06)",
                color: "var(--ql-ashen)",
              }}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleTransfer}
        disabled={!decision.canSubmit}
        className="w-full py-3 rounded-full font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ background: "#B01020", color: "#F6F1EA" }}
      >
        {submitting
          ? "Awaiting wallet…"
          : waitingForReceipt
          ? "Confirming on chain…"
          : `Transfer ${amount || "0"} QUEST to QuestLockCore`}
      </button>

      {!decision.canSubmit && decision.reason && (
        <p className="text-xs mt-2" style={{ color: "var(--ql-bear)" }}>
          {topUpBlockMessage(decision.reason)}
        </p>
      )}

      {errorMsg && (
        <p className="text-xs mt-2" style={{ color: "#F0DADA" }}>
          {errorMsg}
        </p>
      )}

      {txHash && (
        <div className="text-xs mt-3" style={{ color: "var(--ql-cafe)" }}>
          {txSuccess ? "Top-up confirmed." : "Top-up submitted."}
          <a
            href={explorerTxUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 underline"
            style={{ color: "#B01020" }}
          >
            View tx →
          </a>
          {txSuccess && (
            <button
              onClick={() => resetTx()}
              className="ml-3 underline"
              style={{ color: "var(--ql-cafe)" }}
            >
              dismiss
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  suffix,
  tone,
}: {
  label: string;
  value: string;
  suffix?: string;
  tone?: "ok" | "warn";
}) {
  const valueColor =
    tone === "warn" && value !== "0" ? "#F0DADA" : "#F6F1EA";
  return (
    <div
      className="rounded-lg p-3"
      style={{ background: "rgba(255,255,255,0.04)" }}
    >
      <p
        className="text-[10px] uppercase tracking-widest mb-1"
        style={{ color: "var(--ql-cafe)" }}
      >
        {label}
      </p>
      <p className="font-mono font-semibold" style={{ color: valueColor }}>
        {value}
        {suffix && (
          <span
            className="text-xs font-normal ml-1"
            style={{ color: "var(--ql-bear)" }}
          >
            {suffix}
          </span>
        )}
      </p>
    </div>
  );
}
