// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetCreateClientImplementation, __setCreateClientImplementation } from "./test-shims/supabaseEdge";

interface RpcResult {
  code: string;
  data?: Record<string, unknown>;
  message: string;
  ok: boolean;
}

interface TestState {
  authError: Error | null;
  authUser: { id: string } | null;
  rpcCalls: Array<{ args: Record<string, unknown>; fn: string }>;
  rpcError: Error | null;
  rpcResult: RpcResult | null;
}

class MockSupabaseClient {
  constructor(private readonly state: TestState) {}

  auth = {
    getUser: async () => ({
      data: { user: this.state.authUser },
      error: this.state.authError,
    }),
  };

  rpc = async (fn: string, args: Record<string, unknown>) => {
    this.state.rpcCalls.push({ args, fn });

    return {
      data: this.state.rpcResult,
      error: this.state.rpcError,
    };
  };
}

const envValues: Record<string, string | undefined> = {
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_URL: "https://example.supabase.co",
};

const buildState = (): TestState => ({
  authError: null,
  authUser: { id: "user-1" },
  rpcCalls: [],
  rpcError: null,
  rpcResult: {
    code: "REDEEMED",
    data: {
      access_reason: "phase_1_access",
      label: "Pilot Access",
      tier: "power",
    },
    message: "Power access is now active on your account.",
    ok: true,
  },
});

const buildRequest = (code: string) =>
  new Request("https://example.functions.supabase.co/redeem-access-code", {
    body: JSON.stringify({ code }),
    headers: {
      Authorization: "Bearer valid-token",
      "Content-Type": "application/json",
    },
    method: "POST",
  });

describe("redeem-access-code", () => {
  let handler: (req: Request) => Promise<Response> | Response;
  let state: TestState;

  beforeAll(async () => {
    vi.stubGlobal("Deno", {
      env: {
        get: (key: string) => envValues[key],
      },
    });

    const serverShim = await import("./test-shims/denoHttpServer");
    serverShim.__resetServedHandler();

    await import("../redeem-access-code/index.ts");
    handler = serverShim.__getServedHandler();
  });

  beforeEach(() => {
    state = buildState();
    __resetCreateClientImplementation();
    __setCreateClientImplementation(() => new MockSupabaseClient(state));
  });

  it("redeems a valid code and normalizes input before the RPC call", async () => {
    const response = await handler(buildRequest(" cpr-abcd-1234 "));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      code: "REDEEMED",
      data: {
        label: "Pilot Access",
        tier: "power",
      },
      ok: true,
    });
    expect(state.rpcCalls).toEqual([
      {
        args: { p_code: "CPR-ABCD-1234" },
        fn: "rpc_redeem_access_code",
      },
    ]);
  });

  it("returns the already-redeemed result without mutating the response shape", async () => {
    state.rpcResult = {
      code: "ALREADY_REDEEMED",
      data: {
        access_reason: "phase_1_access",
        tier: "power",
      },
      message: "This code has already been redeemed on your account.",
      ok: true,
    };

    const response = await handler(buildRequest("CPR-REUSE-0001"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      code: "ALREADY_REDEEMED",
      ok: true,
    });
    expect(state.rpcCalls).toHaveLength(1);
  });

  it.each([
    ["INVALID_CODE", "That access code is not valid."],
    ["EXPIRED_CODE", "That access code has expired."],
    ["CODE_EXHAUSTED", "That access code has reached its redemption limit."],
    ["INACTIVE_CODE", "That access code is no longer active."],
  ])("returns %s failures from the server-side RPC", async (code, message) => {
    state.rpcResult = {
      code,
      message,
      ok: false,
    };

    const response = await handler(buildRequest("CPR-FAIL-0001"));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      code,
      message,
      ok: false,
    });
    expect(state.rpcCalls).toHaveLength(1);
  });
});
