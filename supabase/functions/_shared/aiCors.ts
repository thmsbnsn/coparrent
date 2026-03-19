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

// Legacy export for backward compatibility (deprecated - use getCorsHeaders instead)
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
