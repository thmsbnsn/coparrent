import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamily } from "@/contexts/FamilyContext";
import { toast } from "sonner";

export type CourtRecordExportSection =
  | "messages"
  | "call_activity"
  | "schedule_requests"
  | "exchange_checkins"
  | "document_references"
  | "document_access_logs"
  | "expenses"
  | "schedule_overview"
  | "children";

export interface CourtRecordExportStorageLayer {
  bucket: string | null;
  key: string | null;
  object_lock_mode: string | null;
  provider: string | null;
  retain_until: string | null;
  version_id: string | null;
}

export interface CourtRecordExportSummary {
  artifact_hash: string | null;
  artifact_hash_algorithm: string | null;
  artifact_storage: CourtRecordExportStorageLayer;
  canonicalization_version: string | null;
  content_hash: string;
  counts: Record<string, number> | null;
  export_format: "json_manifest" | "pdf";
  export_scope: "family_unified";
  exported_at: string;
  family_id: string;
  hash_algorithm: string;
  id: string;
  included_sections: CourtRecordExportSection[];
  integrity_model_version: string | null;
  manifest_hash: string | null;
  manifest_hash_algorithm: string | null;
  pdf_artifact_hash: string | null;
  pdf_bytes_size: number | null;
  pdf_generated_at: string | null;
  pdf_hash_algorithm: string | null;
  pdf_storage: CourtRecordExportStorageLayer;
  record_count: number;
  record_range_end: string | null;
  record_range_start: string | null;
  requested_range_end: string | null;
  requested_range_start: string | null;
  signature_algorithm: string | null;
  signature_present: boolean;
  signing_key_id: string | null;
}

export interface CourtRecordExportCreateResponse {
  artifact_payload_json: string;
  canonical_payload: Record<string, unknown>;
  canonical_payload_json: string;
  evidence_package: Record<string, unknown>;
  evidence_package_json: string;
  export: CourtRecordExportSummary;
  manifest: Record<string, unknown>;
  manifest_json: string;
  pdf_artifact: {
    base64: string;
    bytes_size: number;
    content_type: string;
    file_name: string;
    generated_at: string;
    hash: string;
    hash_algorithm: string;
  } | null;
  receipt: Record<string, unknown>;
}

export interface CourtRecordExportArtifactDownloadResponse {
  artifact: {
    base64: string;
    bytes_size: number;
    content_type: string;
    file_name: string;
    hash: string | null;
    hash_algorithm: string | null;
    kind: "json_evidence_package" | "pdf";
  };
  export: CourtRecordExportSummary;
}

export interface CourtRecordExportVerificationResponse {
  computed_hash: string | null;
  export: CourtRecordExportSummary;
  status:
    | "artifact_hash_unavailable"
    | "artifact_not_found"
    | "match"
    | "mismatch"
    | "pdf_hash_unavailable"
    | "receipt_not_found"
    | "signature_invalid"
    | "verification_not_supported";
  stored_hash: string | null;
  success: boolean;
  verification_layers: Record<string, unknown>;
  verification_mode:
    | "provided_package_json"
    | "provided_pdf_artifact"
    | "stored_pdf_artifact"
    | "stored_signature"
    | "stored_source";
}

const SUPPORTED_SECTIONS: CourtRecordExportSection[] = [
  "messages",
  "call_activity",
  "schedule_requests",
  "exchange_checkins",
  "document_references",
  "document_access_logs",
  "expenses",
  "schedule_overview",
  "children",
];

export const useCourtExport = () => {
  const { user } = useAuth();
  const { activeFamilyId, loading: familyLoading } = useFamily();
  const [loading, setLoading] = useState(false);

  const requireActiveFamilyScope = useCallback(() => {
    if (!user) {
      throw new Error("You must be logged in to export court records.");
    }

    if (familyLoading) {
      throw new Error("Family context is still loading.");
    }

    if (!activeFamilyId) {
      throw new Error("Select an active family before exporting court records.");
    }

    return activeFamilyId;
  }, [activeFamilyId, familyLoading, user]);

  const runScopedRequest = useCallback(
    async <T,>(callback: (familyId: string) => Promise<T>) => {
      setLoading(true);

      try {
        const familyId = requireActiveFamilyScope();
        return await callback(familyId);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unexpected court-record export error.";
        toast.error(message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [requireActiveFamilyScope],
  );

  const createExport = useCallback(
    async (options: {
      dateRange: { end: Date; start: Date };
      exportFormat?: "json_manifest" | "pdf";
      includeSections: CourtRecordExportSection[];
    }) =>
      runScopedRequest(async (familyId) => {
        const { data, error } = await supabase.functions.invoke("court-record-export", {
          body: {
            action: "create",
            date_range: {
              end: options.dateRange.end.toISOString(),
              start: options.dateRange.start.toISOString(),
            },
            export_format: options.exportFormat ?? "pdf",
            export_scope: "family_unified",
            family_id: familyId,
            include_sections: options.includeSections,
          },
        });

        if (error) {
          throw new Error(error.message || "Unable to create the court-record export.");
        }

        return data as CourtRecordExportCreateResponse;
      }),
    [runScopedRequest],
  );

  const listExports = useCallback(
    async (limit = 10) =>
      runScopedRequest(async (familyId) => {
        const { data, error } = await supabase.functions.invoke("court-record-export", {
          body: {
            action: "list",
            export_scope: "family_unified",
            family_id: familyId,
            limit,
          },
        });

        if (error) {
          throw new Error(error.message || "Unable to load court-record exports.");
        }

        return ((data?.exports as CourtRecordExportSummary[] | undefined) ?? []);
      }),
    [runScopedRequest],
  );

  const downloadArtifact = useCallback(
    async (exportId: string, artifactKind: "json_evidence_package" | "pdf") =>
      runScopedRequest(async (familyId) => {
        const { data, error } = await supabase.functions.invoke("court-record-export", {
          body: {
            action: "download",
            artifact_kind: artifactKind,
            export_id: exportId,
            family_id: familyId,
          },
        });

        if (error) {
          throw new Error(error.message || "Unable to download the selected export artifact.");
        }

        return data as CourtRecordExportArtifactDownloadResponse;
      }),
    [runScopedRequest],
  );

  const verifyExport = useCallback(
    async (options: {
      exportId: string;
      providedPackageJson?: string;
      providedPdfBase64?: string;
      verificationMode:
        | "provided_package_json"
        | "provided_pdf_artifact"
        | "stored_pdf_artifact"
        | "stored_signature"
        | "stored_source";
    }) =>
      runScopedRequest(async (familyId) => {
        const { data, error } = await supabase.functions.invoke("court-record-export", {
          body: {
            action: "verify",
            export_id: options.exportId,
            family_id: familyId,
            provided_package_json: options.providedPackageJson,
            provided_pdf_base64: options.providedPdfBase64,
            verification_mode: options.verificationMode,
          },
        });

        if (error) {
          throw new Error(error.message || "Unable to verify the selected export.");
        }

        return data as CourtRecordExportVerificationResponse;
      }),
    [runScopedRequest],
  );

  return {
    activeFamilyId,
    createExport,
    downloadArtifact,
    listExports,
    loading,
    supportedSections: SUPPORTED_SECTIONS,
    verifyExport,
  };
};
