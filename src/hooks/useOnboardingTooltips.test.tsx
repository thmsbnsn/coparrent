import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOnboardingTooltips, ONBOARDING_TOOLTIPS } from "@/hooks/useOnboardingTooltips";

const authState = vi.hoisted(() => ({
  user: { id: "user-1" },
}));

const loadProfilePreferences = vi.hoisted(() => vi.fn());
const saveProfilePreferencesPatch = vi.hoisted(() => vi.fn(async () => ({})));

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

const STORAGE_KEY = "coparrent_onboarding_dismissed";

const Harness = () => {
  const { currentTooltip, dismissAll, isOnboardingComplete, isLoading } = useOnboardingTooltips();

  return (
    <div>
      <div data-testid="loading">{String(isLoading)}</div>
      <div data-testid="complete">{String(isOnboardingComplete)}</div>
      <div data-testid="current-tooltip">{currentTooltip?.id ?? "none"}</div>
      <button onClick={dismissAll} type="button">
        dismiss all
      </button>
    </div>
  );
};

describe("useOnboardingTooltips", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const renderHarness = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(<Harness />);
      await Promise.resolve();
      await Promise.resolve();
    });

    return container;
  };

  beforeEach(() => {
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
    localStorage.clear();
  });

  it("does not show onboarding again after a completed dismissal state was saved", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        dismissed: ONBOARDING_TOOLTIPS.map((tooltip) => tooltip.id),
        completedAt: "2026-03-30T00:00:00.000Z",
      }),
    );
    loadProfilePreferences.mockResolvedValue({
      onboarding_tooltips: {
        completedAt: "2026-03-30T00:00:00.000Z",
        dismissed: ONBOARDING_TOOLTIPS.map((tooltip) => tooltip.id),
      },
    });

    const rendered = await renderHarness();

    expect(rendered.querySelector('[data-testid="loading"]')?.textContent).toBe("false");
    expect(rendered.querySelector('[data-testid="complete"]')?.textContent).toBe("true");
    expect(rendered.querySelector('[data-testid="current-tooltip"]')?.textContent).toBe("none");
    expect(loadProfilePreferences).toHaveBeenCalledWith("user-1");
  });

  it("persists dismiss-all so the guided tour stays off after dismissal", async () => {
    const rendered = await renderHarness();

    expect(rendered.querySelector('[data-testid="complete"]')?.textContent).toBe("false");

    await act(async () => {
      rendered
        .querySelector("button")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as {
      completedAt?: string;
      dismissed?: string[];
    };

    expect(stored.completedAt).toBeTruthy();
    expect(stored.dismissed).toEqual(ONBOARDING_TOOLTIPS.map((tooltip) => tooltip.id));
    expect(saveProfilePreferencesPatch).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        onboarding_tooltips: expect.objectContaining({
          dismissed: ONBOARDING_TOOLTIPS.map((tooltip) => tooltip.id),
        }),
      }),
    );
    expect(rendered.querySelector('[data-testid="complete"]')?.textContent).toBe("true");
    expect(rendered.querySelector('[data-testid="current-tooltip"]')?.textContent).toBe("none");
  });
});
