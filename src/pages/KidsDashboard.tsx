import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarDays, Loader2, LogOut, MessageCircleMore, Play, SmilePlus } from "lucide-react";
import { motion } from "framer-motion";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useChildAccount } from "@/hooks/useChildAccount";
import { useCallableFamilyMembers } from "@/hooks/useCallableFamilyMembers";
import { useCallSessions } from "@/hooks/useCallSessions";
import { useKidPortalAccess } from "@/hooks/useKidPortalAccess";
import { useKidsSchedule } from "@/hooks/useKidsSchedule";
import { useMoodCheckin } from "@/hooks/useMoodCheckin";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { KidsHomeHero } from "@/components/kids/KidsHomeHero";
import { KidsNavDock } from "@/components/kids/KidsNavDock";
import { ChildCallLauncher } from "@/components/kids/ChildCallLauncher";
import { FamilyPresenceToggle } from "@/components/family/FamilyPresenceToggle";
import { useToast } from "@/hooks/use-toast";
import { usePresenceHeartbeat } from "@/hooks/usePresenceHeartbeat";
import { isChildGameAllowed } from "@/lib/childAccess";
import { requiresPortalApproval } from "@/lib/kidsPortal";

const GAME_CARDS = [
  {
    accent: "from-sky-500 via-cyan-500 to-teal-400",
    cta: "Fly now",
    label: "Toy Plane Dash",
    subtitle: "Playable now",
    to: "/kids/games/flappy-plane",
  },
  { accent: "from-fuchsia-500 to-rose-400", cta: "Coming soon", label: "Animal Match", subtitle: "Placeholder game" },
  { accent: "from-amber-500 to-orange-400", cta: "Coming soon", label: "Color Splash", subtitle: "Placeholder game" },
  { accent: "from-violet-500 to-indigo-400", cta: "Coming soon", label: "Treasure Train", subtitle: "Placeholder game" },
  { accent: "from-emerald-500 to-lime-400", cta: "Coming soon", label: "Sky Builder", subtitle: "Placeholder game" },
] as const;

const MOODS = [
  { emoji: "😊", label: "Happy" },
  { emoji: "😌", label: "Calm" },
  { emoji: "😔", label: "Sad" },
  { emoji: "😤", label: "Frustrated" },
  { emoji: "😴", label: "Tired" },
  { emoji: "🤗", label: "Loved" },
];

const GamesPanel = ({
  allowedGameSlugs,
  gamesEnabled,
}: {
  allowedGameSlugs: string[];
  gamesEnabled: boolean;
}) => (
  <section className="rounded-[2rem] border border-border bg-white/85 p-5 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Game shelf</p>
        <h2 className="text-2xl font-display font-semibold">Play next</h2>
      </div>
      <div className="rounded-full bg-slate-950 px-3 py-1 text-xs font-medium text-white">
        1 ready + 4 soon
      </div>
    </div>

    {!gamesEnabled ? (
      <div className="mt-5 rounded-[1.75rem] bg-slate-100 p-5 text-sm text-slate-700">
        A parent turned games off for this child account on this device.
      </div>
    ) : (
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {GAME_CARDS.filter((game) =>
          !game.to || isChildGameAllowed({ allowed_game_slugs: allowedGameSlugs, games_enabled: gamesEnabled }, "flappy-plane"),
        ).map((game) => (
        <div
          key={game.label}
          className={`rounded-[1.75rem] bg-gradient-to-br ${game.accent} p-5 text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)]`}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/80">
            {game.subtitle}
          </p>
          <h3 className="mt-8 text-2xl font-display font-semibold">{game.label}</h3>
          {game.to ? (
            <Link
              to={game.to}
              className="mt-8 inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-sky-700 shadow-sm transition hover:bg-sky-50"
            >
              <Play className="mr-2 h-4 w-4" />
              {game.cta}
            </Link>
          ) : (
            <div className="mt-8 inline-flex rounded-full bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur">
              {game.cta}
            </div>
          )}
        </div>
        ))}
      </div>
    )}
  </section>
);

const TodayPanel = ({
  events,
  loading,
  showFullDetails,
}: {
  events: ReturnType<typeof useKidsSchedule>["events"];
  loading: boolean;
  showFullDetails: boolean;
}) => (
  <section className="rounded-[2rem] border border-border bg-white/85 p-5 shadow-sm">
    <div className="flex items-center gap-3">
      <div className="rounded-2xl bg-sky-100 p-3 text-sky-700">
        <CalendarDays className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-medium text-muted-foreground">Today</p>
        <h2 className="text-xl font-display font-semibold">What is happening?</h2>
      </div>
    </div>

    <div className="mt-5 space-y-3">
      {loading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading today...
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-[1.5rem] bg-slate-100 p-5 text-sm text-slate-700">
          No big plans are on the calendar today.
        </div>
      ) : (
        events.map((event) => (
          <div key={event.id} className="rounded-[1.5rem] bg-slate-100 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              {event.type}
            </p>
            <p className="mt-2 text-lg font-semibold">{showFullDetails ? event.title : "Event"}</p>
            <p className="mt-1 text-sm text-slate-600">
              {event.time || "Today"}
              {showFullDetails && event.location ? ` • ${event.location}` : ""}
            </p>
          </div>
        ))
      )}
    </div>
  </section>
);

const MoodPanel = ({
  allowMoodCheckins,
  onSelectMood,
  saving,
  todaysMood,
}: {
  allowMoodCheckins: boolean;
  onSelectMood: (mood: { emoji: string; label: string }) => Promise<void>;
  saving: boolean;
  todaysMood: ReturnType<typeof useMoodCheckin>["todaysMood"];
}) => {
  if (!allowMoodCheckins) {
    return null;
  }

  return (
    <section className="rounded-[2rem] border border-border bg-white/85 p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-pink-100 p-3 text-pink-700">
          <SmilePlus className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Mood</p>
          <h2 className="text-xl font-display font-semibold">How do you feel?</h2>
        </div>
      </div>

      {todaysMood ? (
        <div className="mt-5 rounded-[1.75rem] bg-gradient-to-br from-pink-50 to-amber-50 p-6 text-center">
          <div className="text-6xl">{todaysMood.emoji}</div>
          <p className="mt-3 text-xl font-display font-semibold">{todaysMood.mood}</p>
          <p className="mt-1 text-sm text-muted-foreground">You already checked in today.</p>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-3 gap-3">
          {MOODS.map((mood) => (
            <button
              key={mood.label}
              type="button"
              disabled={saving}
              onClick={() => void onSelectMood(mood)}
              className="rounded-[1.5rem] bg-slate-100 px-3 py-4 text-center transition hover:bg-slate-200 disabled:opacity-60"
            >
              <span className="block text-3xl">{mood.emoji}</span>
              <span className="mt-2 block text-xs font-medium">{mood.label}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
};

const MessagesPanel = ({
  canSendMessages,
  onOpen,
}: {
  canSendMessages: boolean;
  onOpen: () => void;
}) => {
  if (!canSendMessages) {
    return null;
  }

  return (
    <section className="rounded-[2rem] border border-border bg-white/85 p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
          <MessageCircleMore className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Messages</p>
          <h2 className="text-xl font-display font-semibold">Talk to family</h2>
        </div>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        Open the family message space to read notes and send safe replies.
      </p>

      <Button
        type="button"
        className="mt-5 h-12 rounded-full bg-slate-950 px-6 text-white hover:bg-slate-800"
        onClick={onOpen}
      >
        Open messages
      </Button>
    </section>
  );
};

export default function KidsDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, signOut, loading: authLoading } = useAuth();
  const {
    allow_family_chat,
    allowed_game_slugs,
    allow_mood_checkins,
    allow_parent_messaging,
    call_mode,
    calling_enabled,
    child_name,
    communication_enabled,
    games_enabled,
    isChildAccount,
    linkedChildId,
    loading: childLoading,
    portal_mode,
    scopeError,
    show_full_event_details,
  } = useChildAccount();
  const { loading: portalLoading, requestState } = useKidPortalAccess();
  const { events, loading: scheduleLoading } = useKidsSchedule(linkedChildId);
  const { loading: callableLoading, members: callableMembers } = useCallableFamilyMembers();
  const { todaysMood, saving, saveMood } = useMoodCheckin(linkedChildId);
  const { createCall } = useCallSessions(null);

  usePresenceHeartbeat({
    enabled: Boolean(isChildAccount && !scopeError),
    locationType: "dashboard",
  });

  useEffect(() => {
    if (!authLoading && !childLoading && !isChildAccount && user) {
      navigate("/dashboard");
    }
  }, [authLoading, childLoading, isChildAccount, navigate, user]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
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

  if (authLoading || childLoading || portalLoading) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#fff8ed_0%,#ffe0c6_100%)]">
        <LoadingSpinner fullScreen message="Loading kids dashboard..." />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (scopeError) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#fff8ed_0%,#ffe0c6_100%)] p-6">
        <div className="mx-auto max-w-xl rounded-[2rem] border border-rose-200 bg-white/90 p-8 shadow-sm">
          <h1 className="text-2xl font-display font-semibold">Family scope required</h1>
          <p className="mt-3 text-sm text-muted-foreground">{scopeError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fff8ed_0%,#ffe0c6_45%,#f7f4ef_100%)] px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-[1480px]">
        <div className="mb-5 flex items-center justify-between gap-4">
          <Logo size="sm" />
          <div className="flex items-center gap-3">
            <FamilyPresenceToggle tone="kids" />
            <div className="rounded-full bg-white/85 px-4 py-2 text-right shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Hello there</p>
              <p className="text-base font-display font-semibold text-slate-900">{child_name ?? "Kiddo"}</p>
            </div>
            <Button
              variant="outline"
              className="rounded-full bg-white/70"
              onClick={async () => {
                await signOut();
                toast({
                  title: "Signed out",
                  description: "See you next time.",
                });
                navigate("/");
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[92px_minmax(0,1fr)]">
          <div className="order-2 lg:order-1">
            <KidsNavDock />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="order-1 space-y-6"
          >
            <KidsHomeHero childName={child_name ?? "friend"} />
            <GamesPanel allowedGameSlugs={allowed_game_slugs} gamesEnabled={games_enabled} />

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-6">
                <ChildCallLauncher
                  contacts={communication_enabled && calling_enabled ? callableMembers : []}
                  loading={callableLoading}
                  onStartCall={async (contact, callType) => {
                    const session = await createCall({
                      callType,
                      calleeProfileId: contact.profileId,
                      source: "dashboard",
                    });

                    if (!session) {
                      toast({
                        title: "Call not started",
                        description: "This call could not be started right now.",
                        variant: "destructive",
                      });
                    }
                  }}
                />

                {!communication_enabled && (
                  <div className="rounded-[2rem] border border-border bg-white/85 p-5 shadow-sm">
                    <h3 className="text-xl font-display font-semibold">Communication</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      A parent turned off child communication on this device, so calls and messages
                      stay hidden here.
                    </p>
                  </div>
                )}

                {communication_enabled && !calling_enabled && (
                  <div className="rounded-[2rem] border border-border bg-white/85 p-5 shadow-sm">
                    <h3 className="text-xl font-display font-semibold">Calls</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      A parent needs to turn on calling before approved family members appear here.
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Current mode: {call_mode === "audio_video" ? "Audio + video" : "Audio only"}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <TodayPanel
                  events={events}
                  loading={scheduleLoading}
                  showFullDetails={show_full_event_details}
                />
                <MoodPanel
                  allowMoodCheckins={allow_mood_checkins}
                  onSelectMood={async (mood) => {
                    const success = await saveMood(mood.label, mood.emoji);

                    toast({
                      title: success ? "Mood saved" : "Mood not saved",
                      description: success
                        ? `You picked ${mood.label.toLowerCase()}.`
                        : "Try that one more time.",
                      variant: success ? "default" : "destructive",
                    });
                  }}
                  saving={saving}
                  todaysMood={todaysMood}
                />
                <MessagesPanel
                  canSendMessages={communication_enabled && (allow_parent_messaging || allow_family_chat)}
                  onOpen={() => navigate("/dashboard/messages")}
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
