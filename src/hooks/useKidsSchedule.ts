import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, isToday, parseISO } from "date-fns";

interface ScheduleEvent {
  id: string;
  title: string;
  time: string;
  type: "exchange" | "activity" | "sports";
  location?: string;
}

interface UseKidsScheduleReturn {
  events: ScheduleEvent[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface ActivityEventRow {
  id: string;
  title: string | null;
  start_time: string | null;
  event_type: string | null;
  location_name: string | null;
  activity: {
    child_id: string | null;
    name: string | null;
  } | {
    child_id: string | null;
    name: string | null;
  }[] | null;
}

/**
 * Hook to fetch today's schedule for a child account.
 * Combines custody schedule events and sports/activity events.
 */
export const useKidsSchedule = (linkedChildId: string | null): UseKidsScheduleReturn => {
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedule = useCallback(async () => {
    if (!linkedChildId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const scheduleEvents: ScheduleEvent[] = [];

      // Fetch activity events for today
      const { data: activityEvents, error: activityError } = await supabase
        .from("activity_events")
        .select(`
          id,
          title,
          start_time,
          event_type,
          location_name,
          activity:child_activities!inner(
            child_id,
            name
          )
        `)
        .eq("event_date", today)
        .eq("is_cancelled", false);

      if (activityError) {
        console.error("Error fetching activity events:", activityError);
      } else if (activityEvents) {
        const normalizedActivityEvents = activityEvents as ActivityEventRow[];

        // Filter events for this child
        const childEvents = normalizedActivityEvents.filter((event) => {
          const activity = Array.isArray(event.activity) ? event.activity[0] : event.activity;
          return activity?.child_id === linkedChildId;
        });

        for (const event of childEvents) {
          const activity = Array.isArray(event.activity) ? event.activity[0] : event.activity;
          scheduleEvents.push({
            id: event.id,
            title: event.title || activity?.name || "Event",
            time: event.start_time ? format(parseISO(`2000-01-01T${event.start_time}`), "h:mm a") : "",
            type: "sports",
            location: event.location_name || undefined,
          });
        }
      }

      // Check if today is an exchange day based on custody schedules
      const { data: schedules, error: scheduleError } = await supabase
        .from("custody_schedules")
        .select("id, exchange_time, exchange_location, child_ids")
        .not("child_ids", "is", null);

      if (scheduleError) {
        console.error("Error fetching custody schedules:", scheduleError);
      } else if (schedules) {
        // Check if this child is in any schedule
        for (const schedule of schedules) {
          const childIds = schedule.child_ids as string[] | null;
          if (childIds?.includes(linkedChildId) && schedule.exchange_time) {
            // Check if today might be an exchange day (simplified check)
            scheduleEvents.unshift({
              id: `exchange-${schedule.id}`,
              title: "Custody Exchange",
              time: schedule.exchange_time,
              type: "exchange",
              location: schedule.exchange_location || undefined,
            });
            break; // Only show one exchange per day
          }
        }
      }

      // Sort by time
      scheduleEvents.sort((a, b) => {
        if (!a.time) return 1;
        if (!b.time) return -1;
        return a.time.localeCompare(b.time);
      });

      setEvents(scheduleEvents);
    } catch (err) {
      console.error("Error in useKidsSchedule:", err);
      setError("Failed to load schedule");
    } finally {
      setLoading(false);
    }
  }, [linkedChildId]);

  useEffect(() => {
    void fetchSchedule();
  }, [fetchSchedule]);

  return {
    events,
    loading,
    error,
    refetch: fetchSchedule,
  };
};
