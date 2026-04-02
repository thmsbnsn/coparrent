import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { hardNavigateTo, hardReload } from "@/lib/hardNavigation";
import { OfflineFallback } from "@/components/pwa/OfflineFallback";

describe("OfflineFallback", () => {
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

  const renderFallback = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(<OfflineFallback />);
    });

    return container;
  };

  it("keeps the hard-navigation retry and home escape hatches wired through the shared helper", async () => {
    const rendered = await renderFallback();

    const retryButton = Array.from(rendered.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes("Try Again"),
    );
    const homeButton = Array.from(rendered.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes("Go Home"),
    );

    await act(async () => {
      retryButton?.click();
      homeButton?.click();
    });

    expect(hardReload).toHaveBeenCalledTimes(1);
    expect(hardNavigateTo).toHaveBeenCalledWith("/");
  });
});
