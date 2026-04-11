import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCallableFamilyMembers } from "@/hooks/useCallableFamilyMembers";

const mockState = vi.hoisted(() => ({
  fallbackResult: {
    data: [] as unknown[],
    error: null as { message: string } | null,
  },
  from: vi.fn(),
  rpc: vi.fn(),
  rpcResult: {
    data: [] as unknown[],
    error: null as { message: string } | null,
  },
  role: {
    activeFamilyId: "family-1",
    isChild: false,
    profileId: "profile-current",
  },
}));

vi.mock("@/hooks/useFamilyRole", () => ({
  useFamilyRole: () => mockState.role,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockState.from,
    rpc: mockState.rpc,
  },
}));

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const HookHarness = () => {
  const { loading, members, scopeError } = useCallableFamilyMembers();

  return (
    <div>
      <div>loading:{String(loading)}</div>
      <div>error:{scopeError ?? "none"}</div>
      <div>members:{members.map((member) => member.fullName ?? member.email).join(",")}</div>
    </div>
  );
};

describe("useCallableFamilyMembers", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    mockState.role = {
      activeFamilyId: "family-1",
      isChild: false,
      profileId: "profile-current",
    };
    mockState.rpcResult = {
      data: [],
      error: null,
    };
    mockState.fallbackResult = {
      data: [],
      error: null,
    };
    mockState.rpc.mockReset();
    mockState.from.mockReset();
    mockState.rpc.mockImplementation(() => ({
      returns: vi.fn(async () => mockState.rpcResult),
    }));
    mockState.from.mockImplementation(() => {
      const query = {
        eq: vi.fn(() => query),
        in: vi.fn(() => query),
        neq: vi.fn(() => query),
        returns: vi.fn(async () => mockState.fallbackResult),
        select: vi.fn(() => query),
      };

      return query;
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
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

  it("falls back to active-family adult members for a parent when the RPC returns no contacts", async () => {
    mockState.fallbackResult = {
      data: [
        {
          id: "membership-coparent",
          profile_id: "profile-coparent",
          profiles: {
            avatar_url: null,
            email: "coparent@example.com",
            full_name: "Casey Co-Parent",
          },
          relationship_label: "Co-parent",
          role: "parent",
        },
      ],
      error: null,
    };

    await act(async () => {
      root?.render(<HookHarness />);
      await flushPromises();
    });

    expect(mockState.rpc).toHaveBeenCalledWith("get_callable_family_members", {
      p_family_id: "family-1",
    });
    expect(mockState.from).toHaveBeenCalledWith("family_members");
    expect(container?.textContent).toContain("loading:false");
    expect(container?.textContent).toContain("members:Casey Co-Parent");
    expect(container?.textContent).toContain("error:none");
  });

  it("does not use the adult fallback for child accounts when the RPC fails", async () => {
    mockState.role = {
      activeFamilyId: "family-1",
      isChild: true,
      profileId: "profile-child",
    };
    mockState.rpcResult = {
      data: [],
      error: { message: "Child calling access is not available." },
    };

    await act(async () => {
      root?.render(<HookHarness />);
      await flushPromises();
    });

    expect(mockState.from).not.toHaveBeenCalled();
    expect(container?.textContent).toContain("loading:false");
    expect(container?.textContent).toContain("members:");
    expect(container?.textContent).toContain("error:Child calling access is not available.");
  });
});
