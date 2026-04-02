import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFamily } from "@/contexts/FamilyContext";
import { useFamilyPresence } from "@/hooks/useFamilyPresence";

const rpcMock = vi.hoisted(() => vi.fn());
const removeChannelMock = vi.hoisted(() => vi.fn());
const channelState = vi.hoisted(() => {
  const on = vi.fn();
  const subscribe = vi.fn();
  const channel = {
    on,
    subscribe,
  };

  on.mockReturnValue(channel);
  subscribe.mockReturnValue(channel);

  return {
    channel,
    on,
    subscribe,
  };
});

vi.mock("@/contexts/FamilyContext", () => ({
  useFamily: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: vi.fn(() => channelState.channel),
    removeChannel: removeChannelMock,
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
  const { activeCount, members, scopeError } = useFamilyPresence();

  return (
    <div>
      <div data-testid="active-count">{activeCount}</div>
      <div data-testid="scope-error">{scopeError ?? ""}</div>
      <div data-testid="members">
        {members.map((member) => `${member.displayName}:${member.presenceStatus}`).join("|")}
      </div>
    </div>
  );
};

describe("useFamilyPresence", () => {
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
    removeChannelMock.mockReset();
    channelState.on.mockClear();
    channelState.subscribe.mockClear();
    mockedUseFamily.mockReturnValue({
      activeFamilyId: "family-1",
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
      loading: false,
    } as never);

    const rendered = await renderHarness();

    expect(rendered.querySelector('[data-testid="scope-error"]')?.textContent).toContain("active family");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("loads only the active family's presence overview and subscribes to family-scoped realtime updates", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          avatar_url: null,
          display_name: "Alice",
          game_display_name: null,
          game_slug: null,
          last_seen_at: "2026-04-01T12:00:00.000Z",
          location_type: "dashboard",
          membership_id: "membership-1",
          presence_status: "active",
          profile_id: "profile-1",
          relationship_label: "parent",
          role: "parent",
        },
        {
          avatar_url: null,
          display_name: "Milo",
          game_display_name: "Toy Plane Dash",
          game_slug: "flappy-plane",
          last_seen_at: "2026-04-01T12:00:05.000Z",
          location_type: "game",
          membership_id: "membership-2",
          presence_status: "active",
          profile_id: "profile-2",
          relationship_label: "child",
          role: "child",
        },
      ],
      error: null,
    });

    const rendered = await renderHarness();

    expect(rpcMock).toHaveBeenCalledWith("get_family_presence_overview", {
      p_family_id: "family-1",
    });
    expect(rendered.querySelector('[data-testid="active-count"]')?.textContent).toBe("2");
    expect(rendered.querySelector('[data-testid="members"]')?.textContent).toContain("Alice:active");
    expect(rendered.querySelector('[data-testid="members"]')?.textContent).toContain("Milo:active");
    expect(channelState.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({
        filter: "family_id=eq.family-1",
        table: "family_presence",
      }),
      expect.any(Function),
    );
    expect(channelState.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({
        filter: "family_id=eq.family-1",
        table: "family_members",
      }),
      expect.any(Function),
    );
  });

  it("surfaces explicit server-side family scope errors", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: {
        message: "family_id is required.",
      },
    });

    const rendered = await renderHarness();

    expect(rendered.querySelector('[data-testid="scope-error"]')?.textContent).toContain("family_id is required");
  });
});
