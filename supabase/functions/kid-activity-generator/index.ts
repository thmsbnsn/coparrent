import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiGuard } from "../_shared/aiGuard.ts";
import { strictCors, getCorsHeaders } from "../_shared/aiCors.ts";

interface ActivityRequest {
  type: "activity" | "recipe" | "craft";
  prompt?: string;
  childAge?: number;
  childName?: string;
  duration?: string; // "15min", "30min", "1hour", "2hours"
  location?: "indoor" | "outdoor" | "both";
  energyLevel?: "calm" | "moderate" | "high";
  materials?: string[];
  dietary?: string[]; // For recipes: allergies, preferences
}

const SYSTEM_PROMPTS: Record<string, string> = {
  activity: `You are a child activity expert. Generate fun, age-appropriate activities for children.

Your response MUST be valid JSON with this exact structure:
{
  "title": "Activity Name",
  "age_range": "3-5 years",
  "duration_minutes": 30,
  "indoor_outdoor": "indoor",
  "energy_level": "moderate",
  "mess_level": "low",
  "supervision_level": "medium",
  "materials": ["item1", "item2"],
  "steps": ["Step 1", "Step 2", "Step 3"],
  "variations": {
    "easier": "Make it easier by...",
    "harder": "Make it harder by..."
  },
  "learning_goals": ["motor skills", "creativity"],
  "safety_notes": "Adult supervision required"
}

Return ONLY valid JSON, no markdown or explanation.`,

  recipe: `You are a kid-friendly cooking expert. Generate simple, safe recipes that children can help prepare.

Your response MUST be valid JSON with this exact structure:
{
  "title": "Recipe Name",
  "description": "Brief description",
  "ageRange": "5-8 years",
  "prepTime": "15 minutes",
  "cookTime": "10 minutes",
  "servings": 4,
  "ingredients": [{"item": "flour", "amount": "1 cup"}],
  "instructions": ["Step 1", "Step 2"],
  "kidTasks": ["Measuring ingredients", "Stirring"],
  "adultTasks": ["Using the oven", "Cutting with sharp knives"],
  "nutritionNotes": "High in protein",
  "tips": ["Make it fun by..."]
}

Return ONLY valid JSON, no markdown or explanation.`,

  craft: `You are an arts and crafts expert for children. Generate creative, age-appropriate craft projects.

Your response MUST be valid JSON with this exact structure:
{
  "title": "Craft Project Name",
  "description": "Brief description",
  "ageRange": "4-7 years",
  "duration": "45 minutes",
  "materials": [{"item": "colored paper", "quantity": "5 sheets", "substitute": "newspaper"}],
  "steps": [{"step": 1, "instruction": "Cut the paper", "tip": "Safety scissors work great"}],
  "skillsLearned": ["cutting", "gluing", "creativity"],
  "messLevel": "medium",
  "displayIdeas": ["Hang on refrigerator", "Frame it"]
}

Return ONLY valid JSON, no markdown or explanation.`
};

function toStringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry === "string") {
        return entry.trim();
      }

      if (entry && typeof entry === "object") {
        const record = entry as Record<string, unknown>;

        for (const key of ["instruction", "item", "name", "title", "quantity", "amount"]) {
          const candidate = record[key];
          if (typeof candidate === "string" && candidate.trim()) {
            return candidate.trim();
          }
        }
      }

      return null;
    })
    .filter((entry): entry is string => Boolean(entry));
}

function toDurationMinutes(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.round(value));
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  const numericMatch = normalized.match(/(\d+(?:\.\d+)?)/);
  if (!numericMatch) {
    return undefined;
  }

  const amount = Number.parseFloat(numericMatch[1]);
  if (!Number.isFinite(amount)) {
    return undefined;
  }

  if (normalized.includes("hour")) {
    return Math.max(1, Math.round(amount * 60));
  }

  return Math.max(1, Math.round(amount));
}

function normalizeVariations(value: unknown): { easier?: string; harder?: string } {
  if (Array.isArray(value)) {
    return {
      easier: toStringValue(value[0]),
      harder: toStringValue(value[1]),
    };
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return {
      easier: toStringValue(record.easier ?? record.easy),
      harder: toStringValue(record.harder ?? record.challenge),
    };
  }

  return {};
}

function normalizeActivityResult(rawResult: unknown) {
  const result = rawResult && typeof rawResult === "object"
    ? rawResult as Record<string, unknown>
    : {};

  return {
    title: toStringValue(result.title) ?? "Generated Activity",
    age_range:
      toStringValue(result.age_range) ??
      toStringValue(result.ageRange) ??
      toStringValue(result.age) ??
      "5-8 years",
    duration_minutes:
      toDurationMinutes(result.duration_minutes) ??
      toDurationMinutes(result.duration),
    indoor_outdoor: toStringValue(result.indoor_outdoor ?? result.location),
    energy_level: toStringValue(result.energy_level),
    mess_level: toStringValue(result.mess_level ?? result.messLevel),
    supervision_level: toStringValue(result.supervision_level),
    materials: toStringArray(result.materials),
    steps: toStringArray(result.steps),
    variations: normalizeVariations(result.variations),
    learning_goals: toStringArray(result.learning_goals ?? result.learningAreas ?? result.skillsLearned),
    safety_notes:
      toStringValue(result.safety_notes) ??
      toStringValue(Array.isArray(result.safetyNotes) ? result.safetyNotes.join("; ") : result.safetyNotes),
  };
}

serve(async (req) => {
  const corsResponse = strictCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Use aiGuard for auth, role, and plan enforcement
    // Requires parent role and premium access (using "analyze" action)
    const guardResult = await aiGuard(req, "analyze", supabaseUrl, supabaseServiceKey);

    if (!guardResult.allowed) {
      const statusCode = guardResult.statusCode || 403;
      return new Response(
        JSON.stringify({
          error: guardResult.error?.error || "Access denied",
          code: guardResult.error?.code || "FORBIDDEN",
        }),
        { status: statusCode, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userContext = guardResult.userContext;
    if (!userContext) {
      return new Response(
        JSON.stringify({ error: "User context not available", code: "INTERNAL_ERROR" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request
    const body: ActivityRequest = await req.json();
    const { type = "activity", prompt, childAge, childName, duration, location, energyLevel, materials, dietary } = body;

    if (!["activity", "recipe", "craft"].includes(type)) {
      return new Response(
        JSON.stringify({ error: "Invalid type. Must be: activity, recipe, or craft", code: "VALIDATION_ERROR" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build user prompt based on type
    const trimmedPrompt = prompt?.trim();
    let userPrompt = "";
    const ageText = childAge ? `a ${childAge}-year-old` : "children";
    const nameText = childName ? ` named ${childName}` : "";

    if (type === "activity") {
      userPrompt = trimmedPrompt
        ? `Generate one fun activity idea based on this request: "${trimmedPrompt}".`
        : `Generate a fun ${location || "indoor or outdoor"} activity for ${ageText}${nameText}.`;
      if (childAge) userPrompt += ` The activity should feel right for ${childAge}-year-olds.`;
      if (childName) userPrompt += ` You can refer to the child as ${childName}.`;
      if (duration) userPrompt += ` It should take about ${duration}.`;
      if (location) userPrompt += ` Prefer a ${location} setting.`;
      if (energyLevel) userPrompt += ` Target a ${energyLevel} energy level.`;
      if (materials?.length) userPrompt += ` Available materials: ${materials.join(", ")}.`;
    } else if (type === "recipe") {
      userPrompt = trimmedPrompt
        ? `Generate one kid-friendly recipe idea based on this request: "${trimmedPrompt}".`
        : `Generate a kid-friendly recipe that ${ageText}${nameText} can help prepare.`;
      if (childAge) userPrompt += ` The recipe should fit a ${childAge}-year-old helper.`;
      if (childName) userPrompt += ` You can refer to the child as ${childName}.`;
      if (dietary?.length) userPrompt += ` Dietary considerations: ${dietary.join(", ")}.`;
    } else if (type === "craft") {
      userPrompt = trimmedPrompt
        ? `Generate one creative craft project based on this request: "${trimmedPrompt}".`
        : `Generate a creative craft project for ${ageText}${nameText}.`;
      if (childAge) userPrompt += ` The craft should fit a ${childAge}-year-old.`;
      if (childName) userPrompt += ` You can refer to the child as ${childName}.`;
      if (duration) userPrompt += ` It should take about ${duration}.`;
      if (materials?.length) userPrompt += ` Available materials: ${materials.join(", ")}.`;
    }

    // Call OpenRouter
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service not configured", code: "SERVICE_UNAVAILABLE" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[KID-ACTIVITY] Generating ${type} for user=${userContext.userId}`);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://www.coparrent.com",
        "X-Title": "CoParrent Activity Generator",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPTS[type] },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later.", code: "RATE_LIMIT" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Service temporarily unavailable.", code: "PAYMENT_REQUIRED" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error(`[KID-ACTIVITY] OpenRouter error: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: "AI service error", code: "AI_ERROR" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const aiContent = data.choices?.[0]?.message?.content;

    if (!aiContent) {
      return new Response(
        JSON.stringify({ error: "No response from AI", code: "AI_EMPTY_RESPONSE" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the JSON response
    let result;
    try {
      // Clean up potential markdown code blocks
      const cleanedContent = aiContent
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      result = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error(`[KID-ACTIVITY] JSON parse error:`, parseError);
      // Return raw content as fallback
      result = { title: "Generated Content", content: aiContent };
    }

    if (type === "activity") {
      result = normalizeActivityResult(result);
    }

    console.log(`[KID-ACTIVITY] Successfully generated ${type} for user=${userContext.userId}`);

    return new Response(
      JSON.stringify({ type, result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[KID-ACTIVITY] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        code: "INTERNAL_ERROR"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
