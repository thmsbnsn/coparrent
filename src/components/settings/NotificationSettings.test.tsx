import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { useNotifications } from "@/hooks/useNotifications";
import { usePushNotifications } from "@/hooks/usePushNotifications";

vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: vi.fn(),
}));

vi.mock("@/hooks/usePushNotifications", () => ({
  usePushNotifications: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

const mockedUseNotifications = vi.mocked(useNotifications);
const mockedUsePushNotifications = vi.mocked(usePushNotifications);

describe("NotificationSettings", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    mockedUseNotifications.mockReturnValue({
      preferences: {
        enabled: true,
        schedule_changes: true,
        new_messages: true,
        upcoming_exchanges: false,
        exchange_reminder_24h: false,
        exchange_reminder_2h: false,
        exchange_reminder_30min: false,
        document_uploads: true,
        child_info_updates: true,
      },
      loading: false,
      updatePreferences: vi.fn().mockResolvedValue(true),
      toggleAllNotifications: vi.fn().mockResolvedValue(true),
    } as never);

    mockedUsePushNotifications.mockReturnValue({
      isSupported: true,
      isSubscribed: true,
      permission: "granted",
      isiOS: false,
      isiOSPWA: false,
      isPWA: false,
      loading: false,
      unsupportedReason: undefined,
      subscribe: vi.fn().mockResolvedValue(true),
      unsubscribe: vi.fn().mockResolvedValue(true),
      requestPermission: vi.fn().mockResolvedValue(true),
      sendLocalNotification: vi.fn().mockResolvedValue(true),
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
    vi.clearAllMocks();
  });

  const renderComponent = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <MemoryRouter>
          <NotificationSettings />
        </MemoryRouter>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    return container;
  };

  it("links the current device session to PWA diagnostics", async () => {
    const rendered = await renderComponent();

    expect(rendered.textContent).toContain("Push Notifications");
    expect(rendered.textContent).toContain("Send Test Notification");
    expect(rendered.textContent).toContain("Open PWA diagnostics");
    expect(rendered.textContent).toContain("Use PWA diagnostics on the same device/session before capturing push-validation evidence.");
  });
});
