import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameLobbyMemberRow } from "@/components/games/GameLobbyMemberRow";

vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  AvatarFallback: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  AvatarImage: ({
    alt,
    src,
  }: {
    alt?: string;
    src?: string;
  }) => <img alt={alt} src={src} />,
}));

describe("GameLobbyMemberRow", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const renderRow = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <div className="space-y-4">
          <GameLobbyMemberRow
            isCurrentUser
            member={{
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
            }}
          />
          <GameLobbyMemberRow
            member={{
              avatarUrl: null,
              displayName: "Milo Pilot",
              isCreator: false,
              joinedAt: "2026-04-01T13:00:30.000Z",
              profileId: "profile-2",
              readyAt: null,
              relationshipLabel: "child",
              role: "child",
              seatOrder: 2,
              status: "joined",
            }}
          />
        </div>,
      );
    });

    return container;
  };

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
  });

  it("renders avatar images, fallback initials, host, and ready states", async () => {
    const rendered = await renderRow();

    expect(rendered.querySelector('img[alt="Alice Parent"]')?.getAttribute("src")).toBe(
      "https://example.com/alice.png",
    );
    expect(rendered.textContent).toContain("Host");
    expect(rendered.textContent).toContain("You");
    expect(rendered.textContent).toContain("Ready");
    expect(rendered.textContent).toContain("MP");
    expect(rendered.querySelectorAll('[aria-label="ready"]')).toHaveLength(1);
    expect(rendered.querySelectorAll('[aria-label="not-ready"]')).toHaveLength(1);
  });
});
