/**
 * CORS configuration for AI Edge Functions
 * Re-exports from shared cors module for AI-specific use
 */

// Re-export everything from the shared cors module
export {
  isOriginAllowed,
  getCorsHeaders,
  handleCorsPreflightRequest,
  validateOrigin,
  strictCors,
} from "./cors.ts";
