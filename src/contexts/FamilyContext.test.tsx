import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FamilyProvider, useFamily } from "@/contexts/FamilyContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  ensureCurrentUserFamilyMembership,
  hasPendingInviteToken,
} from "@/lib/familyMembership";

const from = vi.hoisted(() => vi.fn());
const profileMaybeSingle = vi.hoisted(() => vi.fn());
const familyMembersEq = vi.hoisted(() => vi.fn());
const familiesIn = vi.hoisted(() => vi.fn());
const lawOfficeAccessIs = vi.hoisted(() => vi.fn());
const mockedEnsureFamilyMembership = vi.hoisted(() => vi.fn());
const mockedHasPendingInviteToken = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from,
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/familyMembership", () => ({
  ensureCurrentUserFamilyMembership: mockedEnsureFamilyMembership,
  hasPendingInviteToken: mockedHasPendingInviteToken,
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedEnsureFamily = vi.mocked(ensureCurrentUserFamilyMembership);
const mockedHasPendingInvite = vi.mocked(hasPendingInviteToken);

const defaultUser = {
  id: "user-1",
  email: "taylor@example.com",
};

const defaultProfile = {
  id: "profile-1",
  account_role: "parent",
  full_name: "Taylor Parent",
};

const membershipRows = [
  {
    family_id: "family-1",
    primary_parent_id: "primary-parent-1",
    relationship_label: "Parent",
    role: "parent",
    status: "active",
  },
  {
    family_id: "family-2",
    primary_parent_id: "primary-parent-2",
    relationship_label: "Aunt",
    role: "third_party",
    status: "active",
  },
];

const familyRows = [
  { id: "family-1", display_name: "Alpha Family" },
  { id: "family-2", display_name: "Beta Family" },
];

const lawOfficeAccessRows = [
  {
    created_at: "2026-04-01T08:00:00.000Z",
    family_id: "family-1",
    revoked_at: null,
  },
];

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const FamilyConsumer = () => {
  const {
    activeFamilyId,
    activeFamily,
    effectiveRole,
    loading,
    memberships,
    setActiveFamilyId,
  } = useFamily();

  if (loading) {
    return <div>loading</div>;
  }

  return (
    <div>
      <div>active:{activeFamilyId ?? "none"}</div>
      <div>name:{activeFamily?.display_name ?? "none"}</div>
      <div>role:{effectiveRole ?? "none"}</div>
      <div>memberships:{memberships.length}</div>
      <button onClick={() => setActiveFamilyId("family-2")}>switch-family-2</button>
      <button onClick={() => setActiveFamilyId("family-999")}>switch-invalid</button>
    </div>
  );
};

describe("FamilyProvider", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const renderFamilyProvider = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <FamilyProvider>
          <FamilyConsumer />
        </FamilyProvider>,
      );
      await flushPromises();
    });

    return container;
  };

  beforeEach(() => {
    mockedUseAuth.mockReturnValue({
      user: defaultUser,
      loading: false,
    } as never);

    mockedEnsureFamily.mockReset();
    mockedEnsureFamily.mockResolvedValue({
      familyId: "family-1",
      role: "parent",
      created: false,
    });

    mockedHasPendingInvite.mockReset();
    mockedHasPendingInvite.mockReturnValue(false);

    profileMaybeSingle.mockReset();
    profileMaybeSingle.mockResolvedValue({
      data: defaultProfile,
      error: null,
    });

    familyMembersEq.mockReset();
    familyMembersEq.mockResolvedValue({
      data: membershipRows,
      error: null,
    });

    familiesIn.mockReset();
    familiesIn.mockResolvedValue({
      data: familyRows,
      error: null,
    });

    lawOfficeAccessIs.mockReset();
    lawOfficeAccessIs.mockResolvedValue({
      data: lawOfficeAccessRows,
      error: null,
    });

    from.mockReset();
    from.mockImplementation((tableName: string) => {
      if (tableName === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: profileMaybeSingle,
            }),
          }),
        };
      }

      if (tableName === "family_members") {
        return {
          select: () => ({
            eq: familyMembersEq,
          }),
        };
      }

      if (tableName === "families") {
        return {
          select: () => ({
            in: familiesIn,
          }),
        };
      }

      if (tableName === "law_office_family_access") {
        return {
          select: () => ({
            is: () => ({
              order: lawOfficeAccessIs,
            }),
          }),
        };
      }

      throw new Error(`Unexpected table access: ${tableName}`);
    });

    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
    vi.clearAllMocks();
  });

  it("uses the persisted active family when it still exists", async () => {
    localStorage.setItem("coparrent.activeFamily.user-1", "family-2");

    const rendered = await renderFamilyProvider();

    expect(rendered.textContent).toContain("active:family-2");
    expect(rendered.textContent).toContain("name:Beta Family");
    expect(rendered.textContent).toContain("role:third_party");
  });

  it("falls back to the first membership when the persisted family no longer exists", async () => {
    localStorage.setItem("coparrent.activeFamily.user-1", "family-999");

    const rendered = await renderFamilyProvider();

    expect(rendered.textContent).toContain("active:family-1");
    expect(rendered.textContent).toContain("name:Alpha Family");
    expect(localStorage.getItem("coparrent.activeFamily.user-1")).toBe("family-1");
  });

  it("bootstraps a family membership when eligible parents have none", async () => {
    familyMembersEq
      .mockResolvedValueOnce({
        data: [],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [membershipRows[0]],
        error: null,
      });
    familiesIn.mockResolvedValue({
      data: [familyRows[0]],
      error: null,
    });

    const rendered = await renderFamilyProvider();

    expect(mockedEnsureFamily).toHaveBeenCalledWith("Taylor Parent");
    expect(rendered.textContent).toContain("active:family-1");
    expect(rendered.textContent).toContain("memberships:1");
  });

  it("does not bootstrap a family while an invite handoff is pending", async () => {
    familyMembersEq.mockResolvedValue({
      data: [],
      error: null,
    });
    familiesIn.mockResolvedValue({
      data: [],
      error: null,
    });
    mockedHasPendingInvite.mockReturnValue(true);

    const rendered = await renderFamilyProvider();

    expect(mockedEnsureFamily).not.toHaveBeenCalled();
    expect(rendered.textContent).toContain("active:none");
    expect(rendered.textContent).toContain("memberships:0");
  });

  it("loads explicit law office family assignments without bootstrapping a parent family", async () => {
    profileMaybeSingle.mockResolvedValue({
      data: {
        ...defaultProfile,
        account_role: "law_office",
      },
      error: null,
    });

    const rendered = await renderFamilyProvider();

    expect(mockedEnsureFamily).not.toHaveBeenCalled();
    expect(rendered.textContent).toContain("active:family-1");
    expect(rendered.textContent).toContain("name:none");
    expect(rendered.textContent).toContain("role:none");
    expect(rendered.textContent).toContain("memberships:1");
  });

  it("switches only to memberships that belong to the user", async () => {
    const rendered = await renderFamilyProvider();
    const [switchValidButton, switchInvalidButton] = Array.from(
      rendered.querySelectorAll("button"),
    );

    await act(async () => {
      switchValidButton?.click();
      await flushPromises();
    });

    expect(rendered.textContent).toContain("active:family-2");
    expect(localStorage.getItem("coparrent.activeFamily.user-1")).toBe("family-2");

    await act(async () => {
      switchInvalidButton?.click();
      await flushPromises();
    });

    expect(rendered.textContent).toContain("active:family-2");
    expect(localStorage.getItem("coparrent.activeFamily.user-1")).toBe("family-2");
  });
});
