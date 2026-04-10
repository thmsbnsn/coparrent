import { FormEvent, useState } from "react";
import { Gift, Loader2, Sparkles, Ticket } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { getAccessReasonLabel } from "@/lib/displayLabels";

interface AccessCodeRedeemerProps {
  onRedeemed?: () => Promise<void> | void;
}

type RedeemResponse = {
  ok?: boolean;
  code?: string;
  message?: string;
  data?: {
    tier?: string;
    label?: string;
    access_reason?: string;
  };
};

interface ResponseLike {
  clone?: () => ResponseLike;
  json?: () => Promise<unknown>;
}

const REDEEM_ERROR_TITLES: Record<string, string> = {
  ALREADY_REDEEMED: "Code already redeemed",
  AUTH_FAILED: "Authentication failed",
  AUTH_REQUIRED: "Authentication required",
  CODE_EXHAUSTED: "Code exhausted",
  EXPIRED_CODE: "Code expired",
  INACTIVE_CODE: "Code inactive",
  INVALID_CODE: "Invalid code",
  INVALID_REQUEST: "Invalid request",
  PROFILE_NOT_FOUND: "Profile not found",
  REDEEM_FAILED: "Redeem failed",
  SERVICE_UNAVAILABLE: "Service unavailable",
};

const isRedeemResponse = (value: unknown): value is RedeemResponse =>
  typeof value === "object" && value !== null && ("ok" in value || "code" in value || "message" in value);

const extractRedeemResponseFromError = async (error: unknown): Promise<RedeemResponse | null> => {
  if (!error || typeof error !== "object" || !("context" in error)) {
    return null;
  }

  const response = (error as { context?: ResponseLike }).context;
  if (!response) {
    return null;
  }

  try {
    const payload = response.clone ? await response.clone().json?.() : await response.json?.();
    return isRedeemResponse(payload) ? payload : null;
  } catch {
    return null;
  }
};

export function AccessCodeRedeemer({ onRedeemed }: AccessCodeRedeemerProps) {
  const { toast } = useToast();
  const { freeAccess, accessReason, subscribed, trial, checkSubscription } = useSubscription();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastRedeemedLabel, setLastRedeemedLabel] = useState<string | null>(null);

  const alreadyCovered = freeAccess || (subscribed && !trial);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) {
      toast({
        title: "Code required",
        description: "Enter an access code to continue.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke<RedeemResponse>("redeem-access-code", {
        body: { code: normalizedCode },
      });

      const responseData = data ?? (error ? await extractRedeemResponseFromError(error) : null);

      if (error && !responseData) {
        throw error;
      }

      if (!responseData?.ok) {
        toast({
          title: responseData?.code
            ? REDEEM_ERROR_TITLES[responseData.code] ?? "Unable to redeem code"
            : "Unable to redeem code",
          description: responseData?.message || "The code could not be redeemed.",
          variant: "destructive",
        });
        return;
      }

      setCode("");
      setLastRedeemedLabel(responseData.data?.label || null);
      await checkSubscription();
      await onRedeemed?.();

      toast({
        title: responseData.code === "ALREADY_REDEEMED" ? "Code already redeemed" : "Power access activated",
        description: responseData.message || "Your account has been updated.",
      });
    } catch (error) {
      const description = error instanceof Error ? error.message : "There was a problem redeeming your code.";
      toast({
        title: "Redeem failed",
        description,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (freeAccess) {
    return (
      <Card className="border-primary/40 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Gift className="w-5 h-5 text-primary" />
            Access Code Status
          </CardTitle>
          <CardDescription>
            Complimentary access is already active on this account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="bg-primary text-primary-foreground">
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              Power unlocked
            </Badge>
            {accessReason && (
              <span className="text-sm text-muted-foreground">
                {getAccessReasonLabel(accessReason)}
              </span>
            )}
          </div>
          {lastRedeemedLabel && (
            <p className="text-xs text-muted-foreground">
              Last redeemed code: {lastRedeemedLabel}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-dashed border-primary/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Ticket className="w-5 h-5 text-primary" />
          Redeem Access Code
        </CardTitle>
        <CardDescription>
          Enter a promotional or complimentary code to unlock Power access on this account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {alreadyCovered && (
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            This account already has paid Power access through billing. You do not need an access code.
          </div>
        )}

        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="ENTER-ACCESS-CODE"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              disabled={loading || alreadyCovered}
            />
            <p className="text-xs text-muted-foreground">
              Codes are single-use unless explicitly issued for multiple redemptions.
            </p>
          </div>

          <Button type="submit" disabled={loading || alreadyCovered} className="w-full sm:w-auto">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Ticket className="w-4 h-4 mr-2" />}
            Redeem Code
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
