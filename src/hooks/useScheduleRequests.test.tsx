import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useScheduleRequests } from "@/hooks/useScheduleRequests";
import { useFamily } from "@/contexts/FamilyContext";
import { fetchFamilyParentProfiles } from "@/lib/familyScope";

type JsonRecord = Record<string, unknown>;
type FilterLog = {
  field: string;
  type: "eq";
  value: unknown;
};

interface ScheduleRequestRow extends JsonRecord {
  created_at: string;
  family_id: string | null;
  id: string;
  message_id: string | null;
  original_date: string;
  proposed_date: string | null;
  reason: string | null;
  recipient_id: string;
  request_type: string;
  requester_id: string;
  status: string;
  updated_at: string;
}

const queryState = vi.hoisted(() => ({
  profiles: [] as JsonRecord[],
  scheduleRequests: [] as ScheduleRequestRow[],
}));
const selectLogs = vi.hoisted(() => [] as Array<{ columns: string; filters: FilterLog[]; table: string }>);
const insertLogs = vi.hoisted(() => [] as Array<{ payload: JsonRecord; table: string }>);
const updateLogs = vi.hoisted(() => [] as Array<{ filters: FilterLog[]; payload: JsonRecord; table: string }>);
const toast = vi.hoisted(() => vi.fn());
const notifyScheduleChange = vi.hoisted(() => vi.fn());
const notifyScheduleResponse = vi.hoisted(() => vi.fn());
const showLocalNotification = vi.hoisted(() => vi.fn());
const invoke = vi.hoisted(() => vi.fn());
const removeChannel = vi.hoisted(() => vi.fn());

const cloneRow = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      let columns = "";
      let orderBy: { ascending: boolean; field: string } | null = null;
      let pendingInsert: JsonRecord | null = null;
      let pendingUpdate: JsonRecord | null = null;
      const filters: FilterLog[] = [];

      const getTableRows = () => {
        if (table === "profiles") {
          return queryState.profiles;
        }

        if (table === "schedule_requests") {
          return queryState.scheduleRequests;
        }

        return [];
      };

      const matches = (row: JsonRecord) => filters.every((filter) => row[filter.field] === filter.value);

      const getRows = () => {
        let rows = getTableRows().filter(matches).map(cloneRow);

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
        select: (nextColumns: string) => {
          columns = nextColumns;
          return builder;
        },
        eq: (field: string, value: unknown) => {
          filters.push({ field, type: "eq", value });
          return builder;
        },
        order: (field: string, options?: { ascending?: boolean }) => {
          orderBy = { ascending: options?.ascending ?? true, field };
          return builder;
        },
        insert: (payload: JsonRecord) => {
          pendingInsert = payload;
          return builder;
        },
        update: (payload: JsonRecord) => {
          pendingUpdate = payload;
          return builder;
        },
        maybeSingle: async () => {
          const rows = getRows();
          selectLogs.push({ columns, filters: cloneRow(filters), table });
          return {
            data: rows[0] ?? null,
            error: null,
          };
        },
        single: async () => {
          if (pendingInsert) {
            const row = {
              id: pendingInsert.id ?? `request-${queryState.scheduleRequests.length + 1}`,
              created_at: "2026-03-29T12:00:00.000Z",
              updated_at: "2026-03-29T12:00:00.000Z",
              ...cloneRow(pendingInsert),
            } as ScheduleRequestRow;

            queryState.scheduleRequests.push(row);
            insertLogs.push({ payload: cloneRow(pendingInsert), table });

            return {
              data: cloneRow(row),
              error: null,
            };
          }

          const rows = getRows();
          selectLogs.push({ columns, filters: cloneRow(filters), table });

          return {
            data: rows[0] ?? null,
            error: rows[0] ? null : new Error(`No rows found in ${table}`),
          };
        },
        then: (
          onfulfilled?: ((value: { data: JsonRecord[] | null; error: Error | null }) => unknown) | null,
          onrejected?: ((reason: unknown) => unknown) | null,
        ) => {
          const execute = async () => {
            if (pendingUpdate) {
              updateLogs.push({
                filters: cloneRow(filters),
                payload: cloneRow(pendingUpdate),
                table,
              });

              if (table === "schedule_requests") {
                queryState.scheduleRequests = queryState.scheduleRequests.map((row) =>
                  matches(row) ? ({ ...row, ...cloneRow(pendingUpdate) } as ScheduleRequestRow) : row,
                );
              }

              return { data: null, error: null };
            }

            const rows = getRows();
            selectLogs.push({ columns, filters: cloneRow(filters), table });
            return { data: rows, error: null };
          };

          return execute().then(onfulfilled ?? undefined, onrejected ?? undefined);
        },
      };

      return builder;
    },
    functions: {
      invoke,
    },
    channel: () => {
      const channel = {
        on: () => channel,
        subscribe: () => channel,
      };

      return channel;
    },
    removeChannel,
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast,
  }),
}));

vi.mock("@/hooks/useNotificationService", () => ({
  useNotificationService: () => ({
    notifyScheduleChange,
    notifyScheduleResponse,
    showLocalNotification,
  }),
}));

vi.mock("@/contexts/FamilyContext", () => ({
  useFamily: vi.fn(),
}));

vi.mock("@/lib/familyScope", () => ({
  fetchFamilyParentProfiles: vi.fn(),
}));

const mockedUseFamily = vi.mocked(useFamily);
const mockedFetchFamilyParentProfiles = vi.mocked(fetchFamilyParentProfiles);

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const HookConsumer = () => {
  const { createRequest, requests, loading } = useScheduleRequests();
  const [lastDestination, setLastDestination] = useState<string>("none");

  return (
    <div>
      <div>loading:{loading ? "yes" : "no"}</div>
      <div>requests:{requests.map((request) => request.id).join(",") || "none"}</div>
      <div>destination:{lastDestination}</div>
      <button
        type="button"
        onClick={() =>
          void createRequest({
            request_type: "swap",
            original_date: "2026-04-10",
            proposed_date: "2026-04-11",
            reason: "Need to swap pickup day",
          }).then((result) => {
            setLastDestination(result?.messageDestination ?? "none");
          })
        }
      >
        create
      </button>
    </div>
  );
};

describe("useScheduleRequests", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let familyContext: {
    activeFamilyId: string | null;
    isParentInActiveFamily: boolean;
    loading: boolean;
    profileId: string | null;
  };

  const renderConsumer = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(<HookConsumer />);
      await flushPromises();
    });

    return {
      container,
      rerender: async () => {
        await act(async () => {
          root?.render(<HookConsumer />);
          await flushPromises();
        });
      },
    };
  };

  const getButtonByText = (text: string) => {
    const button = Array.from(container?.querySelectorAll("button") ?? []).find((candidate) =>
      candidate.textContent?.includes(text),
    );

    if (!button) {
      throw new Error(`Button not found: ${text}`);
    }

    return button;
  };

  beforeEach(() => {
    queryState.profiles = [
      { id: "profile-parent", full_name: "Pat Parent" },
    ];
    queryState.scheduleRequests = [
      {
        id: "request-family-a",
        family_id: "family-a",
        message_id: null,
        original_date: "2026-04-01",
        proposed_date: null,
        reason: "Family A request",
        recipient_id: "profile-other-a",
        request_type: "swap",
        requester_id: "profile-parent",
        status: "pending",
        created_at: "2026-03-20T10:00:00.000Z",
        updated_at: "2026-03-20T10:00:00.000Z",
      },
      {
        id: "request-family-b",
        family_id: "family-b",
        message_id: null,
        original_date: "2026-05-01",
        proposed_date: null,
        reason: "Family B request",
        recipient_id: "profile-other-b",
        request_type: "swap",
        requester_id: "profile-parent",
        status: "pending",
        created_at: "2026-03-21T10:00:00.000Z",
        updated_at: "2026-03-21T10:00:00.000Z",
      },
    ];

    selectLogs.length = 0;
    insertLogs.length = 0;
    updateLogs.length = 0;
    toast.mockReset();
    notifyScheduleChange.mockReset();
    notifyScheduleResponse.mockReset();
    showLocalNotification.mockReset();
    invoke.mockReset();
    removeChannel.mockReset();

    familyContext = {
      activeFamilyId: "family-a",
      isParentInActiveFamily: true,
      loading: false,
      profileId: "profile-parent",
    };

    mockedUseFamily.mockImplementation(() => familyContext as never);
    mockedFetchFamilyParentProfiles.mockImplementation(async (familyId: string) =>
      familyId === "family-a"
        ? [
            { fullName: "Pat Parent", profileId: "profile-parent", role: "parent" },
            { fullName: "Alex Parent", profileId: "profile-other-a", role: "parent" },
          ]
        : [
            { fullName: "Pat Parent", profileId: "profile-parent", role: "parent" },
            { fullName: "Bailey Parent", profileId: "profile-other-b", role: "parent" },
          ],
    );

    invoke.mockImplementation(async (_fnName: string, args: { body?: { family_id?: string } }) => ({
      data: {
        success: true,
        thread: {
          id: args.body?.family_id === "family-a" ? "thread-family-a" : "thread-family-b",
        },
      },
      error: null,
    }));
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

  it("creates requests only for members in the active family", async () => {
    await renderConsumer();

    expect(container?.textContent).toContain("requests:request-family-a");
    expect(container?.textContent).not.toContain("request-family-b");

    await act(async () => {
      getButtonByText("create").click();
      await flushPromises();
    });

    expect(insertLogs).toContainEqual(
      expect.objectContaining({
        table: "schedule_requests",
        payload: expect.objectContaining({
          family_id: "family-a",
          requester_id: "profile-parent",
          recipient_id: "profile-other-a",
        }),
      }),
    );
    expect(invoke).toHaveBeenCalledWith("create-message-thread", {
      body: {
        family_id: "family-a",
        thread_type: "direct_message",
        other_profile_id: "profile-other-a",
      },
    });
    expect(container?.textContent).toContain("destination:/dashboard/messages?thread=thread-family-a");
  });

  it("does not rely on legacy co_parent_id assumptions", async () => {
    await renderConsumer();

    await act(async () => {
      getButtonByText("create").click();
      await flushPromises();
    });

    expect(selectLogs.some((log) => log.columns.includes("co_parent_id"))).toBe(false);
    expect(selectLogs.some((log) => log.filters.some((filter) => filter.field === "co_parent_id"))).toBe(false);
    expect(selectLogs).toContainEqual(
      expect.objectContaining({
        table: "schedule_requests",
        filters: expect.arrayContaining([
          expect.objectContaining({ field: "family_id", type: "eq", value: "family-a" }),
        ]),
      }),
    );
  });

  it("keeps request targets scoped correctly when switching active families", async () => {
    const rendered = await renderConsumer();

    await act(async () => {
      getButtonByText("create").click();
      await flushPromises();
    });

    expect(insertLogs[0]).toEqual(
      expect.objectContaining({
        payload: expect.objectContaining({
          family_id: "family-a",
          recipient_id: "profile-other-a",
        }),
      }),
    );

    familyContext.activeFamilyId = "family-b";
    await rendered.rerender();

    expect(rendered.container.textContent).toContain("requests:request-family-b");
    expect(rendered.container.textContent).not.toContain("request-family-a");

    await act(async () => {
      getButtonByText("create").click();
      await flushPromises();
    });

    expect(insertLogs[1]).toEqual(
      expect.objectContaining({
        payload: expect.objectContaining({
          family_id: "family-b",
          recipient_id: "profile-other-b",
        }),
      }),
    );
    expect(invoke).toHaveBeenLastCalledWith("create-message-thread", {
      body: {
        family_id: "family-b",
        thread_type: "direct_message",
        other_profile_id: "profile-other-b",
      },
    });
    expect(rendered.container.textContent).toContain("destination:/dashboard/messages?thread=thread-family-b");
  });
});
