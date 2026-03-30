import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProblemReportProvider } from "@/components/feedback/ProblemReportContext";

const mockUseIsMobile = vi.fn<boolean, []>(() => true);
const mockMotionSupport = vi.fn(() => ({
  supported: false,
  likelyMobile: true,
  secure: true,
  permissionRequired: false,
}));
const mockPreferences = vi.fn(() => ({
  dismissedMotionNudge: false,
  lastTriggerAt: null,
  motionPermissionState: "unsupported" as const,
  shakeEnabled: false,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { email: "parent@example.com" } }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

vi.mock("@/hooks/useShakeDetection", () => ({
  useShakeDetection: () => undefined,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/components/feedback/MotionPermissionPrompt", () => ({
  MotionPermissionPrompt: () => null,
}));

vi.mock("@/components/feedback/ReportProblemModal", () => ({
  ReportProblemModal: () => null,
}));

vi.mock("@/lib/problem-report/deviceMotion", () => ({
  getMotionSupportSnapshot: () => mockMotionSupport(),
  getMotionPermissionStateFromSupport: (_snapshot: unknown, storedState: string) => storedState,
}));

vi.mock("@/lib/problem-report/preferences", () => ({
  getProblemReportPreferences: () => mockPreferences(),
  updateProblemReportPreferences: (patch: Record<string, unknown>) => ({
    ...mockPreferences(),
    ...patch,
  }),
}));

vi.mock("@/lib/problem-report/payload", () => ({
  buildProblemReportPayload: () => ({}),
}));

vi.mock("@/lib/problem-report/submitProblemReport", () => ({
  submitProblemReport: vi.fn(async () => undefined),
}));

describe("ProblemReportProvider", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIsMobile.mockReturnValue(true);
    mockMotionSupport.mockReturnValue({
      supported: false,
      likelyMobile: true,
      secure: true,
      permissionRequired: false,
    });
    mockPreferences.mockReturnValue({
      dismissedMotionNudge: false,
      lastTriggerAt: null,
      motionPermissionState: "unsupported",
      shakeEnabled: false,
    });
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
  });

  const renderProvider = async (path: string) => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={[path]}>
          <ProblemReportProvider>
            <div>page content</div>
          </ProblemReportProvider>
        </MemoryRouter>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    return container;
  };

  it("reserves mobile bottom space and shows the floating launcher on non-messaging routes", async () => {
    const rendered = await renderProvider("/dashboard/kids-hub");

    expect(rendered.querySelector('[data-testid="problem-report-floating-spacer"]')).not.toBeNull();
    expect(rendered.querySelector('[data-testid="problem-report-floating-launcher"]')).not.toBeNull();
    expect(rendered.textContent).toContain("Report a problem");
  });

  it("suppresses the floating launcher on messaging routes", async () => {
    const rendered = await renderProvider("/dashboard/messages");

    expect(rendered.querySelector('[data-testid="problem-report-floating-spacer"]')).toBeNull();
    expect(rendered.querySelector('[data-testid="problem-report-floating-launcher"]')).toBeNull();
    expect(rendered.textContent).not.toContain("Report a problem");
  });

  it("keeps the floating launcher hidden when shake reporting was already enabled on this device", async () => {
    mockMotionSupport.mockReturnValue({
      supported: true,
      likelyMobile: true,
      secure: true,
      permissionRequired: false,
    });
    mockPreferences.mockReturnValue({
      dismissedMotionNudge: true,
      lastTriggerAt: null,
      motionPermissionState: "granted",
      shakeEnabled: true,
    });

    const rendered = await renderProvider("/dashboard/kids-hub");

    expect(rendered.querySelector('[data-testid="problem-report-floating-spacer"]')).toBeNull();
    expect(rendered.querySelector('[data-testid="problem-report-floating-launcher"]')).toBeNull();
    expect(rendered.textContent).not.toContain("Report a problem");
  });
});
