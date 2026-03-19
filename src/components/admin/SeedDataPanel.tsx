import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Database, Trash2, Loader2 } from "lucide-react";
import { canSeed, seedAll, seedChildren, seedSchedule, seedJournalEntries, clearDemoData, SeedResult } from "@/lib/seedData";
import { useToast } from "@/hooks/use-toast";
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

export const SeedDataPanel = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const isDevMode = canSeed();

  const handleAction = async (action: string, fn: () => Promise<SeedResult>) => {
    setLoading(action);
    try {
      const result = await fn();
      toast({
        title: result.success ? "Success" : "Warning",
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Operation failed",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  if (!isDevMode) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Seed Data
          </CardTitle>
          <CardDescription>Demo data generation for testing</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium">Disabled in Production</p>
              <p className="text-sm text-muted-foreground">
                Seed data is only available in development mode to prevent accidental data creation.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Seed Data
            </CardTitle>
            <CardDescription>Generate demo data for testing and screenshots</CardDescription>
          </div>
          <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600">
            DEV ONLY
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg text-sm">
          <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
          <div>
            <p className="font-medium">Demo Data Rules</p>
            <ul className="text-muted-foreground mt-1 space-y-0.5">
              <li>• All demo items are prefixed with [Demo]</li>
              <li>• Respects plan limits and RLS policies</li>
              <li>• Can be cleared with the button below</li>
            </ul>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-medium">Individual Seeds</h4>
          <div className="grid gap-2">
            <Button
              variant="outline"
              onClick={() => handleAction("children", seedChildren)}
              disabled={loading !== null}
              className="justify-start"
            >
              {loading === "children" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Seed Sample Children (2)
            </Button>
            <Button
              variant="outline"
              onClick={() => handleAction("schedule", seedSchedule)}
              disabled={loading !== null}
              className="justify-start"
            >
              {loading === "schedule" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Seed Custody Schedule
            </Button>
            <Button
              variant="outline"
              onClick={() => handleAction("journal", seedJournalEntries)}
              disabled={loading !== null}
              className="justify-start"
            >
              {loading === "journal" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Seed Journal Entries
            </Button>
          </div>
        </div>

        <Separator />

        <div className="flex items-center gap-3">
          <Button
            onClick={() => handleAction("all", seedAll)}
            disabled={loading !== null}
          >
            {loading === "all" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Seed All Demo Data
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={loading !== null}>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Demo Data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear Demo Data?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete all items prefixed with [Demo]. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleAction("clear", clearDemoData)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Clear Data
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
};
