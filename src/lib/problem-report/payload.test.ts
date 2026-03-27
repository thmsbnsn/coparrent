import { describe, expect, it } from "vitest";
import { buildProblemReportPayload } from "@/lib/problem-report/payload";

describe("problem report payload builder", () => {
  it("builds a structured payload with browser context", () => {
    const payload = buildProblemReportPayload({
      category: "Bug",
      details: "The save button did nothing.",
      email: "reporter@example.com",
      extraContext: {
        test_marker: "yes",
      },
      motionTriggered: true,
      routePath: "/dashboard/messages?thread=1",
      source: "shake",
      summary: "Save button failed",
      timestamp: "2026-03-27T12:00:00.000Z",
      windowRef: {
        innerHeight: 844,
        innerWidth: 390,
        location: {
          hash: "",
          href: "https://coparrent.com/dashboard/messages?thread=1",
          pathname: "/dashboard/messages",
          search: "?thread=1",
        },
        matchMedia: () => ({ matches: true }) as MediaQueryList,
        navigator: {
          standalone: false,
          userAgentData: {
            platform: "iOS",
          },
        },
        screen: {
          height: 844,
          width: 390,
        },
      },
    });

    expect(payload.category).toBe("Bug");
    expect(payload.trigger_source).toBe("shake");
    expect(payload.route_path).toBe("/dashboard/messages?thread=1");
    expect(payload.current_url).toBe("https://coparrent.com/dashboard/messages?thread=1");
    expect(payload.email).toBe("reporter@example.com");
    expect(payload.extra_context.test_marker).toBe("yes");
    expect(payload.motion_triggered).toBe(true);
    expect(payload.viewport_width).toBe(390);
    expect(payload.viewport_height).toBe(844);
    expect(payload.platform_info).toBe("iOS");
    expect(payload.client_timestamp).toBe("2026-03-27T12:00:00.000Z");
  });
});
