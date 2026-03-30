import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiGuard, type AiAction } from "../_shared/aiGuard.ts";
import { checkAndIncrementQuota } from "../_shared/aiRateLimit.ts";
import { strictCors, getCorsHeaders } from "../_shared/aiCors.ts";
import { validateMessageAnalysis, createFallbackMessageAnalysis, parseAIJsonResponse } from "../_shared/aiSchemas.ts";

// Valid actions for this endpoint
const VALID_ACTIONS = ["quick-check", "analyze", "rephrase", "draft"] as const;
type ValidAction = typeof VALID_ACTIONS[number];

// Valid rewrite modes for rephrase/draft actions
const VALID_MODES = ["neutral", "deescalate", "facts_only", "boundary_setting"] as const;
type ValidMode = typeof VALID_MODES[number];

const TEXT_MODEL_ID = "google/gemini-3-flash-preview";

// Input length limits per plan tier
const INPUT_LIMITS: Record<string, number> = {
  free: 600,
  trial: 1500,
  paid: 3000,
  premium: 3000,
  admin: 5000,
  admin_access: 5000,
};

// Mode-specific prompt modifiers for rephrase/draft
const MODE_PROMPTS: Record<ValidMode, { instruction: string; style: string }> = {
  neutral: {
    instruction: "Rephrase professionally while maintaining the original intent.",
    style: "calm, professional, and child-focused"
  },
  deescalate: {
    instruction: "Rephrase to de-escalate tension and reduce conflict. Lower emotional temperature.",
    style: "calming, non-confrontational, and solution-oriented"
  },
  facts_only: {
    instruction: "Rephrase to be purely factual and court-friendly. Remove all emotion, accusations, and subjective language.",
    style: "factual, objective, and documentation-ready"
  },
  boundary_setting: {
    instruction: "Rephrase to set firm but calm boundaries. Be clear and direct without being aggressive.",
    style: "firm, respectful, and boundary-clear"
  }
};

// Patterns that might indicate hostile or inflammatory language
// Note: Patterns do NOT use 'g' flag to avoid lastIndex issues with .test()
const hostilePatterns = [
  { pattern: /\b(you always|you never)\b/i, suggestion: "Consider rephrasing to focus on specific situations rather than generalizations" },
  { pattern: /\b(your fault|blame you)\b/i, suggestion: "Try using 'I feel' statements instead of assigning blame" },
  { pattern: /\b(stupid|idiot|incompetent|terrible)\b/i, suggestion: "Remove personal attacks and focus on the issue at hand" },
  { pattern: /\b(demand|insist|must|have to)\b/i, suggestion: "Consider using 'request' or 'would appreciate' for a more collaborative tone" },
  { pattern: /!{2,}/, suggestion: "Multiple exclamation marks can seem aggressive - one is sufficient" },
  { pattern: /\b(can't believe|ridiculous|unacceptable)\b/i, suggestion: "Express concerns calmly without inflammatory language" },
  { pattern: /\b(never see|take away|my lawyer)\b/i, suggestion: "Avoid threatening language - focus on finding solutions" },
];

// Check for tone issues using regex patterns
function analyzeTone(message: string): { hasIssues: boolean; flags: string[] } {
  const flags: string[] = [];
  
  for (const { pattern, suggestion } of hostilePatterns) {
    if (pattern.test(message)) {
      flags.push(suggestion);
    }
  }
  
  // Check for ALL CAPS (more than 3 consecutive words)
  if (/\b[A-Z]{3,}\s+[A-Z]{3,}\s+[A-Z]{3,}\b/.test(message)) {
    flags.push("Avoid using all capital letters - it can be perceived as shouting");
  }
  
  return { hasIssues: flags.length > 0, flags: [...new Set(flags)] };
}

serve(async (req) => {
  const startTime = Date.now();
  
  // Handle CORS with strict origin validation
  const corsResponse = strictCors(req);
  if (corsResponse) {
    return corsResponse;
  }
  
  const corsHeaders = getCorsHeaders(req);
  
  try {
    // Parse request body
    const body = await req.json();
    const { familyId, message, action, mode } = body;
    
    // Validate action
    if (!action || !VALID_ACTIONS.includes(action as ValidAction)) {
      console.warn(`[AI-MESSAGE-ASSIST] Invalid action: ${action}`);
      return new Response(
        JSON.stringify({ error: "Invalid action. Must be one of: quick-check, analyze, rephrase, draft", code: "INVALID_ACTION" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validAction = action as ValidAction;
    
    // Validate mode if provided (only for rephrase/draft)
    const selectedMode: ValidMode = (mode && VALID_MODES.includes(mode)) ? mode : "neutral";
    
    // Authenticate and authorize with aiGuard
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    // Use the action directly since aiGuard AiAction type includes these actions
    const guardResult = await aiGuard(req, validAction as AiAction, supabaseUrl, supabaseServiceKey, {
      familyId,
    });
    
    if (!guardResult.allowed) {
      const errorObj = guardResult.error || { error: "Access denied", code: "FORBIDDEN" };
      console.warn(`[AI-MESSAGE-ASSIST] Access denied: ${errorObj.error} for action=${validAction}`);
      return new Response(
        JSON.stringify(errorObj),
        { status: guardResult.statusCode || 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const userContext = guardResult.userContext!;
    const userId = userContext.userId;
    
    // Log request metadata (no message content for safety)
    console.log(`[AI-MESSAGE-ASSIST] action=${validAction} mode=${selectedMode} user=${userId} role=${userContext.role} plan=${userContext.planTier}`);
    
    // Quick check is allowed for all authenticated users without quota consumption
    if (validAction === "quick-check") {
      // Validate message input
      if (typeof message !== "string") {
        return new Response(
          JSON.stringify({ error: "Message must be a string", code: "INVALID_INPUT" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const trimmedMessage = message.trim();
      if (trimmedMessage.length === 0) {
        return new Response(
          JSON.stringify({ hasIssues: false, flags: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const analysis = analyzeTone(trimmedMessage);
      const latency = Date.now() - startTime;
      console.log(`[AI-MESSAGE-ASSIST] quick-check completed user=${userId} latency=${latency}ms`);
      
      return new Response(JSON.stringify(analysis), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // For AI actions, enforce rate limiting
    const rateLimitResult = await checkAndIncrementQuota(supabaseUrl, supabaseServiceKey, userContext);
    
    if (!rateLimitResult.allowed) {
      const errorObj = rateLimitResult.error || { error: "Rate limit exceeded", code: "RATE_LIMIT" };
      console.warn(`[AI-MESSAGE-ASSIST] Rate limit exceeded user=${userId} action=${validAction}`);
      return new Response(
        JSON.stringify(errorObj),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Validate message input for AI actions
    if (typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "Message must be a string", code: "INVALID_INPUT" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const trimmedMessage = message.trim();
    if (trimmedMessage.length === 0) {
      return new Response(
        JSON.stringify({ error: "Message cannot be empty", code: "EMPTY_INPUT" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Check message length against plan limits
    const maxLength = INPUT_LIMITS[userContext.planTier] || INPUT_LIMITS.free;
    if (trimmedMessage.length > maxLength) {
      return new Response(
        JSON.stringify({ 
          error: `Message exceeds maximum length of ${maxLength} characters for your plan`, 
          code: "INPUT_TOO_LONG" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }

    // Build prompts for AI actions
    let systemPrompt = "";
    let userPrompt = "";
    
    // Get mode-specific instructions
    const modeConfig = MODE_PROMPTS[selectedMode];

    if (validAction === "rephrase") {
      systemPrompt = `You are a co-parenting communication assistant. Your role is to help parents communicate in a ${modeConfig.style} manner.

${modeConfig.instruction}

Guidelines:
- Remove emotional language and personal attacks
- Focus on facts and the children's wellbeing
- Keep requests clear and actionable
- Maintain the original intent while improving delivery
- Be concise but thorough

This is informational assistance only, not legal advice. For legal matters, consult an attorney.

Respond with ONLY the rephrased message, no explanations.`;
      userPrompt = `Rephrase this message to be more ${modeConfig.style}:\n\n"${trimmedMessage}"`;
    } else if (validAction === "draft") {
      systemPrompt = `You are a co-parenting communication assistant. Help parents draft ${modeConfig.style} messages.

${modeConfig.instruction}

Your suggestions should:
- Focus on the children's needs
- Be clear and specific about requests or information
- Avoid blame or emotional language

This is informational assistance only, not legal advice. Consult an attorney for legal guidance.

Provide 2-3 alternative message drafts based on the user's intent.`;
      userPrompt = `Help me draft a ${modeConfig.style} message about: ${trimmedMessage}`;
    } else if (validAction === "analyze") {
      systemPrompt = `You are a co-parenting communication assistant. Analyze the message for tone and provide specific, actionable feedback.

This is informational assistance only, not legal advice.

Provide your response as JSON with this exact structure:
{
  "overallTone": "positive" | "neutral" | "concerning",
  "toneScore": <number 1-10, 10 being most professional>,
  "suggestions": ["specific suggestion 1", "specific suggestion 2"],
  "positiveAspects": ["what the message does well"],
  "childFocused": <boolean>,
  "courtAppropriate": <boolean>
}

Return ONLY valid JSON, no markdown or explanation.`;
      userPrompt = `Analyze this co-parenting message:\n\n"${trimmedMessage}"`;
    }

    console.log(`[AI-MESSAGE-ASSIST] Calling AI user=${userId} action=${validAction} mode=${selectedMode} inputLength=${trimmedMessage.length}`);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://www.coparrent.com",
        "X-Title": "CoParrent Message Assistant",
      },
      body: JSON.stringify({
        model: TEXT_MODEL_ID,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AI-MESSAGE-ASSIST] OpenRouter error status=${response.status}`);
      throw new Error(`AI service error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content;

    if (!aiResponse) {
      throw new Error("No response from AI");
    }

    // Build result based on action
    let result;
    if (validAction === "analyze") {
      // Parse and validate analysis response
      const parsed = parseAIJsonResponse<unknown>(aiResponse);
      
      if (parsed) {
        const validation = validateMessageAnalysis(parsed);
        if (validation.valid && validation.data) {
          result = validation.data;
        } else {
          console.warn(`[AI-MESSAGE-ASSIST] Schema validation failed user=${userId}, using fallback`);
          result = createFallbackMessageAnalysis(aiResponse);
        }
      } else {
        // Try one repair retry
        console.warn(`[AI-MESSAGE-ASSIST] JSON parse failed user=${userId}, attempting repair`);
        
        const repairResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://www.coparrent.com",
            "X-Title": "CoParrent Message Assistant",
          },
          body: JSON.stringify({
            model: TEXT_MODEL_ID,
            messages: [
              { role: "system", content: "Fix this malformed JSON and return ONLY valid JSON with no markdown." },
              { role: "user", content: aiResponse },
            ],
            temperature: 0.1,
            max_tokens: 500,
          }),
        });
        
        if (repairResponse.ok) {
          const repairData = await repairResponse.json();
          const repairedText = repairData.choices?.[0]?.message?.content;
          const reparsed = parseAIJsonResponse<unknown>(repairedText);
          
          if (reparsed) {
            const revalidation = validateMessageAnalysis(reparsed);
            if (revalidation.valid && revalidation.data) {
              result = revalidation.data;
            } else {
              result = createFallbackMessageAnalysis(aiResponse);
            }
          } else {
            result = createFallbackMessageAnalysis(aiResponse);
          }
        } else {
          result = createFallbackMessageAnalysis(aiResponse);
        }
      }
    } else {
      // rephrase or draft - return content directly (backwards compatible)
      result = { content: aiResponse.trim() };
    }

    const latency = Date.now() - startTime;
    console.log(`[AI-MESSAGE-ASSIST] completed action=${validAction} mode=${selectedMode} user=${userId} latency=${latency}ms remaining=${rateLimitResult.remaining}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const latency = Date.now() - startTime;
    console.error(`[AI-MESSAGE-ASSIST] Error latency=${latency}ms:`, error instanceof Error ? error.message : "Unknown error");
    
    return new Response(
      JSON.stringify({ error: "Failed to process request", code: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
