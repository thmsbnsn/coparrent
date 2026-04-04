import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Pricing from "@/pages/Pricing";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock("@/components/landing/Navbar", () => ({
  Navbar: () => <div>navbar</div>,
}));

vi.mock("@/components/landing/Footer", () => ({
  Footer: () => <div>footer</div>,
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseSubscription = vi.mocked(useSubscription);

describe("Pricing", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const renderPage = async (initialEntry = "/pricing") => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/pricing" element={<Pricing />} />
          </Routes>
        </MemoryRouter>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    return container;
  };

  beforeEach(() => {
    mockedUseAuth.mockReturnValue({
      user: { id: "user-1" },
    } as never);
    mockedUseSubscription.mockReturnValue({
      checkoutLoading: false,
      createCheckout: vi.fn(),
      loading: false,
      subscribed: false,
      tier: "free",
    } as never);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
    vi.clearAllMocks();
  });

  it("shows dashboard trial context when opened from the authenticated subscription banner", async () => {
    const rendered = await renderPage(
      "/pricing?source=dashboard-subscription-banner&intent=trial-ending",
    );

    expect(rendered.textContent).toContain("Your dashboard trial is ending soon");

    const backLink = Array.from(rendered.querySelectorAll("a")).find((node) =>
      node.textContent?.includes("Back to dashboard"),
    );

    expect(backLink?.getAttribute("href")).toBe("/dashboard");
  });
});
