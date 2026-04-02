import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/contexts/AuthContext";
import { useCallSessions } from "@/hooks/useCallSessions";
import { useCallableFamilyMembers } from "@/hooks/useCallableFamilyMembers";
import { useChildAccount } from "@/hooks/useChildAccount";
import { useKidPortalAccess } from "@/hooks/useKidPortalAccess";
import { useKidsSchedule } from "@/hooks/useKidsSchedule";
import { useMoodCheckin } from "@/hooks/useMoodCheckin";
import { usePresenceHeartbeat } from "@/hooks/usePresenceHeartbeat";
import KidsDashboard from "@/pages/KidsDashboard";

const toast = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/useChildAccount", () => ({
  useChildAccount: vi.fn(),
}));

vi.mock("@/hooks/useKidsSchedule", () => ({
  useKidsSchedule: vi.fn(),
}));

vi.mock("@/hooks/useMoodCheckin", () => ({
  useMoodCheckin: vi.fn(),
}));

vi.mock("@/hooks/useCallableFamilyMembers", () => ({
  useCallableFamilyMembers: vi.fn(),
}));

vi.mock("@/hooks/useCallSessions", () => ({
  useCallSessions: vi.fn(),
}));

vi.mock("@/hooks/useKidPortalAccess", () => ({
  useKidPortalAccess: vi.fn(),
}));

vi.mock("@/hooks/usePresenceHeartbeat", () => ({
  usePresenceHeartbeat: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast,
  }),
}));

vi.mock("@/components/ui/LoadingSpinner", () => ({
  LoadingSpinner: ({ message }: { message?: string }) => <div>{message ?? "Loading..."}</div>,
}));

vi.mock("@/components/kids/KidsHomeHero", () => ({
  KidsHomeHero: ({ childName }: { childName: string }) => <div>hero:{childName}</div>,
}));

vi.mock("@/components/kids/KidsNavDock", () => ({
  KidsNavDock: () => <div>kids-nav-dock</div>,
}));

vi.mock("@/components/kids/ChildCallLauncher", () => ({
  ChildCallLauncher: ({ contacts }: { contacts: Array<{ fullName?: string | null }> }) => (
    <div>child-call-launcher:{contacts.length}</div>
  ),
}));

vi.mock("@/components/family/FamilyPresenceToggle", () => ({
  FamilyPresenceToggle: () => <div>family-presence-toggle</div>,
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      ...props
    }: {
      children?: ReactNode;
      className?: string;
    }) => <div {...props}>{children}</div>,
  },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseCallSessions = vi.mocked(useCallSessions);
const mockedUseCallableFamilyMembers = vi.mocked(useCallableFamilyMembers);
const mockedUseChildAccount = vi.mocked(useChildAccount);
const mockedUseKidPortalAccess = vi.mocked(useKidPortalAccess);
const mockedUseKidsSchedule = vi.mocked(useKidsSchedule);
const mockedUseMoodCheckin = vi.mocked(useMoodCheckin);
const mockedUsePresenceHeartbeat = vi.mocked(usePresenceHeartbeat);

const defaultUser = {
  email: "kid@example.com",
  id: "user-1",
};

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe("KidsDashboard", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const renderKidsDashboard = async (initialEntry = "/kids") => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/dashboard" element={<div>dashboard-page</div>} />
            <Route path="/dashboard/messages" element={<div>messages-page</div>} />
            <Route path="/kids/games/flappy-plane" element={<div>flappy-game-page</div>} />
            <Route path="/kids/portal" element={<div>kids-portal-page</div>} />
            <Route path="/login" element={<div>login-page</div>} />
            <Route path="/kids" element={<KidsDashboard />} />
          </Routes>
        </MemoryRouter>,
      );
      await flushPromises();
    });

    return container;
  };

  beforeEach(() => {
    toast.mockReset();

    mockedUseAuth.mockReturnValue({
      user: defaultUser,
      signOut: vi.fn(),
      loading: false,
    } as never);

    mockedUseChildAccount.mockReturnValue({
      allowed_game_slugs: ["flappy-plane"],
      allow_family_chat: false,
      allow_mood_checkins: true,
      allow_parent_messaging: true,
      call_mode: "audio_only",
      calling_enabled: true,
      child_name: "Milo",
      communication_enabled: true,
      games_enabled: true,
      isChildAccount: true,
      linkedChildId: "child-1",
      loading: false,
      multiplayer_enabled: true,
      portal_mode: "age_6_to_12",
      scopeError: null,
      show_full_event_details: true,
    } as never);

    mockedUseKidPortalAccess.mockReturnValue({
      loading: false,
      portalMode: "age_6_to_12",
      refresh: vi.fn(),
      requestAccess: vi.fn(),
      requestState: {
        dashboard_unlocked: true,
        id: null,
        requested_at: null,
        resolved_at: null,
        session_expires_at: null,
        status: "idle",
      },
      scopeError: null,
    } as never);

    mockedUseKidsSchedule.mockReturnValue({
      events: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    mockedUseMoodCheckin.mockReturnValue({
      todaysMood: null,
      recentMoods: [],
      loading: false,
      saving: false,
      saveMood: vi.fn().mockResolvedValue(true),
    } as never);

    mockedUseCallableFamilyMembers.mockReturnValue({
      loading: false,
      members: [
        {
          allowedCallMode: "audio_only",
          avatarUrl: null,
          email: "parent@example.com",
          fullName: "Parent One",
          membershipId: "membership-1",
          profileId: "profile-1",
          relationshipLabel: "Parent",
          role: "parent",
        },
      ],
      refresh: vi.fn(),
      scopeError: null,
    } as never);

    mockedUseCallSessions.mockReturnValue({
      createCall: vi.fn(),
    } as never);

    mockedUsePresenceHeartbeat.mockReturnValue({
      scopeError: null,
      updatePresence: vi.fn(),
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

  it("shows a loading state while auth or child permissions are resolving", async () => {
    mockedUseAuth.mockReturnValue({
      user: defaultUser,
      signOut: vi.fn(),
      loading: true,
    } as never);

    const rendered = await renderKidsDashboard();

    expect(rendered.textContent).toContain("Loading kids dashboard...");
  });

  it("renders the family presence toggle in the kids header", async () => {
    const rendered = await renderKidsDashboard();

    expect(rendered.textContent).toContain("family-presence-toggle");
  });

  it("redirects signed-in parent accounts to the main dashboard", async () => {
    mockedUseChildAccount.mockReturnValue({
      allowed_game_slugs: [],
      allow_family_chat: true,
      allow_mood_checkins: true,
      allow_parent_messaging: true,
      call_mode: "audio_video",
      calling_enabled: false,
      child_name: null,
      communication_enabled: false,
      games_enabled: false,
      isChildAccount: false,
      linkedChildId: null,
      loading: false,
      multiplayer_enabled: false,
      portal_mode: null,
      scopeError: null,
      show_full_event_details: true,
    } as never);

    const rendered = await renderKidsDashboard();
    expect(rendered.textContent).toContain("dashboard-page");
  });

  it("redirects signed-out users to login", async () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      signOut: vi.fn(),
      loading: false,
    } as never);

    const rendered = await renderKidsDashboard();
    expect(rendered.textContent).toContain("login-page");
  });

  it("redirects under-6 children to the portal when approval is still required", async () => {
    mockedUseChildAccount.mockReturnValue({
      allowed_game_slugs: ["flappy-plane"],
      allow_family_chat: false,
      allow_mood_checkins: true,
      allow_parent_messaging: true,
      call_mode: "audio_only",
      calling_enabled: true,
      child_name: "Milo",
      communication_enabled: true,
      games_enabled: true,
      isChildAccount: true,
      linkedChildId: "child-1",
      loading: false,
      multiplayer_enabled: true,
      portal_mode: "under_6",
      scopeError: null,
      show_full_event_details: true,
    } as never);

    mockedUseKidPortalAccess.mockReturnValue({
      loading: false,
      portalMode: "under_6",
      refresh: vi.fn(),
      requestAccess: vi.fn(),
      requestState: {
        dashboard_unlocked: false,
        id: "request-1",
        requested_at: null,
        resolved_at: null,
        session_expires_at: null,
        status: "pending",
      },
      scopeError: null,
    } as never);

    const rendered = await renderKidsDashboard();
    expect(rendered.textContent).toContain("kids-portal-page");
  });

  it("renders the redesigned child dashboard with the placeholder games and call launcher", async () => {
    const rendered = await renderKidsDashboard();

    expect(rendered.textContent).toContain("hero:Milo");
    expect(rendered.textContent).toContain("Play next");
    expect(rendered.textContent).toContain("Toy Plane Dash");
    expect(rendered.textContent).toContain("Fly now");
    expect(rendered.textContent).toContain("Animal Match");
    expect(rendered.textContent).toContain("Color Splash");
    expect(rendered.textContent).toContain("Treasure Train");
    expect(rendered.textContent).toContain("Sky Builder");
    expect(rendered.textContent).toContain("child-call-launcher:1");
    expect(rendered.textContent).toContain("Talk to family");
    expect(rendered.textContent).not.toContain("dashboard-page");
  });
});
