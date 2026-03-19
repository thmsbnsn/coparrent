import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface RateLimitConfig {
  maxPerDay: number;
  maxPerMinute: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  error?: { error: string; code: string };
  statusCode?: number;
}

// Rate limit configurations per function
const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  "send-coparent-invite": { maxPerDay: 20, maxPerMinute: 5 },
  "send-third-party-invite": { maxPerDay: 20, maxPerMinute: 5 },
  "send-notification": { maxPerDay: 100, maxPerMinute: 20 },
  "login-notification": { maxPerDay: 50, maxPerMinute: 10 },
  default: { maxPerDay: 100, maxPerMinute: 30 },
};

/**
 * Check and increment function usage quota for a user
 */
export async function checkFunctionRateLimit(
  supabaseUrl: string,
  supabaseServiceKey: string,
  userId: string,
  functionName: string
): Promise<RateLimitResult> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const config = RATE_LIMIT_CONFIGS[functionName] || RATE_LIMIT_CONFIGS.default;
  const today = new Date().toISOString().split("T")[0];
  const currentMinute = new Date();
  currentMinute.setSeconds(0, 0);

  try {
    // Get existing usage record
    const { data: existingUsage, error: fetchError } = await supabase
      .from("function_usage_daily")
      .select("id, request_count, minute_window, minute_count")
      .eq("user_id", userId)
      .eq("function_name", functionName)
      .eq("usage_date", today)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching function usage:", fetchError);
      // Fail open
      return { allowed: true, remaining: config.maxPerDay, limit: config.maxPerDay };
    }

    if (existingUsage) {
      // Check daily limit
      if (existingUsage.request_count >= config.maxPerDay) {
        return {
          allowed: false,
          remaining: 0,
          limit: config.maxPerDay,
          error: {
            error: `Daily limit (${config.maxPerDay}) exceeded for ${functionName}. Resets at midnight UTC.`,
            code: "RATE_LIMIT",
          },
          statusCode: 429,
        };
      }

      // Check minute burst limit
      const existingMinuteWindow = new Date(existingUsage.minute_window);
      const isCurrentMinute = existingMinuteWindow.getTime() === currentMinute.getTime();

      if (isCurrentMinute && existingUsage.minute_count >= config.maxPerMinute) {
        return {
          allowed: false,
          remaining: config.maxPerDay - existingUsage.request_count,
          limit: config.maxPerDay,
          error: {
            error: `Rate limit exceeded. Please wait a moment before trying again.`,
            code: "RATE_LIMIT",
          },
          statusCode: 429,
        };
      }

      // Update existing record
      const newMinuteCount = isCurrentMinute ? existingUsage.minute_count + 1 : 1;
      const { error: updateError } = await supabase
        .from("function_usage_daily")
        .update({
          request_count: existingUsage.request_count + 1,
          minute_window: currentMinute.toISOString(),
          minute_count: newMinuteCount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingUsage.id);

      if (updateError) {
        console.error("Error updating function usage:", updateError);
      }

      return {
        allowed: true,
        remaining: config.maxPerDay - existingUsage.request_count - 1,
        limit: config.maxPerDay,
      };
    }

    // Create new usage record
    const { error: insertError } = await supabase
      .from("function_usage_daily")
      .insert({
        user_id: userId,
        function_name: functionName,
        usage_date: today,
        request_count: 1,
        minute_window: currentMinute.toISOString(),
        minute_count: 1,
      });

    if (insertError) {
      // Handle race condition
      if (insertError.code === "23505") {
        // Retry with update
        const { data: retryData } = await supabase
          .from("function_usage_daily")
          .select("id, request_count")
          .eq("user_id", userId)
          .eq("function_name", functionName)
          .eq("usage_date", today)
          .single();

        if (retryData && retryData.request_count >= config.maxPerDay) {
          return {
            allowed: false,
            remaining: 0,
            limit: config.maxPerDay,
            error: {
              error: `Daily limit (${config.maxPerDay}) exceeded. Resets at midnight UTC.`,
              code: "RATE_LIMIT",
            },
            statusCode: 429,
          };
        }
      }
      console.error("Error inserting function usage:", insertError);
    }

    return {
      allowed: true,
      remaining: config.maxPerDay - 1,
      limit: config.maxPerDay,
    };
  } catch (error) {
    console.error("Unexpected error in function rate limiting:", error);
    // Fail open
    return { allowed: true, remaining: config.maxPerDay, limit: config.maxPerDay };
  }
}

/**
 * Create a rate limit response
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify(result.error),
    {
      status: result.statusCode || 429,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    }
  );
}
