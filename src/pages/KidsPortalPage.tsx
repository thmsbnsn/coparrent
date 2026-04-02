import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { TrafficLightAccessRequest } from "@/components/kids/TrafficLightAccessRequest";
import { useChildAccount } from "@/hooks/useChildAccount";
import { useKidPortalAccess } from "@/hooks/useKidPortalAccess";
import { useToast } from "@/hooks/use-toast";

export default function KidsPortalPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { child_name, loading: childLoading, portal_mode } = useChildAccount();
  const { loading, requestAccess, requestState, scopeError } = useKidPortalAccess();

  useEffect(() => {
    if (!childLoading && portal_mode && portal_mode !== "under_6") {
      navigate("/kids", { replace: true });
    }
  }, [childLoading, navigate, portal_mode]);

  if (childLoading || loading) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#fff8ed_0%,#ffe0c6_100%)]">
        <LoadingSpinner fullScreen message="Opening Kids Portal..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fff8ed_0%,#ffe0c6_40%,#ffd4d4_100%)] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <Logo size="sm" />
          <div className="rounded-full bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
            {child_name ? `${child_name}'s portal` : "Kids portal"}
          </div>
        </div>

        {scopeError ? (
          <div className="rounded-[2rem] border border-rose-200 bg-white/90 p-8 shadow-sm">
            <div className="flex max-w-xl flex-col gap-4">
              <ShieldAlert className="h-8 w-8 text-rose-600" />
              <div>
                <h1 className="text-2xl font-display font-semibold">Family scope required</h1>
                <p className="mt-2 text-sm text-muted-foreground">{scopeError}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-fit rounded-full"
                onClick={() => navigate("/kids", { replace: true })}
              >
                Back
              </Button>
            </div>
          </div>
        ) : (
          <TrafficLightAccessRequest
            requestState={requestState}
            onOpenDashboard={() => navigate("/kids")}
            onRequestAccess={async () => {
              const success = await requestAccess();

              toast({
                title: success ? "Request sent" : "Request not sent",
                description: success
                  ? "A parent can approve this from the family app."
                  : "The request could not be sent right now.",
                variant: success ? "default" : "destructive",
              });
            }}
          />
        )}
      </div>
    </div>
  );
}
