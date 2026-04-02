import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { FamilyPresencePanel } from "@/components/family/FamilyPresencePanel";
import type { FamilyPresenceMember } from "@/lib/familyPresence";

const members: FamilyPresenceMember[] = [
  {
    avatarUrl: null,
    displayName: "Alice",
    gameDisplayName: null,
    gameSlug: null,
    lastSeenAt: "2026-04-01T12:00:00.000Z",
    locationType: "dashboard",
    membershipId: "membership-1",
    presenceStatus: "active",
    profileId: "profile-1",
    relationshipLabel: "parent",
    role: "parent",
  },
  {
    avatarUrl: null,
    displayName: "Milo",
    gameDisplayName: "Toy Plane Dash",
    gameSlug: "flappy-plane",
    lastSeenAt: "2026-04-01T12:00:05.000Z",
    locationType: "game",
    membershipId: "membership-2",
    presenceStatus: "active",
    profileId: "profile-2",
    relationshipLabel: "child",
    role: "child",
  },
  {
    avatarUrl: null,
    displayName: "Jordan",
    gameDisplayName: "Toy Plane Dash",
    gameSlug: "flappy-plane",
    lastSeenAt: "2026-04-01T11:59:00.000Z",
    locationType: "lobby",
    membershipId: "membership-3",
    presenceStatus: "active",
    profileId: "profile-3",
    relationshipLabel: "guardian",
    role: "guardian",
  },
  {
    avatarUrl: null,
    displayName: "Taylor",
    gameDisplayName: null,
    gameSlug: null,
    lastSeenAt: "2026-04-01T11:58:00.000Z",
    locationType: null,
    membershipId: "membership-4",
    presenceStatus: "inactive",
    profileId: "profile-4",
    relationshipLabel: "guardian",
    role: "guardian",
  },
];

describe("FamilyPresencePanel", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const renderPanel = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <FamilyPresencePanel activeCount={3} members={members} />,
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

  it("shows active and inactive indicators with dashboard status text", async () => {
    const rendered = await renderPanel();

    expect(rendered.querySelectorAll('[aria-label="active"]')).toHaveLength(3);
    expect(rendered.querySelectorAll('[aria-label="inactive"]')).toHaveLength(1);
    expect(rendered.textContent).toContain("On dashboard");
    expect(rendered.textContent).toContain("In lobby");
    expect(rendered.textContent).toContain("Inactive");
  });

  it("renders the active game name as smaller italic secondary text", async () => {
    const rendered = await renderPanel();
    const gameLabel = Array.from(rendered.querySelectorAll("p")).find(
      (node) => node.textContent === "Toy Plane Dash",
    );

    expect(gameLabel).not.toBeUndefined();
    expect(gameLabel?.className).toContain("italic");
  });
});
