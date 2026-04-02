import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameSessionResultsCard } from "@/components/games/GameSessionResultsCard";

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

describe("GameSessionResultsCard", () => {
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

  it("renders winner and fallback identity rows for shared results", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <GameSessionResultsCard
          currentProfileId="profile-1"
          headline="You win"
          results={[
            {
              avatarUrl: "https://example.com/alice.png",
              displayName: "Alice Parent",
              distance: 512,
              isWinner: true,
              profileId: "profile-1",
              reportedAt: "2026-04-01T13:04:00.000Z",
              score: 8,
            },
            {
              avatarUrl: null,
              displayName: "Milo Pilot",
              distance: 412,
              isWinner: false,
              profileId: "profile-2",
              reportedAt: "2026-04-01T13:03:30.000Z",
              score: 7,
            },
          ]}
          sessionStatus="finished"
          subcopy="Final standings are locked."
        />,
      );
    });

    expect(container.querySelector('img[alt="Alice Parent"]')?.getAttribute("src")).toBe(
      "https://example.com/alice.png",
    );
    expect(container.textContent).toContain("Winner");
    expect(container.textContent).toContain("You");
    expect(container.textContent).toContain("MP");
    expect(container.textContent).toContain("Score 8");
    expect(container.textContent).toContain("Distance 512");
  });
});
