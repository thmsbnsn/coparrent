import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolvePostAuthPath } from "@/lib/postAuthPath";
import { ensureCurrentUserFamilyMembership } from "@/lib/familyMembership";

const profileMaybeSingle = vi.hoisted(() => vi.fn());
const parentChildrenEq = vi.hoisted(() => vi.fn());
const mockedEnsureFamilyMembership = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (tableName: string) => {
      if (tableName === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: profileMaybeSingle,
            }),
          }),
        };
      }

      if (tableName === "parent_children") {
        return {
          select: () => ({
            eq: parentChildrenEq,
          }),
        };
      }

      throw new Error(`Unexpected table access: ${tableName}`);
    },
  },
}));

vi.mock("@/lib/familyMembership", () => ({
  ensureCurrentUserFamilyMembership: mockedEnsureFamilyMembership,
}));

const mockedEnsureFamily = vi.mocked(ensureCurrentUserFamilyMembership);

describe("resolvePostAuthPath", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    mockedEnsureFamily.mockReset();
    mockedEnsureFamily.mockResolvedValue({
      created: false,
      familyId: "family-1",
      role: "parent",
    });
    profileMaybeSingle.mockReset();
    parentChildrenEq.mockReset();
  });

  it("routes law office users to the law office dashboard without bootstrapping family membership", async () => {
    profileMaybeSingle.mockResolvedValue({
      data: {
        account_role: "law_office",
        id: "profile-law-office",
      },
    });

    await expect(
      resolvePostAuthPath({
        email: "lawyer@example.com",
        id: "user-7",
        user_metadata: {},
      } as never),
    ).resolves.toBe("/law-office/dashboard");

    expect(mockedEnsureFamily).not.toHaveBeenCalled();
    expect(parentChildrenEq).not.toHaveBeenCalled();
  });

  it("routes law office signup users to the law office dashboard even before the profile row is visible", async () => {
    profileMaybeSingle.mockResolvedValue({
      data: null,
    });

    await expect(
      resolvePostAuthPath({
        email: "lawyer@example.com",
        id: "user-8",
        user_metadata: {
          account_type: "law_office",
        },
      } as never),
    ).resolves.toBe("/law-office/dashboard");

    expect(mockedEnsureFamily).not.toHaveBeenCalled();
    expect(parentChildrenEq).not.toHaveBeenCalled();
  });

  it("continues to bootstrap parent family membership before resolving the parent dashboard path", async () => {
    profileMaybeSingle.mockResolvedValue({
      data: {
        account_role: "parent",
        id: "profile-parent",
      },
    });
    parentChildrenEq.mockResolvedValue({
      count: 1,
    });

    await expect(
      resolvePostAuthPath({
        email: "parent@example.com",
        id: "user-1",
        user_metadata: {
          full_name: "Taylor Parent",
        },
      } as never),
    ).resolves.toBe("/dashboard");

    expect(mockedEnsureFamily).toHaveBeenCalledWith("Taylor Parent");
  });
});
