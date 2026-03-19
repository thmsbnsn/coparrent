import { describe, expect, it } from "vitest";
import { getInvitationViewStatus, hasInviteEmailMismatch } from "@/lib/invitations";

describe("invitations", () => {
  it("marks accepted invitations as accepted immediately", () => {
    expect(
      getInvitationViewStatus({
        status: "accepted",
        expiresAt: "2099-01-01T00:00:00.000Z",
      }),
    ).toBe("accepted");
  });

  it("marks expired invitations by status or expiry timestamp", () => {
    expect(
      getInvitationViewStatus({
        status: "expired",
        expiresAt: "2099-01-01T00:00:00.000Z",
      }),
    ).toBe("expired");

    expect(
      getInvitationViewStatus(
        {
          status: "pending",
          expiresAt: "2026-03-18T00:00:00.000Z",
        },
        new Date("2026-03-19T00:00:00.000Z"),
      ),
    ).toBe("expired");
  });

  it("keeps live invitations valid and invalidates malformed ones", () => {
    expect(
      getInvitationViewStatus(
        {
          status: "pending",
          expiresAt: "2026-03-20T00:00:00.000Z",
        },
        new Date("2026-03-19T00:00:00.000Z"),
      ),
    ).toBe("valid");

    expect(getInvitationViewStatus(null)).toBe("invalid");
    expect(getInvitationViewStatus({ status: "pending", expiresAt: null })).toBe("invalid");
  });

  it("compares invite email addresses case-insensitively", () => {
    expect(hasInviteEmailMismatch("Parent@example.com", "parent@example.com")).toBe(false);
    expect(hasInviteEmailMismatch("first@example.com", "second@example.com")).toBe(true);
    expect(hasInviteEmailMismatch("first@example.com", undefined)).toBe(false);
  });
});
