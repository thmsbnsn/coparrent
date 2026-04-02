import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/contexts/AuthContext";
import { useChildAccount } from "@/hooks/useChildAccount";
import { usePresenceHeartbeat } from "@/hooks/usePresenceHeartbeat";
import ChildAppPage from "@/pages/ChildAppPage";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/useChildAccount", () => ({
  useChildAccount: vi.fn(),
}));

vi.mock("@/hooks/usePresenceHeartbeat", () => ({
  usePresenceHeartbeat: vi.fn(),
}));

vi.mock("@/components/pwa/ChildModeInstallCard", () => ({
  ChildModeInstallCard: () => <div>child-mode-install-card</div>,
}));

vi.mock("@/components/ui/LoadingSpinner", () => ({
  LoadingSpinner: ({ message }: { message?: string }) => <div>{message ?? "Loading..."}</div>,
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseChildAccount = vi.mocked(useChildAccount);
const mockedUsePresenceHeartbeat = vi.mocked(usePresenceHeartbeat);

describe("ChildAppPage", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const renderPage = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={["/child-app"]}>
          <Routes>
            <Route path="/child-app" element={<ChildAppPage />} />
            <Route path="/login" element={<div>login-page</div>} />
            <Route path="/dashboard/settings" element={<div>settings-page</div>} />
            <Route path="/dashboard/games" element={<div>games-page</div>} />
            <Route path="/kids" element={<div>kids-page</div>} />
          </Routes>
        </MemoryRouter>,
      );
    });

    return container;
  };

  beforeEach(() => {
    mockedUsePresenceHeartbeat.mockReturnValue({
      scopeError: null,
      updatePresence: vi.fn(),
    } as never);
    mockedUseAuth.mockReturnValue({
      loading: false,
      user: null,
    } as never);
    mockedUseChildAccount.mockReturnValue({
      allowed_game_slugs: ["flappy-plane"],
      child_name: "Milo",
      communication_enabled: true,
      games_enabled: true,
      isChildAccount: true,
      loading: false,
      multiplayer_enabled: true,
      quick_unlock_enabled: false,
      scopeError: null,
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

  it("renders the dedicated child install path for signed-out users", async () => {
    const rendered = await renderPage();

    expect(rendered.textContent).toContain("Dedicated launch path");
    expect(rendered.textContent).toContain("/child-app");
    expect(rendered.textContent).toContain("child-mode-install-card");

    const signInLink = Array.from(rendered.querySelectorAll("a")).find((anchor) =>
      anchor.textContent?.includes("Open child sign-in"),
    );
    expect(signInLink?.getAttribute("href")).toBe("/login?next=%2Fchild-app");
  });

  it("shows a parent-facing redirect surface for non-child accounts", async () => {
    mockedUseAuth.mockReturnValue({
      loading: false,
      user: { id: "user-1" },
    } as never);
    mockedUseChildAccount.mockReturnValue({
      isChildAccount: false,
      loading: false,
      scopeError: null,
    } as never);

    const rendered = await renderPage();

    expect(rendered.textContent).toContain("Child mode is ready for child accounts");
    expect(rendered.textContent).toContain("Open child access settings");
  });

  it("fails closed when a signed-in child is missing active family scope", async () => {
    mockedUseAuth.mockReturnValue({
      loading: false,
      user: { id: "user-1" },
    } as never);
    mockedUseChildAccount.mockReturnValue({
      allowed_game_slugs: [],
      child_name: "Milo",
      communication_enabled: false,
      games_enabled: false,
      isChildAccount: true,
      loading: false,
      multiplayer_enabled: false,
      quick_unlock_enabled: false,
      scopeError: "An active family is required before loading child account permissions.",
    } as never);

    const rendered = await renderPage();

    expect(rendered.textContent).toContain("Family scope required");
    expect(rendered.textContent).toContain("active family");
  });
});
