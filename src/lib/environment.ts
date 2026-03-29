const PRODUCTION_HOSTS = new Set([
  "coparrent.com",
  "www.coparrent.com",
  "coparrent.vercel.app",
]);

const STAGING_HOST_PATTERNS = [
  /\.vercel\.app$/i,
];

export type AppEnvironment = "production" | "staging" | "development";

export const getEnvironmentFromHostname = (hostname: string): AppEnvironment => {
  const normalizedHostname = hostname.toLowerCase();

  if (PRODUCTION_HOSTS.has(normalizedHostname)) {
    return "production";
  }

  if (
    normalizedHostname.includes("preview") ||
    STAGING_HOST_PATTERNS.some((pattern) => pattern.test(normalizedHostname))
  ) {
    return "staging";
  }

  return "development";
};

export const getBrowserEnvironment = (): AppEnvironment => {
  if (typeof window === "undefined") {
    return "development";
  }

  return getEnvironmentFromHostname(window.location.hostname);
};
