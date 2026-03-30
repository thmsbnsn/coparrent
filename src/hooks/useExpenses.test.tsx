import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useExpenses } from "@/hooks/useExpenses";
import { useAuth } from "@/contexts/AuthContext";
import { useFamily } from "@/contexts/FamilyContext";
import { fetchFamilyParentProfiles } from "@/lib/familyScope";

type JsonRecord = Record<string, unknown>;
type FilterLog =
  | {
      field: string;
      type: "eq";
      value: unknown;
    }
  | {
      field: string;
      type: "in";
      value: unknown[];
    };

interface ExpenseRow extends JsonRecord {
  amount: number;
  category: string;
  child_id: string | null;
  created_at: string;
  created_by: string;
  description: string;
  expense_date: string;
  family_id: string | null;
  id: string;
  notes: string | null;
  receipt_path: string | null;
  split_percentage: number;
  updated_at: string;
}

interface ReimbursementRow extends JsonRecord {
  amount: number;
  created_at: string;
  expense_id: string;
  id: string;
  message: string | null;
  recipient_id: string;
  requester_id: string;
  responded_at: string | null;
  response_message: string | null;
  status: string;
  updated_at: string;
}

interface ProfileRow extends JsonRecord {
  email: string | null;
  full_name: string | null;
  id: string;
}

const queryState = vi.hoisted(() => ({
  expenses: [] as ExpenseRow[],
  profiles: [] as ProfileRow[],
  reimbursementRequests: [] as ReimbursementRow[],
}));
const selectLogs = vi.hoisted(() => [] as Array<{ columns: string; filters: FilterLog[]; table: string }>);
const insertLogs = vi.hoisted(() => [] as Array<{ payload: JsonRecord; table: string }>);
const deleteLogs = vi.hoisted(() => [] as Array<{ filters: FilterLog[]; table: string }>);
const toastError = vi.hoisted(() => vi.fn());

const cloneValue = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      let columns = "";
      let orderBy: { ascending: boolean; field: string } | null = null;
      let pendingDelete = false;
      let pendingInsert: JsonRecord | null = null;
      let pendingUpdate: JsonRecord | null = null;
      const filters: FilterLog[] = [];

      const getTableRows = () => {
        if (table === "expenses") {
          return queryState.expenses;
        }

        if (table === "profiles") {
          return queryState.profiles;
        }

        if (table === "reimbursement_requests") {
          return queryState.reimbursementRequests;
        }

        return [];
      };

      const matches = (row: JsonRecord) =>
        filters.every((filter) => {
          if (filter.type === "eq") {
            return row[filter.field] === filter.value;
          }

          return filter.value.includes(row[filter.field]);
        });

      const decorateRow = (row: JsonRecord) => {
        if (table !== "reimbursement_requests" || !columns.includes("expense:expenses")) {
          return cloneValue(row);
        }

        const reimbursementRow = cloneValue(row) as ReimbursementRow & {
          expense?: ExpenseRow | null;
          requester?: ProfileRow | null;
        };

        reimbursementRow.expense =
          queryState.expenses.find((expense) => expense.id === reimbursementRow.expense_id) ?? null;
        reimbursementRow.requester =
          queryState.profiles.find((profile) => profile.id === reimbursementRow.requester_id) ?? null;

        return reimbursementRow as JsonRecord;
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
        in: (field: string, value: unknown[]) => {
          filters.push({ field, type: "in", value: cloneValue(value) });
          return builder;
        },
        insert: (payload: JsonRecord) => {
          pendingInsert = payload;
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
        update: (payload: JsonRecord) => {
          pendingUpdate = payload;
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
        single: async () => {
          if (pendingInsert) {
            const row = {
              id: pendingInsert.id ?? `${table}-${Date.now()}`,
              created_at: "2026-03-29T12:00:00.000Z",
              updated_at: "2026-03-29T12:00:00.000Z",
              ...cloneValue(pendingInsert),
            };

            if (table === "expenses") {
              queryState.expenses.push(row as ExpenseRow);
            }

            if (table === "reimbursement_requests") {
              queryState.reimbursementRequests.push(row as ReimbursementRow);
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
          onfulfilled?: ((value: { data: JsonRecord[] | null; error: Error | null }) => unknown) | null,
          onrejected?: ((reason: unknown) => unknown) | null,
        ) => {
          const execute = async () => {
            if (pendingInsert) {
              const row = {
                id: pendingInsert.id ?? `${table}-${queryState.reimbursementRequests.length + 1}`,
                created_at: "2026-03-29T12:00:00.000Z",
                updated_at: "2026-03-29T12:00:00.000Z",
                ...cloneValue(pendingInsert),
              };

              if (table === "expenses") {
                queryState.expenses.push(row as ExpenseRow);
              }

              if (table === "reimbursement_requests") {
                queryState.reimbursementRequests.push(row as ReimbursementRow);
              }

              insertLogs.push({ payload: cloneValue(pendingInsert), table });
              return { data: null, error: null };
            }

            if (pendingDelete && table === "expenses") {
              deleteLogs.push({ filters: cloneValue(filters), table });
              queryState.expenses = queryState.expenses.filter((row) => !matches(row));
              queryState.reimbursementRequests = queryState.reimbursementRequests.filter((row) =>
                queryState.expenses.some((expense) => expense.id === row.expense_id),
              );
              return { data: null, error: null };
            }

            if (pendingUpdate && table === "reimbursement_requests") {
              queryState.reimbursementRequests = queryState.reimbursementRequests.map((row) =>
                matches(row) ? ({ ...row, ...cloneValue(pendingUpdate) } as ReimbursementRow) : row,
              );
              return { data: null, error: null };
            }

            const rows = getRows();
            selectLogs.push({ columns, filters: cloneValue(filters), table });
            return { data: rows, error: null };
          };

          return execute().then(onfulfilled ?? undefined, onrejected ?? undefined);
        },
      };

      return builder;
    },
    storage: {
      from: () => ({
        createSignedUrl: async () => ({
          data: { signedUrl: "https://example.test/receipt" },
          error: null,
        }),
        upload: async () => ({
          data: { path: "receipts/test-file" },
          error: null,
        }),
      }),
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
  fetchFamilyParentProfiles: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
  },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseFamily = vi.mocked(useFamily);
const mockedFetchFamilyParentProfiles = vi.mocked(fetchFamilyParentProfiles);

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const HookConsumer = () => {
  const {
    expenses,
    reimbursementRequests,
    loading,
    profile,
    reimbursementRecipientId,
    requestReimbursement,
    deleteExpense,
    getTotals,
  } = useExpenses();
  const [lastRequestError, setLastRequestError] = useState<string>("none");
  const [lastDeleteError, setLastDeleteError] = useState<string>("none");

  const totals = getTotals();

  return (
    <div>
      <div>loading:{loading ? "yes" : "no"}</div>
      <div>profile:{profile?.id ?? "none"}</div>
      <div>recipient:{reimbursementRecipientId ?? "none"}</div>
      <div>expenses:{expenses.map((expense) => expense.id).join(",") || "none"}</div>
      <div>requests:{reimbursementRequests.map((request) => request.id).join(",") || "none"}</div>
      <div>other-total:{totals.otherFamilyTotal.toFixed(2)}</div>
      <button
        type="button"
        onClick={() =>
          void requestReimbursement("expense-family-a-me", 40, "Please reimburse").then((result) => {
            setLastRequestError(result.error ?? "none");
          })
        }
      >
        send-request-a
      </button>
      <button
        type="button"
        onClick={() =>
          void requestReimbursement("expense-family-b-me", 60, "Please reimburse").then((result) => {
            setLastRequestError(result.error ?? "none");
          })
        }
      >
        send-request-b
      </button>
      <button
        type="button"
        onClick={() =>
          void deleteExpense("expense-family-a-me").then((result) => {
            setLastDeleteError(result.error ?? "none");
          })
        }
      >
        remove-expense-a
      </button>
      <div>request-error:{lastRequestError}</div>
      <div>delete-error:{lastDeleteError}</div>
    </div>
  );
};

describe("useExpenses", () => {
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
      { id: "profile-parent", full_name: "Pat Parent", email: "pat@example.test" },
      { id: "profile-other-a", full_name: "Alex Parent", email: "alex@example.test" },
      { id: "profile-other-b", full_name: "Bailey Guardian", email: "bailey@example.test" },
    ];
    queryState.expenses = [
      {
        id: "expense-family-a-me",
        family_id: "family-a",
        created_by: "profile-parent",
        child_id: null,
        category: "medical",
        amount: 120,
        description: "Family A medical",
        expense_date: "2026-03-20",
        receipt_path: null,
        split_percentage: 50,
        notes: null,
        created_at: "2026-03-20T10:00:00.000Z",
        updated_at: "2026-03-20T10:00:00.000Z",
      },
      {
        id: "expense-family-a-other",
        family_id: "family-a",
        created_by: "profile-other-a",
        child_id: null,
        category: "education",
        amount: 80,
        description: "Family A school",
        expense_date: "2026-03-19",
        receipt_path: null,
        split_percentage: 50,
        notes: null,
        created_at: "2026-03-19T10:00:00.000Z",
        updated_at: "2026-03-19T10:00:00.000Z",
      },
      {
        id: "expense-family-b-me",
        family_id: "family-b",
        created_by: "profile-parent",
        child_id: null,
        category: "activities",
        amount: 200,
        description: "Family B sports",
        expense_date: "2026-03-18",
        receipt_path: null,
        split_percentage: 50,
        notes: null,
        created_at: "2026-03-18T10:00:00.000Z",
        updated_at: "2026-03-18T10:00:00.000Z",
      },
      {
        id: "expense-family-b-other",
        family_id: "family-b",
        created_by: "profile-other-b",
        child_id: null,
        category: "childcare",
        amount: 60,
        description: "Family B childcare",
        expense_date: "2026-03-17",
        receipt_path: null,
        split_percentage: 50,
        notes: null,
        created_at: "2026-03-17T10:00:00.000Z",
        updated_at: "2026-03-17T10:00:00.000Z",
      },
    ];
    queryState.reimbursementRequests = [
      {
        id: "request-family-a",
        expense_id: "expense-family-a-other",
        requester_id: "profile-other-a",
        recipient_id: "profile-parent",
        amount: 40,
        status: "pending",
        message: "Family A reimbursement",
        response_message: null,
        responded_at: null,
        created_at: "2026-03-21T10:00:00.000Z",
        updated_at: "2026-03-21T10:00:00.000Z",
      },
      {
        id: "request-family-b",
        expense_id: "expense-family-b-other",
        requester_id: "profile-other-b",
        recipient_id: "profile-parent",
        amount: 30,
        status: "pending",
        message: "Family B reimbursement",
        response_message: null,
        responded_at: null,
        created_at: "2026-03-22T10:00:00.000Z",
        updated_at: "2026-03-22T10:00:00.000Z",
      },
    ];

    selectLogs.length = 0;
    insertLogs.length = 0;
    deleteLogs.length = 0;
    toastError.mockReset();

    familyContext = {
      activeFamilyId: "family-a",
      isParentInActiveFamily: true,
      loading: false,
      profileId: "profile-parent",
    };

    mockedUseAuth.mockReturnValue({
      user: { id: "user-1" },
    } as never);
    mockedUseFamily.mockImplementation(() => familyContext as never);
    mockedFetchFamilyParentProfiles.mockImplementation(async (familyId: string) =>
      familyId === "family-a"
        ? [
            { fullName: "Pat Parent", profileId: "profile-parent", role: "parent" },
            { fullName: "Alex Parent", profileId: "profile-other-a", role: "parent" },
          ]
        : [
            { fullName: "Pat Parent", profileId: "profile-parent", role: "parent" },
            { fullName: "Bailey Guardian", profileId: "profile-other-b", role: "guardian" },
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

  it("shows expenses only for the active family", async () => {
    await renderConsumer();

    expect(container?.textContent).toContain("expenses:expense-family-a-me,expense-family-a-other");
    expect(container?.textContent).toContain("requests:request-family-a");
    expect(container?.textContent).not.toContain("expense-family-b-me");
    expect(container?.textContent).not.toContain("request-family-b");
    expect(container?.textContent).toContain("other-total:80.00");
    expect(selectLogs).toContainEqual(
      expect.objectContaining({
        table: "expenses",
        filters: expect.arrayContaining([
          expect.objectContaining({ field: "family_id", type: "eq", value: "family-a" }),
        ]),
      }),
    );
  });

  it("scopes reimbursement recipient resolution to the active family", async () => {
    await renderConsumer();

    expect(container?.textContent).toContain("recipient:profile-other-a");

    await act(async () => {
      getButtonByText("send-request-a").click();
      await flushPromises();
    });

    expect(container?.textContent).toContain("request-error:none");
    expect(insertLogs).toContainEqual(
      expect.objectContaining({
        table: "reimbursement_requests",
        payload: expect.objectContaining({
          expense_id: "expense-family-a-me",
          requester_id: "profile-parent",
          recipient_id: "profile-other-a",
        }),
      }),
    );
  });

  it("switching families swaps visible expenses correctly", async () => {
    const rendered = await renderConsumer();

    expect(rendered.container.textContent).toContain("expenses:expense-family-a-me,expense-family-a-other");
    expect(rendered.container.textContent).toContain("other-total:80.00");

    familyContext.activeFamilyId = "family-b";
    await rendered.rerender();

    expect(rendered.container.textContent).toContain("expenses:expense-family-b-me,expense-family-b-other");
    expect(rendered.container.textContent).toContain("requests:request-family-b");
    expect(rendered.container.textContent).toContain("recipient:profile-other-b");
    expect(rendered.container.textContent).toContain("other-total:60.00");
    expect(rendered.container.textContent).not.toContain("expense-family-a-me");
    expect(rendered.container.textContent).not.toContain("request-family-a");
  });

  it("does not depend on legacy co_parent_id logic", async () => {
    await renderConsumer();

    expect(selectLogs.some((log) => log.table === "profiles")).toBe(false);
    expect(selectLogs.some((log) => log.columns.includes("co_parent_id"))).toBe(false);
    expect(selectLogs.some((log) => log.filters.some((filter) => filter.field === "co_parent_id"))).toBe(false);
  });

  it("prevents cross-family reimbursement leakage when switching families", async () => {
    const rendered = await renderConsumer();

    await act(async () => {
      getButtonByText("send-request-a").click();
      await flushPromises();
    });

    familyContext.activeFamilyId = "family-b";
    await rendered.rerender();

    await act(async () => {
      getButtonByText("send-request-b").click();
      await flushPromises();
    });

    expect(insertLogs.filter((log) => log.table === "reimbursement_requests")).toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({
          expense_id: "expense-family-a-me",
          recipient_id: "profile-other-a",
        }),
      }),
      expect.objectContaining({
        payload: expect.objectContaining({
          expense_id: "expense-family-b-me",
          recipient_id: "profile-other-b",
        }),
      }),
    ]);
    expect(rendered.container.textContent).toContain("request-family-b");
    expect(rendered.container.textContent).not.toContain("request-family-a");
  });

  it("deletes affect only the active family", async () => {
    await renderConsumer();

    await act(async () => {
      getButtonByText("remove-expense-a").click();
      await flushPromises();
    });

    expect(container?.textContent).toContain("delete-error:none");
    expect(queryState.expenses.some((expense) => expense.id === "expense-family-a-me")).toBe(false);
    expect(queryState.expenses.some((expense) => expense.id === "expense-family-b-me")).toBe(true);
    expect(deleteLogs).toContainEqual(
      expect.objectContaining({
        table: "expenses",
        filters: expect.arrayContaining([
          expect.objectContaining({ field: "id", type: "eq", value: "expense-family-a-me" }),
          expect.objectContaining({ field: "family_id", type: "eq", value: "family-a" }),
        ]),
      }),
    );
  });
});
