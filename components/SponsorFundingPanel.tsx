"use client";

// Wallet-signed funding panel for V2 sponsor-funded quests. Same pattern as
// v1.1.4 RewardPoolTopUp — the QUEST transfer is signed by the connected
// sponsor wallet via wagmi. No backend private key involvement.

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

const TOKEN_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);

const V2_ABI = parseAbi([
  "function fundQuest(uint256 questId, uint256 amount) external",
  "function topUpQuest(uint256 questId, uint256 amount) external",
  "function withdrawUnusedQuestFunds(uint256 questId, uint256 amount) external",
  "function closeQuest(uint256 questId) external",
]);

const CHAIN_ID = 84532;

interface QuestFunding {
  id: string;
  title: string;
  contract_version: number;
  funded_quest_id: string | null;
  reward_amount: string;
  max_claims: number;
  required_funding: string | null;
  funded_amount: string | null;
  claimed_amount_onchain: string | null;
  withdrawn_amount: string | null;
  funding_status: string;
  sponsor_wallet: string | null;
  deadline: string;
}

export default function SponsorFundingPanel({ questId }: { questId: string }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const [quest, setQuest] = useState<QuestFunding | null>(null);
  const [amount, setAmount] = useState<string>("0");
  const [mode, setMode] = useState<"fund" | "withdraw">("fund");
  const [step, setStep] = useState<"idle" | "approving" | "funding" | "withdrawing" | "closing">("idle");
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const r = await fetch(`/api/quests/${questId}/funding`);
    if (r.ok) setQuest(await r.json());
  }
  useEffect(() => { reload(); }, [questId]);

  // Token reads
  const sponsorBalance = useReadContract({
    address: CONTRACT_ADDRESSES.QUEST_REWARD_TOKEN, abi: TOKEN_ABI,
    functionName: "balanceOf", args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const allowance = useReadContract({
    address: CONTRACT_ADDRESSES.QUEST_REWARD_TOKEN, abi: TOKEN_ABI,
    functionName: "allowance",
    args: address && CONTRACT_ADDRESSES.QUESTLOCK_CORE_V2
      ? [address, CONTRACT_ADDRESSES.QUESTLOCK_CORE_V2] : undefined,
    query: { enabled: Boolean(address && CONTRACT_ADDRESSES.QUESTLOCK_CORE_V2) },
  });

  const { writeContractAsync, data: txHash, reset } = useWriteContract();
  const { isLoading: waiting, isSuccess: confirmed } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (confirmed) {
      reload();
      fetch(`/api/quests/${questId}/funding`, { method: "POST" }).then(reload);
      setStep("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmed]);

  if (!quest) return <p className="text-sm" style={{ color: "var(--ql-bear)" }}>Loading…</p>;
  if (quest.contract_version !== 2) {
    return (
      <div className="rounded-[18px] p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <p className="text-sm" style={{ color: "var(--ql-bear)" }}>
          This is a legacy shared-pool quest. Per-quest funding is only available
          for v1.2 sponsor-funded quests.
        </p>
      </div>
    );
  }

  const isSponsor = isConnected && address?.toLowerCase() === quest.sponsor_wallet?.toLowerCase();
  const wrongNetwork = isConnected && chainId !== CHAIN_ID;
  const fundedQid = quest.funded_quest_id ? BigInt(quest.funded_quest_id) : null;
  const requiredWei = BigInt(quest.required_funding || "0");
  const fundedWei = BigInt(quest.funded_amount || "0");
  const claimedWei = BigInt(quest.claimed_amount_onchain || "0");
  const withdrawnWei = BigInt(quest.withdrawn_amount || "0");
  const remainingWei = fundedWei - claimedWei - withdrawnWei;
  const shortfallWei = requiredWei > fundedWei ? requiredWei - fundedWei : 0n;

  const fmt = (w: bigint) => formatUnits(w, 18);

  const sponsorBal = sponsorBalance.data ? formatUnits(sponsorBalance.data as bigint, 18) : "—";
  const allowanceWei = (allowance.data as bigint | undefined) ?? 0n;

  const expired = Date.now() > new Date(quest.deadline).getTime();
  const closed = quest.funding_status === "CLOSED";
  const canWithdraw = isSponsor && (expired || closed) && remainingWei > 0n;

  async function approve() {
    if (!address || !CONTRACT_ADDRESSES.QUESTLOCK_CORE_V2) return;
    setError(null);
    setStep("approving");
    try {
      await writeContractAsync({
        address: CONTRACT_ADDRESSES.QUEST_REWARD_TOKEN, abi: TOKEN_ABI,
        functionName: "approve",
        args: [CONTRACT_ADDRESSES.QUESTLOCK_CORE_V2, parseUnits(amount, 18)],
      });
    } catch (e) { setError((e as Error).message.split("\n")[0]); setStep("idle"); }
  }

  async function fund() {
    if (!fundedQid || !CONTRACT_ADDRESSES.QUESTLOCK_CORE_V2 || !quest) return;
    setError(null);
    setStep("funding");
    try {
      const amt = parseUnits(amount, 18);
      const isTopUp = quest.funding_status === "FUNDED";
      await writeContractAsync({
        address: CONTRACT_ADDRESSES.QUESTLOCK_CORE_V2, abi: V2_ABI,
        functionName: isTopUp ? "topUpQuest" : "fundQuest",
        args: [fundedQid, amt],
      });
    } catch (e) { setError((e as Error).message.split("\n")[0]); setStep("idle"); }
  }

  async function withdraw() {
    if (!fundedQid || !CONTRACT_ADDRESSES.QUESTLOCK_CORE_V2) return;
    setError(null);
    setStep("withdrawing");
    try {
      await writeContractAsync({
        address: CONTRACT_ADDRESSES.QUESTLOCK_CORE_V2, abi: V2_ABI,
        functionName: "withdrawUnusedQuestFunds",
        args: [fundedQid, parseUnits(amount, 18)],
      });
    } catch (e) { setError((e as Error).message.split("\n")[0]); setStep("idle"); }
  }

  async function close() {
    if (!fundedQid || !CONTRACT_ADDRESSES.QUESTLOCK_CORE_V2) return;
    if (!confirm("Close this quest? After closing, unused funds are withdrawable.")) return;
    setError(null);
    setStep("closing");
    try {
      await writeContractAsync({
        address: CONTRACT_ADDRESSES.QUESTLOCK_CORE_V2, abi: V2_ABI,
        functionName: "closeQuest", args: [fundedQid],
      });
    } catch (e) { setError((e as Error).message.split("\n")[0]); setStep("idle"); }
  }

  const amountWei = (() => { try { return parseUnits(amount || "0", 18); } catch { return 0n; } })();
  const needsApprove = mode === "fund" && amountWei > 0n && allowanceWei < amountWei;
  const busy = step !== "idle" || waiting;

  return (
    <div className="rounded-[18px] p-6"
      style={{ background: "var(--ql-night)", border: "1px solid rgba(180,20,40,0.12)" }}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="font-sans text-lg font-semibold" style={{ color: "#F6F1EA" }}>
            Sponsor Funding
          </h2>
          <p className="text-xs mt-1" style={{ color: "var(--ql-bear)" }}>
            Per-quest funded pool on QuestLockCoreV2. Your signature, your gas.
          </p>
        </div>
        <span className="text-xs font-semibold uppercase px-3 py-1 rounded-full"
          style={
            quest.funding_status === "FUNDED" ? { background: "rgba(122,158,111,0.35)", color: "#F6F1EA" } :
            quest.funding_status === "UNDERFUNDED" ? { background: "rgba(196,80,64,0.3)", color: "#F0DADA" } :
            quest.funding_status === "CLOSED" || quest.funding_status === "REFUNDED" ? { background: "#3a3a3a", color: "var(--ql-cafe)" } :
            { background: "#7A5A20", color: "#FFF1D6" }
          }>
          {quest.funding_status.replace("_", " ")}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          ["Required", fmt(requiredWei)],
          ["Funded", fmt(fundedWei)],
          ["Claimed", fmt(claimedWei)],
          ["Remaining", fmt(remainingWei)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.04)" }}>
            <p className="text-[10px] uppercase tracking-widest" style={{ color: "var(--ql-cafe)" }}>{label}</p>
            <p className="font-mono font-semibold text-sm" style={{ color: "#F6F1EA" }}>{value} QUEST</p>
          </div>
        ))}
      </div>

      {shortfallWei > 0n && (
        <div className="rounded-lg px-4 py-3 mb-4 text-xs" style={{ background: "rgba(196,80,64,0.1)", color: "#F0DADA" }}>
          Shortfall to reach full funding: <span className="font-mono font-semibold">{fmt(shortfallWei)} QUEST</span>
        </div>
      )}

      {!isConnected && (
        <p className="text-xs mb-4" style={{ color: "var(--ql-cafe)" }}>Connect wallet to fund or manage.</p>
      )}
      {wrongNetwork && (
        <div className="rounded-lg px-4 py-3 mb-4 text-sm flex items-center justify-between gap-3"
          style={{ background: "#7A5A20", color: "#FFF1D6" }}>
          <span>Switch to Base Sepolia.</span>
          <button onClick={() => switchChain({ chainId: CHAIN_ID })}
            className="px-3 py-1 rounded-full text-xs font-semibold"
            style={{ background: "#FFF1D6", color: "#7A5A20" }}>Switch network</button>
        </div>
      )}
      {isConnected && !isSponsor && (
        <p className="text-xs mb-4" style={{ color: "var(--ql-cafe)" }}>
          Connected wallet is not the sponsor. Anyone can fund a quest; only the sponsor or admin can withdraw or close.
        </p>
      )}

      {/* Mode toggle */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setMode("fund")}
          className="px-3 py-1.5 rounded-full text-xs font-semibold"
          style={mode === "fund"
            ? { background: "#B01020", color: "#F6F1EA" }
            : { background: "rgba(255,255,255,0.06)", color: "var(--ql-cafe)" }}>
          Fund / top up
        </button>
        {canWithdraw && (
          <button onClick={() => setMode("withdraw")}
            className="px-3 py-1.5 rounded-full text-xs font-semibold"
            style={mode === "withdraw"
              ? { background: "#B01020", color: "#F6F1EA" }
              : { background: "rgba(255,255,255,0.06)", color: "var(--ql-cafe)" }}>
            Withdraw unused
          </button>
        )}
      </div>

      <label className="text-[11px] uppercase tracking-widest" style={{ color: "var(--ql-cafe)" }}>
        Amount (QUEST)
      </label>
      <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)}
        className="w-full mt-1 px-4 py-2.5 rounded-xl text-sm font-mono outline-none"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(180,20,40,0.18)", color: "#F6F1EA" }} />

      {isConnected && (
        <p className="text-xs mt-2" style={{ color: "var(--ql-cafe)" }}>
          Your QUEST balance: <span className="font-mono" style={{ color: "#F6F1EA" }}>{sponsorBal}</span>
        </p>
      )}

      <div className="flex flex-wrap gap-3 mt-4">
        {mode === "fund" && needsApprove && (
          <button onClick={approve} disabled={busy || wrongNetwork || !isConnected}
            className="flex-1 py-3 rounded-full font-semibold text-sm disabled:opacity-60"
            style={{ background: "rgba(255,255,255,0.08)", color: "#F6F1EA" }}>
            {step === "approving" || waiting ? "Approving…" : `Approve ${amount} QUEST`}
          </button>
        )}
        {mode === "fund" && !needsApprove && (
          <button onClick={fund} disabled={busy || wrongNetwork || !isConnected || amountWei === 0n}
            className="flex-1 py-3 rounded-full font-semibold text-sm disabled:opacity-60"
            style={{ background: "#B01020", color: "#F6F1EA" }}>
            {step === "funding" || waiting ? "Funding…" : `Fund ${amount} QUEST`}
          </button>
        )}
        {mode === "withdraw" && canWithdraw && (
          <button onClick={withdraw} disabled={busy || wrongNetwork}
            className="flex-1 py-3 rounded-full font-semibold text-sm disabled:opacity-60"
            style={{ background: "#B01020", color: "#F6F1EA" }}>
            {step === "withdrawing" || waiting ? "Withdrawing…" : `Withdraw ${amount} QUEST`}
          </button>
        )}
        {isSponsor && quest.funding_status !== "CLOSED" && quest.funding_status !== "REFUNDED" && (
          <button onClick={close} disabled={busy}
            className="px-4 py-3 rounded-full font-semibold text-sm disabled:opacity-60"
            style={{ background: "rgba(255,255,255,0.06)", color: "#F0DADA" }}>
            Close quest
          </button>
        )}
      </div>

      {error && <p className="text-xs mt-3" style={{ color: "#F0DADA" }}>{error}</p>}
      {txHash && (
        <div className="text-xs mt-3" style={{ color: "var(--ql-cafe)" }}>
          {confirmed ? "Confirmed." : "Submitted."}{" "}
          <a href={explorerTxUrl(txHash)} target="_blank" rel="noopener noreferrer"
            className="underline ml-1" style={{ color: "#B01020" }}>View tx →</a>
          {confirmed && <button onClick={() => reset()} className="underline ml-2" style={{ color: "var(--ql-cafe)" }}>dismiss</button>}
        </div>
      )}
    </div>
  );
}
