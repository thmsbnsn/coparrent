import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChildRestrictionsCard } from "@/components/settings/ChildRestrictionsCard";

describe("ChildRestrictionsCard", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const renderCard = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <ChildRestrictionsCard
          allowedGameSlugs={["flappy-plane"]}
          communicationEnabled={false}
          gamesEnabled
          multiplayerEnabled={false}
          onAllowedGameToggle={vi.fn()}
          onCommunicationEnabledChange={vi.fn()}
          onGamesEnabledChange={vi.fn()}
          onMultiplayerEnabledChange={vi.fn()}
          onSave={vi.fn()}
          onScreenTimeDailyMinutesChange={vi.fn()}
          onScreenTimeEnabledChange={vi.fn()}
          screenTimeDailyMinutes="45"
          screenTimeEnabled
        />,
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

  it("renders screen-time, communication, and game restriction groups", async () => {
    const rendered = await renderCard();

    expect(rendered.textContent).toContain("Restrictions");
    expect(rendered.textContent).toContain("Screen time");
    expect(rendered.textContent).toContain("Communication");
    expect(rendered.textContent).toContain("Games");
    expect(rendered.textContent).toContain("Multiplayer");
    expect(rendered.textContent).toContain("Allowed games");
    expect(rendered.textContent).toContain("Toy Plane Dash");
    expect(rendered.textContent).toContain("Save restrictions");
  });
});
