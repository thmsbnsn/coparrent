import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/contexts/AuthContext";
import { useChildAccount } from "@/hooks/useChildAccount";
import { useKidsSchedule } from "@/hooks/useKidsSchedule";
import { useMoodCheckin } from "@/hooks/useMoodCheckin";
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

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock("@/components/ui/LoadingSpinner", () => ({
  LoadingSpinner: ({ message }: { message?: string }) => <div>{message ?? "Loading..."}</div>,
}));

vi.mock("@/components/ui/ThemeToggle", () => ({
  ThemeToggle: () => <div>theme-toggle</div>,
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
    button: ({
      children,
      ...props
    }: {
      children?: ReactNode;
      className?: string;
      onClick?: () => void;
      disabled?: boolean;
    }) => <button {...props}>{children}</button>,
  },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseChildAccount = vi.mocked(useChildAccount);
const mockedUseKidsSchedule = vi.mocked(useKidsSchedule);
const mockedUseMoodCheckin = vi.mocked(useMoodCheckin);

const defaultUser = {
  id: "user-1",
  email: "kid@example.com",
};

const defaultPermissions = {
  is_child: true,
  allow_parent_messaging: true,
  allow_family_chat: false,
  allow_sibling_messaging: false,
  allow_push_notifications: false,
  allow_calendar_reminders: false,
  show_full_event_details: true,
  allow_mood_checkins: true,
  allow_notes_to_parents: false,
  login_enabled: true,
};

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe("KidsDashboard", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const renderKidsDashboard = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={["/kids"]}>
          <Routes>
            <Route path="/dashboard" element={<div>dashboard-page</div>} />
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
      isChildAccount: true,
      permissions: defaultPermissions,
      linkedChildId: null,
      loading: false,
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
      saveMood: vi.fn(),
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

    expect(rendered.textContent).toContain("Loading...");
  });

  it("redirects signed-in parent accounts to the main dashboard", async () => {
    mockedUseChildAccount.mockReturnValue({
      isChildAccount: false,
      permissions: defaultPermissions,
      linkedChildId: null,
      loading: false,
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
    mockedUseChildAccount.mockReturnValue({
      isChildAccount: false,
      permissions: defaultPermissions,
      linkedChildId: null,
      loading: false,
    } as never);

    const rendered = await renderKidsDashboard();

    expect(rendered.textContent).toContain("login-page");
  });

  it("renders the child dashboard for linked child accounts", async () => {
    const rendered = await renderKidsDashboard();

    expect(rendered.textContent).toContain("Hi, there!");
    expect(rendered.textContent).toContain("No events today");
    expect(rendered.textContent).toContain("Tap to see messages from your family");
    expect(rendered.textContent).not.toContain("dashboard-page");
    expect(rendered.textContent).not.toContain("login-page");
  });
});
