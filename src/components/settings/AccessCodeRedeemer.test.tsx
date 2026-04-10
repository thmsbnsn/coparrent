import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccessCodeRedeemer } from "@/components/settings/AccessCodeRedeemer";
import { useSubscription } from "@/hooks/useSubscription";

const { mockInvoke, mockToast, mockCheckSubscription } = vi.hoisted(() => ({
  mockCheckSubscription: vi.fn(async () => undefined),
  mockInvoke: vi.fn(),
  mockToast: vi.fn(),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
  },
}));

const mockedUseSubscription = vi.mocked(useSubscription);

describe("AccessCodeRedeemer", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const renderRedeemer = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(<AccessCodeRedeemer />);
      await Promise.resolve();
      await Promise.resolve();
    });

    return container;
  };

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    mockedUseSubscription.mockReturnValue({
      accessGraceUntil: null,
      accessReason: null,
      checkSubscription: mockCheckSubscription,
      freeAccess: false,
      isGracePeriod: false,
      loading: false,
      pastDue: false,
      subscribed: false,
      tier: "free",
      trial: false,
      trialEndsAt: null,
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

  it("surfaces inactive-code errors returned in a non-2xx function response", async () => {
    const payload = {
      code: "INACTIVE_CODE",
      message: "That access code is no longer active.",
      ok: false,
    };

    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        context: {
          clone: () => ({
            json: async () => payload,
          }),
        },
      },
    });

    const rendered = await renderRedeemer();
    const input = rendered.querySelector("input");
    const form = rendered.querySelector("form");

    expect(input).not.toBeNull();
    expect(form).not.toBeNull();

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;

      valueSetter?.call(input, "CPR-INACTIVE-0001");
      input!.dispatchEvent(new Event("input", { bubbles: true }));
      input!.dispatchEvent(new Event("change", { bubbles: true }));
      form?.requestSubmit();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockInvoke).toHaveBeenCalledWith("redeem-access-code", {
      body: { code: "CPR-INACTIVE-0001" },
    });
    expect(mockToast).toHaveBeenCalledWith({
      title: "Code inactive",
      description: "That access code is no longer active.",
      variant: "destructive",
    });
    expect(mockCheckSubscription).not.toHaveBeenCalled();
  });
});
