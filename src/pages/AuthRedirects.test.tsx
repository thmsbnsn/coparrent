import type { ComponentType, ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/contexts/AuthContext";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import { ensureCurrentUserFamilyMembership } from "@/lib/familyMembership";

const from = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => vi.fn());
const signInWithPassword = vi.hoisted(() => vi.fn());
const signInWithOAuth = vi.hoisted(() => vi.fn());
const signUp = vi.hoisted(() => vi.fn());
const signOut = vi.hoisted(() => vi.fn());
const listFactors = vi.hoisted(() => vi.fn());
const profileMaybeSingle = vi.hoisted(() => vi.fn());
const parentChildrenEq = vi.hoisted(() => vi.fn());
const mockedEnsureFamilyMembership = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from,
    auth: {
      signInWithPassword,
      signInWithOAuth,
      signUp,
      signOut,
      mfa: {
        listFactors,
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

vi.mock("@/lib/familyMembership", () => ({
  ensureCurrentUserFamilyMembership: mockedEnsureFamilyMembership,
}));

vi.mock("@/components/auth/SocialLoginButtons", () => ({
  SocialLoginButtons: () => <div>social-login-buttons</div>,
}));

vi.mock("@/components/auth/TwoFactorVerify", () => ({
  TwoFactorVerify: () => <div>two-factor-verify</div>,
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
    div: ({
      children,
      ...props
    }: {
      children?: ReactNode;
      className?: string;
    }) => <div {...props}>{children}</div>,
    h2: ({
      children,
      ...props
    }: {
      children?: ReactNode;
      className?: string;
    }) => <h2 {...props}>{children}</h2>,
    p: ({
      children,
      ...props
    }: {
      children?: ReactNode;
      className?: string;
    }) => <p {...props}>{children}</p>,
  },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedEnsureFamily = vi.mocked(ensureCurrentUserFamilyMembership);

const defaultUser = {
  id: "user-1",
  email: "taylor@example.com",
  user_metadata: {
    full_name: "Taylor User",
  },
};

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const loginAndSignupPages = [
  {
    label: "Login",
    path: "/login",
    Component: Login,
  },
  {
    label: "Signup",
    path: "/signup",
    Component: Signup,
  },
] satisfies Array<{
  label: string;
  path: string;
  Component: ComponentType;
}>;

describe("auth redirect handoff", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const renderAuthPage = async (Component: ComponentType, path: string) => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/dashboard" element={<div>dashboard-page</div>} />
            <Route path="/onboarding" element={<div>onboarding-page</div>} />
            <Route path="/accept-invite" element={<div>accept-invite-page</div>} />
            <Route path="/login" element={Component === Login ? <Login /> : <div>login-page</div>} />
            <Route path="/signup" element={Component === Signup ? <Signup /> : <div>signup-page</div>} />
          </Routes>
        </MemoryRouter>,
      );
      await flushPromises();
    });

    return container;
  };

  beforeEach(() => {
    mockedUseAuth.mockReturnValue({
      user: defaultUser,
      loading: false,
    } as never);

    mockedEnsureFamily.mockReset();
    mockedEnsureFamily.mockResolvedValue({
      familyId: "family-1",
      role: "parent",
      created: false,
    });

    toast.mockReset();
    signInWithPassword.mockReset();
    signInWithOAuth.mockReset();
    signUp.mockReset();
    signOut.mockReset();
    listFactors.mockReset();
    profileMaybeSingle.mockReset();
    parentChildrenEq.mockReset();

    profileMaybeSingle.mockResolvedValue({
      data: null,
    });
    parentChildrenEq.mockResolvedValue({
      count: 0,
    });

    from.mockReset();
    from.mockImplementation((tableName: string) => {
      if (tableName === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: profileMaybeSingle,
            }),
          }),
        };
      }

      if (tableName === "parent_children") {
        return {
          select: () => ({
            eq: parentChildrenEq,
          }),
        };
      }

      throw new Error(`Unexpected table access: ${tableName}`);
    });

    sessionStorage.clear();
    localStorage.clear();
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

  describe.each(loginAndSignupPages)("$label", ({ Component, label, path }) => {
    it("routes pending invite holders directly to invite acceptance", async () => {
      sessionStorage.setItem("pendingInviteToken", "invite-123");

      const rendered = await renderAuthPage(Component, path);

      expect(rendered.textContent).toContain("accept-invite-page");
      expect(mockedEnsureFamily).not.toHaveBeenCalled();
      expect(from).not.toHaveBeenCalled();
    });

    it("sends users without a profile to onboarding after family bootstrap", async () => {
      profileMaybeSingle.mockResolvedValue({
        data: null,
      });

      const rendered = await renderAuthPage(Component, path);

      expect(mockedEnsureFamily).toHaveBeenCalledWith("Taylor User");
      expect(rendered.textContent).toContain("onboarding-page");
      expect(parentChildrenEq).not.toHaveBeenCalled();
    });

    it("sends users with existing children to the dashboard", async () => {
      profileMaybeSingle.mockResolvedValue({
        data: {
          id: "profile-1",
        },
      });
      parentChildrenEq.mockResolvedValue({
        count: 2,
      });

      const rendered = await renderAuthPage(Component, path);

      expect(mockedEnsureFamily).toHaveBeenCalledWith("Taylor User");
      expect(parentChildrenEq).toHaveBeenCalledWith("parent_id", "profile-1");
      expect(rendered.textContent).toContain("dashboard-page");
    });
  });
});
