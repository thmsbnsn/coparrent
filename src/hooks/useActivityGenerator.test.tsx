import type { ReactNode } from "react";
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useActivityGenerator, type AIResponse } from "@/hooks/useActivityGenerator";
import { useAuth } from "@/contexts/AuthContext";
import { useFamily } from "@/contexts/FamilyContext";
import { useCreations } from "@/hooks/useCreations";

type JsonRecord = Record<string, unknown>;
type FilterLog = { field: string; type: "eq"; value: unknown };

interface ActivityFolderRow extends JsonRecord {
  created_at: string;
  family_id: string | null;
  id: string;
  name: string;
  updated_at: string;
  user_id: string;
}

interface ActivityRow extends JsonRecord {
  age_range: string;
  created_at: string;
  family_id: string | null;
  folder_id: string | null;
  id: string;
  indoor_outdoor: string | null;
  learning_goals: string[];
  materials: string[];
  mess_level: string | null;
  safety_notes: string | null;
  steps: string[];
  supervision_level: string | null;
  title: string;
  updated_at: string;
  user_id: string;
  variations: Record<string, unknown>;
  duration_minutes: number | null;
  energy_level: string | null;
  thumbnail_url: string | null;
}

const queryState = vi.hoisted(() => ({
  activityDetails: [] as JsonRecord[],
  activityFolders: [] as ActivityFolderRow[],
  generatedActivities: [] as ActivityRow[],
}));
const deleteLogs = vi.hoisted(() => [] as Array<{ filters: FilterLog[]; table: string }>);
const insertLogs = vi.hoisted(() => [] as Array<{ payload: JsonRecord; table: string }>);
const selectLogs = vi.hoisted(() => [] as Array<{ filters: FilterLog[]; table: string }>);
const toast = vi.hoisted(() => vi.fn());
const createCreation = vi.hoisted(() => vi.fn());

const cloneValue = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      let pendingDelete = false;
      let pendingInsert: JsonRecord | JsonRecord[] | null = null;
      let orderBy: { ascending: boolean; field: string } | null = null;
      const filters: FilterLog[] = [];

      const getTableRows = () => {
        switch (table) {
          case "activity_details":
            return queryState.activityDetails;
          case "activity_folders":
            return queryState.activityFolders;
          case "generated_activities":
            return queryState.generatedActivities;
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

        if (table === "activity_details") {
          queryState.activityDetails.push(row);
        }

        if (table === "activity_folders") {
          queryState.activityFolders.push(row as ActivityFolderRow);
        }

        if (table === "generated_activities") {
          queryState.generatedActivities.push(row as ActivityRow);
        }

        insertLogs.push({ payload: normalizedPayload, table });
        return cloneValue(row);
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
        insert: (payload: JsonRecord | JsonRecord[]) => {
          pendingInsert = cloneValue(payload);
          return builder;
        },
        order: (field: string, options?: { ascending?: boolean }) => {
          orderBy = { ascending: options?.ascending ?? true, field };
          return builder;
        },
        select: () => builder,
        single: async () => {
          if (pendingInsert) {
            const payload = Array.isArray(pendingInsert) ? pendingInsert[0] : pendingInsert;
            return { data: pushInsertedRow(payload), error: null };
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
            if (pendingDelete) {
              deleteLogs.push({ filters: cloneValue(filters), table });

              if (table === "activity_details") {
                queryState.activityDetails = queryState.activityDetails.filter((row) => !matches(row));
              }

              if (table === "activity_folders") {
                queryState.activityFolders = queryState.activityFolders.filter((row) => !matches(row));
              }

              if (table === "generated_activities") {
                queryState.generatedActivities = queryState.generatedActivities.filter((row) => !matches(row));
              }

              return { data: null, error: null };
            }

            const rows = getRows();
            selectLogs.push({ filters: cloneValue(filters), table });
            return { data: rows, error: null };
          };

          return execute().then(onfulfilled ?? undefined, onrejected ?? undefined);
        },
      };

      return builder;
    },
    functions: {
      invoke: vi.fn(async () => ({
        data: {
          result: {
            age_range: "6-8",
            learning_goals: ["focus"],
            materials: ["paper"],
            steps: ["step"],
            title: "Generated Activity",
            type: "activity",
            variations: {},
          },
        },
        error: null,
      })),
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

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast,
  }),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseCreations = vi.mocked(useCreations);
const mockedUseFamily = vi.mocked(useFamily);

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const sampleActivity: AIResponse = {
  age_range: "6-8",
  learning_goals: ["focus"],
  materials: ["paper", "markers"],
  steps: ["Draw a maze", "Race to solve it"],
  title: "Maze Challenge",
  type: "activity",
  variations: { easier: "Use larger paths" },
};

describe("useActivityGenerator", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let latestHook: ReturnType<typeof useActivityGenerator> | null = null;
  let familyState: { activeFamilyId: string | null };

  const ActivityHarness = () => {
    const hook = useActivityGenerator();
    const { fetchActivities, fetchFolders, loading, scopeError } = hook;
    latestHook = hook;

    useEffect(() => {
      void fetchFolders();
      void fetchActivities();
    }, [fetchActivities, fetchFolders]);

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
    queryState.activityDetails = [];
    queryState.activityFolders = [
      {
        created_at: "2026-03-10T00:00:00.000Z",
        family_id: "family-a",
        id: "folder-a",
        name: "Family A Folder",
        updated_at: "2026-03-10T00:00:00.000Z",
        user_id: "user-self",
      },
      {
        created_at: "2026-03-11T00:00:00.000Z",
        family_id: "family-b",
        id: "folder-b",
        name: "Family B Folder",
        updated_at: "2026-03-11T00:00:00.000Z",
        user_id: "user-self",
      },
    ];
    queryState.generatedActivities = [
      {
        age_range: "6-8",
        created_at: "2026-03-12T00:00:00.000Z",
        duration_minutes: 20,
        energy_level: "moderate",
        family_id: "family-a",
        folder_id: "folder-a",
        id: "activity-a",
        indoor_outdoor: "indoor",
        learning_goals: ["focus"],
        materials: ["paper"],
        mess_level: "low",
        safety_notes: null,
        steps: ["Step A"],
        supervision_level: "low",
        thumbnail_url: null,
        title: "Family A Activity",
        updated_at: "2026-03-12T00:00:00.000Z",
        user_id: "user-self",
        variations: {},
      },
      {
        age_range: "9-11",
        created_at: "2026-03-13T00:00:00.000Z",
        duration_minutes: 30,
        energy_level: "high",
        family_id: "family-b",
        folder_id: "folder-b",
        id: "activity-b",
        indoor_outdoor: "outdoor",
        learning_goals: ["teamwork"],
        materials: ["ball"],
        mess_level: "medium",
        safety_notes: null,
        steps: ["Step B"],
        supervision_level: "medium",
        thumbnail_url: null,
        title: "Family B Activity",
        updated_at: "2026-03-13T00:00:00.000Z",
        user_id: "user-self",
        variations: {},
      },
    ];

    deleteLogs.length = 0;
    insertLogs.length = 0;
    selectLogs.length = 0;
    toast.mockReset();
    createCreation.mockReset();

    familyState = { activeFamilyId: "family-a" };

    mockedUseAuth.mockReturnValue({
      loading: false,
      user: { id: "user-self" },
    } as never);
    mockedUseFamily.mockImplementation(() => familyState as never);
    mockedUseCreations.mockReturnValue({
      createCreation,
    } as never);
    createCreation.mockResolvedValue({ id: "creation-a" });
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

  it("loads folders and saved activities for the active family scope", async () => {
    await renderHarness(<ActivityHarness />);

    expect(latestHook?.scopeError).toBeNull();
    expect(latestHook?.folders.map((folder) => folder.id)).toEqual(["folder-a"]);
    expect(latestHook?.activities.map((activity) => activity.id)).toEqual(["activity-a"]);
    expect(selectLogs).toContainEqual(
      expect.objectContaining({
        table: "activity_folders",
        filters: expect.arrayContaining([
          expect.objectContaining({ field: "family_id", value: "family-a" }),
        ]),
      }),
    );
    expect(selectLogs).toContainEqual(
      expect.objectContaining({
        table: "generated_activities",
        filters: expect.arrayContaining([
          expect.objectContaining({ field: "family_id", value: "family-a" }),
        ]),
      }),
    );
  });

  it("fails explicitly when active family scope is missing", async () => {
    familyState.activeFamilyId = null;

    await renderHarness(<ActivityHarness />);

    expect(latestHook?.scopeError).toBe("Select an active family before using saved activities.");
    expect(latestHook?.folders).toEqual([]);
    expect(latestHook?.activities).toEqual([]);
    expect(selectLogs.length).toBe(0);

    let createFolderResult: unknown = null;
    let saveActivityResult: unknown = null;

    await act(async () => {
      createFolderResult = await latestHook?.createFolder("Blocked Folder");
      saveActivityResult = await latestHook?.saveActivity(sampleActivity);
    });

    expect(createFolderResult).toBeNull();
    expect(saveActivityResult).toBeNull();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Active family required",
        variant: "destructive",
      }),
    );
  });

  it("isolates saved activity history across family changes", async () => {
    await renderHarness(<ActivityHarness />);
    expect(latestHook?.activities.map((activity) => activity.id)).toEqual(["activity-a"]);

    familyState.activeFamilyId = "family-b";
    await renderHarness(<ActivityHarness />);

    expect(latestHook?.folders.map((folder) => folder.id)).toEqual(["folder-b"]);
    expect(latestHook?.activities.map((activity) => activity.id)).toEqual(["activity-b"]);
    expect(selectLogs).toContainEqual(
      expect.objectContaining({
        table: "generated_activities",
        filters: expect.arrayContaining([
          expect.objectContaining({ field: "family_id", value: "family-b" }),
        ]),
      }),
    );
  });

  it("rolls back the saved activity when the Creations write fails", async () => {
    createCreation.mockResolvedValue(null);
    await renderHarness(<ActivityHarness />);

    let result: unknown = null;

    await act(async () => {
      result = await latestHook?.saveActivity(sampleActivity, "folder-a");
      await flushPromises();
    });

    expect(result).toBeNull();
    expect(insertLogs).toContainEqual(
      expect.objectContaining({
        table: "generated_activities",
        payload: expect.objectContaining({
          family_id: "family-a",
          folder_id: "folder-a",
          title: "Maze Challenge",
          user_id: "user-self",
        }),
      }),
    );
    expect(insertLogs).toContainEqual(
      expect.objectContaining({
        table: "activity_details",
        payload: expect.objectContaining({
          family_id: "family-a",
          owner_user_id: "user-self",
        }),
      }),
    );
    expect(deleteLogs).toContainEqual(
      expect.objectContaining({
        table: "activity_details",
        filters: expect.arrayContaining([
          expect.objectContaining({ field: "family_id", value: "family-a" }),
        ]),
      }),
    );
    expect(deleteLogs).toContainEqual(
      expect.objectContaining({
        table: "generated_activities",
        filters: expect.arrayContaining([
          expect.objectContaining({ field: "family_id", value: "family-a" }),
        ]),
      }),
    );
    expect(toast).not.toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Activity saved!",
      }),
    );
  });
});
