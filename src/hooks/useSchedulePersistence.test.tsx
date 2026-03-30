import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScheduleConfig } from "@/components/calendar/CalendarWizard";
import { useSchedulePersistence } from "@/hooks/useSchedulePersistence";
import { useFamily } from "@/contexts/FamilyContext";
import { fetchFamilyParentProfiles } from "@/lib/familyScope";

type JsonRecord = Record<string, unknown>;
type FilterLog = {
  field: string;
  type: "eq";
  value: unknown;
};

interface ScheduleRow extends JsonRecord {
  alternate_exchange_location: string | null;
  child_ids: string[] | null;
  created_at: string;
  custom_pattern: number[] | null;
  exchange_location: string | null;
  exchange_time: string | null;
  family_id: string | null;
  holidays: unknown[];
  id: string;
  parent_a_id: string;
  parent_b_id: string;
  pattern: string;
  start_date: string;
  starting_parent: string | null;
  updated_at: string;
}

const queryState = vi.hoisted(() => ({
  schedules: [] as ScheduleRow[],
}));
const selectLogs = vi.hoisted(() => [] as Array<{ columns: string; filters: FilterLog[]; table: string }>);
const updateLogs = vi.hoisted(() => [] as Array<{ filters: FilterLog[]; payload: JsonRecord; table: string }>);
const insertLogs = vi.hoisted(() => [] as Array<{ payload: JsonRecord; table: string }>);
const toast = vi.hoisted(() => vi.fn());
const removeChannel = vi.hoisted(() => vi.fn());

const cloneRow = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      let columns = "";
      let orderBy: { ascending: boolean; field: string } | null = null;
      let limitValue: number | null = null;
      let pendingUpdate: JsonRecord | null = null;
      let pendingInsert: JsonRecord | null = null;
      const filters: FilterLog[] = [];

      const matches = (row: JsonRecord) =>
        filters.every((filter) => row[filter.field] === filter.value);

      const getRows = () => {
        let rows = (queryState.schedules ?? []).filter(matches).map(cloneRow);

        if (orderBy) {
          rows = rows.sort((left, right) => {
            const leftValue = String(left[orderBy.field] ?? "");
            const rightValue = String(right[orderBy.field] ?? "");
            const comparison = leftValue.localeCompare(rightValue);
            return orderBy.ascending ? comparison : comparison * -1;
          });
        }

        if (limitValue !== null) {
          rows = rows.slice(0, limitValue);
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
        limit: (nextLimit: number) => {
          limitValue = nextLimit;
          return builder;
        },
        update: (payload: JsonRecord) => {
          pendingUpdate = payload;
          return builder;
        },
        insert: (payload: JsonRecord) => {
          pendingInsert = payload;
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
              id: pendingInsert.id ?? `schedule-${queryState.schedules.length + 1}`,
              ...cloneRow(pendingInsert),
              created_at: "2026-03-29T12:00:00.000Z",
              updated_at: "2026-03-29T12:00:00.000Z",
            } as ScheduleRow;

            queryState.schedules.push(row);
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

              queryState.schedules = queryState.schedules.map((row) =>
                matches(row) ? ({ ...row, ...cloneRow(pendingUpdate) } as ScheduleRow) : row,
              );

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

const buildConfig = (pattern: string): ScheduleConfig => ({
  pattern,
  startDate: new Date("2026-04-01T00:00:00.000Z"),
  startingParent: "A",
  exchangeTime: "6:00 PM",
  exchangeLocation: "School",
  alternateLocation: "Library",
  holidays: [],
});

const HookConsumer = ({ savePattern = "2-2-3" }: { savePattern?: string }) => {
  const { scheduleConfig, scheduleId, loading, saveSchedule, refetch } = useSchedulePersistence();

  return (
    <div>
      <div>loading:{loading ? "yes" : "no"}</div>
      <div>schedule-id:{scheduleId ?? "none"}</div>
      <div>pattern:{scheduleConfig?.pattern ?? "none"}</div>
      <button type="button" onClick={() => void saveSchedule(buildConfig(savePattern))}>
        save
      </button>
      <button type="button" onClick={() => void refetch()}>
        refetch
      </button>
    </div>
  );
};

describe("useSchedulePersistence", () => {
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
    queryState.schedules = [
      {
        id: "schedule-a",
        family_id: "family-a",
        parent_a_id: "profile-parent",
        parent_b_id: "profile-other-a",
        pattern: "alternating-weeks",
        custom_pattern: null,
        starting_parent: "A",
        start_date: "2026-04-01",
        exchange_time: "6:00 PM",
        exchange_location: "School",
        alternate_exchange_location: "Library",
        holidays: [],
        child_ids: ["child-a-1"],
        created_at: "2026-03-20T10:00:00.000Z",
        updated_at: "2026-03-20T10:00:00.000Z",
      },
      {
        id: "schedule-b",
        family_id: "family-b",
        parent_a_id: "profile-parent",
        parent_b_id: "profile-other-b",
        pattern: "2-2-5-5",
        custom_pattern: null,
        starting_parent: "A",
        start_date: "2026-05-01",
        exchange_time: "5:00 PM",
        exchange_location: "Community Center",
        alternate_exchange_location: "Library",
        holidays: [],
        child_ids: ["child-b-1"],
        created_at: "2026-03-21T10:00:00.000Z",
        updated_at: "2026-03-21T10:00:00.000Z",
      },
    ];

    selectLogs.length = 0;
    updateLogs.length = 0;
    insertLogs.length = 0;
    toast.mockReset();
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

  it("loads schedules only for the selected active family", async () => {
    await renderConsumer();

    expect(container?.textContent).toContain("schedule-id:schedule-a");
    expect(container?.textContent).toContain("pattern:alternating-weeks");
    expect(container?.textContent).not.toContain("schedule-id:schedule-b");
    expect(selectLogs).toContainEqual(
      expect.objectContaining({
        table: "custody_schedules",
        filters: expect.arrayContaining([
          expect.objectContaining({ field: "family_id", type: "eq", value: "family-a" }),
        ]),
      }),
    );
  });

  it("saves schedules only for the active family", async () => {
    await renderConsumer();

    await act(async () => {
      getButtonByText("save").click();
      await flushPromises();
    });

    const familyASchedule = queryState.schedules.find((schedule) => schedule.id === "schedule-a");
    const familyBSchedule = queryState.schedules.find((schedule) => schedule.id === "schedule-b");

    expect(familyASchedule?.pattern).toBe("2-2-3");
    expect(familyASchedule?.family_id).toBe("family-a");
    expect(familyBSchedule?.pattern).toBe("2-2-5-5");
    expect(updateLogs).toContainEqual(
      expect.objectContaining({
        table: "custody_schedules",
        filters: expect.arrayContaining([
          expect.objectContaining({ field: "id", type: "eq", value: "schedule-a" }),
          expect.objectContaining({ field: "family_id", type: "eq", value: "family-a" }),
        ]),
        payload: expect.objectContaining({
          family_id: "family-a",
          pattern: "2-2-3",
        }),
      }),
    );
  });

  it("deletes only affect the active family state", async () => {
    await renderConsumer();

    queryState.schedules = queryState.schedules.filter((schedule) => schedule.id !== "schedule-b");

    await act(async () => {
      getButtonByText("refetch").click();
      await flushPromises();
    });

    expect(container?.textContent).toContain("schedule-id:schedule-a");
    expect(container?.textContent).toContain("pattern:alternating-weeks");

    queryState.schedules = queryState.schedules.filter((schedule) => schedule.id !== "schedule-a");

    await act(async () => {
      getButtonByText("refetch").click();
      await flushPromises();
    });

    expect(container?.textContent).toContain("schedule-id:none");
    expect(container?.textContent).toContain("pattern:none");
  });

  it("switching active families swaps the visible schedule deterministically", async () => {
    const rendered = await renderConsumer();

    expect(rendered.container.textContent).toContain("schedule-id:schedule-a");
    expect(rendered.container.textContent).toContain("pattern:alternating-weeks");

    familyContext.activeFamilyId = "family-b";
    await rendered.rerender();

    expect(rendered.container.textContent).toContain("schedule-id:schedule-b");
    expect(rendered.container.textContent).toContain("pattern:2-2-5-5");
    expect(rendered.container.textContent).not.toContain("schedule-id:schedule-a");
  });

  it("does not depend on legacy co_parent_id scope assumptions", async () => {
    await renderConsumer();

    expect(selectLogs.some((log) => log.table === "profiles")).toBe(false);
    expect(selectLogs.some((log) => log.columns.includes("co_parent_id"))).toBe(false);
    expect(selectLogs.every((log) => log.table === "custody_schedules")).toBe(true);
  });
});
