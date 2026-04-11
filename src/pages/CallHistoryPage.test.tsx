import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CallHistoryPage from "@/pages/CallHistoryPage";
import { useCallHistory } from "@/hooks/useCallHistory";
import { useCallSessions } from "@/hooks/useCallSessions";
import { useFamilyRole } from "@/hooks/useFamilyRole";

const mockState = vi.hoisted(() => ({
  createCall: vi.fn(),
  history: {
    calls: [] as unknown[],
    loading: false,
    refresh: vi.fn(),
    scopeError: null as string | null,
  },
  role: {
    activeFamilyId: "family-1",
    profileId: "profile-current",
  },
}));

vi.mock("@/hooks/useCallHistory", () => ({
  useCallHistory: vi.fn(),
}));

vi.mock("@/hooks/useCallSessions", () => ({
  useCallSessions: vi.fn(),
}));

vi.mock("@/hooks/useFamilyRole", () => ({
  useFamilyRole: vi.fn(),
}));

vi.mock("@/components/dashboard/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/LoadingSpinner", () => ({
  LoadingSpinner: () => <div>loading-spinner</div>,
}));

const mockedUseCallHistory = vi.mocked(useCallHistory);
const mockedUseCallSessions = vi.mocked(useCallSessions);
const mockedUseFamilyRole = vi.mocked(useFamilyRole);

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("CallHistoryPage", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    mockState.createCall.mockReset();
    mockState.history = {
      calls: [
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
      loading: false,
      refresh: vi.fn(),
      scopeError: null,
    };
    mockState.role = {
      activeFamilyId: "family-1",
      profileId: "profile-current",
    };
    mockState.createCall.mockResolvedValue({ id: "new-call" });

    mockedUseCallHistory.mockImplementation(() => mockState.history as never);
    mockedUseCallSessions.mockImplementation(() => ({
      activeSession: null,
      createCall: mockState.createCall,
      incomingSession: null,
      sessions: [],
    }) as never);
    mockedUseFamilyRole.mockImplementation(() => mockState.role as never);

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

  const renderPage = async () => {
    await act(async () => {
      root?.render(
        <MemoryRouter>
          <CallHistoryPage />
        </MemoryRouter>,
      );
      await flushPromises();
    });

    return container;
  };

  it("shows call direction, timestamps, and calls the other participant back through the server path", async () => {
    const rendered = await renderPage();

    expect(rendered?.textContent).toContain("You called Alex Co-Parent");
    expect(rendered?.textContent).toContain("You made this call");
    expect(rendered?.textContent).toContain("Outgoing");
    expect(rendered?.textContent).toContain("Started:");

    const callBackButton = rendered?.querySelector<HTMLButtonElement>('button[aria-label="Call Alex Co-Parent back"]');
    expect(callBackButton).not.toBeNull();

    await act(async () => {
      callBackButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushPromises();
    });

    expect(mockState.createCall).toHaveBeenCalledWith({
      callType: "audio",
      calleeProfileId: "profile-other",
      source: "dashboard",
    });
    expect(mockState.history.refresh).toHaveBeenCalledTimes(1);
  });

  it("renders explicit scope errors instead of a call list", async () => {
    mockState.history = {
      calls: [],
      loading: false,
      refresh: vi.fn(),
      scopeError: "An active family and profile are required before loading call history.",
    };

    const rendered = await renderPage();

    expect(rendered?.textContent).toContain("Call history is unavailable");
    expect(rendered?.textContent).toContain("An active family and profile are required before loading call history.");
    expect(rendered?.textContent).not.toContain("Call back");
  });
});
