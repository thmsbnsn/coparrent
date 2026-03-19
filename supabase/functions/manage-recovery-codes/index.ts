import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { strictCors, getCorsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[RECOVERY-CODES] ${step}${detailsStr}`);
};

// Generate recovery codes
function generateRecoveryCodes(): string[] {
  const codes: string[] = [];
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  
  for (let i = 0; i < 10; i++) {
    let code = "";
    for (let j = 0; j < 8; j++) {
      if (j === 4) code += "-";
      const randomBytes = new Uint8Array(1);
      crypto.getRandomValues(randomBytes);
      code += chars[randomBytes[0] % chars.length];
    }
    codes.push(code);
  }
  return codes;
}

// Hash a recovery code using SHA-256
async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code.replace(/-/g, "").toUpperCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  const corsResponse = strictCors(req);
  if (corsResponse) return corsResponse;
  
  const corsHeaders = getCorsHeaders(req);

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Authentication failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const userId = userData.user.id;
    logStep("User authenticated", { userId });

    const { action } = await req.json();

    switch (action) {
      case "generate": {
        logStep("Generating new recovery codes");
        
        // Delete existing unused codes
        await supabaseClient
          .from("user_recovery_codes")
          .delete()
          .eq("user_id", userId);

        // Generate new codes
        const codes = generateRecoveryCodes();
        const hashedCodes = await Promise.all(
          codes.map(async (code) => ({
            user_id: userId,
            code_hash: await hashCode(code),
          }))
        );

        // Store hashed codes
        const { error: insertError } = await supabaseClient
          .from("user_recovery_codes")
          .insert(hashedCodes);

        if (insertError) {
          logStep("ERROR: Failed to store codes", { error: insertError.message });
          throw insertError;
        }

        // Update 2FA settings
        await supabaseClient
          .from("user_2fa_settings")
          .upsert({
            user_id: userId,
            recovery_codes_generated_at: new Date().toISOString(),
            recovery_codes_remaining: 10,
          }, { onConflict: "user_id" });

        logStep("Recovery codes generated successfully");

        return new Response(
          JSON.stringify({ codes, remaining: 10 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      case "verify": {
        const { code } = await req.json();
        if (!code) {
          return new Response(
            JSON.stringify({ error: "Recovery code required" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
          );
        }

        logStep("Verifying recovery code");
        const codeHash = await hashCode(code);

        // Find matching unused code
        const { data: matchingCode, error: findError } = await supabaseClient
          .from("user_recovery_codes")
          .select("id")
          .eq("user_id", userId)
          .eq("code_hash", codeHash)
          .is("used_at", null)
          .maybeSingle();

        if (findError || !matchingCode) {
          logStep("Recovery code not found or already used");
          return new Response(
            JSON.stringify({ valid: false, error: "Invalid or already used recovery code" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
          );
        }

        // Mark code as used
        await supabaseClient
          .from("user_recovery_codes")
          .update({ used_at: new Date().toISOString() })
          .eq("id", matchingCode.id);

        // Update remaining count
        const { count } = await supabaseClient
          .from("user_recovery_codes")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .is("used_at", null);

        await supabaseClient
          .from("user_2fa_settings")
          .update({ recovery_codes_remaining: count || 0 })
          .eq("user_id", userId);

        logStep("Recovery code verified successfully", { remaining: count });

        return new Response(
          JSON.stringify({ valid: true, remaining: count }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      case "status": {
        logStep("Checking recovery code status");

        const { data: settings } = await supabaseClient
          .from("user_2fa_settings")
          .select("recovery_codes_generated_at, recovery_codes_remaining, is_enabled")
          .eq("user_id", userId)
          .maybeSingle();

        const { count } = await supabaseClient
          .from("user_recovery_codes")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .is("used_at", null);

        return new Response(
          JSON.stringify({
            hasGeneratedCodes: !!settings?.recovery_codes_generated_at,
            remaining: count || 0,
            generatedAt: settings?.recovery_codes_generated_at,
            isEnabled: settings?.is_enabled || false,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      case "update_2fa_status": {
        const body = await req.json();
        const { isEnabled } = body;
        
        logStep("Updating 2FA status", { isEnabled });

        await supabaseClient
          .from("user_2fa_settings")
          .upsert({
            user_id: userId,
            is_enabled: isEnabled,
            enabled_at: isEnabled ? new Date().toISOString() : null,
            last_verified_at: isEnabled ? new Date().toISOString() : null,
          }, { onConflict: "user_id" });

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    
    return new Response(
      JSON.stringify({ error: "An error occurred" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
