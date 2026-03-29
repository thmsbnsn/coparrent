import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiGuard, getPlanLimits, validateInputLength } from "../_shared/aiGuard.ts";
import { strictCors, getCorsHeaders } from "../_shared/aiCors.ts";

// Rate limit: 100 messages per day per user for Nurse Nancy
const NURSE_NANCY_DAILY_LIMIT = 100;
type SupabaseServiceClient = ReturnType<typeof createClient>;

// Emergency keywords that require immediate escalation
const EMERGENCY_KEYWORDS = [
  "not breathing", "can't breathe", "difficulty breathing", "blue lips", "blue face",
  "unconscious", "unresponsive", "won't wake", "seizure", "convulsion",
  "severe bleeding", "bleeding heavily", "choking",
  "suicidal", "suicide", "self-harm", "hurt myself", "kill myself", "want to die",
  "overdose", "poisoning", "swallowed", "drank bleach", "drank cleaning",
  "broken bone", "bone sticking out", "head injury", "fell from height",
  "severe burn", "electric shock", "drowning", "near drowning",
  "allergic reaction", "anaphylaxis", "swelling throat", "can't swallow",
  "chest pain", "heart attack", "stroke", "passing out", "fainted"
];

// Diagnosis request patterns - refuse and redirect
const DIAGNOSIS_PATTERNS = [
  "what do i have", "what does my child have", "is it strep", "is this covid",
  "diagnose", "what disease", "what illness", "what condition", "do i have",
  "tell me what's wrong", "what's wrong with"
];

// Medication dosing patterns - refuse and redirect
const DOSING_PATTERNS = [
  "how much tylenol", "how much ibuprofen", "how much advil", "how much motrin",
  "what dose", "dosage for", "how many mg", "ml should i give", "how much medicine",
  "how much benadryl", "how much antibiotic", "how much should i give"
];

const EMERGENCY_RESPONSE = `🚨 **This sounds like a medical emergency.**

**Please call emergency services immediately:**
- **US/Canada:** 911
- **UK:** 999
- **EU:** 112
- **Australia:** 000

**Mental Health Crisis Resources:**
- **National Suicide Prevention Lifeline:** 988 (US)
- **Crisis Text Line:** Text HOME to 741741 (US)

Do not wait. Get professional help right now.

I'm here to provide general information, but this situation requires immediate professional attention. While you wait for help:
- Stay calm and stay with the person
- Follow any instructions from the emergency dispatcher
- Do not move the person unless they are in immediate danger

Please seek emergency care now.`;

const DIAGNOSIS_REFUSAL = `I understand you're looking for answers, and I wish I could give you a specific diagnosis. However, I'm not able to diagnose conditions—that requires a proper examination by a healthcare provider who can see your child, run tests if needed, and consider their full medical history.

**What I can do:**
- Help you think through the symptoms you're observing
- Share general information about common childhood concerns
- Suggest questions to ask your doctor

Would you like to tell me more about what symptoms you're noticing? I can help you organize your thoughts before you speak with a healthcare provider. 💜`;

const DOSING_REFUSAL = `I really appreciate you being careful about medication! However, I'm not able to provide specific medication dosages—that's something that needs to come from your pediatrician or pharmacist, who can consider your child's exact weight, age, any other medications, and medical history.

**Safe next steps:**
- Check the medication packaging for age/weight guidelines
- Call your pediatrician's office or nurse line
- Ask your pharmacist—they're medication experts!
- For after-hours questions, many pediatric practices have a nurse line

Is there anything else about your child's symptoms I can help you think through while you reach out to your healthcare provider? 💜`;

// System prompt is LOCKED server-side - never accept from client
const NURSE_NANCY_SYSTEM_PROMPT = `You are Nurse Nancy, a sweet, caring, and empathetic AI health assistant for parents in the CoParrent app. Your role is to provide general, educational health information to help parents think through concerns about their children's health.

## Your Personality
- Sweet, warm, and caring like a trusted friend who happens to know a lot about child health
- Calm and reassuring, never alarming unless truly necessary
- Non-judgmental and supportive
- Uses gentle, accessible language

## Important Guidelines

### What You CAN Do:
- Provide general educational health information
- Ask 1-3 brief clarifying questions when helpful (age, duration, severity, other symptoms, hydration, fever, etc.)
- Offer safe, general home-care comfort tips (rest, fluids, cool compresses, etc.)
- Help parents think through when to contact a healthcare provider
- Encourage parents to trust their instincts
- Suggest questions parents might want to ask their doctor

### What You CANNOT Do:
- Provide medical diagnoses ("This sounds like strep throat")
- Prescribe medications or dosages ("Give them 5ml of ibuprofen")
- Provide specific treatment plans
- Replace professional medical advice
- Provide legal advice

### Response Format:
- Keep responses concise (2-4 short paragraphs)
- Use bullet points for lists when helpful
- Be direct but warm
- ALWAYS end with a gentle reminder to consult a healthcare provider for specific medical advice when symptoms persist, worsen, or if the parent is uncertain

### When to Recommend Seeing a Doctor:
Encourage contacting a healthcare provider when:
- Symptoms persist beyond a few days
- The parent seems uncertain or worried
- Symptoms are severe or worsening
- The child is very young (under 6 months especially)
- There are concerning symptoms (high fever, rash, difficulty breathing, etc.)

### Key Phrases to Use:
- "Every child is different, so it's always okay to check with your pediatrician."
- "Trust your instincts - you know your child best."
- "While I can share general information, your doctor can give you personalized advice."
- "This is general guidance - always consult a healthcare provider for your specific situation."
- "If things don't improve in a day or two, or if you're worried, don't hesitate to call your doctor."

Remember: You are providing educational support, not medical care. When in doubt, always encourage parents to seek professional medical advice.`;

interface ChatRequest {
  threadId: string;
  message: string;
  messageHistory?: Array<{ role: string; content: string }>;
}

/**
 * Check and increment Nurse Nancy usage quota
 */
async function checkNurseNancyRateLimit(
  supabase: SupabaseServiceClient,
  userId: string
): Promise<{ allowed: boolean; remaining: number; error?: string }> {
  const today = new Date().toISOString().split("T")[0];
  const functionName = "nurse-nancy-chat";

  try {
    // Try to get existing usage record for today
    const { data: existingUsage, error: fetchError } = await supabase
      .from("function_usage_daily")
      .select("id, request_count")
      .eq("user_id", userId)
      .eq("function_name", functionName)
      .eq("usage_date", today)
      .maybeSingle();

    if (fetchError) {
      console.error("[NURSE-NANCY] Rate limit fetch error");
      // Fail open but log
      return { allowed: true, remaining: NURSE_NANCY_DAILY_LIMIT };
    }

    let currentCount = 0;

    if (existingUsage) {
      currentCount = existingUsage.request_count;

      if (currentCount >= NURSE_NANCY_DAILY_LIMIT) {
        return {
          allowed: false,
          remaining: 0,
          error: "Daily Nurse Nancy limit reached. Try again tomorrow.",
        };
      }

      // Increment
      await supabase
        .from("function_usage_daily")
        .update({
          request_count: currentCount + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingUsage.id);

      return { allowed: true, remaining: NURSE_NANCY_DAILY_LIMIT - currentCount - 1 };
    }

    // Create new record for today
    const { error: insertError } = await supabase
      .from("function_usage_daily")
      .insert({
        user_id: userId,
        function_name: functionName,
        usage_date: today,
        request_count: 1,
      });

    if (insertError && insertError.code === "23505") {
      // Race condition - retry fetch
      const { data: retryData } = await supabase
        .from("function_usage_daily")
        .select("id, request_count")
        .eq("user_id", userId)
        .eq("function_name", functionName)
        .eq("usage_date", today)
        .single();

      if (retryData && retryData.request_count >= NURSE_NANCY_DAILY_LIMIT) {
        return {
          allowed: false,
          remaining: 0,
          error: "Daily Nurse Nancy limit reached. Try again tomorrow.",
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

        return { allowed: true, remaining: NURSE_NANCY_DAILY_LIMIT - retryData.request_count - 1 };
      }
    }

    return { allowed: true, remaining: NURSE_NANCY_DAILY_LIMIT - 1 };
  } catch (error) {
    console.error("[NURSE-NANCY] Unexpected rate limit error");
    return { allowed: true, remaining: NURSE_NANCY_DAILY_LIMIT };
  }
}

/**
 * Detect safety triggers in user message
 */
function detectSafetyTriggers(message: string): {
  isEmergency: boolean;
  isDiagnosisRequest: boolean;
  isDosingRequest: boolean;
} {
  const lowerMessage = message.toLowerCase();

  return {
    isEmergency: EMERGENCY_KEYWORDS.some(keyword => lowerMessage.includes(keyword)),
    isDiagnosisRequest: DIAGNOSIS_PATTERNS.some(pattern => lowerMessage.includes(pattern)),
    isDosingRequest: DOSING_PATTERNS.some(pattern => lowerMessage.includes(pattern)),
  };
}

serve(async (req) => {
  const corsResponse = strictCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Use aiGuard for auth, role, and plan enforcement
    // Using "analyze" action which requires parent role and premium access
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

    // Create service client for operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Check rate limit
    const rateLimit = await checkNurseNancyRateLimit(serviceClient, userId);
    if (!rateLimit.allowed) {
      // Safe log - no message content
      console.log(`[NURSE-NANCY] Rate limited user=${userId.slice(0, 8)}...`);
      return new Response(
        JSON.stringify({
          ok: false,
          code: "RATE_LIMITED",
          message: rateLimit.error || "Daily Nurse Nancy limit reached. Try again tomorrow.",
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request - system prompt is NEVER accepted from client
    const body: ChatRequest = await req.json();
    const { threadId, message, messageHistory = [] } = body;

    if (!threadId || !message) {
      return new Response(
        JSON.stringify({ ok: false, code: "INVALID_REQUEST", message: "Missing threadId or message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate input length based on plan
    const inputValidation = validateInputLength(message, userContext);
    if (!inputValidation.valid) {
      return new Response(
        JSON.stringify({
          ok: false,
          code: inputValidation.error?.code || "INPUT_TOO_LONG",
          message: inputValidation.error?.error || "Message too long",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify thread ownership using user's client
    const authHeader = req.headers.get("Authorization")!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: thread, error: threadError } = await userClient
      .from("nurse_nancy_threads")
      .select("id")
      .eq("id", threadId)
      .eq("user_id", userId)
      .single();

    if (threadError || !thread) {
      return new Response(
        JSON.stringify({ ok: false, code: "NOT_FOUND", message: "Thread not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Safety detection - server-side only
    const safetyTriggers = detectSafetyTriggers(message);

    // Handle emergency - immediate override
    if (safetyTriggers.isEmergency) {
      // Safe log - no message content, only category
      console.log(`[NURSE-NANCY] Emergency detected user=${userId.slice(0, 8)}...`);

      // Store messages via service client
      await serviceClient.from("nurse_nancy_messages").insert({
        thread_id: threadId,
        role: "user",
        content: message
      });

      await serviceClient.from("nurse_nancy_messages").insert({
        thread_id: threadId,
        role: "assistant",
        content: EMERGENCY_RESPONSE
      });

      return new Response(
        JSON.stringify({
          ok: true,
          response: EMERGENCY_RESPONSE,
          isEmergency: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle diagnosis request - refuse politely
    if (safetyTriggers.isDiagnosisRequest) {
      console.log(`[NURSE-NANCY] Diagnosis request deflected user=${userId.slice(0, 8)}...`);

      await serviceClient.from("nurse_nancy_messages").insert({
        thread_id: threadId,
        role: "user",
        content: message
      });

      await serviceClient.from("nurse_nancy_messages").insert({
        thread_id: threadId,
        role: "assistant",
        content: DIAGNOSIS_REFUSAL
      });

      return new Response(
        JSON.stringify({
          ok: true,
          response: DIAGNOSIS_REFUSAL,
          safetyIntervention: "diagnosis_refusal",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle dosing request - refuse politely
    if (safetyTriggers.isDosingRequest) {
      console.log(`[NURSE-NANCY] Dosing request deflected user=${userId.slice(0, 8)}...`);

      await serviceClient.from("nurse_nancy_messages").insert({
        thread_id: threadId,
        role: "user",
        content: message
      });

      await serviceClient.from("nurse_nancy_messages").insert({
        thread_id: threadId,
        role: "assistant",
        content: DOSING_REFUSAL
      });

      return new Response(
        JSON.stringify({
          ok: true,
          response: DOSING_REFUSAL,
          safetyIntervention: "dosing_refusal",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build conversation for AI - system prompt is server-controlled
    const conversationMessages = [
      { role: "system", content: NURSE_NANCY_SYSTEM_PROMPT },
      ...messageHistory.slice(-10).map(m => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content
      })),
      { role: "user", content: message }
    ];

    // Call OpenRouter
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) {
      throw new Error("AI service is not configured");
    }

    // Safe log - only metadata, no content
    console.log(`[NURSE-NANCY] Request user=${userId.slice(0, 8)}... thread=${threadId.slice(0, 8)}... remaining=${rateLimit.remaining}`);

    const planLimits = getPlanLimits(userContext);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://www.coparrent.com",
        "X-Title": "CoParrent Nurse Nancy",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: conversationMessages,
        temperature: 0.7,
        max_tokens: planLimits.maxTokens,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({
            ok: false,
            code: "AI_RATE_LIMIT",
            message: "Please wait a moment before sending another message.",
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error(`[NURSE-NANCY] OpenRouter error status=${response.status}`);
      throw new Error("AI service temporarily unavailable");
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content;

    if (!aiResponse) {
      throw new Error("No response from AI");
    }

    // Store messages
    await serviceClient.from("nurse_nancy_messages").insert({
      thread_id: threadId,
      role: "user",
      content: message
    });

    await serviceClient.from("nurse_nancy_messages").insert({
      thread_id: threadId,
      role: "assistant",
      content: aiResponse
    });

    // Update thread timestamp
    await serviceClient
      .from("nurse_nancy_threads")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", threadId);

    // Safe log - only metadata
    console.log(`[NURSE-NANCY] Response sent user=${userId.slice(0, 8)}... thread=${threadId.slice(0, 8)}...`);

    return new Response(
      JSON.stringify({
        ok: true,
        response: aiResponse,
        remaining: rateLimit.remaining,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    // Safe error log - no user data
    console.error("[NURSE-NANCY] Error:", error instanceof Error ? error.message : "Unknown error");
    return new Response(
      JSON.stringify({
        ok: false,
        code: "SERVER_ERROR",
        message: "Something went wrong. Please try again.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
