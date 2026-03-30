import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("@/components/ProtectedRoute", () => ({
  ProtectedRoute: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock("@/contexts/AuthContext", () => ({
  AuthProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock("@/contexts/FamilyContext", () => ({
  FamilyProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ThemeProvider", () => ({
  ThemeProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/feedback/ProblemReportContext", () => ({
  ProblemReportProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/RouteErrorBoundary", () => ({
  RouteErrorBoundary: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/toaster", () => ({
  Toaster: () => null,
}));

vi.mock("@/components/ui/sonner", () => ({
  Toaster: () => null,
}));

vi.mock("@/components/pwa/OfflineIndicator", () => ({
  OfflineIndicator: () => null,
}));

vi.mock("@/components/pwa/PWAInstallPrompt", () => ({
  PWAInstallPrompt: () => null,
}));

vi.mock("@/components/pwa/PWAUpdatePrompt", () => ({
  PWAUpdatePrompt: () => null,
}));

vi.mock("@/components/legal/CookieConsentBanner", () => ({
  CookieConsentBanner: () => null,
}));

vi.mock("@/components/ui/LoadingSpinner", () => ({
  LoadingSpinner: () => <div>loading-page</div>,
}));

vi.mock("./pages/MessagingHubPage", () => ({
  default: () => <div>messaging-hub-page</div>,
}));

vi.mock("./pages/KidsHubPage", () => ({
  default: () => <div>kids-hub-page</div>,
}));

const renderAppAtPath = async (path: string) => {
  window.history.replaceState({}, "", path);

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<App />);
    await Promise.resolve();
    await Promise.resolve();
  });

  return { container, root };
};

describe("App messaging routes", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
  });

  it("makes /dashboard/messages-legacy unreachable by replacing it with Messaging Hub", async () => {
    const rendered = await renderAppAtPath("/dashboard/messages-legacy");
    container = rendered.container;
    root = rendered.root;

    expect(window.location.pathname).toBe("/dashboard/messages");
    expect(container.textContent).toContain("messaging-hub-page");
  });

  it("still loads Messaging Hub at /dashboard/messages", async () => {
    const rendered = await renderAppAtPath("/dashboard/messages");
    container = rendered.container;
    root = rendered.root;

    expect(window.location.pathname).toBe("/dashboard/messages");
    expect(container.textContent).toContain("messaging-hub-page");
  });

  it("hides /dashboard/kids-hub/chore-chart by replacing it with Kids Hub", async () => {
    const rendered = await renderAppAtPath("/dashboard/kids-hub/chore-chart");
    container = rendered.container;
    root = rendered.root;

    expect(window.location.pathname).toBe("/dashboard/kids-hub");
    expect(container.textContent).toContain("kids-hub-page");
  });
});
