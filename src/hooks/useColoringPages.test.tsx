import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useColoringPages } from "@/hooks/useColoringPages";
import { useAuth } from "@/contexts/AuthContext";
import { useFamily } from "@/contexts/FamilyContext";
import { useCreations } from "@/hooks/useCreations";
import { toast } from "sonner";

type JsonRecord = Record<string, unknown>;
type FilterLog = { field: string; type: "eq"; value: unknown };

interface ColoringPageRow extends JsonRecord {
  created_at: string;
  difficulty: "simple" | "medium" | "detailed";
  document_id: string | null;
  family_id: string | null;
  id: string;
  image_url: string | null;
  prompt: string;
  user_id: string;
}

const queryState = vi.hoisted(() => ({
  coloringPageDetails: [] as JsonRecord[],
  coloringPages: [] as ColoringPageRow[],
  documentAccessLogs: [] as JsonRecord[],
  documents: [] as JsonRecord[],
}));
const insertLogs = vi.hoisted(() => [] as Array<{ payload: JsonRecord; table: string }>);
const selectLogs = vi.hoisted(() => [] as Array<{ filters: FilterLog[]; table: string }>);
const updateLogs = vi.hoisted(() => [] as Array<{ filters: FilterLog[]; payload: JsonRecord; table: string }>);
const uploadLogs = vi.hoisted(() => [] as Array<{ bucket: string; filePath: string }>);
const createCreation = vi.hoisted(() => vi.fn());

const cloneValue = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { access_token: "session-token" } },
      })),
    },
    from: (table: string) => {
      let pendingInsert: JsonRecord | null = null;
      let pendingUpdate: JsonRecord | null = null;
      let limitCount: number | null = null;
      let orderBy: { ascending: boolean; field: string } | null = null;
      const filters: FilterLog[] = [];

      const getTableRows = () => {
        switch (table) {
          case "coloring_page_details":
            return queryState.coloringPageDetails;
          case "coloring_pages":
            return queryState.coloringPages;
          case "document_access_logs":
            return queryState.documentAccessLogs;
          case "documents":
            return queryState.documents;
          default:
            return [];
        }
      };

      const matches = (row: JsonRecord) =>
        filters.every((filter) => row[filter.field] === filter.value);

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

      const pushInsertedRow = (payload: JsonRecord) => {
        const normalizedPayload = cloneValue(payload);
        const row = {
          created_at: "2026-03-30T12:00:00.000Z",
          id: normalizedPayload.id ?? `${table}-${getTableRows().length + 1}`,
          updated_at: "2026-03-30T12:00:00.000Z",
          ...normalizedPayload,
        };

        if (table === "coloring_page_details") {
          queryState.coloringPageDetails.push(row);
        }

        if (table === "coloring_pages") {
          queryState.coloringPages.push(row as ColoringPageRow);
        }

        if (table === "document_access_logs") {
          queryState.documentAccessLogs.push(row);
        }

        if (table === "documents") {
          queryState.documents.push(row);
        }

        insertLogs.push({ payload: normalizedPayload, table });
        return cloneValue(row);
      };

      const builder = {
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
        order: (field: string, options?: { ascending?: boolean }) => {
          orderBy = { ascending: options?.ascending ?? true, field };
          return builder;
        },
        select: () => builder,
        single: async () => {
          if (pendingInsert) {
            return { data: pushInsertedRow(pendingInsert), error: null };
          }

          const rows = getRows();
          selectLogs.push({ filters: cloneValue(filters), table });
          return { data: rows[0] ?? null, error: null };
        },
        then: (
          onfulfilled?: ((value: { data: JsonRecord[] | null; error: null }) => unknown) | null,
          onrejected?: ((reason: unknown) => unknown) | null,
        ) => {
          const execute = async () => {
            if (pendingInsert) {
              pushInsertedRow(pendingInsert);
              return { data: null, error: null };
            }

            if (pendingUpdate) {
              updateLogs.push({ filters: cloneValue(filters), payload: cloneValue(pendingUpdate), table });

              if (table === "coloring_pages") {
                queryState.coloringPages = queryState.coloringPages.map((row) =>
                  matches(row) ? ({ ...row, ...cloneValue(pendingUpdate) } as ColoringPageRow) : row,
                );
              }

              return { data: null, error: null };
            }

            const rows = getRows();
            selectLogs.push({ filters: cloneValue(filters), table });
            return { data: rows, error: null };
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
    functions: {
      invoke: vi.fn(async () => ({
        data: {
          coloringPageId: "coloring-page-new",
          imageUrl: "https://example.test/generated.png",
          ok: true,
        },
        error: null,
      })),
    },
    storage: {
      from: (bucket: string) => ({
        upload: vi.fn(async (filePath: string) => {
          uploadLogs.push({ bucket, filePath });
          return { data: { path: filePath }, error: null };
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

vi.mock("@/hooks/useCreations", () => ({
  useCreations: vi.fn(),
}));

vi.mock("@/lib/creationsExport", () => ({
  downloadCreationPng: vi.fn(),
}));

vi.mock("@/lib/mutations", () => ({
  acquireMutationLock: vi.fn(() => true),
  getMutationKey: vi.fn((...parts: string[]) => parts.join(":")),
  releaseMutationLock: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseCreations = vi.mocked(useCreations);
const mockedUseFamily = vi.mocked(useFamily);

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe("useColoringPages", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let latestHook: ReturnType<typeof useColoringPages> | null = null;
  let familyState: {
    activeFamilyId: string | null;
    profileId: string | null;
  };

  const fetchMock = vi.fn(async () => ({
    blob: async () => new Blob(["png"], { type: "image/png" }),
    ok: true,
  }));

  const ColoringPagesHarness = () => {
    latestHook = useColoringPages();
    return <div>{latestHook.loadingHistory ? "loading" : latestHook.scopeError ?? "ready"}</div>;
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
    queryState.coloringPageDetails = [];
    queryState.coloringPages = [
      {
        created_at: "2026-03-20T00:00:00.000Z",
        difficulty: "medium",
        document_id: null,
        family_id: "family-a",
        id: "page-a",
        image_url: "https://example.test/a.png",
        prompt: "Family A prompt",
        user_id: "user-self",
      },
      {
        created_at: "2026-03-21T00:00:00.000Z",
        difficulty: "detailed",
        document_id: null,
        family_id: "family-b",
        id: "page-b",
        image_url: "https://example.test/b.png",
        prompt: "Family B prompt",
        user_id: "user-self",
      },
    ];
    queryState.documentAccessLogs = [];
    queryState.documents = [];

    insertLogs.length = 0;
    selectLogs.length = 0;
    updateLogs.length = 0;
    uploadLogs.length = 0;
    fetchMock.mockClear();
    vi.mocked(toast.error).mockReset();
    vi.mocked(toast.success).mockReset();
    createCreation.mockReset();

    familyState = {
      activeFamilyId: "family-a",
      profileId: "profile-parent",
    };

    mockedUseAuth.mockReturnValue({
      loading: false,
      user: { id: "user-self" },
    } as never);
    mockedUseFamily.mockImplementation(() => familyState as never);
    mockedUseCreations.mockReturnValue({
      createCreation,
    } as never);

    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
    latestHook = null;
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("loads coloring history for the active family scope", async () => {
    await renderHarness(<ColoringPagesHarness />);

    expect(latestHook?.scopeError).toBeNull();
    expect(latestHook?.history.map((page) => page.id)).toEqual(["page-a"]);
    expect(selectLogs).toContainEqual(
      expect.objectContaining({
        table: "coloring_pages",
        filters: expect.arrayContaining([
          expect.objectContaining({ field: "family_id", value: "family-a" }),
        ]),
      }),
    );
  });

  it("fails explicitly when active family scope is missing", async () => {
    familyState.activeFamilyId = null;

    await renderHarness(<ColoringPagesHarness />);

    expect(latestHook?.scopeError).toBe("Select an active family before using Coloring Pages.");
    expect(latestHook?.history).toEqual([]);
    expect(selectLogs.length).toBe(0);

    let result = true;
    await act(async () => {
      result = await latestHook!.saveToVault("https://example.test/a.png", "Prompt", "medium", "page-a");
    });

    expect(result).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("Select an active family before saving to the Document Vault");
  });

  it("isolates coloring history across family changes", async () => {
    await renderHarness(<ColoringPagesHarness />);
    expect(latestHook?.history.map((page) => page.id)).toEqual(["page-a"]);

    familyState.activeFamilyId = "family-b";
    await renderHarness(<ColoringPagesHarness />);

    expect(latestHook?.history.map((page) => page.id)).toEqual(["page-b"]);
    expect(selectLogs).toContainEqual(
      expect.objectContaining({
        table: "coloring_pages",
        filters: expect.arrayContaining([
          expect.objectContaining({ field: "family_id", value: "family-b" }),
        ]),
      }),
    );
  });

  it("saves to the vault with family scope and updates only the scoped coloring page", async () => {
    await renderHarness(<ColoringPagesHarness />);

    let result = false;
    await act(async () => {
      result = await latestHook!.saveToVault(
        "https://example.test/a.png",
        "Family A prompt",
        "medium",
        "page-a",
      );
      await flushPromises();
    });

    expect(result).toBe(true);
    expect(uploadLogs).toHaveLength(1);
    expect(insertLogs).toContainEqual(
      expect.objectContaining({
        table: "documents",
        payload: expect.objectContaining({
          family_id: "family-a",
          uploaded_by: "profile-parent",
        }),
      }),
    );
    expect(updateLogs).toContainEqual(
      expect.objectContaining({
        table: "coloring_pages",
        payload: expect.objectContaining({
          document_id: expect.any(String),
        }),
        filters: expect.arrayContaining([
          expect.objectContaining({ field: "id", value: "page-a" }),
          expect.objectContaining({ field: "family_id", value: "family-a" }),
        ]),
      }),
    );
    expect(insertLogs).toContainEqual(
      expect.objectContaining({
        table: "document_access_logs",
        payload: expect.objectContaining({
          accessed_by: "profile-parent",
          action: "upload",
        }),
      }),
    );
  });
});
