import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActiveCallPanel } from "@/components/calls/ActiveCallPanel";

describe("ActiveCallPanel", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
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

  it("keeps the end-call control visible during an active video call", async () => {
    const onEnd = vi.fn();

    await act(async () => {
      root?.render(
        <ActiveCallPanel
          callType="video"
          isLocalAudioEnabled
          isLocalVideoEnabled
          localParticipant={null}
          onEnd={onEnd}
          onToggleAudio={vi.fn()}
          onToggleVideo={vi.fn()}
          remoteParticipant={null}
        />,
      );
      await Promise.resolve();
    });

    expect(container?.textContent).toContain("Video call in progress");
    expect(container?.textContent).toContain("Mute mic");
    expect(container?.textContent).toContain("Camera off");
    expect(container?.textContent).toContain("End call");

    const endCallButton = Array.from(container?.querySelectorAll("button") ?? []).find((button) =>
      button.textContent?.includes("End call"),
    );

    expect(endCallButton).toBeTruthy();
    endCallButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});
