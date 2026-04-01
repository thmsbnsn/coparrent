import { useEffect, useMemo, useState } from "react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Calendar as CalendarIconSolid,
  CalendarIcon,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  FolderCheck,
  Loader2,
  MessageSquare,
  Phone,
  Receipt,
  Shield,
  Users,
} from "lucide-react";
import {
  useCourtExport,
  type CourtRecordExportSection,
  type CourtRecordExportSummary,
  type CourtRecordExportVerificationResponse,
} from "@/hooks/useCourtExport";
import { toast } from "sonner";
import { FeatureStatusBadge } from "@/components/FeatureStatusBadge";

interface CourtExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

const initialSectionState: Record<CourtRecordExportSection, boolean> = {
  call_activity: true,
  children: true,
  document_access_logs: true,
  document_references: true,
  exchange_checkins: true,
  expenses: true,
  messages: true,
  schedule_overview: true,
  schedule_requests: true,
};

const sectionOptions: Array<{
  description: string;
  icon: typeof MessageSquare;
  key: CourtRecordExportSection;
  label: string;
}> = [
  {
    key: "messages",
    label: "Communication Log",
    description: "Immutable message history captured in the selected family and date range.",
    icon: MessageSquare,
  },
  {
    key: "call_activity",
    label: "Call Activity",
    description: "Persisted call session and event history only. No recordings or transcripts.",
    icon: Phone,
  },
  {
    key: "schedule_requests",
    label: "Schedule Requests",
    description: "Schedule changes, dates, requester, recipient, and resulting status.",
    icon: CalendarIconSolid,
  },
  {
    key: "exchange_checkins",
    label: "Exchange Check-ins",
    description: "Timestamped exchange activity and notes for the selected range.",
    icon: Clock,
  },
  {
    key: "document_references",
    label: "Document References",
    description: "Document metadata only. Raw document files are excluded from the export package.",
    icon: FolderCheck,
  },
  {
    key: "document_access_logs",
    label: "Document Access Logs",
    description: "Who accessed a document, which action occurred, and when.",
    icon: Eye,
  },
  {
    key: "expenses",
    label: "Expense Records",
    description: "Shared expense history, amounts, categories, and child context.",
    icon: Receipt,
  },
  {
    key: "schedule_overview",
    label: "Custody Schedule Overview",
    description: "Current schedule pattern and exchange details.",
    icon: FileText,
  },
  {
    key: "children",
    label: "Children in Family Scope",
    description: "Children attached to the selected active family.",
    icon: Users,
  },
];

export const CourtExportDialog = ({ open, onOpenChange }: CourtExportDialogProps) => {
  const { createExport, downloadArtifact, listExports, loading, verifyExport } = useCourtExport();
  const [isExporting, setIsExporting] = useState(false);
  const [exportsLoading, setExportsLoading] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [downloadingKind, setDownloadingKind] = useState<"json_evidence_package" | "pdf" | null>(null);
  const [verificationResult, setVerificationResult] =
    useState<CourtRecordExportVerificationResponse | null>(null);
  const [exportRecords, setExportRecords] = useState<CourtRecordExportSummary[]>([]);
  const [selectedExportId, setSelectedExportId] = useState<string | null>(null);

  const [datePreset, setDatePreset] = useState("last-3-months");
  const [startDate, setStartDate] = useState<Date>(subMonths(new Date(), 3));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [sectionState, setSectionState] =
    useState<Record<CourtRecordExportSection, boolean>>(initialSectionState);

  const selectedExport = useMemo(
    () => exportRecords.find((record) => record.id === selectedExportId) ?? exportRecords[0] ?? null,
    [exportRecords, selectedExportId],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    let active = true;

    const loadExports = async () => {
      setExportsLoading(true);
      try {
        const exports = await listExports(10);
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
  }, [listExports, open]);

  const handlePresetChange = (preset: string) => {
    setDatePreset(preset);
    const now = new Date();

    switch (preset) {
      case "last-month":
        setStartDate(startOfMonth(subMonths(now, 1)));
        setEndDate(endOfMonth(subMonths(now, 1)));
        break;
      case "last-3-months":
        setStartDate(subMonths(now, 3));
        setEndDate(now);
        break;
      case "last-6-months":
        setStartDate(subMonths(now, 6));
        setEndDate(now);
        break;
      case "last-year":
        setStartDate(subMonths(now, 12));
        setEndDate(now);
        break;
      case "custom":
      default:
        break;
    }
  };

  const includedSections = sectionOptions
    .filter((option) => sectionState[option.key])
    .map((option) => option.key);

  const handleExport = async () => {
    if (!startDate || !endDate) {
      toast.error("Please select a date range.");
      return;
    }

    if (includedSections.length === 0) {
      toast.error("Select at least one section to include in the export.");
      return;
    }

    setIsExporting(true);
    try {
      const response = await createExport({
        dateRange: { end: endDate, start: startDate },
        exportFormat: "pdf",
        includeSections: includedSections,
      });

      setExportRecords((current) => [
        response.export,
        ...current.filter((record) => record.id !== response.export.id),
      ]);
      setSelectedExportId(response.export.id);
      setVerificationResult(null);

      if (response.pdf_artifact) {
        downloadBlobArtifact({
          base64: response.pdf_artifact.base64,
          contentType: response.pdf_artifact.content_type,
          fileName: response.pdf_artifact.file_name,
        });
      }

      downloadBlobArtifact({
        base64: window.btoa(unescape(encodeURIComponent(response.evidence_package_json))),
        contentType: "application/json;charset=utf-8",
        fileName: `court-record-export-${response.export.id}-evidence-package.json`,
      });

      toast.success(
        `Server-generated export ${response.export.id.slice(0, 8)}... created with PDF hash ${formatHashPreview(response.export.pdf_artifact_hash, 16)}.`,
      );
    } catch (error) {
      console.error("Court export error:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownload = async (artifactKind: "json_evidence_package" | "pdf") => {
    if (!selectedExport) {
      toast.error("Select an export receipt first.");
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
      console.error("Court export download error:", error);
    } finally {
      setDownloadingKind(null);
    }
  };

  const handleVerify = async (
    verificationMode: "stored_pdf_artifact" | "stored_source",
  ) => {
    if (!selectedExport) {
      toast.error("Select an export receipt first.");
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
      console.error("Court export verification error:", error);
      setVerificationResult(null);
    } finally {
      setVerificationLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Court-Ready Export
            </DialogTitle>
            <FeatureStatusBadge status="stable" />
          </div>
          <DialogDescription>
            Create a server-generated, cryptographically verifiable court-record export for the active family.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Report Period</Label>
              <Select value={datePreset} onValueChange={handlePresetChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last-month">Last Month</SelectItem>
                  <SelectItem value="last-3-months">Last 3 Months</SelectItem>
                  <SelectItem value="last-6-months">Last 6 Months</SelectItem>
                  <SelectItem value="last-year">Last Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>

              {datePreset === "custom" && (
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !startDate && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP") : "Start date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={(date) => date && setStartDate(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !endDate && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "PPP") : "End date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={(date) => date && setEndDate(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                {format(startDate, "MMM d, yyyy")} - {format(endDate, "MMM d, yyyy")}
              </p>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Include in Export</Label>
              <div className="space-y-3 rounded-lg border border-border p-4">
                {sectionOptions.map((option) => (
                  <div key={option.key} className="flex items-start space-x-3">
                    <Checkbox
                      id={option.key}
                      checked={sectionState[option.key]}
                      onCheckedChange={(checked) =>
                        setSectionState((current) => ({
                          ...current,
                          [option.key]: checked === true,
                        }))
                      }
                    />
                    <div className="space-y-1">
                      <Label
                        htmlFor={option.key}
                        className="flex cursor-pointer items-center gap-2"
                      >
                        <option.icon className="h-4 w-4 text-muted-foreground" />
                        {option.label}
                      </Label>
                      <p className="text-xs text-muted-foreground">{option.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
              <p className="flex items-start gap-2">
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                The server builds this export from trusted family-scoped records, stores immutable artifacts in Object Lock storage, and preserves call evidence as session and event history only. No call recordings, transcripts, or raw document files are included.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-border p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Stored Exports</p>
                  <p className="text-xs text-muted-foreground">
                    Recent immutable exports for this family
                  </p>
                </div>
                {exportsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>

              {exportRecords.length > 0 ? (
                <Select
                  value={selectedExport?.id ?? ""}
                  onValueChange={(value) => {
                    setSelectedExportId(value);
                    setVerificationResult(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an export receipt" />
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
                <p className="text-sm text-muted-foreground">
                  No family-wide court-record exports have been created yet.
                </p>
              )}

              {selectedExport && (
                <div className="mt-4 space-y-3 text-sm">
                  <div className="rounded-md bg-muted/40 p-3">
                    <p className="font-medium">Receipt {selectedExport.id.slice(0, 12)}...</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      PDF hash {formatHashPreview(selectedExport.pdf_artifact_hash, 16)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Evidence hash {formatHashPreview(selectedExport.artifact_hash, 16)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Object Lock {selectedExport.pdf_storage.object_lock_mode ?? "Unavailable"} until {selectedExport.pdf_storage.retain_until ? format(new Date(selectedExport.pdf_storage.retain_until), "PPP") : "Unavailable"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      PDF version {selectedExport.pdf_storage.version_id ?? "Unavailable"}
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      variant="outline"
                      onClick={() => void handleDownload("pdf")}
                      disabled={downloadingKind !== null}
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
                      disabled={downloadingKind !== null}
                    >
                      {downloadingKind === "json_evidence_package" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="mr-2 h-4 w-4" />
                      )}
                      Download Package
                    </Button>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      variant="secondary"
                      onClick={() => void handleVerify("stored_source")}
                      disabled={verificationLoading}
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
                      disabled={verificationLoading}
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
            </div>

            {verificationResult && (
              <div className="rounded-lg border border-border p-4">
                <p className="text-sm font-medium">Verification Result</p>
                <p className="mt-1 text-sm">
                  Status: <span className="font-medium">{verificationResult.status}</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Computed hash {formatHashPreview(verificationResult.computed_hash, 16)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Stored hash {formatHashPreview(verificationResult.stored_hash, 16)}
                </p>
              </div>
            )}
          </div>
        </div>

        <Separator />

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={() => void handleExport()} disabled={isExporting || loading}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Generate Export
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
