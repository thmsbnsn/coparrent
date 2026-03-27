import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertCircle, Bug, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ProblemReportCategory, ProblemReportSource } from "@/lib/problem-report/payload";

export interface ReportProblemFormValues {
  category: ProblemReportCategory;
  contactEmail: string;
  details: string;
  screenshotFile: File | null;
  summary: string;
}

interface ReportProblemModalProps {
  defaultEmail?: string | null;
  motionPrompt?: ReactNode;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ReportProblemFormValues) => Promise<void> | void;
  open: boolean;
  source: ProblemReportSource;
  submitError?: string | null;
  submitting: boolean;
}

const DEFAULT_VALUES = (defaultEmail?: string | null): ReportProblemFormValues => ({
  category: "Bug",
  contactEmail: defaultEmail ?? "",
  details: "",
  screenshotFile: null,
  summary: "",
});

const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;

export const ReportProblemModal = ({
  defaultEmail,
  motionPrompt,
  onOpenChange,
  onSubmit,
  open,
  source,
  submitError,
  submitting,
}: ReportProblemModalProps) => {
  const isMobile = useIsMobile();
  const [values, setValues] = useState<ReportProblemFormValues>(DEFAULT_VALUES(defaultEmail));
  const [errors, setErrors] = useState<Partial<Record<keyof ReportProblemFormValues, string>>>({});

  useEffect(() => {
    if (open) {
      setValues(DEFAULT_VALUES(defaultEmail));
      setErrors({});
    }
  }, [defaultEmail, open]);

  const helperText = useMemo(() => {
    if (source === "shake") {
      return "We captured basic app context automatically. Add what happened so the report is useful.";
    }

    return "Tell us what went wrong, what felt unclear, or what you wish the app handled better.";
  }, [source]);

  const validate = () => {
    const nextErrors: Partial<Record<keyof ReportProblemFormValues, string>> = {};

    if (values.summary.trim().length < 3) {
      nextErrors.summary = "Add a short description so the issue is easy to triage.";
    }

    if (values.details.trim().length < 10) {
      nextErrors.details = "Add a few more details about what you were doing and what happened.";
    }

    if (
      values.contactEmail.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contactEmail.trim())
    ) {
      nextErrors.contactEmail = "Enter a valid email address or leave it blank.";
    }

    if (values.screenshotFile) {
      if (!values.screenshotFile.type.startsWith("image/")) {
        nextErrors.screenshotFile = "Screenshots must be PNG, JPG, WebP, or another image format.";
      } else if (values.screenshotFile.size > MAX_SCREENSHOT_BYTES) {
        nextErrors.screenshotFile = "Screenshot must be 5MB or smaller.";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    await onSubmit(values);
  };

  const formContent = (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="rounded-2xl bg-muted/35 p-4 text-sm text-muted-foreground">
        {helperText}
      </div>

      {motionPrompt}

      <div className="space-y-2">
        <Label htmlFor="problem-summary">Short description</Label>
        <Input
          id="problem-summary"
          maxLength={120}
          placeholder="Example: Message send button did nothing"
          value={values.summary}
          onChange={(event) =>
            setValues((current) => ({ ...current, summary: event.target.value }))
          }
        />
        {errors.summary && (
          <p className="flex items-center gap-1 text-sm text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            {errors.summary}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="problem-category">Category</Label>
        <Select
          value={values.category}
          onValueChange={(value) =>
            setValues((current) => ({
              ...current,
              category: value as ProblemReportCategory,
            }))
          }
        >
          <SelectTrigger id="problem-category">
            <SelectValue placeholder="Choose a category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Bug">Bug</SelectItem>
            <SelectItem value="Confusing / unclear">Confusing / unclear</SelectItem>
            <SelectItem value="Feature request">Feature request</SelectItem>
            <SelectItem value="Other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="problem-details">Details</Label>
        <Textarea
          id="problem-details"
          placeholder="What were you trying to do? What happened instead? Anything you expected to see?"
          rows={5}
          value={values.details}
          onChange={(event) =>
            setValues((current) => ({ ...current, details: event.target.value }))
          }
        />
        {errors.details && (
          <p className="flex items-center gap-1 text-sm text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            {errors.details}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="problem-email">Email (optional)</Label>
        <Input
          id="problem-email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          type="email"
          value={values.contactEmail}
          onChange={(event) =>
            setValues((current) => ({ ...current, contactEmail: event.target.value }))
          }
        />
        {errors.contactEmail && (
          <p className="flex items-center gap-1 text-sm text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            {errors.contactEmail}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="problem-screenshot">Screenshot (optional)</Label>
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ImagePlus className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <Input
                id="problem-screenshot"
                accept="image/*"
                type="file"
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    screenshotFile: event.target.files?.[0] ?? null,
                  }))
                }
              />
              <p className="mt-2 text-xs text-muted-foreground">
                PNG, JPG, WebP, or similar image formats up to 5MB.
              </p>
              {values.screenshotFile && (
                <p className="mt-2 truncate text-sm font-medium">
                  {values.screenshotFile.name}
                </p>
              )}
            </div>
          </div>
        </div>
        {errors.screenshotFile && (
          <p className="flex items-center gap-1 text-sm text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            {errors.screenshotFile}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-muted/25 p-4 text-xs text-muted-foreground">
        We automatically include the current page, timestamp, app version, device info, viewport size,
        and PWA/standalone state when available.
      </div>

      {submitError && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {submitError}
        </div>
      )}

      {isMobile ? (
        <SheetFooter className="gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit report"}
          </Button>
        </SheetFooter>
      ) : (
        <DialogFooter className="gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit report"}
          </Button>
        </DialogFooter>
      )}
    </form>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[92vh] overflow-y-auto rounded-t-[28px] border-x-0 border-b-0 px-4 pb-6 pt-6"
        >
          <SheetHeader className="pr-10 text-left">
            <SheetTitle className="flex items-center gap-2 font-display">
              <Bug className="h-5 w-5 text-primary" />
              Report a problem
            </SheetTitle>
            <SheetDescription>
              Share a bug, confusing moment, or feature request without losing your place.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">{formContent}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Bug className="h-5 w-5 text-primary" />
            Report a problem
          </DialogTitle>
          <DialogDescription>
            Share a bug, confusing moment, or feature request without losing your place.
          </DialogDescription>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
};
