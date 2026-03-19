import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { strictCors, getCorsHeaders } from "../_shared/cors.ts";

const RedeemRequestSchema = z.object({
  code: z.string().min(4, "Access code is too short").max(128, "Access code is too long"),
});

const handler = async (req: Request): Promise<Response> => {
  const corsResponse = strictCors(req);
  if (corsResponse) return corsResponse;
  const corsHeaders = getCorsHeaders(req);

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, code: "METHOD_NOT_ALLOWED", message: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !anonKey) {
    return new Response(
      JSON.stringify({ ok: false, code: "SERVICE_UNAVAILABLE", message: "Service unavailable" }),
      { status: 503, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ ok: false, code: "AUTH_REQUIRED", message: "Authentication required" }),
      { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser();

  if (authError || !authData.user) {
    return new Response(
      JSON.stringify({ ok: false, code: "AUTH_FAILED", message: "Authentication failed" }),
      { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, code: "INVALID_REQUEST", message: "Invalid request payload" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }

  const parseResult = RedeemRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return new Response(
      JSON.stringify({ ok: false, code: "INVALID_CODE", message: "Please enter a valid access code" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }

  const code = parseResult.data.code.trim().toUpperCase();
  const { data: rpcResult, error: redeemError } = await authClient.rpc("rpc_redeem_access_code", {
    p_code: code,
  });

  if (redeemError) {
    console.error("[REDEEM-ACCESS-CODE] RPC error:", redeemError.message);
    return new Response(
      JSON.stringify({ ok: false, code: "REDEEM_FAILED", message: "Unable to redeem access code" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }

  const result = rpcResult as { ok?: boolean; code?: string; message?: string; data?: unknown };
  const statusCode = result.ok ? 200 : 400;

  return new Response(JSON.stringify(result), {
    status: statusCode,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
};

serve(handler);
