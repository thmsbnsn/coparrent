import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "@/pages/Dashboard";
import { useAuth } from "@/contexts/AuthContext";
import { useCallSessions } from "@/hooks/useCallSessions";
import { useCallableFamilyMembers } from "@/hooks/useCallableFamilyMembers";
import { useFamilyRole } from "@/hooks/useFamilyRole";
import { useRealtimeChildren } from "@/hooks/useRealtimeChildren";
import { fetchFamilyParentProfiles } from "@/lib/familyScope";

type JsonRecord = Record<string, unknown>;
type FilterLog =
  | { field: string; type: "eq"; value: unknown }
  | { field: string; type: "gte"; value: unknown }
  | { field: string; type: "in"; value: unknown[] };

const selectLogs = vi.hoisted(() => [] as Array<{ columns: string; filters: FilterLog[]; table: string }>);

const queryState = vi.hoisted(() => ({
  custodySchedules: [] as JsonRecord[],
  journalEntries: [] as JsonRecord[],
  messageThreads: [] as JsonRecord[],
  profiles: [] as JsonRecord[],
  threadMessages: [] as JsonRecord[],
}));

const cloneValue = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      let columns = "";
      const filters: FilterLog[] = [];
      let limitCount: number | null = null;
      let orderBy: { ascending: boolean; field: string } | null = null;
      let countMode = false;

      const getTableRows = () => {
        switch (table) {
          case "custody_schedules":
            return queryState.custodySchedules;
          case "journal_entries":
            return queryState.journalEntries;
          case "message_threads":
            return queryState.messageThreads;
          case "profiles":
            return queryState.profiles;
          case "thread_messages":
            return queryState.threadMessages;
          default:
            return [];
        }
      };

      const matches = (row: JsonRecord) =>
        filters.every((filter) => {
          const fieldValue = row[filter.field];
          if (filter.type === "eq") {
            return fieldValue === filter.value;
          }

          if (filter.type === "in") {
            return filter.value.includes(fieldValue);
          }

          return String(fieldValue ?? "") >= String(filter.value ?? "");
        });

      const getRows = () => {
        let rows = getTableRows().filter(matches).map(cloneValue);

        if (orderBy) {
          rows = rows.sort((left, right) => {
            const leftValue = String(left[orderBy.field] ?? "");
            const rightValue = String(right[orderBy.field] ?? "");
            const comparison = leftValue.localeCompare(rightValue);
            return orderBy.ascending ? comparison : comparison * -1;
          });
        }

        if (typeof limitCount === "number") {
          rows = rows.slice(0, limitCount);
        }

        return rows;
      };

      const builder = {
        eq: (field: string, value: unknown) => {
          filters.push({ field, type: "eq", value });
          return builder;
        },
        gte: (field: string, value: unknown) => {
          filters.push({ field, type: "gte", value });
          return builder;
        },
        in: (field: string, value: unknown[]) => {
          filters.push({ field, type: "in", value: cloneValue(value) });
          return builder;
        },
        limit: (value: number) => {
          limitCount = value;
          return builder;
        },
        order: (field: string, options?: { ascending?: boolean }) => {
          orderBy = { ascending: options?.ascending ?? true, field };
          return builder;
        },
        select: (nextColumns: string, options?: { count?: string; head?: boolean }) => {
          columns = nextColumns;
          countMode = options?.count === "exact" && options.head === true;
          return builder;
        },
        maybeSingle: async () => {
          const rows = getRows();
          selectLogs.push({ columns, filters: cloneValue(filters), table });
          return {
            count: countMode ? rows.length : null,
            data: rows[0] ?? null,
            error: null,
          };
        },
        then: (
          onfulfilled?: ((value: { count: number | null; data: JsonRecord[] | null; error: null }) => unknown) | null,
          onrejected?: ((reason: unknown) => unknown) | null,
        ) => {
          const rows = getRows();
          selectLogs.push({ columns, filters: cloneValue(filters), table });
          return Promise.resolve({
            count: countMode ? rows.length : null,
            data: countMode ? null : rows,
            error: null,
          }).then(onfulfilled ?? undefined, onrejected ?? undefined);
        },
      };

      return builder;
    },
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/useCallSessions", () => ({
  useCallSessions: vi.fn(),
}));

vi.mock("@/hooks/useCallableFamilyMembers", () => ({
  useCallableFamilyMembers: vi.fn(),
}));

vi.mock("@/hooks/useFamilyRole", () => ({
  useFamilyRole: vi.fn(),
}));

vi.mock("@/hooks/useRealtimeChildren", () => ({
  useRealtimeChildren: vi.fn(),
}));

vi.mock("@/lib/familyScope", () => ({
  fetchFamilyParentProfiles: vi.fn(),
}));

vi.mock("@/components/dashboard/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ asChild, children, ...props }: { asChild?: boolean; children?: ReactNode }) =>
    asChild ? <div {...props}>{children}</div> : <button {...props}>{children}</button>,
}));

vi.mock("@/components/ui/LoadingSpinner", () => ({
  LoadingSpinner: () => <div>loading-spinner</div>,
}));

vi.mock("@/components/exchange/ExchangeCheckin", () => ({
  ExchangeCheckin: () => <div>exchange-checkin</div>,
}));

vi.mock("@/components/dashboard/SubscriptionBanner", () => ({
  SubscriptionBanner: () => <div>subscription-banner</div>,
}));

vi.mock("@/components/calls/DashboardCallWidget", () => ({
  DashboardCallWidget: () => <div>dashboard-call-widget</div>,
}));

vi.mock("@/components/dashboard/BlogDashboardCard", () => ({
  BlogDashboardCard: () => <div>blog-dashboard-card</div>,
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: { children?: ReactNode }) => <div {...props}>{children}</div>,
  },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseCallSessions = vi.mocked(useCallSessions);
const mockedUseCallableFamilyMembers = vi.mocked(useCallableFamilyMembers);
const mockedUseFamilyRole = vi.mocked(useFamilyRole);
const mockedUseRealtimeChildren = vi.mocked(useRealtimeChildren);
const mockedFetchFamilyParentProfiles = vi.mocked(fetchFamilyParentProfiles);

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe("Dashboard family scoping", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let familyState: {
    activeFamilyId: string | null;
  };

  const renderDashboard = async () => {
    if (!container) {
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
    }

    await act(async () => {
      root?.render(
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>,
      );
      await flushPromises();
    });

    return container;
  };

  beforeEach(() => {
    selectLogs.length = 0;
    queryState.custodySchedules = [
      {
        exchange_location: "School",
        exchange_time: "17:00",
        family_id: "family-a",
        id: "schedule-a",
        pattern: "weekly",
        start_date: "2026-03-01",
      },
      {
        exchange_location: "Library",
        exchange_time: "18:00",
        family_id: "family-b",
        id: "schedule-b",
        pattern: "biweekly",
        start_date: "2026-03-05",
      },
    ];
    queryState.journalEntries = [
      { created_at: "2026-03-02T10:00:00.000Z", id: "journal-1", user_id: "user-parent" },
      { created_at: "2026-03-10T10:00:00.000Z", id: "journal-2", user_id: "user-parent" },
    ];
    queryState.messageThreads = [
      { family_id: "family-a", id: "thread-a" },
      { family_id: "family-b", id: "thread-b" },
    ];
    queryState.profiles = [
      { full_name: "Casey Parent", id: "profile-parent" },
      { full_name: "Taylor Parent", id: "profile-other-a" },
      { full_name: "Morgan Guardian", id: "profile-other-b" },
    ];
    queryState.threadMessages = [
      {
        content: "Family A update",
        created_at: "2026-03-20T12:00:00.000Z",
        id: "message-a",
        sender_id: "profile-other-a",
        thread_id: "thread-a",
      },
      {
        content: "Family B update",
        created_at: "2026-03-21T12:00:00.000Z",
        id: "message-b",
        sender_id: "profile-other-b",
        thread_id: "thread-b",
      },
    ];

    familyState = {
      activeFamilyId: "family-a",
    };

    mockedUseAuth.mockReturnValue({
      loading: false,
      user: { email: "owner@example.com", id: "user-parent" },
    } as never);
    mockedUseCallSessions.mockReturnValue({
      activeSession: null,
      createCall: vi.fn(),
      incomingSession: null,
      sessions: [],
    } as never);
    mockedUseCallableFamilyMembers.mockReturnValue({
      loading: false,
      members: [],
    } as never);
    mockedUseFamilyRole.mockImplementation(() => ({
      activeFamilyId: familyState.activeFamilyId,
      isParent: true,
      isThirdParty: false,
      profileId: "profile-parent",
    }) as never);
    mockedUseRealtimeChildren.mockImplementation(() => ({
      children: familyState.activeFamilyId === "family-a"
        ? [{ date_of_birth: "2018-01-01", id: "child-a-1", name: "Alex" }]
        : [{ date_of_birth: "2016-01-01", id: "child-b-1", name: "Jordan" }],
      loading: false,
    }) as never);
    mockedFetchFamilyParentProfiles.mockImplementation(async (familyId: string) =>
      familyId === "family-a"
        ? [
            { fullName: "Casey Parent", profileId: "profile-parent", role: "parent" },
            { fullName: "Taylor Parent", profileId: "profile-other-a", role: "parent" },
          ]
        : [
            { fullName: "Casey Parent", profileId: "profile-parent", role: "parent" },
            { fullName: "Morgan Guardian", profileId: "profile-other-b", role: "guardian" },
          ],
    );
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

  it("shows dashboard summaries for only the active family", async () => {
    const rendered = await renderDashboard();

    expect(rendered.textContent).toContain("Other parent/guardian: Taylor Parent");
    expect(rendered.textContent).toContain("Family A update");
    expect(rendered.textContent).toContain("Alex");
    expect(rendered.textContent).not.toContain("Family B update");
    expect(rendered.textContent).not.toContain("Jordan");
  });

  it("switching families swaps visible dashboard summary data", async () => {
    const rendered = await renderDashboard();
    expect(rendered.textContent).toContain("Family A update");

    familyState.activeFamilyId = "family-b";
    await renderDashboard();

    expect(rendered.textContent).toContain("Other parent/guardian: Morgan Guardian");
    expect(rendered.textContent).toContain("Family B update");
    expect(rendered.textContent).toContain("Jordan");
    expect(rendered.textContent).not.toContain("Family A update");
    expect(rendered.textContent).not.toContain("Alex");
  });

  it("does not depend on legacy co_parent_id dashboard scoping", async () => {
    await renderDashboard();

    expect(selectLogs.some((log) => log.columns.includes("co_parent_id"))).toBe(false);
    expect(selectLogs.some((log) => log.filters.some((filter) => filter.field === "co_parent_id"))).toBe(false);
    expect(selectLogs).toContainEqual(
      expect.objectContaining({
        table: "message_threads",
        filters: expect.arrayContaining([
          expect.objectContaining({ field: "family_id", type: "eq", value: "family-a" }),
        ]),
      }),
    );
    expect(selectLogs).toContainEqual(
      expect.objectContaining({
        table: "custody_schedules",
        filters: expect.arrayContaining([
          expect.objectContaining({ field: "family_id", type: "eq", value: "family-a" }),
        ]),
      }),
    );
  });

  it("filters parent-only quick links for third-party users", async () => {
    mockedUseFamilyRole.mockImplementation(() => ({
      activeFamilyId: familyState.activeFamilyId,
      isParent: false,
      isThirdParty: true,
      profileId: "profile-parent",
    }) as never);

    const rendered = await renderDashboard();

    expect(rendered.querySelector('a[href="/dashboard/calendar"]')).not.toBeNull();
    expect(rendered.querySelector('a[href="/dashboard/messages"]')).not.toBeNull();
    expect(rendered.querySelector('a[href="/dashboard/children"]')).toBeNull();
    expect(rendered.querySelector('a[href="/dashboard/expenses"]')).toBeNull();
    expect(rendered.querySelector('a[href="/dashboard/settings"]')).toBeNull();
    expect(rendered.textContent).not.toContain("Manage Child Info");
  });
});
