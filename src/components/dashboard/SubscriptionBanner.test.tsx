import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SubscriptionBanner } from "@/components/dashboard/SubscriptionBanner";
import { useSubscription } from "@/hooks/useSubscription";

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: vi.fn(),
}));

const mockedUseSubscription = vi.mocked(useSubscription);

const PricingProbe = () => {
  const location = useLocation();

  return <div>{`pricing-page:${location.pathname}${location.search}`}</div>;
};

describe("SubscriptionBanner", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const renderBanner = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={["/dashboard"]}>
          <Routes>
            <Route path="/dashboard" element={<SubscriptionBanner />} />
            <Route path="/pricing" element={<PricingProbe />} />
          </Routes>
        </MemoryRouter>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    return container;
  };

  beforeEach(() => {
    window.localStorage.clear();
    mockedUseSubscription.mockReturnValue({
      accessGraceUntil: null,
      freeAccess: false,
      isGracePeriod: false,
      loading: false,
      pastDue: false,
      subscribed: false,
      tier: "free",
      trial: true,
      trialEndsAt: new Date(Date.now() + 86_400_000).toISOString(),
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
    window.localStorage.clear();
  });

  it("routes active trial users into the explicit dashboard pricing path", async () => {
    const rendered = await renderBanner();

    const button = Array.from(rendered.querySelectorAll("button")).find((node) =>
      node.textContent?.includes("View Plans"),
    );

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(rendered.textContent).toContain(
      "pricing-page:/pricing?source=dashboard-subscription-banner&intent=trial-ending",
    );
  });

  it("routes expired trial users into the explicit dashboard recovery path", async () => {
    mockedUseSubscription.mockReturnValue({
      accessGraceUntil: null,
      freeAccess: false,
      isGracePeriod: false,
      loading: false,
      pastDue: false,
      subscribed: false,
      tier: "free",
      trial: true,
      trialEndsAt: new Date(Date.now() - 86_400_000).toISOString(),
    } as never);

    const rendered = await renderBanner();

    const button = Array.from(rendered.querySelectorAll("button")).find((node) =>
      node.textContent?.includes("Get Power"),
    );

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(rendered.textContent).toContain(
      "pricing-page:/pricing?source=dashboard-subscription-banner&intent=trial-expired",
    );
  });
});
