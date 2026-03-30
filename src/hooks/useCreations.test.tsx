import { useEffect, type ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCreations } from "@/hooks/useCreations";
import { useAuth } from "@/contexts/AuthContext";
import { useFamily } from "@/contexts/FamilyContext";
import { toast } from "sonner";

type JsonRecord = Record<string, unknown>;
type FilterLog =
  | { field: string; type: "eq"; value: unknown }
  | { field: string; type: "ilike"; value: string }
  | { field: string; type: "is"; value: unknown };

interface CreationFolderRow extends JsonRecord {
  created_at: string;
  family_id: string | null;
  id: string;
  name: string;
  owner_user_id: string;
  updated_at: string;
}

interface CreationRow extends JsonRecord {
  created_at: string;
  detail_id: string;
  family_id: string | null;
  folder_id: string | null;
  id: string;
  meta: JsonRecord | null;
  owner_profile_id: string | null;
  owner_user_id: string;
  thumbnail_url: string | null;
  title: string;
  type: "activity" | "coloring_page";
  updated_at: string;
}

interface CreationShareRow extends JsonRecord {
  created_at: string;
  creation_id: string;
  family_id: string | null;
  id: string;
  owner_user_id: string;
  permission: string;
  shared_with_profile_id: string;
}

interface FamilyMemberRow extends JsonRecord {
  family_id: string;
  profile_id: string;
  status: string;
}

const queryState = vi.hoisted(() => ({
  creationFolders: [] as CreationFolderRow[],
  creationShares: [] as CreationShareRow[],
  creations: [] as CreationRow[],
  familyMembers: [] as FamilyMemberRow[],
  profiles: [] as Array<{
    avatar_url: string | null;
    email: string | null;
    full_name: string | null;
    id: string;
  }>,
}));

const selectLogs = vi.hoisted(() => [] as Array<{ columns: string; filters: FilterLog[]; table: string }>);
const insertLogs = vi.hoisted(() => [] as Array<{ payload: JsonRecord; table: string }>);

const cloneValue = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      let columns = "";
      const filters: FilterLog[] = [];
      let pendingDelete = false;
      let pendingInsert: JsonRecord | null = null;
      let pendingUpdate: JsonRecord | null = null;
      let orderBy: { ascending: boolean; field: string } | null = null;

      const getTableRows = () => {
        switch (table) {
          case "creation_folders":
            return queryState.creationFolders;
          case "creation_shares":
            return queryState.creationShares;
          case "creations":
            return queryState.creations;
          case "family_members":
            return queryState.familyMembers;
          default:
            return [];
        }
      };

      const getFieldValue = (row: JsonRecord, field: string): unknown => row[field];

      const matches = (row: JsonRecord) =>
        filters.every((filter) => {
          const fieldValue = getFieldValue(row, filter.field);
          if (filter.type === "eq") {
            return fieldValue === filter.value;
          }

          if (filter.type === "is") {
            return fieldValue === filter.value;
          }

          const rawFieldValue = String(fieldValue ?? "").toLowerCase();
          const pattern = filter.value.toLowerCase().replace(/%/g, "");
          return rawFieldValue.includes(pattern);
        });

      const decorateRow = (row: JsonRecord) => {
        if (table === "creations" && columns.includes("folder:creation_folders")) {
          const creation = cloneValue(row) as CreationRow & {
            folder?: CreationFolderRow | null;
          };
          creation.folder =
            queryState.creationFolders.find((folder) => folder.id === creation.folder_id) ?? null;
          return creation as JsonRecord;
        }

        if (table === "family_members" && columns.includes("profiles!family_members_profile_id_fkey")) {
          const familyMember = cloneValue(row) as FamilyMemberRow & {
            profiles?: {
              avatar_url: string | null;
              email: string | null;
              full_name: string | null;
              id: string;
            } | null;
          };
          familyMember.profiles =
            queryState.profiles.find((profile) => profile.id === familyMember.profile_id) ?? null;
          return familyMember as JsonRecord;
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
        ilike: (field: string, value: string) => {
          filters.push({ field, type: "ilike", value });
          return builder;
        },
        insert: (payload: JsonRecord) => {
          pendingInsert = cloneValue(payload);
          return builder;
        },
        is: (field: string, value: unknown) => {
          filters.push({ field, type: "is", value });
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
              created_at: "2026-03-30T12:00:00.000Z",
              id: pendingInsert.id ?? `${table}-${Date.now()}`,
              updated_at: "2026-03-30T12:00:00.000Z",
              ...cloneValue(pendingInsert),
            };

            if (table === "creation_folders") {
              queryState.creationFolders.push(row as CreationFolderRow);
            }

            if (table === "creations") {
              queryState.creations.push(row as CreationRow);
            }

            if (table === "creation_shares") {
              queryState.creationShares.push(row as CreationShareRow);
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
            error: null,
          };
        },
        then: (
          onfulfilled?: ((value: { data: JsonRecord[] | null; error: null }) => unknown) | null,
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

              if (table === "creation_folders") {
                queryState.creationFolders.push(row as CreationFolderRow);
              }

              if (table === "creations") {
                queryState.creations.push(row as CreationRow);
              }

              if (table === "creation_shares") {
                queryState.creationShares.push(row as CreationShareRow);
              }

              insertLogs.push({ payload: cloneValue(pendingInsert), table });
              return { data: null, error: null };
            }

            if (pendingUpdate) {
              if (table === "creation_folders") {
                queryState.creationFolders = queryState.creationFolders.map((row) =>
                  matches(row) ? ({ ...row, ...cloneValue(pendingUpdate) } as CreationFolderRow) : row,
                );
              }

              if (table === "creations") {
                queryState.creations = queryState.creations.map((row) =>
                  matches(row) ? ({ ...row, ...cloneValue(pendingUpdate) } as CreationRow) : row,
                );
              }

              if (table === "creation_shares") {
                queryState.creationShares = queryState.creationShares.map((row) =>
                  matches(row) ? ({ ...row, ...cloneValue(pendingUpdate) } as CreationShareRow) : row,
                );
              }

              return { data: null, error: null };
            }

            if (pendingDelete) {
              if (table === "creation_folders") {
                queryState.creationFolders = queryState.creationFolders.filter((row) => !matches(row));
              }

              if (table === "creation_shares") {
                queryState.creationShares = queryState.creationShares.filter((row) => !matches(row));
              }

              if (table === "creations") {
                queryState.creations = queryState.creations.filter((row) => !matches(row));
              }

              return { data: null, error: null };
            }

            const rows = getRows();
            selectLogs.push({ columns, filters: cloneValue(filters), table });
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
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/contexts/FamilyContext", () => ({
  useFamily: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseFamily = vi.mocked(useFamily);

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe("useCreations", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let latestHook: ReturnType<typeof useCreations> | null = null;
  let familyState: {
    activeFamilyId: string | null;
    profileId: string | null;
  };

  const CreationsHarness = () => {
    const hook = useCreations();
    const { fetchCreations, fetchFamilyMembers, loading, scopeError } = hook;
    latestHook = hook;

    useEffect(() => {
      void fetchCreations();
      void fetchFamilyMembers();
    }, [fetchCreations, fetchFamilyMembers]);

    return <div>{loading ? "loading" : scopeError ?? "ready"}</div>;
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
    queryState.creationFolders = [
      {
        created_at: "2026-03-01T00:00:00.000Z",
        family_id: "family-a",
        id: "folder-a",
        name: "Family A Folder",
        owner_user_id: "user-self",
        updated_at: "2026-03-01T00:00:00.000Z",
      },
      {
        created_at: "2026-03-02T00:00:00.000Z",
        family_id: "family-b",
        id: "folder-b",
        name: "Family B Folder",
        owner_user_id: "user-self",
        updated_at: "2026-03-02T00:00:00.000Z",
      },
    ];
    queryState.creations = [
      {
        created_at: "2026-03-08T00:00:00.000Z",
        detail_id: "detail-own-a",
        family_id: "family-a",
        folder_id: "folder-a",
        id: "creation-own-a",
        meta: { difficulty: "medium" },
        owner_profile_id: "profile-self",
        owner_user_id: "user-self",
        thumbnail_url: null,
        title: "Own Family A Creation",
        type: "activity",
        updated_at: "2026-03-08T00:00:00.000Z",
      },
      {
        created_at: "2026-03-09T00:00:00.000Z",
        detail_id: "detail-shared-a",
        family_id: "family-a",
        folder_id: null,
        id: "creation-shared-a",
        meta: { difficulty: "simple" },
        owner_profile_id: "profile-other-a",
        owner_user_id: "user-other-a",
        thumbnail_url: null,
        title: "Shared Family A Creation",
        type: "coloring_page",
        updated_at: "2026-03-09T00:00:00.000Z",
      },
      {
        created_at: "2026-03-10T00:00:00.000Z",
        detail_id: "detail-unshared-a",
        family_id: "family-a",
        folder_id: null,
        id: "creation-unshared-a",
        meta: { difficulty: "detailed" },
        owner_profile_id: "profile-other-b",
        owner_user_id: "user-other-b",
        thumbnail_url: null,
        title: "Unshared Family A Creation",
        type: "activity",
        updated_at: "2026-03-10T00:00:00.000Z",
      },
      {
        created_at: "2026-03-11T00:00:00.000Z",
        detail_id: "detail-own-b",
        family_id: "family-b",
        folder_id: "folder-b",
        id: "creation-own-b",
        meta: { difficulty: "medium" },
        owner_profile_id: "profile-self",
        owner_user_id: "user-self",
        thumbnail_url: null,
        title: "Own Family B Creation",
        type: "activity",
        updated_at: "2026-03-11T00:00:00.000Z",
      },
    ];
    queryState.creationShares = [
      {
        created_at: "2026-03-12T00:00:00.000Z",
        creation_id: "creation-shared-a",
        family_id: "family-a",
        id: "share-a",
        owner_user_id: "user-other-a",
        permission: "view",
        shared_with_profile_id: "profile-self",
      },
      {
        created_at: "2026-03-13T00:00:00.000Z",
        creation_id: "creation-own-b",
        family_id: "family-b",
        id: "share-b",
        owner_user_id: "user-self",
        permission: "view",
        shared_with_profile_id: "profile-target-b",
      },
    ];
    queryState.familyMembers = [
      { family_id: "family-a", profile_id: "profile-self", status: "active" },
      { family_id: "family-a", profile_id: "profile-target-a", status: "active" },
      { family_id: "family-b", profile_id: "profile-self", status: "active" },
      { family_id: "family-b", profile_id: "profile-target-b", status: "active" },
    ];
    queryState.profiles = [
      { avatar_url: null, email: "self@example.com", full_name: "Self Parent", id: "profile-self" },
      { avatar_url: null, email: "target-a@example.com", full_name: "Taylor Family A", id: "profile-target-a" },
      { avatar_url: null, email: "target-b@example.com", full_name: "Jordan Family B", id: "profile-target-b" },
      { avatar_url: null, email: "other-a@example.com", full_name: "Morgan Family A", id: "profile-other-a" },
      { avatar_url: null, email: "other-b@example.com", full_name: "Avery Family A", id: "profile-other-b" },
    ];

    selectLogs.length = 0;
    insertLogs.length = 0;
    vi.mocked(toast.error).mockReset();
    vi.mocked(toast.success).mockReset();

    familyState = {
      activeFamilyId: "family-a",
      profileId: "profile-self",
    };

    mockedUseAuth.mockReturnValue({
      loading: false,
      user: { id: "user-self" },
    } as never);
    mockedUseFamily.mockImplementation(() => ({
      activeFamilyId: familyState.activeFamilyId,
      profileId: familyState.profileId,
    }) as never);
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

  it("loads creations for the active family and preserves private-by-default visibility", async () => {
    await renderHarness(<CreationsHarness />);

    expect(latestHook?.scopeError).toBeNull();
    expect(latestHook?.folders.map((folder) => folder.id)).toEqual(["folder-a"]);
    expect(latestHook?.creations.map((creation) => creation.id)).toEqual([
      "creation-shared-a",
      "creation-own-a",
    ]);
    expect(latestHook?.creations.some((creation) => creation.id === "creation-unshared-a")).toBe(false);
    expect(latestHook?.creations.find((creation) => creation.id === "creation-own-a")?.folder?.id).toBe("folder-a");
    expect(selectLogs).toContainEqual(
      expect.objectContaining({
        table: "creations",
        filters: expect.arrayContaining([
          expect.objectContaining({ field: "family_id", type: "eq", value: "family-a" }),
        ]),
      }),
    );
    expect(selectLogs).toContainEqual(
      expect.objectContaining({
        table: "creation_shares",
        filters: expect.arrayContaining([
          expect.objectContaining({ field: "family_id", type: "eq", value: "family-a" }),
          expect.objectContaining({ field: "shared_with_profile_id", type: "eq", value: "profile-self" }),
        ]),
      }),
    );
  });

  it("fails explicitly when active family scope is missing", async () => {
    familyState.activeFamilyId = null;

    await renderHarness(<CreationsHarness />);

    expect(latestHook?.scopeError).toBe("Select an active family before using the Creations Library.");
    expect(latestHook?.folders).toEqual([]);
    expect(latestHook?.creations).toEqual([]);
    expect(latestHook?.familyMembers).toEqual([]);
    expect(selectLogs.length).toBe(0);

    let creationResult: unknown = null;
    let folderResult: unknown = null;
    let shareResult = true;

    await act(async () => {
      creationResult = await latestHook!.createCreation({
        detail_id: "detail-new",
        title: "Blocked Creation",
        type: "activity",
      });
      folderResult = await latestHook!.createFolder("Blocked Folder");
      shareResult = await latestHook!.shareCreation("creation-own-a", "profile-target-a");
    });

    expect(creationResult).toBeNull();
    expect(folderResult).toBeNull();
    expect(shareResult).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("Select an active family before using the Creations Library");
  });

  it("writes new creations and shares with the active family scope", async () => {
    await renderHarness(<CreationsHarness />);

    await act(async () => {
      await latestHook!.createCreation({
        detail_id: "detail-new",
        meta: { difficulty: "simple" },
        title: "New Scoped Creation",
        type: "activity",
      });
      await latestHook!.shareCreation("creation-own-a", "profile-target-a");
    });

    expect(insertLogs).toContainEqual(
      expect.objectContaining({
        table: "creations",
        payload: expect.objectContaining({
          detail_id: "detail-new",
          family_id: "family-a",
          owner_profile_id: "profile-self",
          owner_user_id: "user-self",
          title: "New Scoped Creation",
          type: "activity",
        }),
      }),
    );
    expect(insertLogs).toContainEqual(
      expect.objectContaining({
        table: "creation_shares",
        payload: expect.objectContaining({
          creation_id: "creation-own-a",
          family_id: "family-a",
          owner_user_id: "user-self",
          shared_with_profile_id: "profile-target-a",
        }),
      }),
    );
  });

  it("isolates creations and share targets across active family changes", async () => {
    await renderHarness(<CreationsHarness />);

    expect(latestHook?.creations.map((creation) => creation.id)).toEqual([
      "creation-shared-a",
      "creation-own-a",
    ]);
    expect(latestHook?.familyMembers.map((member) => member.id)).toEqual(["profile-target-a"]);

    familyState.activeFamilyId = "family-b";
    await renderHarness(<CreationsHarness />);

    expect(latestHook?.creations.map((creation) => creation.id)).toEqual(["creation-own-b"]);
    expect(latestHook?.familyMembers.map((member) => member.id)).toEqual(["profile-target-b"]);
    expect(selectLogs).toContainEqual(
      expect.objectContaining({
        table: "family_members",
        filters: expect.arrayContaining([
          expect.objectContaining({ field: "family_id", type: "eq", value: "family-b" }),
        ]),
      }),
    );
  });
});
