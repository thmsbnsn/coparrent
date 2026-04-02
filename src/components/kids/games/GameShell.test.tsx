import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameShell } from "@/components/kids/games/GameShell";

describe("GameShell", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let requestFullscreenMock: ReturnType<typeof vi.fn>;
  let exitFullscreenMock: ReturnType<typeof vi.fn>;
  let lockMock: ReturnType<typeof vi.fn>;
  let unlockMock: ReturnType<typeof vi.fn>;
  let fullscreenElement: Element | null = null;

  beforeEach(() => {
    requestFullscreenMock = vi.fn().mockImplementation(function (this: Element) {
      fullscreenElement = this;
      document.dispatchEvent(new Event("fullscreenchange"));
      return Promise.resolve();
    });
    exitFullscreenMock = vi.fn().mockImplementation(() => {
      fullscreenElement = null;
      document.dispatchEvent(new Event("fullscreenchange"));
      return Promise.resolve();
    });
    lockMock = vi.fn().mockResolvedValue(undefined);
    unlockMock = vi.fn();

    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: requestFullscreenMock,
    });
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: exitFullscreenMock,
    });
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => fullscreenElement,
    });
    Object.defineProperty(screen, "orientation", {
      configurable: true,
      value: {
        lock: lockMock,
        unlock: unlockMock,
      },
    });
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
    fullscreenElement = null;
  });

  const renderShell = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <GameShell
          description="Keep flying through the rocks."
          onBack={vi.fn()}
          title="Toy Plane Dash"
        >
          <div>game-body</div>
        </GameShell>,
      );
    });

    return container;
  };

  it("enters landscape fullscreen and exits back upright", async () => {
    const rendered = await renderShell();

    const enterButton = Array.from(rendered.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes("Sideways + fullscreen"),
    );

    await act(async () => {
      enterButton?.click();
    });

    expect(requestFullscreenMock).toHaveBeenCalledTimes(1);
    expect(lockMock).toHaveBeenCalledWith("landscape");
    expect(rendered.textContent).toContain("Back upright");

    const exitButton = Array.from(rendered.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes("Back upright"),
    );

    await act(async () => {
      exitButton?.click();
    });

    expect(exitFullscreenMock).toHaveBeenCalledTimes(1);
    expect(unlockMock).toHaveBeenCalled();
    expect(rendered.textContent).toContain("Sideways + fullscreen");
  });
});
