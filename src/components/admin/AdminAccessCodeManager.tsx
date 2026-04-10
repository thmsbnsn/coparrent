import { useCallback, useEffect, useState } from "react";
import { Copy, Loader2, RefreshCw, Ticket, TicketX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type AccessCodeStatus = "active" | "expired" | "exhausted" | "inactive";
type AudienceTag = "custom" | "family" | "friend" | "partner" | "promoter";

interface AccessCodeSummary {
  access_reason: string;
  active: boolean;
  audience_tag: AudienceTag;
  code_preview: string;
  created_at: string;
  created_by: string | null;
  expires_at: string | null;
  grant_tier: string;
  id: string;
  label: string;
  max_redemptions: number;
  redeemed_count: number;
  remaining_redemptions: number;
  status: AccessCodeStatus;
  updated_at: string;
}

interface IssuedAccessCode extends AccessCodeSummary {
  code: string;
}

interface IssueResponse {
  issued_codes?: IssuedAccessCode[];
  quantity?: number;
}

interface ListResponse {
  codes?: AccessCodeSummary[];
}

interface DeactivateResponse {
  code?: AccessCodeSummary;
}

const AUDIENCE_OPTIONS: Array<{ label: string; value: AudienceTag }> = [
  { label: "Custom", value: "custom" },
  { label: "Friend", value: "friend" },
  { label: "Family", value: "family" },
  { label: "Partner", value: "partner" },
  { label: "Promoter", value: "promoter" },
];

const STATUS_LABELS: Record<AccessCodeStatus, string> = {
  active: "Active",
  exhausted: "Exhausted",
  expired: "Expired",
  inactive: "Inactive",
};

const STATUS_BADGE_CLASSNAMES: Record<AccessCodeStatus, string> = {
  active: "bg-emerald-500 text-white",
  exhausted: "bg-amber-500 text-white",
  expired: "bg-slate-500 text-white",
  inactive: "bg-rose-500 text-white",
};

const formatTimestamp = (value: string | null) => {
  if (!value) {
    return "No expiration";
  }

  return new Date(value).toLocaleString();
};

const defaultIssueForm = {
  accessReason: "",
  audienceTag: "custom" as AudienceTag,
  expiresAt: "",
  label: "",
  maxRedemptions: "1",
  quantity: "1",
};

export function AdminAccessCodeManager() {
  const { toast } = useToast();
  const [codes, setCodes] = useState<AccessCodeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<AccessCodeSummary | null>(null);
  const [issueForm, setIssueForm] = useState(defaultIssueForm);
  const [issuedCodes, setIssuedCodes] = useState<IssuedAccessCode[]>([]);

  const issuedCodeText = issuedCodes
    .map((issuedCode) => `${issuedCode.label}\t${issuedCode.code}`)
    .join("\n");

  const statusCounts = codes.reduce<Record<AccessCodeStatus, number>>(
    (counts, code) => {
      counts[code.status] += 1;
      return counts;
    },
    {
      active: 0,
      exhausted: 0,
      expired: 0,
      inactive: 0,
    },
  );

  const fetchCodes = useCallback(async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke<ListResponse>(
        "admin-manage-access-codes?action=list",
        {
          body: { limit: 100 },
          method: "POST",
        },
      );

      if (error) {
        throw error;
      }

      setCodes(data?.codes ?? []);
    } catch (error) {
      console.error("Failed to load access codes:", error);
      toast({
        title: "Load failed",
        description: "Unable to load complimentary access codes.",
        variant: "destructive",
      });
      setCodes([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchCodes();
  }, [fetchCodes]);

  const handleIssue = async () => {
    const parsedExpiration =
      issueForm.expiresAt.trim().length > 0 ? new Date(issueForm.expiresAt) : null;

    if (parsedExpiration && Number.isNaN(parsedExpiration.getTime())) {
      toast({
        title: "Invalid expiration",
        description: "Expiration must be a real date and time.",
        variant: "destructive",
      });
      return;
    }

    setIssuing(true);

    try {
      const { data, error } = await supabase.functions.invoke<IssueResponse>(
        "admin-manage-access-codes?action=issue",
        {
          body: {
            access_reason: issueForm.accessReason,
            audience_tag: issueForm.audienceTag,
            expires_at: parsedExpiration ? parsedExpiration.toISOString() : null,
            label: issueForm.label,
            max_redemptions: Number(issueForm.maxRedemptions),
            quantity: Number(issueForm.quantity),
          },
          method: "POST",
        },
      );

      if (error) {
        throw error;
      }

      const nextIssuedCodes = data?.issued_codes ?? [];
      setIssuedCodes(nextIssuedCodes);
      setIssueForm(defaultIssueForm);
      await fetchCodes();

      toast({
        title: nextIssuedCodes.length > 1 ? "Codes issued" : "Code issued",
        description:
          nextIssuedCodes.length > 1
            ? `${nextIssuedCodes.length} complimentary access codes were created.`
            : "Complimentary access code created.",
      });
    } catch (error) {
      const description =
        error instanceof Error ? error.message : "Unable to issue complimentary access codes.";
      toast({
        title: "Issue failed",
        description,
        variant: "destructive",
      });
    } finally {
      setIssuing(false);
    }
  };

  const handleCopyIssuedCodes = async () => {
    try {
      await navigator.clipboard.writeText(issuedCodeText);
      toast({
        title: "Copied",
        description: "Issued codes copied to clipboard.",
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Copy the issued codes manually before leaving this page.",
        variant: "destructive",
      });
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) {
      return;
    }

    setDeactivatingId(deactivateTarget.id);

    try {
      const { error } = await supabase.functions.invoke<DeactivateResponse>(
        "admin-manage-access-codes?action=deactivate",
        {
          body: { code_id: deactivateTarget.id },
          method: "POST",
        },
      );

      if (error) {
        throw error;
      }

      await fetchCodes();
      toast({
        title: "Code deactivated",
        description: `${deactivateTarget.code_preview} is now inactive.`,
      });
    } catch (error) {
      const description =
        error instanceof Error ? error.message : "Unable to deactivate the selected code.";
      toast({
        title: "Deactivate failed",
        description,
        variant: "destructive",
      });
    } finally {
      setDeactivatingId(null);
      setDeactivateTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            Complimentary Access Code Issuance
          </CardTitle>
          <CardDescription>
            Issue complimentary Power-access codes. Codes are generated server-side and shown only once after issuance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="access-code-label">Label</Label>
              <Input
                id="access-code-label"
                value={issueForm.label}
                onChange={(event) => setIssueForm((current) => ({ ...current, label: event.target.value }))}
                placeholder="Pilot Cohort April"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="access-code-audience">Audience</Label>
              <Select
                value={issueForm.audienceTag}
                onValueChange={(value: AudienceTag) =>
                  setIssueForm((current) => ({ ...current, audienceTag: value }))
                }
              >
                <SelectTrigger id="access-code-audience">
                  <SelectValue placeholder="Select audience" />
                </SelectTrigger>
                <SelectContent>
                  {AUDIENCE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="access-code-reason">Access reason</Label>
            <Textarea
              id="access-code-reason"
              value={issueForm.accessReason}
              onChange={(event) => setIssueForm((current) => ({ ...current, accessReason: event.target.value }))}
              placeholder="Phase-1 complimentary Power access"
              rows={3}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="access-code-redemptions">Redemption limit</Label>
              <Input
                id="access-code-redemptions"
                min={1}
                max={100}
                type="number"
                value={issueForm.maxRedemptions}
                onChange={(event) =>
                  setIssueForm((current) => ({ ...current, maxRedemptions: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="access-code-quantity">Quantity</Label>
              <Input
                id="access-code-quantity"
                min={1}
                max={25}
                type="number"
                value={issueForm.quantity}
                onChange={(event) => setIssueForm((current) => ({ ...current, quantity: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="access-code-expiration">Expiration</Label>
              <Input
                id="access-code-expiration"
                type="datetime-local"
                value={issueForm.expiresAt}
                onChange={(event) => setIssueForm((current) => ({ ...current, expiresAt: event.target.value }))}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleIssue} disabled={issuing}>
              {issuing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ticket className="mr-2 h-4 w-4" />}
              Issue code{issueForm.quantity === "1" ? "" : "s"}
            </Button>
            <p className="text-sm text-muted-foreground">
              Complimentary Power access only. No Stripe discounting is involved.
            </p>
          </div>
        </CardContent>
      </Card>

      {issuedCodes.length > 0 ? (
        <Card className="border-amber-300/70">
          <CardHeader>
            <CardTitle>Issued Codes</CardTitle>
            <CardDescription>
              Raw codes are shown once. Copy them now. They will not appear in the management list after refresh.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea readOnly value={issuedCodeText} rows={Math.min(Math.max(issuedCodes.length + 1, 4), 12)} />
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={handleCopyIssuedCodes}>
                <Copy className="mr-2 h-4 w-4" />
                Copy issued codes
              </Button>
              <Button variant="ghost" onClick={() => setIssuedCodes([])}>
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Issued Code Inventory</CardTitle>
              <CardDescription>
                Review current operational state and deactivate codes that should no longer redeem.
              </CardDescription>
            </div>
            <Button variant="outline" onClick={fetchCodes} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 text-sm">
            {(["active", "inactive", "expired", "exhausted"] as AccessCodeStatus[]).map((status) => (
              <Badge key={status} variant="outline">
                {STATUS_LABELS[status]}: {statusCounts[status]}
              </Badge>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : codes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              No complimentary access codes have been issued yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Preview</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Audience</TableHead>
                    <TableHead>Access reason</TableHead>
                    <TableHead>Redemptions</TableHead>
                    <TableHead>Expiration</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {codes.map((code) => (
                    <TableRow key={code.id}>
                      <TableCell>
                        <Badge className={STATUS_BADGE_CLASSNAMES[code.status]}>
                          {STATUS_LABELS[code.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{code.code_preview}</TableCell>
                      <TableCell>{code.label}</TableCell>
                      <TableCell className="capitalize">{code.audience_tag.replace("_", " ")}</TableCell>
                      <TableCell className="max-w-[240px] text-sm text-muted-foreground">
                        {code.access_reason}
                      </TableCell>
                      <TableCell className="text-sm">
                        {code.redeemed_count} / {code.max_redemptions}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatTimestamp(code.expires_at)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatTimestamp(code.created_at)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeactivateTarget(code)}
                          disabled={!code.active || deactivatingId === code.id}
                        >
                          {deactivatingId === code.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <TicketX className="mr-2 h-4 w-4" />
                          )}
                          Deactivate
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(deactivateTarget)} onOpenChange={(open) => !open && setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate complimentary access code?</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateTarget
                ? `${deactivateTarget.code_preview} will stop redeeming immediately. Existing redemptions stay on the affected accounts.`
                : "Select a code to deactivate."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate}>Deactivate code</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
