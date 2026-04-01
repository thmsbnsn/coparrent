import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCourtExport } from "@/hooks/useCourtExport";
import { useAuth } from "@/contexts/AuthContext";
import { useFamily } from "@/contexts/FamilyContext";

const invokeMock = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/contexts/FamilyContext", () => ({
  useFamily: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
  },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseFamily = vi.mocked(useFamily);

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("useCourtExport", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let latestHook: ReturnType<typeof useCourtExport> | null = null;
  let familyContext: { activeFamilyId: string | null; loading: boolean };

  const Harness = () => {
    latestHook = useCourtExport();
    return <div>{latestHook.loading ? "loading" : "ready"}</div>;
  };

  const renderHook = async () => {
    if (!container) {
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
    }

    await act(async () => {
      root?.render(<Harness />);
      await flushPromises();
    });
  };

  beforeEach(() => {
    latestHook = null;
    invokeMock.mockReset();
    toastError.mockReset();
    familyContext = {
      activeFamilyId: "family-1",
      loading: false,
    };

    mockedUseAuth.mockReturnValue({
      user: { id: "user-1" },
    } as ReturnType<typeof useAuth>);
    mockedUseFamily.mockImplementation(() => familyContext as ReturnType<typeof useFamily>);
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
      await flushPromises();
    });
    container?.remove();
    container = null;
    root = null;
  });

  it("fails closed when activeFamilyId is missing", async () => {
    familyContext.activeFamilyId = null;
    await renderHook();

    await expect(latestHook?.listExports(5)).rejects.toThrow(
      "Select an active family before exporting court records.",
    );
    expect(invokeMock).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(
      "Select an active family before exporting court records.",
    );
  });

  it("sends explicit family scope and create payload to the server export function", async () => {
    invokeMock.mockResolvedValue({
      data: {
        export: { id: "export-1" },
        evidence_package_json: "{}",
        pdf_artifact: null,
      },
      error: null,
    });

    await renderHook();

    await act(async () => {
      await latestHook?.createExport({
        dateRange: {
          end: new Date("2026-03-31T23:59:59.000Z"),
          start: new Date("2026-03-01T00:00:00.000Z"),
        },
        includeSections: ["messages", "call_activity", "document_references"],
      });
      await flushPromises();
    });

    expect(invokeMock).toHaveBeenCalledWith("court-record-export", {
      body: {
        action: "create",
        date_range: {
          end: "2026-03-31T23:59:59.000Z",
          start: "2026-03-01T00:00:00.000Z",
        },
        export_format: "pdf",
        export_scope: "family_unified",
        family_id: "family-1",
        include_sections: ["messages", "call_activity", "document_references"],
      },
    });
  });
});
