import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  CheckCircle2,
  Download,
  FileCheck2,
  FileText,
  FolderLock,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFamily } from "@/contexts/FamilyContext";
import {
  useCourtExport,
  type CourtRecordExportSummary,
  type CourtRecordExportVerificationResponse,
} from "@/hooks/useCourtExport";
import { toast } from "sonner";

const downloadBlobArtifact = (options: {
  base64: string;
  contentType: string;
  fileName: string;
}) => {
  const binary = window.atob(options.base64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const blob = new Blob([bytes], { type: options.contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = options.fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

const formatHashPreview = (value: string | null | undefined, visible = 18) =>
  value && value.length > visible * 2
    ? `${value.slice(0, visible)}...${value.slice(-visible)}`
    : value ?? "Unavailable";

const LawOfficeDashboard = () => {
  const {
    activeFamily,
    activeFamilyId,
    memberships,
  } = useFamily();
  const {
    downloadArtifact,
    listExports,
    loading,
    verifyExport,
  } = useCourtExport();
  const [exportsLoading, setExportsLoading] = useState(false);
  const [exportRecords, setExportRecords] = useState<CourtRecordExportSummary[]>([]);
  const [selectedExportId, setSelectedExportId] = useState<string | null>(null);
  const [downloadingKind, setDownloadingKind] = useState<"json_evidence_package" | "pdf" | null>(null);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationResult, setVerificationResult] =
    useState<CourtRecordExportVerificationResponse | null>(null);

  const selectedExport = useMemo(
    () => exportRecords.find((record) => record.id === selectedExportId) ?? exportRecords[0] ?? null,
    [exportRecords, selectedExportId],
  );

  useEffect(() => {
    if (!activeFamilyId) {
      setExportRecords([]);
      setSelectedExportId(null);
      setVerificationResult(null);
      return;
    }

    let active = true;

    const loadExports = async () => {
      setExportsLoading(true);
      try {
        const exports = await listExports(20);
        if (!active) {
          return;
        }

        setExportRecords(exports);
        setSelectedExportId((current) =>
          current && exports.some((record) => record.id === current)
            ? current
            : exports[0]?.id ?? null,
        );
      } catch {
        if (active) {
          setExportRecords([]);
          setSelectedExportId(null);
        }
      } finally {
        if (active) {
          setExportsLoading(false);
        }
      }
    };

    void loadExports();

    return () => {
      active = false;
    };
  }, [activeFamilyId, listExports]);

  const handleDownload = async (artifactKind: "json_evidence_package" | "pdf") => {
    if (!selectedExport) {
      toast.error("Select an immutable export receipt first.");
      return;
    }

    try {
      setDownloadingKind(artifactKind);
      const response = await downloadArtifact(selectedExport.id, artifactKind);
      downloadBlobArtifact({
        base64: response.artifact.base64,
        contentType: response.artifact.content_type,
        fileName: response.artifact.file_name,
      });
      toast.success(
        artifactKind === "pdf"
          ? "Stored PDF artifact downloaded."
          : "Stored evidence package downloaded.",
      );
    } catch (error) {
      console.error("Law office export download error:", error);
    } finally {
      setDownloadingKind(null);
    }
  };

  const handleVerify = async (verificationMode: "stored_pdf_artifact" | "stored_source") => {
    if (!selectedExport) {
      toast.error("Select an immutable export receipt first.");
      return;
    }

    try {
      setVerificationLoading(true);
      const response = await verifyExport({
        exportId: selectedExport.id,
        verificationMode,
      });
      setVerificationResult(response);
      toast.success(
        response.status === "match"
          ? "Export verification matched the stored receipt."
          : `Verification result: ${response.status}.`,
      );
    } catch (error) {
      console.error("Law office export verification error:", error);
      setVerificationResult(null);
    } finally {
      setVerificationLoading(false);
    }
  };

  return (
    <DashboardLayout userRole="lawoffice">
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            Law Office Portal
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold">Immutable export receipts</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Phase 1 is read-only. Review immutable family-wide court-record exports, download stored artifacts,
              and verify receipt-backed integrity without opening raw messages, documents, or other underlying tables.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderLock className="h-5 w-5 text-primary" />
                Assigned family scope
              </CardTitle>
              <CardDescription>
                Access stays scoped to the selected assigned family. Export creation is intentionally disabled.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <p className="font-medium">
                  {activeFamilyId
                    ? activeFamily?.display_name ?? "Assigned family selected"
                    : memberships.length > 0
                      ? "Select an assigned family"
                      : "No assigned families yet"}
                </p>
                <p className="mt-2 text-muted-foreground">
                  {activeFamilyId
                    ? `Active family ID: ${activeFamilyId}`
                    : memberships.length > 0
                      ? "Use the sidebar family switcher to choose the assigned family you need to review."
                      : "A server-side law office assignment is required before immutable exports will appear here."}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Guardrails
                </p>
                <ul className="mt-3 space-y-2 text-muted-foreground">
                  <li>Read-only access only. Law Office users cannot create new exports in this phase.</li>
                  <li>Calls remain session and event history only. No recordings or transcripts are claimed.</li>
                  <li>Downloads come from stored immutable artifacts, not browser-built exports.</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileCheck2 className="h-5 w-5 text-primary" />
                    Family-wide court-record exports
                  </CardTitle>
                  <CardDescription>
                    Stored immutable exports for the currently selected assigned family.
                  </CardDescription>
                </div>
                {exportsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {memberships.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                  No family assignments are active for this account yet.
                </div>
              ) : !activeFamilyId ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                  Select an assigned family in the sidebar before reviewing immutable exports.
                </div>
              ) : (
                <>
                  {exportRecords.length > 0 ? (
                    <Select
                      value={selectedExport?.id ?? ""}
                      onValueChange={(value) => {
                        setSelectedExportId(value);
                        setVerificationResult(null);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select an immutable export receipt" />
                      </SelectTrigger>
                      <SelectContent>
                        {exportRecords.map((record) => (
                          <SelectItem key={record.id} value={record.id}>
                            {format(new Date(record.exported_at), "MMM d, yyyy h:mm a")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                      No family-wide immutable exports are stored for this family yet.
                    </div>
                  )}

                  {selectedExport && (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-border bg-muted/35 p-4 text-sm">
                        <p className="font-medium">Receipt {selectedExport.id.slice(0, 12)}...</p>
                        <p className="mt-2 text-muted-foreground">
                          PDF hash {formatHashPreview(selectedExport.pdf_artifact_hash, 16)}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          Evidence hash {formatHashPreview(selectedExport.artifact_hash, 16)}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          Object Lock {selectedExport.pdf_storage.object_lock_mode ?? "Unavailable"} until{" "}
                          {selectedExport.pdf_storage.retain_until
                            ? format(new Date(selectedExport.pdf_storage.retain_until), "PPP")
                            : "Unavailable"}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          PDF version {selectedExport.pdf_storage.version_id ?? "Unavailable"}
                        </p>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <Button
                          variant="outline"
                          onClick={() => void handleDownload("pdf")}
                          disabled={downloadingKind !== null || loading}
                        >
                          {downloadingKind === "pdf" ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="mr-2 h-4 w-4" />
                          )}
                          Download PDF
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => void handleDownload("json_evidence_package")}
                          disabled={downloadingKind !== null || loading}
                        >
                          {downloadingKind === "json_evidence_package" ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <FileText className="mr-2 h-4 w-4" />
                          )}
                          Download Package
                        </Button>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <Button
                          variant="secondary"
                          onClick={() => void handleVerify("stored_source")}
                          disabled={verificationLoading || loading}
                        >
                          {verificationLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                          )}
                          Verify Source
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => void handleVerify("stored_pdf_artifact")}
                          disabled={verificationLoading || loading}
                        >
                          {verificationLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                          )}
                          Verify Stored PDF
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {verificationResult && (
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>Verification result</CardTitle>
              <CardDescription>
                Compare the recomputed artifact against the stored immutable receipt.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                Status: <span className="font-medium">{verificationResult.status}</span>
              </p>
              <p className="text-muted-foreground">
                Computed hash {formatHashPreview(verificationResult.computed_hash, 16)}
              </p>
              <p className="text-muted-foreground">
                Stored hash {formatHashPreview(verificationResult.stored_hash, 16)}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default LawOfficeDashboard;
