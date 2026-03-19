import { useState } from "react";
import { Download, Loader2, FileJson, Shield, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const DataExportSection = () => {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("Not authenticated");
      }

      const response = await supabase.functions.invoke("export-user-data", {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Create and download the file
      const blob = new Blob([JSON.stringify(response.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `coparrent-data-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Export Complete",
        description: "Your data has been downloaded successfully.",
      });
    } catch (error: unknown) {
      console.error("Export failed:", error);
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Download className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium">Export Your Data</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Download a copy of all your personal data stored in CoParrent. 
            This includes your profile, messages, documents, expenses, journal entries, and activity history.
          </p>
        </div>
      </div>

      <div className="pl-13 ml-10 space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileJson className="w-4 h-4" />
          <span>Exported as JSON format</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Shield className="w-4 h-4" />
          <span>GDPR & CCPA compliant data export</span>
        </div>
      </div>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="gap-2 ml-10" disabled={exporting}>
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Preparing Export...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download My Data
              </>
            )}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Export Personal Data
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                This will download all your personal data from CoParrent, including:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-sm">
                <li>Profile information and preferences</li>
                <li>All messages you've sent</li>
                <li>Document metadata (not files)</li>
                <li>Expense records</li>
                <li>Journal entries</li>
                <li>Schedule requests and exchange check-ins</li>
                <li>Activity audit logs</li>
              </ul>
              <p className="pt-2 font-medium">
                This export is logged for security purposes.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleExport} disabled={exporting}>
              {exporting ? "Exporting..." : "Export Data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
