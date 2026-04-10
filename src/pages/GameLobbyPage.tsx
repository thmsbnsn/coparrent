import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { GameLobbyCard } from "@/components/games/GameLobbyCard";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useAuth } from "@/contexts/AuthContext";
import { useFamily } from "@/contexts/FamilyContext";
import { useChildAccount } from "@/hooks/useChildAccount";
import { useGameLobby } from "@/hooks/useGameLobby";
import { useGameSessions } from "@/hooks/useGameSessions";
import { useKidPortalAccess } from "@/hooks/useKidPortalAccess";
import { usePresenceHeartbeat } from "@/hooks/usePresenceHeartbeat";
import { isChildGameAllowed } from "@/lib/childAccess";
import { FAMILY_GAMES } from "@/lib/gameRegistry";
import { requiresPortalApproval } from "@/lib/kidsPortal";

export default function GameLobbyPage() {
  const game = FAMILY_GAMES.flappyPlane;
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId?: string }>();
  const { user, loading: authLoading } = useAuth();
  const { profileId } = useFamily();
  const {
    allowed_game_slugs,
    games_enabled,
    isChildAccount,
    loading: childLoading,
    multiplayer_enabled,
    portal_mode,
    scopeError: childScopeError,
  } = useChildAccount();
  const {
    loading: portalLoading,
    requestState,
    scopeError: portalScopeError,
  } = useKidPortalAccess();
  const {
    ensureSession,
    loading: sessionsLoading,
    scopeError: sessionsScopeError,
  } = useGameSessions({
    gameDisplayName: game.displayName,
    gameSlug: game.slug,
  });
  const {
    currentMember,
    isJoined,
    joinLobby,
    loading: lobbyLoading,
    members,
    prepareRematch,
    scopeError: lobbyScopeError,
    session,
  } = useGameLobby({
    gameSlug: game.slug,
    sessionId: sessionId ?? null,
  });
  const [launchingLobby, setLaunchingLobby] = useState(false);
  const [actionPending, setActionPending] = useState<"join" | "rematch" | null>(null);
  const launcherAttemptRef = useRef<string | null>(null);
  const childCanUseLobby = !isChildAccount || (
    isChildGameAllowed(
      {
        allowed_game_slugs,
        games_enabled,
      },
      game.slug,
    ) &&
    multiplayer_enabled
  );

  usePresenceHeartbeat({
    enabled: Boolean(
      !authLoading &&
        user &&
        sessionId &&
        !childScopeError &&
        !portalScopeError &&
        !lobbyScopeError &&
        childCanUseLobby,
    ),
    gameDisplayName: game.displayName,
    gameSlug: game.slug,
    locationType: "lobby",
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login", { replace: true });
    }
  }, [authLoading, navigate, user]);

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

  const launcherKey = sessionId ? null : `${game.slug}:launcher`;

  useEffect(() => {
    if (!launcherKey || launcherAttemptRef.current === launcherKey) {
      return;
    }

    if (authLoading || childLoading || portalLoading || sessionsLoading || !user) {
      return;
    }

    if (childScopeError || portalScopeError || sessionsScopeError) {
      return;
    }

    launcherAttemptRef.current = launcherKey;
    setLaunchingLobby(true);

    void ensureSession()
      .then((resolvedSessionId) => {
        if (!resolvedSessionId) {
          return;
        }

        navigate(`${game.launcherPath}/${resolvedSessionId}`, {
          replace: true,
        });
      })
      .finally(() => {
        setLaunchingLobby(false);
      });
  }, [
    authLoading,
    childLoading,
    childScopeError,
    ensureSession,
    game.launcherPath,
    launcherKey,
    navigate,
    portalLoading,
    portalScopeError,
    sessionsLoading,
    sessionsScopeError,
    user,
  ]);

  const scopeError =
    childScopeError ??
    portalScopeError ??
    sessionsScopeError ??
    lobbyScopeError ??
    null;

  const isLoading =
    authLoading ||
    childLoading ||
    portalLoading ||
    launchingLobby ||
    (!sessionId && sessionsLoading) ||
    (Boolean(sessionId) && lobbyLoading);

  const handleJoin = async () => {
    setActionPending("join");
    try {
      await joinLobby();
    } finally {
      setActionPending(null);
    }
  };

  const handlePrepareRematch = async () => {
    setActionPending("rematch");
    try {
      await prepareRematch();
    } finally {
      setActionPending(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <LoadingSpinner
          fullScreen
          message={sessionId ? "Loading game lobby..." : "Opening family lobby..."}
        />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (scopeError) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-xl rounded-[2rem] border border-rose-200 bg-white/90 p-8 shadow-sm">
          <h1 className="text-2xl font-display font-semibold">Family scope required</h1>
          <p className="mt-3 text-sm text-muted-foreground">{scopeError}</p>
        </div>
      </DashboardLayout>
    );
  }

  if (isChildAccount && !isChildGameAllowed(
    {
      allowed_game_slugs,
      games_enabled,
      },
      game.slug,
    )) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-xl rounded-[2rem] border border-amber-200 bg-white/90 p-8 shadow-sm">
          <h1 className="text-2xl font-display font-semibold">Game unavailable</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Toy Plane Dash is not enabled for this child account right now.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  if (isChildAccount && !multiplayer_enabled) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-xl rounded-[2rem] border border-amber-200 bg-white/90 p-8 shadow-sm">
          <h1 className="text-2xl font-display font-semibold">Multiplayer unavailable</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            A parent or guardian needs to enable multiplayer before this child can join a family
            lobby.
          </p>
          <Button asChild className="mt-5 rounded-full">
            <Link to={game.playPath}>Open solo preview</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-background">
        <LoadingSpinner fullScreen message="Opening family lobby..." />
      </div>
    );
  }

  if (!session) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-xl rounded-[2rem] border border-border/70 bg-card/90 p-8 shadow-sm">
          <h1 className="text-2xl font-display font-semibold text-slate-950">
            Lobby unavailable
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            This Toy Plane Dash lobby could not be found for the active family.
          </p>
          <Button asChild className="mt-5 rounded-full">
            <Link to="/dashboard/games">Back to Games</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1400px] space-y-6">
        <section className="rounded-[2rem] border border-border/70 bg-card/90 p-5 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                className="rounded-full bg-white"
                onClick={() => navigate("/dashboard/games")}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Games
              </Button>

              <div>
                <div className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700">
                  <Sparkles className="mr-2 h-3.5 w-3.5" />
                  Shared family session
                </div>
                <h1 className="mt-3 text-3xl font-display font-semibold text-slate-950 sm:text-4xl">
                  {game.displayName}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Meet in one family-scoped lobby, confirm who is here, and then send everyone into
                  the shared preflight screen where ready-up, fullscreen, and the synchronized
                  countdown now live.
                </p>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-border/70 bg-muted/30 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Current room
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-950">
                {session.memberCount}/{session.maxPlayers} pilots
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {isJoined
                  ? currentMember?.status === "ready"
                    ? "You are marked ready."
                    : "You are in the lobby."
                  : "Join this room to be counted for launch."}
              </p>
            </div>
          </div>
        </section>

        <GameLobbyCard
          currentProfileId={profileId}
          flightDeckHref={`${game.playPath}?sessionId=${session.id}`}
          joining={actionPending === "join"}
          members={members}
          onJoin={handleJoin}
          onPrepareRematch={handlePrepareRematch}
          rematchPending={actionPending === "rematch"}
          session={session}
        />
      </div>
    </DashboardLayout>
  );
}
