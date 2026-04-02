import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFamily } from "@/contexts/FamilyContext";
import { useChildPermissions } from "@/hooks/useChildPermissions";
import ChildAccessSetupPage from "@/pages/ChildAccessSetupPage";

vi.mock("@/contexts/FamilyContext", () => ({
  useFamily: vi.fn(),
}));

vi.mock("@/hooks/useChildPermissions", () => ({
  useChildPermissions: vi.fn(),
}));

vi.mock("@/components/dashboard/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/LoadingSpinner", () => ({
  LoadingSpinner: ({ message }: { message?: string }) => <div>{message ?? "Loading..."}</div>,
}));

vi.mock("@/components/settings/ChildAccessSettingsCard", () => ({
  ChildAccessSettingsCard: () => <div>child-access-settings-card</div>,
}));

vi.mock("@/components/settings/ChildRestrictionsCard", () => ({
  ChildRestrictionsCard: () => <div>child-restrictions-card</div>,
}));

vi.mock("@/components/pwa/ChildModeInstallCard", () => ({
  ChildModeInstallCard: ({
    openPathHref,
    signInHref,
  }: {
    openPathHref?: string | null;
    signInHref?: string | null;
  }) => <div>{`child-mode-install-card:${openPathHref ?? "none"}:${signInHref ?? "none"}`}</div>,
}));

const mockedUseFamily = vi.mocked(useFamily);
const mockedUseChildPermissions = vi.mocked(useChildPermissions);

describe("ChildAccessSetupPage", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const renderPage = async (initialEntry = "/dashboard/settings/child-access/child-1") => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/dashboard/settings" element={<div>settings-page</div>} />
            <Route path="/dashboard/settings/child-access/:childId" element={<ChildAccessSetupPage />} />
            <Route path="/child-app" element={<div>child-app-page</div>} />
          </Routes>
        </MemoryRouter>,
      );
    });

    return container;
  };

  beforeEach(() => {
    mockedUseFamily.mockReturnValue({
      activeFamily: { display_name: "Morgan Family", id: "family-1" },
      activeFamilyId: "family-1",
    } as never);

    mockedUseChildPermissions.mockReturnValue({
      childAccounts: [
        {
          call_settings: {
            allowed_inbound_member_ids: [],
            allowed_outbound_member_ids: [],
            call_mode: "audio_only",
            calling_enabled: false,
          },
          child_email: "milo@example.com",
          child_id: "child-1",
          child_name: "Milo",
          child_profile_id: "profile-child-1",
          child_username: "milo",
          date_of_birth: "2018-01-01",
          device_access: {
            allowed_game_slugs: ["flappy-plane"],
            allowed_sign_in_mode: "standard_sign_in",
            child_email_reset_enabled: false,
            communication_enabled: true,
            games_enabled: true,
            multiplayer_enabled: true,
            quick_unlock_enabled: true,
            screen_time_daily_minutes: 60,
            screen_time_enabled: true,
            updated_at: "2026-04-01T12:00:00.000Z",
          },
          has_account: true,
          loading: false,
          login_enabled: true,
          permissions: {
            allow_calendar_reminders: true,
            allow_family_chat: false,
            allow_mood_checkins: true,
            allow_notes_to_parents: true,
            allow_parent_messaging: true,
            allow_push_notifications: false,
            allow_sibling_messaging: false,
            show_full_event_details: true,
          },
          portal_mode: "age_6_to_12",
          reset_via_child_email: false,
        },
      ],
      loading: false,
      scopeError: null,
      toggleLoginEnabled: vi.fn().mockResolvedValue(true),
      updateDeviceAccessSettings: vi.fn().mockResolvedValue(true),
      updatePortalSettings: vi.fn().mockResolvedValue(true),
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

  it("renders the guided child device setup flow and links the install path", async () => {
    const rendered = await renderPage();

    expect(rendered.textContent).toContain("Set up Milo's child-mode device");
    expect(rendered.textContent).toContain("Credentials ready");
    expect(rendered.textContent).toContain("child-access-settings-card");
    expect(rendered.textContent).toContain("child-restrictions-card");
    expect(rendered.textContent).toContain("child-mode-install-card:/child-app?install=1:/login?next=%2Fchild-app");
  });

  it("fails closed when active family scope is missing", async () => {
    mockedUseFamily.mockReturnValue({
      activeFamily: null,
      activeFamilyId: null,
    } as never);

    const rendered = await renderPage();

    expect(rendered.textContent).toContain("Family scope required");
    expect(rendered.textContent).toContain("active family");
  });

  it("shows an explicit unavailable state when the child is not in the active family", async () => {
    mockedUseChildPermissions.mockReturnValue({
      childAccounts: [],
      loading: false,
      scopeError: null,
    } as never);

    const rendered = await renderPage();

    expect(rendered.textContent).toContain("Child setup unavailable");
    expect(rendered.textContent).toContain("not available in the active family");
  });
});
