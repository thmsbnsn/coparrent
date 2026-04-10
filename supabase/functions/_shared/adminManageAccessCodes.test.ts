// @vitest-environment node
import { webcrypto } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetCreateClientImplementation, __setCreateClientImplementation } from "./test-shims/supabaseEdge";

type JsonRecord = Record<string, unknown>;

interface TestState {
  authUsers: Record<string, { id: string } | null>;
  nextCodeId: number;
  nextTimestampOffset: number;
  tables: Record<string, JsonRecord[]>;
}

class MockQueryBuilder {
  private readonly filters: Array<(row: JsonRecord) => boolean> = [];
  private limitCount: number | null = null;
  private orderBy: { ascending: boolean; field: string } | null = null;

  constructor(
    private readonly state: TestState,
    private readonly tableName: string,
  ) {}

  select(_columns: string): this {
    return this;
  }

  eq(field: string, value: unknown): this {
    this.filters.push((row) => row[field] === value);
    return this;
  }

  limit(value: number): this {
    this.limitCount = value;
    return this;
  }

  order(field: string, options?: { ascending?: boolean }): this {
    this.orderBy = {
      ascending: options?.ascending ?? true,
      field,
    };
    return this;
  }

  async maybeSingle(): Promise<{ data: JsonRecord | null; error: null }> {
    const rows = this.execute();
    return { data: rows[0] ?? null, error: null };
  }

  then<TResult1 = { data: JsonRecord[] | null; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: JsonRecord[] | null; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve({ data: this.execute(), error: null }).then(onfulfilled, onrejected);
  }

  private execute(): JsonRecord[] {
    let rows = (this.state.tables[this.tableName] ?? []).filter((row) => this.filters.every((filter) => filter(row)));

    if (this.orderBy) {
      const { ascending, field } = this.orderBy;
      rows = [...rows].sort((left, right) => {
        const leftValue = String(left[field] ?? "");
        const rightValue = String(right[field] ?? "");
        const compare = leftValue.localeCompare(rightValue);
        return ascending ? compare : compare * -1;
      });
    }

    if (this.limitCount !== null) {
      rows = rows.slice(0, this.limitCount);
    }

    return rows.map((row) => structuredClone(row));
  }
}

class MockMutationBuilder {
  private readonly filters: Array<(row: JsonRecord) => boolean> = [];

  constructor(
    private readonly state: TestState,
    private readonly tableName: string,
    private readonly operation: "insert" | "update",
    private readonly payload: JsonRecord | JsonRecord[],
  ) {}

  eq(field: string, value: unknown): this {
    this.filters.push((row) => row[field] === value);
    return this;
  }

  async select(_columns: string): Promise<{ data: JsonRecord[] | null; error: { code?: string; message: string } | null }> {
    if (this.operation === "insert") {
      return this.executeInsert();
    }

    return this.executeUpdate();
  }

  private executeInsert() {
    const table = this.state.tables[this.tableName] ?? [];
    const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
    const inserted: JsonRecord[] = [];

    for (const row of rows) {
      if (table.some((existingRow) => existingRow.code_hash === row.code_hash)) {
        return {
          data: null,
          error: {
            code: "23505",
            message: "duplicate key value violates unique constraint",
          },
        };
      }

      const timestamp = new Date(Date.UTC(2026, 3, 9, 12, 0, this.state.nextTimestampOffset)).toISOString();
      this.state.nextTimestampOffset += 1;

      const insertedRow = {
        created_at: timestamp,
        id: `code-${this.state.nextCodeId}`,
        updated_at: timestamp,
        ...structuredClone(row),
      };

      this.state.nextCodeId += 1;
      table.push(insertedRow);
      inserted.push(structuredClone(insertedRow));
    }

    this.state.tables[this.tableName] = table;
    return { data: inserted, error: null };
  }

  private executeUpdate() {
    const table = this.state.tables[this.tableName] ?? [];
    const matchedRows = table.filter((row) => this.filters.every((filter) => filter(row)));
    const updatedRows = matchedRows.map((row) => {
      const timestamp = new Date(Date.UTC(2026, 3, 9, 12, 0, this.state.nextTimestampOffset)).toISOString();
      this.state.nextTimestampOffset += 1;
      Object.assign(row, structuredClone(this.payload), { updated_at: timestamp });
      return structuredClone(row);
    });

    return { data: updatedRows, error: null };
  }
}

class MockSupabaseClient {
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
    if (!this.state.tables[tableName]) {
      this.state.tables[tableName] = [];
    }

    return {
      insert: (payload: JsonRecord | JsonRecord[]) =>
        new MockMutationBuilder(this.state, tableName, "insert", payload),
      select: (columns: string) => new MockQueryBuilder(this.state, tableName).select(columns),
      update: (payload: JsonRecord) => new MockMutationBuilder(this.state, tableName, "update", payload),
    };
  }
}

const envValues: Record<string, string | undefined> = {
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  SUPABASE_URL: "https://example.supabase.co",
};

const buildState = (): TestState => ({
  authUsers: {
    "admin-token": { id: "admin-user" },
    "non-admin-token": { id: "staff-user" },
  },
  nextCodeId: 1,
  nextTimestampOffset: 0,
  tables: {
    access_pass_codes: [],
    user_roles: [
      {
        role: "admin",
        user_id: "admin-user",
      },
    ],
  },
});

const buildRequest = (action: string, body: Record<string, unknown>, token = "admin-token") =>
  new Request(`https://example.functions.supabase.co/admin-manage-access-codes?action=${action}`, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

const buildAccessCodeRow = (overrides: Partial<JsonRecord> = {}): JsonRecord => ({
  access_reason: "phase_1_access",
  active: true,
  audience_tag: "custom",
  code_hash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  code_preview: "CPR-ABCD...7890",
  created_at: "2026-04-09T12:00:00.000Z",
  created_by: "admin-user",
  expires_at: "2099-04-09T12:00:00.000Z",
  grant_tier: "power",
  id: "seed-code",
  label: "Pilot Cohort",
  max_redemptions: 1,
  redeemed_count: 0,
  updated_at: "2026-04-09T12:00:00.000Z",
  ...overrides,
});

describe("admin-manage-access-codes", () => {
  let handler: (req: Request) => Promise<Response> | Response;
  let state: TestState;

  beforeAll(async () => {
    vi.stubGlobal("crypto", webcrypto);
    vi.stubGlobal("Deno", {
      env: {
        get: (key: string) => envValues[key],
      },
    });

    const serverShim = await import("./test-shims/denoHttpServer");
    serverShim.__resetServedHandler();

    await import("../admin-manage-access-codes/index.ts");
    handler = serverShim.__getServedHandler();
  });

  beforeEach(() => {
    state = buildState();
    __resetCreateClientImplementation();
    __setCreateClientImplementation(() => new MockSupabaseClient(state));
  });

  it("blocks issuance for authenticated users who are not admins", async () => {
    const response = await handler(
      buildRequest("issue", {
        access_reason: "phase_1_access",
        audience_tag: "custom",
        expires_at: "2099-04-09T12:00:00.000Z",
        label: "Pilot Cohort",
        max_redemptions: 1,
        quantity: 1,
      }, "non-admin-token"),
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toMatchObject({ error: "Access denied" });
    expect(state.tables.access_pass_codes).toHaveLength(0);
  });

  it("blocks inventory listing for authenticated users who are not admins", async () => {
    state.tables.access_pass_codes = [buildAccessCodeRow()];

    const response = await handler(buildRequest("list", { limit: 100 }, "non-admin-token"));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toMatchObject({ error: "Access denied" });
  });

  it("issues complimentary access codes server-side and stores only hashed secrets", async () => {
    const response = await handler(
      buildRequest("issue", {
        access_reason: "phase_1_access",
        audience_tag: "partner",
        expires_at: "2099-04-09T12:00:00.000Z",
        label: "Pilot Cohort",
        max_redemptions: 3,
        quantity: 2,
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.quantity).toBe(2);
    expect(payload.issued_codes).toHaveLength(2);

    const rawCodes = payload.issued_codes.map((issuedCode: { code: string }) => issuedCode.code);
    expect(new Set(rawCodes).size).toBe(2);

    for (const issuedCode of payload.issued_codes as Array<Record<string, unknown>>) {
      expect(String(issuedCode.code)).toMatch(/^CPR(?:-[A-Z2-9]{4}){4}$/);
      expect(issuedCode).toMatchObject({
        access_reason: "phase_1_access",
        audience_tag: "partner",
        grant_tier: "power",
        label: "Pilot Cohort",
        max_redemptions: 3,
      });
      expect(issuedCode).not.toHaveProperty("code_hash");
    }

    expect(state.tables.access_pass_codes).toHaveLength(2);

    for (const storedCode of state.tables.access_pass_codes) {
      expect(storedCode).toMatchObject({
        access_reason: "phase_1_access",
        audience_tag: "partner",
        grant_tier: "power",
        label: "Pilot Cohort",
        max_redemptions: 3,
      });
      expect(String(storedCode.code_hash)).toMatch(/^[a-f0-9]{64}$/);
      expect(storedCode).not.toHaveProperty("code");
    }
  });

  it("lists code inventory with derived operational status and without raw secrets", async () => {
    state.tables.access_pass_codes = [
      buildAccessCodeRow({
        code_hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        code_preview: "CPR-ACT1...0001",
        created_at: "2026-04-09T12:00:03.000Z",
        id: "active-code",
      }),
      buildAccessCodeRow({
        active: false,
        code_hash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        code_preview: "CPR-INAC...0002",
        created_at: "2026-04-09T12:00:02.000Z",
        id: "inactive-code",
      }),
      buildAccessCodeRow({
        code_hash: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        code_preview: "CPR-EXPI...0003",
        created_at: "2026-04-09T12:00:01.000Z",
        expires_at: "2020-04-09T12:00:00.000Z",
        id: "expired-code",
      }),
      buildAccessCodeRow({
        code_hash: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        code_preview: "CPR-FULL...0004",
        created_at: "2026-04-09T12:00:00.000Z",
        id: "exhausted-code",
        max_redemptions: 2,
        redeemed_count: 2,
      }),
    ];

    const response = await handler(buildRequest("list", { limit: 100 }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.codes).toHaveLength(4);
    expect(payload.codes.map((code: { id: string }) => code.id)).toEqual([
      "active-code",
      "inactive-code",
      "expired-code",
      "exhausted-code",
    ]);
    expect(payload.codes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "active-code", remaining_redemptions: 1, status: "active" }),
        expect.objectContaining({ id: "inactive-code", remaining_redemptions: 1, status: "inactive" }),
        expect.objectContaining({ id: "expired-code", remaining_redemptions: 1, status: "expired" }),
        expect.objectContaining({ id: "exhausted-code", remaining_redemptions: 0, status: "exhausted" }),
      ]),
    );

    for (const listedCode of payload.codes as Array<Record<string, unknown>>) {
      expect(listedCode).not.toHaveProperty("code");
      expect(listedCode).not.toHaveProperty("code_hash");
    }
  });

  it("deactivates an issued code without deleting prior audit metadata", async () => {
    state.tables.access_pass_codes = [
      buildAccessCodeRow({
        code_hash: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        id: "11111111-1111-1111-1111-111111111111",
      }),
    ];

    const response = await handler(buildRequest("deactivate", { code_id: "11111111-1111-1111-1111-111111111111" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.code).toMatchObject({
      active: false,
      id: "11111111-1111-1111-1111-111111111111",
      status: "inactive",
    });
    expect(state.tables.access_pass_codes[0]).toMatchObject({
      active: false,
      id: "11111111-1111-1111-1111-111111111111",
    });
  });
});
