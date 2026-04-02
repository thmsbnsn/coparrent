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
  activeFamilyId: "family-1",
  isThirdParty: false,
  isChild: false,
  isLawOffice: false,
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
            <Route path="/law-office/login" element={<div>law-office-login</div>} />
            <Route path="/kids" element={<div>kids-home</div>} />
            <Route path="/dashboard" element={<div>dashboard-home</div>} />
            <Route path="/law-office/dashboard" element={<div>law-office-dashboard</div>} />
            <Route
              path="/kids/*"
              element={
                <ProtectedRoute requireParent={requireParent}>
                  <div>kids-protected-content</div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/*"
              element={
                <ProtectedRoute requireParent={requireParent}>
                  <div>protected-content</div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/law-office/dashboard/*"
              element={
                <ProtectedRoute requireParent={requireParent}>
                  <div>law-office-protected-content</div>
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

  it("redirects unauthenticated law office users to the law office login", () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      loading: false,
    } as never);

    const rendered = renderProtectedRoute("/law-office/dashboard/review");
    expect(rendered.textContent).toContain("law-office-login");
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

  it("allows child-scoped users onto the shared games route when explicitly permitted", () => {
    mockedUseChildAccount.mockReturnValue({
      ...defaultChildAccountState,
      isChildAccount: true,
    } as never);

    const rendered = renderProtectedRoute("/dashboard/games");
    expect(rendered.textContent).toContain("protected-content");
  });

  it("allows child-scoped users onto the shared games lobby route when explicitly permitted", () => {
    mockedUseChildAccount.mockReturnValue({
      ...defaultChildAccountState,
      isChildAccount: true,
    } as never);

    const rendered = renderProtectedRoute("/dashboard/games/flappy-plane/lobby/session-1");
    expect(rendered.textContent).toContain("protected-content");
  });

  it("enforces requireParent even on otherwise accessible dashboard routes", () => {
    mockedUseFamilyRole.mockReturnValue({
      ...defaultFamilyRoleState,
      isThirdParty: true,
    } as never);

    const rendered = renderProtectedRoute("/dashboard/messages", true);
    expect(rendered.textContent).toContain("dashboard-home");
  });

  it("shows an explicit failure state when a family-scoped route is missing active family context", () => {
    mockedUseFamilyRole.mockReturnValue({
      ...defaultFamilyRoleState,
      activeFamilyId: null,
    } as never);

    const rendered = renderProtectedRoute("/dashboard/messages");
    expect(rendered.textContent).toContain("Active family required");
    expect(rendered.textContent).toContain("cannot render without an active family");
    expect(rendered.textContent).toContain("Open onboarding");
  });

  it("fails closed for kids portal routes without an active family", () => {
    mockedUseFamilyRole.mockReturnValue({
      ...defaultFamilyRoleState,
      activeFamilyId: null,
    } as never);
    mockedUseChildAccount.mockReturnValue({
      ...defaultChildAccountState,
      isChildAccount: true,
    } as never);

    const rendered = renderProtectedRoute("/kids/portal");
    expect(rendered.textContent).toContain("Active family required");
  });

  it("fails closed for kids game routes without an active family", () => {
    mockedUseFamilyRole.mockReturnValue({
      ...defaultFamilyRoleState,
      activeFamilyId: null,
    } as never);
    mockedUseChildAccount.mockReturnValue({
      ...defaultChildAccountState,
      isChildAccount: true,
    } as never);

    const rendered = renderProtectedRoute("/kids/games/flappy-plane");
    expect(rendered.textContent).toContain("Active family required");
  });

  it("fails closed for shared games routes without an active family", () => {
    mockedUseFamilyRole.mockReturnValue({
      ...defaultFamilyRoleState,
      activeFamilyId: null,
    } as never);

    const rendered = renderProtectedRoute("/dashboard/games");
    expect(rendered.textContent).toContain("Active family required");
  });

  it("fails closed for shared games lobby routes without an active family", () => {
    mockedUseFamilyRole.mockReturnValue({
      ...defaultFamilyRoleState,
      activeFamilyId: null,
    } as never);

    const rendered = renderProtectedRoute("/dashboard/games/flappy-plane/lobby/session-1");
    expect(rendered.textContent).toContain("Active family required");
  });

  it("denies unknown protected routes by default", () => {
    const rendered = renderProtectedRoute("/dashboard/not-registered");
    expect(rendered.textContent).toContain("dashboard-home");
  });

  it("allows non-family-scoped routes without an active family", () => {
    mockedUseFamilyRole.mockReturnValue({
      ...defaultFamilyRoleState,
      activeFamilyId: null,
      isThirdParty: true,
    } as never);

    const rendered = renderProtectedRoute("/dashboard/law-library");
    expect(rendered.textContent).toContain("protected-content");
  });

  it("keeps law office users out of parent dashboard routes", () => {
    mockedUseFamilyRole.mockReturnValue({
      ...defaultFamilyRoleState,
      activeFamilyId: null,
      isLawOffice: true,
    } as never);

    const rendered = renderProtectedRoute("/dashboard/messages");
    expect(rendered.textContent).toContain("law-office-dashboard");
  });

  it("blocks parent users from the law office dashboard", () => {
    const rendered = renderProtectedRoute("/law-office/dashboard/review");
    expect(rendered.textContent).toContain("dashboard-home");
  });

  it("renders the law office route for a law office user", () => {
    mockedUseFamilyRole.mockReturnValue({
      ...defaultFamilyRoleState,
      activeFamilyId: null,
      isLawOffice: true,
    } as never);

    const rendered = renderProtectedRoute("/law-office/dashboard/review");
    expect(rendered.textContent).toContain("law-office-protected-content");
  });
});
