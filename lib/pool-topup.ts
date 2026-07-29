// Pure validation for the admin pool top-up flow. Kept here so the math and
// guard logic are unit-testable without wagmi/viem mocking. The browser
// component pipes the connected wallet state and admin balance through these
// checks before enabling the transfer button.

export type TopUpBlockReason =
  | "not_authenticated"
  | "wrong_wallet"
  | "wrong_network"
  | "invalid_amount"
  | "insufficient_balance"
  | "tx_pending"
  | null;

export interface TopUpInput {
  connectedWallet: string | null | undefined;
  adminWallet: string; // expected ADMIN_WALLET_ADDRESS, lowercased internally
  chainId: number | null | undefined;
  expectedChainId: number; // 84532
  amountQuest: string; // human-readable, e.g. "500"
  adminBalanceQuest: string | null; // human-readable QUEST balance, null if not loaded yet
  txPending: boolean;
}

export interface TopUpDecision {
  canSubmit: boolean;
  reason: TopUpBlockReason;
}

export function evaluateTopUp(input: TopUpInput): TopUpDecision {
  if (input.txPending) return { canSubmit: false, reason: "tx_pending" };

  if (!input.connectedWallet) {
    return { canSubmit: false, reason: "not_authenticated" };
  }
  if (
    input.connectedWallet.toLowerCase() !== input.adminWallet.toLowerCase()
  ) {
    return { canSubmit: false, reason: "wrong_wallet" };
  }
  if (input.chainId !== input.expectedChainId) {
    return { canSubmit: false, reason: "wrong_network" };
  }

  const amount = Number(input.amountQuest);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { canSubmit: false, reason: "invalid_amount" };
  }

  if (input.adminBalanceQuest !== null) {
    const balance = Number(input.adminBalanceQuest);
    if (Number.isFinite(balance) && balance < amount) {
      return { canSubmit: false, reason: "insufficient_balance" };
    }
  }

  return { canSubmit: true, reason: null };
}

export function topUpBlockMessage(reason: TopUpBlockReason): string {
  switch (reason) {
    case "not_authenticated":
      return "Connect a wallet to top up the pool.";
    case "wrong_wallet":
      return "Top-up requires the admin wallet.";
    case "wrong_network":
      return "Switch to Base Sepolia (chain 84532).";
    case "invalid_amount":
      return "Enter a positive QUEST amount.";
    case "insufficient_balance":
      return "Your admin wallet does not hold enough QUEST.";
    case "tx_pending":
      return "Transaction pending — please wait.";
    case null:
    default:
      return "";
  }
}
