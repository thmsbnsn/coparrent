import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Clock, MapPin, X, ChevronRight, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CalendarSportsEvent } from "@/hooks/useSportsEvents";

interface SportsEventListPopupProps {
  events: CalendarSportsEvent[];
  date: Date;
  isOpen: boolean;
  onClose: () => void;
  onSelectEvent: (event: CalendarSportsEvent) => void;
}

const eventTypeColors: Record<string, string> = {
  practice: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  game: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  tournament: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  meeting: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  tryout: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  other: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const sportTypeIcons: Record<string, string> = {
  soccer: "⚽",
  basketball: "🏀",
  baseball: "⚾",
  football: "🏈",
  hockey: "🏒",
  tennis: "🎾",
  swimming: "🏊",
  gymnastics: "🤸",
  dance: "💃",
  martial_arts: "🥋",
  volleyball: "🏐",
  track: "🏃",
  golf: "⛳",
  lacrosse: "🥍",
  other: "🏅",
};

export const SportsEventListPopup = ({
  events,
  date,
  isOpen,
  onClose,
  onSelectEvent,
}: SportsEventListPopupProps) => {
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayHours = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    return `${displayHours}:${minutes} ${period}`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />
          
          {/* Popup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-md bg-card border border-border rounded-xl shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-amber-50 dark:bg-amber-950/20">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <div>
                  <h3 className="font-semibold text-foreground">Sports Events</h3>
                  <p className="text-sm text-muted-foreground">
                    {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Event List */}
            <ScrollArea className="max-h-[60vh]">
              <div className="p-2">
                {events.map((event, index) => (
                  <motion.button
                    key={event.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => onSelectEvent(event)}
                    className="w-full p-3 mb-2 last:mb-0 rounded-lg border border-border bg-background hover:bg-muted transition-colors text-left group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {/* Event Title with Sport Icon */}
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">
                            {sportTypeIcons[event.sport_type] || sportTypeIcons.other}
                          </span>
                          <span className="font-medium text-foreground truncate">
                            {event.title}
                          </span>
                        </div>

                        {/* Event Type & Child */}
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="secondary" className={eventTypeColors[event.event_type] || eventTypeColors.other}>
                            {event.event_type}
                          </Badge>
                          <span className="text-sm text-muted-foreground truncate">
                            {event.child_name}
                          </span>
                        </div>

                        {/* Time & Location */}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(event.start_time)}
                            {event.end_time && ` - ${formatTime(event.end_time)}`}
                          </span>
                          {event.location_name && (
                            <span className="flex items-center gap-1 truncate">
                              <MapPin className="w-3 h-3 flex-shrink-0" />
                              {event.location_name}
                            </span>
                          )}
                        </div>

                        {/* Parent Responsibilities */}
                        {(event.dropoff_parent_name || event.pickup_parent_name) && (
                          <div className="flex items-center gap-3 mt-2 text-xs">
                            {event.dropoff_parent_name && (
                              <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                                <User className="w-3 h-3" />
                                Drop-off: {event.dropoff_parent_name}
                              </span>
                            )}
                            {event.pickup_parent_name && (
                              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                <User className="w-3 h-3" />
                                Pick-up: {event.pickup_parent_name}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Arrow */}
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0 mt-1" />
                    </div>
                  </motion.button>
                ))}
              </div>
            </ScrollArea>

            {/* Footer */}
            <div className="p-3 border-t border-border bg-muted/30">
              <p className="text-xs text-center text-muted-foreground">
                {events.length} event{events.length !== 1 ? 's' : ''} on this day
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
