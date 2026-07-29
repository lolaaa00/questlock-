// Quest-request lifecycle state transitions. The actual onchain publish is
// not exercised here (that lives in publishQuestOnchain and is integration-
// tested manually); we cover the status machine because it is the most
// error-prone part of the admin flow.

type Status =
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "PUBLISHING"
  | "PUBLISHED"
  | "PUBLISH_FAILED";

interface QR {
  status: Status;
}

function canApprove(qr: QR): boolean {
  return qr.status === "PENDING_REVIEW";
}
function canReject(qr: QR): boolean {
  return !["PUBLISHED", "REJECTED"].includes(qr.status);
}
function canPublish(qr: QR): boolean {
  return qr.status === "APPROVED" || qr.status === "PUBLISH_FAILED";
}

describe("quest-request lifecycle", () => {
  test("admin can approve only from PENDING_REVIEW", () => {
    expect(canApprove({ status: "PENDING_REVIEW" })).toBe(true);
    expect(canApprove({ status: "APPROVED" })).toBe(false);
    expect(canApprove({ status: "REJECTED" })).toBe(false);
    expect(canApprove({ status: "PUBLISHING" })).toBe(false);
    expect(canApprove({ status: "PUBLISHED" })).toBe(false);
    expect(canApprove({ status: "PUBLISH_FAILED" })).toBe(false);
  });

  test("admin can reject from any pre-published, non-rejected state", () => {
    expect(canReject({ status: "PENDING_REVIEW" })).toBe(true);
    expect(canReject({ status: "APPROVED" })).toBe(true);
    expect(canReject({ status: "PUBLISHING" })).toBe(true);
    expect(canReject({ status: "PUBLISH_FAILED" })).toBe(true);
    expect(canReject({ status: "REJECTED" })).toBe(false);
    expect(canReject({ status: "PUBLISHED" })).toBe(false);
  });

  test("publish allowed from APPROVED and PUBLISH_FAILED (retry) only", () => {
    expect(canPublish({ status: "APPROVED" })).toBe(true);
    expect(canPublish({ status: "PUBLISH_FAILED" })).toBe(true);
    expect(canPublish({ status: "PENDING_REVIEW" })).toBe(false);
    expect(canPublish({ status: "PUBLISHING" })).toBe(false);
    expect(canPublish({ status: "PUBLISHED" })).toBe(false);
    expect(canPublish({ status: "REJECTED" })).toBe(false);
  });

  test("approve → publish → published is the happy path", () => {
    const qr: QR = { status: "PENDING_REVIEW" };
    expect(canApprove(qr)).toBe(true);
    qr.status = "APPROVED";
    expect(canPublish(qr)).toBe(true);
    qr.status = "PUBLISHING";
    // While publishing, no further admin action should fire.
    expect(canApprove(qr)).toBe(false);
    expect(canPublish(qr)).toBe(false);
    qr.status = "PUBLISHED";
    expect(canApprove(qr)).toBe(false);
    expect(canReject(qr)).toBe(false);
  });

  test("publish failure can be retried", () => {
    const qr: QR = { status: "PUBLISH_FAILED" };
    expect(canPublish(qr)).toBe(true);
    // and is still rejectable so admin can cancel a stuck request
    expect(canReject(qr)).toBe(true);
  });
});
