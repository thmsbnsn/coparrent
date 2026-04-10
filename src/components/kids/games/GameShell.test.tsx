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
      candidate.textContent?.includes("Enter Fullscreen"),
    );

    expect(requestFullscreenMock).not.toHaveBeenCalled();

    await act(async () => {
      enterButton?.click();
    });

    expect(requestFullscreenMock).toHaveBeenCalledTimes(1);
    expect(lockMock).toHaveBeenCalledWith("landscape");
    expect(rendered.textContent).toContain("Exit Fullscreen");
    expect(rendered.textContent).toContain("Landscape lock is active");

    const exitButton = Array.from(rendered.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes("Exit Fullscreen"),
    );

    await act(async () => {
      exitButton?.click();
    });

    expect(exitFullscreenMock).toHaveBeenCalledTimes(1);
    expect(unlockMock).toHaveBeenCalled();
    expect(rendered.textContent).toContain("Enter Fullscreen");
    expect(rendered.textContent).toContain("Fullscreen closed. The game keeps running in the page view.");
  });

  it("shows manual rotate guidance when fullscreen support is unavailable", async () => {
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: undefined,
    });

    const rendered = await renderShell();

    expect(rendered.textContent).toContain("Rotate manually");
    expect(rendered.textContent).toContain("does not expose reliable fullscreen");
  });

  it("shows a clear fallback message when fullscreen entry is denied", async () => {
    requestFullscreenMock.mockRejectedValueOnce(new Error("blocked"));
    const rendered = await renderShell();

    const enterButton = Array.from(rendered.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes("Enter Fullscreen"),
    );

    await act(async () => {
      enterButton?.click();
      await Promise.resolve();
    });

    expect(lockMock).not.toHaveBeenCalled();
    expect(rendered.textContent).toContain("denied by the browser or operating system");
    expect(rendered.textContent).toContain("Enter Fullscreen");
  });

  it("updates the UI if fullscreen exits outside the game controls", async () => {
    const rendered = await renderShell();

    const enterButton = Array.from(rendered.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes("Enter Fullscreen"),
    );

    await act(async () => {
      enterButton?.click();
    });

    expect(rendered.textContent).toContain("Exit Fullscreen");

    await act(async () => {
      fullscreenElement = null;
      document.dispatchEvent(new Event("fullscreenchange"));
    });

    expect(rendered.textContent).toContain("Enter Fullscreen");
    expect(rendered.textContent).toContain("ended outside the game controls");
  });

  it("keeps fullscreen active and explains the rotate fallback when landscape lock fails", async () => {
    lockMock.mockRejectedValueOnce(new Error("no lock"));
    const rendered = await renderShell();

    const enterButton = Array.from(rendered.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes("Enter Fullscreen"),
    );

    await act(async () => {
      enterButton?.click();
      await Promise.resolve();
    });

    expect(requestFullscreenMock).toHaveBeenCalledTimes(1);
    expect(rendered.textContent).toContain("Exit Fullscreen");
    expect(rendered.textContent).toContain("landscape lock is not available here");
  });
});
