import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CookieConsentBanner } from "@/components/legal/CookieConsentBanner";

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: { children?: ReactNode }) => <div {...props}>{children}</div>,
  },
}));

describe("CookieConsentBanner", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const renderBanner = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <MemoryRouter>
          <CookieConsentBanner />
        </MemoryRouter>,
      );
      await Promise.resolve();
    });

    return container;
  };

  const clickButton = async (label: string) => {
    const button = Array.from(container?.querySelectorAll("button") ?? []).find((candidate) =>
      candidate.textContent?.includes(label),
    ) as HTMLButtonElement | undefined;

    expect(button).toBeDefined();

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
    vi.useRealTimers();
    localStorage.clear();
  });

  it("stays hidden when cookie consent was already saved", async () => {
    localStorage.setItem(
      "coparrent_cookie_consent",
      JSON.stringify({
        essential: true,
        functional: true,
        analytics: false,
        version: "1.0",
        timestamp: "2026-03-30T00:00:00.000Z",
      }),
    );

    const rendered = await renderBanner();

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(rendered.textContent).not.toContain("Cookie Preferences");
  });

  it("saves consent locally and does not show the banner again after accepting", async () => {
    const rendered = await renderBanner();

    await act(async () => {
      vi.advanceTimersByTime(1600);
      await Promise.resolve();
    });

    expect(rendered.textContent).toContain("Cookie Preferences");

    await clickButton("Accept All");

    const stored = localStorage.getItem("coparrent_cookie_consent");
    expect(stored).not.toBeNull();
    expect(stored).toContain("\"analytics\":true");

    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;

    const rerendered = await renderBanner();

    await act(async () => {
      vi.advanceTimersByTime(1600);
      await Promise.resolve();
    });

    expect(rerendered.textContent).not.toContain("Cookie Preferences");
  });
});
