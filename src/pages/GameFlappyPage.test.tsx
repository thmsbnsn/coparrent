import { act, useEffect, useRef, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/contexts/AuthContext";
import { useFamily } from "@/contexts/FamilyContext";
import { useChildAccount } from "@/hooks/useChildAccount";
import { useGameChallenges } from "@/hooks/useGameChallenges";
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

vi.mock("@/hooks/useGameChallenges", () => ({
  useGameChallenges: vi.fn(),
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
    children?: ReactNode | ((immersiveMode: Record<string, unknown>) => ReactNode);
    description: string;
    title: string;
  }) => {
    const enterImmersiveModeRef = useRef(vi.fn().mockResolvedValue(undefined));
    const exitImmersiveModeRef = useRef(vi.fn().mockResolvedValue(undefined));
    const immersiveMode = {
      enterImmersiveMode: enterImmersiveModeRef.current,
      exitImmersiveMode: exitImmersiveModeRef.current,
      fullscreenSupported: true,
      immersiveNotice: null,
      immersiveNoticeTone: null,
      isFullscreenActive: false,
      isLandscape: false,
      landscapeSupportLabel: "Use fullscreen to request landscape on supported phones and tablets.",
      orientationLocked: false,
      orientationLockSupported: true,
    };

    (globalThis as Record<string, unknown>).__mockImmersiveMode = immersiveMode;

    return (
      <div>
        <div>{title}</div>
        <div>{description}</div>
        {typeof children === "function" ? children(immersiveMode) : children}
      </div>
    );
  },
}));

vi.mock("@/components/kids/games/FlappyPlaneGame", () => ({
  readBestFlappyScore: () => 0,
  FlappyPlaneGame: (props: Record<string, unknown>) => {
    const previousAutoStartRef = useRef(props.autoStartSignal);

    useEffect(() => {
      if ((globalThis as Record<string, unknown>).__skipFlappyArm) {
        return;
      }

      const notifyArmed = props.onRuntimeArmedChange as ((armed: boolean) => void) | undefined;
      notifyArmed?.(true);
    }, [props.onRuntimeArmedChange]);

    useEffect(() => {
      if (previousAutoStartRef.current === props.autoStartSignal) {
        return;
      }

      previousAutoStartRef.current = props.autoStartSignal;
      const notifyRoundStart = props.onRoundStart as (() => void) | undefined;
      notifyRoundStart?.();
    }, [props.autoStartSignal, props.onRoundStart]);

    (globalThis as Record<string, unknown>).__lastFlappyProps = props;

    const readyOverlay = typeof props.renderReadyOverlay === "function"
      ? (props.renderReadyOverlay as (args: {
          bestScore: number;
          manualStartEnabled: boolean;
          startRound: () => void;
          status: string;
        }) => ReactNode)({
          bestScore: 12,
          manualStartEnabled: Boolean(props.manualStartEnabled),
          startRound: () => {
            const notifyRoundStart = props.onRoundStart as (() => void) | undefined;
            notifyRoundStart?.();
          },
          status: "ready",
        })
      : null;

    return (
      <div>
        {readyOverlay}
        <div>flappy-plane-game</div>
        <div data-testid="flappy-auto-start">{String(props.autoStartSignal ?? "")}</div>
        <div data-testid="flappy-seed">{String(props.seed ?? "")}</div>
        <div data-testid="flappy-manual-start">{String(props.manualStartEnabled)}</div>
      </div>
    );
  },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseFamily = vi.mocked(useFamily);
const mockedUseChildAccount = vi.mocked(useChildAccount);
const mockedUseGameChallenges = vi.mocked(useGameChallenges);
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

    mockedUseGameChallenges.mockReturnValue({
      challenge: null,
      currentParticipant: null,
      currentResult: null,
      leaderboard: [],
      loading: false,
      participants: [],
      scopeError: null,
      submitResult: vi.fn().mockResolvedValue(null),
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
    delete (globalThis as Record<string, unknown>).__lastFlappyProps;
    delete (globalThis as Record<string, unknown>).__mockImmersiveMode;
    delete (globalThis as Record<string, unknown>).__skipFlappyArm;
  });

  it("renders the solo preflight screen and requires an explicit Start Game action", async () => {
    const rendered = await renderPage();

    expect(rendered.textContent).toContain("Toy Plane Dash");
    expect(rendered.textContent).toContain("flappy-plane-game");
    expect(rendered.textContent).toContain("Start Game");
    expect(rendered.textContent).toContain("Start in Fullscreen");
    expect(rendered.textContent).toContain("Join family lobby");
    expect(rendered.textContent).toContain("Scorecard");
    expect(rendered.querySelector('[data-testid="flappy-manual-start"]')?.textContent).toBe("true");
    expect(rendered.querySelector('[data-testid="flappy-auto-start"]')?.textContent).toBe("");
    expect(mockedUsePresenceHeartbeat).toHaveBeenCalledWith({
      enabled: true,
      gameDisplayName: "Toy Plane Dash",
      gameSlug: "flappy-plane",
      locationType: "game",
    });
  });

  it("requests fullscreen only after the solo preflight fullscreen button is tapped", async () => {
    const rendered = await renderPage();
    const immersiveMode = (globalThis as Record<string, unknown>).__mockImmersiveMode as {
      enterImmersiveMode: ReturnType<typeof vi.fn>;
    };

    expect(immersiveMode.enterImmersiveMode).not.toHaveBeenCalled();

    const startFullscreenButton = Array.from(rendered.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Start in Fullscreen"),
    );

    await act(async () => {
      startFullscreenButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(immersiveMode.enterImmersiveMode).toHaveBeenCalledTimes(1);
    expect(rendered.textContent).toContain("Flight controls");
  });

  it("waits in multiplayer preflight until the synchronized countdown arms and then starts the round", async () => {
    vi.useFakeTimers();
    mockedUseGameLobby.mockReturnValue({
      currentMember: {
        avatarUrl: null,
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
      joinLobby: vi.fn(),
      loading: false,
      lobby: null,
      members: [
        {
          avatarUrl: null,
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
          joinedAt: "2026-04-01T13:00:00.000Z",
          profileId: "profile-2",
          readyAt: "2026-04-01T13:01:00.000Z",
          relationshipLabel: "child",
          role: "child",
          seatOrder: 2,
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
    expect(rendered.textContent).toContain("Launch");
    expect(rendered.textContent).toContain("Countdown live");
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
    expect(rendered.textContent).toContain("In flight");
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

  it("shows the multiplayer preflight overlay instead of redirecting waiting sessions away from the game page", async () => {
    mockedUseGameLobby.mockReturnValue({
      currentMember: {
        avatarUrl: null,
        displayName: "Alice Parent",
        isCreator: true,
        joinedAt: "2026-04-01T13:00:00.000Z",
        profileId: "profile-1",
        readyAt: null,
        relationshipLabel: "parent",
        role: "parent",
        seatOrder: 1,
        status: "joined",
      },
      currentResult: null,
      isCreator: true,
      isJoined: true,
      joinLobby: vi.fn(),
      loading: false,
      lobby: null,
      members: [
        {
          avatarUrl: null,
          displayName: "Alice Parent",
          isCreator: true,
          joinedAt: "2026-04-01T13:00:00.000Z",
          profileId: "profile-1",
          readyAt: null,
          relationshipLabel: "parent",
          role: "parent",
          seatOrder: 1,
          status: "joined",
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
      "/dashboard/games/flappy-plane?sessionId=session-1",
    );
    expect(rendered.textContent).toContain("Family preflight");
    expect(rendered.textContent).toContain("Ready up");
    expect(rendered.textContent).toContain("Enter Fullscreen");
    expect(rendered.textContent).toContain("Back to Lobby");
  });

  it("shows an explicit sync error when the local cockpit never arms before Go", async () => {
    vi.useFakeTimers();
    (globalThis as Record<string, unknown>).__skipFlappyArm = true;

    mockedUseGameLobby.mockReturnValue({
      currentMember: {
        avatarUrl: null,
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
      joinLobby: vi.fn(),
      loading: false,
      lobby: null,
      members: [
        {
          avatarUrl: null,
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
        memberCount: 1,
        readyCount: 1,
        seed: 48271,
        startedAt: "2026-04-01T13:02:57.000Z",
        startTime: new Date(Date.now() + 1_000).toISOString(),
        status: "active",
        updatedAt: "2026-04-01T13:02:57.000Z",
        winnerProfileId: null,
      },
      setReady: vi.fn(),
      startSession: vi.fn(),
    } as never);

    const rendered = await renderPage("/dashboard/games/flappy-plane?sessionId=session-1");

    await act(async () => {
      vi.advanceTimersByTime(1_400);
    });

    expect(rendered.textContent).toContain("Launch sync failed closed");
    expect(rendered.textContent).toContain("Reset cockpit");
    vi.useRealTimers();
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

  it("submits async family challenge scores and shows the family leaderboard feedback", async () => {
    const submitResult = vi.fn().mockResolvedValue({
      accepted: true,
      challengeId: "challenge-1",
      distance: 455,
      leadingProfileId: "profile-2",
      profileId: "profile-1",
      score: 6,
      status: "active",
      submittedAt: "2026-04-02T18:08:00.000Z",
    });

    mockedUseGameChallenges.mockReturnValue({
      challenge: {
        completedAt: null,
        createdAt: "2026-04-02T18:00:00.000Z",
        createdByDisplayName: "Alice Parent",
        createdByProfileId: "profile-2",
        expiresAt: null,
        familyId: "family-1",
        gameDisplayName: "Toy Plane Dash",
        gameSlug: "flappy-plane",
        id: "challenge-1",
        leadingProfileId: "profile-2",
        participantCount: 2,
        resultCount: 2,
        status: "active",
        updatedAt: "2026-04-02T18:08:00.000Z",
      },
      currentParticipant: {
        acceptedAt: "2026-04-02T18:00:00.000Z",
        avatarUrl: null,
        displayName: "You",
        hasResult: true,
        profileId: "profile-1",
        relationshipLabel: "parent",
        role: "parent",
      },
      currentResult: {
        avatarUrl: null,
        displayName: "You",
        distance: 455,
        isLeader: false,
        profileId: "profile-1",
        relationshipLabel: "parent",
        role: "parent",
        score: 6,
        submittedAt: "2026-04-02T18:08:00.000Z",
      },
      leaderboard: [
        {
          avatarUrl: null,
          displayName: "Alice Parent",
          distance: 500,
          isLeader: true,
          profileId: "profile-2",
          relationshipLabel: "parent",
          role: "parent",
          score: 8,
          submittedAt: "2026-04-02T18:03:00.000Z",
        },
        {
          avatarUrl: null,
          displayName: "You",
          distance: 455,
          isLeader: false,
          profileId: "profile-1",
          relationshipLabel: "parent",
          role: "parent",
          score: 6,
          submittedAt: "2026-04-02T18:08:00.000Z",
        },
      ],
      loading: false,
      participants: [],
      scopeError: null,
      submitResult,
    } as never);

    const rendered = await renderPage("/dashboard/games/flappy-plane?challengeId=challenge-1");
    const flappyProps = (globalThis as Record<string, unknown>).__lastFlappyProps as {
      onRoundEnd?: (summary: { bestScore: number; distance: number; score: number; seed: number }) => Promise<void>;
    };

    await act(async () => {
      await flappyProps.onRoundEnd?.({
        bestScore: 6,
        distance: 455,
        score: 6,
        seed: 1,
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(submitResult).toHaveBeenCalledWith({
      distance: 455,
      score: 6,
      submittedAt: expect.any(String),
    });
    expect(rendered.textContent).toContain("You are #2");
    expect(rendered.textContent).toContain("Beat 8 to take the family lead");
    expect(rendered.textContent).toContain("Back to challenge board");
  });

  it("fails closed when both shared session and family challenge mode are requested together", async () => {
    const rendered = await renderPage(
      "/dashboard/games/flappy-plane?sessionId=session-1&challengeId=challenge-1",
    );

    expect(rendered.textContent).toContain("Family scope required");
    expect(rendered.textContent).toContain("Choose either a shared family session or a family challenge");
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
