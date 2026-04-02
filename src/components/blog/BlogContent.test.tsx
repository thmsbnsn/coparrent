import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { BlogContent } from "@/components/blog/BlogContent";

describe("BlogContent", () => {
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

  const renderContent = async (content: string) => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(<BlogContent content={content} />);
    });

    return container;
  };

  it("renders richer editorial blocks such as quotes, dividers, and notes", async () => {
    const rendered = await renderContent(`
Intro paragraph for the reader.

---

> Keep your updates calm and specific.

Note: Screenshots are helpful only when they add context.
    `);

    expect(rendered.textContent).toContain("Intro paragraph for the reader.");
    expect(rendered.textContent).toContain("Keep your updates calm and specific.");
    expect(rendered.textContent).toContain("Note");
    expect(rendered.textContent).toContain("Screenshots are helpful only when they add context.");
    expect(rendered.querySelector("blockquote")).not.toBeNull();
  });
});
