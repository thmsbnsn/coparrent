import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useChildAccount } from "@/hooks/useChildAccount";
import { useFamilyRole } from "@/hooks/useFamilyRole";
import { usePresenceHeartbeat } from "@/hooks/usePresenceHeartbeat";

const toast = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/useFamilyRole", () => ({
  useFamilyRole: vi.fn(),
}));

vi.mock("@/hooks/useChildAccount", () => ({
  useChildAccount: vi.fn(),
}));

vi.mock("@/hooks/usePresenceHeartbeat", () => ({
  usePresenceHeartbeat: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              email: "parent@example.com",
              full_name: "Casey Parent",
            },
            error: null,
          }),
        }),
      }),
    }),
  },
}));

vi.mock("@/components/notifications/NotificationDropdown", () => ({
  NotificationDropdown: () => <div>notification-dropdown</div>,
}));

vi.mock("@/components/dashboard/TrialBadge", () => ({
  TrialBadge: () => <div>trial-badge</div>,
}));

vi.mock("@/components/ui/ThemeToggle", () => ({
  ThemeToggle: () => <div>theme-toggle</div>,
}));

vi.mock("@/components/onboarding/OnboardingOverlay", () => ({
  OnboardingOverlay: () => <div>onboarding-overlay</div>,
}));

vi.mock("@/components/family/FamilySwitcher", () => ({
  FamilySwitcher: () => <div>family-switcher</div>,
}));

vi.mock("@/components/family/FamilyPresenceToggle", () => ({
  FamilyPresenceToggle: () => <div>family-presence-toggle</div>,
}));

vi.mock("@/components/ui/Logo", () => ({
  Logo: () => <div>logo</div>,
}));

vi.mock("@/components/calls/GlobalCallManager", () => ({
  GlobalCallManager: () => <div>global-call-manager</div>,
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
  motion: {
    aside: ({ children, ...props }: { children?: ReactNode }) => <aside {...props}>{children}</aside>,
    div: ({ children, ...props }: { children?: ReactNode }) => <div {...props}>{children}</div>,
  },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseFamilyRole = vi.mocked(useFamilyRole);
const mockedUseChildAccount = vi.mocked(useChildAccount);
const mockedUsePresenceHeartbeat = vi.mocked(usePresenceHeartbeat);

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("DashboardLayout", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    toast.mockReset();

    mockedUseAuth.mockReturnValue({
      signOut: vi.fn(),
      user: { email: "parent@example.com", id: "user-1" },
    } as never);
    mockedUseFamilyRole.mockReturnValue({
      activeFamilyId: "family-1",
      isChild: false,
      isLawOffice: false,
      isThirdParty: false,
      loading: false,
    } as never);
    mockedUseChildAccount.mockReturnValue({
      isChildAccount: false,
      loading: false,
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

  const renderLayout = async (
    initialPath = "/dashboard",
    userRole: "parent" | "lawoffice" = "parent",
    headerActions?: ReactNode,
  ) => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={[initialPath]}>
          <DashboardLayout userRole={userRole} headerActions={headerActions}>
            <div>layout-content</div>
          </DashboardLayout>
        </MemoryRouter>,
      );
      await flushPromises();
    });

    return container;
  };

  it("shows only third-party-allowed dashboard links for third-party users", async () => {
    mockedUseFamilyRole.mockReturnValue({
      activeFamilyId: "family-1",
      isChild: false,
      isLawOffice: false,
      isThirdParty: true,
      loading: false,
    } as never);

    const rendered = await renderLayout("/dashboard/messages");
    const gamesLink = rendered.querySelector<HTMLAnchorElement>("#nav-games");

    expect(rendered.querySelector("#nav-dashboard")).not.toBeNull();
    expect(gamesLink).not.toBeNull();
    expect(gamesLink?.getAttribute("href")).toBe("/dashboard/games");
    expect(rendered.querySelector("#nav-calendar")).not.toBeNull();
    expect(rendered.querySelector("#nav-messages")).not.toBeNull();
    expect(rendered.querySelector("#nav-calls")).not.toBeNull();
    expect(rendered.querySelector("#nav-journal")).not.toBeNull();
    expect(rendered.querySelector("#nav-law-library")).not.toBeNull();
    expect(rendered.querySelector("#nav-blog")).not.toBeNull();

    expect(rendered.querySelector("#nav-children")).toBeNull();
    expect(rendered.querySelector("#nav-sports")).toBeNull();
    expect(rendered.querySelector("#nav-kids-hub")).toBeNull();
    expect(rendered.querySelector("#nav-documents")).toBeNull();
    expect(rendered.querySelector("#nav-expenses")).toBeNull();
    expect(rendered.querySelector("#nav-settings")).toBeNull();
    expect(rendered.textContent).not.toContain("family-presence-toggle");
  });

  it("keeps child-scoped users limited to child-allowed navigation links", async () => {
    mockedUseFamilyRole.mockReturnValue({
      activeFamilyId: "family-1",
      isChild: true,
      isLawOffice: false,
      isThirdParty: false,
      loading: false,
    } as never);
    mockedUseChildAccount.mockReturnValue({
      isChildAccount: true,
      loading: false,
    } as never);

    const rendered = await renderLayout("/dashboard/calendar");
    const gamesLink = rendered.querySelector<HTMLAnchorElement>("#nav-games");

    expect(rendered.querySelector("#nav-calendar")).not.toBeNull();
    expect(gamesLink).not.toBeNull();
    expect(gamesLink?.getAttribute("href")).toBe("/dashboard/games");
    expect(rendered.querySelector("#nav-messages")).not.toBeNull();

    expect(rendered.querySelector("#nav-dashboard")).toBeNull();
    expect(rendered.querySelector("#nav-calls")).toBeNull();
    expect(rendered.querySelector("#nav-children")).toBeNull();
    expect(rendered.querySelector("#nav-journal")).toBeNull();
    expect(rendered.querySelector("#nav-law-library")).toBeNull();
    expect(rendered.querySelector("#nav-settings")).toBeNull();
  });

  it("shows only the law office dashboard navigation for law office layouts", async () => {
    mockedUseFamilyRole.mockReturnValue({
      activeFamilyId: null,
      isChild: false,
      isLawOffice: true,
      isThirdParty: false,
      loading: false,
    } as never);

    const rendered = await renderLayout("/law-office/dashboard", "lawoffice");

    expect(rendered.querySelector("#nav-law-office-dashboard")).not.toBeNull();
    expect(rendered.querySelector("#nav-dashboard")).toBeNull();
    expect(rendered.textContent).not.toContain("trial-badge");
    expect(rendered.textContent).not.toContain("onboarding-overlay");
    expect(rendered.textContent).not.toContain("global-call-manager");
    expect(rendered.textContent).not.toContain("family-presence-toggle");
  });

  it("renders page-level header actions when provided", async () => {
    const rendered = await renderLayout("/dashboard", "parent", <button>header-call</button>);

    expect(rendered.textContent).toContain("header-call");
  });

  it("shows a mobile header title, links the avatar to settings, and keeps settings out of the main nav", async () => {
    const rendered = await renderLayout("/dashboard/messages");
    const mobileHeaderTitle = rendered.querySelector("[data-mobile-header-title]");
    const settingsLinks = Array.from(rendered.querySelectorAll<HTMLAnchorElement>('a[href="/dashboard/settings"]'));

    expect(mobileHeaderTitle?.textContent).toBe("Messages");
    expect(settingsLinks.length).toBeGreaterThan(0);
    expect(rendered.querySelector("#nav-settings")).toBeNull();
  });

  it("renders parent navigation in the updated order", async () => {
    const rendered = await renderLayout("/dashboard");
    const navIds = Array.from(rendered.querySelectorAll<HTMLAnchorElement>("nav a[id]")).map((link) => link.id);

    expect(navIds.slice(0, 13)).toEqual([
      "nav-dashboard",
      "nav-messages",
      "nav-calendar",
      "nav-calls",
      "nav-children",
      "nav-sports",
      "nav-games",
      "nav-kids-hub",
      "nav-documents",
      "nav-expenses",
      "nav-journal",
      "nav-law-library",
      "nav-blog",
    ]);
  });

  it("can hide the family presence toggle when a page opts out", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={["/dashboard/games"]}>
          <DashboardLayout showFamilyPresenceToggle={false}>
            <div>layout-content</div>
          </DashboardLayout>
        </MemoryRouter>,
      );
      await flushPromises();
    });

    expect(container.textContent).not.toContain("family-presence-toggle");
  });

  it("shows the family presence toggle only when a page opts in", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={["/dashboard/games"]}>
          <DashboardLayout showFamilyPresenceToggle>
            <div>layout-content</div>
          </DashboardLayout>
        </MemoryRouter>,
      );
      await flushPromises();
    });

    expect(container.textContent).toContain("family-presence-toggle");
  });
});
