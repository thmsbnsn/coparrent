import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFamily } from "@/contexts/FamilyContext";
import { useKidPortalApprovals } from "@/hooks/useKidPortalApprovals";

const rpcMock = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/FamilyContext", () => ({
  useFamily: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
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
  const { decideRequest, requests, scopeError } = useKidPortalApprovals();

  return (
    <div>
      <div data-testid="count">{String(requests.length)}</div>
      <div data-testid="scope">{scopeError ?? ""}</div>
      <button
        type="button"
        onClick={() => {
          const firstRequest = requests[0];
          if (firstRequest) {
            void decideRequest(firstRequest.id, "approve");
          }
        }}
      >
        approve-first
      </button>
    </div>
  );
};

describe("useKidPortalApprovals", () => {
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
    mockedUseFamily.mockReturnValue({
      activeFamilyId: "family-1",
      isParentInActiveFamily: true,
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
    } as never);

    const rendered = await renderHarness();

    expect(rendered.querySelector('[data-testid="scope"]')?.textContent).toContain("active family");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("loads pending approval requests for the active family", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          child_id: "child-1",
          child_name: "Milo",
          id: "request-1",
          portal_mode: "under_6",
          requested_at: "2026-04-01T12:00:00.000Z",
          requested_by_name: "Milo",
          requested_by_profile_id: "profile-1",
          status: "pending",
        },
      ],
      error: null,
    });

    const rendered = await renderHarness();

    expect(rendered.querySelector('[data-testid="count"]')?.textContent).toBe("1");
    expect(rpcMock).toHaveBeenCalledWith("get_pending_family_kid_portal_requests", {
      p_family_id: "family-1",
    });
  });

  it("removes a request from local state after approval succeeds", async () => {
    rpcMock
      .mockResolvedValueOnce({
        data: [
          {
            child_id: "child-1",
            child_name: "Milo",
            id: "request-1",
            portal_mode: "under_6",
            requested_at: "2026-04-01T12:00:00.000Z",
            requested_by_name: "Milo",
            requested_by_profile_id: "profile-1",
            status: "pending",
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        error: null,
      });

    const rendered = await renderHarness();

    await act(async () => {
      rendered.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushPromises();
    });

    expect(rendered.querySelector('[data-testid="count"]')?.textContent).toBe("0");
    expect(rpcMock).toHaveBeenLastCalledWith("rpc_decide_kid_portal_access_request", {
      p_decision: "approve",
      p_family_id: "family-1",
      p_request_id: "request-1",
    });
  });
});
