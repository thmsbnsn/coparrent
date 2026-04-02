import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { GameShell } from "@/components/kids/games/GameShell";
import { FlappyPlaneGame } from "@/components/kids/games/FlappyPlaneGame";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useChildAccount } from "@/hooks/useChildAccount";
import { useKidPortalAccess } from "@/hooks/useKidPortalAccess";
import { usePresenceHeartbeat } from "@/hooks/usePresenceHeartbeat";
import { FAMILY_GAMES } from "@/lib/gameRegistry";
import { requiresPortalApproval } from "@/lib/kidsPortal";

export default function KidsFlappyPage() {
  const game = FAMILY_GAMES.flappyPlane;
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const {
    child_name,
    isChildAccount,
    loading: childLoading,
    portal_mode,
    scopeError,
  } = useChildAccount();
  const { loading: portalLoading, requestState } = useKidPortalAccess();

  usePresenceHeartbeat({
    enabled: Boolean(isChildAccount && !scopeError),
    gameDisplayName: game.displayName,
    gameSlug: game.slug,
    locationType: "game",
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login", { replace: true });
    }
  }, [authLoading, navigate, user]);

  useEffect(() => {
    if (!authLoading && !childLoading && user && !isChildAccount) {
      navigate("/dashboard", { replace: true });
    }
  }, [authLoading, childLoading, isChildAccount, navigate, user]);

  useEffect(() => {
    if (
      !authLoading &&
      !childLoading &&
      !portalLoading &&
      isChildAccount &&
      requiresPortalApproval(portal_mode, requestState)
    ) {
      navigate("/kids/portal", { replace: true });
    }
  }, [authLoading, childLoading, isChildAccount, navigate, portalLoading, portal_mode, requestState]);

  if (authLoading || childLoading || portalLoading) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#eef7ff_0%,#f6efe4_100%)]">
        <LoadingSpinner fullScreen message="Loading game..." />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (scopeError) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#eef7ff_0%,#f6efe4_100%)] p-6">
        <div className="mx-auto max-w-xl rounded-[2rem] border border-rose-200 bg-white/90 p-8 shadow-sm">
          <h1 className="text-2xl font-display font-semibold">Family scope required</h1>
          <p className="mt-3 text-sm text-muted-foreground">{scopeError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef7ff_0%,#dff2ff_35%,#f6efe4_100%)] px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-[1400px]">
        <GameShell
          backLabel="Back to Kids"
          title={game.displayName}
          description={`${
            child_name ? `${child_name}, ` : ""
          }keep the blue plane gliding through the rocky gaps without touching the grass.`}
          onBack={() => navigate("/kids")}
        >
          <FlappyPlaneGame />
        </GameShell>
      </div>
    </div>
  );
}
