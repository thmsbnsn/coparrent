import { describe, expect, it } from "vitest";
import { coparrentPwaOptions } from "@/pwa/pwaConfig";

describe("coparrentPwaOptions", () => {
  it("imports the push notification worker into the generated service worker", () => {
    expect(coparrentPwaOptions.workbox?.importScripts).toContain("push-notifications-sw.js");
  });
});
