import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ParentApprovalSheet } from "@/components/kids/ParentApprovalSheet";

describe("ParentApprovalSheet", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const renderSheet = async (onDecision = vi.fn()) => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <ParentApprovalSheet
          open
          loading={false}
          onDecision={onDecision}
          onOpenChange={vi.fn()}
          requests={[
            {
              child_id: "child-1",
              child_name: "Milo",
              id: "request-1",
              portal_mode: "under_6",
              requested_at: "2026-04-01T12:00:00.000Z",
              requested_by_name: "Milo",
              requested_by_profile_id: "profile-1",
              status: "pending",
            },
          ]}
        />,
      );
    });

    return { onDecision };
  };

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
    vi.clearAllMocks();
  });

  it("renders the pending approval request", async () => {
    await renderSheet();
    expect(document.body.textContent).toContain("Milo");
    expect(document.body.textContent).toContain("Approve");
    expect(document.body.textContent).toContain("Decline");
  });

  it("passes approval decisions back to the caller", async () => {
    const { onDecision } = await renderSheet();

    await act(async () => {
      const approveButton = Array.from(document.body.querySelectorAll("button")).find((button) =>
        button.textContent?.includes("Approve"),
      );
      approveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onDecision).toHaveBeenCalledWith("request-1", "approve");
  });
});
