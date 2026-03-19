import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Json } from "@/integrations/supabase/types";
import { handleError } from "@/lib/errorMessages";

export interface CalendarSportsEvent {
  id: string;
  title: string;
  event_date: string;
  start_time: string;
  end_time: string | null;
  event_type: string;
  activity_name: string;
  child_name: string;
  sport_type: string;
  location_name: string | null;
  location_address: string | null;
  venue_notes: string | null;
  dropoff_parent_name: string | null;
  pickup_parent_name: string | null;
  equipment_needed: { id: string; name: string; required: boolean }[];
  is_cancelled: boolean;
}

// Helper to parse equipment
const parseEquipment = (data: Json | null): { id: string; name: string; required: boolean }[] => {
  if (!data || !Array.isArray(data)) return [];
  return data as unknown as { id: string; name: string; required: boolean }[];
};

export const useSportsEvents = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarSportsEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      // Get user's profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) {
        setLoading(false);
        return;
      }

      // Get all events (not filtered by date so calendar can show past events too)
      const { data: eventsData, error } = await supabase
        .from("activity_events")
        .select("*")
        .order("event_date", { ascending: true });

      if (error) throw error;

      if (!eventsData || eventsData.length === 0) {
        setEvents([]);
        setLoading(false);
        return;
      }

      // Get activity details
      const activityIds = [...new Set(eventsData.map(e => e.activity_id))];
      const { data: activitiesData } = await supabase
        .from("child_activities")
        .select("id, name, sport_type, child_id, children:child_id (name)")
        .in("id", activityIds);

      const activitiesMap = new Map(
        (activitiesData || []).map(a => [a.id, {
          name: a.name,
          sport_type: a.sport_type,
          child_name: a.children?.name
        }])
      );

      // Get parent names
      const parentIds = [
        ...eventsData.map(e => e.dropoff_parent_id).filter(Boolean),
        ...eventsData.map(e => e.pickup_parent_id).filter(Boolean),
      ];
      const uniqueParentIds = [...new Set(parentIds)] as string[];

      let parentsMap = new Map<string, string>();
      if (uniqueParentIds.length > 0) {
        const { data: parentsData } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", uniqueParentIds);

        parentsMap = new Map(
          (parentsData || []).map(p => [p.id, p.full_name || "Parent"])
        );
      }

      const calendarEvents: CalendarSportsEvent[] = eventsData.map(e => {
        const activity = activitiesMap.get(e.activity_id);
        return {
          id: e.id,
          title: e.title,
          event_date: e.event_date,
          start_time: e.start_time,
          end_time: e.end_time,
          event_type: e.event_type,
          activity_name: activity?.name || "",
          child_name: activity?.child_name || "",
          sport_type: activity?.sport_type || "",
          location_name: e.location_name,
          location_address: e.location_address,
          venue_notes: e.venue_notes,
          dropoff_parent_name: e.dropoff_parent_id ? parentsMap.get(e.dropoff_parent_id) || null : null,
          pickup_parent_name: e.pickup_parent_id ? parentsMap.get(e.pickup_parent_id) || null : null,
          equipment_needed: parseEquipment(e.equipment_needed),
          is_cancelled: e.is_cancelled,
        };
      });

      setEvents(calendarEvents);
    } catch (error) {
      handleError(error, { feature: 'SportsEvents', action: 'fetch' });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Get events for a specific date
  const getEventsForDate = useCallback((date: Date): CalendarSportsEvent[] => {
    const dateStr = date.toISOString().split("T")[0];
    return events.filter(e => e.event_date === dateStr && !e.is_cancelled);
  }, [events]);

  // Check if a date has sports events
  const hasEventsOnDate = useCallback((date: Date): boolean => {
    const dateStr = date.toISOString().split("T")[0];
    return events.some(e => e.event_date === dateStr && !e.is_cancelled);
  }, [events]);

  return {
    events,
    loading,
    getEventsForDate,
    hasEventsOnDate,
    refetch: fetchEvents,
  };
};
