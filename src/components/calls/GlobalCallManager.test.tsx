import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GlobalCallManager } from "@/components/calls/GlobalCallManager";
import { useFamilyRole } from "@/hooks/useFamilyRole";
import { useCallSessions } from "@/hooks/useCallSessions";
import { useDailyCall } from "@/hooks/useDailyCall";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("@/hooks/useFamilyRole", () => ({
  useFamilyRole: vi.fn(),
}));

vi.mock("@/hooks/useCallSessions", () => ({
  useCallSessions: vi.fn(),
}));

vi.mock("@/hooks/useDailyCall", () => ({
  useDailyCall: vi.fn(),
}));

vi.mock("@/components/calls/IncomingCallSheet", () => ({
  IncomingCallSheet: ({ onAccept, onDecline, open }: { onAccept: () => void; onDecline: () => void; open: boolean }) =>
    open ? (
      <div>
        <button type="button" onClick={onAccept}>
          Answer
        </button>
        <button type="button" onClick={onDecline}>
          Decline
        </button>
      </div>
    ) : null,
}));

vi.mock("@/components/calls/OutgoingCallSheet", () => ({
  OutgoingCallSheet: ({ onCancel, open }: { onCancel: () => void; open: boolean }) =>
    open ? (
      <button type="button" onClick={onCancel}>
        Cancel call
      </button>
    ) : null,
}));

const mockedUseFamilyRole = vi.mocked(useFamilyRole);
const mockedUseCallSessions = vi.mocked(useCallSessions);
const mockedUseDailyCall = vi.mocked(useDailyCall);

const activeSession = {
  answered_at: "2026-03-30T12:01:00.000Z",
  callee_display_name: "Taylor Tester",
  callee_profile_id: "profile-callee",
  callee_role_snapshot: "parent",
  call_type: "video",
  created_at: "2026-03-30T12:00:00.000Z",
  daily_room_name: "daily-room",
  daily_room_url: "https://example.daily.co/room",
  ended_at: null,
  ended_by_profile_id: null,
  failed_reason: null,
  family_id: "family-a",
  id: "call-1",
  initiator_display_name: "Pat Parent",
  initiator_profile_id: "profile-self",
  initiator_role_snapshot: "parent",
  room_expires_at: null,
  source: "messaging_hub",
  started_at: "2026-03-30T12:01:00.000Z",
  status: "accepted",
  thread_id: "thread-1",
  updated_at: "2026-03-30T12:01:00.000Z",
} as const;

describe("GlobalCallManager", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  const destroyCallObject = vi.fn().mockResolvedValue(undefined);
  const endCall = vi.fn().mockResolvedValue(null);
  const respondToCall = vi.fn().mockResolvedValue(null);

  const renderComponent = async () => {
    await act(async () => {
      root?.render(<GlobalCallManager />);
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  beforeEach(() => {
    mockedUseFamilyRole.mockReturnValue({
      activeFamilyId: "family-a",
      isChild: false,
      isParent: true,
      isThirdParty: false,
      loading: false,
      primaryParentId: "profile-self",
      profileId: "profile-self",
      relationshipLabel: null,
      role: "parent",
    });

    mockedUseCallSessions.mockReturnValue({
      activeSession: null,
      createCall: vi.fn(),
      currentThreadCall: null,
      endCall,
      fetchSessions: vi.fn(),
      incomingSession: null,
      loading: false,
      respondToCall,
      sessions: [],
    } as never);

    mockedUseDailyCall.mockReturnValue({
      callObject: null,
      currentCallSessionId: null,
      destroyCallObject,
      error: null,
      isJoined: false,
      isLocalAudioEnabled: true,
      isLocalVideoEnabled: true,
      joinCall: vi.fn().mockResolvedValue(undefined),
      localParticipant: null,
      meetingState: "new",
      remoteParticipant: null,
      toggleAudio: vi.fn(),
      toggleVideo: vi.fn(),
    } as never);

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

  it("keeps the active controls visible through the join transition and allows ending the call", async () => {
    mockedUseCallSessions.mockReturnValue({
      activeSession,
      createCall: vi.fn(),
      currentThreadCall: activeSession,
      endCall,
      fetchSessions: vi.fn(),
      incomingSession: null,
      loading: false,
      respondToCall,
      sessions: [activeSession],
    } as never);

    mockedUseDailyCall.mockReturnValue({
      callObject: null,
      currentCallSessionId: activeSession.id,
      destroyCallObject,
      error: null,
      isJoined: false,
      isLocalAudioEnabled: true,
      isLocalVideoEnabled: true,
      joinCall: vi.fn().mockResolvedValue(undefined),
      localParticipant: null,
      meetingState: "loading",
      remoteParticipant: null,
      toggleAudio: vi.fn(),
      toggleVideo: vi.fn(),
    } as never);

    await renderComponent();

    expect(container?.textContent).toContain("Video call in progress");
    expect(container?.textContent).toContain("End call");

    const endCallButton = Array.from(container?.querySelectorAll("button") ?? []).find((button) =>
      button.textContent?.includes("End call"),
    );

    expect(endCallButton).toBeTruthy();

    await act(async () => {
      endCallButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(endCall).toHaveBeenCalledWith(activeSession.id, "ended");
    expect(destroyCallObject).toHaveBeenCalledTimes(1);
  });

  it("keeps ringing-state sheets available when no active call panel is shown", async () => {
    mockedUseCallSessions.mockReturnValue({
      activeSession: null,
      createCall: vi.fn(),
      currentThreadCall: null,
      endCall,
      fetchSessions: vi.fn(),
      incomingSession: {
        ...activeSession,
        id: "call-2",
        status: "ringing",
      },
      loading: false,
      respondToCall,
      sessions: [
        {
          ...activeSession,
          id: "call-3",
          status: "ringing",
        },
      ],
    } as never);

    mockedUseDailyCall.mockReturnValue({
      callObject: null,
      currentCallSessionId: null,
      destroyCallObject,
      error: null,
      isJoined: false,
      isLocalAudioEnabled: true,
      isLocalVideoEnabled: true,
      joinCall: vi.fn().mockResolvedValue(undefined),
      localParticipant: null,
      meetingState: "new",
      remoteParticipant: null,
      toggleAudio: vi.fn(),
      toggleVideo: vi.fn(),
    } as never);

    await renderComponent();

    expect(container?.textContent).toContain("Answer");
    expect(container?.textContent).toContain("Decline");
    expect(container?.textContent).toContain("Cancel call");
  });
});
