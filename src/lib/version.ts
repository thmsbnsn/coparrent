/**
 * Application version and build info
 * 
 * Keep this in sync with:
 * - src/lib/sentry.ts
 * - supabase/functions/health/index.ts
 */

import { getBrowserEnvironment } from "@/lib/environment";

export const APP_VERSION = "0.9.0-beta";
export const BUILD_DATE = "2026-03-19";

/**
 * Get environment name
 */
export const getEnvironment = (): "production" | "staging" | "development" => {
  return getBrowserEnvironment();
};

/**
 * Get version info object
 */
export const getVersionInfo = () => ({
  version: APP_VERSION,
  buildDate: BUILD_DATE,
  environment: getEnvironment(),
});
