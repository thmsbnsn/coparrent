/**
 * Migration Dry-Run Panel
 * 
 * Admin component for running and viewing migration validation results.
 * This is used pre-production to verify data integrity and identify blockers.
 */

import { useState } from "react";
import { Play, CheckCircle, XCircle, AlertTriangle, Info, Loader2, Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  executeMigrationDryRun,
  formatReportForConsole,
  canProceedToProduction,
  type DryRunReport,
  type ValidationFinding,
  type ValidationSeverity,
} from "@/lib/migrationDryRun";

/**
 * Severity badge styling
 */
function getSeverityBadge(severity: ValidationSeverity) {
  switch (severity) {
    case "critical":
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Critical</Badge>;
    case "warning":
      return <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-600"><AlertTriangle className="h-3 w-3" />Warning</Badge>;
    case "info":
      return <Badge variant="secondary" className="gap-1"><Info className="h-3 w-3" />Info</Badge>;
  }
}

/**
 * Individual finding card
 */
function FindingCard({ finding }: { finding: ValidationFinding }) {
  return (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {getSeverityBadge(finding.severity)}
          <span className="font-mono text-sm text-muted-foreground">{finding.table}</span>
        </div>
        {finding.wouldBlock && (
          <Badge variant="destructive" className="shrink-0">
            Blocks Production
          </Badge>
        )}
      </div>
      
      <p className="text-sm">{finding.message}</p>
      
      {finding.affectedRows !== undefined && (
        <p className="text-xs text-muted-foreground">
          Affected rows: <span className="font-medium">{finding.affectedRows}</span>
        </p>
      )}
      
      {finding.sampleIds && finding.sampleIds.length > 0 && (
        <div className="text-xs">
          <span className="text-muted-foreground">Sample IDs: </span>
          <code className="bg-muted px-1 py-0.5 rounded text-[10px]">
            {finding.sampleIds.slice(0, 3).join(", ")}
            {finding.sampleIds.length > 3 && `... +${finding.sampleIds.length - 3} more`}
          </code>
        </div>
      )}
      
      {finding.suggestedFix && (
        <div className="mt-2 pt-2 border-t">
          <p className="text-xs">
            <span className="font-medium text-muted-foreground">Suggested fix: </span>
            {finding.suggestedFix}
          </p>
        </div>
      )}
    </div>
  );
}

export function MigrationDryRunPanel() {
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<DryRunReport | null>(null);

  /**
   * Execute the dry-run validation
   */
  const handleRunDryRun = async () => {
    setRunning(true);
    try {
      const result = await executeMigrationDryRun(true);
      setReport(result);
      
      // Log to console for developer visibility
      console.log(formatReportForConsole(result));
      
      if (canProceedToProduction(result)) {
        toast.success("Dry-run complete - Ready for production");
      } else {
        toast.warning(`Dry-run complete - ${result.summary.blockers} blocking issue(s) found`);
      }
    } catch (error) {
      console.error("[Migration] Dry-run failed:", error);
      toast.error("Dry-run failed - Check console for details");
    } finally {
      setRunning(false);
    }
  };

  /**
   * Copy report to clipboard
   */
  const handleCopyReport = () => {
    if (!report) return;
    const text = formatReportForConsole(report);
    navigator.clipboard.writeText(text);
    toast.success("Report copied to clipboard");
  };

  /**
   * Download report as JSON
   */
  const handleDownloadReport = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `migration-dry-run-${report.runId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Migration Dry-Run
        </CardTitle>
        <CardDescription>
          Validate data integrity before production migration. Checks RLS, foreign keys, orphaned rows, and idempotency.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Controls */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleRunDryRun}
            disabled={running}
            className="gap-2"
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Run Dry-Run
              </>
            )}
          </Button>
          
          {report && (
            <>
              <Button variant="outline" size="icon" onClick={handleCopyReport}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleDownloadReport}>
                <Download className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        {/* Results */}
        {report && (
          <>
            <Separator />
            
            {/* Summary */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {canProceedToProduction(report) ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Ready for Production</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-destructive">
                    <XCircle className="h-5 w-5" />
                    <span className="font-medium">
                      {report.summary.blockers} Blocking Issue{report.summary.blockers !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold">{report.summary.totalChecks}</p>
                  <p className="text-xs text-muted-foreground">Total Checks</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-600">{report.summary.critical}</p>
                  <p className="text-xs text-muted-foreground">Critical</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-yellow-600">{report.summary.warnings}</p>
                  <p className="text-xs text-muted-foreground">Warnings</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold">{report.executionTimeMs}ms</p>
                  <p className="text-xs text-muted-foreground">Duration</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Run ID: <code className="bg-muted px-1 py-0.5 rounded">{report.runId}</code>
              </p>
            </div>

            {/* Findings */}
            {report.findings.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Findings ({report.findings.length})</h4>
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-3">
                      {/* Show blockers first */}
                      {report.findings
                        .sort((a, b) => {
                          if (a.wouldBlock && !b.wouldBlock) return -1;
                          if (!a.wouldBlock && b.wouldBlock) return 1;
                          const severityOrder = { critical: 0, warning: 1, info: 2 };
                          return severityOrder[a.severity] - severityOrder[b.severity];
                        })
                        .map((finding) => (
                          <FindingCard key={finding.id} finding={finding} />
                        ))}
                    </div>
                  </ScrollArea>
                </div>
              </>
            )}

            {/* Intended Changes */}
            {report.intendedChanges.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">
                    Intended Changes ({report.intendedChanges.length})
                    <span className="text-xs text-muted-foreground ml-2">(if executed)</span>
                  </h4>
                  <div className="space-y-2">
                    {report.intendedChanges.map((change, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <Badge variant="outline" className="font-mono text-xs">
                          {change.operation}
                        </Badge>
                        <span className="font-mono text-muted-foreground">{change.table}</span>
                        <span className="text-muted-foreground">→</span>
                        <span>{change.affectedRows} rows</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
