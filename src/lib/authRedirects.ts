const DEFAULT_PUBLIC_APP_URL = "https://coparrent.com";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

interface ResolveAuthBaseUrlOptions {
  currentOrigin?: string | null;
  preferredAppUrl?: string | null;
}

const normalizeBaseUrl = (value: string) => {
  const url = new URL(value);
  return url.origin;
};

export const isLocalOrigin = (value: string | null | undefined) => {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return LOCAL_HOSTNAMES.has(url.hostname);
  } catch {
    return false;
  }
};

export const resolveAuthBaseUrl = ({
  currentOrigin = typeof window !== "undefined" ? window.location.origin : null,
  preferredAppUrl = import.meta.env.VITE_PUBLIC_APP_URL || null,
}: ResolveAuthBaseUrlOptions = {}) => {
  // Always prefer the actual runtime origin when available so preview and local
  // auth flows round-trip back to the environment the user started from.
  if (currentOrigin) {
    return normalizeBaseUrl(currentOrigin);
  }

  if (preferredAppUrl) {
    return normalizeBaseUrl(preferredAppUrl);
  }

  return DEFAULT_PUBLIC_APP_URL;
};

export const buildAuthUrl = (
  path: string,
  options?: ResolveAuthBaseUrlOptions,
) => {
  return new URL(path, `${resolveAuthBaseUrl(options)}/`).toString();
};

export const getOAuthCallbackUrl = (options?: ResolveAuthBaseUrlOptions) =>
  buildAuthUrl("/auth/callback", options);

export const getPasswordResetRedirectUrl = (options?: ResolveAuthBaseUrlOptions) =>
  buildAuthUrl("/reset-password", options);

export const getEmailConfirmationRedirectUrl = (options?: ResolveAuthBaseUrlOptions) =>
  getOAuthCallbackUrl(options);
