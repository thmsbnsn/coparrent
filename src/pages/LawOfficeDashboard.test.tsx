import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFamily } from "@/contexts/FamilyContext";
import { useCourtExport } from "@/hooks/useCourtExport";
import LawOfficeDashboard from "@/pages/LawOfficeDashboard";

vi.mock("@/contexts/FamilyContext", () => ({
  useFamily: vi.fn(),
}));

vi.mock("@/hooks/useCourtExport", () => ({
  useCourtExport: vi.fn(),
}));

vi.mock("@/components/dashboard/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

const mockedUseFamily = vi.mocked(useFamily);
const mockedUseCourtExport = vi.mocked(useCourtExport);

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe("LawOfficeDashboard", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const renderPage = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(<LawOfficeDashboard />);
      await flushPromises();
    });

    return container;
  };

  beforeEach(() => {
    mockedUseFamily.mockReturnValue({
      activeFamily: { display_name: "Harper Family", id: "family-1" },
      activeFamilyId: "family-1",
      loading: false,
      memberships: [
        {
          accessKind: "law_office",
          familyId: "family-1",
          familyName: "Harper Family",
          primaryParentId: null,
          relationshipLabel: "Law Office",
          role: null,
          status: "active",
        },
      ],
    } as never);

    mockedUseCourtExport.mockReturnValue({
      downloadArtifact: vi.fn().mockResolvedValue({
        artifact: {
          base64: "ZGF0YQ==",
          bytes_size: 4,
          content_type: "application/pdf",
          file_name: "receipt.pdf",
          hash: "hash",
          hash_algorithm: "sha256",
          kind: "pdf",
        },
      }),
      listExports: vi.fn().mockResolvedValue([
        {
          artifact_hash: "artifact-hash",
          counts: { messages: 3 },
          content_hash: "content-hash",
          export_format: "pdf",
          export_scope: "family_unified",
          exported_at: "2026-04-03T14:00:00.000Z",
          family_id: "family-1",
          hash_algorithm: "sha256",
          id: "export-1",
          included_sections: ["messages", "expenses"],
          pdf_artifact_hash: "pdf-hash",
          pdf_storage: {
            bucket: "exports",
            key: "families/family-1/export-1.pdf",
            object_lock_mode: "COMPLIANCE",
            provider: "s3",
            retain_until: "2026-10-01T00:00:00.000Z",
            version_id: "version-1",
          },
        },
      ]),
      loading: false,
      verifyExport: vi.fn().mockResolvedValue({
        computed_hash: "content-hash",
        status: "match",
        stored_hash: "content-hash",
        verification_layers: {},
        verification_mode: "stored_source",
      }),
    } as never);
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

  it("shows a loading state while family assignments are still resolving", async () => {
    mockedUseFamily.mockReturnValue({
      activeFamily: null,
      activeFamilyId: null,
      loading: true,
      memberships: [],
    } as never);

    const rendered = await renderPage();

    expect(rendered.textContent).toContain("Loading assigned families");
    expect(rendered.textContent).toContain("waits for an explicit assigned family");
  });

  it("fails closed when an assigned family has not been selected", async () => {
    mockedUseFamily.mockReturnValue({
      activeFamily: null,
      activeFamilyId: null,
      loading: false,
      memberships: [
        {
          accessKind: "law_office",
          familyId: "family-1",
          familyName: "Harper Family",
          primaryParentId: null,
          relationshipLabel: "Law Office",
          role: null,
          status: "active",
        },
      ],
    } as never);

    const rendered = await renderPage();

    expect(rendered.textContent).toContain("Choose an assigned family from the sidebar");
    expect(rendered.textContent).toContain("does not infer family scope");
  });

  it("renders immutable export details for the selected family", async () => {
    const rendered = await renderPage();

    expect(rendered.textContent).toContain("Harper Family");
    expect(rendered.textContent).toContain("Immutable export receipts");
    expect(rendered.textContent).toContain("Download PDF");
    expect(rendered.textContent).toContain("Verify source");
    expect(rendered.textContent).toContain("Object Lock COMPLIANCE");
  });
});
