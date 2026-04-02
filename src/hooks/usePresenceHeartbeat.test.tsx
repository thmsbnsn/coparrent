import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/contexts/AuthContext";
import { useFamily } from "@/contexts/FamilyContext";
import { usePresenceHeartbeat } from "@/hooks/usePresenceHeartbeat";

const rpcMock = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/contexts/FamilyContext", () => ({
  useFamily: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseFamily = vi.mocked(useFamily);

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const originalVisibilityDescriptor = Object.getOwnPropertyDescriptor(document, "visibilityState");
let visibilityState = "visible";

Object.defineProperty(document, "visibilityState", {
  configurable: true,
  get: () => visibilityState,
});

const Harness = ({
  enabled = true,
  gameDisplayName = null,
  gameSlug = null,
  locationType,
}: {
  enabled?: boolean;
  gameDisplayName?: string | null;
  gameSlug?: string | null;
  locationType: "dashboard" | "lobby" | "game";
}) => {
  const { scopeError } = usePresenceHeartbeat({
    enabled,
    gameDisplayName,
    gameSlug,
    locationType,
  });

  return <div data-testid="scope-error">{scopeError ?? ""}</div>;
};

describe("usePresenceHeartbeat", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const renderHarness = async (
    props: {
      enabled?: boolean;
      gameDisplayName?: string | null;
      gameSlug?: string | null;
      locationType: "dashboard" | "lobby" | "game";
    },
  ) => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(<Harness {...props} />);
      await flushPromises();
    });

    return container;
  };

  beforeEach(() => {
    rpcMock.mockReset();
    vi.useFakeTimers();
    visibilityState = "visible";

    mockedUseAuth.mockReturnValue({
      loading: false,
      user: { id: "user-1" },
    } as never);

    mockedUseFamily.mockReturnValue({
      activeFamilyId: "family-1",
    } as never);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("fails closed when active family scope is missing", async () => {
    mockedUseFamily.mockReturnValue({
      activeFamilyId: null,
    } as never);

    const rendered = await renderHarness({
      locationType: "dashboard",
    });

    expect(rendered.querySelector('[data-testid="scope-error"]')?.textContent).toContain("active family");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("writes explicit family-scoped dashboard presence", async () => {
    rpcMock.mockResolvedValue({
      data: { ok: true },
      error: null,
    });

    await renderHarness({
      locationType: "dashboard",
    });

    expect(rpcMock).toHaveBeenCalledWith("rpc_upsert_family_presence", {
      p_family_id: "family-1",
      p_game_display_name: null,
      p_game_slug: null,
      p_location_type: "dashboard",
      p_presence_status: "active",
    });
  });

  it("writes Flappy game presence and downgrades to inactive when hidden", async () => {
    rpcMock.mockResolvedValue({
      data: { ok: true },
      error: null,
    });

    await renderHarness({
      gameDisplayName: "Toy Plane Dash",
      gameSlug: "flappy-plane",
      locationType: "game",
    });

    expect(rpcMock).toHaveBeenCalledWith("rpc_upsert_family_presence", {
      p_family_id: "family-1",
      p_game_display_name: "Toy Plane Dash",
      p_game_slug: "flappy-plane",
      p_location_type: "game",
      p_presence_status: "active",
    });

    visibilityState = "hidden";

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await flushPromises();
    });

    expect(rpcMock).toHaveBeenLastCalledWith("rpc_upsert_family_presence", {
      p_family_id: "family-1",
      p_game_display_name: null,
      p_game_slug: null,
      p_location_type: null,
      p_presence_status: "inactive",
    });
  });

  it("writes lobby presence with explicit game metadata", async () => {
    rpcMock.mockResolvedValue({
      data: { ok: true },
      error: null,
    });

    await renderHarness({
      gameDisplayName: "Toy Plane Dash",
      gameSlug: "flappy-plane",
      locationType: "lobby",
    });

    expect(rpcMock).toHaveBeenCalledWith("rpc_upsert_family_presence", {
      p_family_id: "family-1",
      p_game_display_name: "Toy Plane Dash",
      p_game_slug: "flappy-plane",
      p_location_type: "lobby",
      p_presence_status: "active",
    });
  });

  it("surfaces explicit server-side family_id errors", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        message: "family_id is required.",
      },
    });

    const rendered = await renderHarness({
      locationType: "dashboard",
    });

    expect(rendered.querySelector('[data-testid="scope-error"]')?.textContent).toContain("family_id is required");
  });
});

afterAll(() => {
  if (originalVisibilityDescriptor) {
    Object.defineProperty(document, "visibilityState", originalVisibilityDescriptor);
  }
});
