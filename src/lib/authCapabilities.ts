const PASSKEY_ENV_FLAG = import.meta.env.VITE_SUPABASE_PASSKEYS_ENABLED;
const AUTH_CAPTCHA_ENV_FLAG = import.meta.env.VITE_AUTH_CAPTCHA_ENABLED;
const HCAPTCHA_SITE_KEY = import.meta.env.VITE_HCAPTCHA_SITE_KEY;

function flagEnabled(value: string | boolean | undefined): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return false;
  }

  return value.toLowerCase() === "true";
}

export function isBrowserPasskeySupported(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof window.PublicKeyCredential !== "undefined"
  );
}

export function isProjectPasskeyEnrollmentEnabled(): boolean {
  return flagEnabled(PASSKEY_ENV_FLAG);
}

export function getPasskeySupportState() {
  const browserSupported = isBrowserPasskeySupported();
  const projectEnrollmentEnabled = isProjectPasskeyEnrollmentEnabled();
  const canUsePasskeys = browserSupported && projectEnrollmentEnabled;

  return {
    browserSupported,
    projectEnrollmentEnabled,
    canEnrollPasskeys: canUsePasskeys,
    canUsePasskeys,
  };
}

export function isAuthCaptchaRequired(): boolean {
  if (typeof AUTH_CAPTCHA_ENV_FLAG === "string") {
    return flagEnabled(AUTH_CAPTCHA_ENV_FLAG);
  }

  return Boolean(import.meta.env.PROD);
}

export function getAuthCaptchaState() {
  const required = isAuthCaptchaRequired();
  const siteKey = typeof HCAPTCHA_SITE_KEY === "string" && HCAPTCHA_SITE_KEY.trim().length > 0
    ? HCAPTCHA_SITE_KEY.trim()
    : null;

  return {
    required,
    configured: Boolean(siteKey),
    siteKey,
    canRender: required && Boolean(siteKey),
  };
}
