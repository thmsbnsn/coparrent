import type { ComponentProps } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { ThreadSummaryBar } from "@/components/messages/ThreadSummaryBar";

describe("ThreadSummaryBar", () => {
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

  const renderBar = (props: Partial<ComponentProps<typeof ThreadSummaryBar>> = {}) => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <ThreadSummaryBar
          courtView={false}
          threadType="direct_message"
          totalMessages={0}
          unreadCount={0}
          {...props}
        />,
      );
    });

    return container;
  };

  it("shows a loading-existing state without falling back to an empty-thread message", () => {
    const rendered = renderBar({ recordState: "loading_existing" });

    expect(rendered.textContent).toContain("Loading recorded history");
    expect(rendered.textContent).toContain("This thread already has recorded activity.");
    expect(rendered.textContent).not.toContain("The record is open and ready for the first message.");
  });

  it("shows an explicit history-unavailable warning for mismatched direct records", () => {
    const rendered = renderBar({ recordState: "history_unavailable" });

    expect(rendered.textContent).toContain("History unavailable");
    expect(rendered.textContent).toContain("did not hydrate in this view");
  });

  it("makes an active thread read as an existing record instead of a first-message state", () => {
    const rendered = renderBar({ recordState: "ready", totalMessages: 2 });

    expect(rendered.textContent).toContain("Existing record");
    expect(rendered.textContent).toContain("2 messages on record");
    expect(rendered.textContent).toContain("2 recorded messages are visible in order for review.");
    expect(rendered.textContent).not.toContain("First message pending");
  });
});
