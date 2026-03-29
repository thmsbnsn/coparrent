/**
 * Shared CORS configuration for Edge Functions
 * Implements strict origin validation with env-based allowlist
 */

// Default allowed origins for production.
// Keep this list narrow and require explicit env config for previews or
// temporary hosts instead of carrying historical domains forever.
const DEFAULT_ALLOWED_ORIGINS = [
  "https://coparrent.com",
  "https://www.coparrent.com",
  "https://coparrent.vercel.app",
];

// Preview wildcard origins must be configured explicitly via
// ALLOWED_ORIGIN_PATTERNS so production defaults stay tight.
const DEFAULT_ALLOWED_ORIGIN_PATTERNS: string[] = [];

// Localhost patterns for development
const LOCALHOST_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https?:\/\/\[::1](:\d+)?$/,
];

/**
 * Get the list of allowed origins from environment
 */
function getAllowedOrigins(): string[] {
  const envOrigins = Deno.env.get("ALLOWED_ORIGINS");

  const configuredOrigins = envOrigins
    ? envOrigins.split(",").map((origin) => normalizeOrigin(origin)).filter(isNonEmptyString)
    : [];

  if (configuredOrigins.length > 0) {
    return configuredOrigins;
  }

  return DEFAULT_ALLOWED_ORIGINS.map(normalizeOrigin).filter(isNonEmptyString);
}

function getAllowedOriginPatterns(): string[] {
  const envPatterns = Deno.env.get("ALLOWED_ORIGIN_PATTERNS");

  const configuredPatterns = envPatterns
    ? envPatterns.split(",").map((pattern) => pattern.trim()).filter(Boolean)
    : [];

  return [...DEFAULT_ALLOWED_ORIGIN_PATTERNS, ...configuredPatterns];
}

function shouldAllowLocalhostOrigins(): boolean {
  const flag = Deno.env.get("ALLOW_LOCALHOST_ORIGINS");

  if (flag === "false") {
    return false;
  }

  if (flag === "true") {
    return true;
  }

  return Deno.env.get("DENO_ENV") === "development";
}

function isNonEmptyString(value: string | null): value is string {
  return Boolean(value);
}

function normalizeOrigin(origin: string | null): string | null {
  if (!origin) {
    return null;
  }

  try {
    return new URL(origin).origin.toLowerCase();
  } catch {
    return null;
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wildcardPatternToRegex(pattern: string): RegExp {
  return new RegExp(`^${escapeRegex(pattern).replace(/\\\*/g, ".*")}$`, "i");
}

function isOriginAllowedByPattern(origin: string, pattern: string): boolean {
  return wildcardPatternToRegex(pattern).test(origin);
}

/**
 * Validate if an origin is allowed
 */
export function isOriginAllowed(origin: string | null): boolean {
  const normalizedOrigin = normalizeOrigin(origin);

  if (!normalizedOrigin) {
    return false;
  }

  // Check allowed origins list
  const allowedOrigins = getAllowedOrigins();
  if (allowedOrigins.includes(normalizedOrigin)) {
    return true;
  }

  const allowedOriginPatterns = getAllowedOriginPatterns();
  if (allowedOriginPatterns.some((pattern) => isOriginAllowedByPattern(normalizedOrigin, pattern))) {
    return true;
  }

  // Allow localhost during explicit QA or local development.
  if (shouldAllowLocalhostOrigins()) {
    for (const pattern of LOCALHOST_PATTERNS) {
      if (pattern.test(normalizedOrigin)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get CORS headers for a request
 * Returns appropriate headers based on origin validation
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  
  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400", // Cache preflight for 24 hours
  };

  if (isOriginAllowed(origin)) {
    corsHeaders["Access-Control-Allow-Origin"] = origin!;
    corsHeaders["Access-Control-Allow-Credentials"] = "true";
  }

  return corsHeaders;
}

/**
 * Handle CORS preflight (OPTIONS) request
 */
export function handleCorsPreflightRequest(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    const origin = req.headers.get("Origin");
    
    if (isOriginAllowed(origin)) {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(req),
      });
    }
    
    // Reject preflight for disallowed origins
    return new Response(null, { status: 403 });
  }
  
  return null;
}

/**
 * Validate origin and return error response if blocked
 */
export function validateOrigin(req: Request): Response | null {
  const origin = req.headers.get("Origin");
  
  // Allow requests without Origin header (e.g., server-to-server, cron jobs)
  if (!origin) {
    return null;
  }
  
  if (!isOriginAllowed(origin)) {
    console.warn(`Blocked request from disallowed origin: ${origin}`);
    return new Response(
      JSON.stringify({ 
        error: "Origin not allowed", 
        code: "CORS_BLOCKED" 
      }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
  
  return null;
}

/**
 * Strict CORS middleware - validates origin before processing
 * Returns null if allowed, Response if blocked
 */
export function strictCors(req: Request): Response | null {
  // Handle preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) {
    return preflightResponse;
  }
  
  // Validate origin for actual request
  return validateOrigin(req);
}
