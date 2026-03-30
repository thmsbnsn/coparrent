import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, strictCors } from "../_shared/cors.ts";

// App version - keep in sync with frontend
const APP_VERSION = "0.9.0";

Deno.serve(async (req) => {
  const corsResponse = strictCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  const corsHeaders = getCorsHeaders(req);
  const startTime = Date.now();
  
  try {
    // Check Supabase connectivity
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({
          ok: false,
          version: APP_VERSION,
          error: "Configuration error",
          latency_ms: Date.now() - startTime,
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Simple query to verify database connectivity
    const { error: dbError } = await supabase
      .from("profiles")
      .select("id")
      .limit(1)
      .maybeSingle();

    const dbHealthy = !dbError;
    const latencyMs = Date.now() - startTime;

    const healthStatus = {
      ok: dbHealthy,
      version: APP_VERSION,
      environment: getEnvironment(req),
      timestamp: new Date().toISOString(),
      latency_ms: latencyMs,
      services: {
        database: dbHealthy ? "healthy" : "degraded",
        api: "healthy",
      },
    };

    return new Response(JSON.stringify(healthStatus), {
      status: dbHealthy ? 200 : 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Health check failed:", error);
    
    return new Response(
      JSON.stringify({
        ok: false,
        version: APP_VERSION,
        error: "Health check failed",
        latency_ms: Date.now() - startTime,
      }),
      {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function getEnvironment(req: Request): string {
  const host = (req.headers.get("host") || "").toLowerCase();
  if (
    host.includes("coparrent.com") ||
    host.includes("coparrent.vercel.app")
  ) {
    return "production";
  }
  if (host.includes("preview") || host.includes(".vercel.app")) {
    return "staging";
  }
  return "development";
}
