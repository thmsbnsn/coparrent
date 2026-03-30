import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThirdPartyManager } from "@/components/settings/ThirdPartyManager";
import { useFamily } from "@/contexts/FamilyContext";
import { ensureFamilyChildLinksSynced, fetchFamilyChildIds } from "@/lib/familyScope";

type JsonRecord = Record<string, unknown>;
type FilterLog = {
  field: string;
  type: "eq" | "in";
  value: unknown;
};

const queryState = vi.hoisted(() => ({
  tables: {} as Record<string, JsonRecord[]>,
}));
const selectLogs = vi.hoisted(() => [] as Array<{ columns: string; filters: FilterLog[]; table: string }>);
const updateLogs = vi.hoisted(() => [] as Array<{ filters: FilterLog[]; payload: JsonRecord; table: string }>);
const rpc = vi.hoisted(() => vi.fn());
const invoke = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());

const cloneRow = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      let columns = "";
      let orderBy: { ascending: boolean; field: string } | null = null;
      let pendingUpdate: JsonRecord | null = null;
      const filters: FilterLog[] = [];

      const matches = (row: JsonRecord) =>
        filters.every((filter) => {
          if (filter.type === "eq") {
            return row[filter.field] === filter.value;
          }

          const values = Array.isArray(filter.value) ? filter.value : [];
          return values.includes(row[filter.field]);
        });

      const sortedRows = (rows: JsonRecord[]) => {
        if (!orderBy) {
          return rows;
        }

        return [...rows].sort((left, right) => {
          const leftValue = String(left[orderBy.field] ?? "");
          const rightValue = String(right[orderBy.field] ?? "");
          const comparison = leftValue.localeCompare(rightValue);
          return orderBy.ascending ? comparison : comparison * -1;
        });
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
        in: (field: string, value: unknown[]) => {
          filters.push({ field, type: "in", value });
          return builder;
        },
        order: (field: string, options?: { ascending?: boolean }) => {
          orderBy = { ascending: options?.ascending ?? true, field };
          return builder;
        },
        update: (payload: JsonRecord) => {
          pendingUpdate = payload;
          return builder;
        },
        single: async () => {
          const rows = sortedRows((queryState.tables[table] ?? []).filter(matches)).map(cloneRow);
          selectLogs.push({ columns, filters: cloneRow(filters), table });

          if (rows.length === 0) {
            return {
              data: null,
              error: new Error(`No rows found in ${table}`),
            };
          }

          return {
            data: rows[0],
            error: null,
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

              for (const row of queryState.tables[table] ?? []) {
                if (matches(row)) {
                  Object.assign(row, pendingUpdate);
                }
              }

              return { data: null, error: null };
            }

            const rows = sortedRows((queryState.tables[table] ?? []).filter(matches)).map(cloneRow);
            selectLogs.push({ columns, filters: cloneRow(filters), table });
            return { data: rows, error: null };
          };

          return execute().then(onfulfilled ?? undefined, onrejected ?? undefined);
        },
      };

      return builder;
    },
    rpc,
    functions: {
      invoke,
    },
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
  ensureFamilyChildLinksSynced: vi.fn(),
  fetchFamilyChildIds: vi.fn(),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: { children?: ReactNode; className?: string }) => <div {...props}>{children}</div>,
  },
}));

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    checked,
    id,
    onCheckedChange,
  }: {
    checked?: boolean;
    id?: string;
    onCheckedChange?: (value: boolean) => void;
  }) => (
    <input
      id={id}
      type="checkbox"
      checked={checked}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
    />
  ),
}));

vi.mock("@/components/ui/collapsible", () => ({
  Collapsible: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  CollapsibleContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/select", async () => {
  const React = await import("react");

  const SelectContext = React.createContext<{
    onValueChange?: (value: string) => void;
    value?: string;
  }>({});

  return {
    Select: ({
      children,
      onValueChange,
      value,
    }: {
      children?: ReactNode;
      disabled?: boolean;
      onValueChange?: (value: string) => void;
      value?: string;
    }) => (
      <SelectContext.Provider value={{ onValueChange, value }}>
        <div>{children}</div>
      </SelectContext.Provider>
    ),
    SelectTrigger: ({ children }: { children?: ReactNode; className?: string }) => <div>{children}</div>,
    SelectValue: ({ placeholder }: { placeholder?: string }) => {
      const context = React.useContext(SelectContext);
      return <span>{context.value || placeholder}</span>;
    },
    SelectContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    SelectItem: ({
      children,
      value,
    }: {
      children?: ReactNode;
      value: string;
    }) => {
      const context = React.useContext(SelectContext);
      return (
        <button type="button" onClick={() => context.onValueChange?.(value)}>
          {children}
        </button>
      );
    },
  };
});

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");

  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

const mockedUseFamily = vi.mocked(useFamily);
const mockedEnsureFamilyChildLinksSynced = vi.mocked(ensureFamilyChildLinksSynced);
const mockedFetchFamilyChildIds = vi.mocked(fetchFamilyChildIds);

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const setInputValue = (input: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;

  if (!setter) {
    throw new Error("Unable to access native input value setter");
  }

  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
};

const getInputById = (container: HTMLDivElement, id: string) => {
  const input = container.querySelector<HTMLInputElement>(`#${id}`);

  if (!input) {
    throw new Error(`Input not found: ${id}`);
  }

  return input;
};

const getButtonByText = (container: HTMLDivElement, text: string) => {
  const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
    candidate.textContent?.includes(text),
  );

  if (!button) {
    throw new Error(`Button not found: ${text}`);
  }

  return button;
};

const getIconOnlyButtons = (container: HTMLDivElement) =>
  Array.from(container.querySelectorAll("button")).filter((button) => !button.textContent?.trim());

describe("ThirdPartyManager", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let familyContext: {
    activeFamilyId: string | null;
    loading: boolean;
    profileId: string | null;
  };

  const renderManager = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <ThirdPartyManager
          subscriptionTier="power"
          isTrialActive={false}
        />,
      );
      await flushPromises();
    });

    return {
      container,
      rerender: async () => {
        await act(async () => {
          root?.render(
            <ThirdPartyManager
              subscriptionTier="power"
              isTrialActive={false}
            />,
          );
          await flushPromises();
        });
      },
    };
  };

  beforeEach(() => {
    queryState.tables = {
      children: [
        { id: "child-a-1", name: "Avery" },
        { id: "child-b-1", name: "Blake" },
      ],
      family_members: [
        {
          id: "member-a-1",
          family_id: "family-a",
          profile_id: "profile-third-party-a",
          relationship_label: "Grandparent",
          role: "third_party",
          status: "active",
          created_at: "2026-03-20T10:00:00.000Z",
          profiles: {
            full_name: "Alice Relative",
            email: "alice@example.com",
          },
        },
        {
          id: "member-b-1",
          family_id: "family-b",
          profile_id: "profile-third-party-b",
          relationship_label: "Aunt",
          role: "third_party",
          status: "active",
          created_at: "2026-03-21T10:00:00.000Z",
          profiles: {
            full_name: "Bob Relative",
            email: "bob@example.com",
          },
        },
      ],
      invitations: [
        {
          id: "invite-a-1",
          family_id: "family-a",
          invitee_email: "pending-a@example.com",
          inviter_id: "profile-parent",
          invitation_type: "third_party",
          relationship: "Babysitter/Nanny",
          status: "pending",
          created_at: "2026-03-19T10:00:00.000Z",
        },
      ],
      profiles: [
        {
          id: "profile-parent",
          full_name: "Pat Parent",
          email: "pat@example.com",
        },
      ],
    };

    selectLogs.length = 0;
    updateLogs.length = 0;
    rpc.mockReset();
    invoke.mockReset();
    toast.mockReset();
    navigate.mockReset();

    familyContext = {
      activeFamilyId: "family-a",
      loading: false,
      profileId: "profile-parent",
    };

    mockedUseFamily.mockImplementation(() => familyContext as never);
    mockedEnsureFamilyChildLinksSynced.mockResolvedValue(true);
    mockedFetchFamilyChildIds.mockImplementation(async (familyId: string) =>
      familyId === "family-a" ? ["child-a-1"] : familyId === "family-b" ? ["child-b-1"] : [],
    );

    rpc.mockResolvedValue({
      data: {
        ok: true,
        data: {
          token: "55555555-5555-5555-5555-555555555555",
        },
      },
      error: null,
    });
    invoke.mockResolvedValue({ error: null });
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

  it("switching the active family changes the visible third-party list", async () => {
    const rendered = await renderManager();

    expect(rendered.container.textContent).toContain("Alice Relative");
    expect(rendered.container.textContent).toContain("pending-a@example.com");
    expect(rendered.container.textContent).not.toContain("Bob Relative");

    familyContext.activeFamilyId = "family-b";
    await rendered.rerender();

    expect(rendered.container.textContent).toContain("Bob Relative");
    expect(rendered.container.textContent).not.toContain("Alice Relative");
    expect(rendered.container.textContent).not.toContain("pending-a@example.com");
  });

  it("switching the active family changes the available children correctly", async () => {
    const rendered = await renderManager();

    expect(rendered.container.textContent).toContain("Avery");
    expect(rendered.container.textContent).not.toContain("Blake");

    familyContext.activeFamilyId = "family-b";
    await rendered.rerender();

    expect(rendered.container.textContent).toContain("Blake");
    expect(rendered.container.textContent).not.toContain("Avery");
  });

  it("scopes invite and revocation actions to the active family only", async () => {
    const rendered = await renderManager();
    const initialRemoveButtons = getIconOnlyButtons(rendered.container);

    expect(initialRemoveButtons).toHaveLength(2);

    await act(async () => {
      initialRemoveButtons[0].click();
      await flushPromises();
    });

    expect(updateLogs).toContainEqual(
      expect.objectContaining({
        table: "family_members",
        filters: expect.arrayContaining([
          expect.objectContaining({ field: "family_id", type: "eq", value: "family-a" }),
          expect.objectContaining({ field: "role", type: "eq", value: "third_party" }),
        ]),
        payload: expect.objectContaining({ status: "removed" }),
      }),
    );

    const emailInput = getInputById(rendered.container, "thirdparty-email");
    const relationshipButton = getButtonByText(rendered.container, "Grandparent");
    const sendButton = getButtonByText(rendered.container, "Send Invitation");

    await act(async () => {
      setInputValue(emailInput, "new-third-party@example.com");
      relationshipButton.click();
      await flushPromises();
    });

    await act(async () => {
      sendButton.click();
      await flushPromises();
    });

    expect(rpc).toHaveBeenCalledWith("rpc_create_third_party_invite", {
      p_family_id: "family-a",
      p_invitee_email: "new-third-party@example.com",
      p_relationship: "grandparent",
      p_child_ids: ["child-a-1"],
    });
    expect(invoke).toHaveBeenCalledWith("send-third-party-invite", {
      body: expect.objectContaining({
        inviteeEmail: "new-third-party@example.com",
        relationship: "Grandparent",
      }),
    });
    expect(rpc.mock.calls[0]?.[1]).not.toHaveProperty("primaryParentId");
    expect(invoke.mock.calls[0]?.[1]?.body).not.toHaveProperty("primaryParentId");
  });

  it("does not depend on legacy co_parent scope in the third-party flow", async () => {
    await renderManager();

    expect(
      selectLogs.some((log) => log.columns.includes("co_parent_id")),
    ).toBe(false);
    expect(
      selectLogs.some((log) => log.columns.includes("primary_parent_id")),
    ).toBe(false);
    expect(
      selectLogs.some((log) =>
        log.table === "family_members" &&
        log.filters.some((filter) => filter.field === "family_id" && filter.value === "family-a"),
      ),
    ).toBe(true);
  });
});
