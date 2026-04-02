import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useGameLobby } from "@/hooks/useGameLobby";
import { useToyPlaneDashLobby } from "@/hooks/useToyPlaneDashLobby";

vi.mock("@/hooks/useGameLobby", () => ({
  useGameLobby: vi.fn(() => ({
    currentMember: null,
    currentResult: null,
    isCreator: false,
    isJoined: false,
    joinLobby: vi.fn(),
    loading: false,
    lobby: null,
    members: [],
    refresh: vi.fn(),
    reportResult: vi.fn(),
    results: [],
    scopeError: null,
    session: null,
    setReady: vi.fn(),
    startSession: vi.fn(),
  })),
}));

const Harness = () => {
  useToyPlaneDashLobby("session-1");
  return null;
};

describe("useToyPlaneDashLobby", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
    vi.clearAllMocks();
  });

  it("delegates to the generic game lobby hook with the Toy Plane Dash slug", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(<Harness />);
    });

    expect(vi.mocked(useGameLobby)).toHaveBeenCalledWith({
      gameSlug: "flappy-plane",
      sessionId: "session-1",
    });
  });
});
