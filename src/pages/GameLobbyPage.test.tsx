import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/contexts/AuthContext";
import { useFamily } from "@/contexts/FamilyContext";
import { useChildAccount } from "@/hooks/useChildAccount";
import { useGameLobby } from "@/hooks/useGameLobby";
import { useGameSessions } from "@/hooks/useGameSessions";
import { useKidPortalAccess } from "@/hooks/useKidPortalAccess";
import { usePresenceHeartbeat } from "@/hooks/usePresenceHeartbeat";
import GameLobbyPage from "@/pages/GameLobbyPage";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/contexts/FamilyContext", () => ({
  useFamily: vi.fn(),
}));

vi.mock("@/hooks/useChildAccount", () => ({
  useChildAccount: vi.fn(),
}));

vi.mock("@/hooks/useGameSessions", () => ({
  useGameSessions: vi.fn(),
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

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseFamily = vi.mocked(useFamily);
const mockedUseChildAccount = vi.mocked(useChildAccount);
const mockedUseGameLobby = vi.mocked(useGameLobby);
const mockedUseGameSessions = vi.mocked(useGameSessions);
const mockedUseKidPortalAccess = vi.mocked(useKidPortalAccess);
const mockedUsePresenceHeartbeat = vi.mocked(usePresenceHeartbeat);
let ensureSessionMock: ReturnType<typeof vi.fn>;

const LocationDisplay = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
};

describe("GameLobbyPage", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const renderPage = async (
    initialEntry = "/dashboard/games/flappy-plane/lobby/session-1",
  ) => {
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
            <Route path="/dashboard/games/flappy-plane" element={<div>game-page</div>} />
            <Route path="/dashboard/games/flappy-plane/lobby" element={<GameLobbyPage />} />
            <Route
              path="/dashboard/games/flappy-plane/lobby/:sessionId"
              element={<GameLobbyPage />}
            />
          </Routes>
        </MemoryRouter>,
      );
    });

    return container;
  };

  beforeEach(() => {
    ensureSessionMock = vi.fn().mockResolvedValue("session-1");

    mockedUseAuth.mockReturnValue({
      loading: false,
      user: { id: "user-1" },
    } as never);

    mockedUseFamily.mockReturnValue({
      profileId: "profile-1",
    } as never);

    mockedUseChildAccount.mockReturnValue({
      allowed_game_slugs: ["flappy-plane"],
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
      scopeError: null,
    } as never);

    mockedUseGameSessions.mockReturnValue({
      ensureSession: ensureSessionMock,
      loading: false,
      openSession: null,
      refresh: vi.fn(),
      scopeError: null,
      sessions: [],
    } as never);

    mockedUseGameLobby.mockImplementation(
      ((options: { gameSlug: string; sessionId: string | null }) => ({
        currentMember: options.sessionId
          ? {
              avatarUrl: "https://example.com/alice.png",
              displayName: "Alice Parent",
              isCreator: true,
              joinedAt: "2026-04-01T13:00:00.000Z",
              profileId: "profile-1",
              readyAt: "2026-04-01T13:01:00.000Z",
              relationshipLabel: "parent",
              role: "parent",
              seatOrder: 1,
              status: "ready",
            }
          : null,
        currentResult: null,
        isCreator: Boolean(options.sessionId),
        isJoined: Boolean(options.sessionId),
        joinLobby: vi.fn().mockResolvedValue(true),
        loading: false,
        lobby: options.sessionId
          ? {
              members: [],
              results: [],
              session: {},
            }
          : null,
        members: options.sessionId
          ? [
              {
                avatarUrl: "https://example.com/alice.png",
                displayName: "Alice Parent",
                isCreator: true,
                joinedAt: "2026-04-01T13:00:00.000Z",
                profileId: "profile-1",
                readyAt: "2026-04-01T13:01:00.000Z",
                relationshipLabel: "parent",
                role: "parent",
                seatOrder: 1,
                status: "ready",
              },
              {
                avatarUrl: null,
                displayName: "Milo Pilot",
                isCreator: false,
                joinedAt: "2026-04-01T13:02:00.000Z",
                profileId: "profile-2",
                readyAt: null,
                relationshipLabel: "child",
                role: "child",
                seatOrder: 2,
                status: "joined",
              },
            ]
          : [],
        prepareRematch: vi.fn().mockResolvedValue(true),
        refresh: vi.fn(),
        reportResult: vi.fn().mockResolvedValue(true),
        results: [],
        scopeError: null,
        session: options.sessionId
          ? {
              createdAt: "2026-04-01T13:00:00.000Z",
              createdByDisplayName: "Alice Parent",
              createdByProfileId: "profile-1",
              endedAt: null,
              familyId: "family-1",
              gameDisplayName: "Toy Plane Dash",
              gameSlug: "flappy-plane",
              id: options.sessionId,
              maxPlayers: 4,
              memberCount: 2,
              readyCount: 1,
              seed: 48271,
              startedAt: null,
              startTime: null,
              status: "waiting",
              updatedAt: "2026-04-01T13:03:00.000Z",
              winnerProfileId: null,
            }
          : null,
        setReady: vi.fn().mockResolvedValue(true),
        startSession: vi.fn().mockResolvedValue(true),
      })) as never,
    );

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

  it("routes the lobby launcher entry into a resolved family-scoped session", async () => {
    const rendered = await renderPage("/dashboard/games/flappy-plane/lobby");

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(rendered.querySelector('[data-testid="location"]')?.textContent).toBe(
      "/dashboard/games/flappy-plane/lobby/session-1",
    );
    expect(ensureSessionMock).toHaveBeenCalled();
  });

  it("renders the Toy Plane Dash lobby and wires lobby presence", async () => {
    const rendered = await renderPage();

    expect(rendered.textContent).toContain("Gather the family before takeoff");
    expect(rendered.textContent).toContain("Alice Parent");
    expect(rendered.textContent).toContain("Milo Pilot");
    expect(rendered.textContent).toContain("Not ready");
    expect(rendered.textContent).toContain("Host");
    expect(mockedUsePresenceHeartbeat).toHaveBeenCalledWith({
      enabled: true,
      gameDisplayName: "Toy Plane Dash",
      gameSlug: "flappy-plane",
      locationType: "lobby",
    });
  });

  it("moves joined players into the shared race page once the session becomes active", async () => {
    mockedUseGameLobby.mockReturnValue({
      currentMember: {
        avatarUrl: "https://example.com/alice.png",
        displayName: "Alice Parent",
        isCreator: true,
        joinedAt: "2026-04-01T13:00:00.000Z",
        profileId: "profile-1",
        readyAt: "2026-04-01T13:01:00.000Z",
        relationshipLabel: "parent",
        role: "parent",
        seatOrder: 1,
        status: "ready",
      },
      currentResult: null,
      isCreator: true,
      isJoined: true,
      joinLobby: vi.fn().mockResolvedValue(true),
      loading: false,
      lobby: {
        members: [],
        results: [],
        session: {},
      },
      members: [
        {
          avatarUrl: "https://example.com/alice.png",
          displayName: "Alice Parent",
          isCreator: true,
          joinedAt: "2026-04-01T13:00:00.000Z",
          profileId: "profile-1",
          readyAt: "2026-04-01T13:01:00.000Z",
          relationshipLabel: "parent",
          role: "parent",
          seatOrder: 1,
          status: "ready",
        },
      ],
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
        startTime: "2026-04-01T13:03:00.000Z",
        status: "active",
        updatedAt: "2026-04-01T13:02:57.000Z",
        winnerProfileId: null,
      },
      setReady: vi.fn().mockResolvedValue(true),
      startSession: vi.fn().mockResolvedValue(true),
    } as never);

    const rendered = await renderPage();

    expect(rendered.querySelector('[data-testid="location"]')?.textContent).toBe(
      "/dashboard/games/flappy-plane",
    );
  });

  it("keeps under-6 child accounts behind the approval gate", async () => {
    mockedUseChildAccount.mockReturnValue({
      allowed_game_slugs: ["flappy-plane"],
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
      scopeError: null,
    } as never);

    const rendered = await renderPage();

    expect(rendered.textContent).toContain("kids-portal-page");
  });

  it("shows an explicit family scope error instead of guessing", async () => {
    mockedUseGameSessions.mockReturnValue({
      ensureSession: vi.fn().mockResolvedValue(null),
      loading: false,
      openSession: null,
      refresh: vi.fn(),
      scopeError: "An active family is required before opening a game lobby.",
      sessions: [],
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
      prepareRematch: vi.fn(),
      refresh: vi.fn(),
      reportResult: vi.fn(),
      results: [],
      scopeError: null,
      session: null,
      setReady: vi.fn(),
      startSession: vi.fn(),
    } as never);

    const rendered = await renderPage();

    expect(rendered.textContent).toContain("Family scope required");
    expect(rendered.textContent).toContain("active family");
  });

  it("shows the multiplayer restriction for child accounts when family lobbies are disabled", async () => {
    mockedUseChildAccount.mockReturnValue({
      allowed_game_slugs: ["flappy-plane"],
      games_enabled: true,
      isChildAccount: true,
      loading: false,
      multiplayer_enabled: false,
      portal_mode: "age_6_to_12",
      scopeError: null,
    } as never);

    const rendered = await renderPage();

    expect(rendered.textContent).toContain("Multiplayer unavailable");
    expect(rendered.textContent).toContain("enable multiplayer");
  });

  it("shows finished-lobby rematch guidance for the host", async () => {
    mockedUseGameLobby.mockReturnValue({
      currentMember: {
        avatarUrl: "https://example.com/alice.png",
        displayName: "Alice Parent",
        isCreator: true,
        joinedAt: "2026-04-01T13:00:00.000Z",
        profileId: "profile-1",
        readyAt: "2026-04-01T13:01:00.000Z",
        relationshipLabel: "parent",
        role: "parent",
        seatOrder: 1,
        status: "ready",
      },
      currentResult: null,
      isCreator: true,
      isJoined: true,
      joinLobby: vi.fn().mockResolvedValue(true),
      loading: false,
      lobby: {
        members: [],
        results: [],
        session: {},
      },
      members: [
        {
          avatarUrl: "https://example.com/alice.png",
          displayName: "Alice Parent",
          isCreator: true,
          joinedAt: "2026-04-01T13:00:00.000Z",
          profileId: "profile-1",
          readyAt: "2026-04-01T13:01:00.000Z",
          relationshipLabel: "parent",
          role: "parent",
          seatOrder: 1,
          status: "ready",
        },
      ],
      prepareRematch: vi.fn().mockResolvedValue(true),
      refresh: vi.fn(),
      reportResult: vi.fn().mockResolvedValue(true),
      results: [],
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
      setReady: vi.fn().mockResolvedValue(true),
      startSession: vi.fn().mockResolvedValue(true),
    } as never);

    const rendered = await renderPage();
    expect(rendered.textContent).toContain("Set up rematch");
    expect(rendered.textContent).toContain("reset the same family-scoped room");
  });
});
