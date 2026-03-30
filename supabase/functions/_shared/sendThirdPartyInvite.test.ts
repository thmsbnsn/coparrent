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

  maybeSingle(): Promise<{ data: JsonRecord | null; error: null }> {
    const rows = this.getRows();
    return Promise.resolve({ data: rows[0] ?? null, error: null });
  }

  single(): Promise<{ data: JsonRecord | null; error: Error | null }> {
    const rows = this.getRows();
    if (rows.length === 0) {
      return Promise.resolve({
        data: null,
        error: new Error(`No rows found for ${this.tableName}`),
      });
    }

    return Promise.resolve({ data: rows[0], error: null });
  }

  update(payload: JsonRecord): this {
    this.operation = "update";
    this.updatePayload = payload;
    return this;
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

const INVITE_TOKEN = "33333333-3333-3333-3333-333333333333";
const envValues: Record<string, string | undefined> = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  RESEND_API_KEY: "resend-api-key",
};

const fetchMock = vi.fn();

const createState = (): TestState => ({
  authUsers: {},
  tables: {
    profiles: [],
    invitations: [],
    function_usage_daily: [],
  },
});

const createSuccessResponse = (messageId: string) =>
  new Response(JSON.stringify({ id: messageId }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const buildRequest = (token: string, authToken?: string): Request => {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  return new Request("https://example.functions.supabase.co/send-third-party-invite", {
    method: "POST",
    headers,
    body: JSON.stringify({
      inviteeEmail: "invitee@example.com",
      inviterName: "Casey Parent",
      token,
    }),
  });
};

describe("send-third-party-invite", () => {
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

    await import("../send-third-party-invite/index.ts");
    handler = serverShim.__getServedHandler();
  });

  beforeEach(async () => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(() => Promise.resolve(createSuccessResponse("message-1")));

    const supabaseShim = await import("./test-shims/supabaseEdge");
    supabaseShim.__resetCreateClientImplementation();
  });

  it("blocks a non-owner from resending a third-party invite", async () => {
    const state = createState();
    state.authUsers["outsider-token"] = { id: "user-outsider" };
    state.tables.profiles.push({
      id: "profile-outsider",
      user_id: "user-outsider",
    });
    state.tables.invitations.push({
      id: "invite-1",
      token: INVITE_TOKEN,
      inviter_id: "profile-owner",
      status: "pending",
      invitation_type: "third_party",
    });

    const supabaseShim = await import("./test-shims/supabaseEdge");
    supabaseShim.__setCreateClientImplementation(() => new MockSupabaseClient(state));

    const response = await handler(buildRequest(INVITE_TOKEN, "outsider-token"));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "Invitation not found or you are not authorized",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows the owner to resend a third-party invite", async () => {
    const state = createState();
    state.authUsers["owner-token"] = { id: "user-owner" };
    state.tables.profiles.push({
      id: "profile-owner",
      user_id: "user-owner",
    });
    state.tables.invitations.push({
      id: "invite-1",
      token: INVITE_TOKEN,
      inviter_id: "profile-owner",
      status: "pending",
      invitation_type: "third_party",
    });

    const supabaseShim = await import("./test-shims/supabaseEdge");
    supabaseShim.__setCreateClientImplementation(() => new MockSupabaseClient(state));
    fetchMock.mockImplementation(() => Promise.resolve(createSuccessResponse("message-owner")));

    const response = await handler(buildRequest(INVITE_TOKEN, "owner-token"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fails cleanly for an invalid invite token", async () => {
    const state = createState();
    state.authUsers["owner-token"] = { id: "user-owner" };
    state.tables.profiles.push({
      id: "profile-owner",
      user_id: "user-owner",
    });

    const supabaseShim = await import("./test-shims/supabaseEdge");
    supabaseShim.__setCreateClientImplementation(() => new MockSupabaseClient(state));

    const response = await handler(buildRequest(INVITE_TOKEN, "owner-token"));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "Invitation not found or you are not authorized",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
