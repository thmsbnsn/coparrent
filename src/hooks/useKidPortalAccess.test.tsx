import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFamily } from "@/contexts/FamilyContext";
import { useChildAccount } from "@/hooks/useChildAccount";
import { useKidPortalAccess } from "@/hooks/useKidPortalAccess";

const rpcMock = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/FamilyContext", () => ({
  useFamily: vi.fn(),
}));

vi.mock("@/hooks/useChildAccount", () => ({
  useChildAccount: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

const mockedUseFamily = vi.mocked(useFamily);
const mockedUseChildAccount = vi.mocked(useChildAccount);

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const Harness = () => {
  const { requestAccess, requestState, scopeError } = useKidPortalAccess();

  return (
    <div>
      <div data-testid="status">{requestState.status}</div>
      <div data-testid="scope">{scopeError ?? ""}</div>
      <button onClick={() => void requestAccess()}>request</button>
    </div>
  );
};

describe("useKidPortalAccess", () => {
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
    } as never);
    mockedUseChildAccount.mockReturnValue({
      isChildAccount: true,
      loading: false,
      portal_mode: "under_6",
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
    } as never);

    const rendered = await renderHarness();

    expect(rendered.querySelector('[data-testid="scope"]')?.textContent).toContain("active family");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("loads the server-backed request state for under-6 portal mode", async () => {
    rpcMock.mockResolvedValueOnce({
      data: {
        dashboard_unlocked: false,
        id: "request-1",
        requested_at: "2026-04-01T12:00:00.000Z",
        resolved_at: null,
        session_expires_at: null,
        status: "pending",
      },
      error: null,
    });

    const rendered = await renderHarness();

    expect(rendered.querySelector('[data-testid="status"]')?.textContent).toBe("pending");
    expect(rpcMock).toHaveBeenCalledWith("get_kid_portal_request_state", {
      p_family_id: "family-1",
    });
  });

  it("updates state when the child requests access", async () => {
    rpcMock
      .mockResolvedValueOnce({
        data: {
          dashboard_unlocked: false,
          id: null,
          requested_at: null,
          resolved_at: null,
          session_expires_at: null,
          status: "idle",
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: "request-2",
          requested_at: "2026-04-01T12:05:00.000Z",
          session_expires_at: null,
          status: "pending",
        },
        error: null,
      });

    const rendered = await renderHarness();

    await act(async () => {
      rendered.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushPromises();
    });

    expect(rendered.querySelector('[data-testid="status"]')?.textContent).toBe("pending");
    expect(rpcMock).toHaveBeenLastCalledWith("rpc_request_kid_portal_access", {
      p_family_id: "family-1",
    });
  });
});
