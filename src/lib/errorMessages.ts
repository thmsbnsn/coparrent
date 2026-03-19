/**
 * User-friendly error messages
 * 
 * Maps technical errors to human-readable messages.
 * Ensures users never see raw UUIDs, enum values, or Supabase error objects.
 */

import { captureError } from "@/lib/sentry";

// Standard user-facing messages
export const ERROR_MESSAGES = {
  // Generic fallbacks (calm, neutral, human)
  GENERIC: "Something went wrong. Please try again.",
  NETWORK: "Unable to connect. Please check your internet connection.",
  TIMEOUT: "You've made too many requests. Please wait a moment and try again.",
  DUPLICATE_REQUEST: "Please wait, your request is being processed.",
  
  // Auth/Permission (NOT_AUTHORIZED)
  NOT_AUTHENTICATED: "Please log in to continue.",
  SESSION_EXPIRED: "Your session has expired. Please log in again.",
  NOT_PARENT: "This action is only available to parents.",
  ACCESS_DENIED: "You don't have permission for this action.",
  CHILD_ACCOUNT_RESTRICTED: "This feature isn't available for your account type.",
  THIRD_PARTY_RESTRICTED: "This feature is only available to parents.",
  PERMISSION_REVOKED: "Your access to this feature has been revoked.",
  
  // Plan limits (NOT_PREMIUM)
  LIMIT_REACHED: "You've reached your plan limit. Upgrade to add more.",
  UPGRADE_REQUIRED: "This feature requires a Power subscription.",
  TRIAL_EXPIRED: "Your trial has ended. Upgrade to continue using this feature.",
  
  // Rate limiting (RATE_LIMIT)
  RATE_LIMITED: "You've reached your daily limit. Please try again tomorrow.",
  
  // Validation
  INVALID_INPUT: "Please check your input and try again.",
  REQUIRED_FIELD: "Please fill in all required fields.",
  INVALID_EMAIL: "Please enter a valid email address.",
  
  // Stripe/Billing
  PAYMENT_FAILED: "Payment failed. Please try a different payment method.",
  CHECKOUT_ERROR: "Unable to start checkout. Please try again.",
  SUBSCRIPTION_ERROR: "There was an issue with your subscription.",
  
  // Data operations
  SAVE_FAILED: "Unable to save. Please try again.",
  DELETE_FAILED: "Unable to delete. Please try again.",
  LOAD_FAILED: "Unable to load data. Please refresh the page.",
  CONFLICT: "This item was modified by someone else. Please refresh and try again.",
  NOT_FOUND: "The requested item could not be found.",
  
  // Feature-specific
  EXPORT_FAILED: "Export failed. Please try again.",
  UPLOAD_FAILED: "Upload failed. Please try again.",
  INVITE_FAILED: "Unable to send invitation. Please try again.",
  MESSAGE_FAILED: "Unable to send message. Please try again.",
} as const;

// =====================================================
// CENTRALIZED ERROR CODE MAPPING
// =====================================================
// These codes are returned by RPC functions and edge functions.
// All server-side errors map to human-friendly UI messages.
// NEVER expose internal codes directly to users.

export const ERROR_CODE_MAP: Record<string, keyof typeof ERROR_MESSAGES> = {
  // Authentication & Authorization
  NOT_AUTHENTICATED: "NOT_AUTHENTICATED",
  UNAUTHORIZED: "NOT_AUTHENTICATED",
  NOT_AUTHORIZED: "ACCESS_DENIED",
  ACCESS_DENIED: "ACCESS_DENIED",
  FORBIDDEN: "ACCESS_DENIED",
  
  // Role-based restrictions
  NOT_PARENT: "NOT_PARENT",
  ROLE_REQUIRED: "NOT_PARENT",
  CHILD_RESTRICTED: "CHILD_ACCOUNT_RESTRICTED",
  THIRD_PARTY_RESTRICTED: "THIRD_PARTY_RESTRICTED",
  
  // Plan & Premium restrictions
  NOT_PREMIUM: "UPGRADE_REQUIRED",
  PREMIUM_REQUIRED: "UPGRADE_REQUIRED",
  LIMIT_REACHED: "LIMIT_REACHED",
  TRIAL_EXPIRED: "TRIAL_EXPIRED",
  
  // Rate limiting
  RATE_LIMIT: "RATE_LIMITED",
  RATE_LIMIT_EXCEEDED: "RATE_LIMITED",
  RATE_LIMITED: "RATE_LIMITED",
  
  // Validation
  VALIDATION_ERROR: "INVALID_INPUT",
  INVALID_INPUT: "INVALID_INPUT",
  INPUT_TOO_LONG: "INVALID_INPUT",
  INVALID_ACTION: "INVALID_INPUT",
  
  // Generic fallbacks
  UNKNOWN_ERROR: "GENERIC",
  INTERNAL_ERROR: "GENERIC",
  SERVER_ERROR: "GENERIC",
} as const;

// Backward compatibility alias
const RPC_ERROR_MAP = ERROR_CODE_MAP;

/**
 * Check if a string looks like a UUID
 */
const isUUID = (str: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
};

/**
 * Check if a string looks like a technical error
 * These should NEVER leak to users
 */
const isTechnicalError = (str: string): boolean => {
  const technicalPatterns = [
    // PostgREST / Supabase errors
    /^PGRST\d+/i,
    /supabase/i,
    /postgres/i,
    /postgrest/i,
    
    // JWT / Auth errors
    /^JWT/i,
    /bearer/i,
    /authorization/i,
    
    // Database constraint errors
    /violates foreign key/i,
    /violates unique constraint/i,
    /violates check constraint/i,
    /not null constraint/i,
    
    // SQL / Schema leaks (table names, columns)
    /relation ".+" does not exist/i,
    /column ".+" does not exist/i,
    /table ".+" does not exist/i,
    /function ".+" does not exist/i,
    /schema ".+"/i,
    
    // Common table names that should never leak
    /\b(profiles|children|parent_children|custody_schedules|family_members|audit_logs|expenses|documents|message_threads|thread_messages|notifications|invitations|subscriptions|user_roles)\b/i,
    
    // Permission / RLS errors
    /permission denied/i,
    /row-level security/i,
    /RLS/i,
    /policy/i,
    
    // Technical error prefixes
    /^Error: /,
    /^TypeError:/,
    /^SyntaxError:/,
    /^ReferenceError:/,
    
    // Stack traces
    /at .+\.(ts|js|tsx|jsx):\d+/i,
    /at async/i,
    
    // Internal IDs in error text
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, // UUID
  ];
  return technicalPatterns.some((pattern) => pattern.test(str));
};

/**
 * Sanitize error message for user display
 * - Maps error codes to human-friendly messages
 * - Removes UUIDs, table names, technical jargon
 * - NEVER exposes internal details
 */
export const sanitizeErrorForUser = (error: unknown): string => {
  // Handle null/undefined
  if (!error) return ERROR_MESSAGES.GENERIC;
  
  // Handle Error objects
  if (error instanceof Error) {
    return sanitizeErrorMessage(error.message);
  }
  
  // Handle RPC/Edge function response objects
  if (typeof error === "object" && error !== null) {
    const obj = error as Record<string, unknown>;
    
    // Handle our standard error format: { error, code } or { ok: false, code, message }
    if ("code" in obj && typeof obj.code === "string") {
      const code = obj.code.toUpperCase();
      const mappedKey = ERROR_CODE_MAP[code];
      
      if (mappedKey) {
        // NEVER use server message if it looks technical
        // Always use our safe mapped message
        return ERROR_MESSAGES[mappedKey];
      }
    }
    
    // Handle Supabase error objects: { message: "..." }
    if ("message" in obj && typeof obj.message === "string") {
      return sanitizeErrorMessage(obj.message);
    }
    
    // Handle edge function errors: { error: "..." }
    if ("error" in obj && typeof obj.error === "string") {
      return sanitizeErrorMessage(obj.error);
    }
  }
  
  // Handle string errors
  if (typeof error === "string") {
    return sanitizeErrorMessage(error);
  }
  
  return ERROR_MESSAGES.GENERIC;
};

/**
 * Sanitize an error message string
 */
const sanitizeErrorMessage = (message: string): string => {
  // If it looks technical, return generic message
  if (isTechnicalError(message)) {
    return ERROR_MESSAGES.GENERIC;
  }
  
  // Remove any UUIDs
  if (isUUID(message) || message.includes("-") && /[0-9a-f]{8}/.test(message)) {
    const sanitized = message.replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      ""
    ).trim();
    
    // If message becomes empty or too short after removing UUID, use generic
    if (sanitized.length < 10) {
      return ERROR_MESSAGES.GENERIC;
    }
    return sanitized;
  }
  
  // Common Supabase/Postgres error translations
  const translations: [RegExp, string][] = [
    [/duplicate key value/i, "This item already exists."],
    [/foreign key constraint/i, "This item is linked to other data."],
    [/not null constraint/i, ERROR_MESSAGES.REQUIRED_FIELD],
    [/invalid input syntax/i, ERROR_MESSAGES.INVALID_INPUT],
    [/JWT expired/i, ERROR_MESSAGES.SESSION_EXPIRED],
    [/no rows returned/i, "Item not found."],
    [/rate limit/i, "Too many requests. Please wait a moment."],
  ];
  
  for (const [pattern, replacement] of translations) {
    if (pattern.test(message)) {
      return replacement;
    }
  }
  
  // If the message is reasonably short and doesn't look technical, use it
  if (message.length < 100 && !isTechnicalError(message)) {
    return message;
  }
  
  return ERROR_MESSAGES.GENERIC;
};

/**
 * Handle and log an error, returning a user-friendly message
 * Also reports to Sentry
 */
export const handleError = (
  error: unknown,
  context?: {
    feature?: string;
    action?: string;
    silent?: boolean;
  }
): string => {
  const userMessage = sanitizeErrorForUser(error);
  
  // Log to Sentry (with full error for debugging)
  if (error instanceof Error) {
    captureError(error, {
      feature: context?.feature,
      action: context?.action,
      extra: { userMessage },
    });
  }
  
  // Console log in development
  if (import.meta.env.DEV) {
    console.error(`[${context?.feature || "Error"}]`, error);
  }
  
  return userMessage;
};

/**
 * Type guard for RPC result format
 */
export interface RpcErrorResult {
  ok: false;
  code: string;
  message?: string;
  meta?: Record<string, unknown>;
}

export const isRpcError = (result: unknown): result is RpcErrorResult => {
  return (
    typeof result === "object" &&
    result !== null &&
    "ok" in result &&
    (result as Record<string, unknown>).ok === false
  );
};
