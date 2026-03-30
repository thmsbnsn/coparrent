import { beforeEach, describe, expect, it } from "vitest";
import { aiGuard } from "./aiGuard.ts";
import {
  __resetCreateClientImplementation,
  __setCreateClientImplementation,
} from "./test-shims/supabaseEdge";

type JsonRecord = Record<string, unknown>;

interface TestState {
  authUsers: Record<string, { id: string } | null>;
  tables: Record<string, JsonRecord[]>;
}

class MockQueryBuilder {
  private filters: Array<(row: JsonRecord) => boolean> = [];

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

  maybeSingle(): Promise<{ data: JsonRecord | null; error: null }> {
    const rows = this.getRows();
    return Promise.resolve({ data: rows[0] ?? null, error: null });
  }

  then<TResult1 = { data: JsonRecord[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: JsonRecord[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve({ data: this.getRows(), error: null }).then(onfulfilled, onrejected);
  }

  private getRows(): JsonRecord[] {
    const rows = this.state.tables[this.tableName] ?? [];
    return rows
      .filter((row) => this.filters.every((filter) => filter(row)))
      .map((row) => structuredClone(row));
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
    return {
      select: (columns: string) => new MockQueryBuilder(this.state, tableName).select(columns),
    };
  }
}

const SUPABASE_URL = "https://example.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
const FAMILY_ID = "family-1";
const SECOND_FAMILY_ID = "family-2";

const createState = (): TestState => ({
  authUsers: {},
  tables: {
    family_members: [],
    profiles: [],
    user_roles: [],
  },
});

const addPremiumProfile = (state: TestState, options: { userId: string; profileId: string }) => {
  state.tables.profiles.push({
    id: options.profileId,
    user_id: options.userId,
    free_premium_access: false,
    subscription_status: "active",
    subscription_tier: "power",
    trial_ends_at: null,
  });
};

const buildRequest = (token: string) =>
  new Request("https://example.functions.supabase.co/ai", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

describe("aiGuard family scope enforcement", () => {
  beforeEach(() => {
    __resetCreateClientImplementation();
  });

  it("allows a single-family user with the correct family scope", async () => {
    const state = createState();
    state.authUsers["parent-token"] = { id: "user-parent" };
    addPremiumProfile(state, { userId: "user-parent", profileId: "profile-parent" });
    state.tables.family_members.push({
      family_id: FAMILY_ID,
      role: "parent",
      status: "active",
      user_id: "user-parent",
    });

    __setCreateClientImplementation(() => new MockSupabaseClient(state));

    const result = await aiGuard(
      buildRequest("parent-token"),
      "analyze",
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      { familyId: FAMILY_ID },
    );

    expect(result.allowed).toBe(true);
    expect(result.userContext).toMatchObject({
      userId: "user-parent",
      profileId: "profile-parent",
      familyId: FAMILY_ID,
      role: "parent",
      isParent: true,
      planTier: "power",
      hasPremiumAccess: true,
    });
  });

  it("allows a multi-family user only when explicit family scope is provided", async () => {
    const state = createState();
    state.authUsers["guardian-token"] = { id: "user-guardian" };
    addPremiumProfile(state, { userId: "user-guardian", profileId: "profile-guardian" });
    state.tables.family_members.push(
      {
        family_id: FAMILY_ID,
        role: "parent",
        status: "active",
        user_id: "user-guardian",
      },
      {
        family_id: SECOND_FAMILY_ID,
        role: "guardian",
        status: "active",
        user_id: "user-guardian",
      },
    );

    __setCreateClientImplementation(() => new MockSupabaseClient(state));

    const result = await aiGuard(
      buildRequest("guardian-token"),
      "draft",
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      { familyId: SECOND_FAMILY_ID },
    );

    expect(result.allowed).toBe(true);
    expect(result.userContext).toMatchObject({
      familyId: SECOND_FAMILY_ID,
      role: "guardian",
      isParent: true,
    });
  });

  it("rejects ambiguous membership resolution when family scope is omitted", async () => {
    const state = createState();
    state.authUsers["multi-token"] = { id: "user-multi" };
    addPremiumProfile(state, { userId: "user-multi", profileId: "profile-multi" });
    state.tables.family_members.push(
      {
        family_id: FAMILY_ID,
        role: "parent",
        status: "active",
        user_id: "user-multi",
      },
      {
        family_id: SECOND_FAMILY_ID,
        role: "guardian",
        status: "active",
        user_id: "user-multi",
      },
    );

    __setCreateClientImplementation(() => new MockSupabaseClient(state));

    const result = await aiGuard(
      buildRequest("multi-token"),
      "quick-check",
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
    );

    expect(result.allowed).toBe(false);
    expect(result.statusCode).toBe(400);
    expect(result.error).toMatchObject({
      code: "AMBIGUOUS_FAMILY_SCOPE",
    });
  });

  it("rejects unauthorized roles within the provided family scope", async () => {
    const state = createState();
    state.authUsers["third-party-token"] = { id: "user-third-party" };
    addPremiumProfile(state, { userId: "user-third-party", profileId: "profile-third-party" });
    state.tables.family_members.push({
      family_id: FAMILY_ID,
      role: "third_party",
      status: "active",
      user_id: "user-third-party",
    });

    __setCreateClientImplementation(() => new MockSupabaseClient(state));

    const result = await aiGuard(
      buildRequest("third-party-token"),
      "analyze",
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      { familyId: FAMILY_ID },
    );

    expect(result.allowed).toBe(false);
    expect(result.statusCode).toBe(403);
    expect(result.error).toMatchObject({
      code: "ROLE_REQUIRED",
    });
  });
});
