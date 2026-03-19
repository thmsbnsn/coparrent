import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { useChildAccount } from "@/hooks/useChildAccount";
import { useFamilyRole } from "@/hooks/useFamilyRole";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/useFamilyRole", () => ({
  useFamilyRole: vi.fn(),
}));

vi.mock("@/hooks/useChildAccount", () => ({
  useChildAccount: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseFamilyRole = vi.mocked(useFamilyRole);
const mockedUseChildAccount = vi.mocked(useChildAccount);

const defaultAuthState = {
  user: { id: "user-1" },
  loading: false,
};

const defaultFamilyRoleState = {
  isThirdParty: false,
  isChild: false,
  loading: false,
};

const defaultChildAccountState = {
  isChildAccount: false,
  loading: false,
};

describe("ProtectedRoute", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    mockedUseAuth.mockReturnValue(defaultAuthState as never);
    mockedUseFamilyRole.mockReturnValue(defaultFamilyRoleState as never);
    mockedUseChildAccount.mockReturnValue(defaultChildAccountState as never);
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

  const renderProtectedRoute = (initialPath: string, requireParent = false) => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route path="/login" element={<div>login-page</div>} />
            <Route path="/kids" element={<div>kids-home</div>} />
            <Route path="/dashboard" element={<div>dashboard-home</div>} />
            <Route
              path="/dashboard/*"
              element={
                <ProtectedRoute requireParent={requireParent}>
                  <div>protected-content</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>,
      );
    });

    return container;
  };

  it("shows a loading state while auth or role checks are still resolving", () => {
    mockedUseAuth.mockReturnValue({
      ...defaultAuthState,
      loading: true,
    } as never);

    const rendered = renderProtectedRoute("/dashboard/expenses");
    expect(rendered.textContent).toContain("Loading...");
  });

  it("redirects unauthenticated users to login", () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      loading: false,
    } as never);

    const rendered = renderProtectedRoute("/dashboard/expenses");
    expect(rendered.textContent).toContain("login-page");
  });

  it("renders protected content for an authenticated parent", () => {
    const rendered = renderProtectedRoute("/dashboard/expenses");
    expect(rendered.textContent).toContain("protected-content");
  });

  it("redirects third-party users away from parent-only dashboard routes", () => {
    mockedUseFamilyRole.mockReturnValue({
      ...defaultFamilyRoleState,
      isThirdParty: true,
    } as never);

    const rendered = renderProtectedRoute("/dashboard/expenses");
    expect(rendered.textContent).toContain("dashboard-home");
  });

  it("redirects child-scoped users to the kids dashboard for restricted routes", () => {
    mockedUseChildAccount.mockReturnValue({
      ...defaultChildAccountState,
      isChildAccount: true,
    } as never);

    const rendered = renderProtectedRoute("/dashboard/settings");
    expect(rendered.textContent).toContain("kids-home");
  });

  it("enforces requireParent even on otherwise accessible dashboard routes", () => {
    mockedUseFamilyRole.mockReturnValue({
      ...defaultFamilyRoleState,
      isThirdParty: true,
    } as never);

    const rendered = renderProtectedRoute("/dashboard/messages", true);
    expect(rendered.textContent).toContain("dashboard-home");
  });
});
