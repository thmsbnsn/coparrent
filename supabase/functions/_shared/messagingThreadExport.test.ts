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
  s3Uploads: Array<{
    bucket: string;
    contentType: string | null;
    key: string;
    versionId: string;
  }>;
  s3VersionCounter: number;
  storageDownloads: Array<{ bucket: string; path: string }>;
  storageObjects: Map<string, { contentType: string; data: Uint8Array }>;
  storageUploads: Array<{
    bucket: string;
    contentType: string | null;
    path: string;
    upsert: boolean;
  }>;
  tables: Record<string, JsonRecord[]>;
}

const storageKey = (bucket: string, path: string) => `${bucket}:${path}`;
const s3StorageKey = (bucket: string, key: string, versionId: string) =>
  `${bucket}:${key}:${versionId}`;

const textEncoder = new TextEncoder();

const encodeStoragePayload = async (
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

  throw new TypeError("Unsupported storage payload type in messaging export test harness.");
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

  in(field: string, values: unknown[]): this {
    this.filters.push((row) => values.includes(row[field]));
    return this;
  }

  limit(value: number): this {
    this.limitCount = value;
    return this;
  }

  order(field: string, options?: { ascending?: boolean }): this {
    this.orderField = field;
    this.orderAscending = options?.ascending ?? true;
    return this;
  }

  returns<T>(): T {
    return this as T;
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
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<{ data: JsonRecord[] | null; error: Error | null }> {
    return { data: this.getRows(), error: null };
  }

  private getRows(): JsonRecord[] {
    let rows = [...(this.state.tables[this.tableName] ?? [])].filter((row) =>
      this.filters.every((filter) => filter(row)),
    );

    if (this.orderField) {
      rows = rows.sort((left, right) => {
        const leftValue = left[this.orderField!];
        const rightValue = right[this.orderField!];
        const comparison = String(leftValue ?? "").localeCompare(String(rightValue ?? ""));
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
    from: (bucket: string) => ({
      download: async (path: string) => {
        this.state.storageDownloads.push({ bucket, path });
        const stored = this.state.storageObjects.get(storageKey(bucket, path));
        if (!stored) {
          return {
            data: null,
            error: new Error("Object not found"),
          };
        }

        return {
          data: new Blob([stored.data], { type: stored.contentType }),
          error: null,
        };
      },
      upload: async (
        path: string,
        payload: Blob | File | Uint8Array,
        options?: { contentType?: string; upsert?: boolean },
      ) => {
        const upsert = options?.upsert ?? false;
        const key = storageKey(bucket, path);
        this.state.storageUploads.push({
          bucket,
          contentType: options?.contentType ?? null,
          path,
          upsert,
        });

        if (!upsert && this.state.storageObjects.has(key)) {
          return {
            data: null,
            error: new Error("The resource already exists"),
          };
        }

        this.state.storageObjects.set(key, {
          contentType: options?.contentType ?? "application/octet-stream",
          data: await encodeStoragePayload(payload),
        });

        return {
          data: { path },
          error: null,
        };
      },
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
  MESSAGING_THREAD_EXPORT_SIGNING_KEY: "server-signing-secret",
  MESSAGING_THREAD_EXPORT_SIGNING_KEY_ID: signingKeyConfig.keyId,
  MESSAGING_THREAD_EXPORT_SIGNING_PRIVATE_KEY_PKCS8_B64:
    signingKeyConfig.privateKeyPkcs8Base64,
  MESSAGING_THREAD_EXPORT_SIGNING_PUBLIC_KEY_SPKI_B64:
    signingKeyConfig.publicKeySpkiBase64,
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  SUPABASE_URL: "https://example.supabase.co",
  VERCEL_GIT_COMMIT_SHA: "commit-sha-123",
};

const buildState = (): TestState => ({
  authUsers: {
    "guardian-token": { id: "user-3" },
    "parent-token": { id: "user-1" },
  },
  rpcCalls: [],
  s3Downloads: [],
  s3Objects: new Map(),
  s3Uploads: [],
  s3VersionCounter: 1,
  storageDownloads: [],
  storageObjects: new Map(),
  storageUploads: [],
  tables: {
    call_events: [],
    call_sessions: [],
    court_exports: [],
    family_members: [
      {
        family_id: "family-1",
        id: "membership-parent",
        primary_parent_id: "profile-taylor",
        profile_id: "profile-taylor",
        relationship_label: "parent",
        role: "parent",
        status: "active",
        user_id: "user-1",
      },
      {
        family_id: "family-1",
        id: "membership-jessica",
        primary_parent_id: "profile-taylor",
        profile_id: "profile-jessica",
        relationship_label: "parent",
        role: "parent",
        status: "active",
        user_id: "user-2",
      },
      {
        family_id: "family-1",
        id: "membership-guardian",
        primary_parent_id: "profile-taylor",
        profile_id: "profile-guardian",
        relationship_label: "guardian",
        role: "guardian",
        status: "active",
        user_id: "user-3",
      },
    ],
    group_chat_participants: [],
    message_threads: [
      {
        created_at: "2026-03-30T10:00:00.000Z",
        family_id: "family-1",
        id: "thread-direct-jessica",
        name: null,
        participant_a_id: "profile-jessica",
        participant_b_id: "profile-taylor",
        primary_parent_id: "profile-taylor",
        thread_type: "direct_message",
        updated_at: "2026-03-30T10:47:00.000Z",
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
        email: "jessica@example.com",
        free_premium_access: false,
        full_name: "Jessica Morgan",
        id: "profile-jessica",
        subscription_status: "active",
        subscription_tier: "power",
        trial_ends_at: null,
        user_id: "user-2",
      },
      {
        access_grace_until: null,
        account_role: null,
        email: "guardian@example.com",
        free_premium_access: false,
        full_name: "Jordan Guardian",
        id: "profile-guardian",
        subscription_status: "active",
        subscription_tier: "power",
        trial_ends_at: null,
        user_id: "user-3",
      },
    ],
    thread_messages: [
      {
        content: "Can we confirm pickup for tomorrow at 5:30 PM?",
        created_at: "2026-03-30T10:45:00.000Z",
        id: "message-1",
        sender_id: "profile-jessica",
        sender_role: "parent",
        thread_id: "thread-direct-jessica",
      },
      {
        content: "Confirmed. I will be there at 5:30 PM.",
        created_at: "2026-03-30T10:47:00.000Z",
        id: "message-2",
        sender_id: "profile-taylor",
        sender_role: "parent",
        thread_id: "thread-direct-jessica",
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

  return new Request("https://example.functions.supabase.co/messaging-thread-export", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
};

describe("messaging-thread-export", () => {
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
    await import("../messaging-thread-export/index.ts");
    handler = serverShim.__getServedHandler();
  });

  beforeEach(() => {
    state = buildState();
    envValues.MESSAGING_THREAD_EXPORT_SIGNING_KEY_ID = signingKeyConfig.keyId;
    envValues.MESSAGING_THREAD_EXPORT_SIGNING_PRIVATE_KEY_PKCS8_B64 =
      signingKeyConfig.privateKeyPkcs8Base64;
    envValues.MESSAGING_THREAD_EXPORT_SIGNING_PUBLIC_KEY_SPKI_B64 =
      signingKeyConfig.publicKeySpkiBase64;
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
        const bucket = String(input.Bucket ?? "");
        const key = String(input.Key ?? "");
        const versionId = String(input.VersionId ?? "");
        const stored = state.s3Objects.get(s3StorageKey(bucket, key, versionId));
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
        const data = await encodeStoragePayload(
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

        return {
          VersionId: versionId,
        };
      },
    });
  });

  it("fails explicitly when family scope is missing", async () => {
    const response = await handler(
      buildRequest(
        {
          action: "create",
          thread_id: "thread-direct-jessica",
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

  it("requires a Power subscription for messaging export creation", async () => {
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
          family_id: "family-1",
          thread_id: "thread-direct-jessica",
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

  it("creates a persisted export record with hash and manifest from authorized thread data", async () => {
    const response = await handler(
      buildRequest(
        {
          action: "create",
          family_id: "family-1",
          thread_id: "thread-direct-jessica",
        },
        "parent-token",
      ),
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.export).toMatchObject({
      artifact_hash: expect.any(String),
      canonicalization_version: "coparrent.messaging-thread-export-canonical/v2",
      family_id: "family-1",
      integrity_model_version: "coparrent.messaging-thread-export-receipt/v4",
      manifest_hash: expect.any(String),
      pdf_artifact_hash: expect.any(String),
      record_count: 3,
      signing_key_id: "messaging-export-key-v1",
      signature_present: true,
      thread_display_name: "Jessica Morgan",
      thread_id: "thread-direct-jessica",
    });
    expect(body.manifest).toMatchObject({
      artifact_storage_bucket: "coparrent-court-records-prod",
      canonicalization_version: "coparrent.messaging-thread-export-canonical/v2",
      family_id: "family-1",
      integrity_model_version: "coparrent.messaging-thread-export-receipt/v4",
      pdf_artifact_hash: expect.any(String),
      pdf_hash_algorithm: "sha256",
      pdf_storage_bucket: "coparrent-court-records-prod",
      thread_id: "thread-direct-jessica",
      total_entries: 3,
      total_messages: 2,
      total_system_events: 1,
    });
    expect(body.receipt).toMatchObject({
      artifact_hash: expect.any(String),
      artifact_storage_bucket: "coparrent-court-records-prod",
      canonical_content_hash: body.export.content_hash,
      created_by_user_id: "user-1",
      pdf_artifact_hash: expect.any(String),
      pdf_artifact_type: "server_generated_pdf_artifact",
      pdf_hash_algorithm: "sha256",
      pdf_storage_bucket: "coparrent-court-records-prod",
      manifest_hash: body.export.manifest_hash,
      receipt_signature: expect.any(String),
      receipt_signature_algorithm: "ed25519",
      signing_key_id: "messaging-export-key-v1",
    });
    expect(body.pdf_artifact).toMatchObject({
      base64: expect.any(String),
      content_type: "application/pdf",
      hash: expect.any(String),
      hash_algorithm: "sha256",
    });
    expect(body.pdf_artifact.hash).toBe(body.export.pdf_artifact_hash);
    expect(body.export.pdf_artifact_hash).not.toBe(body.export.content_hash);
    expect(body.canonical_payload.family_id).toBe("family-1");
    expect(body.canonical_payload.entries).toHaveLength(3);
    expect(body.evidence_package_json).toContain("\"receipt\"");
    expect(state.tables.court_exports).toHaveLength(1);
    expect(state.s3Uploads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bucket: "coparrent-court-records-prod",
          contentType: "application/json; charset=utf-8",
          key: expect.stringContaining("court-exports"),
        }),
        expect.objectContaining({
          bucket: "coparrent-court-records-prod",
          contentType: "application/pdf",
          key: expect.stringContaining("court-exports"),
        }),
      ]),
    );
    expect(state.rpcCalls.some((call) => call.args._action === "COURT_EXPORT_CREATED")).toBe(true);
  });

  it("fails closed when server receipt signing is not configured", async () => {
    envValues.MESSAGING_THREAD_EXPORT_SIGNING_PRIVATE_KEY_PKCS8_B64 = undefined;

    const response = await handler(
      buildRequest(
        {
          action: "create",
          family_id: "family-1",
          thread_id: "thread-direct-jessica",
        },
        "parent-token",
      ),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: "Messaging export receipt signing is not configured in this environment.",
      success: false,
    });
    expect(state.tables.court_exports).toHaveLength(0);
  });

  it("denies cross-family export attempts", async () => {
    const response = await handler(
      buildRequest(
        {
          action: "create",
          family_id: "family-2",
          thread_id: "thread-direct-jessica",
        },
        "parent-token",
      ),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "You do not have access to that family.",
      success: false,
    });
  });

  it("denies export when the requester is not authorized for the direct thread", async () => {
    const response = await handler(
      buildRequest(
        {
          action: "create",
          family_id: "family-1",
          thread_id: "thread-direct-jessica",
        },
        "guardian-token",
      ),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "You are not authorized to access that direct thread.",
      success: false,
    });
  });

  it("returns a verification match for unchanged server-authoritative content", async () => {
    const createResponse = await handler(
      buildRequest(
        {
          action: "create",
          family_id: "family-1",
          thread_id: "thread-direct-jessica",
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
      verification_layers: {
        artifact_hash: expect.objectContaining({ status: "match" }),
        canonical_content_hash: expect.objectContaining({ status: "match" }),
        manifest_hash: expect.objectContaining({ status: "match" }),
        receipt_signature: expect.objectContaining({ status: "match", valid: true }),
      },
      verification_mode: "stored_source",
    });
  });

  it("returns a verification mismatch when the canonical thread content changes", async () => {
    const createResponse = await handler(
      buildRequest(
        {
          action: "create",
          family_id: "family-1",
          thread_id: "thread-direct-jessica",
        },
        "parent-token",
      ),
    );
    const createBody = await createResponse.json();

    (state.tables.thread_messages[1] as JsonRecord).content =
      "Confirmed. I will be there at 6:00 PM instead.";

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
      verification_mode: "stored_source",
    });
  });

  it("verifies an uploaded evidence package against the stored receipt", async () => {
    const createResponse = await handler(
      buildRequest(
        {
          action: "create",
          family_id: "family-1",
          thread_id: "thread-direct-jessica",
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
          provided_package_json: createBody.evidence_package_json,
          verification_mode: "provided_package_json",
        },
        "parent-token",
      ),
    );

    expect(verifyResponse.status).toBe(200);
    await expect(verifyResponse.json()).resolves.toMatchObject({
      status: "match",
      success: true,
      verification_layers: {
        artifact_hash: expect.objectContaining({ status: "match" }),
        canonical_content_hash: expect.objectContaining({ status: "match" }),
        manifest_hash: expect.objectContaining({ status: "match" }),
        receipt_signature: expect.objectContaining({ status: "match", valid: true }),
      },
      verification_mode: "provided_package_json",
    });
  });

  it("flags an uploaded evidence package when the embedded receipt signature is altered", async () => {
    const createResponse = await handler(
      buildRequest(
        {
          action: "create",
          family_id: "family-1",
          thread_id: "thread-direct-jessica",
        },
        "parent-token",
      ),
    );
    const createBody = await createResponse.json();
    const tamperedPackage = JSON.parse(createBody.evidence_package_json) as JsonRecord;
    const tamperedReceipt = {
      ...(tamperedPackage.receipt as JsonRecord),
      receipt_signature: "tampered-signature",
    };
    tamperedPackage.receipt = tamperedReceipt;

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
      verification_mode: "provided_package_json",
    });
  });

  it("verifies the stored server-signed receipt when requested", async () => {
    const createResponse = await handler(
      buildRequest(
        {
          action: "create",
          family_id: "family-1",
          thread_id: "thread-direct-jessica",
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
          verification_mode: "stored_signature",
        },
        "parent-token",
      ),
    );

    expect(verifyResponse.status).toBe(200);
    await expect(verifyResponse.json()).resolves.toMatchObject({
      status: "match",
      success: true,
      verification_layers: {
        receipt_signature: expect.objectContaining({
          algorithm: "ed25519",
          status: "match",
          valid: true,
        }),
      },
      verification_mode: "stored_signature",
    });
  });

  it("verifies the stored PDF artifact against the stored receipt", async () => {
    const createResponse = await handler(
      buildRequest(
        {
          action: "create",
          family_id: "family-1",
          thread_id: "thread-direct-jessica",
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
        receipt_signature: expect.objectContaining({ status: "match", valid: true }),
      },
      verification_mode: "stored_pdf_artifact",
    });
    expect(state.s3Downloads.some((download) => download.key.endsWith(".pdf"))).toBe(true);
  });

  it("returns a mismatch when uploaded PDF bytes no longer match the stored receipt hash", async () => {
    const createResponse = await handler(
      buildRequest(
        {
          action: "create",
          family_id: "family-1",
          thread_id: "thread-direct-jessica",
        },
        "parent-token",
      ),
    );
    const createBody = await createResponse.json();
    const originalPdfBytes = Buffer.from(createBody.pdf_artifact.base64, "base64");
    const tamperedPdfBytes = Buffer.from(originalPdfBytes);
    tamperedPdfBytes[tamperedPdfBytes.length - 1] =
      (tamperedPdfBytes[tamperedPdfBytes.length - 1] + 1) % 255;

    const verifyResponse = await handler(
      buildRequest(
        {
          action: "verify",
          export_id: createBody.export.id,
          family_id: "family-1",
          provided_pdf_base64: tamperedPdfBytes.toString("base64"),
          verification_mode: "provided_pdf_artifact",
        },
        "parent-token",
      ),
    );

    expect(verifyResponse.status).toBe(200);
    await expect(verifyResponse.json()).resolves.toMatchObject({
      status: "mismatch",
      success: true,
      verification_layers: {
        pdf_artifact_hash: expect.objectContaining({ status: "mismatch" }),
        receipt_signature: expect.objectContaining({ status: "match", valid: true }),
      },
      verification_mode: "provided_pdf_artifact",
    });
  });

  it("denies stored PDF verification when the requester is not authorized for the direct thread", async () => {
    const createResponse = await handler(
      buildRequest(
        {
          action: "create",
          family_id: "family-1",
          thread_id: "thread-direct-jessica",
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
        "guardian-token",
      ),
    );

    expect(verifyResponse.status).toBe(403);
    await expect(verifyResponse.json()).resolves.toMatchObject({
      error: "You are not authorized to access that direct thread.",
      success: false,
    });
  });

  it("stores each evidence artifact under a unique append-only path", async () => {
    const firstCreate = await handler(
      buildRequest(
        {
          action: "create",
          family_id: "family-1",
          thread_id: "thread-direct-jessica",
        },
        "parent-token",
      ),
    );
    expect(firstCreate.status).toBe(200);

    const secondCreate = await handler(
      buildRequest(
        {
          action: "create",
          family_id: "family-1",
          thread_id: "thread-direct-jessica",
        },
        "parent-token",
      ),
    );
    expect(secondCreate.status).toBe(200);

    const pdfUploadPaths = state.s3Uploads
      .filter((upload) => upload.contentType === "application/pdf")
      .map((upload) => upload.key);
    const jsonUploadPaths = state.s3Uploads
      .filter((upload) => upload.contentType === "application/json; charset=utf-8")
      .map((upload) => upload.key);

    expect(new Set(pdfUploadPaths).size).toBe(2);
    expect(new Set(jsonUploadPaths).size).toBe(2);
    expect(state.s3Uploads.every((upload) => upload.versionId.startsWith("version-"))).toBe(true);
  });
});
