import { useState } from "react";
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
import { cn } from "@/lib/utils";
import {
  CalendarIcon,
  FileText,
  Loader2,
  MessageSquare,
  Receipt,
  Calendar as CalendarIconSolid,
  Clock,
  Shield,
  Eye,
} from "lucide-react";
import { useCourtExport } from "@/hooks/useCourtExport";
import { generateCourtReadyPDF } from "@/lib/courtExportPDF";
import { toast } from "sonner";
import { FeatureStatusBadge } from "@/components/FeatureStatusBadge";

interface CourtExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CourtExportDialog = ({ open, onOpenChange }: CourtExportDialogProps) => {
  const { loading, fetchExportData } = useCourtExport();
  const [isExporting, setIsExporting] = useState(false);
  
  // Date range
  const [datePreset, setDatePreset] = useState("last-3-months");
  const [startDate, setStartDate] = useState<Date>(subMonths(new Date(), 3));
  const [endDate, setEndDate] = useState<Date>(new Date());
  
  // Section toggles
  const [includeMessages, setIncludeMessages] = useState(true);
  const [includeScheduleRequests, setIncludeScheduleRequests] = useState(true);
  const [includeExchangeCheckins, setIncludeExchangeCheckins] = useState(true);
  const [includeDocumentAccessLogs, setIncludeDocumentAccessLogs] = useState(true);
  const [includeExpenses, setIncludeExpenses] = useState(true);
  const [includeScheduleOverview, setIncludeScheduleOverview] = useState(true);

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
        // Keep current dates
        break;
    }
  };

  const handleExport = async () => {
    if (!startDate || !endDate) {
      toast.error("Please select a date range");
      return;
    }

    setIsExporting(true);
    try {
      const data = await fetchExportData({ start: startDate, end: endDate });
      
      if (!data) {
        throw new Error("Failed to fetch export data");
      }

      // Filter data based on selected sections
      const filteredData = {
        ...data,
        messages: includeMessages ? data.messages : [],
        scheduleRequests: includeScheduleRequests ? data.scheduleRequests : [],
        exchangeCheckins: includeExchangeCheckins ? data.exchangeCheckins : [],
        documentAccessLogs: includeDocumentAccessLogs ? data.documentAccessLogs : [],
        expenses: includeExpenses ? data.expenses : [],
        schedule: includeScheduleOverview ? data.schedule : null,
      };

      generateCourtReadyPDF(filteredData);
      toast.success("Court-ready report generated successfully");
      onOpenChange(false);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to generate report");
    } finally {
      setIsExporting(false);
    }
  };

  const recordCount = includeMessages ? "messages" : "";
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Court-Ready Export
            </DialogTitle>
            <FeatureStatusBadge status="stable" />
          </div>
          <DialogDescription>
            Generate a comprehensive PDF report combining all co-parenting records for legal use.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Date Range */}
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
                        !startDate && "text-muted-foreground"
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
                        !endDate && "text-muted-foreground"
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
              {format(startDate, "MMM d, yyyy")} — {format(endDate, "MMM d, yyyy")}
            </p>
          </div>

          {/* Sections to Include */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Include in Report</Label>
            <div className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="messages"
                  checked={includeMessages}
                  onCheckedChange={(checked) => setIncludeMessages(checked === true)}
                />
                <Label htmlFor="messages" className="flex items-center gap-2 cursor-pointer">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  Communication Log
                </Label>
              </div>

              <div className="flex items-center space-x-3">
                <Checkbox
                  id="scheduleRequests"
                  checked={includeScheduleRequests}
                  onCheckedChange={(checked) => setIncludeScheduleRequests(checked === true)}
                />
                <Label htmlFor="scheduleRequests" className="flex items-center gap-2 cursor-pointer">
                  <CalendarIconSolid className="h-4 w-4 text-muted-foreground" />
                  Schedule Change Requests
                </Label>
              </div>

              <div className="flex items-center space-x-3">
                <Checkbox
                  id="exchangeCheckins"
                  checked={includeExchangeCheckins}
                  onCheckedChange={(checked) => setIncludeExchangeCheckins(checked === true)}
                />
                <Label htmlFor="exchangeCheckins" className="flex items-center gap-2 cursor-pointer">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Exchange Check-ins
                </Label>
              </div>

              <div className="flex items-center space-x-3">
                <Checkbox
                  id="documentAccessLogs"
                  checked={includeDocumentAccessLogs}
                  onCheckedChange={(checked) => setIncludeDocumentAccessLogs(checked === true)}
                />
                <Label htmlFor="documentAccessLogs" className="flex items-center gap-2 cursor-pointer">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  Document Access Logs
                </Label>
              </div>

              <div className="flex items-center space-x-3">
                <Checkbox
                  id="expenses"
                  checked={includeExpenses}
                  onCheckedChange={(checked) => setIncludeExpenses(checked === true)}
                />
                <Label htmlFor="expenses" className="flex items-center gap-2 cursor-pointer">
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                  Expense Records
                </Label>
              </div>

              <div className="flex items-center space-x-3">
                <Checkbox
                  id="scheduleOverview"
                  checked={includeScheduleOverview}
                  onCheckedChange={(checked) => setIncludeScheduleOverview(checked === true)}
                />
                <Label htmlFor="scheduleOverview" className="flex items-center gap-2 cursor-pointer">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Custody Schedule Overview
                </Label>
              </div>
            </div>
          </div>

          {/* Info notice */}
          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            <p className="flex items-start gap-2">
              <Shield className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
              All records include timestamps and are presented in chronological order. Records cannot be modified after creation.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting || loading}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Generate Report
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
