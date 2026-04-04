import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CourtViewToggle } from "@/components/messages/CourtViewToggle";
import { TooltipProvider } from "@/components/ui/tooltip";

describe("CourtViewToggle", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
  });

  const renderToggle = (enabled: boolean, onToggle = vi.fn()) => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <TooltipProvider>
          <CourtViewToggle enabled={enabled} onToggle={onToggle} />
        </TooltipProvider>,
      );
    });

    return {
      button: container.querySelector("button"),
      onToggle,
    };
  };

  it("shows Legal View when the structured document mode is available", () => {
    const { button } = renderToggle(false);

    expect(button?.textContent).toContain("Legal View");
    expect(button?.getAttribute("aria-label")).toBe("Enter legal view");
  });

  it("switches back to Chat View when legal mode is active", () => {
    const { button, onToggle } = renderToggle(true);

    expect(button?.textContent).toContain("Chat View");
    expect(button?.getAttribute("aria-label")).toBe("Exit legal view");

    act(() => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
