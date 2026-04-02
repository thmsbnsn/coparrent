import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardCallLauncher } from "@/components/calls/DashboardCallLauncher";

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogTrigger: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

describe("DashboardCallLauncher", () => {
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

  const renderLauncher = async (onStartCall = vi.fn()) => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <DashboardCallLauncher
          contacts={[
            {
              allowedCallMode: "audio_video",
              avatarUrl: null,
              email: "taylor@example.com",
              fullName: "Taylor Parent",
              profileId: "profile-taylor",
              relationshipLabel: "Co-parent",
              role: "parent",
            },
          ]}
          onStartCall={onStartCall}
        />,
      );
    });

    return { container, onStartCall };
  };

  it("renders callable family members and starts an audio call", async () => {
    const { container: rendered, onStartCall } = await renderLauncher();

    expect(rendered.textContent).toContain("Taylor Parent");
    expect(rendered.textContent).toContain("Co-parent");

    const audioButton = Array.from(rendered.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes("Audio"),
    );

    await act(async () => {
      audioButton?.click();
    });

    expect(onStartCall).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: "profile-taylor" }),
      "audio",
    );
  });
});
