import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CourtExportDialog } from "@/components/documents/CourtExportDialog";
import type { CourtRecordExportCreateResponse } from "@/hooks/useCourtExport";

const createExportMock = vi.hoisted(() => vi.fn());
const listExportsMock = vi.hoisted(() => vi.fn());
const downloadArtifactMock = vi.hoisted(() => vi.fn());
const verifyExportMock = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
const createObjectUrlMock = vi.hoisted(() => vi.fn(() => "blob:mock"));
const revokeObjectUrlMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useCourtExport", () => ({
  useCourtExport: () => ({
    createExport: createExportMock,
    downloadArtifact: downloadArtifactMock,
    listExports: listExportsMock,
    loading: false,
    supportedSections: [],
    verifyExport: verifyExportMock,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
    success: toastSuccess,
  },
}));

vi.mock("@/components/FeatureStatusBadge", () => ({
  FeatureStatusBadge: () => <span>stable</span>,
}));

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("CourtExportDialog", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    createExportMock.mockReset();
    listExportsMock.mockReset();
    downloadArtifactMock.mockReset();
    verifyExportMock.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    listExportsMock.mockResolvedValue([]);
    createExportMock.mockResolvedValue({
      evidence_package_json: "{\"ok\":true}",
      export: {
        artifact_hash: "artifact-hash",
        artifact_hash_algorithm: "sha256",
        artifact_storage: {
          bucket: "bucket",
          key: "families/family-1/court-exports/export-1/evidence-package.json",
          object_lock_mode: "COMPLIANCE",
          provider: "aws_s3_object_lock",
          retain_until: "2033-04-01T00:00:00.000Z",
          version_id: "artifact-version-1",
        },
        canonicalization_version: "canon-v1",
        content_hash: "content-hash",
        counts: { total_records: 5 },
        export_format: "pdf",
        export_scope: "family_unified",
        exported_at: "2026-04-01T12:00:00.000Z",
        family_id: "family-1",
        hash_algorithm: "sha256",
        id: "export-1",
        included_sections: ["messages", "call_activity"],
        integrity_model_version: "integrity-v1",
        manifest_hash: "manifest-hash",
        manifest_hash_algorithm: "sha256",
        pdf_artifact_hash: "pdf-hash",
        pdf_bytes_size: 512,
        pdf_generated_at: "2026-04-01T12:00:00.000Z",
        pdf_hash_algorithm: "sha256",
        pdf_storage: {
          bucket: "bucket",
          key: "families/family-1/court-exports/export-1/court-record-export.pdf",
          object_lock_mode: "COMPLIANCE",
          provider: "aws_s3_object_lock",
          retain_until: "2033-04-01T00:00:00.000Z",
          version_id: "pdf-version-1",
        },
        record_count: 5,
        record_range_end: "2026-03-31T23:59:59.000Z",
        record_range_start: "2026-03-01T00:00:00.000Z",
        requested_range_end: "2026-03-31T23:59:59.000Z",
        requested_range_start: "2026-03-01T00:00:00.000Z",
        signature_algorithm: "ed25519",
        signature_present: true,
        signing_key_id: "key-1",
      },
      pdf_artifact: null,
    } satisfies Partial<CourtRecordExportCreateResponse>);

    vi.stubGlobal("URL", {
      createObjectURL: createObjectUrlMock,
      revokeObjectURL: revokeObjectUrlMock,
    });
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
      await flushPromises();
    });
    container?.remove();
    container = null;
    root = null;
    vi.unstubAllGlobals();
  });

  const renderComponent = async () => {
    if (!container) {
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
    }

    await act(async () => {
      root?.render(<CourtExportDialog open onOpenChange={() => undefined} />);
      await flushPromises();
    });
  };

  it("submits a server-backed family export request from the dialog", async () => {
    await renderComponent();

    const generateButton = Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Generate Export"),
    );
    expect(generateButton).toBeTruthy();

    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushPromises();
    });

    expect(createExportMock).toHaveBeenCalledTimes(1);
    expect(createExportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        exportFormat: "pdf",
      }),
    );
    expect(createExportMock.mock.calls[0]?.[0]?.includeSections).toEqual(
      expect.arrayContaining(["messages", "call_activity", "document_references"]),
    );
  });
});
