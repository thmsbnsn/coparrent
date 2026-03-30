import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOnboardingTooltips, ONBOARDING_TOOLTIPS } from "@/hooks/useOnboardingTooltips";

const authState = vi.hoisted(() => ({
  user: { id: "user-1" },
}));

const mockMaybeSingle = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: mockMaybeSingle,
        }),
      }),
      update: () => ({
        eq: vi.fn(async () => ({ error: null })),
      }),
    }),
  },
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
    mockMaybeSingle.mockResolvedValue({ data: { preferences: null } });
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
    mockMaybeSingle.mockResolvedValue({
      data: {
        preferences: {
          onboarding_tooltips: {
            dismissed: ONBOARDING_TOOLTIPS.map((tooltip) => tooltip.id),
            completedAt: "2026-03-30T00:00:00.000Z",
          },
        },
      },
    });

    const rendered = await renderHarness();

    expect(rendered.querySelector('[data-testid="loading"]')?.textContent).toBe("false");
    expect(rendered.querySelector('[data-testid="complete"]')?.textContent).toBe("true");
    expect(rendered.querySelector('[data-testid="current-tooltip"]')?.textContent).toBe("none");
  });

  it("persists dismiss-all so the guided tour stays off after dismissal", async () => {
    const rendered = await renderHarness();

    expect(rendered.querySelector('[data-testid="complete"]')?.textContent).toBe("false");

    await act(async () => {
      rendered
        .querySelector("button")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as {
      completedAt?: string;
      dismissed?: string[];
    };

    expect(stored.completedAt).toBeTruthy();
    expect(stored.dismissed).toEqual(ONBOARDING_TOOLTIPS.map((tooltip) => tooltip.id));
    expect(rendered.querySelector('[data-testid="complete"]')?.textContent).toBe("true");
    expect(rendered.querySelector('[data-testid="current-tooltip"]')?.textContent).toBe("none");
  });
});
