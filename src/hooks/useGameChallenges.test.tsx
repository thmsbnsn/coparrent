import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFamily } from "@/contexts/FamilyContext";
import { useGameChallenges } from "@/hooks/useGameChallenges";

const rpcMock = vi.hoisted(() => vi.fn());
const removeChannelMock = vi.hoisted(() => vi.fn());
const channelState = vi.hoisted(() => {
  const on = vi.fn();
  const subscribe = vi.fn();
  const channel = { on, subscribe };

  on.mockReturnValue(channel);
  subscribe.mockReturnValue(channel);

  return { channel, on, subscribe };
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

const challengeOverviewPayload = {
  challenge: {
    completed_at: null,
    created_at: "2026-04-02T18:00:00.000Z",
    created_by_display_name: "Alice Parent",
    created_by_profile_id: "profile-1",
    expires_at: null,
    family_id: "family-1",
    game_display_name: "Toy Plane Dash",
    game_slug: "flappy-plane",
    id: "challenge-1",
    leading_profile_id: "profile-1",
    participant_count: 1,
    result_count: 1,
    status: "active",
    updated_at: "2026-04-02T18:05:00.000Z",
  },
  leaderboard: [
    {
      avatar_url: "https://example.com/alice.png",
      display_name: "Alice Parent",
      distance: 420,
      is_leader: true,
      profile_id: "profile-1",
      relationship_label: "parent",
      role: "parent",
      score: 7,
      submitted_at: "2026-04-02T18:04:00.000Z",
    },
  ],
  participants: [
    {
      accepted_at: "2026-04-02T18:00:00.000Z",
      avatar_url: "https://example.com/alice.png",
      display_name: "Alice Parent",
      has_result: true,
      profile_id: "profile-1",
      relationship_label: "parent",
      role: "parent",
    },
  ],
};

const Harness = () => {
  const {
    acceptChallenge,
    challenge,
    closeChallenge,
    createChallenge,
    currentParticipant,
    currentResult,
    leaderboard,
    scopeError,
    submitResult,
  } = useGameChallenges({
    gameDisplayName: "Toy Plane Dash",
    gameSlug: "flappy-plane",
  });
  const [createResult, setCreateResult] = useState("");
  const [submitAccepted, setSubmitAccepted] = useState("");

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          void createChallenge().then((value) => setCreateResult(value ?? ""));
        }}
      >
        create
      </button>
      <button
        type="button"
        onClick={() => {
          void acceptChallenge();
        }}
      >
        accept
      </button>
      <button
        type="button"
        onClick={() => {
          void submitResult({
            distance: 480,
            score: 9,
            submittedAt: "2026-04-02T18:06:00.000Z",
          }).then((value) => setSubmitAccepted(String(value?.accepted ?? "")));
        }}
      >
        submit
      </button>
      <button
        type="button"
        onClick={() => {
          void closeChallenge();
        }}
      >
        close
      </button>
      <div data-testid="challenge-id">{challenge?.id ?? ""}</div>
      <div data-testid="leader-name">{leaderboard[0]?.displayName ?? ""}</div>
      <div data-testid="current-score">{currentResult?.score ?? ""}</div>
      <div data-testid="participant-name">{currentParticipant?.displayName ?? ""}</div>
      <div data-testid="scope-error">{scopeError ?? ""}</div>
      <div data-testid="create-result">{createResult}</div>
      <div data-testid="submit-accepted">{submitAccepted}</div>
    </div>
  );
};

describe("useGameChallenges", () => {
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

  it("loads the family challenge overview and uses explicit family_id on create, accept, submit, and close", async () => {
    rpcMock
      .mockResolvedValueOnce({
        data: challengeOverviewPayload,
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: "challenge-1", status: "active" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: challengeOverviewPayload,
        error: null,
      })
      .mockResolvedValueOnce({
        data: { challenge_id: "challenge-1", profile_id: "profile-1" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: challengeOverviewPayload,
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          accepted: true,
          challenge_id: "challenge-1",
          distance: 480,
          leading_profile_id: "profile-1",
          profile_id: "profile-1",
          score: 9,
          status: "active",
          submitted_at: "2026-04-02T18:06:00.000Z",
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          ...challengeOverviewPayload,
          challenge: {
            ...challengeOverviewPayload.challenge,
            leading_profile_id: "profile-1",
            result_count: 1,
          },
          leaderboard: [
            {
              ...challengeOverviewPayload.leaderboard[0],
              distance: 480,
              score: 9,
              submitted_at: "2026-04-02T18:06:00.000Z",
            },
          ],
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: "challenge-1", status: "completed" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          ...challengeOverviewPayload,
          challenge: {
            ...challengeOverviewPayload.challenge,
            completed_at: "2026-04-02T18:10:00.000Z",
            status: "completed",
          },
        },
        error: null,
      });

    const rendered = await renderHarness();

    expect(rpcMock).toHaveBeenCalledWith("get_family_game_challenge_overview", {
      p_family_id: "family-1",
      p_game_slug: "flappy-plane",
    });
    expect(rendered.querySelector('[data-testid="challenge-id"]')?.textContent).toBe("challenge-1");
    expect(rendered.querySelector('[data-testid="leader-name"]')?.textContent).toBe("Alice Parent");
    expect(rendered.querySelector('[data-testid="participant-name"]')?.textContent).toBe("Alice Parent");
    expect(channelState.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({
        filter: "family_id=eq.family-1",
        table: "family_game_challenges",
      }),
      expect.any(Function),
    );

    const buttons = rendered.querySelectorAll("button");

    await act(async () => {
      buttons[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushPromises();
    });

    expect(rpcMock).toHaveBeenCalledWith("rpc_create_family_game_challenge", {
      p_family_id: "family-1",
      p_game_display_name: "Toy Plane Dash",
      p_game_slug: "flappy-plane",
    });
    expect(rendered.querySelector('[data-testid="create-result"]')?.textContent).toBe("challenge-1");

    await act(async () => {
      buttons[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushPromises();
    });

    expect(rpcMock).toHaveBeenCalledWith("rpc_accept_family_game_challenge", {
      p_challenge_id: "challenge-1",
      p_family_id: "family-1",
    });

    await act(async () => {
      buttons[2]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushPromises();
    });

    expect(rpcMock).toHaveBeenCalledWith("rpc_submit_family_game_challenge_result", {
      p_challenge_id: "challenge-1",
      p_distance: 480,
      p_family_id: "family-1",
      p_score: 9,
      p_submitted_at: "2026-04-02T18:06:00.000Z",
    });
    expect(rendered.querySelector('[data-testid="submit-accepted"]')?.textContent).toBe("true");

    await act(async () => {
      buttons[3]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushPromises();
    });

    expect(rpcMock).toHaveBeenCalledWith("rpc_close_family_game_challenge", {
      p_challenge_id: "challenge-1",
      p_family_id: "family-1",
    });
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

  it("replaces missing-function errors with a friendlier challenge maintenance message", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: {
        message:
          "Could not find the function public.get_family_game_challenge_overview(p_family_id, p_game_slug) in the schema cache",
      },
    });

    const rendered = await renderHarness();

    expect(rendered.querySelector('[data-testid="scope-error"]')?.textContent).toContain(
      "Family challenges are still being enabled on this server",
    );
  });
});
