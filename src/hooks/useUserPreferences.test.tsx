import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUserPreferences } from "@/hooks/useUserPreferences";

const authState = vi.hoisted(() => ({
  user: { id: "user-1" },
}));

const loadProfilePreferences = vi.hoisted(() => vi.fn());
const saveProfilePreferencesPatch = vi.hoisted(() => vi.fn(async () => ({})));
const setTheme = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    loading: false,
    session: null,
    signOut: vi.fn(),
    user: authState.user,
  }),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({
    setTheme,
  }),
}));

vi.mock("@/lib/profilePreferences", () => ({
  loadProfilePreferences,
  saveProfilePreferencesPatch,
}));

const Harness = () => {
  const { isLoading, preferences, updatePreferences } = useUserPreferences();

  return (
    <div>
      <div data-testid="loading">{String(isLoading)}</div>
      <div data-testid="theme">{preferences.theme}</div>
      <button
        type="button"
        onClick={() => void updatePreferences({ theme: "dark" })}
      >
        save dark
      </button>
    </div>
  );
};

describe("useUserPreferences", () => {
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
    authState.user = { id: "user-1" };
    loadProfilePreferences.mockReset();
    saveProfilePreferencesPatch.mockReset();
    setTheme.mockReset();
    loadProfilePreferences.mockResolvedValue({
      theme: "light",
    });
    saveProfilePreferencesPatch.mockResolvedValue({});
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
  });

  it("loads the saved theme preference on login", async () => {
    const rendered = await renderHarness();

    expect(loadProfilePreferences).toHaveBeenCalledWith("user-1");
    expect(rendered.querySelector('[data-testid="loading"]')?.textContent).toBe("false");
    expect(rendered.querySelector('[data-testid="theme"]')?.textContent).toBe("light");
    expect(setTheme).toHaveBeenCalledWith("light");
  });

  it("persists updated theme preferences for the signed-in user", async () => {
    const rendered = await renderHarness();

    await act(async () => {
      rendered
        .querySelector("button")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(rendered.querySelector('[data-testid="theme"]')?.textContent).toBe("dark");
    expect(setTheme).toHaveBeenLastCalledWith("dark");
    expect(saveProfilePreferencesPatch).toHaveBeenCalledWith("user-1", {
      theme: "dark",
    });
  });
});
