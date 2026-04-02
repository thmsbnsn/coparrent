import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/contexts/AuthContext";
import { useFamily } from "@/contexts/FamilyContext";
import { useChildAccount } from "@/hooks/useChildAccount";
import { useGameLobby } from "@/hooks/useGameLobby";
import { useKidPortalAccess } from "@/hooks/useKidPortalAccess";
import { usePresenceHeartbeat } from "@/hooks/usePresenceHeartbeat";
import GameFlappyPage from "@/pages/GameFlappyPage";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/contexts/FamilyContext", () => ({
  useFamily: vi.fn(),
}));

vi.mock("@/hooks/useChildAccount", () => ({
  useChildAccount: vi.fn(),
}));

vi.mock("@/hooks/useGameLobby", () => ({
  useGameLobby: vi.fn(),
}));

vi.mock("@/hooks/useKidPortalAccess", () => ({
  useKidPortalAccess: vi.fn(),
}));

vi.mock("@/hooks/usePresenceHeartbeat", () => ({
  usePresenceHeartbeat: vi.fn(),
}));

vi.mock("@/components/dashboard/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
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
  FlappyPlaneGame: (props: Record<string, unknown>) => (
    <div>
      <div>flappy-plane-game</div>
      <div data-testid="flappy-auto-start">{String(props.autoStartSignal ?? "")}</div>
      <div data-testid="flappy-seed">{String(props.seed ?? "")}</div>
      <div data-testid="flappy-manual-start">{String(props.manualStartEnabled)}</div>
    </div>
  ),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseFamily = vi.mocked(useFamily);
const mockedUseChildAccount = vi.mocked(useChildAccount);
const mockedUseGameLobby = vi.mocked(useGameLobby);
const mockedUseKidPortalAccess = vi.mocked(useKidPortalAccess);
const mockedUsePresenceHeartbeat = vi.mocked(usePresenceHeartbeat);

const LocationDisplay = () => {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
};

describe("GameFlappyPage", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const renderPage = async (initialEntry = "/dashboard/games/flappy-plane") => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={[initialEntry]}>
          <LocationDisplay />
          <Routes>
            <Route path="/kids/portal" element={<div>kids-portal-page</div>} />
            <Route path="/login" element={<div>login-page</div>} />
            <Route path="/dashboard/games/flappy-plane/lobby/:sessionId" element={<div>lobby-page</div>} />
            <Route path="/dashboard/games/flappy-plane" element={<GameFlappyPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });

    return container;
  };

  beforeEach(() => {
    mockedUseAuth.mockReturnValue({
      loading: false,
      user: { id: "user-1" },
    } as never);

    mockedUseFamily.mockReturnValue({
      profileId: "profile-1",
    } as never);

    mockedUseChildAccount.mockReturnValue({
      allowed_game_slugs: ["flappy-plane"],
      child_name: null,
      games_enabled: true,
      isChildAccount: false,
      loading: false,
      multiplayer_enabled: true,
      portal_mode: null,
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

    mockedUseGameLobby.mockReturnValue({
      currentMember: null,
      currentResult: null,
      isCreator: false,
      isJoined: false,
      joinLobby: vi.fn(),
      loading: false,
      lobby: null,
      members: [],
      prepareRematch: vi.fn().mockResolvedValue(true),
      refresh: vi.fn(),
      reportResult: vi.fn().mockResolvedValue(true),
      results: [],
      scopeError: null,
      session: null,
      setReady: vi.fn(),
      startSession: vi.fn(),
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
    vi.useRealTimers();
    container?.remove();
    container = null;
    root = null;
    vi.clearAllMocks();
  });

  it("renders the shared flappy page for adults and wires shared game presence", async () => {
    const rendered = await renderPage();

    expect(rendered.textContent).toContain("Toy Plane Dash");
    expect(rendered.textContent).toContain("flappy-plane-game");
    expect(rendered.querySelector('[data-testid="flappy-manual-start"]')?.textContent).toBe("true");
    expect(mockedUsePresenceHeartbeat).toHaveBeenCalledWith({
      enabled: true,
      gameDisplayName: "Toy Plane Dash",
      gameSlug: "flappy-plane",
      locationType: "game",
    });
  });

  it("uses the shared session seed and lobby-mode presence before the synchronized race starts", async () => {
    vi.useFakeTimers();
    mockedUseGameLobby.mockReturnValue({
      currentMember: null,
      currentResult: null,
      isCreator: false,
      isJoined: false,
      joinLobby: vi.fn(),
      loading: false,
      lobby: null,
      members: [],
      prepareRematch: vi.fn().mockResolvedValue(true),
      refresh: vi.fn(),
      reportResult: vi.fn().mockResolvedValue(true),
      results: [],
      scopeError: null,
      session: {
        createdAt: "2026-04-01T13:00:00.000Z",
        createdByDisplayName: "Alice Parent",
        createdByProfileId: "profile-1",
        endedAt: null,
        familyId: "family-1",
        gameDisplayName: "Toy Plane Dash",
        gameSlug: "flappy-plane",
        id: "session-1",
        maxPlayers: 4,
        memberCount: 2,
        readyCount: 2,
        seed: 48271,
        startedAt: "2026-04-01T13:02:57.000Z",
        startTime: new Date(Date.now() + 2_000).toISOString(),
        status: "active",
        updatedAt: "2026-04-01T13:02:57.000Z",
        winnerProfileId: null,
      },
      setReady: vi.fn(),
      startSession: vi.fn(),
    } as never);

    const rendered = await renderPage("/dashboard/games/flappy-plane?sessionId=session-1");

    expect(rendered.querySelector('[data-testid="flappy-seed"]')?.textContent).toBe("48271");
    expect(rendered.querySelector('[data-testid="flappy-manual-start"]')?.textContent).toBe("false");
    expect(rendered.querySelector('[data-testid="flappy-auto-start"]')?.textContent).toBe("0");
    expect(mockedUsePresenceHeartbeat).toHaveBeenCalledWith({
      enabled: true,
      gameDisplayName: "Toy Plane Dash",
      gameSlug: "flappy-plane",
      locationType: "lobby",
    });

    await act(async () => {
      vi.advanceTimersByTime(2_200);
    });

    expect(rendered.querySelector('[data-testid="flappy-auto-start"]')?.textContent).toBe("1");
    vi.useRealTimers();
  });

  it("returns finished session hosts to the lobby rematch flow", async () => {
    const prepareRematch = vi.fn().mockResolvedValue(true);

    mockedUseGameLobby.mockReturnValue({
      currentMember: null,
      currentResult: {
        avatarUrl: "https://example.com/alice.png",
        displayName: "Alice Parent",
        distance: 512,
        isWinner: true,
        profileId: "profile-1",
        reportedAt: "2026-04-01T13:04:30.000Z",
        score: 8,
      },
      isCreator: true,
      isJoined: true,
      joinLobby: vi.fn(),
      loading: false,
      lobby: null,
      members: [],
      prepareRematch,
      refresh: vi.fn(),
      reportResult: vi.fn().mockResolvedValue(true),
      results: [
        {
          avatarUrl: "https://example.com/alice.png",
          displayName: "Alice Parent",
          distance: 512,
          isWinner: true,
          profileId: "profile-1",
          reportedAt: "2026-04-01T13:04:30.000Z",
          score: 8,
        },
      ],
      scopeError: null,
      session: {
        createdAt: "2026-04-01T13:00:00.000Z",
        createdByDisplayName: "Alice Parent",
        createdByProfileId: "profile-1",
        endedAt: "2026-04-01T13:05:00.000Z",
        familyId: "family-1",
        gameDisplayName: "Toy Plane Dash",
        gameSlug: "flappy-plane",
        id: "session-1",
        maxPlayers: 4,
        memberCount: 2,
        readyCount: 0,
        seed: 48271,
        startedAt: "2026-04-01T13:02:57.000Z",
        startTime: "2026-04-01T13:03:00.000Z",
        status: "finished",
        updatedAt: "2026-04-01T13:05:00.000Z",
        winnerProfileId: "profile-1",
      },
      setReady: vi.fn(),
      startSession: vi.fn(),
    } as never);

    const rendered = await renderPage("/dashboard/games/flappy-plane?sessionId=session-1");

    const rematchButton = Array.from(rendered.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Set up rematch"),
    );

    await act(async () => {
      rematchButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(prepareRematch).toHaveBeenCalled();
    expect(rendered.querySelector('[data-testid="location"]')?.textContent).toBe(
      "/dashboard/games/flappy-plane/lobby/session-1",
    );
  });

  it("redirects waiting synchronized sessions back to the lobby instead of staying on the race page", async () => {
    mockedUseGameLobby.mockReturnValue({
      currentMember: null,
      currentResult: null,
      isCreator: false,
      isJoined: true,
      joinLobby: vi.fn(),
      loading: false,
      lobby: null,
      members: [],
      prepareRematch: vi.fn().mockResolvedValue(true),
      refresh: vi.fn(),
      reportResult: vi.fn().mockResolvedValue(true),
      results: [],
      scopeError: null,
      session: {
        createdAt: "2026-04-01T13:00:00.000Z",
        createdByDisplayName: "Alice Parent",
        createdByProfileId: "profile-1",
        endedAt: null,
        familyId: "family-1",
        gameDisplayName: "Toy Plane Dash",
        gameSlug: "flappy-plane",
        id: "session-1",
        maxPlayers: 4,
        memberCount: 2,
        readyCount: 1,
        seed: 48271,
        startedAt: null,
        startTime: null,
        status: "waiting",
        updatedAt: "2026-04-01T13:02:57.000Z",
        winnerProfileId: null,
      },
      setReady: vi.fn(),
      startSession: vi.fn(),
    } as never);

    const rendered = await renderPage("/dashboard/games/flappy-plane?sessionId=session-1");

    expect(rendered.querySelector('[data-testid="location"]')?.textContent).toBe(
      "/dashboard/games/flappy-plane/lobby/session-1",
    );
  });

  it("keeps under-6 child accounts behind the approval gate", async () => {
    mockedUseChildAccount.mockReturnValue({
      allowed_game_slugs: ["flappy-plane"],
      child_name: "Milo",
      games_enabled: true,
      isChildAccount: true,
      loading: false,
      multiplayer_enabled: true,
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

  it("shows an explicit family scope error instead of guessing", async () => {
    mockedUseChildAccount.mockReturnValue({
      allowed_game_slugs: ["flappy-plane"],
      child_name: "Milo",
      games_enabled: true,
      isChildAccount: true,
      loading: false,
      multiplayer_enabled: true,
      portal_mode: "age_6_to_12",
      scopeError: "An active family is required before loading child account permissions.",
    } as never);

    const rendered = await renderPage();

    expect(rendered.textContent).toContain("Family scope required");
    expect(rendered.textContent).toContain("active family");
  });

  it("blocks child access when Toy Plane Dash is not enabled for that child", async () => {
    mockedUseChildAccount.mockReturnValue({
      allowed_game_slugs: [],
      child_name: "Milo",
      games_enabled: false,
      isChildAccount: true,
      loading: false,
      multiplayer_enabled: false,
      portal_mode: "age_6_to_12",
      scopeError: null,
    } as never);

    const rendered = await renderPage();

    expect(rendered.textContent).toContain("Game unavailable");
    expect(rendered.textContent).toContain("enable Toy Plane Dash");
  });
});
