import { afterAll, afterEach, beforeAll, vi } from "vitest";

vi.mock("@/lib/hardNavigation", () => ({
  hardNavigateTo: vi.fn(),
  hardReload: vi.fn(),
}));

import { hardNavigateTo, hardReload } from "@/lib/hardNavigation";

let restoreAnchorClick: (() => void) | null = null;

beforeAll(() => {
  if (typeof HTMLAnchorElement === "undefined") {
    return;
  }

  const nativeAnchorClick = HTMLAnchorElement.prototype.click;
  const anchorClickSpy = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(function (this: HTMLAnchorElement) {
      const href = this.getAttribute("href") ?? this.href ?? "";
      const isDownloadLink =
        Boolean(this.download) || href.startsWith("blob:") || href.startsWith("data:");

      if (isDownloadLink) {
        return;
      }

      return nativeAnchorClick.call(this);
    });

  restoreAnchorClick = () => anchorClickSpy.mockRestore();
});

afterEach(() => {
  vi.mocked(hardNavigateTo).mockReset();
  vi.mocked(hardReload).mockReset();
});

afterAll(() => {
  restoreAnchorClick?.();
  restoreAnchorClick = null;
});
