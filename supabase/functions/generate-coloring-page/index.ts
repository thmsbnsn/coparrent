import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiGuard, getPlanLimits, validateInputLength } from "../_shared/aiGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limit: 20 coloring pages per day per user
const COLORING_PAGE_DAILY_LIMIT = 20;
type SupabaseServiceClient = ReturnType<typeof createClient>;

// Difficulty settings for system prompts
const DIFFICULTY_PROMPTS: Record<string, string> = {
  simple: "Create a very simple coloring page suitable for ages 3-5. Use thick, bold outlines with minimal detail. Large, simple shapes that are easy for young children to color within the lines. No complex patterns or small details.",
  medium: "Create a medium-complexity coloring page suitable for ages 5-8. Use clear outlines with moderate detail. Include some patterns and textures but keep elements distinct and colorable.",
  detailed: "Create a detailed coloring page suitable for ages 8 and up. Include intricate patterns, fine details, and complex designs. Can include mandalas, zentangle patterns, or highly detailed scenes.",
};

interface GenerateRequest {
  prompt: string;
  difficulty: "simple" | "medium" | "detailed";
}

/**
 * Check and increment coloring page usage quota
 */
async function checkColoringPageRateLimit(
  supabase: SupabaseServiceClient,
  userId: string
): Promise<{ allowed: boolean; remaining: number; error?: string }> {
  const today = new Date().toISOString().split("T")[0];
  const functionName = "generate-coloring-page";

  try {
    const { data: existingUsage, error: fetchError } = await supabase
      .from("function_usage_daily")
      .select("id, request_count")
      .eq("user_id", userId)
      .eq("function_name", functionName)
      .eq("usage_date", today)
      .maybeSingle();

    if (fetchError) {
      console.error("[COLORING-PAGE] Rate limit fetch error");
      return { allowed: true, remaining: COLORING_PAGE_DAILY_LIMIT };
    }

    let currentCount = 0;

    if (existingUsage) {
      currentCount = existingUsage.request_count;

      if (currentCount >= COLORING_PAGE_DAILY_LIMIT) {
        return {
          allowed: false,
          remaining: 0,
          error: "Daily coloring page limit reached. Try again tomorrow.",
        };
      }

      await supabase
        .from("function_usage_daily")
        .update({
          request_count: currentCount + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingUsage.id);

      return { allowed: true, remaining: COLORING_PAGE_DAILY_LIMIT - currentCount - 1 };
    }

    const { error: insertError } = await supabase
      .from("function_usage_daily")
      .insert({
        user_id: userId,
        function_name: functionName,
        usage_date: today,
        request_count: 1,
      });

    if (insertError && insertError.code === "23505") {
      const { data: retryData } = await supabase
        .from("function_usage_daily")
        .select("id, request_count")
        .eq("user_id", userId)
        .eq("function_name", functionName)
        .eq("usage_date", today)
        .single();

      if (retryData && retryData.request_count >= COLORING_PAGE_DAILY_LIMIT) {
        return {
          allowed: false,
          remaining: 0,
          error: "Daily coloring page limit reached. Try again tomorrow.",
        };
      }

      if (retryData) {
        await supabase
          .from("function_usage_daily")
          .update({
            request_count: retryData.request_count + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", retryData.id);

        return { allowed: true, remaining: COLORING_PAGE_DAILY_LIMIT - retryData.request_count - 1 };
      }
    }

    return { allowed: true, remaining: COLORING_PAGE_DAILY_LIMIT - 1 };
  } catch (error) {
    console.error("[COLORING-PAGE] Unexpected rate limit error");
    return { allowed: true, remaining: COLORING_PAGE_DAILY_LIMIT };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Use aiGuard for auth, role, and plan enforcement
    // Requires parent role and premium access
    const guardResult = await aiGuard(req, "analyze", supabaseUrl, supabaseServiceKey);

    if (!guardResult.allowed) {
      const statusCode = guardResult.statusCode || 403;
      return new Response(
        JSON.stringify({
          ok: false,
          code: guardResult.error?.code || "FORBIDDEN",
          message: guardResult.error?.error || "Access denied",
        }),
        { status: statusCode, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userContext = guardResult.userContext!;
    const userId = userContext.userId;

    // Create service client
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Check rate limit
    const rateLimit = await checkColoringPageRateLimit(serviceClient, userId);
    if (!rateLimit.allowed) {
      console.log(`[COLORING-PAGE] Rate limited user=${userId.slice(0, 8)}...`);
      return new Response(
        JSON.stringify({
          ok: false,
          code: "RATE_LIMITED",
          message: rateLimit.error || "Daily coloring page limit reached. Try again tomorrow.",
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request
    const body: GenerateRequest = await req.json();
    const { prompt, difficulty } = body;

    if (!prompt || !difficulty) {
      return new Response(
        JSON.stringify({ ok: false, code: "INVALID_REQUEST", message: "Missing prompt or difficulty" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate difficulty
    if (!["simple", "medium", "detailed"].includes(difficulty)) {
      return new Response(
        JSON.stringify({ ok: false, code: "INVALID_REQUEST", message: "Invalid difficulty level" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate input length
    const inputValidation = validateInputLength(prompt, userContext);
    if (!inputValidation.valid) {
      return new Response(
        JSON.stringify({
          ok: false,
          code: inputValidation.error?.code || "INPUT_TOO_LONG",
          message: inputValidation.error?.error || "Prompt too long",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Safe log - only metadata
    console.log(`[COLORING-PAGE] Generating user=${userId.slice(0, 8)}... difficulty=${difficulty} remaining=${rateLimit.remaining}`);

    // Build the image generation prompt
    const difficultyPrompt = DIFFICULTY_PROMPTS[difficulty];
    const fullPrompt = `${difficultyPrompt}

Subject: ${prompt}

Style requirements:
- Black and white line art only (no grayscale, no colors, no shading)
- High contrast with pure white background
- Clean, crisp outlines suitable for printing
- Designed as a printable coloring page
- No text or watermarks
- Centered composition with good margins
- Professional coloring book quality`;

    // Call OpenRouter for image generation
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) {
      throw new Error("AI service is not configured");
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://coparrent.app",
        "X-Title": "CoParrent Coloring Pages",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: fullPrompt
          }
        ],
        modalities: ["image", "text"]
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({
            ok: false,
            code: "AI_RATE_LIMIT",
            message: "Please wait a moment before generating another page.",
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error(`[COLORING-PAGE] OpenRouter error status=${response.status}`);
      throw new Error("AI service temporarily unavailable");
    }

    const data = await response.json();
    const firstImage = data.choices?.[0]?.message?.images?.[0];
    const imageUrl = firstImage?.image_url?.url ?? firstImage?.imageUrl?.url;

    if (!imageUrl) {
      console.error("[COLORING-PAGE] No image in response");
      throw new Error("Failed to generate coloring page");
    }

    // Store metadata in coloring_pages table
    const { data: coloringPage, error: insertError } = await serviceClient
      .from("coloring_pages")
      .insert({
        user_id: userId,
        prompt,
        difficulty,
        image_url: imageUrl,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[COLORING-PAGE] Failed to save metadata");
      // Continue anyway - user still gets the image
    }

    console.log(`[COLORING-PAGE] Generated successfully id=${coloringPage?.id?.slice(0, 8) || 'unknown'}...`);

    return new Response(
      JSON.stringify({
        ok: true,
        imageUrl,
        coloringPageId: coloringPage?.id,
        remaining: rateLimit.remaining,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[COLORING-PAGE] Error:", error instanceof Error ? error.message : "Unknown error");
    return new Response(
      JSON.stringify({
        ok: false,
        code: "INTERNAL_ERROR",
        message: "Failed to generate coloring page. Please try again.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
