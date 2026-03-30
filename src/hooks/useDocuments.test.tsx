import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDocuments } from "@/hooks/useDocuments";
import { useAuth } from "@/contexts/AuthContext";
import { useFamily } from "@/contexts/FamilyContext";
import { fetchFamilyChildIds, fetchFamilyParentProfiles } from "@/lib/familyScope";

type JsonRecord = Record<string, unknown>;
type FilterLog = {
  field: string;
  type: "eq";
  value: unknown;
};

interface DocumentRow extends JsonRecord {
  category: string;
  child_id: string | null;
  created_at: string;
  description: string | null;
  family_id: string | null;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  id: string;
  title: string;
  updated_at: string;
  uploaded_by: string;
}

const queryState = vi.hoisted(() => ({
  documentAccessLogs: [] as JsonRecord[],
  documents: [] as DocumentRow[],
  profiles: [] as JsonRecord[],
}));
const selectLogs = vi.hoisted(() => [] as Array<{ columns: string; filters: FilterLog[]; table: string }>);
const insertLogs = vi.hoisted(() => [] as Array<{ payload: JsonRecord; table: string }>);
const uploadLogs = vi.hoisted(() => [] as Array<{ bucket: string; filePath: string }>);
const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
const notifyDocumentUpload = vi.hoisted(() => vi.fn());

const cloneValue = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      let columns = "";
      let orderBy: { ascending: boolean; field: string } | null = null;
      let pendingDelete = false;
      let pendingInsert: JsonRecord | null = null;
      const filters: FilterLog[] = [];

      const getTableRows = () => {
        if (table === "profiles") {
          return queryState.profiles;
        }

        if (table === "documents") {
          return queryState.documents;
        }

        if (table === "document_access_logs") {
          return queryState.documentAccessLogs;
        }

        return [];
      };

      const matches = (row: JsonRecord) => filters.every((filter) => row[filter.field] === filter.value);

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
        delete: () => {
          pendingDelete = true;
          return builder;
        },
        eq: (field: string, value: unknown) => {
          filters.push({ field, type: "eq", value });
          return builder;
        },
        insert: (payload: JsonRecord) => {
          pendingInsert = payload;
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
        order: (field: string, options?: { ascending?: boolean }) => {
          orderBy = { ascending: options?.ascending ?? true, field };
          return builder;
        },
        select: (nextColumns: string) => {
          columns = nextColumns;
          return builder;
        },
        single: async () => {
          if (pendingInsert) {
            const row = {
              id: pendingInsert.id ?? `document-${queryState.documents.length + 1}`,
              created_at: "2026-03-29T12:00:00.000Z",
              updated_at: "2026-03-29T12:00:00.000Z",
              ...cloneValue(pendingInsert),
            } as DocumentRow;

            if (table === "documents") {
              queryState.documents.push(row);
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
              insertLogs.push({ payload: cloneValue(pendingInsert), table });

              if (table === "document_access_logs") {
                queryState.documentAccessLogs.push({
                  id: `access-log-${queryState.documentAccessLogs.length + 1}`,
                  created_at: "2026-03-29T12:00:00.000Z",
                  ...cloneValue(pendingInsert),
                });
              }

              return { data: null, error: null };
            }

            if (pendingDelete && table === "documents") {
              queryState.documents = queryState.documents.filter((row) => !matches(row));
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
      from: (bucket: string) => ({
        createSignedUrl: async () => ({
          data: { signedUrl: "https://example.test/document" },
          error: null,
        }),
        download: async () => ({
          data: new Blob(["document"]),
          error: null,
        }),
        remove: async () => ({
          data: null,
          error: null,
        }),
        upload: async (filePath: string) => {
          uploadLogs.push({ bucket, filePath });
          return {
            data: { path: filePath },
            error: null,
          };
        },
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

vi.mock("@/hooks/useNotificationService", () => ({
  useNotificationService: () => ({
    notifyDocumentUpload,
  }),
}));

vi.mock("@/lib/familyScope", () => ({
  fetchFamilyChildIds: vi.fn(),
  fetchFamilyParentProfiles: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
    success: toastSuccess,
  },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseFamily = vi.mocked(useFamily);
const mockedFetchFamilyChildIds = vi.mocked(fetchFamilyChildIds);
const mockedFetchFamilyParentProfiles = vi.mocked(fetchFamilyParentProfiles);

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const HookConsumer = () => {
  const { documents, loading, uploadDocument } = useDocuments();
  const [lastUploadId, setLastUploadId] = useState<string>("none");

  return (
    <div>
      <div>loading:{loading ? "yes" : "no"}</div>
      <div>documents:{documents.map((document) => document.id).join(",") || "none"}</div>
      <div>last-upload:{lastUploadId}</div>
      <button
        type="button"
        onClick={() =>
          void uploadDocument(
            new File(["document"], "family-plan.pdf", { type: "application/pdf" }),
            "Family Plan",
            "Shared family document",
            "legal",
          ).then((document) => {
            setLastUploadId(document?.id ?? "none");
          })
        }
      >
        upload
      </button>
    </div>
  );
};

describe("useDocuments", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let familyContext: {
    activeFamilyId: string | null;
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
    queryState.documents = [
      {
        id: "document-family-a",
        title: "Family A Agreement",
        description: "Family A document",
        family_id: "family-a",
        file_path: "user-1/document-family-a.pdf",
        file_name: "document-family-a.pdf",
        file_type: "application/pdf",
        file_size: 1024,
        child_id: null,
        uploaded_by: "profile-parent",
        category: "legal",
        created_at: "2026-03-20T10:00:00.000Z",
        updated_at: "2026-03-20T10:00:00.000Z",
      },
      {
        id: "document-family-b",
        title: "Family B Agreement",
        description: "Family B document",
        family_id: "family-b",
        file_path: "user-1/document-family-b.pdf",
        file_name: "document-family-b.pdf",
        file_type: "application/pdf",
        file_size: 2048,
        child_id: null,
        uploaded_by: "profile-parent",
        category: "legal",
        created_at: "2026-03-21T10:00:00.000Z",
        updated_at: "2026-03-21T10:00:00.000Z",
      },
    ];
    queryState.documentAccessLogs = [];

    selectLogs.length = 0;
    insertLogs.length = 0;
    uploadLogs.length = 0;
    toastSuccess.mockReset();
    toastError.mockReset();
    notifyDocumentUpload.mockReset();

    familyContext = {
      activeFamilyId: "family-a",
      loading: false,
      profileId: "profile-parent",
    };

    mockedUseAuth.mockReturnValue({
      user: { id: "user-1" },
    } as never);
    mockedUseFamily.mockImplementation(() => familyContext as never);
    mockedFetchFamilyChildIds.mockResolvedValue(["child-family-a"]);
    mockedFetchFamilyParentProfiles.mockImplementation(async (familyId: string) =>
      familyId === "family-a"
        ? [
            { fullName: "Pat Parent", profileId: "profile-parent", role: "parent" },
            { fullName: "Alex Parent", profileId: "profile-other-a", role: "parent" },
          ]
        : [
            { fullName: "Pat Parent", profileId: "profile-parent", role: "parent" },
            { fullName: "Bailey Parent", profileId: "profile-other-b", role: "guardian" },
          ],
    );
    notifyDocumentUpload.mockResolvedValue(true);
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

  it("uploads in family A notify only family A recipients", async () => {
    await renderConsumer();

    expect(container?.textContent).toContain("documents:document-family-a");
    expect(container?.textContent).not.toContain("document-family-b");

    await act(async () => {
      getButtonByText("upload").click();
      await flushPromises();
    });

    expect(insertLogs).toContainEqual(
      expect.objectContaining({
        table: "documents",
        payload: expect.objectContaining({
          family_id: "family-a",
          uploaded_by: "profile-parent",
        }),
      }),
    );
    expect(notifyDocumentUpload).toHaveBeenCalledTimes(1);
    expect(notifyDocumentUpload).toHaveBeenCalledWith("profile-other-a", "Pat Parent", "Family Plan");
    expect(notifyDocumentUpload).not.toHaveBeenCalledWith("profile-other-b", expect.any(String), expect.any(String));
  });

  it("switching families changes visible documents correctly", async () => {
    const rendered = await renderConsumer();

    expect(rendered.container.textContent).toContain("documents:document-family-a");
    expect(rendered.container.textContent).not.toContain("document-family-b");

    familyContext.activeFamilyId = "family-b";
    await rendered.rerender();

    expect(rendered.container.textContent).toContain("documents:document-family-b");
    expect(rendered.container.textContent).not.toContain("document-family-a");
  });

  it("does not rely on legacy co_parent_id logic", async () => {
    await renderConsumer();

    await act(async () => {
      getButtonByText("upload").click();
      await flushPromises();
    });

    expect(selectLogs.some((log) => log.columns.includes("co_parent_id"))).toBe(false);
    expect(selectLogs.some((log) => log.filters.some((filter) => filter.field === "co_parent_id"))).toBe(false);
    expect(selectLogs).toContainEqual(
      expect.objectContaining({
        table: "documents",
        filters: expect.arrayContaining([
          expect.objectContaining({ field: "family_id", type: "eq", value: "family-a" }),
        ]),
      }),
    );
  });

  it("prevents cross-family notification leakage when switching families", async () => {
    const rendered = await renderConsumer();

    await act(async () => {
      getButtonByText("upload").click();
      await flushPromises();
    });

    familyContext.activeFamilyId = "family-b";
    await rendered.rerender();

    await act(async () => {
      getButtonByText("upload").click();
      await flushPromises();
    });

    expect(notifyDocumentUpload.mock.calls).toEqual([
      ["profile-other-a", "Pat Parent", "Family Plan"],
      ["profile-other-b", "Pat Parent", "Family Plan"],
    ]);
    expect(rendered.container.textContent).toContain("document-family-b");
    expect(rendered.container.textContent).not.toContain("document-family-a");
  });
});
