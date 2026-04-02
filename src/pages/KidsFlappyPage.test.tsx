import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/contexts/AuthContext";
import { useChildAccount } from "@/hooks/useChildAccount";
import { useKidPortalAccess } from "@/hooks/useKidPortalAccess";
import { usePresenceHeartbeat } from "@/hooks/usePresenceHeartbeat";
import KidsFlappyPage from "@/pages/KidsFlappyPage";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/useChildAccount", () => ({
  useChildAccount: vi.fn(),
}));

vi.mock("@/hooks/useKidPortalAccess", () => ({
  useKidPortalAccess: vi.fn(),
}));

vi.mock("@/hooks/usePresenceHeartbeat", () => ({
  usePresenceHeartbeat: vi.fn(),
}));

vi.mock("@/components/ui/LoadingSpinner", () => ({
  LoadingSpinner: ({ message }: { message?: string }) => <div>{message ?? "Loading..."}</div>,
}));

vi.mock("@/components/kids/games/GameShell", () => ({
  GameShell: ({
    children,
    description,
    title,
  }: {
    children?: ReactNode;
    description: string;
    title: string;
  }) => (
    <div>
      <div>{title}</div>
      <div>{description}</div>
      {children}
    </div>
  ),
}));

vi.mock("@/components/kids/games/FlappyPlaneGame", () => ({
  FlappyPlaneGame: () => <div>flappy-plane-game</div>,
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseChildAccount = vi.mocked(useChildAccount);
const mockedUseKidPortalAccess = vi.mocked(useKidPortalAccess);
const mockedUsePresenceHeartbeat = vi.mocked(usePresenceHeartbeat);

const defaultUser = {
  email: "kid@example.com",
  id: "user-1",
};

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe("KidsFlappyPage", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const renderPage = async (initialEntry = "/kids/games/flappy-plane") => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/dashboard" element={<div>dashboard-page</div>} />
            <Route path="/kids/portal" element={<div>kids-portal-page</div>} />
            <Route path="/login" element={<div>login-page</div>} />
            <Route path="/kids/games/flappy-plane" element={<KidsFlappyPage />} />
          </Routes>
        </MemoryRouter>,
      );
      await flushPromises();
    });

    return container;
  };

  beforeEach(() => {
    mockedUseAuth.mockReturnValue({
      loading: false,
      user: defaultUser,
    } as never);

    mockedUseChildAccount.mockReturnValue({
      child_name: "Milo",
      isChildAccount: true,
      loading: false,
      portal_mode: "age_6_to_12",
      scopeError: null,
    } as never);

    mockedUseKidPortalAccess.mockReturnValue({
      loading: false,
      requestState: {
        dashboard_unlocked: true,
        id: null,
        requested_at: null,
        resolved_at: null,
        session_expires_at: null,
        status: "idle",
      },
    } as never);

    mockedUsePresenceHeartbeat.mockReturnValue({
      scopeError: null,
      updatePresence: vi.fn(),
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

  it("renders the child-safe flappy game page for child accounts", async () => {
    const rendered = await renderPage();

    expect(rendered.textContent).toContain("Toy Plane Dash");
    expect(rendered.textContent).toContain("flappy-plane-game");
    expect(rendered.textContent).toContain("Milo");
    expect(mockedUsePresenceHeartbeat).toHaveBeenCalledWith({
      enabled: true,
      gameDisplayName: "Toy Plane Dash",
      gameSlug: "flappy-plane",
      locationType: "game",
    });
  });

  it("redirects signed-in parent accounts back to the main dashboard", async () => {
    mockedUseChildAccount.mockReturnValue({
      child_name: null,
      isChildAccount: false,
      loading: false,
      portal_mode: null,
      scopeError: null,
    } as never);

    const rendered = await renderPage();

    expect(rendered.textContent).toContain("dashboard-page");
  });

  it("redirects under-6 accounts back to the portal until approval unlocks the dashboard", async () => {
    mockedUseChildAccount.mockReturnValue({
      child_name: "Milo",
      isChildAccount: true,
      loading: false,
      portal_mode: "under_6",
      scopeError: null,
    } as never);

    mockedUseKidPortalAccess.mockReturnValue({
      loading: false,
      requestState: {
        dashboard_unlocked: false,
        id: "request-1",
        requested_at: null,
        resolved_at: null,
        session_expires_at: null,
        status: "pending",
      },
    } as never);

    const rendered = await renderPage();

    expect(rendered.textContent).toContain("kids-portal-page");
  });

  it("shows an explicit scope error instead of guessing when child context fails closed", async () => {
    mockedUseChildAccount.mockReturnValue({
      child_name: "Milo",
      isChildAccount: true,
      loading: false,
      portal_mode: "age_6_to_12",
      scopeError: "An active family is required before loading child account permissions.",
    } as never);

    const rendered = await renderPage();

    expect(rendered.textContent).toContain("Family scope required");
    expect(rendered.textContent).toContain("active family");
  });
});
