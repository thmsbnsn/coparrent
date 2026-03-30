import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGiftItems, useGiftLists } from "@/hooks/useGiftLists";
import { useFamilyRole } from "@/hooks/useFamilyRole";

type JsonRecord = Record<string, unknown>;
type FilterLog =
  | { field: string; type: "eq"; value: unknown }
  | { field: string; type: "neq"; value: unknown };

interface GiftListRow extends JsonRecord {
  allow_multiple_claims: boolean;
  child_id: string;
  created_at: string;
  custom_occasion_name: string | null;
  event_date: string | null;
  family_id: string | null;
  id: string;
  occasion_type: string;
  primary_parent_id: string;
  updated_at: string;
}

interface GiftItemRow extends JsonRecord {
  category: string;
  claimed_at: string | null;
  claimed_by: string | null;
  created_at: string;
  created_by: string;
  gift_list_id: string;
  id: string;
  link: string | null;
  notes: string | null;
  parent_only_notes: string | null;
  purchased: boolean;
  status: string;
  suggested_age_range: string | null;
  title: string;
  updated_at: string;
}

const queryState = vi.hoisted(() => ({
  children: [] as Array<{ id: string; name: string }>,
  giftItems: [] as GiftItemRow[],
  giftLists: [] as GiftListRow[],
  profiles: [] as Array<{ email: string | null; full_name: string | null; id: string }>,
}));
const selectLogs = vi.hoisted(() => [] as Array<{ columns: string; filters: FilterLog[]; table: string }>);
const insertLogs = vi.hoisted(() => [] as Array<{ payload: JsonRecord; table: string }>);
const toast = vi.hoisted(() => vi.fn());

const cloneValue = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      let columns = "";
      let countMode = false;
      let limitCount: number | null = null;
      let orderBy: { ascending: boolean; field: string } | null = null;
      let pendingDelete = false;
      let pendingInsert: JsonRecord | null = null;
      let pendingUpdate: JsonRecord | null = null;
      const filters: FilterLog[] = [];

      const getTableRows = () => {
        switch (table) {
          case "gift_items":
            return queryState.giftItems;
          case "gift_lists":
            return queryState.giftLists;
          default:
            return [];
        }
      };

      const getFieldValue = (row: JsonRecord, field: string): unknown => {
        if (field === "gift_lists.family_id" && table === "gift_items") {
          const giftList = queryState.giftLists.find((list) => list.id === row.gift_list_id);
          return giftList?.family_id ?? null;
        }

        return row[field];
      };

      const matches = (row: JsonRecord) =>
        filters.every((filter) => {
          const fieldValue = getFieldValue(row, filter.field);
          if (filter.type === "eq") {
            return fieldValue === filter.value;
          }

          return fieldValue !== filter.value;
        });

      const decorateRow = (row: JsonRecord) => {
        if (table === "gift_lists" && columns.includes("children!gift_lists_child_id_fkey")) {
          const giftList = cloneValue(row) as GiftListRow & {
            children?: { name: string } | null;
          };
          const child = queryState.children.find((entry) => entry.id === giftList.child_id);
          giftList.children = child ? { name: child.name } : null;
          return giftList as JsonRecord;
        }

        if (table === "gift_items") {
          const giftItem = cloneValue(row) as GiftItemRow & {
            claimer?: { email: string | null; full_name: string | null } | null;
            gift_lists?: { family_id: string | null } | null;
          };

          if (columns.includes("claimer:profiles!gift_items_claimed_by_fkey")) {
            giftItem.claimer =
              queryState.profiles.find((profile) => profile.id === giftItem.claimed_by) ?? null;
          }

          if (columns.includes("gift_lists!inner")) {
            const giftList = queryState.giftLists.find((entry) => entry.id === giftItem.gift_list_id);
            giftItem.gift_lists = giftList ? { family_id: giftList.family_id } : null;
          }

          return giftItem as JsonRecord;
        }

        return cloneValue(row);
      };

      const getRows = () => {
        let rows = getTableRows().filter(matches).map(decorateRow);

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
        delete: () => {
          pendingDelete = true;
          return builder;
        },
        eq: (field: string, value: unknown) => {
          filters.push({ field, type: "eq", value });
          return builder;
        },
        insert: (payload: JsonRecord) => {
          pendingInsert = cloneValue(payload);
          return builder;
        },
        limit: (value: number) => {
          limitCount = value;
          return builder;
        },
        neq: (field: string, value: unknown) => {
          filters.push({ field, type: "neq", value });
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
        single: async () => {
          if (pendingInsert) {
            const row = {
              created_at: "2026-03-30T12:00:00.000Z",
              id: pendingInsert.id ?? `${table}-${Date.now()}`,
              updated_at: "2026-03-30T12:00:00.000Z",
              ...cloneValue(pendingInsert),
            };

            if (table === "gift_lists") {
              queryState.giftLists.push(row as GiftListRow);
            }

            if (table === "gift_items") {
              queryState.giftItems.push(row as GiftItemRow);
            }

            insertLogs.push({ payload: cloneValue(pendingInsert), table });
            return {
              data: cloneValue(row),
              error: null,
            };
          }

          const rows = getRows();
          selectLogs.push({ columns, filters: cloneValue(filters), table });
          return {
            data: rows[0] ?? null,
            error: rows[0] ? null : new Error(`No rows found in ${table}`),
          };
        },
        then: (
          onfulfilled?: ((value: { count: number | null; data: JsonRecord[] | null; error: Error | null }) => unknown) | null,
          onrejected?: ((reason: unknown) => unknown) | null,
        ) => {
          const execute = async () => {
            if (pendingInsert) {
              const row = {
                created_at: "2026-03-30T12:00:00.000Z",
                id: pendingInsert.id ?? `${table}-${Date.now()}`,
                updated_at: "2026-03-30T12:00:00.000Z",
                ...cloneValue(pendingInsert),
              };

              if (table === "gift_lists") {
                queryState.giftLists.push(row as GiftListRow);
              }

              if (table === "gift_items") {
                queryState.giftItems.push(row as GiftItemRow);
              }

              insertLogs.push({ payload: cloneValue(pendingInsert), table });
              return { count: null, data: null, error: null };
            }

            if (pendingUpdate) {
              if (table === "gift_lists") {
                queryState.giftLists = queryState.giftLists.map((row) =>
                  matches(row) ? ({ ...row, ...cloneValue(pendingUpdate) } as GiftListRow) : row,
                );
              }

              if (table === "gift_items") {
                queryState.giftItems = queryState.giftItems.map((row) =>
                  matches(row) ? ({ ...row, ...cloneValue(pendingUpdate) } as GiftItemRow) : row,
                );
              }

              return { count: null, data: null, error: null };
            }

            if (pendingDelete) {
              if (table === "gift_lists") {
                const removedIds = queryState.giftLists.filter(matches).map((row) => row.id);
                queryState.giftLists = queryState.giftLists.filter((row) => !matches(row));
                queryState.giftItems = queryState.giftItems.filter((row) => !removedIds.includes(row.gift_list_id));
              }

              if (table === "gift_items") {
                queryState.giftItems = queryState.giftItems.filter((row) => !matches(row));
              }

              return { count: null, data: null, error: null };
            }

            const rows = getRows();
            selectLogs.push({ columns, filters: cloneValue(filters), table });
            return {
              count: countMode ? rows.length : null,
              data: countMode ? null : rows,
              error: null,
            };
          };

          return execute().then(onfulfilled ?? undefined, onrejected ?? undefined);
        },
        update: (payload: JsonRecord) => {
          pendingUpdate = cloneValue(payload);
          return builder;
        },
      };

      return builder;
    },
  },
}));

vi.mock("@/hooks/useFamilyRole", () => ({
  useFamilyRole: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast,
  }),
}));

vi.mock("@/lib/errorMessages", () => ({
  handleError: vi.fn(() => "Handled error"),
}));

vi.mock("@/lib/mutations", () => ({
  acquireMutationLock: vi.fn(() => true),
  getMutationKey: vi.fn((...parts: string[]) => parts.join(":")),
  releaseMutationLock: vi.fn(),
}));

const mockedUseFamilyRole = vi.mocked(useFamilyRole);

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe("useGiftLists", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let latestGiftListsHook: ReturnType<typeof useGiftLists> | null = null;
  let latestGiftItemsHook: ReturnType<typeof useGiftItems> | null = null;
  let familyRoleState: {
    activeFamilyId: string | null;
    isParent: boolean;
    loading: boolean;
    profileId: string | null;
  };

  const GiftListsHarness = ({ childId }: { childId?: string }) => {
    latestGiftListsHook = useGiftLists(childId);
    return <div>{latestGiftListsHook.loading ? "loading" : latestGiftListsHook.scopeError ?? "ready"}</div>;
  };

  const GiftItemsHarness = ({ listId }: { listId: string }) => {
    latestGiftItemsHook = useGiftItems(listId);
    return <div>{latestGiftItemsHook.loading ? "loading" : latestGiftItemsHook.scopeError ?? "ready"}</div>;
  };

  const renderHarness = async (element: ReactNode) => {
    if (!container) {
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
    }

    await act(async () => {
      root?.render(<>{element}</>);
      await flushPromises();
    });
  };

  beforeEach(() => {
    queryState.children = [
      { id: "child-a", name: "Alex" },
      { id: "child-b", name: "Jordan" },
    ];
    queryState.giftLists = [
      {
        allow_multiple_claims: false,
        child_id: "child-a",
        created_at: "2026-03-01T00:00:00.000Z",
        custom_occasion_name: null,
        event_date: "2026-04-10",
        family_id: "family-a",
        id: "list-a",
        occasion_type: "birthday",
        primary_parent_id: "profile-parent",
        updated_at: "2026-03-01T00:00:00.000Z",
      },
      {
        allow_multiple_claims: true,
        child_id: "child-b",
        created_at: "2026-03-05T00:00:00.000Z",
        custom_occasion_name: null,
        event_date: "2026-05-20",
        family_id: "family-b",
        id: "list-b",
        occasion_type: "holiday",
        primary_parent_id: "profile-parent",
        updated_at: "2026-03-05T00:00:00.000Z",
      },
    ];
    queryState.giftItems = [
      {
        category: "toy",
        claimed_at: null,
        claimed_by: null,
        created_at: "2026-03-02T00:00:00.000Z",
        created_by: "profile-parent",
        gift_list_id: "list-a",
        id: "item-a-1",
        link: null,
        notes: null,
        parent_only_notes: null,
        purchased: false,
        status: "unclaimed",
        suggested_age_range: null,
        title: "Blocks",
        updated_at: "2026-03-02T00:00:00.000Z",
      },
      {
        category: "book",
        claimed_at: "2026-03-03T00:00:00.000Z",
        claimed_by: "profile-aunt",
        created_at: "2026-03-03T00:00:00.000Z",
        created_by: "profile-parent",
        gift_list_id: "list-a",
        id: "item-a-2",
        link: null,
        notes: null,
        parent_only_notes: null,
        purchased: false,
        status: "claimed",
        suggested_age_range: null,
        title: "Chapter Book",
        updated_at: "2026-03-03T00:00:00.000Z",
      },
      {
        category: "electronics",
        claimed_at: null,
        claimed_by: null,
        created_at: "2026-03-07T00:00:00.000Z",
        created_by: "profile-parent",
        gift_list_id: "list-b",
        id: "item-b-1",
        link: null,
        notes: null,
        parent_only_notes: null,
        purchased: false,
        status: "unclaimed",
        suggested_age_range: null,
        title: "Headphones",
        updated_at: "2026-03-07T00:00:00.000Z",
      },
    ];
    queryState.profiles = [
      { email: "parent@example.com", full_name: "Casey Parent", id: "profile-parent" },
      { email: "aunt@example.com", full_name: "Taylor Aunt", id: "profile-aunt" },
    ];

    selectLogs.length = 0;
    insertLogs.length = 0;
    toast.mockReset();

    familyRoleState = {
      activeFamilyId: "family-a",
      isParent: true,
      loading: false,
      profileId: "profile-parent",
    };

    mockedUseFamilyRole.mockImplementation(() => ({
      activeFamilyId: familyRoleState.activeFamilyId,
      isParent: familyRoleState.isParent,
      loading: familyRoleState.loading,
      profileId: familyRoleState.profileId,
    }) as never);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
    latestGiftListsHook = null;
    latestGiftItemsHook = null;
    vi.clearAllMocks();
  });

  it("loads gift lists for the active family scope", async () => {
    await renderHarness(<GiftListsHarness />);

    expect(latestGiftListsHook?.scopeError).toBeNull();
    expect(latestGiftListsHook?.giftLists.map((list) => list.id)).toEqual(["list-a"]);
    expect(latestGiftListsHook?.giftLists[0]?.child_name).toBe("Alex");
    expect(latestGiftListsHook?.giftLists[0]?.items_count).toBe(2);
    expect(latestGiftListsHook?.giftLists[0]?.claimed_count).toBe(1);
    expect(selectLogs).toContainEqual(
      expect.objectContaining({
        table: "gift_lists",
        filters: expect.arrayContaining([
          expect.objectContaining({ field: "family_id", type: "eq", value: "family-a" }),
        ]),
      }),
    );
    expect(
      selectLogs.some((log) => log.filters.some((filter) => filter.field === "primary_parent_id")),
    ).toBe(false);
  });

  it("fails explicitly when active family scope is missing", async () => {
    familyRoleState.activeFamilyId = null;

    await renderHarness(<GiftListsHarness />);

    expect(latestGiftListsHook?.giftLists).toEqual([]);
    expect(latestGiftListsHook?.scopeError).toBe("Gift lists require an active family.");
    expect(selectLogs.some((log) => log.table === "gift_lists")).toBe(false);

    let result: unknown = null;
    await act(async () => {
      result = await latestGiftListsHook!.createGiftList({
        child_id: "child-a",
        occasion_type: "birthday",
      });
    });

    expect(result).toBeNull();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Active family required",
        variant: "destructive",
      }),
    );
  });

  it("writes new gift lists with the active family scope", async () => {
    await renderHarness(<GiftListsHarness />);

    await act(async () => {
      await latestGiftListsHook!.createGiftList({
        allow_multiple_claims: true,
        child_id: "child-a",
        event_date: "2026-06-15",
        occasion_type: "birthday",
      });
    });

    expect(insertLogs).toContainEqual(
      expect.objectContaining({
        table: "gift_lists",
        payload: expect.objectContaining({
          allow_multiple_claims: true,
          child_id: "child-a",
          family_id: "family-a",
          occasion_type: "birthday",
          primary_parent_id: "profile-parent",
        }),
      }),
    );
  });

  it("isolates gift lists across active family changes", async () => {
    await renderHarness(<GiftListsHarness />);
    expect(latestGiftListsHook?.giftLists.map((list) => list.id)).toEqual(["list-a"]);

    familyRoleState.activeFamilyId = "family-b";
    await renderHarness(<GiftListsHarness />);

    expect(latestGiftListsHook?.giftLists.map((list) => list.id)).toEqual(["list-b"]);
    expect(selectLogs).toContainEqual(
      expect.objectContaining({
        table: "gift_lists",
        filters: expect.arrayContaining([
          expect.objectContaining({ field: "family_id", type: "eq", value: "family-b" }),
        ]),
      }),
    );
  });

  it("scopes gift items through the selected list family", async () => {
    await renderHarness(<GiftItemsHarness listId="list-a" />);

    expect(latestGiftItemsHook?.scopeError).toBeNull();
    expect(latestGiftItemsHook?.items.map((item) => item.id)).toEqual(["item-a-1", "item-a-2"]);
    expect(latestGiftItemsHook?.items[1]?.claimed_by_name).toBe("Taylor Aunt");
    expect(selectLogs).toContainEqual(
      expect.objectContaining({
        table: "gift_items",
        filters: expect.arrayContaining([
          expect.objectContaining({ field: "gift_list_id", type: "eq", value: "list-a" }),
          expect.objectContaining({ field: "gift_lists.family_id", type: "eq", value: "family-a" }),
        ]),
      }),
    );

    familyRoleState.activeFamilyId = "family-b";
    await renderHarness(<GiftItemsHarness listId="list-a" />);

    expect(latestGiftItemsHook?.items).toEqual([]);
  });
});
