import { describe, expect, it } from "vitest";
import {
  buildAuthUrl,
  getOAuthCallbackUrl,
  getPasswordResetRedirectUrl,
  resolveAuthBaseUrl,
} from "@/lib/authRedirects";

describe("auth redirect helpers", () => {
  it("prefers the actual runtime origin even when a canonical app url exists", () => {
    expect(
      resolveAuthBaseUrl({
        currentOrigin: "http://127.0.0.1:4174",
        preferredAppUrl: "https://coparrent.com",
      }),
    ).toBe("http://127.0.0.1:4174");
  });

  it("keeps the deployed origin when already running on a real host", () => {
    expect(
      resolveAuthBaseUrl({
        currentOrigin: "https://coparrent-preview.vercel.app",
        preferredAppUrl: null,
      }),
    ).toBe("https://coparrent-preview.vercel.app");
  });

  it("falls back to the canonical production app url from localhost", () => {
    expect(
      resolveAuthBaseUrl({
        currentOrigin: null,
        preferredAppUrl: null,
      }),
    ).toBe("https://coparrent.com");
  });

  it("builds stable callback and recovery urls", () => {
    const options = {
      currentOrigin: "http://127.0.0.1:4174",
      preferredAppUrl: "https://coparrent.com",
    };

    expect(getOAuthCallbackUrl(options)).toBe("http://127.0.0.1:4174/auth/callback");
    expect(getPasswordResetRedirectUrl(options)).toBe("http://127.0.0.1:4174/reset-password");
    expect(buildAuthUrl("/dashboard", options)).toBe("http://127.0.0.1:4174/dashboard");
  });
});
