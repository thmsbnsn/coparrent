import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetCreateClientImplementation,
  __setCreateClientImplementation,
} from "./test-shims/supabaseEdge";

type JsonRecord = Record<string, unknown>;

interface TestState {
  tables: Record<string, JsonRecord[]>;
}

const resendSendMock = vi.hoisted(() => vi.fn(async () => ({ data: { id: "email-1" }, error: null })));
const selectLogs = vi.hoisted(() => [] as Array<{ columns: string; filters: Array<{ field: string; type: string; value: unknown }>; table: string }>);

vi.mock("https://esm.sh/resend@2.0.0", () => ({
  Resend: class {
    emails = {
      send: resendSendMock,
    };
  },
}));

class MockQueryBuilder {
  private filters: Array<{ field: string; type: "eq" | "gte" | "in" | "lte"; value: unknown }> = [];
  private orderBy: { ascending: boolean; field: string } | null = null;
  private selectedColumns = "";

  constructor(
    private readonly state: TestState,
    private readonly tableName: string,
  ) {}

  select(columns: string): this {
    this.selectedColumns = columns;
    return this;
  }

  eq(field: string, value: unknown): this {
    this.filters.push({ field, type: "eq", value });
    return this;
  }

  gte(field: string, value: unknown): this {
    this.filters.push({ field, type: "gte", value });
    return this;
  }

  in(field: string, value: unknown[]): this {
    this.filters.push({ field, type: "in", value: structuredClone(value) });
    return this;
  }

  lte(field: string, value: unknown): this {
    this.filters.push({ field, type: "lte", value });
    return this;
  }

  order(field: string, options?: { ascending?: boolean }): this {
    this.orderBy = { ascending: options?.ascending ?? true, field };
    return this;
  }

  async single(): Promise<{ data: JsonRecord | null; error: Error | null }> {
    const rows = this.getRows();
    selectLogs.push({ columns: this.selectedColumns, filters: structuredClone(this.filters), table: this.tableName });

    if (rows.length === 0) {
      return { data: null, error: new Error(`No rows found for ${this.tableName}`) };
    }

    return { data: rows[0], error: null };
  }

  then<TResult1 = { data: JsonRecord[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: JsonRecord[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    const rows = this.getRows();
    selectLogs.push({ columns: this.selectedColumns, filters: structuredClone(this.filters), table: this.tableName });
    return Promise.resolve({ data: rows, error: null }).then(onfulfilled, onrejected);
  }

  private getRows(): JsonRecord[] {
    let rows = (this.state.tables[this.tableName] ?? [])
      .filter((row) =>
        this.filters.every((filter) => {
          const fieldValue = row[filter.field];

          if (filter.type === "eq") {
            return fieldValue === filter.value;
          }

          if (filter.type === "in") {
            return (filter.value as unknown[]).includes(fieldValue);
          }

          if (filter.type === "gte") {
            return String(fieldValue ?? "") >= String(filter.value ?? "");
          }

          return String(fieldValue ?? "") <= String(filter.value ?? "");
        }),
      )
      .map((row) => structuredClone(row));

    if (this.orderBy) {
      rows = rows.sort((left, right) => {
        const leftValue = String(left[this.orderBy!.field] ?? "");
        const rightValue = String(right[this.orderBy!.field] ?? "");
        const comparison = leftValue.localeCompare(rightValue);
        return this.orderBy!.ascending ? comparison : comparison * -1;
      });
    }

    return rows;
  }
}

class MockSupabaseClient {
  constructor(private readonly state: TestState) {}

  from(tableName: string) {
    return {
      insert: async (payload: JsonRecord | JsonRecord[]) => {
        const rows = Array.isArray(payload) ? payload : [payload];
        if (!this.state.tables[tableName]) {
          this.state.tables[tableName] = [];
        }

        for (const row of rows) {
          this.state.tables[tableName].push(structuredClone(row));
        }

        return { data: null, error: null };
      },
      select: (columns: string) => new MockQueryBuilder(this.state, tableName).select(columns),
    };
  }
}

const envValues: Record<string, string | undefined> = {
  APP_URL: "https://coparrent.com",
  RESEND_API_KEY: "resend-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  SUPABASE_URL: "https://example.supabase.co",
};

const formatTime = (date: Date) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

const buildRequest = () =>
  new Request("https://example.functions.supabase.co/reminders", {
    method: "POST",
  });

describe("family-scoped reminder recipients", () => {
  let sportsHandler: (req: Request) => Promise<Response> | Response;
  let exchangeHandler: (req: Request) => Promise<Response> | Response;

  beforeAll(async () => {
    vi.stubGlobal("Deno", {
      env: {
        get: (key: string) => envValues[key],
      },
    });

    const serverShim = await import("./test-shims/denoHttpServer");

    serverShim.__resetServedHandler();
    await import("../sports-event-reminders/index.ts");
    sportsHandler = serverShim.__getServedHandler();

    serverShim.__resetServedHandler();
    await import("../exchange-reminders/index.ts");
    exchangeHandler = serverShim.__getServedHandler();
  });

  beforeEach(() => {
    resendSendMock.mockClear();
    selectLogs.length = 0;
    __resetCreateClientImplementation();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("scopes sports reminder recipients to the event family only", async () => {
    const now = new Date("2026-03-30T16:00:00.000Z");
    vi.setSystemTime(now);
    const eventStart = new Date(now.getTime() + 60 * 60 * 1000);
    const state: TestState = {
      tables: {
        activity_events: [
          {
            activity_id: "activity-a",
            created_by: "profile-parent-a1",
            dropoff_parent_id: "profile-parent-a1",
            end_time: null,
            equipment_needed: null,
            event_date: eventStart.toISOString().split("T")[0],
            event_type: "practice",
            id: "event-a",
            is_cancelled: false,
            location_address: "123 Field Rd",
            location_name: "Family A Field",
            pickup_parent_id: "profile-parent-a2",
            start_time: formatTime(eventStart),
            title: "Soccer Practice",
            venue_notes: null,
          },
        ],
        child_activities: [
          {
            child_id: "child-a-1",
            children: { id: "child-a-1", name: "Alex" },
            family_id: "family-a",
            id: "activity-a",
            name: "Soccer",
            primary_parent_id: "profile-parent-a1",
            sport_type: "soccer",
          },
        ],
        family_members: [
          { family_id: "family-a", profile_id: "profile-parent-a1", role: "parent", status: "active" },
          { family_id: "family-a", profile_id: "profile-parent-a2", role: "guardian", status: "active" },
          { family_id: "family-b", profile_id: "profile-parent-b1", role: "parent", status: "active" },
        ],
        notifications: [],
        profiles: [
          {
            email: "a1@example.com",
            full_name: "Casey Parent",
            id: "profile-parent-a1",
            notification_preferences: { enabled: true, sports_reminders: true, sports_reminder_1h: true },
          },
          {
            email: "a2@example.com",
            full_name: "Taylor Guardian",
            id: "profile-parent-a2",
            notification_preferences: { enabled: true, sports_reminders: true, sports_reminder_1h: true },
          },
          {
            email: "b1@example.com",
            full_name: "Morgan Parent",
            id: "profile-parent-b1",
            notification_preferences: { enabled: true, sports_reminders: true, sports_reminder_1h: true },
          },
        ],
      },
    };

    __setCreateClientImplementation(() => new MockSupabaseClient(state));

    const response = await sportsHandler(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.results.sent).toBe(2);
    expect((state.tables.notifications ?? []).map((row) => row.user_id).sort()).toEqual([
      "profile-parent-a1",
      "profile-parent-a2",
    ]);
    expect((state.tables.notifications ?? []).map((row) => row.user_id)).not.toContain("profile-parent-b1");
    expect(selectLogs.some((log) => log.columns.includes("co_parent_id"))).toBe(false);
  });

  it("scopes exchange reminder recipients to the schedule family only", async () => {
    const now = new Date("2026-03-30T16:00:00.000Z");
    vi.setSystemTime(now);
    const exchangeTime = new Date(now.getTime() + 30 * 60 * 1000);
    const state: TestState = {
      tables: {
        children: [
          { id: "child-a-1", name: "Alex" },
        ],
        custody_schedules: [
          {
            child_ids: ["child-a-1"],
            exchange_location: "School",
            exchange_time: formatTime(exchangeTime),
            family_id: "family-a",
            id: "schedule-a",
            parent_a_id: "profile-parent-a1",
            parent_b_id: "profile-parent-b1",
            pattern: "weekly",
            start_date: now.toISOString().split("T")[0],
          },
        ],
        family_members: [
          { family_id: "family-a", profile_id: "profile-parent-a1", role: "parent", status: "active" },
          { family_id: "family-a", profile_id: "profile-parent-a2", role: "guardian", status: "active" },
          { family_id: "family-b", profile_id: "profile-parent-b1", role: "parent", status: "active" },
        ],
        notifications: [],
        profiles: [
          {
            email: "a1@example.com",
            full_name: "Casey Parent",
            id: "profile-parent-a1",
            notification_preferences: { enabled: true, upcoming_exchanges: true, exchange_reminder_30min: true },
          },
          {
            email: "a2@example.com",
            full_name: "Taylor Guardian",
            id: "profile-parent-a2",
            notification_preferences: { enabled: true, upcoming_exchanges: true, exchange_reminder_30min: true },
          },
          {
            email: "b1@example.com",
            full_name: "Morgan Parent",
            id: "profile-parent-b1",
            notification_preferences: { enabled: true, upcoming_exchanges: true, exchange_reminder_30min: true },
          },
        ],
      },
    };

    __setCreateClientImplementation(() => new MockSupabaseClient(state));

    const response = await exchangeHandler(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.results.sent).toBe(2);
    expect((state.tables.notifications ?? []).map((row) => row.user_id).sort()).toEqual([
      "profile-parent-a1",
      "profile-parent-a2",
    ]);
    expect((state.tables.notifications ?? []).map((row) => row.user_id)).not.toContain("profile-parent-b1");
  });
});
