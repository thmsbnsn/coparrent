import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShareDialog } from "@/components/blog/ShareDialog";

const toast = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast,
  }),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children, ...props }: { children?: ReactNode }) => <div {...props}>{children}</div>,
  DialogDescription: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

describe("ShareDialog", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  const writeText = vi.fn();

  beforeEach(() => {
    toast.mockReset();
    writeText.mockReset();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText,
      },
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

  const renderDialog = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <MemoryRouter>
          <ShareDialog
            open
            onOpenChange={() => undefined}
            title="A Better Co-Parenting Update"
            url="https://coparrent.com/blog/better-update"
          />
        </MemoryRouter>,
      );
    });

    return container;
  };

  it("shows Reddit sharing and copies the article link", async () => {
    const rendered = await renderDialog();

    expect(rendered.textContent).toContain("Facebook");
    expect(rendered.textContent).toContain("Reddit");
    expect(rendered.textContent).toContain("Copy link");

    const messageLink = Array.from(rendered.querySelectorAll("a")).find((candidate) =>
      candidate.textContent?.includes("Share via Message"),
    );

    expect(messageLink?.getAttribute("href")).toContain("/dashboard/messages?share=");

    const copyButton = Array.from(rendered.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes("Copy link"),
    );

    await act(async () => {
      copyButton?.click();
    });

    expect(writeText).toHaveBeenCalledWith("https://coparrent.com/blog/better-update");
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Link copied!",
      }),
    );
  });
});
