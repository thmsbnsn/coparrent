/**
 * Zod-like validation schemas for AI function outputs
 * Note: Using lightweight custom validation since Zod adds bundle size
 */

// ============================================
// Types for ai-message-assist analyze output
// ============================================

export interface MessageAnalysis {
  tone: "neutral" | "positive" | "negative" | "aggressive" | "passive_aggressive";
  clarity: "clear" | "unclear" | "ambiguous";
  appropriateness: "appropriate" | "concerning" | "inappropriate";
  suggestions: string[];
  summary: string;
}

export interface MessageAssistOutput {
  result: string;
  analysis?: MessageAnalysis;
}

// ============================================
// Types for ai-schedule-suggest output
// ============================================

export interface SchedulePattern {
  id: string;
  name: string;
  description: string;
  pros: string[];
  cons: string[];
  visualPattern: string;
  tips?: string[];
}

export interface ScheduleSuggestOutput {
  suggestions: SchedulePattern[];
  recommendation?: string;
}

// ============================================
// Validators
// ============================================

const VALID_TONES = ["neutral", "positive", "negative", "aggressive", "passive_aggressive"];
const VALID_CLARITY = ["clear", "unclear", "ambiguous"];
const VALID_APPROPRIATENESS = ["appropriate", "concerning", "inappropriate"];

/**
 * Validate and sanitize message analysis output
 */
export function validateMessageAnalysis(data: unknown): { 
  valid: boolean; 
  data?: MessageAnalysis; 
  errors?: string[] 
} {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Invalid data: expected object"] };
  }

  const obj = data as Record<string, unknown>;

  // Validate tone
  if (!obj.tone || !VALID_TONES.includes(obj.tone as string)) {
    errors.push(`Invalid tone: ${obj.tone}. Expected one of: ${VALID_TONES.join(", ")}`);
  }

  // Validate clarity
  if (!obj.clarity || !VALID_CLARITY.includes(obj.clarity as string)) {
    errors.push(`Invalid clarity: ${obj.clarity}. Expected one of: ${VALID_CLARITY.join(", ")}`);
  }

  // Validate appropriateness
  if (!obj.appropriateness || !VALID_APPROPRIATENESS.includes(obj.appropriateness as string)) {
    errors.push(`Invalid appropriateness: ${obj.appropriateness}. Expected one of: ${VALID_APPROPRIATENESS.join(", ")}`);
  }

  // Validate suggestions array
  if (!Array.isArray(obj.suggestions)) {
    errors.push("Invalid suggestions: expected array");
  } else {
    const invalidSuggestions = obj.suggestions.filter((s) => typeof s !== "string");
    if (invalidSuggestions.length > 0) {
      errors.push("Invalid suggestions: all items must be strings");
    }
  }

  // Validate summary
  if (typeof obj.summary !== "string") {
    errors.push("Invalid summary: expected string");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      tone: obj.tone as MessageAnalysis["tone"],
      clarity: obj.clarity as MessageAnalysis["clarity"],
      appropriateness: obj.appropriateness as MessageAnalysis["appropriateness"],
      suggestions: obj.suggestions as string[],
      summary: obj.summary as string,
    },
  };
}

/**
 * Validate and sanitize schedule pattern
 */
function validateSchedulePattern(data: unknown, index: number): { 
  valid: boolean; 
  data?: SchedulePattern; 
  errors?: string[] 
} {
  const errors: string[] = [];
  const prefix = `Pattern[${index}]`;

  if (!data || typeof data !== "object") {
    return { valid: false, errors: [`${prefix}: expected object`] };
  }

  const obj = data as Record<string, unknown>;

  // Required string fields
  const requiredStrings = ["id", "name", "description", "visualPattern"];
  for (const field of requiredStrings) {
    if (typeof obj[field] !== "string" || (obj[field] as string).length === 0) {
      errors.push(`${prefix}.${field}: expected non-empty string`);
    }
  }

  // Required array fields
  const requiredArrays = ["pros", "cons"];
  for (const field of requiredArrays) {
    if (!Array.isArray(obj[field])) {
      errors.push(`${prefix}.${field}: expected array`);
    } else {
      const invalidItems = (obj[field] as unknown[]).filter((s) => typeof s !== "string");
      if (invalidItems.length > 0) {
        errors.push(`${prefix}.${field}: all items must be strings`);
      }
    }
  }

  // Optional tips array
  if (obj.tips !== undefined && obj.tips !== null) {
    if (!Array.isArray(obj.tips)) {
      errors.push(`${prefix}.tips: expected array or undefined`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      id: obj.id as string,
      name: obj.name as string,
      description: obj.description as string,
      pros: obj.pros as string[],
      cons: obj.cons as string[],
      visualPattern: obj.visualPattern as string,
      tips: obj.tips as string[] | undefined,
    },
  };
}

/**
 * Validate and sanitize schedule suggest output
 */
export function validateScheduleSuggestOutput(data: unknown): { 
  valid: boolean; 
  data?: ScheduleSuggestOutput; 
  errors?: string[] 
} {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Invalid data: expected object"] };
  }

  const obj = data as Record<string, unknown>;

  // Validate suggestions array
  if (!Array.isArray(obj.suggestions)) {
    return { valid: false, errors: ["Invalid suggestions: expected array"] };
  }

  const validatedPatterns: SchedulePattern[] = [];
  
  for (let i = 0; i < obj.suggestions.length; i++) {
    const result = validateSchedulePattern(obj.suggestions[i], i);
    if (!result.valid) {
      errors.push(...(result.errors || []));
    } else if (result.data) {
      validatedPatterns.push(result.data);
    }
  }

  // Optional recommendation
  if (obj.recommendation !== undefined && typeof obj.recommendation !== "string") {
    errors.push("Invalid recommendation: expected string or undefined");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      suggestions: validatedPatterns,
      recommendation: obj.recommendation as string | undefined,
    },
  };
}

// ============================================
// Safe Fallback Builders
// ============================================

/**
 * Create a safe fallback message analysis when parsing fails
 */
export function createFallbackMessageAnalysis(rawText?: string): MessageAnalysis {
  return {
    tone: "neutral",
    clarity: "unclear",
    appropriateness: "appropriate",
    suggestions: rawText 
      ? ["Unable to fully analyze. Please review manually."] 
      : ["Analysis unavailable. Please try again."],
    summary: rawText 
      ? "Analysis could not be completed. The AI response was malformed." 
      : "No analysis available.",
  };
}

/**
 * Create a safe fallback schedule suggestion when parsing fails
 */
export function createFallbackScheduleSuggestion(): ScheduleSuggestOutput {
  return {
    suggestions: [
      {
        id: "week-on-week-off",
        name: "Week On / Week Off",
        description: "Children spend one full week with each parent, alternating weekly.",
        pros: [
          "Provides extended time with each parent",
          "Fewer transitions reduce stress",
          "Easier to plan activities and routines",
        ],
        cons: [
          "Long time away from other parent",
          "May be harder for younger children",
          "Requires good co-parenting communication",
        ],
        visualPattern: "🏠1111111🏡2222222",
        tips: ["Works best when parents live in the same school district"],
      },
      {
        id: "2-2-3",
        name: "2-2-3 Rotation",
        description: "A rotating schedule: 2 days, 2 days, then 3 days, alternating each week.",
        pros: [
          "More frequent contact with both parents",
          "Balanced time over two weeks",
          "Good for younger children who need regular contact",
        ],
        cons: [
          "More transitions per week",
          "Harder to track",
          "Requires parents to live close to each other",
        ],
        visualPattern: "🏠11🏡22🏠333 | 🏡22🏠11🏡333",
        tips: ["Consider using a shared calendar app to track"],
      },
    ],
    recommendation: "Unable to generate personalized suggestions. Showing common patterns.",
  };
}

/**
 * Try to parse JSON from AI response, handling markdown code blocks
 */
export function parseAIJsonResponse<T>(rawText: string): T | null {
  try {
    // First try direct parse
    return JSON.parse(rawText);
  } catch {
    // Try extracting from markdown code blocks
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch {
        return null;
      }
    }
    
    // Try finding JSON object pattern
    const objectMatch = rawText.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        return null;
      }
    }
    
    return null;
  }
}
