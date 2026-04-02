import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChildAccessSettingsCard } from "@/components/settings/ChildAccessSettingsCard";

describe("ChildAccessSettingsCard", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const renderCard = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <MemoryRouter>
          <ChildAccessSettingsCard
            allowedSignInMode="standard_sign_in"
            childEmailResetEnabled={false}
            childName="Milo"
            hasAccount
            loginEnabled
            onQuickUnlockEnabledChange={vi.fn()}
            onSave={vi.fn()}
            quickUnlockEnabled={false}
          />
        </MemoryRouter>,
      );
    });

    return container;
  };

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
  });

  it("renders device access, quick unlock, and child install path guidance", async () => {
    const rendered = await renderCard();

    expect(rendered.textContent).toContain("Child device access");
    expect(rendered.textContent).toContain("Standard sign-in");
    expect(rendered.textContent).toContain("Parent-mediated reset");
    expect(rendered.textContent).toContain("Quick unlock");
    expect(rendered.textContent).toContain("Open child app path");
    expect(rendered.textContent).toContain("/child-app");

    const childPathLink = Array.from(rendered.querySelectorAll("a")).find((anchor) =>
      anchor.textContent?.includes("Open child app path"),
    );
    expect(childPathLink?.getAttribute("href")).toBe("/child-app");
  });
});
