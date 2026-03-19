import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiGuard } from "../_shared/aiGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ActivityRequest {
  type: "activity" | "recipe" | "craft";
  childAge?: number;
  childName?: string;
  duration?: string; // "15min", "30min", "1hour", "2hours"
  location?: "indoor" | "outdoor" | "both";
  materials?: string[];
  dietary?: string[]; // For recipes: allergies, preferences
}

const SYSTEM_PROMPTS: Record<string, string> = {
  activity: `You are a child activity expert. Generate fun, age-appropriate activities for children.

Your response MUST be valid JSON with this exact structure:
{
  "title": "Activity Name",
  "description": "Brief description",
  "ageRange": "3-5 years",
  "duration": "30 minutes",
  "materials": ["item1", "item2"],
  "steps": ["Step 1", "Step 2", "Step 3"],
  "learningAreas": ["motor skills", "creativity"],
  "safetyNotes": ["Adult supervision required"],
  "variations": ["Make it easier by...", "Make it harder by..."]
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
    const { type = "activity", childAge, childName, duration, location, materials, dietary } = body;

    if (!["activity", "recipe", "craft"].includes(type)) {
      return new Response(
        JSON.stringify({ error: "Invalid type. Must be: activity, recipe, or craft", code: "VALIDATION_ERROR" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build user prompt based on type
    let userPrompt = "";
    const ageText = childAge ? `a ${childAge}-year-old` : "children";
    const nameText = childName ? ` named ${childName}` : "";

    if (type === "activity") {
      userPrompt = `Generate a fun ${location || "indoor or outdoor"} activity for ${ageText}${nameText}.`;
      if (duration) userPrompt += ` It should take about ${duration}.`;
      if (materials?.length) userPrompt += ` Available materials: ${materials.join(", ")}.`;
    } else if (type === "recipe") {
      userPrompt = `Generate a kid-friendly recipe that ${ageText}${nameText} can help prepare.`;
      if (dietary?.length) userPrompt += ` Dietary considerations: ${dietary.join(", ")}.`;
    } else if (type === "craft") {
      userPrompt = `Generate a creative craft project for ${ageText}${nameText}.`;
      if (duration) userPrompt += ` It should take about ${duration}.`;
      if (materials?.length) userPrompt += ` Available materials: ${materials.join(", ")}.`;
    }

    // Call Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service not configured", code: "SERVICE_UNAVAILABLE" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[KID-ACTIVITY] Generating ${type} for user=${userContext.userId}`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
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
      console.error(`[KID-ACTIVITY] AI error: ${response.status} - ${errorText}`);
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