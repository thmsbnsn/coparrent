import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  CheckCircle2,
  Download,
  FileCheck2,
  FileText,
  FolderLock,
  Loader2,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFamily } from "@/contexts/FamilyContext";
import {
  type CourtRecordExportSummary,
  type CourtRecordExportVerificationResponse,
  useCourtExport,
} from "@/hooks/useCourtExport";

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

const getVerificationTone = (result: CourtRecordExportVerificationResponse | null) => {
  if (!result) {
    return {
      badgeClass: "border-border/70 bg-background/70 text-muted-foreground",
      badgeLabel: "Not checked",
      description: "Run verification against the stored source or stored PDF artifact when you need to confirm the receipt.",
      headline: "Verification has not been run yet.",
    };
  }

  if (result.status === "match") {
    return {
      badgeClass: "border-emerald-300/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      badgeLabel: "Verified",
      description: "The selected artifact still matches the stored immutable receipt for this family.",
      headline: "Verification matched the receipt.",
    };
  }

  return {
    badgeClass: "border-rose-300/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    badgeLabel: result.status,
    description: "Review the receipt and stored artifacts before relying on this export in a legal workflow.",
    headline: "Verification needs attention.",
  };
};

const LawOfficeDashboard = () => {
  const {
    activeFamily,
    activeFamilyId,
    loading: familyLoading,
    memberships = [],
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
  const [verificationResult, setVerificationResult] = useState<CourtRecordExportVerificationResponse | null>(null);

  const selectedExport = useMemo(
    () => exportRecords.find((record) => record.id === selectedExportId) ?? exportRecords[0] ?? null,
    [exportRecords, selectedExportId],
  );
  const verificationTone = getVerificationTone(verificationResult);

  useEffect(() => {
    if (familyLoading) {
      return;
    }

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
  }, [activeFamilyId, familyLoading, listExports]);

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
        <div className="relative isolate overflow-hidden rounded-[30px] border border-amber-200/70 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.08),transparent_34%),linear-gradient(145deg,rgba(255,251,235,0.98),rgba(255,255,255,0.96))] p-5 shadow-[0_24px_50px_-36px_rgba(15,23,42,0.85)] sm:p-6">
          <div className="relative flex flex-col gap-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Law Office Portal
                  </div>
                  <div className="inline-flex rounded-full border border-border/70 bg-background/75 px-3 py-1 text-xs font-medium text-muted-foreground">
                    Immutable export review
                  </div>
                </div>
                <div className="space-y-3">
                  <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">
                    Read-only court-record receipts
                  </h1>
                  <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                    Review immutable family-wide export receipts, download stored artifacts, and verify integrity
                    without exposing raw family tables. This portal stays inside the currently assigned family scope.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:w-[360px] xl:grid-cols-1">
                <div className="rounded-[24px] border border-border/70 bg-white/80 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Assigned family
                  </p>
                  <p className="mt-3 text-lg font-semibold text-foreground">
                    {activeFamily?.display_name ?? (activeFamilyId ? "Assigned family selected" : "No family selected")}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {activeFamilyId
                      ? `Active family ID: ${activeFamilyId}`
                      : familyLoading
                        ? "Resolving assignments now."
                        : memberships.length > 0
                          ? "Choose an assigned family from the sidebar before reviewing receipts."
                          : "A server-side law-office assignment is required before exports appear here."}
                  </p>
                </div>
                <div className="rounded-[24px] border border-border/70 bg-white/80 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Portal guardrails
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <li>Read-only phase only. New export creation stays disabled.</li>
                    <li>Downloads come from stored immutable artifacts, not browser-built files.</li>
                    <li>Call evidence remains session and event history only.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[22px] border border-border/70 bg-white/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Receipts</p>
                <p className="mt-2 text-2xl font-display font-semibold text-foreground">{exportRecords.length}</p>
                <p className="mt-1 text-sm text-muted-foreground">Stored immutable exports for the selected family.</p>
              </div>
              <div className="rounded-[22px] border border-border/70 bg-white/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Latest export</p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {selectedExport ? format(new Date(selectedExport.exported_at), "MMM d, yyyy") : "Unavailable"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedExport ? format(new Date(selectedExport.exported_at), "h:mm a") : "Select a family to review receipts."}
                </p>
              </div>
              <div className="rounded-[22px] border border-border/70 bg-white/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Verification</p>
                <Badge variant="outline" className={`mt-2 rounded-full ${verificationTone.badgeClass}`}>
                  {verificationTone.badgeLabel}
                </Badge>
                <p className="mt-2 text-sm text-muted-foreground">{verificationTone.description}</p>
              </div>
            </div>
          </div>
        </div>

        {familyLoading ? (
          <Card className="border-border/70">
            <CardContent className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
                <p className="mt-4 text-sm font-semibold text-foreground">Loading assigned families</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  The portal waits for an explicit assigned family before it loads immutable receipts.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[0.86fr_1.14fr]">
            <Card className="border-border/70">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderLock className="h-5 w-5 text-primary" />
                  Assigned family scope
                </CardTitle>
                <CardDescription>
                  Law-office review stays scoped to the family currently selected in the sidebar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {!memberships.length ? (
                  <div className="rounded-xl border border-dashed border-border p-5 text-muted-foreground">
                    No family assignments are active for this law-office account yet.
                  </div>
                ) : !activeFamilyId ? (
                  <div className="rounded-xl border border-dashed border-border p-5 text-muted-foreground">
                    Select an assigned family before reviewing immutable exports. The portal does not infer family scope.
                  </div>
                ) : (
                  <>
                    <div className="rounded-xl border border-border bg-muted/35 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Current review target
                      </p>
                      <p className="mt-3 text-lg font-semibold text-foreground">
                        {activeFamily?.display_name ?? "Assigned family selected"}
                      </p>
                      <p className="mt-2 text-muted-foreground">Family ID: {activeFamilyId}</p>
                    </div>

                    <div className="rounded-xl border border-border bg-card p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        What this phase includes
                      </p>
                      <ul className="mt-3 space-y-2 text-muted-foreground">
                        <li>Stored PDF artifacts and JSON evidence packages.</li>
                        <li>Immutable receipt hashes and object-lock metadata.</li>
                        <li>Server-side verification against stored receipts.</li>
                      </ul>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileCheck2 className="h-5 w-5 text-primary" />
                      Immutable export receipts
                    </CardTitle>
                    <CardDescription>
                      Stored family-wide court-record exports for the selected assigned family.
                    </CardDescription>
                  </div>
                  {exportsLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {!memberships.length ? (
                  <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                    No family-wide immutable exports can load until the law-office assignment exists.
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

                    {selectedExport ? (
                      <div className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-xl border border-border bg-muted/35 p-4 text-sm">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                              Receipt summary
                            </p>
                            <p className="mt-3 font-medium text-foreground">Receipt {selectedExport.id.slice(0, 12)}...</p>
                            <p className="mt-2 text-muted-foreground">PDF hash {formatHashPreview(selectedExport.pdf_artifact_hash, 16)}</p>
                            <p className="mt-1 text-muted-foreground">Evidence hash {formatHashPreview(selectedExport.artifact_hash, 16)}</p>
                          </div>

                          <div className="rounded-xl border border-border bg-muted/35 p-4 text-sm">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                              Storage posture
                            </p>
                            <p className="mt-3 text-muted-foreground">
                              Object Lock {selectedExport.pdf_storage.object_lock_mode ?? "Unavailable"}
                            </p>
                            <p className="mt-1 text-muted-foreground">
                              Retain until{" "}
                              {selectedExport.pdf_storage.retain_until
                                ? format(new Date(selectedExport.pdf_storage.retain_until), "PPP")
                                : "Unavailable"}
                            </p>
                            <p className="mt-1 text-muted-foreground">
                              PDF version {selectedExport.pdf_storage.version_id ?? "Unavailable"}
                            </p>
                          </div>
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
                            Download package
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
                            Verify source
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
                            Verify stored PDF
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <Card className="border-border/70">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="h-5 w-5 text-primary" />
                  Verification result
                </CardTitle>
                <CardDescription>
                  Compare the recomputed artifact against the stored immutable receipt.
                </CardDescription>
              </div>
              <Badge variant="outline" className={`rounded-full ${verificationTone.badgeClass}`}>
                {verificationTone.badgeLabel}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="font-medium text-foreground">{verificationTone.headline}</p>
            <p className="text-muted-foreground">{verificationTone.description}</p>
            {verificationResult ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-border bg-muted/35 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Computed hash</p>
                  <p className="mt-3 break-all text-muted-foreground">
                    {formatHashPreview(verificationResult.computed_hash, 24)}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-muted/35 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Stored hash</p>
                  <p className="mt-3 break-all text-muted-foreground">
                    {formatHashPreview(verificationResult.stored_hash, 24)}
                  </p>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default LawOfficeDashboard;
