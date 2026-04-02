import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useFamily } from "@/contexts/FamilyContext";

interface ScheduleEvent {
  id: string;
  location?: string;
  time: string;
  title: string;
  type: "exchange" | "activity" | "sports";
}

interface UseKidsScheduleReturn {
  error: string | null;
  events: ScheduleEvent[];
  loading: boolean;
  refetch: () => Promise<void>;
}

interface ActivityEventRow {
  activity: {
    child_id: string | null;
    family_id: string | null;
    name: string | null;
  } | {
    child_id: string | null;
    family_id: string | null;
    name: string | null;
  }[] | null;
  event_type: string | null;
  id: string;
  location_name: string | null;
  start_time: string | null;
  title: string | null;
}

export const useKidsSchedule = (linkedChildId: string | null): UseKidsScheduleReturn => {
  const { activeFamilyId } = useFamily();
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedule = useCallback(async () => {
    if (!linkedChildId) {
      setEvents([]);
      setLoading(false);
      return;
    }

    if (!activeFamilyId) {
      setEvents([]);
      setError("An active family is required before loading the kids schedule.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: child, error: childError } = await supabase
        .from("children")
        .select("id")
        .eq("id", linkedChildId)
        .eq("family_id", activeFamilyId)
        .maybeSingle();

      if (childError) {
        throw childError;
      }

      if (!child) {
        throw new Error("The linked child is not part of the active family.");
      }

      const today = format(new Date(), "yyyy-MM-dd");
      const scheduleEvents: ScheduleEvent[] = [];

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
            family_id,
            name
          )
        `)
        .eq("event_date", today)
        .eq("is_cancelled", false);

      if (activityError) {
        throw activityError;
      }

      for (const event of (activityEvents as ActivityEventRow[] | null) ?? []) {
        const activity = Array.isArray(event.activity) ? event.activity[0] : event.activity;

        if (!activity || activity.child_id !== linkedChildId || activity.family_id !== activeFamilyId) {
          continue;
        }

        scheduleEvents.push({
          id: event.id,
          location: event.location_name || undefined,
          time: event.start_time ? format(parseISO(`2000-01-01T${event.start_time}`), "h:mm a") : "",
          title: event.title || activity.name || "Event",
          type: event.event_type === "activity" ? "activity" : "sports",
        });
      }

      const { data: schedules, error: scheduleError } = await supabase
        .from("custody_schedules")
        .select("id, exchange_time, exchange_location, child_ids")
        .eq("family_id", activeFamilyId)
        .not("child_ids", "is", null);

      if (scheduleError) {
        throw scheduleError;
      }

      for (const schedule of schedules ?? []) {
        const childIds = schedule.child_ids as string[] | null;

        if (childIds?.includes(linkedChildId) && schedule.exchange_time) {
          scheduleEvents.unshift({
            id: `exchange-${schedule.id}`,
            location: schedule.exchange_location || undefined,
            time: schedule.exchange_time,
            title: "Custody Exchange",
            type: "exchange",
          });
          break;
        }
      }

      scheduleEvents.sort((left, right) => {
        if (!left.time) return 1;
        if (!right.time) return -1;
        return left.time.localeCompare(right.time);
      });

      setEvents(scheduleEvents);
    } catch (err) {
      console.error("Error in useKidsSchedule:", err);
      setEvents([]);
      setError(err instanceof Error ? err.message : "Failed to load schedule");
    } finally {
      setLoading(false);
    }
  }, [activeFamilyId, linkedChildId]);

  useEffect(() => {
    void fetchSchedule();
  }, [fetchSchedule]);

  return {
    error,
    events,
    loading,
    refetch: fetchSchedule,
  };
};
