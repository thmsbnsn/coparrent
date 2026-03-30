import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import KidsHubPage from "@/pages/KidsHubPage";

vi.mock("@/components/dashboard/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/premium/PremiumFeatureGate", () => ({
  PremiumFeatureGate: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/gates/RoleGate", () => ({
  RoleGate: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: { children?: ReactNode }) => <div {...props}>{children}</div>,
    section: ({ children, ...props }: { children?: ReactNode }) => <section {...props}>{children}</section>,
  },
  useReducedMotion: () => true,
}));

describe("KidsHubPage", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
    vi.clearAllMocks();
  });

  const renderPage = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <MemoryRouter>
          <KidsHubPage />
        </MemoryRouter>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    return container;
  };

  it("does not advertise the hidden chore chart feature", async () => {
    const rendered = await renderPage();

    expect(rendered.textContent).toContain("Kids Hub");
    expect(rendered.textContent).toContain("Coloring Page Creator");
    expect(rendered.textContent).toContain("Activity Generator");
    expect(rendered.textContent).toContain("Creations Library");
    expect(rendered.textContent).toContain("CoParrent Creations");
    expect(rendered.textContent).toContain("Start a health check-in");
    expect(rendered.textContent).not.toContain("Chore Chart Builder");
    expect(rendered.textContent).not.toContain("chore charts");
  });
});
