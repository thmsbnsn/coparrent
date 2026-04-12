import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MediaGalleryPage from "@/pages/MediaGalleryPage";

const mockedUseFamilyMediaGallery = vi.hoisted(() => vi.fn());

vi.mock("@/components/dashboard/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/useFamilyMediaGallery", () => ({
  useFamilyMediaGallery: mockedUseFamilyMediaGallery,
}));

vi.mock("@/components/media/AssetViewerDialog", () => ({
  AssetViewerDialog: ({
    asset,
    open,
    sourceLabel,
  }: {
    asset: { title: string } | null;
    open: boolean;
    sourceLabel: string;
  }) => (open && asset ? <div>{`${sourceLabel}:${asset.title}`}</div> : null),
}));

vi.mock("@/components/ui/LoadingSpinner", () => ({
  LoadingSpinner: ({ message }: { message?: string }) => <div>{message}</div>,
}));

describe("MediaGalleryPage", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const renderPage = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={["/dashboard/media"]}>
          <MediaGalleryPage />
        </MemoryRouter>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    return container;
  };

  beforeEach(() => {
    mockedUseFamilyMediaGallery.mockReset();
    mockedUseFamilyMediaGallery.mockReturnValue({
      activeFamilyId: "family-1",
      assets: [
        {
          createdAt: "2026-04-11T14:00:00.000Z",
          familyId: "family-1",
          fileName: "soccer-practice.jpg",
          fileSize: 2048,
          fileType: "image/jpeg",
          id: "media-1",
          kind: "image",
          title: "soccer-practice",
          uploadedBy: "profile-1",
          url: "https://example.com/soccer-practice.jpg",
        },
      ],
      error: null,
      loading: false,
      refresh: vi.fn(),
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

  it("renders shared family media and opens the viewer from the gallery", async () => {
    const rendered = await renderPage();
    const openButton = rendered.querySelector<HTMLButtonElement>('button[aria-label="Open soccer-practice"]');

    expect(rendered.textContent).toContain("Media Gallery");
    expect(rendered.textContent).toContain("soccer-practice");
    expect(rendered.textContent).toContain("Family scoped");

    await act(async () => {
      openButton?.click();
      await Promise.resolve();
    });

    expect(rendered.textContent).toContain("Media Gallery:soccer-practice");
  });

  it("fails closed when no active family is available", async () => {
    mockedUseFamilyMediaGallery.mockReturnValue({
      activeFamilyId: null,
      assets: [],
      error: "Select an active family before viewing shared media.",
      loading: false,
      refresh: vi.fn(),
    });

    const rendered = await renderPage();

    expect(rendered.textContent).toContain("Family selection required");
    expect(rendered.textContent).toContain("fails closed");
  });

  it("shows the empty state when the family has no shared media yet", async () => {
    mockedUseFamilyMediaGallery.mockReturnValue({
      activeFamilyId: "family-1",
      assets: [],
      error: null,
      loading: false,
      refresh: vi.fn(),
    });

    const rendered = await renderPage();

    expect(rendered.textContent).toContain("No media yet");
    expect(rendered.textContent).toContain("Photos and videos shared in this family's message threads will appear here.");
  });
});
