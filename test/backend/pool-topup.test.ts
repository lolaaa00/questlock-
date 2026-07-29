import { evaluateTopUp, topUpBlockMessage } from "../../lib/pool-topup";

const ADMIN = "0x1f63ea74065586af0c7c48428372d88d0a89525b";
const CHAIN = 84532;

const happyBase = {
  connectedWallet: ADMIN,
  adminWallet: ADMIN,
  chainId: CHAIN,
  expectedChainId: CHAIN,
  amountQuest: "500",
  adminBalanceQuest: "1000",
  txPending: false,
};

describe("evaluateTopUp", () => {
  test("happy path allows submit", () => {
    const d = evaluateTopUp(happyBase);
    expect(d.canSubmit).toBe(true);
    expect(d.reason).toBeNull();
  });

  test("blocks when no wallet connected", () => {
    const d = evaluateTopUp({ ...happyBase, connectedWallet: null });
    expect(d.canSubmit).toBe(false);
    expect(d.reason).toBe("not_authenticated");
  });

  test("blocks when wrong wallet is connected (case-insensitive)", () => {
    const d = evaluateTopUp({
      ...happyBase,
      connectedWallet: "0x0000000000000000000000000000000000000001",
    });
    expect(d.canSubmit).toBe(false);
    expect(d.reason).toBe("wrong_wallet");
  });

  test("admin wallet comparison is case-insensitive both ways", () => {
    const d = evaluateTopUp({
      ...happyBase,
      connectedWallet: ADMIN.toUpperCase(),
    });
    expect(d.canSubmit).toBe(true);
  });

  test("blocks on wrong network", () => {
    const d = evaluateTopUp({ ...happyBase, chainId: 1 });
    expect(d.canSubmit).toBe(false);
    expect(d.reason).toBe("wrong_network");
  });

  test("blocks on zero or negative amount", () => {
    expect(evaluateTopUp({ ...happyBase, amountQuest: "0" }).reason).toBe(
      "invalid_amount"
    );
    expect(evaluateTopUp({ ...happyBase, amountQuest: "-5" }).reason).toBe(
      "invalid_amount"
    );
  });

  test("blocks on non-numeric amount", () => {
    const d = evaluateTopUp({ ...happyBase, amountQuest: "abc" });
    expect(d.canSubmit).toBe(false);
    expect(d.reason).toBe("invalid_amount");
  });

  test("blocks when admin balance is below amount", () => {
    const d = evaluateTopUp({
      ...happyBase,
      amountQuest: "1500",
      adminBalanceQuest: "1000",
    });
    expect(d.canSubmit).toBe(false);
    expect(d.reason).toBe("insufficient_balance");
  });

  test("allows when balance has not loaded yet (null)", () => {
    // We optimistically allow; the on-chain call will revert if truly low.
    // This avoids a stuck UI while balance is being fetched.
    const d = evaluateTopUp({ ...happyBase, adminBalanceQuest: null });
    expect(d.canSubmit).toBe(true);
  });

  test("tx_pending blocks everything else", () => {
    const d = evaluateTopUp({ ...happyBase, txPending: true });
    expect(d.canSubmit).toBe(false);
    expect(d.reason).toBe("tx_pending");
  });

  test("spec example: 250 QUEST top-up against 1000 balance is allowed", () => {
    const d = evaluateTopUp({
      ...happyBase,
      amountQuest: "250",
      adminBalanceQuest: "1000",
    });
    expect(d.canSubmit).toBe(true);
  });
});

describe("topUpBlockMessage", () => {
  test("returns user-readable copy for every reason", () => {
    expect(topUpBlockMessage("not_authenticated")).toMatch(/Connect/);
    expect(topUpBlockMessage("wrong_wallet")).toMatch(/admin/);
    expect(topUpBlockMessage("wrong_network")).toMatch(/Base Sepolia/);
    expect(topUpBlockMessage("invalid_amount")).toMatch(/positive/i);
    expect(topUpBlockMessage("insufficient_balance")).toMatch(/QUEST/);
    expect(topUpBlockMessage("tx_pending")).toMatch(/pending/i);
    expect(topUpBlockMessage(null)).toBe("");
  });
});
