import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Printer, Download, Settings2, ArrowRightLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { CalendarWizard, ScheduleConfig } from "@/components/calendar/CalendarWizard";
import { ScheduleChangeRequest, ScheduleChangeRequestData } from "@/components/calendar/ScheduleChangeRequest";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
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
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"calendar" | "court">("calendar");
  const [showWizard, setShowWizard] = useState(false);
  const [showChangeRequest, setShowChangeRequest] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig | null>(null);

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

  const handleWizardComplete = (config: ScheduleConfig) => {
    setScheduleConfig(config);
    setShowWizard(false);
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setShowChangeRequest(true);
  };

  const handleScheduleChangeRequest = (
    request: Omit<ScheduleChangeRequestData, "id" | "status" | "createdAt" | "fromParent">
  ) => {
    // Create the request object
    const fullRequest: ScheduleChangeRequestData = {
      ...request,
      id: Date.now().toString(),
      status: "pending",
      createdAt: new Date().toISOString(),
      fromParent: "A",
    };

    // Store in localStorage for demo (would be database in production)
    const existingRequests = JSON.parse(localStorage.getItem("scheduleRequests") || "[]");
    localStorage.setItem("scheduleRequests", JSON.stringify([...existingRequests, fullRequest]));

    setShowChangeRequest(false);
    toast({
      title: "Request Sent",
      description: "Your schedule change request has been sent to your co-parent.",
    });

    // Navigate to messages with the request
    navigate("/messages", { state: { newScheduleRequest: fullRequest } });
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
            <h1 className="text-2xl lg:text-3xl font-display font-bold">Parenting Calendar</h1>
            <p className="text-muted-foreground mt-1">View and manage your custody schedule</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setShowChangeRequest(true)}>
              <ArrowRightLeft className="w-4 h-4 mr-2" />
              Request Change
            </Button>
            <Button variant="outline" size="sm">
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button size="sm" onClick={() => setShowWizard(true)}>
              <Settings2 className="w-4 h-4 mr-2" />
              {scheduleConfig ? "Edit Schedule" : "Setup Schedule"}
            </Button>
          </div>
        </motion.div>

        {/* Current Schedule Info */}
        {scheduleConfig && (
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

        {/* Legend */}
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
        </motion.div>

        {viewMode === "calendar" ? (
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

                return (
                  <div
                    key={date.toISOString()}
                    onClick={() => handleDateClick(date)}
                    className={cn(
                      "aspect-square p-2 border-b border-r border-border relative transition-colors cursor-pointer group",
                      parent === "A" ? "bg-parent-a-light hover:bg-parent-a/20" : "bg-parent-b-light hover:bg-parent-b/20"
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
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-background/60 rounded">
                      <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        ) : (
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
        )}
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
    </DashboardLayout>
  );
};

export default CalendarPage;
