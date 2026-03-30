import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const mockMaybeSingle = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: mockMaybeSingle,
        }),
      }),
    }),
    functions: {
      invoke: vi.fn(),
    },
  },
}));

const HookHarness = () => {
  const { isSubscribed, isSupported, loading, permission } = usePushNotifications();

  return (
    <div>
      <div data-testid="subscribed">{String(isSubscribed)}</div>
      <div data-testid="supported">{String(isSupported)}</div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="permission">{permission}</div>
    </div>
  );
};

describe("usePushNotifications", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  const getSubscription = vi.fn();

  beforeEach(() => {
    mockMaybeSingle.mockResolvedValue({ data: { id: "profile-1" } });
    getSubscription.mockReset();
    getSubscription.mockResolvedValue({
      endpoint: "https://example.com/subscription/1",
      toJSON: () => ({
        endpoint: "https://example.com/subscription/1",
        keys: { auth: "auth", p256dh: "p256dh" },
      }),
    });

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockImplementation(() => ({
        addEventListener: vi.fn(),
        matches: false,
        removeEventListener: vi.fn(),
      })),
    });

    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });

    class MockNotification {
      static permission: NotificationPermission = "granted";
      static requestPermission = vi.fn(async () => "granted" as const);
    }

    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: MockNotification,
    });

    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: class MockPushManager {},
    });

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription,
          },
        }),
      },
    });
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

  const renderHarness = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(<HookHarness />);
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    return container;
  };

  it("hydrates an existing push subscription so the user does not need to re-enable it on login", async () => {
    const rendered = await renderHarness();

    expect(rendered.querySelector('[data-testid="supported"]')?.textContent).toBe("true");
    expect(rendered.querySelector('[data-testid="loading"]')?.textContent).toBe("false");
    expect(rendered.querySelector('[data-testid="subscribed"]')?.textContent).toBe("true");
    expect(rendered.querySelector('[data-testid="permission"]')?.textContent).toBe("granted");
    expect(getSubscription).toHaveBeenCalledTimes(1);
  });
});
