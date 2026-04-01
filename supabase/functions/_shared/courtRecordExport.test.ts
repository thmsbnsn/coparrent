import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { generateKeyPairSync, webcrypto } from "node:crypto";
import { __resetCreateClientImplementation, __setCreateClientImplementation } from "./test-shims/supabaseEdge";
import { __resetS3MockHandlers, __setS3MockHandlers } from "./test-shims/awsS3";

type JsonRecord = Record<string, unknown>;

interface TestState {
  authUsers: Record<string, { id: string } | null>;
  rpcCalls: Array<{ args: JsonRecord; name: string }>;
  s3Downloads: Array<{ bucket: string; key: string; versionId: string }>;
  s3Objects: Map<string, { contentType: string; data: Uint8Array; retainUntil: string; versionId: string }>;
  s3Uploads: Array<{ bucket: string; contentType: string | null; key: string; versionId: string }>;
  s3VersionCounter: number;
  tables: Record<string, JsonRecord[]>;
}

const textEncoder = new TextEncoder();
const s3StorageKey = (bucket: string, key: string, versionId: string) =>
  `${bucket}:${key}:${versionId}`;

const encodePayload = async (
  value: Blob | File | Uint8Array | ArrayBuffer | ArrayBufferView | string,
) => {
  if (typeof value === "string") {
    return textEncoder.encode(value);
  }

  if (value instanceof Uint8Array) {
    return value;
  }

  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  }

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }

  if (value && typeof (value as Blob).arrayBuffer === "function") {
    return new Uint8Array(await (value as Blob).arrayBuffer());
  }

  throw new TypeError("Unsupported payload type in court record export test harness.");
};

class MockQueryBuilder {
  private filters: Array<(row: JsonRecord) => boolean> = [];
  private limitCount: number | null = null;
  private orderField: string | null = null;
  private orderAscending = true;

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

  is(field: string, value: unknown): this {
    this.filters.push((row) => row[field] === value);
    return this;
  }

  gte(field: string, value: unknown): this {
    this.filters.push((row) => String(row[field] ?? "") >= String(value ?? ""));
    return this;
  }

  in(field: string, values: unknown[]): this {
    this.filters.push((row) => values.includes(row[field]));
    return this;
  }

  limit(value: number): this {
    this.limitCount = value;
    return this;
  }

  lte(field: string, value: unknown): this {
    this.filters.push((row) => String(row[field] ?? "") <= String(value ?? ""));
    return this;
  }

  order(field: string, options?: { ascending?: boolean }): this {
    this.orderField = field;
    this.orderAscending = options?.ascending ?? true;
    return this;
  }

  async maybeSingle(): Promise<{ data: JsonRecord | null; error: null }> {
    const rows = this.getRows();
    return { data: rows[0] ?? null, error: null };
  }

  async single(): Promise<{ data: JsonRecord | null; error: Error | null }> {
    const rows = this.getRows();
    if (rows.length === 0) {
      return { data: null, error: new Error(`No rows found in ${this.tableName}`) };
    }

    return { data: rows[0], error: null };
  }

  then<TResult1 = { data: JsonRecord[] | null; error: Error | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: JsonRecord[] | null; error: Error | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve({ data: this.getRows(), error: null }).then(
      onfulfilled ?? undefined,
      onrejected ?? undefined,
    );
  }

  private getRows() {
    let rows = [...(this.state.tables[this.tableName] ?? [])].filter((row) =>
      this.filters.every((filter) => filter(row)),
    );

    if (this.orderField) {
      rows = rows.sort((left, right) => {
        const comparison = String(left[this.orderField!] ?? "").localeCompare(
          String(right[this.orderField!] ?? ""),
        );
        return this.orderAscending ? comparison : -comparison;
      });
    }

    if (this.limitCount !== null) {
      rows = rows.slice(0, this.limitCount);
    }

    return rows.map((row) => structuredClone(row));
  }
}

class MockInsertBuilder {
  constructor(
    private readonly rows: JsonRecord[],
    private readonly payload: JsonRecord | JsonRecord[],
  ) {}

  select(_columns: string) {
    const inserts = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((record) =>
      structuredClone(record),
    );
    inserts.forEach((record) => this.rows.push(record));

    return {
      single: async () => ({
        data: structuredClone(inserts[0] ?? null),
        error: null,
      }),
    };
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

  storage = {
    from: (_bucket: string) => ({
      download: async (_path: string) => ({
        data: null,
        error: new Error("Object not found"),
      }),
    }),
  };

  from(tableName: string) {
    const ensureTable = () => {
      if (!this.state.tables[tableName]) {
        this.state.tables[tableName] = [];
      }

      return this.state.tables[tableName];
    };

    return {
      insert: (payload: JsonRecord | JsonRecord[]) =>
        new MockInsertBuilder(ensureTable(), payload),
      select: (columns: string) => new MockQueryBuilder(this.state, tableName).select(columns),
    };
  }

  rpc = async (name: string, args: JsonRecord) => {
    this.state.rpcCalls.push({ name, args });
    return { data: "audit-id", error: null };
  };
}

const signingKeyConfig = {
  keyId: "messaging-export-key-v1",
  privateKeyPkcs8Base64: "",
  publicKeySpkiBase64: "",
};

const envValues: Record<string, string | undefined> = {
  AWS_ACCESS_KEY_ID: "aws-access-key-id",
  AWS_REGION: "us-east-2",
  AWS_S3_BUCKET_NAME: "coparrent-court-records-prod",
  AWS_SECRET_ACCESS_KEY: "aws-secret-access-key",
  MESSAGING_THREAD_EXPORT_SIGNING_KEY_ID: signingKeyConfig.keyId,
  MESSAGING_THREAD_EXPORT_SIGNING_PRIVATE_KEY_PKCS8_B64:
    signingKeyConfig.privateKeyPkcs8Base64,
  MESSAGING_THREAD_EXPORT_SIGNING_PUBLIC_KEY_SPKI_B64:
    signingKeyConfig.publicKeySpkiBase64,
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  SUPABASE_URL: "https://example.supabase.co",
  VERCEL_GIT_COMMIT_SHA: "commit-sha-456",
};

const buildState = (): TestState => ({
  authUsers: {
    "law-office-token": { id: "user-7" },
    "parent-token": { id: "user-1" },
    "outsider-token": { id: "user-9" },
  },
  rpcCalls: [],
  s3Downloads: [],
  s3Objects: new Map(),
  s3Uploads: [],
  s3VersionCounter: 1,
  tables: {
    call_events: [
      {
        actor_display_name: "Jordan Coparent",
        actor_profile_id: "profile-jordan",
        call_session_id: "call-1",
        created_at: "2026-03-05T11:02:00.000Z",
        event_type: "accepted",
        id: "call-event-1",
        payload: {},
      },
      {
        actor_display_name: "Taylor Parent",
        actor_profile_id: "profile-taylor",
        call_session_id: "call-1",
        created_at: "2026-03-05T11:00:00.000Z",
        event_type: "created",
        id: "call-event-2",
        payload: {},
      },
    ],
    call_sessions: [
      {
        answered_at: "2026-03-05T11:02:00.000Z",
        call_type: "video",
        callee_display_name: "Jordan Coparent",
        callee_profile_id: "profile-jordan",
        created_at: "2026-03-05T11:00:00.000Z",
        ended_at: "2026-03-05T11:15:00.000Z",
        failed_reason: null,
        family_id: "family-1",
        id: "call-1",
        initiator_display_name: "Taylor Parent",
        initiator_profile_id: "profile-taylor",
        source: "daily",
        status: "ended",
        thread_id: "thread-1",
      },
      {
        answered_at: null,
        call_type: "audio",
        callee_display_name: "Other Family",
        callee_profile_id: "profile-other-family",
        created_at: "2026-03-08T11:00:00.000Z",
        ended_at: null,
        failed_reason: null,
        family_id: "family-2",
        id: "call-2",
        initiator_display_name: "Other Family",
        initiator_profile_id: "profile-other-family",
        source: "daily",
        status: "missed",
        thread_id: "thread-2",
      },
    ],
    children: [
      { family_id: "family-1", id: "child-1", name: "Avery" },
      { family_id: "family-2", id: "child-2", name: "Not Included" },
    ],
    court_exports: [],
    custody_schedules: [
      {
        exchange_location: "School",
        exchange_time: "17:00",
        family_id: "family-1",
        holidays: null,
        id: "schedule-1",
        pattern: "weekly",
        start_date: "2026-01-01",
      },
    ],
    document_access_logs: [
      {
        accessed_by: "profile-jordan",
        action: "view",
        created_at: "2026-03-07T15:00:00.000Z",
        document_id: "document-1",
        id: "doc-log-1",
      },
    ],
    documents: [
      {
        category: "medical",
        child_id: "child-1",
        created_at: "2026-03-06T14:00:00.000Z",
        description: "Visit summary",
        family_id: "family-1",
        file_name: "visit-summary.pdf",
        file_size: 4096,
        file_type: "application/pdf",
        id: "document-1",
        title: "Pediatric Visit Summary",
        uploaded_by: "profile-taylor",
      },
      {
        category: "school",
        child_id: "child-2",
        created_at: "2026-03-09T14:00:00.000Z",
        description: "Should not appear",
        family_id: "family-2",
        file_name: "other-family.pdf",
        file_size: 1024,
        file_type: "application/pdf",
        id: "document-2",
        title: "Other Family",
        uploaded_by: "profile-other-family",
      },
    ],
    exchange_checkins: [
      {
        checked_in_at: "2026-03-09T17:05:00.000Z",
        exchange_date: "2026-03-09",
        id: "checkin-1",
        note: "On time",
        schedule_id: "schedule-1",
        user_id: "profile-taylor",
      },
    ],
    expenses: [
      {
        amount: 45,
        category: "medical",
        child_id: "child-1",
        created_at: "2026-03-04T10:00:00.000Z",
        description: "Prescription pickup",
        expense_date: "2026-03-04",
        family_id: "family-1",
        id: "expense-1",
        notes: null,
        split_percentage: 50,
      },
    ],
    family_members: [
      {
        family_id: "family-1",
        profile_id: "profile-taylor",
        profiles: {
          email: "taylor@example.com",
          full_name: "Taylor Parent",
          id: "profile-taylor",
        },
        role: "parent",
        status: "active",
        user_id: "user-1",
      },
      {
        family_id: "family-1",
        profile_id: "profile-jordan",
        profiles: {
          email: "jordan@example.com",
          full_name: "Jordan Coparent",
          id: "profile-jordan",
        },
        role: "parent",
        status: "active",
        user_id: "user-2",
      },
    ],
    law_office_family_access: [
      {
        created_at: "2026-04-01T08:00:00.000Z",
        family_id: "family-1",
        granted_by: "user-1",
        id: "law-access-1",
        law_office_user_id: "user-7",
        revoked_at: null,
      },
    ],
    message_threads: [
      {
        family_id: "family-1",
        id: "thread-1",
        name: "Family Channel",
        thread_type: "family_channel",
      },
      {
        family_id: "family-2",
        id: "thread-2",
        name: "Other Family",
        thread_type: "family_channel",
      },
    ],
    profiles: [
      {
        access_grace_until: null,
        account_role: null,
        email: "taylor@example.com",
        free_premium_access: false,
        full_name: "Taylor Parent",
        id: "profile-taylor",
        subscription_status: "active",
        subscription_tier: "power",
        trial_ends_at: null,
        user_id: "user-1",
      },
      {
        access_grace_until: null,
        account_role: null,
        email: "jordan@example.com",
        free_premium_access: false,
        full_name: "Jordan Coparent",
        id: "profile-jordan",
        subscription_status: "active",
        subscription_tier: "power",
        trial_ends_at: null,
        user_id: "user-2",
      },
      {
        access_grace_until: null,
        account_role: "law_office",
        email: "lawyer@example.com",
        free_premium_access: false,
        full_name: "Alex Counsel",
        id: "profile-law-office",
        subscription_status: "none",
        subscription_tier: "free",
        trial_ends_at: null,
        user_id: "user-7",
      },
      {
        access_grace_until: null,
        account_role: null,
        email: "outsider@example.com",
        free_premium_access: false,
        full_name: "Outside User",
        id: "profile-outsider",
        subscription_status: "none",
        subscription_tier: "free",
        trial_ends_at: null,
        user_id: "user-9",
      },
    ],
    schedule_requests: [
      {
        created_at: "2026-03-03T08:00:00.000Z",
        family_id: "family-1",
        id: "request-1",
        original_date: "2026-03-10",
        proposed_date: "2026-03-11",
        reason: "Doctor appointment",
        recipient_id: "profile-jordan",
        requester_id: "profile-taylor",
        request_type: "swap",
        status: "approved",
        updated_at: "2026-03-03T10:00:00.000Z",
      },
    ],
    thread_messages: [
      {
        content: "Can we move pickup to 5:30 PM?",
        created_at: "2026-03-02T09:00:00.000Z",
        id: "message-1",
        sender_id: "profile-taylor",
        sender_role: "parent",
        thread_id: "thread-1",
      },
      {
        content: "Yes, that works.",
        created_at: "2026-03-02T09:10:00.000Z",
        id: "message-2",
        sender_id: "profile-jordan",
        sender_role: "parent",
        thread_id: "thread-1",
      },
      {
        content: "Other family message",
        created_at: "2026-03-02T09:10:00.000Z",
        id: "message-3",
        sender_id: "profile-other-family",
        sender_role: "parent",
        thread_id: "thread-2",
      },
    ],
    user_roles: [],
  },
});

const buildRequest = (body: JsonRecord, token?: string) => {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return new Request("https://example.functions.supabase.co/court-record-export", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
};

describe("court-record-export", () => {
  let handler: (request: Request) => Promise<Response> | Response;
  let state: TestState;

  beforeAll(async () => {
    if (!globalThis.crypto) {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: webcrypto,
      });
    }

    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    signingKeyConfig.privateKeyPkcs8Base64 = privateKey
      .export({ format: "der", type: "pkcs8" })
      .toString("base64");
    signingKeyConfig.publicKeySpkiBase64 = publicKey
      .export({ format: "der", type: "spki" })
      .toString("base64");
    envValues.MESSAGING_THREAD_EXPORT_SIGNING_PRIVATE_KEY_PKCS8_B64 =
      signingKeyConfig.privateKeyPkcs8Base64;
    envValues.MESSAGING_THREAD_EXPORT_SIGNING_PUBLIC_KEY_SPKI_B64 =
      signingKeyConfig.publicKeySpkiBase64;

    vi.stubGlobal("Deno", {
      env: {
        get: (key: string) => envValues[key],
      },
    });

    const serverShim = await import("./test-shims/denoHttpServer");
    serverShim.__resetServedHandler();
    await import("../court-record-export/index.ts");
    handler = serverShim.__getServedHandler();
  });

  beforeEach(() => {
    state = buildState();
    __resetCreateClientImplementation();
    __setCreateClientImplementation(() => new MockSupabaseClient(state));
    __resetS3MockHandlers();
    __setS3MockHandlers({
      getObject: async (input) => {
        const bucket = String(input.Bucket ?? "");
        const key = String(input.Key ?? "");
        const versionId = String(input.VersionId ?? "");
        state.s3Downloads.push({ bucket, key, versionId });
        const stored = state.s3Objects.get(s3StorageKey(bucket, key, versionId));
        if (!stored) {
          throw new Error("Object not found");
        }

        return {
          Body: stored.data,
          ContentType: stored.contentType,
          ObjectLockMode: "COMPLIANCE",
          ObjectLockRetainUntilDate: new Date(stored.retainUntil),
        };
      },
      headObject: async (input) => {
        const stored = state.s3Objects.get(
          s3StorageKey(String(input.Bucket ?? ""), String(input.Key ?? ""), String(input.VersionId ?? "")),
        );
        if (!stored) {
          throw new Error("Object not found");
        }

        return {
          ContentType: stored.contentType,
          ObjectLockMode: "COMPLIANCE",
          ObjectLockRetainUntilDate: new Date(stored.retainUntil),
        };
      },
      putObject: async (input) => {
        const bucket = String(input.Bucket ?? "");
        const key = String(input.Key ?? "");
        const versionId = `version-${state.s3VersionCounter++}`;
        const data = await encodePayload(
          input.Body as Blob | File | Uint8Array | ArrayBuffer | ArrayBufferView | string,
        );
        const retainUntil = "2033-04-01T00:00:00.000Z";

        state.s3Uploads.push({
          bucket,
          contentType: typeof input.ContentType === "string" ? input.ContentType : null,
          key,
          versionId,
        });
        state.s3Objects.set(s3StorageKey(bucket, key, versionId), {
          contentType:
            typeof input.ContentType === "string"
              ? input.ContentType
              : "application/octet-stream",
          data,
          retainUntil,
          versionId,
        });

        return { VersionId: versionId };
      },
    });
  });

  it("fails explicitly when family scope is missing", async () => {
    const response = await handler(
      buildRequest(
        {
          action: "create",
          date_range: {
            end: "2026-03-31T23:59:59.000Z",
            start: "2026-03-01T00:00:00.000Z",
          },
          include_sections: ["messages"],
        },
        "parent-token",
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "family_id is required.",
      success: false,
    });
  });

  it("fails closed when date_range is missing", async () => {
    const response = await handler(
      buildRequest(
        {
          action: "create",
          family_id: "family-1",
          include_sections: ["messages"],
        },
        "parent-token",
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "date_range.start and date_range.end are required.",
      success: false,
    });
  });

  it("denies export when the user is not authorized for the family", async () => {
    const response = await handler(
      buildRequest(
        {
          action: "create",
          date_range: {
            end: "2026-03-31T23:59:59.000Z",
            start: "2026-03-01T00:00:00.000Z",
          },
          family_id: "family-1",
          include_sections: ["messages"],
        },
        "outsider-token",
      ),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "You do not have access to that family.",
      success: false,
    });
  });

  it("fails when a law office user has no explicit family assignment", async () => {
    state.tables.law_office_family_access = [];

    const response = await handler(
      buildRequest(
        {
          action: "list",
          family_id: "family-1",
        },
        "law-office-token",
      ),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "You do not have access to that family.",
      success: false,
    });
  });

  it("blocks law office users from creating new family-wide exports", async () => {
    const response = await handler(
      buildRequest(
        {
          action: "create",
          date_range: {
            end: "2026-03-31T23:59:59.000Z",
            start: "2026-03-01T00:00:00.000Z",
          },
          family_id: "family-1",
          include_sections: ["messages"],
        },
        "law-office-token",
      ),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Law office users cannot create exports.",
      success: false,
    });
  });

  it("requires a Power subscription for family court-record exports", async () => {
    const exporter = state.tables.profiles.find((row) => row.id === "profile-taylor");
    if (!exporter) {
      throw new Error("Expected seeded exporter profile.");
    }

    exporter.free_premium_access = false;
    exporter.subscription_status = "none";
    exporter.subscription_tier = "free";
    exporter.trial_ends_at = null;

    const response = await handler(
      buildRequest(
        {
          action: "create",
          date_range: {
            end: "2026-03-31T23:59:59.000Z",
            start: "2026-03-01T00:00:00.000Z",
          },
          family_id: "family-1",
          include_sections: ["messages"],
        },
        "parent-token",
      ),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "This feature requires a Power subscription.",
      success: false,
    });
  });

  it("limits family court-record exports to parent and guardian memberships", async () => {
    const exporterMembership = state.tables.family_members.find((row) => row.user_id === "user-1");
    if (!exporterMembership) {
      throw new Error("Expected seeded exporter membership.");
    }

    exporterMembership.role = "third_party";

    const response = await handler(
      buildRequest(
        {
          action: "create",
          date_range: {
            end: "2026-03-31T23:59:59.000Z",
            start: "2026-03-01T00:00:00.000Z",
          },
          family_id: "family-1",
          include_sections: ["messages"],
        },
        "parent-token",
      ),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Only parents and guardians can export family court records.",
      success: false,
    });
  });

  it("creates a unified family export with call evidence and immutable S3 metadata", async () => {
    const response = await handler(
      buildRequest(
        {
          action: "create",
          date_range: {
            end: "2026-03-31T23:59:59.000Z",
            start: "2026-03-01T00:00:00.000Z",
          },
          family_id: "family-1",
          include_sections: [
            "messages",
            "call_activity",
            "document_references",
            "document_access_logs",
            "expenses",
            "schedule_requests",
            "exchange_checkins",
            "schedule_overview",
            "children",
          ],
        },
        "parent-token",
      ),
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.export).toMatchObject({
      export_scope: "family_unified",
      family_id: "family-1",
      record_count: expect.any(Number),
    });
    expect(body.export.artifact_storage).toMatchObject({
      bucket: "coparrent-court-records-prod",
      object_lock_mode: "COMPLIANCE",
      provider: "aws_s3_object_lock",
      retain_until: "2033-04-01T00:00:00.000Z",
      version_id: expect.stringMatching(/^version-/),
    });
    expect(body.export.pdf_storage).toMatchObject({
      bucket: "coparrent-court-records-prod",
      object_lock_mode: "COMPLIANCE",
      provider: "aws_s3_object_lock",
      version_id: expect.stringMatching(/^version-/),
    });
    expect(body.canonical_payload.call_activity).toHaveLength(1);
    expect(body.canonical_payload.call_activity[0].events).toHaveLength(2);
    expect(body.canonical_payload.document_references[0]).toMatchObject({
      file_name: "visit-summary.pdf",
      title: "Pediatric Visit Summary",
    });
    expect(body.canonical_payload.document_references[0].file_bytes).toBeUndefined();
    expect(body.canonical_payload.messages).toHaveLength(2);
    expect(body.canonical_payload.messages.some((message: JsonRecord) => message.id === "message-3")).toBe(false);
    expect(body.evidence_package.verification_instructions).toContain(
      "Call evidence is represented as persisted session and event history only. No recordings or transcripts are included.",
    );
    expect(state.tables.court_exports).toHaveLength(1);
    expect(state.s3Uploads).toHaveLength(2);
  });

  it("allows an explicitly assigned law office user to list, download, and verify immutable exports", async () => {
    const createResponse = await handler(
      buildRequest(
        {
          action: "create",
          date_range: {
            end: "2026-03-31T23:59:59.000Z",
            start: "2026-03-01T00:00:00.000Z",
          },
          family_id: "family-1",
          include_sections: ["messages", "call_activity", "document_references"],
        },
        "parent-token",
      ),
    );
    const createBody = await createResponse.json();

    const listResponse = await handler(
      buildRequest(
        {
          action: "list",
          family_id: "family-1",
        },
        "law-office-token",
      ),
    );

    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toMatchObject({
      exports: [expect.objectContaining({ id: createBody.export.id })],
      success: true,
    });

    const downloadResponse = await handler(
      buildRequest(
        {
          action: "download",
          artifact_kind: "pdf",
          export_id: createBody.export.id,
          family_id: "family-1",
        },
        "law-office-token",
      ),
    );

    expect(downloadResponse.status).toBe(200);
    await expect(downloadResponse.json()).resolves.toMatchObject({
      artifact: expect.objectContaining({
        kind: "pdf",
      }),
      success: true,
    });

    const verifyResponse = await handler(
      buildRequest(
        {
          action: "verify",
          export_id: createBody.export.id,
          family_id: "family-1",
          verification_mode: "stored_source",
        },
        "law-office-token",
      ),
    );

    expect(verifyResponse.status).toBe(200);
    await expect(verifyResponse.json()).resolves.toMatchObject({
      status: "match",
      success: true,
      verification_mode: "stored_source",
    });
  });

  it("returns a verification match for unchanged stored source data", async () => {
    const createResponse = await handler(
      buildRequest(
        {
          action: "create",
          date_range: {
            end: "2026-03-31T23:59:59.000Z",
            start: "2026-03-01T00:00:00.000Z",
          },
          family_id: "family-1",
          include_sections: ["messages", "call_activity", "document_references"],
        },
        "parent-token",
      ),
    );
    const createBody = await createResponse.json();

    const verifyResponse = await handler(
      buildRequest(
        {
          action: "verify",
          export_id: createBody.export.id,
          family_id: "family-1",
          verification_mode: "stored_source",
        },
        "parent-token",
      ),
    );

    expect(verifyResponse.status).toBe(200);
    await expect(verifyResponse.json()).resolves.toMatchObject({
      status: "match",
      success: true,
      verification_mode: "stored_source",
      verification_layers: {
        artifact_hash: expect.objectContaining({ status: "match" }),
        canonical_content_hash: expect.objectContaining({ status: "match" }),
        manifest_hash: expect.objectContaining({ status: "match" }),
        receipt_signature: expect.objectContaining({ status: "match", valid: true }),
      },
    });
  });

  it("returns a verification mismatch when family source records change", async () => {
    const createResponse = await handler(
      buildRequest(
        {
          action: "create",
          date_range: {
            end: "2026-03-31T23:59:59.000Z",
            start: "2026-03-01T00:00:00.000Z",
          },
          family_id: "family-1",
          include_sections: ["messages", "call_activity"],
        },
        "parent-token",
      ),
    );
    const createBody = await createResponse.json();

    (state.tables.thread_messages[0] as JsonRecord).content = "Changed after export";

    const verifyResponse = await handler(
      buildRequest(
        {
          action: "verify",
          export_id: createBody.export.id,
          family_id: "family-1",
          verification_mode: "stored_source",
        },
        "parent-token",
      ),
    );

    expect(verifyResponse.status).toBe(200);
    await expect(verifyResponse.json()).resolves.toMatchObject({
      status: "mismatch",
      success: true,
      verification_layers: {
        canonical_content_hash: expect.objectContaining({ status: "mismatch" }),
      },
    });
  });

  it("rejects a tampered uploaded evidence package signature", async () => {
    const createResponse = await handler(
      buildRequest(
        {
          action: "create",
          date_range: {
            end: "2026-03-31T23:59:59.000Z",
            start: "2026-03-01T00:00:00.000Z",
          },
          family_id: "family-1",
          include_sections: ["messages", "call_activity"],
        },
        "parent-token",
      ),
    );
    const createBody = await createResponse.json();
    const tamperedPackage = JSON.parse(createBody.evidence_package_json) as JsonRecord;
    tamperedPackage.receipt = {
      ...(tamperedPackage.receipt as JsonRecord),
      receipt_signature: "tampered-signature",
    };

    const verifyResponse = await handler(
      buildRequest(
        {
          action: "verify",
          export_id: createBody.export.id,
          family_id: "family-1",
          provided_package_json: JSON.stringify(tamperedPackage),
          verification_mode: "provided_package_json",
        },
        "parent-token",
      ),
    );

    expect(verifyResponse.status).toBe(200);
    await expect(verifyResponse.json()).resolves.toMatchObject({
      status: "signature_invalid",
      success: true,
      verification_layers: {
        receipt_signature: expect.objectContaining({ status: "mismatch", valid: false }),
      },
    });
  });

  it("verifies the stored PDF artifact against the stored receipt", async () => {
    const createResponse = await handler(
      buildRequest(
        {
          action: "create",
          date_range: {
            end: "2026-03-31T23:59:59.000Z",
            start: "2026-03-01T00:00:00.000Z",
          },
          family_id: "family-1",
          include_sections: ["messages", "call_activity"],
        },
        "parent-token",
      ),
    );
    const createBody = await createResponse.json();

    const verifyResponse = await handler(
      buildRequest(
        {
          action: "verify",
          export_id: createBody.export.id,
          family_id: "family-1",
          verification_mode: "stored_pdf_artifact",
        },
        "parent-token",
      ),
    );

    expect(verifyResponse.status).toBe(200);
    await expect(verifyResponse.json()).resolves.toMatchObject({
      status: "match",
      success: true,
      verification_layers: {
        pdf_artifact_hash: expect.objectContaining({ status: "match" }),
      },
    });
    expect(state.s3Downloads.some((download) => download.key.endsWith(".pdf"))).toBe(true);
  });

  it("fails export creation when immutable S3 lock metadata is missing", async () => {
    __setS3MockHandlers({
      headObject: async () => ({
        ContentType: "application/pdf",
      }),
    });

    const response = await handler(
      buildRequest(
        {
          action: "create",
          date_range: {
            end: "2026-03-31T23:59:59.000Z",
            start: "2026-03-01T00:00:00.000Z",
          },
          family_id: "family-1",
          include_sections: ["messages"],
        },
        "parent-token",
      ),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: "Immutable S3 upload did not expose Object Lock retention metadata.",
      success: false,
    });
  });
});
