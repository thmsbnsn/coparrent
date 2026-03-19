import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiGuard, getPlanLimits } from "../_shared/aiGuard.ts";
import { checkAndIncrementQuota } from "../_shared/aiRateLimit.ts";
import { strictCors, getCorsHeaders } from "../_shared/aiCors.ts";
import { parseAIJsonResponse, createFallbackScheduleSuggestion } from "../_shared/aiSchemas.ts";

interface SuggestionRequest {
  childrenInfo: { count: number; ages: number[] };
  isHighConflict: boolean;
  preferences: string;
  state: string;
}

interface PatternSuggestion {
  id: string;
  name: string;
  description: string;
  pros: string[];
  cons: string[];
  visual: string[];
  holidayTips: string;
  exchangeTips: string;
  startingParent: "A" | "B";
}

interface AIResponse {
  suggestions: PatternSuggestion[];
}

/**
 * Validate a single suggestion has all required fields with correct types
 */
function validateSuggestion(s: unknown, index: number): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const prefix = `suggestion[${index}]`;

  if (!s || typeof s !== "object") {
    return { valid: false, errors: [`${prefix}: expected object`] };
  }

  const obj = s as Record<string, unknown>;

  // Required string fields
  const requiredStrings = ["id", "name", "description", "holidayTips", "exchangeTips"];
  for (const field of requiredStrings) {
    if (typeof obj[field] !== "string") {
      errors.push(`${prefix}.${field}: expected string`);
    }
  }

  // Required array fields
  if (!Array.isArray(obj.pros)) {
    errors.push(`${prefix}.pros: expected array`);
  }
  if (!Array.isArray(obj.cons)) {
    errors.push(`${prefix}.cons: expected array`);
  }

  // Visual must be array of exactly 14 items
  if (!Array.isArray(obj.visual)) {
    errors.push(`${prefix}.visual: expected array`);
  } else if (obj.visual.length !== 14) {
    errors.push(`${prefix}.visual: expected 14 items, got ${obj.visual.length}`);
  } else {
    const invalidItems = obj.visual.filter((v) => v !== "A" && v !== "B");
    if (invalidItems.length > 0) {
      errors.push(`${prefix}.visual: all items must be "A" or "B"`);
    }
  }

  // startingParent must be "A" or "B"
  if (obj.startingParent !== "A" && obj.startingParent !== "B") {
    errors.push(`${prefix}.startingParent: expected "A" or "B"`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate and sanitize the full AI response
 */
function validateAIResponse(data: unknown): { valid: boolean; data?: PatternSuggestion[]; errors: string[] } {
  const allErrors: string[] = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Response is not an object"] };
  }

  const obj = data as Record<string, unknown>;
  const suggestions = obj.suggestions;

  if (!Array.isArray(suggestions)) {
    return { valid: false, errors: ["suggestions is not an array"] };
  }

  if (suggestions.length === 0) {
    return { valid: false, errors: ["suggestions array is empty"] };
  }

  const validatedSuggestions: PatternSuggestion[] = [];

  for (let i = 0; i < suggestions.length; i++) {
    const result = validateSuggestion(suggestions[i], i);
    if (!result.valid) {
      allErrors.push(...result.errors);
    } else {
      // Sanitize and cast to proper type
      const s = suggestions[i] as Record<string, unknown>;
      validatedSuggestions.push({
        id: String(s.id),
        name: String(s.name),
        description: String(s.description),
        pros: (s.pros as unknown[]).map(String),
        cons: (s.cons as unknown[]).map(String),
        visual: (s.visual as string[]),
        holidayTips: String(s.holidayTips),
        exchangeTips: String(s.exchangeTips),
        startingParent: s.startingParent as "A" | "B",
      });
    }
  }

  if (allErrors.length > 0) {
    return { valid: false, errors: allErrors };
  }

  return { valid: true, data: validatedSuggestions, errors: [] };
}

/**
 * Attempt to repair malformed AI response with a retry
 */
async function attemptRepairRetry(
  originalContent: string,
  apiKey: string
): Promise<PatternSuggestion[] | null> {
  console.log("[AI-SCHEDULE-SUGGEST] Attempting repair retry for malformed response");

  const repairPrompt = `The following JSON response has validation errors. Please fix it to match this exact structure:
{
  "suggestions": [
    {
      "id": "kebab-case-id",
      "name": "Pattern Name",
      "description": "Description",
      "pros": ["benefit1", "benefit2"],
      "cons": ["drawback1"],
      "visual": ["A","A","A","A","A","A","A","B","B","B","B","B","B","B"],
      "holidayTips": "Holiday advice",
      "exchangeTips": "Exchange advice",
      "startingParent": "A"
    }
  ]
}

Requirements:
- visual MUST be exactly 14 items, each being "A" or "B"
- startingParent MUST be "A" or "B"
- All string fields are required

Original response to fix:
${originalContent}

Return ONLY valid JSON, no explanation.`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://coparrent.app",
        "X-Title": "CoParrent Schedule Wizard",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-exp:free",
        messages: [{ role: "user", content: repairPrompt }],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      console.error("[AI-SCHEDULE-SUGGEST] Repair retry failed:", response.status);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = parseAIJsonResponse<AIResponse>(content);
    if (!parsed) return null;

    const validation = validateAIResponse(parsed);
    if (validation.valid && validation.data) {
      console.log("[AI-SCHEDULE-SUGGEST] Repair retry succeeded");
      return validation.data;
    }

    console.error("[AI-SCHEDULE-SUGGEST] Repair retry validation failed:", validation.errors);
    return null;
  } catch (error) {
    console.error("[AI-SCHEDULE-SUGGEST] Repair retry error:", error);
    return null;
  }
}

serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  // 1. Handle CORS with strict origin checking
  const corsResponse = strictCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    // 2. Validate auth, role, and plan via aiGuard
    const guardResult = await aiGuard(req, "schedule-suggest", supabaseUrl, supabaseServiceKey);

    if (!guardResult.allowed || !guardResult.userContext) {
      console.error("[AI-SCHEDULE-SUGGEST] Guard rejected:", guardResult.error);
      return new Response(JSON.stringify(guardResult.error), {
        status: guardResult.statusCode || 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userContext } = guardResult;
    // Safe logging: only log user ID and plan, no PII
    console.log(`[AI-SCHEDULE-SUGGEST] Authorized: userId=${userContext.userId}, plan=${userContext.planTier}, role=${userContext.role}`);

    // 3. Check and increment rate limit quota
    const quotaResult = await checkAndIncrementQuota(supabaseUrl, supabaseServiceKey, userContext);

    if (!quotaResult.allowed) {
      console.warn(`[AI-SCHEDULE-SUGGEST] Rate limit exceeded: userId=${userContext.userId}`);
      return new Response(JSON.stringify(quotaResult.error), {
        status: quotaResult.statusCode || 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[AI-SCHEDULE-SUGGEST] Quota check passed: ${quotaResult.remaining}/${quotaResult.limit} remaining`);

    // 4. Parse and validate request
    const { childrenInfo, isHighConflict, preferences, state }: SuggestionRequest = await req.json();

    // Safe logging: log structure, not raw preference text
    console.log("[AI-SCHEDULE-SUGGEST] Request:", {
      childCount: childrenInfo?.count,
      ageCount: childrenInfo?.ages?.length,
      isHighConflict,
      hasPreferences: !!preferences && preferences.length > 0,
      preferencesLength: preferences?.length || 0,
      state,
    });

    // 5. Validate input length against plan limits
    const planLimits = getPlanLimits(userContext);
    const inputText = preferences || "";
    if (inputText.length > planLimits.maxInputChars) {
      return new Response(
        JSON.stringify({
          error: `Input exceeds maximum length of ${planLimits.maxInputChars} characters for your plan`,
          code: "INPUT_TOO_LONG",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }

    // 6. Build prompts with reduced legal-risk wording
    const systemPrompt = `You are an informational assistant helping co-parents explore custody schedule options.

IMPORTANT DISCLAIMERS:
- This is NOT legal advice. These are general informational suggestions only.
- Users should consult a licensed family law attorney for guidance specific to their state and situation.
- Custody arrangements should always prioritize the best interests of the children.
- Court-approved parenting plans may have specific requirements that override general patterns.

You MUST respond with valid JSON only - no markdown, no explanation text outside the JSON.
Focus on practical, child-centered scheduling patterns based on developmental research.`;

    const userPrompt = `Based on the following information, suggest 2-3 custody schedule patterns:

**Children:** ${childrenInfo.count} child(ren), ages: ${childrenInfo.ages.length > 0 ? childrenInfo.ages.join(", ") : "not specified"}
**Conflict Level:** ${isHighConflict ? "High-conflict situation - minimize direct exchanges and communication friction" : "Standard co-parenting relationship"}
**State:** ${state || "Not specified"} (Note: Consult an attorney for state-specific requirements)
**Parent Preferences:** ${preferences ? "Preferences provided" : "No specific preferences mentioned"}

Respond with a JSON object containing a "suggestions" array with 2-3 pattern objects. Each pattern must have:
- "id": a unique kebab-case identifier (e.g., "alternating-weeks", "2-2-3", "5-2-2-5")
- "name": human-readable name
- "description": 1-2 sentence explanation of how it works
- "pros": array of 2-3 benefits for this specific situation
- "cons": array of 1-2 potential drawbacks to consider
- "visual": array of exactly 14 characters, each being "A" or "B" representing a 2-week pattern
- "holidayTips": specific advice for handling holidays with this pattern
- "exchangeTips": recommendation for exchange timing and location
- "startingParent": "A" or "B" - which parent should start

Consider the children's ages when making recommendations:
- Infants/toddlers (0-3): shorter periods away from primary caregiver
- Preschool (3-5): can handle longer periods but need consistency
- School-age (6-12): can adapt to various patterns, school schedule matters
- Teenagers (13+): more flexible, may want input on schedule

For high-conflict situations, prefer patterns that:
- Minimize exchanges
- Use neutral exchange locations (school, etc.)
- Reduce direct parent-to-parent contact

Respond ONLY with the JSON object, no other text.`;

    // 7. Call AI with tighter model settings
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://coparrent.app",
        "X-Title": "CoParrent Schedule Wizard",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-exp:free",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3, // Lowered for more consistent output
        max_tokens: Math.min(1000, planLimits.maxTokens), // Reduced token limit
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[AI-SCHEDULE-SUGGEST] OpenRouter API error:", response.status, errorText);
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("[AI-SCHEDULE-SUGGEST] OpenRouter response received");

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("No content in AI response");
    }

    // 8. Parse and validate with strict schema
    const parsed = parseAIJsonResponse<AIResponse>(content);

    if (!parsed) {
      console.error("[AI-SCHEDULE-SUGGEST] Failed to parse JSON from response");
      // Attempt repair retry
      const repaired = await attemptRepairRetry(content, OPENROUTER_API_KEY);
      if (repaired) {
        return new Response(JSON.stringify({ suggestions: repaired }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Return fallback with 502 error
      const fallback = createFallbackScheduleSuggestion();
      return new Response(
        JSON.stringify({
          error: "AI response was malformed. Showing default suggestions.",
          code: "AI_PARSE_ERROR",
          suggestions: fallback.suggestions,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validation = validateAIResponse(parsed);

    if (!validation.valid || !validation.data) {
      console.error("[AI-SCHEDULE-SUGGEST] Validation failed:", validation.errors);
      // Attempt repair retry
      const repaired = await attemptRepairRetry(content, OPENROUTER_API_KEY);
      if (repaired) {
        return new Response(JSON.stringify({ suggestions: repaired }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Return fallback with 502 error
      const fallback = createFallbackScheduleSuggestion();
      return new Response(
        JSON.stringify({
          error: "AI response validation failed. Showing default suggestions.",
          code: "AI_VALIDATION_ERROR",
          suggestions: fallback.suggestions,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[AI-SCHEDULE-SUGGEST] Success: ${validation.data.length} suggestions generated`);

    return new Response(JSON.stringify({ suggestions: validation.data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[AI-SCHEDULE-SUGGEST] Error:", errorMessage);

    // Return user-safe error
    return new Response(
      JSON.stringify({ error: "Unable to generate schedule suggestions. Please try again.", code: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
