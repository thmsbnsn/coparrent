import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PWADiagnosticsPage from "@/pages/PWADiagnosticsPage";
import { usePushNotifications } from "@/hooks/usePushNotifications";

vi.mock("@/components/landing/Navbar", () => ({
  Navbar: () => <div>navbar</div>,
}));

vi.mock("@/components/landing/Footer", () => ({
  Footer: () => <div>footer</div>,
}));

vi.mock("@/hooks/usePushNotifications", () => ({
  usePushNotifications: vi.fn(),
}));

const mockedUsePushNotifications = vi.mocked(usePushNotifications);

describe("PWADiagnosticsPage", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    document.head.innerHTML = '<link rel="manifest" href="/manifest.webmanifest">';
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: { permission: "granted" },
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistration: vi.fn().mockResolvedValue({ scope: "/" }),
      },
    });

    mockedUsePushNotifications.mockReturnValue({
      isSupported: true,
      isSubscribed: true,
      permission: "granted",
      isiOS: false,
      isiOSPWA: false,
      isPWA: false,
      loading: false,
      unsupportedReason: undefined,
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      requestPermission: vi.fn(),
      sendLocalNotification: vi.fn(),
      subscription: null,
    } as never);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
    document.head.innerHTML = "";
    vi.clearAllMocks();
  });

  const renderPage = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <MemoryRouter>
          <PWADiagnosticsPage />
        </MemoryRouter>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    return container;
  };

  it("surfaces push readiness and the evidence reminder", async () => {
    const rendered = await renderPage();

    expect(rendered.textContent).toContain("PWA diagnostics");
    expect(rendered.textContent).toContain("Desktop browser");
    expect(rendered.textContent).toContain("Supported");
    expect(rendered.textContent).toContain("Active subscription");
    expect(rendered.textContent).toContain("Open notification settings");
    expect(rendered.textContent).toContain("Push/PWA validation is not complete until the target physical device actually receives the notification");
  });
});
