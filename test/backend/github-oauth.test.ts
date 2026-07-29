import { buildState, verifyState } from "../../lib/github-oauth";

describe("github-oauth state", () => {
  const ORIGINAL = { ...process.env };

  beforeAll(() => {
    process.env.INDEXER_SECRET = "test-secret-for-hmac";
  });

  afterAll(() => {
    process.env = { ...ORIGINAL };
  });

  test("roundtrip succeeds for the same secret", () => {
    const state = buildState("0xabc");
    const decoded = verifyState(state);
    expect(decoded).not.toBeNull();
    expect(decoded?.wallet).toBe("0xabc");
  });

  test("verification fails on tampered body", () => {
    const state = buildState("0xabc");
    const [body, sig] = state.split(".");
    const tampered = body.slice(0, -1) + (body.slice(-1) === "a" ? "b" : "a");
    expect(verifyState(`${tampered}.${sig}`)).toBeNull();
  });

  test("verification fails on tampered signature", () => {
    const state = buildState("0xabc");
    const [body] = state.split(".");
    expect(verifyState(`${body}.zzzz`)).toBeNull();
  });

  test("verification fails on bad format", () => {
    expect(verifyState("not-a-state")).toBeNull();
    expect(verifyState("")).toBeNull();
  });

  test("verification fails when secret changes", () => {
    const state = buildState("0xabc");
    process.env.INDEXER_SECRET = "different-secret";
    expect(verifyState(state)).toBeNull();
    process.env.INDEXER_SECRET = "test-secret-for-hmac";
  });
});
