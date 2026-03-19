import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPlanLimits } from "./aiGuard.ts";
import type { UserContext } from "./aiGuard.ts";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  error?: { error: string; code: string };
  statusCode?: number;
}

/**
 * Check and increment AI usage quota for a user
 * Uses the ai_usage_daily table to track daily usage
 */
export async function checkAndIncrementQuota(
  supabaseUrl: string,
  supabaseServiceKey: string,
  userContext: { userId: string; planTier: string }
): Promise<RateLimitResult> {
  // Create service role client for direct table access
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
  const limits = getPlanLimits(userContext as UserContext);
  const maxCalls = limits.maxCallsPerDay;

  try {
    // Try to get existing usage record for today
    const { data: existingUsage, error: fetchError } = await supabase
      .from("ai_usage_daily")
      .select("id, request_count")
      .eq("user_id", userContext.userId)
      .eq("usage_date", today)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching AI usage:", fetchError);
      // Fail open but log the error - don't block users due to DB issues
      return { allowed: true, remaining: maxCalls, limit: maxCalls };
    }

    let currentCount = 0;

    if (existingUsage) {
      currentCount = existingUsage.request_count;

      // Check if already at limit
      if (currentCount >= maxCalls) {
        return {
          allowed: false,
          remaining: 0,
          limit: maxCalls,
          error: {
            error: `Daily AI request limit (${maxCalls}) exceeded. Resets at midnight UTC.`,
            code: "RATE_LIMIT_EXCEEDED",
          },
          statusCode: 429,
        };
      }

      // Increment existing record
      const { error: updateError } = await supabase
        .from("ai_usage_daily")
        .update({ 
          request_count: currentCount + 1,
          updated_at: new Date().toISOString()
        })
        .eq("id", existingUsage.id);

      if (updateError) {
        console.error("Error updating AI usage:", updateError);
        // Fail open
        return { allowed: true, remaining: maxCalls - currentCount - 1, limit: maxCalls };
      }

      return {
        allowed: true,
        remaining: maxCalls - currentCount - 1,
        limit: maxCalls,
      };
    }

    // Create new usage record for today
    const { error: insertError } = await supabase
      .from("ai_usage_daily")
      .insert({
        user_id: userContext.userId,
        usage_date: today,
        request_count: 1,
      });

    if (insertError) {
      // Handle race condition - another request may have created the record
      if (insertError.code === "23505") { // Unique violation
        // Retry with update
        const { data: retryData, error: retryFetchError } = await supabase
          .from("ai_usage_daily")
          .select("id, request_count")
          .eq("user_id", userContext.userId)
          .eq("usage_date", today)
          .single();

        if (retryFetchError || !retryData) {
          console.error("Error in retry fetch:", retryFetchError);
          return { allowed: true, remaining: maxCalls - 1, limit: maxCalls };
        }

        if (retryData.request_count >= maxCalls) {
          return {
            allowed: false,
            remaining: 0,
            limit: maxCalls,
            error: {
              error: `Daily AI request limit (${maxCalls}) exceeded. Resets at midnight UTC.`,
              code: "RATE_LIMIT_EXCEEDED",
            },
            statusCode: 429,
          };
        }

        await supabase
          .from("ai_usage_daily")
          .update({ 
            request_count: retryData.request_count + 1,
            updated_at: new Date().toISOString()
          })
          .eq("id", retryData.id);

        return {
          allowed: true,
          remaining: maxCalls - retryData.request_count - 1,
          limit: maxCalls,
        };
      }

      console.error("Error inserting AI usage:", insertError);
      // Fail open
      return { allowed: true, remaining: maxCalls - 1, limit: maxCalls };
    }

    return {
      allowed: true,
      remaining: maxCalls - 1,
      limit: maxCalls,
    };
  } catch (error) {
    console.error("Unexpected error in rate limiting:", error);
    // Fail open to avoid blocking users
    return { allowed: true, remaining: maxCalls, limit: maxCalls };
  }
}

/**
 * Get current usage stats for a user (for display purposes)
 */
export async function getUsageStats(
  supabaseUrl: string,
  supabaseServiceKey: string,
  userId: string,
  planTier: string
): Promise<{ used: number; limit: number; remaining: number }> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });

  const today = new Date().toISOString().split("T")[0];
  const limits = getPlanLimits({ planTier } as UserContext);
  const maxCalls = limits.maxCallsPerDay;

  try {
    const { data, error } = await supabase
      .from("ai_usage_daily")
      .select("request_count")
      .eq("user_id", userId)
      .eq("usage_date", today)
      .maybeSingle();

    if (error || !data) {
      return { used: 0, limit: maxCalls, remaining: maxCalls };
    }

    return {
      used: data.request_count,
      limit: maxCalls,
      remaining: Math.max(0, maxCalls - data.request_count),
    };
  } catch {
    return { used: 0, limit: maxCalls, remaining: maxCalls };
  }
}
