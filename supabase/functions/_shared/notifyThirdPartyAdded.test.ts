import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type JsonRecord = Record<string, unknown>;

interface TestState {
  authUsers: Record<string, { id: string } | null>;
  tables: Record<string, JsonRecord[]>;
}

class MockQueryBuilder {
  private filters: Array<(row: JsonRecord) => boolean> = [];
  private operation: "select" | "update" = "select";
  private updatePayload: JsonRecord | null = null;

  constructor(
    private readonly state: TestState,
    private readonly tableName: string,
  ) {}

  select(_columns: string): this {
    this.operation = "select";
    return this;
  }

  eq(field: string, value: unknown): this {
    this.filters.push((row) => row[field] === value);
    return this;
  }

  in(field: string, values: unknown[]): this {
    this.filters.push((row) => values.includes(row[field]));
    return this;
  }

  order(): this {
    return this;
  }

  returns<T>(): T {
    return this as T;
  }

  update(payload: JsonRecord): this {
    this.operation = "update";
    this.updatePayload = payload;
    return this;
  }

  async maybeSingle(): Promise<{ data: JsonRecord | null; error: null }> {
    const rows = this.getRows();
    return { data: rows[0] ?? null, error: null };
  }

  async single(): Promise<{ data: JsonRecord | null; error: Error | null }> {
    const rows = this.getRows();
    if (rows.length === 0) {
      return { data: null, error: new Error(`No rows found for ${this.tableName}`) };
    }

    return { data: rows[0], error: null };
  }

  then<TResult1 = { data: JsonRecord[] | null; error: Error | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: JsonRecord[] | null; error: Error | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<{ data: JsonRecord[] | null; error: Error | null }> {
    if (this.operation === "update") {
      const rows = this.state.tables[this.tableName] ?? [];
      for (const row of rows.filter((candidate) => this.filters.every((filter) => filter(candidate)))) {
        Object.assign(row, this.updatePayload ?? {});
      }

      return { data: null, error: null };
    }

    return { data: this.getRows(), error: null };
  }

  private getRows(): JsonRecord[] {
    const rows = this.state.tables[this.tableName] ?? [];
    return rows
      .filter((row) => this.filters.every((filter) => filter(row)))
      .map((row) => structuredClone(row));
  }
}

class MockSupabaseClient {
  private idCounter = 0;

  constructor(private readonly state: TestState) {}

  auth = {
    getUser: async (token: string) => {
      const user = this.state.authUsers[token] ?? null;
      if (!user) {
        return {
          data: { user: null },
          error: new Error("Authentication failed"),
        };
      }

      return {
        data: { user },
        error: null,
      };
    },
  };

  from(tableName: string) {
    const state = this.state;
    const ensureTable = () => {
      if (!state.tables[tableName]) {
        state.tables[tableName] = [];
      }
      return state.tables[tableName];
    };

    return {
      select: (columns: string) => new MockQueryBuilder(state, tableName).select(columns),
      insert: async (payload: JsonRecord | JsonRecord[]) => {
        const rows = ensureTable();
        const inserts = Array.isArray(payload) ? payload : [payload];

        if (tableName === "function_usage_daily") {
          for (const record of inserts) {
            const duplicate = rows.find((row) =>
              row.user_id === record.user_id &&
              row.function_name === record.function_name &&
              row.usage_date === record.usage_date,
            );

            if (duplicate) {
              return {
                data: null,
                error: { code: "23505", message: "duplicate key value violates unique constraint" },
              };
            }
          }
        }

        for (const record of inserts) {
          rows.push({
            id: (record.id as string | undefined) ?? `${tableName}-${++this.idCounter}`,
            ...structuredClone(record),
          });
        }

        return { data: null, error: null };
      },
      update: (payload: JsonRecord) => new MockQueryBuilder(state, tableName).update(payload),
    };
  }
}

const envValues: Record<string, string | undefined> = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  RESEND_API_KEY: "resend-api-key",
  APP_URL: "https://coparrent.com",
};

const FAMILY_ID = "11111111-1111-1111-1111-111111111111";
const THIRD_PARTY_MEMBER_ID = "22222222-2222-2222-2222-222222222222";

const fetchMock = vi.fn();

const createState = (): TestState => ({
  authUsers: {},
  tables: {
    profiles: [],
    invitations: [],
    family_members: [],
    function_usage_daily: [],
    audit_logs: [],
  },
});

const createSuccessResponse = (messageId: string) =>
  new Response(JSON.stringify({ id: messageId }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const buildRequest = (body: JsonRecord, token?: string): Request => {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return new Request("https://example.functions.supabase.co/notify-third-party-added", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
};

describe("notify-third-party-added", () => {
  let handler: (req: Request) => Promise<Response> | Response;

  beforeAll(async () => {
    vi.stubGlobal("Deno", {
      env: {
        get: (key: string) => envValues[key],
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const serverShim = await import("./test-shims/denoHttpServer");
    serverShim.__resetServedHandler();

    await import("../notify-third-party-added/index.ts");
    handler = serverShim.__getServedHandler();
  });

  beforeEach(async () => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(() => Promise.resolve(createSuccessResponse("message-1")));

    const supabaseShim = await import("./test-shims/supabaseEdge");
    supabaseShim.__resetCreateClientImplementation();
  });

  it("rejects a request with no JWT", async () => {
    const state = createState();
    const supabaseShim = await import("./test-shims/supabaseEdge");
    supabaseShim.__setCreateClientImplementation(() => new MockSupabaseClient(state));

    const response = await handler(buildRequest({
      familyId: "11111111-1111-1111-1111-111111111111",
      familyMemberId: THIRD_PARTY_MEMBER_ID,
      thirdPartyName: "Jamie Grandparent",
      thirdPartyEmail: "jamie@example.com",
    }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "Authentication required",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an authenticated user who is not part of the family", async () => {
    const state = createState();
    state.authUsers["valid-owner-token"] = { id: "user-outsider" };
    state.tables.profiles.push({
      id: "profile-outsider",
      user_id: "user-outsider",
      email: "outsider@example.com",
      full_name: "Outsider Parent",
    });
    state.tables.family_members.push({
      id: THIRD_PARTY_MEMBER_ID,
      family_id: FAMILY_ID,
      user_id: "user-third-party",
      profile_id: "profile-third-party",
      primary_parent_id: "profile-parent",
      invited_by: "profile-parent",
      role: "third_party",
      status: "active",
      profiles: {
        id: "profile-third-party",
        email: "jamie@example.com",
        full_name: "Jamie Grandparent",
      },
    });

    const supabaseShim = await import("./test-shims/supabaseEdge");
    supabaseShim.__setCreateClientImplementation(() => new MockSupabaseClient(state));

    const response = await handler(buildRequest({
      familyId: FAMILY_ID,
      familyMemberId: THIRD_PARTY_MEMBER_ID,
      thirdPartyName: "Jamie Grandparent",
      thirdPartyEmail: "jamie@example.com",
    }, "valid-owner-token"));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "You do not have permission to notify this family",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows a valid authenticated family owner", async () => {
    const state = createState();
    state.authUsers["valid-owner-token"] = { id: "user-parent" };
    state.tables.profiles.push({
      id: "profile-parent",
      user_id: "user-parent",
      email: "owner@example.com",
      full_name: "Casey Parent",
    });
    state.tables.family_members.push(
      {
        id: "member-parent",
        family_id: FAMILY_ID,
        user_id: "user-parent",
        profile_id: "profile-parent",
        primary_parent_id: "profile-parent",
        invited_by: null,
        role: "parent",
        status: "active",
      },
      {
        id: THIRD_PARTY_MEMBER_ID,
        family_id: FAMILY_ID,
        user_id: "user-third-party",
        profile_id: "profile-third-party",
        primary_parent_id: "profile-parent",
        invited_by: "profile-parent",
        role: "third_party",
        status: "active",
        profiles: {
          id: "profile-third-party",
          email: "jamie@example.com",
          full_name: "Jamie Grandparent",
        },
      },
      {
        id: "recipient-parent",
        family_id: FAMILY_ID,
        user_id: "user-parent",
        profile_id: "profile-parent",
        primary_parent_id: "profile-parent",
        invited_by: null,
        role: "parent",
        status: "active",
        profiles: {
          id: "profile-parent",
          email: "owner@example.com",
          full_name: "Casey Parent",
        },
      },
    );

    const supabaseShim = await import("./test-shims/supabaseEdge");
    supabaseShim.__setCreateClientImplementation(() => new MockSupabaseClient(state));
    fetchMock.mockImplementation(() => Promise.resolve(createSuccessResponse("message-allowed")));

    const response = await handler(buildRequest({
      familyId: FAMILY_ID,
      familyMemberId: THIRD_PARTY_MEMBER_ID,
      thirdPartyName: "Jamie Grandparent",
      thirdPartyEmail: "jamie@example.com",
    }, "valid-owner-token"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      sent_count: 1,
      failed_count: 0,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(state.tables.audit_logs).toHaveLength(1);
    expect(state.tables.audit_logs[0]).toMatchObject({
      action: "THIRD_PARTY_ADDED_NOTIFICATION_SENT",
      family_id: FAMILY_ID,
    });
  });

  it("rejects rapid repeated requests with rate limiting", async () => {
    const state = createState();
    state.authUsers["valid-owner-token"] = { id: "user-parent" };
    state.tables.profiles.push({
      id: "profile-parent",
      user_id: "user-parent",
      email: "owner@example.com",
      full_name: "Casey Parent",
    });
    state.tables.family_members.push(
      {
        id: "member-parent",
        family_id: FAMILY_ID,
        user_id: "user-parent",
        profile_id: "profile-parent",
        primary_parent_id: "profile-parent",
        invited_by: null,
        role: "parent",
        status: "active",
      },
      {
        id: THIRD_PARTY_MEMBER_ID,
        family_id: FAMILY_ID,
        user_id: "user-third-party",
        profile_id: "profile-third-party",
        primary_parent_id: "profile-parent",
        invited_by: "profile-parent",
        role: "third_party",
        status: "active",
        profiles: {
          id: "profile-third-party",
          email: "jamie@example.com",
          full_name: "Jamie Grandparent",
        },
      },
      {
        id: "recipient-parent",
        family_id: FAMILY_ID,
        user_id: "user-parent",
        profile_id: "profile-parent",
        primary_parent_id: "profile-parent",
        invited_by: null,
        role: "parent",
        status: "active",
        profiles: {
          id: "profile-parent",
          email: "owner@example.com",
          full_name: "Casey Parent",
        },
      },
    );

    const supabaseShim = await import("./test-shims/supabaseEdge");
    supabaseShim.__setCreateClientImplementation(() => new MockSupabaseClient(state));
    fetchMock.mockImplementation(() => Promise.resolve(createSuccessResponse("message-rate-limit")));

    const body = {
      familyId: FAMILY_ID,
      familyMemberId: THIRD_PARTY_MEMBER_ID,
      thirdPartyName: "Jamie Grandparent",
      thirdPartyEmail: "jamie@example.com",
    };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await handler(buildRequest(body, "valid-owner-token"));
      expect(response.status).toBe(200);
    }

    const rateLimitedResponse = await handler(buildRequest(body, "valid-owner-token"));

    expect(rateLimitedResponse.status).toBe(429);
    await expect(rateLimitedResponse.json()).resolves.toMatchObject({
      code: "RATE_LIMIT",
    });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});
