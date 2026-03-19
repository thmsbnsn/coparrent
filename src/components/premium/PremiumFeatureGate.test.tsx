import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PremiumFeatureGate } from "@/components/premium/PremiumFeatureGate";
import { usePremiumAccess } from "@/hooks/usePremiumAccess";
import { useSubscription } from "@/hooks/useSubscription";
import { recordPremiumDenial } from "@/lib/denialTelemetry";

vi.mock("@/hooks/usePremiumAccess", () => ({
  usePremiumAccess: vi.fn(),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: vi.fn(),
}));

vi.mock("@/lib/denialTelemetry", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/denialTelemetry")>("@/lib/denialTelemetry");

  return {
    ...actual,
    recordPremiumDenial: vi.fn(),
  };
});

const mockedUsePremiumAccess = vi.mocked(usePremiumAccess);
const mockedUseSubscription = vi.mocked(useSubscription);
const mockedRecordPremiumDenial = vi.mocked(recordPremiumDenial);

describe("PremiumFeatureGate", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const renderPremiumGate = async (
    props: Partial<React.ComponentProps<typeof PremiumFeatureGate>> = {},
  ) => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={["/feature"]}>
          <Routes>
            <Route path="/pricing" element={<div>pricing-page</div>} />
            <Route
              path="/feature"
              element={
                <PremiumFeatureGate featureName="Expense Tracking" {...props}>
                  <div>premium-content</div>
                </PremiumFeatureGate>
              }
            />
          </Routes>
        </MemoryRouter>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    return container;
  };

  beforeEach(() => {
    mockedUsePremiumAccess.mockReturnValue({
      hasAccess: true,
      loading: false,
      reason: "subscribed",
      daysRemaining: null,
      trialExpiresIn: null,
    });

    mockedUseSubscription.mockReturnValue({
      tier: "power",
    } as never);

    mockedRecordPremiumDenial.mockReset();
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

  it("renders children when premium access is available", async () => {
    const rendered = await renderPremiumGate();

    expect(rendered.textContent).toContain("premium-content");
    expect(mockedRecordPremiumDenial).not.toHaveBeenCalled();
  });

  it("shows the upgrade card and records premium-required denials", async () => {
    mockedUsePremiumAccess.mockReturnValue({
      hasAccess: false,
      loading: false,
      reason: "free",
      daysRemaining: null,
      trialExpiresIn: null,
    });
    mockedUseSubscription.mockReturnValue({
      tier: "free",
    } as never);

    const rendered = await renderPremiumGate();

    expect(rendered.textContent).toContain("Power Feature");
    expect(rendered.textContent).toContain("View Plans");
    expect(mockedRecordPremiumDenial).toHaveBeenCalledWith(
      "Expense Tracking",
      "free",
      "premium_required",
    );
  });

  it("uses the expired-trial messaging inline and routes to pricing", async () => {
    mockedUsePremiumAccess.mockReturnValue({
      hasAccess: false,
      loading: false,
      reason: "trial_expired",
      daysRemaining: 0,
      trialExpiresIn: 0,
    });
    mockedUseSubscription.mockReturnValue({
      tier: "free",
    } as never);

    const rendered = await renderPremiumGate({ inline: true });
    const button = rendered.querySelector("button");

    expect(rendered.textContent).toContain("Trial Ended");

    await act(async () => {
      button?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(rendered.textContent).toContain("pricing-page");
    expect(mockedRecordPremiumDenial).toHaveBeenCalledWith(
      "Expense Tracking",
      "free",
      "trial_expired",
    );
  });

  it("renders a custom fallback when provided", async () => {
    mockedUsePremiumAccess.mockReturnValue({
      hasAccess: false,
      loading: false,
      reason: "free",
      daysRemaining: null,
      trialExpiresIn: null,
    });

    const rendered = await renderPremiumGate({
      fallback: <div>custom-fallback</div>,
    });

    expect(rendered.textContent).toContain("custom-fallback");
    expect(rendered.textContent).not.toContain("Power Feature");
  });

  it("returns nothing when hideWhenLocked is enabled", async () => {
    mockedUsePremiumAccess.mockReturnValue({
      hasAccess: false,
      loading: false,
      reason: "free",
      daysRemaining: null,
      trialExpiresIn: null,
    });
    mockedUseSubscription.mockReturnValue({
      tier: "free",
    } as never);

    const rendered = await renderPremiumGate({ hideWhenLocked: true });

    expect(rendered.textContent).toBe("");
    expect(mockedRecordPremiumDenial).toHaveBeenCalledWith(
      "Expense Tracking",
      "free",
      "premium_required",
    );
  });
});
