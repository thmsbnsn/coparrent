import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFamily } from "@/contexts/FamilyContext";
import { useChildAccount } from "@/hooks/useChildAccount";
import { useFamilyRole } from "@/hooks/useFamilyRole";
import GameOverviewPage from "@/pages/GameOverviewPage";

vi.mock("@/contexts/FamilyContext", () => ({
  useFamily: vi.fn(),
}));

vi.mock("@/hooks/useChildAccount", () => ({
  useChildAccount: vi.fn(),
}));

vi.mock("@/hooks/useFamilyRole", () => ({
  useFamilyRole: vi.fn(),
}));

vi.mock("@/components/dashboard/DashboardLayout", () => ({
  DashboardLayout: ({
    children,
    headerActions,
  }: {
    children?: ReactNode;
    headerActions?: ReactNode;
  }) => (
    <div>
      <div>{headerActions}</div>
      {children}
    </div>
  ),
}));

vi.mock("@/components/calls/ParentHeaderCallAction", () => ({
  ParentHeaderCallAction: () => <div>parent-header-call-action</div>,
}));

const mockedUseFamily = vi.mocked(useFamily);
const mockedUseChildAccount = vi.mocked(useChildAccount);
const mockedUseFamilyRole = vi.mocked(useFamilyRole);

describe("GameOverviewPage", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const renderPage = async (initialEntry = "/dashboard/games/star-hopper") => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/dashboard/games/:gameSlug" element={<GameOverviewPage />} />
            <Route path="/dashboard/games/flappy-plane" element={<div>flappy-live-page</div>} />
          </Routes>
        </MemoryRouter>,
      );
    });

    return container;
  };

  beforeEach(() => {
    mockedUseFamily.mockReturnValue({
      activeFamilyId: "family-1",
      loading: false,
    } as never);

    mockedUseChildAccount.mockReturnValue({
      games_enabled: true,
      isChildAccount: false,
      loading: false,
      scopeError: null,
    } as never);

    mockedUseFamilyRole.mockReturnValue({
      activeFamilyId: "family-1",
      isLawOffice: false,
      isParent: true,
      isThirdParty: false,
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

  it("renders the shared overview for upcoming registry games", async () => {
    const rendered = await renderPage("/dashboard/games/family-raceway");

    expect(rendered.textContent).toContain("Family Raceway");
    expect(rendered.textContent).toContain("Ready to plug into the shared session foundation");
    expect(rendered.textContent).toContain("Platform route reserved");
    expect(rendered.textContent).toContain("parent-header-call-action");
  });

  it("fails closed when active family scope is missing", async () => {
    mockedUseFamily.mockReturnValue({
      activeFamilyId: null,
      loading: false,
    } as never);

    const rendered = await renderPage();

    expect(rendered.textContent).toContain("Family scope required");
    expect(rendered.textContent).toContain("active family");
  });

  it("redirects the live Toy Plane Dash slug back to the playable route", async () => {
    const rendered = await renderPage("/dashboard/games/flappy-plane");

    expect(rendered.textContent).toContain("flappy-live-page");
  });
});
