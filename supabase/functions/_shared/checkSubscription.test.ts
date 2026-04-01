// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetCreateClientImplementation, __setCreateClientImplementation } from "./test-shims/supabaseEdge";
import { __resetStripeMockState, __setStripeMockState } from "./test-shims/stripeShim";

type JsonRecord = Record<string, unknown>;

interface TestState {
  authUsers: Record<string, { email?: string | null; id: string } | null>;
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
    return this;
  }

  eq(field: string, value: unknown): this {
    this.filters.push((row) => row[field] === value);
    return this;
  }

  lt(field: string, value: unknown): this {
    this.filters.push((row) => String(row[field] ?? "") < String(value ?? ""));
    return this;
  }

  update(payload: JsonRecord): this {
    this.operation = "update";
    this.updatePayload = payload;
    return this;
  }

  async maybeSingle(): Promise<{ data: JsonRecord | null; error: null }> {
    const rows = this.executeRows();
    return { data: rows[0] ?? null, error: null };
  }

  async single(): Promise<{ data: JsonRecord | null; error: Error | null }> {
    const rows = this.executeRows();
    if (!rows.length) {
      return { data: null, error: new Error(`No rows found in ${this.tableName}`) };
    }

    return { data: rows[0], error: null };
  }

  then<TResult1 = { data: JsonRecord[] | null; error: Error | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: JsonRecord[] | null; error: Error | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve({ data: this.executeRows(), error: null }).then(onfulfilled, onrejected);
  }

  private executeRows(): JsonRecord[] {
    const rows = this.state.tables[this.tableName] ?? [];
    const matched = rows.filter((row) => this.filters.every((filter) => filter(row)));

    if (this.operation === "update") {
      for (const row of matched) {
        Object.assign(row, structuredClone(this.updatePayload ?? {}));
      }
    }

    return matched.map((row) => structuredClone(row));
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
    const ensureTable = () => {
      if (!this.state.tables[tableName]) {
        this.state.tables[tableName] = [];
      }

      return this.state.tables[tableName];
    };

    return {
      insert: async (payload: JsonRecord | JsonRecord[]) => {
        const rows = ensureTable();
        const inserts = Array.isArray(payload) ? payload : [payload];
        inserts.forEach((record) => rows.push(structuredClone(record)));
        return { data: null, error: null };
      },
      select: (columns: string) => new MockQueryBuilder(this.state, tableName).select(columns),
      update: (payload: JsonRecord) => new MockQueryBuilder(this.state, tableName).update(payload),
    };
  }
}

const envValues: Record<string, string | undefined> = {
  STRIPE_SECRET_KEY: "stripe-secret-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  SUPABASE_URL: "https://example.supabase.co",
};

const buildState = (): TestState => ({
  authUsers: {
    "valid-token": { email: "billing@example.com", id: "user-1" },
  },
  tables: {
    audit_logs: [],
    profiles: [
      {
        access_grace_until: null,
        access_reason: null,
        email: "billing@example.com",
        free_premium_access: false,
        id: "profile-1",
        stripe_customer_id: null,
        subscription_status: "trial",
        subscription_tier: "power",
        trial_ends_at: "2026-03-20T12:00:00.000Z",
        trial_started_at: "2026-03-13T12:00:00.000Z",
        user_id: "user-1",
      },
    ],
  },
});

const buildRequest = () =>
  new Request("https://example.functions.supabase.co/check-subscription", {
    headers: {
      Authorization: "Bearer valid-token",
    },
    method: "POST",
  });

describe("check-subscription", () => {
  let state: TestState;
  let handler: (req: Request) => Promise<Response> | Response;

  beforeAll(async () => {
    vi.stubGlobal("Deno", {
      env: {
        get: (key: string) => envValues[key],
      },
    });

    const serverShim = await import("./test-shims/denoHttpServer");
    serverShim.__resetServedHandler();

    await import("../check-subscription/index.ts");
    handler = serverShim.__getServedHandler();
  });

  beforeEach(() => {
    state = buildState();
    __resetCreateClientImplementation();
    __setCreateClientImplementation(() => new MockSupabaseClient(state));
    __resetStripeMockState();
    __setStripeMockState({
      customersList: async () => ({ data: [] }),
      subscriptionsList: async () => ({ data: [] }),
    });
  });

  it("auto-downgrades expired trials atomically and writes an audit log", async () => {
    const response = await handler(buildRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      subscribed: false,
      tier: "free",
      trial: false,
    });
    expect(state.tables.profiles[0]).toMatchObject({
      subscription_status: "expired",
      subscription_tier: "free",
    });
    expect(state.tables.audit_logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "TRIAL_EXPIRED_AUTO_DOWNGRADE",
          entity_id: "profile-1",
        }),
      ]),
    );
  });

  it("leaves active trials alone when the trial has not expired", async () => {
    state.tables.profiles[0].trial_ends_at = "2026-04-04T12:00:00.000Z";

    const response = await handler(buildRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      subscribed: true,
      tier: "power",
      trial: true,
      trial_ends_at: "2026-04-04T12:00:00.000Z",
    });
    expect(state.tables.profiles[0]).toMatchObject({
      subscription_status: "trial",
      subscription_tier: "power",
    });
    expect(state.tables.audit_logs).toHaveLength(0);
  });

  it("uses the durable stripe_customer_id link instead of resolving by email", async () => {
    const customersList = vi.fn(async () => ({ data: [] }));

    state.tables.profiles[0].access_grace_until = "2026-04-01T12:00:00.000Z";
    state.tables.profiles[0].stripe_customer_id = "cus_linked";
    state.tables.profiles[0].subscription_status = "past_due";
    state.tables.profiles[0].trial_ends_at = null;

    __setStripeMockState({
      customersList,
      subscriptionsList: async (args) => {
        expect(args).toMatchObject({
          customer: "cus_linked",
          status: "all",
        });

        return {
          data: [
            {
              created: 1,
              current_period_end: 1_775_603_200,
              id: "sub_active",
              items: { data: [{ price: { product: "prod_TwwA5VNxPgt62D" } }] },
              metadata: { user_id: "user-1" },
              status: "active",
              trial_end: null,
            },
          ],
        };
      },
    });

    const response = await handler(buildRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(customersList).not.toHaveBeenCalled();
    expect(payload).toMatchObject({
      is_grace_period: false,
      past_due: false,
      subscribed: true,
      subscription_status: "active",
      tier: "power",
    });
    expect(state.tables.profiles[0]).toMatchObject({
      access_grace_until: null,
      stripe_customer_id: "cus_linked",
      subscription_status: "active",
      subscription_tier: "power",
    });
    expect(state.tables.audit_logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "SUBSCRIPTION_CHECK_SYNC_STATE_CHANGED",
          metadata: expect.objectContaining({
            previous_status: "past_due",
            next_status: "active",
            stripe_customer_id: "cus_linked",
          }),
        }),
      ]),
    );
  });

  it("skips Stripe sync when no authoritative customer link can be proven", async () => {
    state.tables.profiles[0].subscription_status = "active";
    state.tables.profiles[0].subscription_tier = "power";
    state.tables.profiles[0].trial_ends_at = null;

    __setStripeMockState({
      customersList: async () => ({
        data: [
          {
            id: "cus_email_only",
            metadata: {},
          },
        ],
      }),
      subscriptionsList: async () => ({
        data: [
          {
            created: 1,
            current_period_end: 1_775_603_200,
            id: "sub_other_user",
            items: { data: [{ price: { product: "prod_TwwA5VNxPgt62D" } }] },
            metadata: { user_id: "someone-else" },
            status: "active",
            trial_end: null,
          },
        ],
      }),
    });

    const response = await handler(buildRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      subscribed: true,
      subscription_status: "active",
      tier: "power",
    });
    expect(state.tables.profiles[0]).toMatchObject({
      stripe_customer_id: null,
      subscription_status: "active",
      subscription_tier: "power",
    });
    expect(state.tables.audit_logs).toHaveLength(0);
  });

  it("selects the strongest entitlement-bearing subscription over newer canceled records", async () => {
    state.tables.profiles[0].stripe_customer_id = "cus_linked";
    state.tables.profiles[0].subscription_status = "canceled";
    state.tables.profiles[0].subscription_tier = "free";
    state.tables.profiles[0].trial_ends_at = null;

    __setStripeMockState({
      subscriptionsList: async () => ({
        data: [
          {
            created: 200,
            current_period_end: 1_775_603_200,
            id: "sub_canceled_newer",
            items: { data: [{ price: { product: "prod_TwwA5VNxPgt62D" } }] },
            metadata: { user_id: "user-1" },
            status: "canceled",
            trial_end: null,
          },
          {
            created: 100,
            current_period_end: 1_775_689_600,
            id: "sub_active_older",
            items: { data: [{ price: { product: "prod_TwwA5VNxPgt62D" } }] },
            metadata: { user_id: "user-1" },
            status: "active",
            trial_end: null,
          },
        ],
      }),
    });

    const response = await handler(buildRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      subscribed: true,
      subscription_status: "active",
      tier: "power",
    });
    expect(state.tables.profiles[0]).toMatchObject({
      subscription_status: "active",
      subscription_tier: "power",
    });
  });

  it("backfills stripe_customer_id from subscription metadata and clamps malformed grace periods", async () => {
    state.tables.profiles[0].access_grace_until = "2027-01-01T00:00:00.000Z";
    state.tables.profiles[0].subscription_status = "past_due";
    state.tables.profiles[0].subscription_tier = "power";
    state.tables.profiles[0].trial_ends_at = null;

    __setStripeMockState({
      customersList: async () => ({
        data: [
          {
            id: "cus_metadata_backfill",
            metadata: {},
          },
        ],
      }),
      subscriptionsList: async (args) => {
        if ((args as { customer?: string }).customer === "cus_metadata_backfill") {
          return {
            data: [
              {
                created: 100,
                current_period_end: 1_775_603_200,
                id: "sub_metadata_backfill",
                items: { data: [{ price: { product: "prod_TwwA5VNxPgt62D" } }] },
                metadata: { user_id: "user-1" },
                status: "past_due",
                trial_end: null,
              },
            ],
          };
        }

        return { data: [] };
      },
    });

    const response = await handler(buildRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.subscription_status).toBe("past_due");
    expect(state.tables.profiles[0].stripe_customer_id).toBe("cus_metadata_backfill");
    expect(new Date(String(state.tables.profiles[0].access_grace_until)).getTime()).toBeLessThan(
      new Date("2027-01-01T00:00:00.000Z").getTime(),
    );
    expect(state.tables.audit_logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "SUBSCRIPTION_CUSTOMER_LINKED",
        }),
        expect.objectContaining({
          action: "SUBSCRIPTION_CHECK_SYNC_STATE_CHANGED",
          metadata: expect.objectContaining({
            stripe_status: "past_due",
          }),
        }),
      ]),
    );
  });
});
