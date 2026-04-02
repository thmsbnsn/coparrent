import { act } from "react";
import { createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hardNavigateTo } from "@/lib/hardNavigation";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";

describe("RouteErrorBoundary", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  const boundaryRef = createRef<RouteErrorBoundary>();

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
    consoleErrorSpy.mockRestore();
    sessionStorage.clear();
  });

  const renderBoundary = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <RouteErrorBoundary ref={boundaryRef} routeName="Games">
          <div>games-page</div>
        </RouteErrorBoundary>,
      );
    });

    return container;
  };

  it("keeps the dashboard hard-navigation recovery path and avoids jsdom document navigation noise", async () => {
    const rendered = await renderBoundary();

    await act(async () => {
      boundaryRef.current?.setState({
        error: new Error("Exploded route"),
        errorId: "ERR-TEST-001",
        hasError: true,
      });
    });

    const dashboardButton = Array.from(rendered.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes("Dashboard"),
    );

    expect(dashboardButton).toBeTruthy();

    await act(async () => {
      dashboardButton?.click();
    });

    expect(hardNavigateTo).toHaveBeenCalledWith("/dashboard");

    const errorMessages = consoleErrorSpy.mock.calls
      .flatMap((call) => call.map((value) => String(value)));

    expect(
      errorMessages.some((message) => message.includes("Not implemented: navigation to another Document")),
    ).toBe(false);
  });
});
