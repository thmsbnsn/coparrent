/**
 * Branded type guards for safe display text
 * Prevents accidental leaking of internal IDs, tokens, or secrets into the UI
 */

export type HumanLabel = string & { readonly __brand: "HumanLabel" };

// Detection patterns for sensitive strings
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_LONG_RE = /^[0-9a-f]{20,}$/i;
const JWT_RE = /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const BASE64ISH_RE = /^[A-Za-z0-9+/_-]{20,}={0,2}$/;
const BEARER_RE = /^Bearer\s+/i;

// Internal ID prefixes (Supabase, Stripe, internal tokens)
const INTERNAL_PREFIX_RE =
  /^(tok_|token_|auth_|user_|profile_|child_|inv_|msg_|sess_|pk_|sk_|sub_|cus_|pi_|price_|prod_|ch_|in_|whsec_)/i;

/**
 * Detects if a string looks like an internal ID, token, JWT, or other sensitive value
 */
export function isSensitiveString(value: string): boolean {
  const v = value.trim();
  if (!v) return false;

  // Check for obvious patterns
  if (UUID_RE.test(v)) return true;
  if (HEX_LONG_RE.test(v)) return true;
  if (JWT_RE.test(v)) return true;
  if (BEARER_RE.test(v)) return true;
  if (INTERNAL_PREFIX_RE.test(v)) return true;

  // Long base64-ish strings are suspicious
  if (BASE64ISH_RE.test(v) && v.length >= 24) return true;

  // High digit density + length = suspicious ID
  const alnum = v.replace(/[^a-z0-9]/gi, "");
  if (v.length >= 18 && alnum.length / v.length > 0.85 && /\d/.test(v)) return true;

  return false;
}

/**
 * Normalizes a string for display (trims and collapses whitespace)
 */
function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Resolves a human-readable display name from multiple candidates
 * Returns a branded HumanLabel type that's safe to render in UI
 * 
 * Rules:
 * - Prefers primary, then secondary, then fallback
 * - Rejects any candidate that looks like a sensitive string
 * - Never returns empty strings or raw IDs
 */
export function resolveDisplayName(args: {
  primary?: string | null;
  secondary?: string | null;
  fallback: string;
}): HumanLabel {
  const fallback = normalize(args.fallback) || "—";

  const candidates = [args.primary, args.secondary]
    .filter((x): x is string => typeof x === "string")
    .map(normalize)
    .filter(Boolean);

  for (const c of candidates) {
    if (!isSensitiveString(c)) return c as HumanLabel;
  }
  return fallback as HumanLabel;
}

/**
 * Type-safe wrapper to convert a verified string to HumanLabel
 * Use when you've already validated the string is safe to display
 */
export function asHumanLabel(value: string): HumanLabel {
  const normalized = normalize(value);
  if (!normalized || isSensitiveString(normalized)) {
    return "—" as HumanLabel;
  }
  return normalized as HumanLabel;
}

/**
 * Redacts a sensitive string value for logging/display
 */
export function redactSensitive(value: string): string {
  const v = value.trim();
  if (!v) return v;
  return isSensitiveString(v) ? "[REDACTED]" : v;
}

// Keys that should always be redacted in logs
const SENSITIVE_KEY_RE =
  /(password|pass|pwd|token|access_token|refresh_token|authorization|secret|session|jwt|bearer|api_key|apikey|private_key|credential)/i;

/**
 * Recursively sanitizes an object for safe logging
 * Redacts sensitive keys and values that look like tokens/IDs
 */
export function sanitizeForLog(input: unknown): unknown {
  if (typeof input === "string") return redactSensitive(input);
  if (typeof input === "number" || typeof input === "boolean" || input == null) return input;

  if (Array.isArray(input)) return input.map(sanitizeForLog);

  if (input instanceof Error) {
    return {
      name: input.name,
      message: redactSensitive(input.message),
      stack: input.stack ? "[STACK_REDACTED]" : undefined,
    };
  }

  if (typeof input === "object") {
    const obj = input as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (SENSITIVE_KEY_RE.test(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = sanitizeForLog(v);
      }
    }
    return out;
  }

  return input;
}

/**
 * Creates a user-friendly error message from an error object
 * Never exposes raw error details that might contain sensitive info
 */
export function safeErrorMessage(error: unknown, genericMessage = "An error occurred. Please try again."): string {
  if (!error) return genericMessage;
  
  if (error instanceof Error) {
    const msg = error.message;
    // Check if the message contains sensitive data
    if (isSensitiveString(msg)) {
      return genericMessage;
    }
    // Keep simple, user-friendly messages
    if (msg.length < 200 && !msg.includes("at ") && !msg.includes("Error:")) {
      return msg;
    }
  }
  
  return genericMessage;
}
