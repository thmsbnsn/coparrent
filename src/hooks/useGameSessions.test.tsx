import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFamily } from "@/contexts/FamilyContext";
import { useGameSessions } from "@/hooks/useGameSessions";

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
  const { ensureSession, openSession, scopeError, sessions } = useGameSessions({
    gameDisplayName: "Toy Plane Dash",
    gameSlug: "flappy-plane",
  });
  const [resolvedSessionId, setResolvedSessionId] = useState("");

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          void ensureSession().then((value) => setResolvedSessionId(value ?? ""));
        }}
      >
        ensure
      </button>
      <div data-testid="open-session-id">{openSession?.id ?? ""}</div>
      <div data-testid="resolved-session-id">{resolvedSessionId}</div>
      <div data-testid="scope-error">{scopeError ?? ""}</div>
      <div data-testid="session-count">{sessions.length}</div>
    </div>
  );
};

describe("useGameSessions", () => {
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

    expect(rendered.querySelector('[data-testid="scope-error"]')?.textContent).toContain(
      "active family",
    );
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("loads family-scoped sessions and creates a session when no lobby exists", async () => {
    rpcMock
      .mockResolvedValueOnce({
        data: [],
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: "session-1",
          status: "waiting",
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            created_at: "2026-04-01T13:00:00.000Z",
            created_by_display_name: "Alice Parent",
            created_by_profile_id: "profile-1",
            ended_at: null,
            family_id: "family-1",
            game_display_name: "Toy Plane Dash",
            game_slug: "flappy-plane",
            id: "session-1",
            max_players: 4,
            member_count: 1,
            ready_count: 0,
            started_at: null,
            status: "waiting",
            updated_at: "2026-04-01T13:00:00.000Z",
          },
        ],
        error: null,
      });

    const rendered = await renderHarness();

    expect(rpcMock).toHaveBeenCalledWith("get_family_game_sessions_overview", {
      p_family_id: "family-1",
      p_game_slug: "flappy-plane",
    });

    await act(async () => {
      rendered.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushPromises();
    });

    expect(rpcMock).toHaveBeenCalledWith("rpc_create_family_game_session", {
      p_family_id: "family-1",
      p_game_display_name: "Toy Plane Dash",
      p_game_slug: "flappy-plane",
      p_max_players: 4,
    });
    expect(rendered.querySelector('[data-testid="resolved-session-id"]')?.textContent).toBe(
      "session-1",
    );
    expect(channelState.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({
        filter: "family_id=eq.family-1",
        table: "family_game_sessions",
      }),
      expect.any(Function),
    );
    expect(channelState.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({
        filter: "family_id=eq.family-1",
        table: "family_game_session_members",
      }),
      expect.any(Function),
    );
  });

  it("surfaces explicit server-side family_id errors", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: {
        message: "family_id is required.",
      },
    });

    const rendered = await renderHarness();

    expect(rendered.querySelector('[data-testid="scope-error"]')?.textContent).toContain(
      "family_id is required",
    );
  });

  it("replaces missing-function errors with a friendlier maintenance message", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: {
        message:
          "Could not find the function public.get_family_game_sessions_overview(p_family_id, p_game_slug) in the schema cache",
      },
    });

    const rendered = await renderHarness();

    expect(rendered.querySelector('[data-testid="scope-error"]')?.textContent).toContain(
      "Shared family lobbies are still being enabled on this server",
    );
  });
});
