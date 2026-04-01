import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FamilySwitcher } from "@/components/family/FamilySwitcher";
import { useFamily } from "@/contexts/FamilyContext";

vi.mock("@/contexts/FamilyContext", () => ({
  useFamily: vi.fn(),
}));

const mockedUseFamily = vi.mocked(useFamily);

describe("FamilySwitcher", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    mockedUseFamily.mockReturnValue({
      memberships: [],
      activeFamily: null,
      activeFamilyId: null,
      setActiveFamilyId: vi.fn(),
      loading: false,
    } as never);
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

  const renderSwitcher = () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <MemoryRouter>
          <FamilySwitcher />
        </MemoryRouter>,
      );
    });

    return container;
  };

  it("shows a family-first label and connect action when only one family exists", () => {
    mockedUseFamily.mockReturnValue({
      memberships: [
        {
          accessKind: "family_member",
          familyId: "family-1",
          familyName: "Jessica Benson",
          role: "parent",
        },
      ],
      activeFamily: { id: "family-1", display_name: "Jessica Benson" },
      activeFamilyId: "family-1",
      setActiveFamilyId: vi.fn(),
      loading: false,
    } as never);

    const rendered = renderSwitcher();

    expect(rendered.textContent).toContain("Family 1");
    expect(rendered.textContent).toContain("Jessica Benson");
    expect(rendered.textContent).toContain("Edit family label");
    expect(rendered.textContent).toContain("Add New or Connect with Another");
  });

  it("uses family-first labels for multiple memberships", () => {
    mockedUseFamily.mockReturnValue({
      memberships: [
        {
          accessKind: "family_member",
          familyId: "family-1",
          familyName: "Jessica Benson",
          role: "parent",
        },
        {
          accessKind: "family_member",
          familyId: "family-2",
          familyName: "Morgan Carter",
          role: "parent",
        },
      ],
      activeFamily: { id: "family-2", display_name: "Morgan Carter" },
      activeFamilyId: "family-2",
      setActiveFamilyId: vi.fn(),
      loading: false,
    } as never);

    const rendered = renderSwitcher();

    expect(rendered.textContent).toContain("Family 2");
    expect(rendered.textContent).toContain("Switch between family workspaces.");
    expect(rendered.textContent).toContain("Edit family label");
    expect(rendered.textContent).not.toContain("Morgan Carter · Parent");
  });

  it("hides the edit action for non-managing roles", () => {
    mockedUseFamily.mockReturnValue({
      memberships: [
        {
          accessKind: "family_member",
          familyId: "family-1",
          familyName: "Jessica Benson",
          role: "third_party",
        },
      ],
      activeFamily: { id: "family-1", display_name: "Jessica Benson" },
      activeFamilyId: "family-1",
      setActiveFamilyId: vi.fn(),
      loading: false,
      refresh: vi.fn(),
    } as never);

    const rendered = renderSwitcher();

    expect(rendered.textContent).not.toContain("Edit family label");
    expect(rendered.textContent).not.toContain("Add New or Connect with Another");
  });

  it("labels explicit law office assignments without management actions", () => {
    mockedUseFamily.mockReturnValue({
      memberships: [
        {
          accessKind: "law_office",
          familyId: "family-1",
          familyName: null,
          role: null,
        },
      ],
      activeFamily: { id: "family-1", display_name: null },
      activeFamilyId: "family-1",
      setActiveFamilyId: vi.fn(),
      loading: false,
      refresh: vi.fn(),
    } as never);

    const rendered = renderSwitcher();

    expect(rendered.textContent).toContain("Law Office Access");
    expect(rendered.textContent).not.toContain("Edit family label");
    expect(rendered.textContent).not.toContain("Add New or Connect with Another");
  });
});
