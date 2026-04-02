import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChildModeInstallCard } from "@/components/pwa/ChildModeInstallCard";
import { useAppInstallState } from "@/hooks/useAppInstallState";

vi.mock("@/hooks/useAppInstallState", () => ({
  useAppInstallState: vi.fn(),
}));

const mockedUseAppInstallState = vi.mocked(useAppInstallState);

describe("ChildModeInstallCard", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const renderCard = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <MemoryRouter>
          <ChildModeInstallCard
            allowSignIn
            childName="Milo"
            signInHref="/login?next=%2Fchild-app"
          />
        </MemoryRouter>,
      );
    });

    return container;
  };

  beforeEach(() => {
    mockedUseAppInstallState.mockReturnValue({
      canPromptInstall: true,
      installState: "promptable",
      isIOS: false,
      isInstalled: false,
      promptInstall: vi.fn().mockResolvedValue("accepted"),
    });
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

  it("shows the install prompt CTA and child sign-in link when the browser can install", async () => {
    const rendered = await renderCard();

    expect(rendered.textContent).toContain("Ready to install");
    expect(rendered.textContent).toContain("Install child mode");
    expect(rendered.textContent).toContain("Continue to child sign-in");

    const signInLink = Array.from(rendered.querySelectorAll("a")).find((anchor) =>
      anchor.textContent?.includes("Continue to child sign-in"),
    );
    expect(signInLink?.getAttribute("href")).toBe("/login?next=%2Fchild-app");
  });

  it("shows the installed state once the app is already running as an installed app", async () => {
    mockedUseAppInstallState.mockReturnValue({
      canPromptInstall: false,
      installState: "installed",
      isIOS: false,
      isInstalled: true,
      promptInstall: vi.fn(),
    });

    const rendered = await renderCard();

    expect(rendered.textContent).toContain("Installed");
    expect(rendered.textContent).toContain("Installed on this device");
  });

  it("reveals manual iPhone install steps when the route needs iOS guidance", async () => {
    mockedUseAppInstallState.mockReturnValue({
      canPromptInstall: false,
      installState: "ios_manual",
      isIOS: true,
      isInstalled: false,
      promptInstall: vi.fn(),
    });

    const rendered = await renderCard();

    expect(rendered.textContent).toContain("Manual iPhone install");
    expect(rendered.textContent).toContain("Step 1");
    expect(rendered.textContent).toContain("Add to Home Screen");
  });
});
