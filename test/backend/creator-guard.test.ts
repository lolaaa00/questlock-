import { checkCreatorGuard } from "../../lib/creator-guard";

describe("checkCreatorGuard", () => {
  test("normal user is not blocked", () => {
    const r = checkCreatorGuard("0xAAA", {
      created_by: "0xBBB",
      sponsor_wallet: "0xCCC",
    });
    expect(r.blocked).toBe(false);
    expect(r.reason).toBeNull();
  });

  test("creator is blocked", () => {
    const r = checkCreatorGuard("0xAAA", {
      created_by: "0xAAA",
      sponsor_wallet: null,
    });
    expect(r.blocked).toBe(true);
    expect(r.reason).toBe("creator");
  });

  test("sponsor is blocked", () => {
    const r = checkCreatorGuard("0xAAA", {
      created_by: "0xBBB",
      sponsor_wallet: "0xAAA",
    });
    expect(r.blocked).toBe(true);
    expect(r.reason).toBe("sponsor");
  });

  test("comparison is case-insensitive in both directions", () => {
    const r1 = checkCreatorGuard("0xabc", { created_by: "0xABC" });
    const r2 = checkCreatorGuard("0xABC", { created_by: "0xabc" });
    const r3 = checkCreatorGuard("0xAbCdEf", {
      created_by: null,
      sponsor_wallet: "0xaBcDeF",
    });
    expect(r1.blocked).toBe(true);
    expect(r2.blocked).toBe(true);
    expect(r3.blocked).toBe(true);
    expect(r3.reason).toBe("sponsor");
  });

  test("creator check takes precedence when both match (defensive)", () => {
    const r = checkCreatorGuard("0xaaa", {
      created_by: "0xAAA",
      sponsor_wallet: "0xAAA",
    });
    expect(r.blocked).toBe(true);
    expect(r.reason).toBe("creator");
  });

  test("empty / missing fields do not block", () => {
    expect(checkCreatorGuard("", { created_by: "0xAAA" }).blocked).toBe(false);
    expect(checkCreatorGuard("0xAAA", { created_by: null }).blocked).toBe(false);
    expect(
      checkCreatorGuard("0xAAA", { created_by: null, sponsor_wallet: null }).blocked
    ).toBe(false);
  });

  test("existing v1 sample quest with NULL sponsor_wallet still works for non-creator", () => {
    // v1 sample quest was created with created_by = admin wallet. Any other
    // wallet must still pass the guard.
    const r = checkCreatorGuard("0xUserWallet", {
      created_by: "0xAdminWallet",
      sponsor_wallet: null,
    });
    expect(r.blocked).toBe(false);
  });
});
