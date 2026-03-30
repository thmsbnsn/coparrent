import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCourtExport } from "@/hooks/useCourtExport";
import { useAuth } from "@/contexts/AuthContext";
import { useFamily } from "@/contexts/FamilyContext";
import { fetchFamilyChildIds, fetchFamilyParentProfiles } from "@/lib/familyScope";

type JsonRecord = Record<string, unknown>;
type FilterLog =
  | { field: string; type: "eq"; value: unknown }
  | { field: string; type: "gte"; value: unknown }
  | { field: string; type: "in"; value: unknown[] }
  | { field: string; type: "lte"; value: unknown };

interface QueryState {
  children: JsonRecord[];
  custodySchedules: JsonRecord[];
  documentAccessLogs: JsonRecord[];
  exchangeCheckins: JsonRecord[];
  expenses: JsonRecord[];
  messageThreads: JsonRecord[];
  profiles: JsonRecord[];
  scheduleRequests: JsonRecord[];
  threadMessages: JsonRecord[];
}

const queryState = vi.hoisted<QueryState>(() => ({
  children: [],
  custodySchedules: [],
  documentAccessLogs: [],
  exchangeCheckins: [],
  expenses: [],
  messageThreads: [],
  profiles: [],
  scheduleRequests: [],
  threadMessages: [],
}));
const selectLogs = vi.hoisted(() => [] as Array<{ columns: string; filters: FilterLog[]; table: string }>);
const toastError = vi.hoisted(() => vi.fn());

const cloneValue = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      let columns = "";
      let orderBy: { ascending: boolean; field: string } | null = null;
      const filters: FilterLog[] = [];

      const getTableRows = () => {
        switch (table) {
          case "children":
            return queryState.children;
          case "custody_schedules":
            return queryState.custodySchedules;
          case "document_access_logs":
            return queryState.documentAccessLogs;
          case "exchange_checkins":
            return queryState.exchangeCheckins;
          case "expenses":
            return queryState.expenses;
          case "message_threads":
            return queryState.messageThreads;
          case "profiles":
            return queryState.profiles;
          case "schedule_requests":
            return queryState.scheduleRequests;
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

          if (filter.type === "gte") {
            return String(fieldValue ?? "") >= String(filter.value ?? "");
          }

          return String(fieldValue ?? "") <= String(filter.value ?? "");
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
        lte: (field: string, value: unknown) => {
          filters.push({ field, type: "lte", value });
          return builder;
        },
        order: (field: string, options?: { ascending?: boolean }) => {
          orderBy = { ascending: options?.ascending ?? true, field };
          return builder;
        },
        select: (nextColumns: string) => {
          columns = nextColumns;
          return builder;
        },
        maybeSingle: async () => {
          const rows = getRows();
          selectLogs.push({ columns, filters: cloneValue(filters), table });
          return {
            data: rows[0] ?? null,
            error: null,
          };
        },
        then: (
          onfulfilled?: ((value: { data: JsonRecord[]; error: null }) => unknown) | null,
          onrejected?: ((reason: unknown) => unknown) | null,
        ) => {
          const rows = getRows();
          selectLogs.push({ columns, filters: cloneValue(filters), table });
          return Promise.resolve({ data: rows, error: null }).then(onfulfilled ?? undefined, onrejected ?? undefined);
        },
      };

      return builder;
    },
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/contexts/FamilyContext", () => ({
  useFamily: vi.fn(),
}));

vi.mock("@/lib/familyScope", () => ({
  fetchFamilyChildIds: vi.fn(),
  fetchFamilyParentProfiles: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
  },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseFamily = vi.mocked(useFamily);
const mockedFetchFamilyChildIds = vi.mocked(fetchFamilyChildIds);
const mockedFetchFamilyParentProfiles = vi.mocked(fetchFamilyParentProfiles);

const defaultDateRange = {
  start: new Date("2026-03-01T00:00:00.000Z"),
  end: new Date("2026-03-31T23:59:59.000Z"),
};

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe("useCourtExport", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let latestHook: ReturnType<typeof useCourtExport> | null = null;
  let familyContext: {
    activeFamilyId: string | null;
    loading: boolean;
    profileId: string | null;
  };

  const TestHarness = () => {
    latestHook = useCourtExport();
    return <div>{latestHook.loading ? "loading" : "ready"}</div>;
  };

  const renderHook = async () => {
    if (!container) {
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
    }

    await act(async () => {
      root?.render(<TestHarness />);
      await flushPromises();
    });
  };

  beforeEach(() => {
    latestHook = null;
    toastError.mockReset();
    selectLogs.length = 0;
    queryState.children = [
      { id: "child-a-1", name: "Alex" },
      { id: "child-b-1", name: "Jordan" },
    ];
    queryState.custodySchedules = [
      {
        exchange_location: "School",
        exchange_time: "17:00",
        family_id: "family-a",
        holidays: null,
        id: "schedule-a",
        pattern: "weekly",
        start_date: "2026-03-01",
      },
      {
        exchange_location: "Library",
        exchange_time: "18:00",
        family_id: "family-b",
        holidays: null,
        id: "schedule-b",
        pattern: "biweekly",
        start_date: "2026-03-05",
      },
    ];
    queryState.documentAccessLogs = [
      {
        action: "view",
        accessed_by: "profile-other-a",
        created_at: "2026-03-10T10:00:00.000Z",
        document: { family_id: "family-a", title: "Family A Plan", uploaded_by: "profile-parent" },
        document_id: "document-a",
        id: "log-a",
      },
      {
        action: "view",
        accessed_by: "profile-other-b",
        created_at: "2026-03-10T11:00:00.000Z",
        document: { family_id: "family-b", title: "Family B Plan", uploaded_by: "profile-parent" },
        document_id: "document-b",
        id: "log-b",
      },
    ];
    queryState.exchangeCheckins = [
      {
        checked_in_at: "2026-03-12T17:05:00.000Z",
        exchange_date: "2026-03-12",
        id: "checkin-a",
        note: "Smooth exchange",
        schedule_id: "schedule-a",
        user_id: "profile-parent",
      },
      {
        checked_in_at: "2026-03-15T18:05:00.000Z",
        exchange_date: "2026-03-15",
        id: "checkin-b",
        note: "Family B check-in",
        schedule_id: "schedule-b",
        user_id: "profile-parent",
      },
    ];
    queryState.expenses = [
      {
        amount: 25,
        category: "medical",
        child: { name: "Alex" },
        created_by: "profile-parent",
        description: "Family A expense",
        expense_date: "2026-03-11",
        family_id: "family-a",
        id: "expense-a",
        notes: null,
        split_percentage: 50,
      },
      {
        amount: 40,
        category: "activities",
        child: { name: "Jordan" },
        created_by: "profile-parent",
        description: "Family B expense",
        expense_date: "2026-03-14",
        family_id: "family-b",
        id: "expense-b",
        notes: null,
        split_percentage: 50,
      },
    ];
    queryState.messageThreads = [
      { family_id: "family-a", id: "thread-a", name: "Family A Thread", thread_type: "family_channel" },
      { family_id: "family-b", id: "thread-b", name: "Family B Thread", thread_type: "family_channel" },
    ];
    queryState.profiles = [
      { email: "owner@example.com", full_name: "Casey Parent", id: "profile-parent" },
      { email: "other-a@example.com", full_name: "Taylor Parent", id: "profile-other-a" },
      { email: "other-b@example.com", full_name: "Morgan Guardian", id: "profile-other-b" },
    ];
    queryState.scheduleRequests = [
      {
        created_at: "2026-03-09T09:00:00.000Z",
        id: "request-a",
        original_date: "2026-03-20",
        proposed_date: "2026-03-21",
        reason: "Family A change",
        recipient_id: "profile-other-a",
        requester_id: "profile-parent",
        request_type: "swap",
        status: "pending",
        updated_at: "2026-03-09T09:00:00.000Z",
        family_id: "family-a",
      },
      {
        created_at: "2026-03-18T09:00:00.000Z",
        id: "request-b",
        original_date: "2026-03-26",
        proposed_date: "2026-03-27",
        reason: "Family B change",
        recipient_id: "profile-other-b",
        requester_id: "profile-parent",
        request_type: "swap",
        status: "pending",
        updated_at: "2026-03-18T09:00:00.000Z",
        family_id: "family-b",
      },
    ];
    queryState.threadMessages = [
      {
        content: "Family A message",
        created_at: "2026-03-08T12:00:00.000Z",
        id: "message-a",
        sender_id: "profile-other-a",
        sender_role: "parent",
        thread: { name: "Family A Thread", thread_type: "family_channel" },
        thread_id: "thread-a",
      },
      {
        content: "Family B message",
        created_at: "2026-03-08T13:00:00.000Z",
        id: "message-b",
        sender_id: "profile-other-b",
        sender_role: "guardian",
        thread: { name: "Family B Thread", thread_type: "family_channel" },
        thread_id: "thread-b",
      },
    ];

    familyContext = {
      activeFamilyId: "family-a",
      loading: false,
      profileId: "profile-parent",
    };

    mockedUseAuth.mockReturnValue({
      loading: false,
      user: { id: "user-parent", email: "owner@example.com" },
    } as never);
    mockedUseFamily.mockImplementation(() => familyContext as never);
    mockedFetchFamilyChildIds.mockImplementation(async (familyId: string) =>
      familyId === "family-a" ? ["child-a-1"] : ["child-b-1"],
    );
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
    latestHook = null;
    vi.clearAllMocks();
  });

  it("includes only the active family's data in court exports", async () => {
    await renderHook();

    let result: Awaited<ReturnType<typeof latestHook.fetchExportData>> | null = null;
    await act(async () => {
      result = await latestHook?.fetchExportData(defaultDateRange) ?? null;
      await flushPromises();
    });

    expect(result).not.toBeNull();
    expect(result?.messages.map((message) => message.id)).toEqual(["message-a"]);
    expect(result?.expenses.map((expense) => expense.id)).toEqual(["expense-a"]);
    expect(result?.scheduleRequests.map((request) => request.id)).toEqual(["request-a"]);
    expect(result?.exchangeCheckins.map((checkin) => checkin.id)).toEqual(["checkin-a"]);
    expect(result?.documentAccessLogs.map((log) => log.id)).toEqual(["log-a"]);
    expect(result?.children.map((child) => child.id)).toEqual(["child-a-1"]);
    expect(result?.schedule?.id).toBe("schedule-a");
    expect(result?.coParent).toMatchObject({ id: "profile-other-a", full_name: "Taylor Parent" });
  });

  it("switching families swaps export scope without cross-family leakage", async () => {
    await renderHook();

    familyContext.activeFamilyId = "family-b";
    await renderHook();

    let result: Awaited<ReturnType<typeof latestHook.fetchExportData>> | null = null;
    await act(async () => {
      result = await latestHook?.fetchExportData(defaultDateRange) ?? null;
      await flushPromises();
    });

    expect(result).not.toBeNull();
    expect(result?.messages.map((message) => message.id)).toEqual(["message-b"]);
    expect(result?.expenses.map((expense) => expense.id)).toEqual(["expense-b"]);
    expect(result?.scheduleRequests.map((request) => request.id)).toEqual(["request-b"]);
    expect(result?.exchangeCheckins.map((checkin) => checkin.id)).toEqual(["checkin-b"]);
    expect(result?.documentAccessLogs.map((log) => log.id)).toEqual(["log-b"]);
    expect(result?.children.map((child) => child.id)).toEqual(["child-b-1"]);
    expect(result?.schedule?.id).toBe("schedule-b");
    expect(result?.coParent).toMatchObject({ id: "profile-other-b", full_name: "Morgan Guardian" });
  });

  it("does not depend on legacy co_parent_id scoping", async () => {
    await renderHook();

    await act(async () => {
      await latestHook?.fetchExportData(defaultDateRange);
      await flushPromises();
    });

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
  });
});
