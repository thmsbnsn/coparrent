import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCallHistory } from "@/hooks/useCallHistory";
import { CALL_SESSION_MUTATION_EVENT } from "@/hooks/useCallSessions";

type QueryLog =
  | { method: "eq"; field: string; value: unknown }
  | { method: "limit"; value: number }
  | { method: "or"; value: string }
  | { method: "order"; field: string; options: { ascending?: boolean } | undefined }
  | { method: "select"; columns: string };

const mockState = vi.hoisted(() => ({
  from: vi.fn(),
  queryLogs: [] as QueryLog[],
  result: {
    data: [] as unknown[],
    error: null as { message: string } | null,
  },
  role: {
    activeFamilyId: "family-1",
    profileId: "profile-current",
  },
}));

vi.mock("@/hooks/useFamilyRole", () => ({
  useFamilyRole: () => mockState.role,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockState.from,
  },
}));

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const HookHarness = () => {
  const { calls, loading, scopeError } = useCallHistory();

  return (
    <div>
      <div>loading:{String(loading)}</div>
      <div>error:{scopeError ?? "none"}</div>
      <div>calls:{calls.map((call) => call.id).join(",")}</div>
    </div>
  );
};

describe("useCallHistory", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    mockState.role = {
      activeFamilyId: "family-1",
      profileId: "profile-current",
    };
    mockState.result = {
      data: [],
      error: null,
    };
    mockState.queryLogs = [];
    mockState.from.mockReset();
    mockState.from.mockImplementation(() => {
      const query = {
        eq: (field: string, value: unknown) => {
          mockState.queryLogs.push({ field, method: "eq", value });
          return query;
        },
        limit: (value: number) => {
          mockState.queryLogs.push({ method: "limit", value });
          return query;
        },
        or: (value: string) => {
          mockState.queryLogs.push({ method: "or", value });
          return query;
        },
        order: (field: string, options?: { ascending?: boolean }) => {
          mockState.queryLogs.push({ field, method: "order", options });
          return query;
        },
        returns: vi.fn(async () => mockState.result),
        select: (columns: string) => {
          mockState.queryLogs.push({ columns, method: "select" });
          return query;
        },
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

  it("loads call history only for the active family and current participant", async () => {
    mockState.result = {
      data: [
        {
          answered_at: "2026-04-10T15:01:00.000Z",
          callee_display_name: "Alex Co-Parent",
          callee_profile_id: "profile-other",
          call_type: "audio",
          created_at: "2026-04-10T15:00:00.000Z",
          ended_at: "2026-04-10T15:05:00.000Z",
          family_id: "family-1",
          id: "call-1",
          initiator_display_name: "Current Parent",
          initiator_profile_id: "profile-current",
          source: "dashboard",
          status: "ended",
          thread_id: "thread-1",
        },
      ],
      error: null,
    };

    await act(async () => {
      root?.render(<HookHarness />);
      await flushPromises();
    });

    expect(mockState.from).toHaveBeenCalledWith("call_sessions");
    expect(mockState.queryLogs).toContainEqual(expect.objectContaining({
      field: "family_id",
      method: "eq",
      value: "family-1",
    }));
    expect(mockState.queryLogs).toContainEqual({
      method: "or",
      value: "initiator_profile_id.eq.profile-current,callee_profile_id.eq.profile-current",
    });
    expect(mockState.queryLogs).toContainEqual({
      field: "created_at",
      method: "order",
      options: { ascending: false },
    });
    expect(mockState.queryLogs).toContainEqual({ method: "limit", value: 50 });
    expect(container?.textContent).toContain("loading:false");
    expect(container?.textContent).toContain("error:none");
    expect(container?.textContent).toContain("calls:call-1");
  });

  it("fails closed without an active family or profile", async () => {
    mockState.role = {
      activeFamilyId: null,
      profileId: "profile-current",
    };

    await act(async () => {
      root?.render(<HookHarness />);
      await flushPromises();
    });

    expect(mockState.from).not.toHaveBeenCalled();
    expect(container?.textContent).toContain("loading:false");
    expect(container?.textContent).toContain("An active family and profile are required before loading call history.");
  });

  it("refreshes when another call surface mutates a call session", async () => {
    mockState.result = {
      data: [
        {
          answered_at: null,
          callee_display_name: "Alex Co-Parent",
          callee_profile_id: "profile-other",
          call_type: "video",
          created_at: "2026-04-10T15:00:00.000Z",
          ended_at: null,
          family_id: "family-1",
          id: "call-ringing",
          initiator_display_name: "Current Parent",
          initiator_profile_id: "profile-current",
          source: "dashboard",
          status: "ringing",
          thread_id: null,
        },
      ],
      error: null,
    };

    await act(async () => {
      root?.render(<HookHarness />);
      await flushPromises();
    });

    expect(container?.textContent).toContain("calls:call-ringing");

    mockState.result = {
      data: [
        {
          answered_at: null,
          callee_display_name: "Alex Co-Parent",
          callee_profile_id: "profile-other",
          call_type: "video",
          created_at: "2026-04-10T15:00:00.000Z",
          ended_at: "2026-04-10T15:00:30.000Z",
          family_id: "family-1",
          id: "call-cancelled",
          initiator_display_name: "Current Parent",
          initiator_profile_id: "profile-current",
          source: "dashboard",
          status: "cancelled",
          thread_id: null,
        },
      ],
      error: null,
    };

    await act(async () => {
      window.dispatchEvent(new Event(CALL_SESSION_MUTATION_EVENT));
      await flushPromises();
    });

    expect(mockState.from).toHaveBeenCalledTimes(2);
    expect(container?.textContent).toContain("calls:call-cancelled");
  });
});
