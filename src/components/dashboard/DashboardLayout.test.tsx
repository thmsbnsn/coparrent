import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useChildAccount } from "@/hooks/useChildAccount";
import { useFamilyRole } from "@/hooks/useFamilyRole";

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
  ) => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={[initialPath]}>
          <DashboardLayout userRole={userRole}>
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

    expect(rendered.querySelector("#nav-dashboard")).not.toBeNull();
    expect(rendered.querySelector("#nav-calendar")).not.toBeNull();
    expect(rendered.querySelector("#nav-messages")).not.toBeNull();
    expect(rendered.querySelector("#nav-journal")).not.toBeNull();
    expect(rendered.querySelector("#nav-law-library")).not.toBeNull();
    expect(rendered.querySelector("#nav-blog")).not.toBeNull();

    expect(rendered.querySelector("#nav-children")).toBeNull();
    expect(rendered.querySelector("#nav-sports")).toBeNull();
    expect(rendered.querySelector("#nav-kids-hub")).toBeNull();
    expect(rendered.querySelector("#nav-documents")).toBeNull();
    expect(rendered.querySelector("#nav-expenses")).toBeNull();
    expect(rendered.querySelector("#nav-settings")).toBeNull();
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

    expect(rendered.querySelector("#nav-calendar")).not.toBeNull();
    expect(rendered.querySelector("#nav-messages")).not.toBeNull();

    expect(rendered.querySelector("#nav-dashboard")).toBeNull();
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
  });
});
