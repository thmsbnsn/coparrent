import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFamilyRole } from "@/hooks/useFamilyRole";
import { useFamily } from "@/contexts/FamilyContext";

vi.mock("@/contexts/FamilyContext", () => ({
  useFamily: vi.fn(),
}));

const mockedUseFamily = vi.mocked(useFamily);

const HookConsumer = () => {
  const { primaryParentId, activeFamilyId, role } = useFamilyRole();

  return (
    <div>
      <div>primary-parent:{primaryParentId ?? "none"}</div>
      <div>active-family:{activeFamilyId ?? "none"}</div>
      <div>role:{role ?? "none"}</div>
    </div>
  );
};

describe("useFamilyRole", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
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

  it("returns the active membership primary parent profile id instead of the family id", async () => {
    mockedUseFamily.mockReturnValue({
      effectiveRole: "parent",
      profileId: "profile-1",
      memberships: [
        {
          familyId: "family-1",
          familyName: "Alpha Family",
          role: "parent",
          relationshipLabel: "Parent",
          status: "active",
          primaryParentId: "parent-profile-1",
        },
      ],
      isParentInActiveFamily: true,
      isThirdPartyInActiveFamily: false,
      isChildInActiveFamily: false,
      relationshipLabel: "Parent",
      roleLoading: false,
      loading: false,
      activeFamilyId: "family-1",
      activeFamily: { id: "family-1", display_name: "Alpha Family" },
      setActiveFamilyId: vi.fn(),
      refresh: vi.fn(),
    });

    await act(async () => {
      root?.render(<HookConsumer />);
      await Promise.resolve();
    });

    expect(container?.textContent).toContain("primary-parent:parent-profile-1");
    expect(container?.textContent).toContain("active-family:family-1");
    expect(container?.textContent).toContain("role:parent");
  });

  it("returns null when the active family has no matching membership", async () => {
    mockedUseFamily.mockReturnValue({
      effectiveRole: null,
      profileId: "profile-1",
      memberships: [],
      isParentInActiveFamily: false,
      isThirdPartyInActiveFamily: false,
      isChildInActiveFamily: false,
      relationshipLabel: null,
      roleLoading: false,
      loading: false,
      activeFamilyId: "family-missing",
      activeFamily: null,
      setActiveFamilyId: vi.fn(),
      refresh: vi.fn(),
    });

    await act(async () => {
      root?.render(<HookConsumer />);
      await Promise.resolve();
    });

    expect(container?.textContent).toContain("primary-parent:none");
    expect(container?.textContent).toContain("active-family:family-missing");
    expect(container?.textContent).toContain("role:none");
  });
});
