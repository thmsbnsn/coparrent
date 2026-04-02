import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameLobbyCard } from "@/components/games/GameLobbyCard";

vi.mock("@/components/games/GameLobbyMemberRow", () => ({
  GameLobbyMemberRow: ({ member }: { member: { displayName: string } }) => (
    <div>{member.displayName}</div>
  ),
}));

describe("GameLobbyCard", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
  });

  it("lets the finished-session host prepare a rematch", async () => {
    const handlePrepareRematch = vi.fn();

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <MemoryRouter>
          <GameLobbyCard
            currentProfileId="profile-1"
            members={[
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
            ]}
            onJoin={vi.fn()}
            onPrepareRematch={handlePrepareRematch}
            onSetReady={vi.fn()}
            onStart={vi.fn()}
            session={{
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
            }}
          />
        </MemoryRouter>,
      );
    });

    const rematchButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Set up rematch"),
    );

    expect(rematchButton).toBeTruthy();

    await act(async () => {
      rematchButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(handlePrepareRematch).toHaveBeenCalled();
    expect(container.textContent).toContain("reset the same family-scoped room");
  });
});
