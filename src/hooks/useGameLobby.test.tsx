import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFamily } from "@/contexts/FamilyContext";
import { useGameLobby } from "@/hooks/useGameLobby";

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

const lobbyPayload = {
  members: [
    {
      avatar_url: "https://example.com/alice.png",
      display_name: "Alice Parent",
      is_creator: true,
      joined_at: "2026-04-01T13:00:00.000Z",
      profile_id: "profile-1",
      ready_at: "2026-04-01T13:01:00.000Z",
      relationship_label: "parent",
      role: "parent",
      seat_order: 1,
      status: "ready",
    },
  ],
  results: [
    {
      avatar_url: "https://example.com/alice.png",
      display_name: "Alice Parent",
      distance: 412,
      is_winner: true,
      profile_id: "profile-1",
      reported_at: "2026-04-01T13:04:30.000Z",
      score: 7,
    },
  ],
  session: {
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
    ready_count: 1,
    seed: 48271,
    start_time: "2026-04-01T13:03:00.000Z",
    started_at: "2026-04-01T13:02:57.000Z",
    status: "active",
    updated_at: "2026-04-01T13:02:57.000Z",
    winner_profile_id: "profile-1",
  },
};

const Harness = ({ sessionId = "session-1" }: { sessionId?: string | null }) => {
  const {
    currentMember,
    currentResult,
    joinLobby,
    reportResult,
    results,
    scopeError,
    session,
  } = useGameLobby({
    gameSlug: "flappy-plane",
    sessionId,
  });
  const [joinResult, setJoinResult] = useState("");
  const [reportStatus, setReportStatus] = useState("");

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          void joinLobby().then((value) => setJoinResult(String(value)));
        }}
      >
        join
      </button>
      <button
        type="button"
        onClick={() => {
          void reportResult({
            distance: 412,
            reportedAt: "2026-04-01T13:04:30.000Z",
            score: 7,
          }).then((value) => setReportStatus(String(value)));
        }}
      >
        report
      </button>
      <div data-testid="scope-error">{scopeError ?? ""}</div>
      <div data-testid="session-id">{session?.id ?? ""}</div>
      <div data-testid="session-seed">{String(session?.seed ?? "")}</div>
      <div data-testid="current-member">{currentMember?.displayName ?? ""}</div>
      <div data-testid="current-result">{currentResult?.score ?? ""}</div>
      <div data-testid="result-count">{results.length}</div>
      <div data-testid="join-result">{joinResult}</div>
      <div data-testid="report-result">{reportStatus}</div>
    </div>
  );
};

describe("useGameLobby", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const renderHarness = async (sessionId?: string | null) => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(<Harness sessionId={sessionId} />);
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
      profileId: "profile-1",
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
      profileId: "profile-1",
    } as never);

    const rendered = await renderHarness();

    expect(rendered.querySelector('[data-testid="scope-error"]')?.textContent).toContain(
      "active family",
    );
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("loads the family-scoped lobby, results, and report path", async () => {
    rpcMock
      .mockResolvedValueOnce({
        data: lobbyPayload,
        error: null,
      })
      .mockResolvedValueOnce({
        data: { ok: true },
        error: null,
      })
      .mockResolvedValueOnce({
        data: lobbyPayload,
        error: null,
      })
      .mockResolvedValueOnce({
        data: { ok: true },
        error: null,
      })
      .mockResolvedValueOnce({
        data: lobbyPayload,
        error: null,
      });

    const rendered = await renderHarness();

    expect(rpcMock).toHaveBeenCalledWith("get_family_game_lobby", {
      p_family_id: "family-1",
      p_session_id: "session-1",
    });
    expect(rendered.querySelector('[data-testid="current-member"]')?.textContent).toBe(
      "Alice Parent",
    );
    expect(rendered.querySelector('[data-testid="current-result"]')?.textContent).toBe("7");
    expect(rendered.querySelector('[data-testid="result-count"]')?.textContent).toBe("1");
    expect(rendered.querySelector('[data-testid="session-seed"]')?.textContent).toBe("48271");

    await act(async () => {
      rendered.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushPromises();
    });

    expect(rpcMock).toHaveBeenCalledWith("rpc_join_family_game_session", {
      p_family_id: "family-1",
      p_session_id: "session-1",
    });

    const reportButton = rendered.querySelectorAll("button")[1];
    await act(async () => {
      reportButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushPromises();
    });

    expect(rpcMock).toHaveBeenCalledWith("rpc_report_family_game_session_result", {
      p_distance: 412,
      p_family_id: "family-1",
      p_reported_at: "2026-04-01T13:04:30.000Z",
      p_score: 7,
      p_session_id: "session-1",
    });
    expect(channelState.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({
        filter: "family_id=eq.family-1",
        table: "family_game_session_results",
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
});
