/**
 * @page-role Overview/Action
 * @summary-pattern Custody calendar with parenting time visualization
 * @ownership Parent A (blue) vs Parent B (green) via semantic tokens
 * @court-view Print export and calendar export dialog for legal documentation
 *
 * LAW 1: Hybrid Overview (calendar view) + Action (wizard setup)
 * LAW 3: Uses parent-a/parent-b semantic classes for ownership distinction
 * LAW 5: Colors are purely semantic - blue=you, green=co-parent
 * LAW 6: Export dialog provides court-ready schedule documentation
 */
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRightLeft,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Lock,
  Printer,
  Settings2,
  ShieldCheck,
  Trophy,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { CalendarExportDialog } from "@/components/calendar/CalendarExportDialog";
import { CalendarWizard, ScheduleConfig } from "@/components/calendar/CalendarWizard";
import { ScheduleChangeRequest, ScheduleChangeRequestData } from "@/components/calendar/ScheduleChangeRequest";
import { SportsEventDetail } from "@/components/calendar/SportsEventDetail";
import { SportsEventListPopup } from "@/components/calendar/SportsEventListPopup";
import { ViewOnlyBadge } from "@/components/ui/ViewOnlyBadge";
import { Button } from "@/components/ui/button";
import { useFamily } from "@/contexts/FamilyContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useSchedulePersistence } from "@/hooks/useSchedulePersistence";
import { useScheduleRequests } from "@/hooks/useScheduleRequests";
import { useSportsEvents, CalendarSportsEvent } from "@/hooks/useSportsEvents";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const PATTERN_DEFINITIONS: Record<string, number[]> = {
  "alternating-weeks": [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1],
  "2-2-3": [0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 1, 1, 1],
  "2-2-5-5": [0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1],
  "3-4-4-3": [0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1],
  "every-other-weekend": [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
};

const getParentForDate = (date: Date, config: ScheduleConfig): "A" | "B" => {
  const pattern = config.customPattern || PATTERN_DEFINITIONS[config.pattern] || PATTERN_DEFINITIONS["alternating-weeks"];
  const startDate = new Date(config.startDate);
  startDate.setHours(0, 0, 0, 0);

  const diffTime = date.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffTime / (24 * 60 * 60 * 1000));
  const patternIndex = ((diffDays % pattern.length) + pattern.length) % pattern.length;

  const parentFromPattern = pattern[patternIndex] === 0 ? "A" : "B";

  if (config.startingParent === "B") {
    return parentFromPattern === "A" ? "B" : "A";
  }

  return parentFromPattern;
};

const getPatternName = (scheduleConfig: ScheduleConfig) => {
  const patterns: Record<string, string> = {
    "alternating-weeks": "Alternating weeks",
    "2-2-3": "2-2-3 rotation",
    "2-2-5-5": "2-2-5-5 rotation",
    "3-4-4-3": "3-4-4-3 rotation",
    "every-other-weekend": "Every other weekend",
    custom: "Custom pattern",
  };

  return patterns[scheduleConfig.pattern] || scheduleConfig.pattern;
};

const CalendarPage = () => {
  const navigate = useNavigate();
  const {
    activeFamily,
    activeFamilyId,
    loading: familyLoading,
    memberships = [],
    profileId,
  } = useFamily();
  const { permissions, isChildAccount, isThirdParty } = usePermissions();
  const { createRequest } = useScheduleRequests();
  const { scheduleConfig, loading: scheduleLoading, saving, saveSchedule } = useSchedulePersistence();
  const { getEventsForDate, hasEventsOnDate } = useSportsEvents();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"calendar" | "court">("calendar");
  const [showWizard, setShowWizard] = useState(false);
  const [showChangeRequest, setShowChangeRequest] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedSportsEvent, setSelectedSportsEvent] = useState<CalendarSportsEvent | null>(null);
  const [showSportsEventList, setShowSportsEventList] = useState(false);
  const [sportsEventListDate, setSportsEventListDate] = useState<Date | null>(null);
  const [sportsEventListEvents, setSportsEventListEvents] = useState<CalendarSportsEvent[]>([]);
  const [userProfile, setUserProfile] = useState<{ full_name: string | null; email: string | null } | null>(null);
  const [coParent, setCoParent] = useState<{ full_name: string | null; email: string | null } | null>(null);
  const [exportScopeError, setExportScopeError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfiles = async () => {
      if (familyLoading) {
        return;
      }

      if (!activeFamilyId || !profileId) {
        setUserProfile(null);
        setCoParent(null);
        setExportScopeError("Select an active family before syncing the calendar.");
        return;
      }

      setExportScopeError(null);

      const { data: familyAdults, error } = await supabase
        .from("family_members")
        .select("profile_id, profiles:profile_id(full_name, email)")
        .eq("family_id", activeFamilyId)
        .eq("status", "active")
        .in("role", ["parent", "guardian"]);

      if (error) {
        console.error("Error fetching family identities for export:", error);
        setUserProfile(null);
        setCoParent(null);
        setExportScopeError("Unable to resolve the active family's parent identities.");
        return;
      }

      const currentAdult = (familyAdults ?? []).find((adult) => adult.profile_id === profileId);
      const otherAdult = (familyAdults ?? []).find((adult) => adult.profile_id !== profileId);
      const currentProfileRecord = Array.isArray(currentAdult?.profiles) ? currentAdult.profiles[0] : currentAdult?.profiles;
      const otherProfileRecord = Array.isArray(otherAdult?.profiles) ? otherAdult.profiles[0] : otherAdult?.profiles;

      if (!currentProfileRecord) {
        setUserProfile(null);
        setCoParent(null);
        setExportScopeError("Unable to resolve your parent profile in the active family.");
        return;
      }

      setUserProfile({
        full_name: currentProfileRecord.full_name,
        email: currentProfileRecord.email,
      });
      setCoParent(
        otherProfileRecord
          ? {
              full_name: otherProfileRecord.full_name,
              email: otherProfileRecord.email,
            }
          : null,
      );
    };

    void fetchProfiles();
  }, [activeFamilyId, familyLoading, profileId]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startingDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();
  const hasFamilyScope = Boolean(activeFamilyId);

  const days: (Date | null)[] = useMemo(() => {
    const nextDays: (Date | null)[] = [];
    for (let index = 0; index < startingDayOfWeek; index += 1) {
      nextDays.push(null);
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      nextDays.push(new Date(year, month, day));
    }
    return nextDays;
  }, [daysInMonth, month, startingDayOfWeek, year]);

  const today = useMemo(() => {
    const nextToday = new Date();
    nextToday.setHours(0, 0, 0, 0);
    return nextToday;
  }, []);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const handleWizardComplete = async (config: ScheduleConfig) => {
    const success = await saveSchedule(config);
    if (success) {
      setShowWizard(false);
    }
  };

  const handleDateClick = (date: Date) => {
    if (!scheduleConfig || isThirdParty) {
      return;
    }

    setSelectedDate(date);
    setShowChangeRequest(true);
  };

  const handleOpenExportDialog = () => {
    if (familyLoading) {
      toast.error("Family scope is still loading. Try again in a moment.");
      return;
    }

    if (!activeFamilyId || exportScopeError) {
      toast.error(exportScopeError || "Select an active family before syncing the calendar.");
      return;
    }

    if (!scheduleConfig) {
      toast.error("Save a parenting schedule for the active family before syncing the calendar.");
      return;
    }

    setShowExportDialog(true);
  };

  const handleScheduleChangeRequest = async (
    request: Omit<ScheduleChangeRequestData, "id" | "status" | "createdAt" | "fromParent">,
  ) => {
    const result = await createRequest({
      original_date: request.originalDate,
      proposed_date: request.proposedDate,
      reason: request.reason,
      request_type: request.type,
    });

    if (result) {
      setShowChangeRequest(false);
      navigate(result.messageDestination);
    }
  };

  const activeFamilyLabel = activeFamily?.display_name || (hasFamilyScope ? "Selected family" : "No family selected");
  const scopeDescription = hasFamilyScope
    ? "Everything on this page is scoped to the selected family only."
    : memberships.length > 0
      ? "Select an active family before viewing, editing, or exporting a parenting schedule."
      : "A family assignment is required before a parenting schedule can load.";
  const accessLabel = permissions.isViewOnly
    ? isChildAccount
      ? "Child view"
      : "View-only family member"
    : "Parent or guardian";
  const scheduleStatusLabel = familyLoading
    ? "Resolving family scope"
    : !hasFamilyScope
      ? "Family scope required"
      : scheduleLoading
        ? "Loading saved plan"
        : scheduleConfig
          ? "Saved schedule active"
          : "No schedule saved";
  const scheduleSummary = scheduleConfig
    ? `${getPatternName(scheduleConfig)} with exchanges at ${scheduleConfig.exchangeTime || "not set yet"}`
    : "No parenting-time plan is shown until one is explicitly saved for the active family.";

  return (
    <DashboardLayout>
      <div className="page-shell-app page-stack">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="surface-hero p-5 text-white sm:p-6"
        >
          <div className="absolute inset-y-0 right-8 w-36 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute left-6 top-5 h-28 w-28 rounded-full bg-accent/20 blur-3xl" />
          <div className="relative flex flex-col gap-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Parenting calendar
                  </div>
                  <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200/80">
                    {scheduleStatusLabel}
                  </div>
                </div>
                <div className="space-y-3">
                  <h1 className="max-w-3xl text-3xl font-display font-bold tracking-tight text-white sm:text-4xl">
                    Family schedule without guesswork
                  </h1>
                  <p className="max-w-2xl text-sm leading-6 text-slate-200/80 sm:text-base">
                    Review parenting time, request changes, and export calendar details only inside the selected family.
                    If family scope or a saved plan is missing, this page stops and says so explicitly.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:w-[360px] xl:grid-cols-1">
                <div className="rounded-[24px] border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300/70">
                    Active family
                  </p>
                  <p className="mt-3 text-lg font-semibold text-white">{activeFamilyLabel}</p>
                  <p className="mt-1 text-sm text-slate-300/75">{scopeDescription}</p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-slate-950/35 p-4 backdrop-blur-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300/70">
                    Access
                  </p>
                  <p className="mt-3 text-lg font-semibold text-white">{accessLabel}</p>
                  <p className="mt-1 text-sm text-slate-300/75">
                    {permissions.isViewOnly
                      ? "You can review the schedule here, but mutations stay restricted to parents or guardians in the active family."
                      : "Edit, export, and change-request actions stay tied to the selected family only."}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
              <div className="rounded-[24px] border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300/70">
                  Schedule state
                </p>
                <p className="mt-3 text-xl font-display font-semibold text-white">{scheduleStatusLabel}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300/75">{scheduleSummary}</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300/70">
                  Family scope
                </p>
                <p className="mt-3 text-xl font-display font-semibold text-white">
                  {hasFamilyScope ? "Explicitly selected" : "Missing"}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300/75">
                  {hasFamilyScope
                    ? `Family ID ${activeFamilyId}`
                    : "Calendar details and exports remain hidden until a family is selected."}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300/70">
                  Quick actions
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  {permissions.canEditCalendar ? (
                    <Button
                      size="sm"
                      className="justify-start rounded-full bg-white text-slate-950 hover:bg-slate-100"
                      disabled={familyLoading || !hasFamilyScope || saving}
                      onClick={() => setShowWizard(true)}
                    >
                      <Settings2 className="mr-2 h-4 w-4" />
                      {scheduleConfig ? "Edit saved schedule" : "Set up schedule"}
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start rounded-full border-white/15 bg-white/6 text-white hover:bg-white/10"
                    disabled={familyLoading || !hasFamilyScope || !scheduleConfig}
                    onClick={handleOpenExportDialog}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    Sync calendar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {permissions.isViewOnly && hasFamilyScope && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-[24px] border border-border/70 bg-card/90 p-4 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.8)]"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-muted/60 text-muted-foreground">
                <Lock className="h-5 w-5" />
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-foreground">Read-only access</p>
                  <ViewOnlyBadge reason={permissions.viewOnlyReason || undefined} />
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  {isChildAccount
                    ? "You can review the family schedule, but only parents or guardians can save changes or send schedule requests."
                    : "You can review this family's schedule, but change requests and schedule edits stay limited to parents or guardians."}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {familyLoading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center rounded-[30px] border border-border/70 bg-card/90 px-6 py-16 shadow-[0_24px_50px_-36px_rgba(15,23,42,0.85)]"
          >
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
              <p className="mt-4 text-sm font-semibold text-foreground">Resolving family scope</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                The calendar waits for an explicit active family before it shows parenting-time details.
              </p>
            </div>
          </motion.div>
        ) : !hasFamilyScope ? (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[30px] border border-warning/30 bg-gradient-to-br from-warning/10 via-card to-card p-6 shadow-[0_24px_50px_-36px_rgba(15,23,42,0.85)]"
          >
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div className="flex gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-warning/35 bg-warning/10 text-warning">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-warning">
                    Fail-closed family scope
                  </p>
                  <h2 className="text-2xl font-display font-semibold text-foreground">Family scope required</h2>
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                    {memberships.length > 0
                      ? "Select an active family before viewing, printing, or exporting the parenting calendar. This page does not infer which family you mean."
                      : "No family assignment is available for this account yet, so the parenting calendar stays unavailable until scope is explicit."}
                  </p>
                </div>
              </div>
              <div className="rounded-[22px] border border-border/70 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
                {memberships.length > 0
                  ? "Use the family switcher in the sidebar to choose the family you want."
                  : "Complete family setup or accept an invitation before returning here."}
              </div>
            </div>
          </motion.div>
        ) : scheduleLoading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center rounded-[30px] border border-border/70 bg-card/90 px-6 py-16 shadow-[0_24px_50px_-36px_rgba(15,23,42,0.85)]"
          >
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
              <p className="mt-4 text-sm font-semibold text-foreground">Loading saved schedule</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                We are loading the parenting plan for {activeFamilyLabel.toLowerCase()} before showing calendar details.
              </p>
            </div>
          </motion.div>
        ) : !scheduleConfig ? (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[30px] border border-border/70 bg-gradient-to-br from-card via-card to-muted/20 p-6 shadow-[0_24px_50px_-36px_rgba(15,23,42,0.85)]"
          >
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                    Explicit schedule required
                  </p>
                  <h2 className="text-2xl font-display font-semibold text-foreground">
                    No parenting plan saved for this family
                  </h2>
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                    The calendar will not assume an alternating pattern or generate a legal summary on its own.
                    Save a schedule for {activeFamilyLabel.toLowerCase()} first, then the day-by-day calendar and
                    export tools will unlock.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                {permissions.canEditCalendar ? (
                  <Button className="rounded-full" onClick={() => setShowWizard(true)} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Settings2 className="mr-2 h-4 w-4" />}
                    Set up schedule
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={handleOpenExportDialog}
                  disabled
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Sync calendar
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="grid gap-4 xl:grid-cols-[1.35fr_0.85fr]"
            >
              <div className="rounded-[28px] border border-border/70 bg-gradient-to-br from-card via-card to-muted/25 p-5 shadow-[0_24px_50px_-36px_rgba(15,23,42,0.85)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                        Saved plan
                      </div>
                      <div className="rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
                        {getPatternName(scheduleConfig)}
                      </div>
                    </div>
                    <div>
                      <h2 className="text-2xl font-display font-semibold text-foreground">Current parenting plan</h2>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Review the saved schedule for {activeFamilyLabel.toLowerCase()}, request changes when needed,
                        and keep print and sync actions tied to the same explicit family.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                    {permissions.canEditCalendar ? (
                      <Button variant="outline" className="rounded-full" onClick={() => setShowChangeRequest(true)}>
                        <ArrowRightLeft className="mr-2 h-4 w-4" />
                        Request change
                      </Button>
                    ) : null}
                    <Button variant="outline" className="rounded-full" onClick={() => window.print()}>
                      <Printer className="mr-2 h-4 w-4" />
                      Print
                    </Button>
                    <Button variant="outline" className="rounded-full" onClick={handleOpenExportDialog}>
                      <Calendar className="mr-2 h-4 w-4" />
                      Sync calendar
                    </Button>
                    {permissions.canEditCalendar ? (
                      <Button className="rounded-full" onClick={() => setShowWizard(true)} disabled={saving}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Settings2 className="mr-2 h-4 w-4" />}
                        Edit schedule
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-border/70 bg-gradient-to-br from-card via-card to-muted/25 p-5 shadow-[0_24px_50px_-36px_rgba(15,23,42,0.85)]">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-[22px] border border-border/70 bg-background/65 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Exchange time
                    </p>
                    <p className="mt-2 text-lg font-semibold text-foreground">{scheduleConfig.exchangeTime || "Not set"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {scheduleConfig.exchangeLocation || "No primary exchange location saved yet."}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-border/70 bg-background/65 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Holiday overrides
                    </p>
                    <p className="mt-2 text-lg font-semibold text-foreground">{scheduleConfig.holidays.length}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {scheduleConfig.holidays.length > 0
                        ? "Custom holiday rules are saved for this family."
                        : "No custom holiday overrides are saved yet."}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="flex flex-col gap-4 rounded-[28px] border border-border/70 bg-card/90 p-5 shadow-[0_20px_45px_-34px_rgba(15,23,42,0.85)]"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-sm font-medium text-foreground">
                    <div className="h-3 w-3 rounded-full bg-parent-a" />
                    Your parenting time
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-sm font-medium text-foreground">
                    <div className="h-3 w-3 rounded-full bg-parent-b" />
                    Other parent or guardian
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-sm font-medium text-foreground">
                    <Trophy className="h-4 w-4 text-amber-500" />
                    Sports or activity day
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant={viewMode === "calendar" ? "default" : "outline"}
                    size="sm"
                    className="rounded-full"
                    onClick={() => setViewMode("calendar")}
                  >
                    Calendar view
                  </Button>
                  <Button
                    variant={viewMode === "court" ? "default" : "outline"}
                    size="sm"
                    className="rounded-full"
                    onClick={() => setViewMode("court")}
                  >
                    Legal view
                  </Button>
                </div>
              </div>

              {exportScopeError ? (
                <div className="rounded-[20px] border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-muted-foreground">
                  {exportScopeError}
                </div>
              ) : null}
            </motion.div>

            {viewMode === "calendar" ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 }}
                className="overflow-hidden rounded-[30px] border border-border/70 bg-card shadow-[0_24px_50px_-36px_rgba(15,23,42,0.85)]"
              >
                <div className="flex items-center justify-between border-b border-border/70 px-4 py-4 sm:px-5">
                  <button
                    onClick={prevMonth}
                    className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-background/70 transition-colors hover:bg-muted"
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div className="text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Saved family plan
                    </p>
                    <h2 className="mt-1 text-lg font-display font-semibold text-foreground">
                      {MONTHS[month]} {year}
                    </h2>
                  </div>
                  <button
                    onClick={nextMonth}
                    className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-background/70 transition-colors hover:bg-muted"
                    aria-label="Next month"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>

                <div className="grid grid-cols-7 border-b border-border/70 bg-muted/20">
                  {DAYS.map((day) => (
                    <div
                      key={day}
                      className="px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-xs"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7">
                  {days.map((date, index) => {
                    if (!date) {
                      return (
                        <div
                          key={`empty-${index}`}
                          className="aspect-square border-b border-r border-border/70 bg-muted/15"
                        />
                      );
                    }

                    const parent = getParentForDate(date, scheduleConfig);
                    const isToday = date.getTime() === today.getTime();
                    const hasSportsEvents = hasEventsOnDate(date);
                    const dateSportsEvents = getEventsForDate(date);

                    return (
                      <div
                        key={date.toISOString()}
                        onClick={() => handleDateClick(date)}
                        className={cn(
                          "group relative aspect-square border-b border-r border-border/70 p-2 transition-colors",
                          parent === "A" ? "bg-parent-a-light" : "bg-parent-b-light",
                          permissions.canEditCalendar && "cursor-pointer hover:brightness-[0.98]",
                        )}
                      >
                        <span
                          className={cn(
                            "inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium",
                            isToday && "bg-primary text-primary-foreground",
                          )}
                        >
                          {date.getDate()}
                        </span>
                        <div
                          className={cn(
                            "absolute bottom-1.5 right-1.5 h-2.5 w-2.5 rounded-full shadow-sm",
                            parent === "A" ? "bg-parent-a" : "bg-parent-b",
                          )}
                        />
                        {hasSportsEvents ? (
                          <div
                            className="absolute bottom-1.5 left-1.5 z-10 flex items-center gap-0.5"
                            onClick={(event) => {
                              event.stopPropagation();
                              if (dateSportsEvents.length === 1) {
                                setSelectedSportsEvent(dateSportsEvents[0]);
                              } else {
                                setSportsEventListDate(date);
                                setSportsEventListEvents(dateSportsEvents);
                                setShowSportsEventList(true);
                              }
                            }}
                          >
                            <Trophy className="h-3 w-3 text-amber-500" />
                            {dateSportsEvents.length > 1 ? (
                              <span className="text-[10px] font-medium text-amber-600">{dateSportsEvents.length}</span>
                            ) : null}
                          </div>
                        ) : permissions.canEditCalendar ? (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                            <div className="rounded-full border border-border/70 bg-background/75 p-2 text-muted-foreground shadow-sm">
                              <ArrowRightLeft className="h-4 w-4" />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 }}
                className="surface-legal p-6"
              >
                <div className="mx-auto max-w-3xl space-y-6">
                  <div className="text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Legal summary
                    </p>
                    <h2 className="mt-2 text-2xl font-display font-bold text-foreground">Parenting time schedule</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Family-scoped summary for {activeFamilyLabel.toLowerCase()}. Export from this saved schedule only.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="surface-legal-muted p-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Schedule pattern
                      </p>
                      <p className="mt-3 text-xl font-display font-semibold text-foreground">
                        {getPatternName(scheduleConfig)}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Starting parent {scheduleConfig.startingParent}, beginning {format(scheduleConfig.startDate, "PPP")}.
                      </p>
                    </div>

                    <div className="surface-legal-muted p-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Exchange details
                      </p>
                      <p className="mt-3 text-xl font-display font-semibold text-foreground">
                        {scheduleConfig.exchangeTime || "Not set"}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {scheduleConfig.exchangeLocation || "No exchange location saved."}
                        {scheduleConfig.alternateLocation
                          ? ` Alternate: ${scheduleConfig.alternateLocation}.`
                          : ""}
                      </p>
                    </div>
                  </div>

                  <div className="surface-legal-muted p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Holiday schedule
                    </p>
                    <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                      {scheduleConfig.holidays.length > 0 ? (
                        scheduleConfig.holidays.map((holiday) => (
                          <p key={holiday.name}>
                            {holiday.name}:{" "}
                            {holiday.rule === "alternate"
                              ? "Alternating years (Parent A on even years)"
                              : holiday.rule === "split"
                                ? "Split between parents"
                                : holiday.rule === "fixed-a"
                                  ? "Always with Parent A"
                                  : "Always with Parent B"}
                          </p>
                        ))
                      ) : (
                        <p>No custom holiday rules are saved for this family.</p>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <Button variant="outline" className="rounded-full" onClick={handleOpenExportDialog}>
                      <Download className="mr-2 h-4 w-4" />
                      Export from saved schedule
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>
      <AnimatePresence>
        {showWizard && (
          <CalendarWizard
            onCancel={() => setShowWizard(false)}
            onComplete={handleWizardComplete}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showChangeRequest && scheduleConfig && (
          <ScheduleChangeRequest
            selectedDate={selectedDate}
            onCancel={() => setShowChangeRequest(false)}
            onSubmit={handleScheduleChangeRequest}
          />
        )}
      </AnimatePresence>

      <CalendarExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        scheduleConfig={scheduleConfig}
        userProfile={userProfile}
        coParent={coParent}
      />

      <AnimatePresence>
        {selectedSportsEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setSelectedSportsEvent(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-background shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 z-10"
                onClick={() => setSelectedSportsEvent(null)}
              >
                <X className="h-4 w-4" />
              </Button>
              <SportsEventDetail event={selectedSportsEvent} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <SportsEventListPopup
        events={sportsEventListEvents}
        date={sportsEventListDate || new Date()}
        isOpen={showSportsEventList}
        onClose={() => setShowSportsEventList(false)}
        onSelectEvent={(event) => {
          setShowSportsEventList(false);
          setSelectedSportsEvent(event);
        }}
      />
    </DashboardLayout>
  );
};

export default CalendarPage;
