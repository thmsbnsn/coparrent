const PASSKEY_ENV_FLAG = import.meta.env.VITE_SUPABASE_PASSKEYS_ENABLED;

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

  return {
    browserSupported,
    projectEnrollmentEnabled,
    canEnrollPasskeys: browserSupported && projectEnrollmentEnabled,
  };
}
