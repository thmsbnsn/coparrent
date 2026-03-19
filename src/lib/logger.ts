/**
 * Centralized logger with automatic sensitive data redaction
 * Use this instead of console.* in auth flows, API calls, and error handling
 */

import { sanitizeForLog } from "@/lib/safeText";

const isProd = import.meta.env.MODE === "production";

function write(method: "debug" | "info" | "warn" | "error", ...args: unknown[]) {
  // Skip debug logs in production
  if (isProd && method === "debug") return;
  
  // Sanitize all arguments before logging
  const sanitizedArgs = args.map(sanitizeForLog);
  console[method](...sanitizedArgs);
}

/**
 * Safe logging functions that automatically redact sensitive data
 */
export const logger = {
  /**
   * Debug-level logging (skipped in production)
   */
  debug: (...args: unknown[]) => write("debug", ...args),
  
  /**
   * Info-level logging
   */
  info: (...args: unknown[]) => write("info", ...args),
  
  /**
   * Warning-level logging
   */
  warn: (...args: unknown[]) => write("warn", ...args),
  
  /**
   * Error-level logging
   */
  error: (...args: unknown[]) => write("error", ...args),
};

export default logger;
