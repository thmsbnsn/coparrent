import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFamily } from "@/contexts/FamilyContext";
import { useChildAccount } from "@/hooks/useChildAccount";
import { useFamilyPresence } from "@/hooks/useFamilyPresence";
import { useFamilyRole } from "@/hooks/useFamilyRole";
import { useGameSessions } from "@/hooks/useGameSessions";
import GameDashboard from "@/pages/GameDashboard";

vi.mock("@/contexts/FamilyContext", () => ({
  useFamily: vi.fn(),
}));

vi.mock("@/hooks/useChildAccount", () => ({
  useChildAccount: vi.fn(),
}));

vi.mock("@/hooks/useFamilyRole", () => ({
  useFamilyRole: vi.fn(),
}));

vi.mock("@/hooks/useFamilyPresence", () => ({
  useFamilyPresence: vi.fn(),
}));

vi.mock("@/hooks/useGameSessions", () => ({
  useGameSessions: vi.fn(),
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
const mockedUseFamilyRole = vi.mocked(useFamilyRole);
const mockedUseChildAccount = vi.mocked(useChildAccount);
const mockedUseFamilyPresence = vi.mocked(useFamilyPresence);
const mockedUseGameSessions = vi.mocked(useGameSessions);

describe("GameDashboard", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const renderPage = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <MemoryRouter>
          <GameDashboard />
        </MemoryRouter>,
      );
    });

    return container;
  };

  beforeEach(() => {
    mockedUseFamily.mockReturnValue({
      activeFamily: { display_name: "Morgan Family", id: "family-1" },
      activeFamilyId: "family-1",
      loading: false,
      profileId: "profile-1",
    } as never);

    mockedUseChildAccount.mockReturnValue({
      allowed_game_slugs: ["flappy-plane"],
      games_enabled: true,
      isChildAccount: false,
      loading: false,
      multiplayer_enabled: true,
      scopeError: null,
    } as never);

    mockedUseFamilyRole.mockReturnValue({
      activeFamilyId: "family-1",
      isLawOffice: false,
      isParent: true,
      isThirdParty: false,
      profileId: "profile-1",
    } as never);

    mockedUseFamilyPresence.mockReturnValue({
      activeCount: 2,
      loading: false,
      members: [
        {
          avatarUrl: "https://example.com/alice.png",
          displayName: "Alice Parent",
          gameDisplayName: "Toy Plane Dash",
          gameSlug: "flappy-plane",
          lastSeenAt: "2026-04-01T12:00:00.000Z",
          locationType: "game",
          membershipId: "membership-1",
          presenceStatus: "active",
          profileId: "profile-1",
          relationshipLabel: "parent",
          role: "parent",
        },
        {
          avatarUrl: null,
          displayName: "Milo Pilot",
          gameDisplayName: null,
          gameSlug: null,
          lastSeenAt: "2026-04-01T12:01:00.000Z",
          locationType: "dashboard",
          membershipId: "membership-2",
          presenceStatus: "active",
          profileId: "profile-2",
          relationshipLabel: "child",
          role: "child",
        },
      ],
      refresh: vi.fn(),
      scopeError: null,
    });

    mockedUseGameSessions.mockReturnValue({
      ensureSession: vi.fn().mockResolvedValue("session-1"),
      loading: false,
      openSession: {
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
        startedAt: null,
        status: "waiting",
        updatedAt: "2026-04-01T13:02:00.000Z",
      },
      refresh: vi.fn(),
      scopeError: null,
      sessions: [],
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

  it("renders the dedicated shared games dashboard with Toy Plane Dash entry", async () => {
    const rendered = await renderPage();

    expect(rendered.textContent).toContain("family arcade");
    expect(rendered.textContent).toContain("Toy Plane Dash");
    expect(rendered.textContent).toContain("Family lobby");
    expect(rendered.textContent).toContain("Host: Alice Parent");
    expect(rendered.textContent).toContain("Family Raceway");
    expect(rendered.textContent).toContain("Star Hopper");
    expect(rendered.textContent).toContain("Pirate Harbor");
    expect(rendered.textContent).toContain("parent-header-call-action");

    const playLink = Array.from(rendered.querySelectorAll("a")).find(
      (anchor) => anchor.textContent?.includes("Open Toy Plane Dash lobby"),
    );

    expect(playLink?.getAttribute("href")).toBe("/dashboard/games/flappy-plane/lobby");

    const launchLinks = Array.from(rendered.querySelectorAll("a")).filter(
      (anchor) => anchor.textContent?.includes("Join lobby"),
    );

    expect(launchLinks.length).toBeGreaterThan(0);
    expect(launchLinks[0]?.getAttribute("href")).toBe("/dashboard/games/flappy-plane/lobby");
    expect(rendered.textContent).toContain("Solo preview");
  });

  it("fails closed with an explicit error when active family scope is missing", async () => {
    mockedUseFamily.mockReturnValue({
      activeFamily: null,
      activeFamilyId: null,
      loading: false,
      profileId: "profile-1",
    } as never);

    const rendered = await renderPage();

    expect(rendered.textContent).toContain("Family scope required");
    expect(rendered.textContent).toContain("active family");
  });

  it("shows a restriction message for child accounts when games are disabled", async () => {
    mockedUseChildAccount.mockReturnValue({
      allowed_game_slugs: [],
      games_enabled: false,
      isChildAccount: true,
      loading: false,
      multiplayer_enabled: false,
      scopeError: null,
    } as never);

    const rendered = await renderPage();

    expect(rendered.textContent).toContain("Games are unavailable for this child account right now");
  });

  it("falls back to solo preview when family lobbies are not available on the current server", async () => {
    mockedUseGameSessions.mockReturnValue({
      ensureSession: vi.fn().mockResolvedValue(null),
      loading: false,
      openSession: null,
      refresh: vi.fn(),
      scopeError:
        "Shared family lobbies are still being enabled on this server. Solo preview is available while we finish the update.",
      sessions: [],
    } as never);

    const rendered = await renderPage();

    expect(rendered.textContent).toContain("Shared family lobbies are still being enabled on this server");

    const previewLinks = Array.from(rendered.querySelectorAll("a")).filter(
      (anchor) => anchor.getAttribute("href") === "/dashboard/games/flappy-plane",
    );

    expect(previewLinks.length).toBeGreaterThan(0);
  });
});
