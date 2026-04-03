import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFamily } from "@/contexts/FamilyContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useSchedulePersistence } from "@/hooks/useSchedulePersistence";
import { useScheduleRequests } from "@/hooks/useScheduleRequests";
import { useSportsEvents } from "@/hooks/useSportsEvents";
import CalendarPage from "@/pages/CalendarPage";

const familyMemberQuery = vi.hoisted(() => ({
  eq: vi.fn(),
  in: vi.fn(),
  select: vi.fn(),
}));

vi.mock("@/contexts/FamilyContext", () => ({
  useFamily: vi.fn(),
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: vi.fn(),
}));

vi.mock("@/hooks/useSchedulePersistence", () => ({
  useSchedulePersistence: vi.fn(),
}));

vi.mock("@/hooks/useScheduleRequests", () => ({
  useScheduleRequests: vi.fn(),
}));

vi.mock("@/hooks/useSportsEvents", () => ({
  useSportsEvents: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => familyMemberQuery),
  },
}));

vi.mock("@/components/dashboard/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/calendar/CalendarWizard", () => ({
  CalendarWizard: () => <div>calendar-wizard</div>,
}));

vi.mock("@/components/calendar/ScheduleChangeRequest", () => ({
  ScheduleChangeRequest: () => <div>schedule-change-request</div>,
}));

vi.mock("@/components/calendar/CalendarExportDialog", () => ({
  CalendarExportDialog: ({ open }: { open: boolean }) => (open ? <div>calendar-export-dialog</div> : null),
}));

vi.mock("@/components/calendar/SportsEventDetail", () => ({
  SportsEventDetail: () => <div>sports-event-detail</div>,
}));

vi.mock("@/components/calendar/SportsEventListPopup", () => ({
  SportsEventListPopup: () => null,
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: { children?: ReactNode; className?: string }) => <div {...props}>{children}</div>,
  },
}));

const mockedUseFamily = vi.mocked(useFamily);
const mockedUsePermissions = vi.mocked(usePermissions);
const mockedUseSchedulePersistence = vi.mocked(useSchedulePersistence);
const mockedUseScheduleRequests = vi.mocked(useScheduleRequests);
const mockedUseSportsEvents = vi.mocked(useSportsEvents);

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe("CalendarPage", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const renderPage = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <MemoryRouter>
          <CalendarPage />
        </MemoryRouter>,
      );
      await flushPromises();
    });

    return container;
  };

  beforeEach(() => {
    familyMemberQuery.select.mockReturnValue(familyMemberQuery);
    familyMemberQuery.eq.mockReturnValue(familyMemberQuery);
    familyMemberQuery.in.mockResolvedValue({
      data: [
        {
          profile_id: "profile-1",
          profiles: { email: "alex@example.com", full_name: "Alex Parent" },
        },
        {
          profile_id: "profile-2",
          profiles: { email: "jamie@example.com", full_name: "Jamie Parent" },
        },
      ],
      error: null,
    });

    mockedUseFamily.mockReturnValue({
      activeFamily: { display_name: "Morgan Family", id: "family-1" },
      activeFamilyId: "family-1",
      loading: false,
      memberships: [
        {
          accessKind: "family_member",
          familyId: "family-1",
          familyName: "Morgan Family",
          primaryParentId: "profile-1",
          relationshipLabel: null,
          role: "parent",
          status: "active",
        },
      ],
      profileId: "profile-1",
    } as never);

    mockedUsePermissions.mockReturnValue({
      isChildAccount: false,
      isThirdParty: false,
      permissions: {
        canAccessAuditLogs: false,
        canAccessSettings: true,
        canEditCalendar: true,
        canManageActivities: true,
        canManageChildren: true,
        canManageDocuments: true,
        canManageExpenses: true,
        canMutate: true,
        canSendMessages: true,
        canViewFullCalendar: true,
        isViewOnly: false,
        viewOnlyReason: null,
      },
    } as never);

    mockedUseSchedulePersistence.mockReturnValue({
      loading: false,
      saveSchedule: vi.fn(),
      saving: false,
      scheduleConfig: null,
    } as never);

    mockedUseScheduleRequests.mockReturnValue({
      createRequest: vi.fn(),
    } as never);

    mockedUseSportsEvents.mockReturnValue({
      getEventsForDate: vi.fn(() => []),
      hasEventsOnDate: vi.fn(() => false),
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

  it("fails closed with an explicit message when active family scope is missing", async () => {
    mockedUseFamily.mockReturnValue({
      activeFamily: null,
      activeFamilyId: null,
      loading: false,
      memberships: [
        {
          accessKind: "family_member",
          familyId: "family-1",
          familyName: "Morgan Family",
          primaryParentId: "profile-1",
          relationshipLabel: null,
          role: "parent",
          status: "active",
        },
      ],
      profileId: "profile-1",
    } as never);

    const rendered = await renderPage();

    expect(rendered.textContent).toContain("Family scope required");
    expect(rendered.textContent).toContain("does not infer which family you mean");
    expect(rendered.textContent).not.toContain("No parenting plan saved for this family");
  });

  it("does not invent a default schedule when the active family has no saved plan", async () => {
    const rendered = await renderPage();

    expect(rendered.textContent).toContain("No parenting plan saved for this family");
    expect(rendered.textContent).toContain("will not assume an alternating pattern");
    expect(rendered.textContent).not.toContain("Court-ready summary");
  });

  it("renders the saved family plan when schedule data exists", async () => {
    mockedUseSchedulePersistence.mockReturnValue({
      loading: false,
      saveSchedule: vi.fn(),
      saving: false,
      scheduleConfig: {
        alternateLocation: "Library",
        customPattern: undefined,
        exchangeLocation: "School office",
        exchangeTime: "6:00 PM",
        holidays: [{ name: "Thanksgiving", rule: "alternate" }],
        pattern: "2-2-3",
        startDate: new Date("2026-04-01T00:00:00.000Z"),
        startingParent: "A",
      },
    } as never);

    const rendered = await renderPage();

    expect(rendered.textContent).toContain("Current parenting plan");
    expect(rendered.textContent).toContain("Calendar view");
    expect(rendered.textContent).toContain("Court view");
    expect(rendered.textContent).toContain("2-2-3 rotation");
  });
});
