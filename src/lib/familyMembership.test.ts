import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc,
  },
}));

import {
  ensureCurrentUserFamilyMembership,
  hasPendingInviteToken,
} from "@/lib/familyMembership";

describe("familyMembership", () => {
  beforeEach(() => {
    rpc.mockReset();
    sessionStorage.clear();
    localStorage.clear();
  });

  it("detects pending invite tokens in session or local storage", () => {
    expect(hasPendingInviteToken()).toBe(false);

    sessionStorage.setItem("pendingInviteToken", "session-token");
    expect(hasPendingInviteToken()).toBe(true);

    sessionStorage.clear();
    localStorage.setItem("pendingInviteToken", "local-token");
    expect(hasPendingInviteToken()).toBe(true);
  });

  it("ensures family membership and trims display names before calling the rpc", async () => {
    rpc.mockResolvedValue({
      data: {
        ok: true,
        data: {
          family_id: "family-123",
          role: "parent",
          created: true,
        },
      },
      error: null,
    });

    await expect(ensureCurrentUserFamilyMembership("  Casey Parent  ")).resolves.toEqual({
      familyId: "family-123",
      role: "parent",
      created: true,
    });

    expect(rpc).toHaveBeenCalledWith("rpc_ensure_family_membership", {
      p_display_name: "Casey Parent",
    });
  });

  it("throws the rpc error when the backend call fails", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: new Error("rpc unavailable"),
    });

    await expect(ensureCurrentUserFamilyMembership("Casey")).rejects.toThrow("rpc unavailable");
  });

  it("throws the backend message when membership bootstrap is rejected", async () => {
    rpc.mockResolvedValue({
      data: {
        ok: false,
        message: "Family setup is blocked.",
      },
      error: null,
    });

    await expect(ensureCurrentUserFamilyMembership("Casey")).rejects.toThrow(
      "Family setup is blocked.",
    );
  });
});
