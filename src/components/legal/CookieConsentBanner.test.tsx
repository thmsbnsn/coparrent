import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CookieConsentBanner } from "@/components/legal/CookieConsentBanner";

const authState = vi.hoisted(() => ({
  user: { id: "user-1" },
}));

const loadProfilePreferences = vi.hoisted(() => vi.fn());
const saveProfilePreferencesPatch = vi.hoisted(() => vi.fn(async () => ({})));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: { children?: ReactNode }) => <div {...props}>{children}</div>,
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    loading: false,
    session: null,
    signOut: vi.fn(),
    user: authState.user,
  }),
}));

vi.mock("@/lib/profilePreferences", () => ({
  loadProfilePreferences,
  saveProfilePreferencesPatch,
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
      await Promise.resolve();
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    authState.user = { id: "user-1" };
    loadProfilePreferences.mockReset();
    saveProfilePreferencesPatch.mockReset();
    saveProfilePreferencesPatch.mockResolvedValue({});
    loadProfilePreferences.mockResolvedValue({});
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

  it("stays hidden when cookie consent was already saved locally", async () => {
    localStorage.setItem(
      "coparrent_cookie_consent",
      JSON.stringify({
        analytics: false,
        essential: true,
        functional: true,
        timestamp: "2026-03-30T00:00:00.000Z",
        version: "1.0",
      }),
    );

    const rendered = await renderBanner();

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(loadProfilePreferences).not.toHaveBeenCalled();
    expect(rendered.textContent).not.toContain("Cookie Preferences");
  });

  it("hydrates persisted consent from profile preferences and caches it locally", async () => {
    loadProfilePreferences.mockResolvedValue({
      cookie_consent: {
        analytics: false,
        essential: true,
        functional: true,
        timestamp: "2026-03-30T00:00:00.000Z",
        version: "1.0",
      },
    });

    const rendered = await renderBanner();

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(loadProfilePreferences).toHaveBeenCalledWith("user-1");
    expect(localStorage.getItem("coparrent_cookie_consent")).toContain("\"version\":\"1.0\"");
    expect(rendered.textContent).not.toContain("Cookie Preferences");
  });

  it("persists consent locally and to profile preferences after accepting", async () => {
    const rendered = await renderBanner();

    await act(async () => {
      vi.advanceTimersByTime(1600);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(rendered.textContent).toContain("Cookie Preferences");

    await clickButton("Accept All");

    const stored = localStorage.getItem("coparrent_cookie_consent");
    expect(stored).not.toBeNull();
    expect(stored).toContain("\"analytics\":true");
    expect(saveProfilePreferencesPatch).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        cookie_consent: expect.objectContaining({
          analytics: true,
          essential: true,
          functional: true,
          version: "1.0",
        }),
      }),
    );

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
