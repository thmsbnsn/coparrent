import { describe, expect, it } from "vitest";
import { parseInviteLink } from "@/lib/inviteLinks";

describe("parseInviteLink", () => {
  it("extracts token and type from a full invite url", () => {
    expect(
      parseInviteLink("https://www.coparrent.com/accept-invite?token=invite-token-123456&type=third_party"),
    ).toEqual({
      token: "invite-token-123456",
      type: "third_party",
    });
  });

  it("extracts a raw token", () => {
    expect(parseInviteLink("invite-token-123456")).toEqual({
      token: "invite-token-123456",
      type: null,
    });
  });

  it("supports pasted query strings", () => {
    expect(parseInviteLink("?token=invite-token-123456&type=co_parent")).toEqual({
      token: "invite-token-123456",
      type: "co_parent",
    });
  });

  it("returns null for invalid input", () => {
    expect(parseInviteLink("Jessica Benson")).toBeNull();
  });
});
