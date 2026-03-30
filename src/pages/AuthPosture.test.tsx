import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/contexts/AuthContext";
import Login from "@/pages/Login";
import AuthCallback from "@/pages/AuthCallback";
import { PasskeySetup } from "@/components/auth/PasskeySetup";
import { getAuthCaptchaState, getPasskeySupportState } from "@/lib/authCapabilities";

const toast = vi.hoisted(() => vi.fn());
const signInWithPassword = vi.hoisted(() => vi.fn());
const signOut = vi.hoisted(() => vi.fn());
const listFactors = vi.hoisted(() => vi.fn());
const getAuthenticatorAssuranceLevel = vi.hoisted(() => vi.fn());
const exchangeCodeForSession = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithPassword,
      signOut,
      exchangeCodeForSession,
      mfa: {
        listFactors,
        getAuthenticatorAssuranceLevel,
      },
    },
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast,
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/postAuthPath", () => ({
  resolvePostAuthPath: vi.fn().mockResolvedValue("/dashboard"),
}));

vi.mock("@/lib/authCapabilities", async () => {
  const actual = await vi.importActual<typeof import("@/lib/authCapabilities")>("@/lib/authCapabilities");

  return {
    ...actual,
    getAuthCaptchaState: vi.fn(),
    getPasskeySupportState: vi.fn(),
  };
});

vi.mock("@/components/auth/AuthCaptcha", async () => {
  const React = await import("react");

  return {
    AuthCaptcha: ({
      onTokenChange,
    }: {
      onTokenChange: (token: string | null) => void;
    }) => {
      React.useEffect(() => {
        onTokenChange("captcha-token-prod");
      }, [onTokenChange]);

      return <div>auth-captcha</div>;
    },
  };
});

vi.mock("@/components/auth/SocialLoginButtons", () => ({
  SocialLoginButtons: () => <div>social-login-buttons</div>,
}));

vi.mock("@/components/auth/TwoFactorVerify", () => ({
  TwoFactorVerify: () => <div>two-factor-verify</div>,
}));

vi.mock("@/components/auth/PasskeyVerify", () => ({
  PasskeyVerify: () => <div>passkey-verify</div>,
}));

vi.mock("@/components/auth/PasswordStrengthIndicator", () => ({
  PasswordStrengthIndicator: () => <div>password-strength-indicator</div>,
}));

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean;
    onCheckedChange?: (value: boolean) => void;
  }) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
    />
  ),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: { children?: ReactNode; className?: string }) => <div {...props}>{children}</div>,
    h2: ({ children, ...props }: { children?: ReactNode; className?: string }) => <h2 {...props}>{children}</h2>,
    p: ({ children, ...props }: { children?: ReactNode; className?: string }) => <p {...props}>{children}</p>,
  },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedGetAuthCaptchaState = vi.mocked(getAuthCaptchaState);
const mockedGetPasskeySupportState = vi.mocked(getPasskeySupportState);

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const getInputById = (container: HTMLDivElement, id: string) => {
  const input = container.querySelector<HTMLInputElement>(`#${id}`);
  if (!input) {
    throw new Error(`Input not found: ${id}`);
  }

  return input;
};

const getButtonByText = (container: HTMLDivElement, text: string) => {
  const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
    candidate.textContent?.includes(text),
  );

  if (!button) {
    throw new Error(`Button not found: ${text}`);
  }

  return button;
};

const setInputValue = (input: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;

  if (!setter) {
    throw new Error("Unable to access native input value setter");
  }

  setter.call(input, value);
  input.dispatchEvent(new Event("change", { bubbles: true }));
};

describe("production auth posture", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const renderAtRoute = async (initialEntry: string, element: ReactNode) => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/login" element={element} />
            <Route path="/auth/callback" element={element} />
            <Route path="/dashboard" element={<div>dashboard-page</div>} />
            <Route path="/" element={<div>home-page</div>} />
          </Routes>
        </MemoryRouter>,
      );
      await flushPromises();
    });

    return container;
  };

  beforeEach(() => {
    mockedUseAuth.mockReturnValue({
      user: null,
      loading: false,
    } as never);

    mockedGetAuthCaptchaState.mockReturnValue({
      required: false,
      configured: false,
      siteKey: null,
      canRender: false,
    });

    mockedGetPasskeySupportState.mockReturnValue({
      browserSupported: true,
      projectEnrollmentEnabled: true,
      canEnrollPasskeys: true,
      canUsePasskeys: true,
    });

    toast.mockReset();
    signInWithPassword.mockReset();
    signOut.mockReset();
    listFactors.mockReset();
    getAuthenticatorAssuranceLevel.mockReset();
    exchangeCodeForSession.mockReset();
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
    vi.clearAllMocks();
  });

  it("requires and sends captcha in the production login flow", async () => {
    mockedGetAuthCaptchaState.mockReturnValue({
      required: true,
      configured: true,
      siteKey: "site-key",
      canRender: true,
    });

    signInWithPassword.mockResolvedValue({
      data: {
        session: null,
      },
      error: null,
    });
    listFactors.mockResolvedValue({
      data: {
        totp: [],
        webauthn: [],
      },
    });

    const rendered = await renderAtRoute("/login", <Login />);
    const emailInput = getInputById(rendered, "email");
    const passwordInput = getInputById(rendered, "password");
    const submitButton = getButtonByText(rendered, "Sign in");

    await act(async () => {
      setInputValue(emailInput, "parent@example.com");
      setInputValue(passwordInput, "Password123!");
      await flushPromises();
    });

    expect(rendered.textContent).toContain("auth-captcha");

    await act(async () => {
      submitButton.click();
      await flushPromises();
    });

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "parent@example.com",
      password: "Password123!",
      options: {
        captchaToken: "captcha-token-prod",
      },
    });
  });

  it("hides passkey setup UI when passkeys are unavailable", async () => {
    mockedGetPasskeySupportState.mockReturnValue({
      browserSupported: true,
      projectEnrollmentEnabled: false,
      canEnrollPasskeys: false,
      canUsePasskeys: false,
    });

    listFactors.mockResolvedValue({
      data: {
        totp: [],
        webauthn: [],
      },
      error: null,
    });

    const rendered = await renderAtRoute("/login", <PasskeySetup />);

    expect(rendered.textContent).not.toContain("Passkeys");
    expect(rendered.querySelector("button")).toBeNull();
  });

  it("shows only supported MFA methods when passkeys are unavailable", async () => {
    mockedGetPasskeySupportState.mockReturnValue({
      browserSupported: true,
      projectEnrollmentEnabled: false,
      canEnrollPasskeys: false,
      canUsePasskeys: false,
    });

    signInWithPassword.mockResolvedValue({
      data: {
        session: {
          access_token: "session-token",
        },
      },
      error: null,
    });
    listFactors.mockResolvedValue({
      data: {
        totp: [{ id: "totp-1", status: "verified", friendly_name: "Authenticator" }],
        webauthn: [{ id: "passkey-1", status: "verified", friendly_name: "MacBook Passkey" }],
      },
    });

    const rendered = await renderAtRoute("/login", <Login />);
    const emailInput = getInputById(rendered, "email");
    const passwordInput = getInputById(rendered, "password");
    const submitButton = getButtonByText(rendered, "Sign in");

    await act(async () => {
      setInputValue(emailInput, "parent@example.com");
      setInputValue(passwordInput, "Password123!");
      await flushPromises();
    });

    await act(async () => {
      submitButton.click();
      await flushPromises();
    });

    expect(rendered.textContent).toContain("two-factor-verify");
    expect(rendered.textContent).not.toContain("passkey-verify");
    expect(rendered.textContent).not.toContain("Use a passkey instead");
  });

  it("removes dead-end passkey CTAs from auth callback MFA flows", async () => {
    mockedUseAuth.mockReturnValue({
      user: {
        id: "user-1",
        email: "parent@example.com",
      },
      loading: false,
    } as never);
    mockedGetPasskeySupportState.mockReturnValue({
      browserSupported: true,
      projectEnrollmentEnabled: false,
      canEnrollPasskeys: false,
      canUsePasskeys: false,
    });

    getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: {
        currentLevel: "aal1",
      },
      error: null,
    });
    listFactors.mockResolvedValue({
      data: {
        totp: [],
        webauthn: [{ id: "passkey-1", status: "verified", friendly_name: "MacBook Passkey" }],
      },
      error: null,
    });

    const rendered = await renderAtRoute("/auth/callback", <AuthCallback />);

    expect(rendered.textContent).toContain("Passkey verification unavailable");
    expect(rendered.textContent).not.toContain("passkey-verify");
    expect(rendered.textContent).not.toContain("Use passkey");
  });
});
