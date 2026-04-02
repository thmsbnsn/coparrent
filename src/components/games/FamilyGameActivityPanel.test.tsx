import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FamilyGameActivityPanel } from "@/components/games/FamilyGameActivityPanel";
import type { FamilyPresenceMember } from "@/lib/familyPresence";

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

const members: FamilyPresenceMember[] = [
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
  {
    avatarUrl: null,
    displayName: "Jordan Guardian",
    gameDisplayName: "Toy Plane Dash",
    gameSlug: "flappy-plane",
    lastSeenAt: "2026-04-01T12:02:00.000Z",
    locationType: "lobby",
    membershipId: "membership-3",
    presenceStatus: "active",
    profileId: "profile-3",
    relationshipLabel: "guardian",
    role: "guardian",
  },
];

describe("FamilyGameActivityPanel", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const renderPanel = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <FamilyGameActivityPanel activeCount={3} members={members} />,
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

  it("renders activity rows with live game labels", async () => {
    const rendered = await renderPanel();
    const gameLabel = Array.from(rendered.querySelectorAll("p")).find(
      (element) => element.textContent === "Toy Plane Dash",
    );
    const indicators = rendered.querySelectorAll('[aria-label="active"], [aria-label="inactive"]');

    expect(rendered.textContent).toContain("Who is playing now?");
    expect(rendered.textContent).toContain("Toy Plane Dash");
    expect(rendered.textContent).toContain("On dashboard");
    expect(rendered.textContent).toContain("In lobby");
    expect(gameLabel?.className).toContain("italic");
    expect(indicators).toHaveLength(3);
    expect(rendered.querySelectorAll('[aria-label="active"]')).toHaveLength(3);
  });

  it("uses avatar images when available and initials fallback otherwise", async () => {
    const rendered = await renderPanel();

    const avatarImage = rendered.querySelector('img[alt="Alice Parent"]');
    expect(avatarImage?.getAttribute("src")).toBe("https://example.com/alice.png");
    expect(rendered.textContent).toContain("MP");
  });
});
