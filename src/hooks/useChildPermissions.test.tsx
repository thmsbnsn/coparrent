import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFamily } from "@/contexts/FamilyContext";
import { useChildPermissions } from "@/hooks/useChildPermissions";

const rpcMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());
const familyMembersInMock = vi.hoisted(() => vi.fn());
const familyMembersEqStatusMock = vi.hoisted(() => vi.fn());
const familyMembersEqFamilyMock = vi.hoisted(() => vi.fn());
const familyMembersSelectMock = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/FamilyContext", () => ({
  useFamily: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: toastMock,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (tableName: string) => {
      if (tableName !== "family_members") {
        throw new Error(`Unexpected table access: ${tableName}`);
      }

      return {
        select: familyMembersSelectMock,
      };
    },
    rpc: rpcMock,
  },
}));

const mockedUseFamily = vi.mocked(useFamily);

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const Harness = () => {
  const {
    childAccounts,
    scopeError,
    updateDeviceAccessSettings,
  } = useChildPermissions();

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          void updateDeviceAccessSettings("child-1", {
            allowed_game_slugs: ["flappy-plane"],
            communication_enabled: false,
            games_enabled: true,
            multiplayer_enabled: false,
            quick_unlock_enabled: true,
            screen_time_daily_minutes: 45,
            screen_time_enabled: true,
          });
        }}
      >
        save-device-access
      </button>
      <div data-testid="child-count">{childAccounts.length}</div>
      <div data-testid="scope-error">{scopeError ?? ""}</div>
      <div data-testid="quick-unlock">
        {childAccounts[0]?.device_access.quick_unlock_enabled ? "on" : "off"}
      </div>
      <div data-testid="games-enabled">
        {childAccounts[0]?.device_access.games_enabled ? "on" : "off"}
      </div>
    </div>
  );
};

describe("useChildPermissions", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const renderHarness = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(<Harness />);
      await flushPromises();
    });

    return container;
  };

  beforeEach(() => {
    rpcMock.mockReset();
    toastMock.mockReset();
    familyMembersSelectMock.mockReset();
    familyMembersEqFamilyMock.mockReset();
    familyMembersEqStatusMock.mockReset();
    familyMembersInMock.mockReset();

    familyMembersSelectMock.mockReturnValue({
      eq: familyMembersEqFamilyMock,
    });
    familyMembersEqFamilyMock.mockReturnValue({
      eq: familyMembersEqStatusMock,
    });
    familyMembersEqStatusMock.mockReturnValue({
      in: familyMembersInMock,
    });
    familyMembersInMock.mockResolvedValue({
      data: [
        {
          id: "membership-parent",
          profile_id: "profile-parent",
          profiles: {
            avatar_url: null,
            full_name: "Pat Parent",
          },
          relationship_label: "Parent",
          role: "parent",
        },
      ],
      error: null,
    });

    mockedUseFamily.mockReturnValue({
      activeFamilyId: "family-1",
      isParentInActiveFamily: true,
      loading: false,
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

  it("fails closed when active family scope is missing", async () => {
    mockedUseFamily.mockReturnValue({
      activeFamilyId: null,
      isParentInActiveFamily: true,
      loading: false,
    } as never);

    const rendered = await renderHarness();

    expect(rendered.querySelector('[data-testid="scope-error"]')?.textContent).toContain(
      "active family",
    );
    expect(rpcMock).not.toHaveBeenCalled();
    expect(familyMembersInMock).not.toHaveBeenCalled();
  });

  it("stays empty for non-parent viewers instead of broadening access", async () => {
    mockedUseFamily.mockReturnValue({
      activeFamilyId: "family-1",
      isParentInActiveFamily: false,
      loading: false,
    } as never);

    const rendered = await renderHarness();

    expect(rendered.querySelector('[data-testid="child-count"]')?.textContent).toBe("0");
    expect(rendered.querySelector('[data-testid="scope-error"]')?.textContent).toBe("");
    expect(rpcMock).not.toHaveBeenCalled();
    expect(familyMembersInMock).not.toHaveBeenCalled();
  });

  it("loads device access settings and sends explicit family scope when saving updates", async () => {
    rpcMock
      .mockResolvedValueOnce({
        data: [
          {
            call_settings: {
              allowed_inbound_member_ids: [],
              allowed_outbound_member_ids: [],
              call_mode: "audio_only",
              calling_enabled: false,
            },
            child_email: "milo@example.test",
            child_id: "child-1",
            child_name: "Milo",
            child_profile_id: "profile-child",
            child_username: "milo",
            date_of_birth: "2019-01-01",
            device_access: {
              allowed_game_slugs: ["flappy-plane"],
              allowed_sign_in_mode: "standard_sign_in",
              child_email_reset_enabled: true,
              communication_enabled: true,
              games_enabled: true,
              multiplayer_enabled: true,
              quick_unlock_enabled: false,
              screen_time_daily_minutes: 30,
              screen_time_enabled: true,
              updated_at: "2026-04-01T12:00:00.000Z",
            },
            has_account: true,
            login_enabled: true,
            permissions: {
              allow_calendar_reminders: true,
              allow_family_chat: true,
              allow_mood_checkins: true,
              allow_notes_to_parents: true,
              allow_parent_messaging: true,
              allow_push_notifications: false,
              allow_sibling_messaging: true,
              show_full_event_details: false,
            },
            portal_mode: "age_6_to_12",
            reset_via_child_email: true,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          child_id: "child-1",
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            call_settings: {
              allowed_inbound_member_ids: [],
              allowed_outbound_member_ids: [],
              call_mode: "audio_only",
              calling_enabled: false,
            },
            child_email: "milo@example.test",
            child_id: "child-1",
            child_name: "Milo",
            child_profile_id: "profile-child",
            child_username: "milo",
            date_of_birth: "2019-01-01",
            device_access: {
              allowed_game_slugs: ["flappy-plane"],
              allowed_sign_in_mode: "standard_sign_in",
              child_email_reset_enabled: true,
              communication_enabled: false,
              games_enabled: true,
              multiplayer_enabled: false,
              quick_unlock_enabled: true,
              screen_time_daily_minutes: 45,
              screen_time_enabled: true,
              updated_at: "2026-04-01T12:30:00.000Z",
            },
            has_account: true,
            login_enabled: true,
            permissions: {
              allow_calendar_reminders: true,
              allow_family_chat: true,
              allow_mood_checkins: true,
              allow_notes_to_parents: true,
              allow_parent_messaging: true,
              allow_push_notifications: false,
              allow_sibling_messaging: true,
              show_full_event_details: false,
            },
            portal_mode: "age_6_to_12",
            reset_via_child_email: true,
          },
        ],
        error: null,
      });

    const rendered = await renderHarness();

    expect(rpcMock).toHaveBeenCalledWith("get_family_child_portal_overview", {
      p_family_id: "family-1",
    });
    expect(rendered.querySelector('[data-testid="child-count"]')?.textContent).toBe("1");
    expect(rendered.querySelector('[data-testid="games-enabled"]')?.textContent).toBe("on");

    await act(async () => {
      rendered.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushPromises();
    });

    expect(rpcMock).toHaveBeenCalledWith("rpc_upsert_child_device_access_settings", {
      p_allowed_game_slugs: ["flappy-plane"],
      p_allowed_sign_in_mode: null,
      p_child_id: "child-1",
      p_communication_enabled: false,
      p_family_id: "family-1",
      p_games_enabled: true,
      p_multiplayer_enabled: false,
      p_quick_unlock_enabled: true,
      p_screen_time_daily_minutes: 45,
      p_screen_time_enabled: true,
    });
    expect(rendered.querySelector('[data-testid="quick-unlock"]')?.textContent).toBe("on");
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Child access updated",
      }),
    );
  });
});
