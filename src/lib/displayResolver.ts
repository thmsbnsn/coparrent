/**
 * Human-Readable Display Resolver
 * 
 * Prevents internal IDs (UUIDs, tokens, hashes, foreign keys) from ever
 * appearing in the UI. Provides intentional, human-readable labels.
 * 
 * This is a trust-critical, court-facing application.
 * Favor clarity, restraint, and professionalism over cleverness.
 */

/**
 * Context-aware placeholders for different entity types
 */
export const ENTITY_PLACEHOLDERS = {
  person: "Family member",
  sender: "Family member",
  recipient: "Family member",
  child: "Child",
  parent: "Parent",
  invite: "Pending invite",
  document: "Document",
  event: "Event",
  expense: "Expense",
  message: "Message",
  thread: "Conversation",
  activity: "Activity",
  note: "—",
  general: "—",
} as const;

export type EntityType = keyof typeof ENTITY_PLACEHOLDERS;

/**
 * Check if a value looks like an internal identifier
 */
function isInternalIdentifier(value: string): boolean {
  // UUID pattern (with or without hyphens)
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) return true;
  if (/^[a-f0-9]{32}$/i.test(value)) return true;
  
  // Stripe IDs
  if (/^(price_|prod_|sub_|cus_|pi_|ch_|in_|pm_|si_|cs_|evt_|req_)/i.test(value)) return true;
  
  // JWT-like tokens (three dot-separated base64 segments)
  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) return true;
  
  // Generic hash patterns (32+ hex characters)
  if (/^[a-f0-9]{32,}$/i.test(value)) return true;
  
  // Base64 encoded tokens (long random strings)
  if (/^[A-Za-z0-9+/=]{40,}$/.test(value)) return true;
  
  return false;
}

/**
 * Check if a value is human-readable (not an ID/token)
 */
function isHumanReadable(value: string | null | undefined): value is string {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (isInternalIdentifier(trimmed)) return false;
  return true;
}

interface ResolveDisplayNameOptions {
  /** Primary value to display (e.g., full_name) */
  primary?: string | null;
  /** Secondary value to display (e.g., email) */
  secondary?: string | null;
  /** Entity type for context-aware placeholder */
  entityType?: EntityType;
  /** Custom fallback text (overrides entity placeholder) */
  fallback?: string;
}

/**
 * Resolve a human-readable display name from available values.
 * 
 * Rules:
 * - Never return IDs, UUIDs, tokens, hashes, or raw database values
 * - Prefer primary if it exists and is human-readable
 * - Fall back to secondary if present
 * - Otherwise return a neutral, intentional placeholder
 * - Never return "Unknown", "null", or empty strings
 * 
 * @example
 * resolveDisplayName({ primary: user.full_name, secondary: user.email, entityType: "person" })
 * // Returns: "John Doe" or "john@example.com" or "Family member"
 */
export function resolveDisplayName({
  primary,
  secondary,
  entityType = "general",
  fallback,
}: ResolveDisplayNameOptions): string {
  // Try primary value first
  if (isHumanReadable(primary)) {
    return primary;
  }
  
  // Try secondary value
  if (isHumanReadable(secondary)) {
    // For emails, optionally mask the domain for privacy
    return secondary;
  }
  
  // Return intentional placeholder
  return fallback ?? ENTITY_PLACEHOLDERS[entityType];
}

/**
 * Resolve a display value with a simple fallback.
 * Use for non-name fields like notes, descriptions, etc.
 * 
 * @example
 * resolveDisplayValue(expense.notes, "No notes")
 * // Returns: "My expense note" or "No notes"
 */
export function resolveDisplayValue(
  value: string | null | undefined,
  fallback: string = "—"
): string {
  if (isHumanReadable(value)) {
    return value;
  }
  return fallback;
}

/**
 * Resolve a child name with appropriate fallback
 */
export function resolveChildName(name: string | null | undefined): string {
  return resolveDisplayName({ primary: name, entityType: "child" });
}

/**
 * Resolve a person/user name with email fallback
 */
export function resolvePersonName(
  fullName: string | null | undefined,
  email?: string | null
): string {
  return resolveDisplayName({ 
    primary: fullName, 
    secondary: email, 
    entityType: "person" 
  });
}

/**
 * Resolve a message sender name
 */
export function resolveSenderName(
  fullName: string | null | undefined,
  email?: string | null
): string {
  return resolveDisplayName({ 
    primary: fullName, 
    secondary: email, 
    entityType: "sender" 
  });
}

/**
 * Get an email display name (part before @) for privacy
 */
export function getEmailDisplayName(email: string | null | undefined): string {
  if (!email) return ENTITY_PLACEHOLDERS.person;
  const atIndex = email.indexOf("@");
  if (atIndex > 0) {
    return email.substring(0, atIndex);
  }
  return isHumanReadable(email) ? email : ENTITY_PLACEHOLDERS.person;
}

/**
 * Format a display name from name and email, with email privacy option
 */
export function formatDisplayName(
  name: string | null | undefined,
  email: string | null | undefined,
  options: { maskEmail?: boolean } = {}
): string {
  if (isHumanReadable(name)) return name;
  
  if (email && isHumanReadable(email)) {
    return options.maskEmail ? getEmailDisplayName(email) : email;
  }
  
  return ENTITY_PLACEHOLDERS.person;
}

/**
 * Safely resolve any value, ensuring no IDs leak through
 * This is the catch-all safety net for any display value
 */
export function safeResolve(
  value: unknown,
  fallback: string = "—"
): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== "string") return fallback;
  if (!value.trim()) return fallback;
  if (isInternalIdentifier(value)) return fallback;
  return value;
}
