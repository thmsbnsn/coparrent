import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { strictCors, getCorsHeaders } from "../_shared/cors.ts";

const REPAIR_SQL = [
  `
    ALTER TABLE public.invitations
    ADD COLUMN IF NOT EXISTS relationship text,
    ADD COLUMN IF NOT EXISTS child_ids uuid[] DEFAULT '{}'::uuid[];
  `,
  `
    UPDATE public.invitations
    SET child_ids = '{}'::uuid[]
    WHERE child_ids IS NULL;
  `,
];

function jsonResponse(
  body: Record<string, unknown>,
  corsHeaders: Record<string, string>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

serve(async (req) => {
  const corsResponse = strictCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, corsHeaders, 405);
  }

  const repairAdminKey = Deno.env.get("REPAIR_ADMIN_KEY") ?? "";
  const providedRepairKey = req.headers.get("x-repair-key")?.trim() ?? "";

  if (!repairAdminKey || !providedRepairKey || providedRepairKey !== repairAdminKey) {
    return jsonResponse({ success: false, error: "Forbidden" }, corsHeaders, 403);
  }

  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) {
    return jsonResponse({ success: false, error: "SUPABASE_DB_URL is not configured" }, corsHeaders, 500);
  }

  const client = new Client(dbUrl);

  try {
    await client.connect();
    await client.queryArray("BEGIN");

    for (const statement of REPAIR_SQL) {
      await client.queryArray(statement);
    }

    await client.queryArray("COMMIT");

    return jsonResponse(
      {
        success: true,
        statements_applied: REPAIR_SQL.length,
      },
      corsHeaders,
      200,
    );
  } catch (error) {
    try {
      await client.queryArray("ROLLBACK");
    } catch {
      // Ignore rollback failures after the primary error.
    }

    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ success: false, error: message }, corsHeaders, 500);
  } finally {
    await client.end();
  }
});
