// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { __createStripeSignature, __resetStripeMockState, __setStripeMockState } from "./test-shims/stripeShim";
import { __setCreateClientImplementation } from "./test-shims/supabaseEdge";

type JsonRecord = Record<string, unknown>;

interface TestState {
  tables: Record<string, JsonRecord[]>;
}

class MockQueryBuilder {
  private filters: Array<(row: JsonRecord) => boolean> = [];
  private operation: "select" | "update" = "select";
  private updatePayload: JsonRecord | null = null;

  constructor(
    private readonly getState: () => TestState,
    private readonly tableName: string,
  ) {}

  select(_columns: string): this {
    return this;
  }

  eq(field: string, value: unknown): this {
    this.filters.push((row) => row[field] === value);
    return this;
  }

  update(payload: JsonRecord): this {
    this.operation = "update";
    this.updatePayload = payload;
    return this;
  }

  async maybeSingle(): Promise<{ data: JsonRecord | null; error: null }> {
    const rows = await this.getRows();
    return { data: rows[0] ?? null, error: null };
  }

  async single(): Promise<{ data: JsonRecord | null; error: Error | null }> {
    const rows = await this.getRows();
    if (!rows.length) {
      return { data: null, error: new Error(`No rows found in ${this.tableName}`) };
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
      const state = this.getState();
      const rows = state.tables[this.tableName] ?? [];
      const matched = rows.filter((row) => this.filters.every((filter) => filter(row)));
      for (const row of matched) {
        Object.assign(row, structuredClone(this.updatePayload ?? {}));
      }

      return { data: matched.map((row) => structuredClone(row)), error: null };
    }

    return { data: await this.getRows(), error: null };
  }

  private async getRows(): Promise<JsonRecord[]> {
    const state = this.getState();
    const rows = state.tables[this.tableName] ?? [];
    return rows
      .filter((row) => this.filters.every((filter) => filter(row)))
      .map((row) => structuredClone(row));
  }
}

class MockSupabaseClient {
  constructor(private readonly getState: () => TestState) {}

  from(tableName: string) {
    const getRows = () => {
      const state = this.getState();
      if (!state.tables[tableName]) {
        state.tables[tableName] = [];
      }

      return state.tables[tableName];
    };

    return {
      insert: async (payload: JsonRecord | JsonRecord[]) => {
        const rows = getRows();
        const inserts = Array.isArray(payload) ? payload : [payload];

        if (tableName === "stripe_webhook_events") {
          for (const record of inserts) {
            if (rows.some((row) => row.id === record.id)) {
              return {
                data: null,
                error: { code: "23505", message: "duplicate key value violates unique constraint" },
              };
            }
          }
        }

        inserts.forEach((record) => rows.push(structuredClone(record)));
        return { data: null, error: null };
      },
      select: (columns: string) => new MockQueryBuilder(this.getState, tableName).select(columns),
      update: (payload: JsonRecord) => new MockQueryBuilder(this.getState, tableName).update(payload),
    };
  }
}

const envValues: Record<string, string | undefined> = {
  RESEND_API_KEY: "resend-api-key",
  STRIPE_SECRET_KEY: "stripe-secret-key",
  STRIPE_WEBHOOK_SECRET: "stripe-webhook-secret",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  SUPABASE_URL: "https://example.supabase.co",
};

const fetchMock = vi.fn();

const createState = (): TestState => ({
  tables: {
    audit_logs: [],
    notifications: [],
    profiles: [
      {
        access_grace_until: null,
        email: "billing@example.com",
        full_name: "Billing Parent",
        id: "profile-1",
        stripe_customer_id: null,
        subscription_status: "trial",
        subscription_tier: "power",
        trial_ends_at: "2026-04-08T00:00:00.000Z",
        user_id: "user-1",
      },
    ],
    stripe_webhook_events: [],
  },
});

const buildRequest = (event: JsonRecord): Request => {
  const body = JSON.stringify(event);

  return new Request("https://example.functions.supabase.co/stripe-webhook", {
    body,
    headers: new Headers({
      "Content-Type": "application/json",
      "stripe-signature": __createStripeSignature(body, envValues.STRIPE_WEBHOOK_SECRET!),
    }),
    method: "POST",
  });
};

describe("stripe-webhook", () => {
  let currentState: TestState;
  let handler: (request: Request) => Promise<Response> | Response;

  beforeAll(async () => {
    vi.stubGlobal("Deno", {
      env: {
        get: (key: string) => envValues[key],
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    __setCreateClientImplementation(() => new MockSupabaseClient(() => currentState));

    const serverShim = await import("./test-shims/denoHttpServer");
    serverShim.__resetServedHandler();

    await import("../stripe-webhook/index.ts");
    handler = serverShim.__getServedHandler();
  });

  beforeEach(() => {
    currentState = createState();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "email-1" }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );
    __resetStripeMockState();
  });

  it("marks invoice.payment_failed as past_due, preserves access, and writes an audit log", async () => {
    const event = {
      data: {
        object: {
          amount_due: 500,
          customer: "cus_123",
          customer_email: "billing@example.com",
          id: "in_123",
        },
      },
      id: "evt_payment_failed",
      type: "invoice.payment_failed",
    };

    const response = await handler(buildRequest(event));

    expect(response.status).toBe(200);
    expect(currentState.tables.profiles[0]).toMatchObject({
      subscription_status: "past_due",
      subscription_tier: "power",
    });
    expect(currentState.tables.profiles[0].access_grace_until).toBeTruthy();
    expect(currentState.tables.audit_logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "SUBSCRIPTION_PAYMENT_FAILED",
          entity_type: "subscription",
        }),
      ]),
    );
  });

  it("treats invoice.payment_action_required the same as payment_failed without double revoking access", async () => {
    const event = {
      data: {
        object: {
          amount_due: 500,
          customer: "cus_123",
          customer_email: "billing@example.com",
          id: "in_124",
        },
      },
      id: "evt_payment_action_required",
      type: "invoice.payment_action_required",
    };

    const response = await handler(buildRequest(event));

    expect(response.status).toBe(200);
    expect(currentState.tables.profiles[0]).toMatchObject({
      subscription_status: "past_due",
      subscription_tier: "power",
    });
    expect(currentState.tables.audit_logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "SUBSCRIPTION_PAYMENT_FAILED",
          metadata: expect.objectContaining({
            event_type: "invoice.payment_action_required",
          }),
        }),
      ]),
    );
  });

  it("updates subscription status transitions atomically from trial to active", async () => {
    __setStripeMockState({
      customersRetrieve: async () => ({ deleted: false, email: "billing@example.com", id: "cus_123" }),
    });

    const event = {
      data: {
        object: {
          customer: "cus_123",
          id: "sub_trial_to_active",
          items: { data: [{ price: { product: "prod_TwwA5VNxPgt62D" } }] },
          status: "active",
          trial_end: null,
        },
      },
      id: "evt_sub_updated_active",
      type: "customer.subscription.updated",
    };

    const response = await handler(buildRequest(event));

    expect(response.status).toBe(200);
    expect(currentState.tables.profiles[0]).toMatchObject({
      access_grace_until: null,
      subscription_status: "active",
      subscription_tier: "power",
      trial_ends_at: null,
    });
    expect(currentState.tables.audit_logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "SUBSCRIPTION_STATUS_UPDATED",
          metadata: expect.objectContaining({
            subscription_status: "active",
          }),
        }),
      ]),
    );
  });

  it("links checkout completion to stripe_customer_id using the session user metadata", async () => {
    const event = {
      data: {
        object: {
          customer: "cus_checkout",
          customer_details: { email: "billing@example.com" },
          id: "cs_test_123",
          metadata: { user_id: "user-1" },
          subscription: "sub_checkout",
        },
      },
      id: "evt_checkout_completed",
      type: "checkout.session.completed",
    };

    __setStripeMockState({
      subscriptionsRetrieve: async () => ({
        id: "sub_checkout",
        items: { data: [{ price: { product: "prod_TwwA5VNxPgt62D" } }] },
      }),
    });

    const response = await handler(buildRequest(event));

    expect(response.status).toBe(200);
    expect(currentState.tables.profiles[0]).toMatchObject({
      stripe_customer_id: "cus_checkout",
      subscription_status: "active",
      subscription_tier: "power",
    });
    expect(currentState.tables.audit_logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "SUBSCRIPTION_CHECKOUT_COMPLETED",
          metadata: expect.objectContaining({
            stripe_customer_id: "cus_checkout",
          }),
        }),
      ]),
    );
  });

  it("updates subscription to past_due from customer.subscription.updated and preserves grace metadata", async () => {
    currentState.tables.profiles[0].subscription_status = "active";
    currentState.tables.profiles[0].trial_ends_at = null;

    __setStripeMockState({
      customersRetrieve: async () => ({ deleted: false, email: "billing@example.com", id: "cus_123" }),
    });

    const event = {
      data: {
        object: {
          customer: "cus_123",
          id: "sub_active_to_past_due",
          items: { data: [{ price: { product: "prod_TwwA5VNxPgt62D" } }] },
          status: "past_due",
          trial_end: null,
        },
      },
      id: "evt_sub_updated_past_due",
      type: "customer.subscription.updated",
    };

    const response = await handler(buildRequest(event));

    expect(response.status).toBe(200);
    expect(currentState.tables.profiles[0]).toMatchObject({
      subscription_status: "past_due",
      subscription_tier: "power",
    });
    expect(currentState.tables.profiles[0].access_grace_until).toBeTruthy();
  });

  it("downgrades customer.subscription.deleted to free/canceled and clears trial end for canceled trials", async () => {
    __setStripeMockState({
      customersRetrieve: async () => ({ deleted: false, email: "billing@example.com", id: "cus_123" }),
    });

    const event = {
      data: {
        object: {
          customer: "cus_123",
          id: "sub_deleted",
          items: { data: [{ price: { product: "prod_TwwA5VNxPgt62D" } }] },
          status: "canceled",
        },
      },
      id: "evt_sub_deleted",
      type: "customer.subscription.deleted",
    };

    const response = await handler(buildRequest(event));

    expect(response.status).toBe(200);
    expect(currentState.tables.profiles[0]).toMatchObject({
      access_grace_until: null,
      subscription_status: "canceled",
      subscription_tier: "free",
      trial_ends_at: null,
    });
    expect(currentState.tables.audit_logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "SUBSCRIPTION_CANCELED",
        }),
      ]),
    );
  });

  it("creates a trial-ending notification and audit log for customer.subscription.trial_will_end", async () => {
    __setStripeMockState({
      customersRetrieve: async () => ({ deleted: false, email: "billing@example.com", id: "cus_123" }),
    });

    const event = {
      data: {
        object: {
          customer: "cus_123",
          id: "sub_trial_notice",
          trial_end: Math.floor(new Date("2026-04-03T00:00:00.000Z").getTime() / 1000),
        },
      },
      id: "evt_trial_will_end",
      type: "customer.subscription.trial_will_end",
    };

    const response = await handler(buildRequest(event));

    expect(response.status).toBe(200);
    expect(currentState.tables.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Trial ending soon",
          type: "trial_ending",
          user_id: "profile-1",
        }),
      ]),
    );
    expect(currentState.tables.audit_logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "SUBSCRIPTION_TRIAL_ENDING_NOTICE",
        }),
      ]),
    );
  });

  it("skips duplicate Stripe event ids without double-writing profile or audit rows", async () => {
    const event = {
      data: {
        object: {
          amount_due: 500,
          customer: "cus_123",
          customer_email: "billing@example.com",
          id: "in_duplicate",
        },
      },
      id: "evt_duplicate",
      type: "invoice.payment_failed",
    };

    const firstResponse = await handler(buildRequest(event));
    const auditCountAfterFirst = currentState.tables.audit_logs.length;
    const processedCountAfterFirst = currentState.tables.stripe_webhook_events.length;
    const secondResponse = await handler(buildRequest(event));

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(currentState.tables.audit_logs).toHaveLength(auditCountAfterFirst);
    expect(currentState.tables.stripe_webhook_events).toHaveLength(processedCountAfterFirst);
  });
});
