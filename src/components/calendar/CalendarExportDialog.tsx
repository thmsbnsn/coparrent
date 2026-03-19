import { useState } from "react";
import { Download, Calendar, FileText, Loader2, Check, Copy, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadICSFile, generateAppleCalendarSubscriptionInfo } from "@/lib/calendarExport";
import { exportScheduleToPDF } from "@/lib/pdfExport";
import type { ScheduleConfig } from "@/components/calendar/CalendarWizard";
import { toast } from "sonner";

interface CalendarExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheduleConfig: ScheduleConfig | null;
  userProfile: { full_name: string | null; email: string | null } | null;
  coParent: { full_name: string | null; email: string | null } | null;
}

export function CalendarExportDialog({
  open,
  onOpenChange,
  scheduleConfig,
  userProfile,
  coParent,
}: CalendarExportDialogProps) {
  const [exportType, setExportType] = useState<"ics" | "pdf">("ics");
  const [monthsAhead, setMonthsAhead] = useState<string>("12");
  const [isExporting, setIsExporting] = useState(false);

  const appleInfo = generateAppleCalendarSubscriptionInfo();

  const handleExport = async () => {
    if (!scheduleConfig) {
      toast.error("No schedule configured");
      return;
    }

    setIsExporting(true);

    try {
      if (exportType === "ics") {
        downloadICSFile(
          scheduleConfig,
          userProfile?.full_name || "Parent A",
          coParent?.full_name || "Parent B",
          parseInt(monthsAhead)
        );
        toast.success("Calendar file downloaded!");
      } else {
        exportScheduleToPDF(scheduleConfig, userProfile, coParent);
        toast.success("PDF schedule downloaded!");
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[#21B0FE]" />
            Export Schedule
          </DialogTitle>
          <DialogDescription>
            Export your custody schedule to sync with your personal calendar or create a court-ready document.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="calendar" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="calendar">Calendar Sync</TabsTrigger>
            <TabsTrigger value="pdf">PDF Document</TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="space-y-4 mt-4">
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <h4 className="font-medium mb-2">Google Calendar</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Download the .ics file and import it to Google Calendar.
              </p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Download the calendar file below</li>
                <li>Go to Google Calendar settings</li>
                <li>Click "Import & Export" → "Import"</li>
                <li>Select the downloaded file</li>
              </ol>
            </div>

            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <h4 className="font-medium mb-2">Apple Calendar (iPhone/Mac)</h4>
              <p className="text-sm text-muted-foreground mb-3">
                {appleInfo.description}
              </p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                {appleInfo.instructions.map((instruction, i) => (
                  <li key={i}>{instruction.replace(/^\d+\.\s*/, '')}</li>
                ))}
              </ol>
            </div>

            <div className="space-y-2">
              <Label>Export Duration</Label>
              <RadioGroup
                value={monthsAhead}
                onValueChange={setMonthsAhead}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="6" id="6months" />
                  <Label htmlFor="6months" className="font-normal">6 months</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="12" id="12months" />
                  <Label htmlFor="12months" className="font-normal">1 year</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="24" id="24months" />
                  <Label htmlFor="24months" className="font-normal">2 years</Label>
                </div>
              </RadioGroup>
            </div>

            <Button
              onClick={() => {
                setExportType("ics");
                handleExport();
              }}
              className="w-full bg-[#21B0FE] hover:bg-[#21B0FE]/90"
              disabled={isExporting || !scheduleConfig}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Download Calendar File (.ics)
            </Button>
          </TabsContent>

          <TabsContent value="pdf" className="space-y-4 mt-4">
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <h4 className="font-medium mb-2">Court-Ready PDF</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Generate a professional PDF document with your complete custody schedule.
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Schedule pattern details</li>
                <li>Exchange times and locations</li>
                <li>Holiday arrangements</li>
                <li>Party information</li>
              </ul>
            </div>

            <Button
              onClick={() => {
                setExportType("pdf");
                handleExport();
              }}
              className="w-full"
              disabled={isExporting || !scheduleConfig}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Download PDF Document
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
