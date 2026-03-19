/**
 * Sentry Error Monitoring Configuration
 * 
 * Captures:
 * - Frontend React runtime errors
 * - Failed API / Supabase RPC calls
 * - Uncaught promise rejections
 * 
 * Does NOT log:
 * - Message contents
 * - Child PII
 * - Document contents
 */

import * as Sentry from "@sentry/react";
import { getBrowserEnvironment } from "@/lib/environment";

// App version - static for now, can be derived from build metadata later
export const APP_VERSION = "0.9.0-beta";

/**
 * Initialize Sentry error monitoring
 */
export const initSentry = () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  
  // Only initialize if DSN is provided
  if (!dsn) {
    console.info("[Sentry] No DSN configured - error monitoring disabled");
    return;
  }

  Sentry.init({
    dsn,
    environment: getBrowserEnvironment(),
    release: `coparrent@${APP_VERSION}`,
    
    // Sampling - capture all errors, no performance tracing
    tracesSampleRate: 0, // Explicit non-goal: no performance tracing
    replaysSessionSampleRate: 0, // Explicit non-goal: no session replay
    replaysOnErrorSampleRate: 0, // Explicit non-goal: no session replay
    
    // Filter out PII and sensitive data
    beforeSend(event) {
      // Scrub any potential PII from error messages
      if (event.message) {
        event.message = scrubSensitiveData(event.message);
      }
      
      // Scrub exception values
      if (event.exception?.values) {
        event.exception.values.forEach((ex) => {
          if (ex.value) {
            ex.value = scrubSensitiveData(ex.value);
          }
        });
      }
      
      return event;
    },
    
    // Ignore common non-actionable errors
    ignoreErrors: [
      // Browser extensions
      "Extension context invalidated",
      "ResizeObserver loop limit exceeded",
      // Network errors that are expected
      "Failed to fetch",
      "NetworkError",
      "AbortError",
      // Auth errors that are user-facing
      "Invalid login credentials",
      "Email not confirmed",
    ],
  });

  console.info(`[Sentry] Initialized: ${getBrowserEnvironment()} / ${APP_VERSION}`);
};

/**
 * Scrub sensitive data from error messages
 */
const scrubSensitiveData = (text: string): string => {
  // Scrub emails
  text = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL]");
  // Scrub UUIDs (potential child IDs, document IDs, etc.)
  text = text.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "[UUID]");
  // Scrub phone numbers
  text = text.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[PHONE]");
  // Scrub anything that looks like a message content (quoted strings > 50 chars)
  text = text.replace(/"[^"]{50,}"/g, "[CONTENT]");
  return text;
};

/**
 * Set user context for Sentry (role/tier only, no PII)
 */
export const setSentryUserContext = (context: {
  userId?: string;
  role?: "parent" | "guardian" | "third_party" | "child" | null;
  tier?: "free" | "power" | null;
}) => {
  Sentry.setUser({
    // Only include hashed/anonymized user ID if needed for grouping
    id: context.userId ? hashUserId(context.userId) : undefined,
  });
  
  Sentry.setTags({
    userRole: context.role || "unknown",
    subscriptionTier: context.tier || "free",
  });
};

/**
 * Clear user context on logout
 */
export const clearSentryUserContext = () => {
  Sentry.setUser(null);
  Sentry.setTags({
    userRole: "unknown",
    subscriptionTier: "free",
  });
};

/**
 * Set the current route for context
 */
export const setSentryRoute = (routeName: string) => {
  Sentry.setTag("route", routeName);
};

/**
 * Capture an error with additional context
 */
export const captureError = (
  error: Error,
  context?: {
    feature?: string;
    action?: string;
    extra?: Record<string, unknown>;
  }
) => {
  Sentry.captureException(error, {
    tags: {
      feature: context?.feature,
      action: context?.action,
    },
    extra: context?.extra,
  });
};

/**
 * Capture a message (non-error) for monitoring
 */
export const captureMessage = (
  message: string,
  level: "info" | "warning" | "error" = "info"
) => {
  Sentry.captureMessage(scrubSensitiveData(message), level);
};

/**
 * Simple hash function for user ID (privacy-preserving)
 */
const hashUserId = (userId: string): string => {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `u_${Math.abs(hash).toString(16)}`;
};

export default Sentry;
