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
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Printer, Download, Settings2, ArrowRightLeft, Loader2, Calendar, Trophy, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { CalendarWizard, ScheduleConfig } from "@/components/calendar/CalendarWizard";
import { CalendarExportDialog } from "@/components/calendar/CalendarExportDialog";
import { ScheduleChangeRequest, ScheduleChangeRequestData } from "@/components/calendar/ScheduleChangeRequest";
import { SportsEventDetail } from "@/components/calendar/SportsEventDetail";
import { SportsEventListPopup } from "@/components/calendar/SportsEventListPopup";
import { useScheduleRequests } from "@/hooks/useScheduleRequests";
import { useSchedulePersistence } from "@/hooks/useSchedulePersistence";
import { usePermissions } from "@/hooks/usePermissions";
import { useSportsEvents, CalendarSportsEvent } from "@/hooks/useSportsEvents";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { ViewOnlyBadge } from "@/components/ui/ViewOnlyBadge";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// Pattern definitions for different schedule types
const PATTERN_DEFINITIONS: Record<string, number[]> = {
  "alternating-weeks": [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1],
  "2-2-3": [0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 1, 1, 1],
  "2-2-5-5": [0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1],
  "3-4-4-3": [0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1],
  "every-other-weekend": [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
};

const getParentForDate = (date: Date, config: ScheduleConfig | null): "A" | "B" => {
  if (!config) {
    // Default alternating weeks
    const weekNumber = Math.floor(date.getTime() / (7 * 24 * 60 * 60 * 1000));
    return weekNumber % 2 === 0 ? "A" : "B";
  }

  const pattern = config.customPattern || PATTERN_DEFINITIONS[config.pattern] || PATTERN_DEFINITIONS["alternating-weeks"];
  const startDate = new Date(config.startDate);
  startDate.setHours(0, 0, 0, 0);
  
  const diffTime = date.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffTime / (24 * 60 * 60 * 1000));
  const patternIndex = ((diffDays % pattern.length) + pattern.length) % pattern.length;
  
  const parentFromPattern = pattern[patternIndex] === 0 ? "A" : "B";
  
  // Flip if starting parent is B
  if (config.startingParent === "B") {
    return parentFromPattern === "A" ? "B" : "A";
  }
  
  return parentFromPattern;
};

const CalendarPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { permissions, isThirdParty, isChildAccount, loading: roleLoading } = usePermissions();
  const { createRequest } = useScheduleRequests();
  const { scheduleConfig, loading: scheduleLoading, saving, saveSchedule } = useSchedulePersistence();
  const { events: sportsEvents, getEventsForDate, hasEventsOnDate, loading: sportsLoading } = useSportsEvents();
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

  // Fetch user profile and co-parent info
  useEffect(() => {
    const fetchProfiles = async () => {
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, email, co_parent_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile) {
        setUserProfile({ full_name: profile.full_name, email: profile.email });

        if (profile.co_parent_id) {
          const { data: coParentData } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", profile.co_parent_id)
            .maybeSingle();

          if (coParentData) {
            setCoParent(coParentData);
          }
        }
      }
    };

    fetchProfiles();
  }, [user]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startingDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const days: (Date | null)[] = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(new Date(year, month, day));
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const handleWizardComplete = async (config: ScheduleConfig) => {
    const success = await saveSchedule(config);
    if (success) {
      setShowWizard(false);
    }
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setShowChangeRequest(true);
  };

  const handleScheduleChangeRequest = async (
    request: Omit<ScheduleChangeRequestData, "id" | "status" | "createdAt" | "fromParent">
  ) => {
    // Store in database using the hook
    const result = await createRequest({
      request_type: request.type,
      original_date: request.originalDate,
      proposed_date: request.proposedDate,
      reason: request.reason,
    });

    if (result) {
      setShowChangeRequest(false);
      // Navigate to messages to show the request
      navigate("/messages");
    }
  };

  const getPatternName = () => {
    if (!scheduleConfig) return "Alternating Weeks (Default)";
    const patterns: Record<string, string> = {
      "alternating-weeks": "Alternating Weeks",
      "2-2-3": "2-2-3 Rotation",
      "2-2-5-5": "2-2-5-5 Rotation",
      "3-4-4-3": "3-4-4-3 Rotation",
      "every-other-weekend": "Every Other Weekend",
      "custom": "Custom Pattern",
    };
    return patterns[scheduleConfig.pattern] || scheduleConfig.pattern;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl lg:text-3xl font-display font-bold">Parenting Calendar</h1>
              {permissions.isViewOnly && (
                <ViewOnlyBadge reason={permissions.viewOnlyReason || undefined} />
              )}
            </div>
            <p className="text-muted-foreground mt-1">
              {permissions.isViewOnly 
                ? "View the family custody schedule" 
                : "View and manage your custody schedule"}
            </p>
          </div>
          {permissions.canEditCalendar && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setShowChangeRequest(true)}>
                <ArrowRightLeft className="w-4 h-4 mr-2" />
                Request Change
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowExportDialog(true)}>
                <Calendar className="w-4 h-4 mr-2" />
                Sync Calendar
              </Button>
              <Button size="sm" onClick={() => setShowWizard(true)} disabled={saving}>
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Settings2 className="w-4 h-4 mr-2" />
                )}
                {scheduleConfig ? "Edit Schedule" : "Setup Schedule"}
              </Button>
            </div>
          )}
        </motion.div>

        {/* Read-only notice for view-only users */}
        {permissions.isViewOnly && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="p-4 rounded-xl bg-muted/50 border border-border"
          >
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Read-Only Access</p>
                <p className="text-sm text-muted-foreground">
                  {isChildAccount 
                    ? "You can view the schedule but only parents can make changes."
                    : "As a family member, you can view the custody schedule but cannot make changes. Contact the parents if you need schedule modifications."}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Loading State */}
        {scheduleLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center py-12"
          >
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Loading schedule...</span>
          </motion.div>
        )}

        {/* Current Schedule Info */}
        {!scheduleLoading && scheduleConfig && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="p-4 rounded-xl bg-primary/5 border border-primary/20"
          >
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Pattern:</span>{" "}
                <span className="font-medium">{getPatternName()}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Exchange:</span>{" "}
                <span className="font-medium">{scheduleConfig.exchangeTime}</span>
              </div>
              {scheduleConfig.exchangeLocation && (
                <div>
                  <span className="text-muted-foreground">Location:</span>{" "}
                  <span className="font-medium">{scheduleConfig.exchangeLocation}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Holidays:</span>{" "}
                <span className="font-medium">{scheduleConfig.holidays.length} configured</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* View Toggle */}
        {!scheduleLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex gap-2"
          >
            <Button
              variant={viewMode === "calendar" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("calendar")}
            >
              Calendar View
            </Button>
            <Button
              variant={viewMode === "court" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("court")}
            >
              Court View
            </Button>
          </motion.div>
        )}

        {/* Legend */}
        {!scheduleLoading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex flex-wrap items-center gap-6"
        >
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-parent-a" />
            <span className="text-sm">Your Time (Parent A)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-parent-b" />
            <span className="text-sm">Co-Parent's Time (Parent B)</span>
          </div>
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span className="text-sm">Sports/Activity Event</span>
          </div>
        </motion.div>
        )}

        {!scheduleLoading && viewMode === "calendar" ? (
          /* Calendar View */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border border-border bg-card overflow-hidden"
          >
            {/* Calendar Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <button
                onClick={prevMonth}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-display font-semibold">
                {MONTHS[month]} {year}
              </h2>
              <button
                onClick={nextMonth}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 border-b border-border">
              {DAYS.map((day) => (
                <div
                  key={day}
                  className="py-3 text-center text-sm font-medium text-muted-foreground"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7">
              {days.map((date, index) => {
                if (!date) {
                  return <div key={`empty-${index}`} className="aspect-square border-b border-r border-border bg-muted/20" />;
                }

                const parent = getParentForDate(date, scheduleConfig);
                const isToday = date.getTime() === today.getTime();
                const hasSportsEvents = hasEventsOnDate(date);
                const dateSportsEvents = getEventsForDate(date);

                return (
                  <div
                    key={date.toISOString()}
                    onClick={() => !isThirdParty && handleDateClick(date)}
                    className={cn(
                      "aspect-square p-2 border-b border-r border-border relative transition-colors",
                      parent === "A" ? "bg-parent-a-light" : "bg-parent-b-light",
                      !isThirdParty && "cursor-pointer group hover:bg-parent-a/20 hover:bg-parent-b/20",
                      !isThirdParty && parent === "A" && "hover:bg-parent-a/20",
                      !isThirdParty && parent === "B" && "hover:bg-parent-b/20"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium",
                        isToday && "bg-primary text-primary-foreground"
                      )}
                    >
                      {date.getDate()}
                    </span>
                    <div className={cn(
                      "absolute bottom-1 right-1 w-2 h-2 rounded-full",
                      parent === "A" ? "bg-parent-a" : "bg-parent-b"
                    )} />
                    {/* Sports event indicator */}
                    {hasSportsEvents && (
                      <div 
                        className="absolute bottom-1 left-1 flex items-center gap-0.5 cursor-pointer z-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (dateSportsEvents.length === 1) {
                            setSelectedSportsEvent(dateSportsEvents[0]);
                          } else {
                            // For multiple events, show the list popup
                            setSportsEventListDate(date);
                            setSportsEventListEvents(dateSportsEvents);
                            setShowSportsEventList(true);
                          }
                        }}
                      >
                        <Trophy className="w-3 h-3 text-amber-500" />
                        {dateSportsEvents.length > 1 && (
                          <span className="text-[10px] font-medium text-amber-600">{dateSportsEvents.length}</span>
                        )}
                      </div>
                    )}
                    {!isThirdParty && !hasSportsEvents && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-background/60 rounded">
                        <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        ) : !scheduleLoading ? (
          /* Court View */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border border-border bg-card p-6"
          >
            <div className="text-center mb-8">
              <h2 className="text-xl font-display font-bold mb-2">Parenting Time Schedule</h2>
              <p className="text-sm text-muted-foreground">Court-Ready Summary Document</p>
            </div>

            <div className="max-w-2xl mx-auto space-y-6">
              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <h3 className="font-semibold mb-2">Schedule Pattern</h3>
                <p className="text-sm text-muted-foreground">
                  {getPatternName()} between Parent A and Parent B
                  {scheduleConfig?.exchangeTime && `, with exchanges occurring at ${scheduleConfig.exchangeTime}`}.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <h3 className="font-semibold mb-2">Holiday Schedule</h3>
                <div className="text-sm text-muted-foreground space-y-1">
                  {scheduleConfig?.holidays && scheduleConfig.holidays.length > 0 ? (
                    scheduleConfig.holidays.map((h) => (
                      <p key={h.name}>
                        • {h.name}:{" "}
                        {h.rule === "alternate"
                          ? "Alternating years (Parent A - Even years)"
                          : h.rule === "split"
                          ? "Split between parents"
                          : h.rule === "fixed-a"
                          ? "Always with Parent A"
                          : "Always with Parent B"}
                      </p>
                    ))
                  ) : (
                    <>
                      <p>• Thanksgiving: Alternating years (Parent A - Even years)</p>
                      <p>• Christmas Eve/Day: Split (Eve to one parent, Day to other)</p>
                      <p>• Summer Break: Two consecutive weeks each parent</p>
                    </>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <h3 className="font-semibold mb-2">Exchange Details</h3>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>• Primary Location: {scheduleConfig?.exchangeLocation || "School pickup/dropoff"}</p>
                  <p>• Alternate Location: {scheduleConfig?.alternateLocation || "Public library"}</p>
                  <p>• Standard Time: {scheduleConfig?.exchangeTime || "6:00 PM"}</p>
                </div>
              </div>

              <div className="flex justify-center pt-4">
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Export as PDF
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </div>

      {/* Calendar Wizard Modal */}
      <AnimatePresence>
        {showWizard && (
          <CalendarWizard
            onComplete={handleWizardComplete}
            onCancel={() => setShowWizard(false)}
          />
        )}
      </AnimatePresence>

      {/* Schedule Change Request Modal */}
      <AnimatePresence>
        {showChangeRequest && (
          <ScheduleChangeRequest
            selectedDate={selectedDate}
            onSubmit={handleScheduleChangeRequest}
            onCancel={() => setShowChangeRequest(false)}
          />
        )}
      </AnimatePresence>

      {/* Calendar Export Dialog */}
      <CalendarExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        scheduleConfig={scheduleConfig}
        userProfile={userProfile}
        coParent={coParent}
      />

      {/* Sports Event Detail Panel */}
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
              className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-background border border-border shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 z-10"
                onClick={() => setSelectedSportsEvent(null)}
              >
                <X className="w-4 h-4" />
              </Button>
              <SportsEventDetail event={selectedSportsEvent} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sports Event List Popup for Multiple Events */}
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
