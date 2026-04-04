import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFamily } from "@/contexts/FamilyContext";
import { useChildAccount } from "@/hooks/useChildAccount";
import { useGameChallenges } from "@/hooks/useGameChallenges";
import { useFamilyRole } from "@/hooks/useFamilyRole";
import GameChallengePage from "@/pages/GameChallengePage";

vi.mock("@/contexts/FamilyContext", () => ({
  useFamily: vi.fn(),
}));

vi.mock("@/hooks/useChildAccount", () => ({
  useChildAccount: vi.fn(),
}));

vi.mock("@/hooks/useGameChallenges", () => ({
  useGameChallenges: vi.fn(),
}));

vi.mock("@/hooks/useFamilyRole", () => ({
  useFamilyRole: vi.fn(),
}));

vi.mock("@/components/dashboard/DashboardLayout", () => ({
  DashboardLayout: ({ children, headerActions }: { children?: ReactNode; headerActions?: ReactNode }) => (
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
const mockedUseGameChallenges = vi.mocked(useGameChallenges);
const mockedUseFamilyRole = vi.mocked(useFamilyRole);

describe("GameChallengePage", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const renderPage = async (initialEntry = "/dashboard/games/flappy-plane/challenges") => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/dashboard/games/:gameSlug/challenges" element={<GameChallengePage />} />
          </Routes>
        </MemoryRouter>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    return container;
  };

  beforeEach(() => {
    mockedUseFamily.mockReturnValue({
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
    } as never);

    mockedUseGameChallenges.mockReturnValue({
      acceptChallenge: vi.fn().mockResolvedValue(true),
      challenge: {
        completedAt: null,
        createdAt: "2026-04-02T18:00:00.000Z",
        createdByDisplayName: "Alice Parent",
        createdByProfileId: "profile-1",
        expiresAt: null,
        familyId: "family-1",
        gameDisplayName: "Toy Plane Dash",
        gameSlug: "flappy-plane",
        id: "challenge-1",
        leadingProfileId: "profile-1",
        participantCount: 2,
        resultCount: 1,
        status: "active",
        updatedAt: "2026-04-02T18:05:00.000Z",
      },
      closeChallenge: vi.fn().mockResolvedValue(true),
      createChallenge: vi.fn().mockResolvedValue("challenge-1"),
      currentParticipant: {
        acceptedAt: "2026-04-02T18:00:00.000Z",
        avatarUrl: "https://example.com/alice.png",
        displayName: "Alice Parent",
        hasResult: true,
        profileId: "profile-1",
        relationshipLabel: "parent",
        role: "parent",
      },
      currentResult: {
        avatarUrl: "https://example.com/alice.png",
        displayName: "Alice Parent",
        distance: 420,
        isLeader: true,
        profileId: "profile-1",
        relationshipLabel: "parent",
        role: "parent",
        score: 7,
        submittedAt: "2026-04-02T18:04:00.000Z",
      },
      leaderboard: [
        {
          avatarUrl: "https://example.com/alice.png",
          displayName: "Alice Parent",
          distance: 420,
          isLeader: true,
          profileId: "profile-1",
          relationshipLabel: "parent",
          role: "parent",
          score: 7,
          submittedAt: "2026-04-02T18:04:00.000Z",
        },
      ],
      loading: false,
      participants: [
        {
          acceptedAt: "2026-04-02T18:00:00.000Z",
          avatarUrl: "https://example.com/alice.png",
          displayName: "Alice Parent",
          hasResult: true,
          profileId: "profile-1",
          relationshipLabel: "parent",
          role: "parent",
        },
      ],
      refresh: vi.fn(),
      scopeError: null,
      submitResult: vi.fn(),
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

  it("renders the shared family challenge board for Toy Plane Dash", async () => {
    const rendered = await renderPage();

    expect(rendered.textContent).toContain("Toy Plane Dash challenge board");
    expect(rendered.textContent).toContain("Beat the current family lead");
    expect(rendered.textContent).toContain("Alice Parent");
    expect(rendered.textContent).toContain("Play to beat score");
    expect(rendered.textContent).toContain("parent-header-call-action");
  });

  it("fails closed with an explicit family-scope error when active family scope is missing", async () => {
    mockedUseFamily.mockReturnValue({
      activeFamilyId: null,
      loading: false,
      profileId: "profile-1",
    } as never);

    const rendered = await renderPage();

    expect(rendered.textContent).toContain("Family scope required");
    expect(rendered.textContent).toContain("active family");
  });

  it("shows the multiplayer restriction for child accounts when challenge mode is disabled", async () => {
    mockedUseChildAccount.mockReturnValue({
      allowed_game_slugs: ["flappy-plane"],
      games_enabled: true,
      isChildAccount: true,
      loading: false,
      multiplayer_enabled: false,
      scopeError: null,
    } as never);

    const rendered = await renderPage();

    expect(rendered.textContent).toContain("Challenge unavailable");
    expect(rendered.textContent).toContain("enable multiplayer");
  });
});
