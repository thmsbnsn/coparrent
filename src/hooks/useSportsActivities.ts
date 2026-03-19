import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { Json } from "@/integrations/supabase/types";
import { handleError } from "@/lib/errorMessages";

export interface EquipmentItem {
  id: string;
  name: string;
  required: boolean;
}

export interface ChildActivity {
  id: string;
  child_id: string;
  child_name?: string;
  primary_parent_id: string;
  name: string;
  sport_type: string;
  team_name: string | null;
  coach_name: string | null;
  coach_phone: string | null;
  coach_email: string | null;
  season_start: string | null;
  season_end: string | null;
  notes: string | null;
  equipment_checklist: EquipmentItem[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ActivityEvent {
  id: string;
  activity_id: string;
  activity_name?: string;
  child_name?: string;
  sport_type?: string;
  event_type: "game" | "practice" | "tournament" | "meeting" | "other";
  title: string;
  event_date: string;
  start_time: string;
  end_time: string | null;
  location_name: string | null;
  location_address: string | null;
  venue_notes: string | null;
  dropoff_parent_id: string | null;
  dropoff_parent_name?: string | null;
  pickup_parent_id: string | null;
  pickup_parent_name?: string | null;
  equipment_needed: EquipmentItem[];
  notes: string | null;
  is_cancelled: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateActivityInput {
  child_id: string;
  name: string;
  sport_type: string;
  team_name?: string;
  coach_name?: string;
  coach_phone?: string;
  coach_email?: string;
  season_start?: string;
  season_end?: string;
  notes?: string;
  equipment_checklist?: EquipmentItem[];
}

export interface CreateEventInput {
  activity_id: string;
  event_type: "game" | "practice" | "tournament" | "meeting" | "other";
  title: string;
  event_date: string;
  start_time: string;
  end_time?: string;
  location_name?: string;
  location_address?: string;
  venue_notes?: string;
  dropoff_parent_id?: string;
  pickup_parent_id?: string;
  equipment_needed?: EquipmentItem[];
  notes?: string;
}

export const SPORT_TYPES = [
  { value: "soccer", label: "Soccer" },
  { value: "basketball", label: "Basketball" },
  { value: "baseball", label: "Baseball" },
  { value: "softball", label: "Softball" },
  { value: "football", label: "Football" },
  { value: "volleyball", label: "Volleyball" },
  { value: "tennis", label: "Tennis" },
  { value: "swimming", label: "Swimming" },
  { value: "track", label: "Track & Field" },
  { value: "gymnastics", label: "Gymnastics" },
  { value: "dance", label: "Dance" },
  { value: "martial_arts", label: "Martial Arts" },
  { value: "hockey", label: "Hockey" },
  { value: "lacrosse", label: "Lacrosse" },
  { value: "cheerleading", label: "Cheerleading" },
  { value: "music", label: "Music" },
  { value: "art", label: "Art" },
  { value: "drama", label: "Drama/Theater" },
  { value: "scouts", label: "Scouts" },
  { value: "other", label: "Other" },
];

export const EVENT_TYPES = [
  { value: "practice", label: "Practice" },
  { value: "game", label: "Game" },
  { value: "tournament", label: "Tournament" },
  { value: "meeting", label: "Meeting" },
  { value: "other", label: "Other" },
];

const parseEquipmentChecklist = (data: Json | null): EquipmentItem[] => {
  if (!data || !Array.isArray(data)) return [];
  return data as unknown as EquipmentItem[];
};

export const useSportsActivities = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activities, setActivities] = useState<ChildActivity[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [coParentId, setCoParentId] = useState<string | null>(null);
  const [parentProfiles, setParentProfiles] = useState<{ id: string; full_name: string }[]>([]);

  // Fetch profile and co-parent info
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from("profiles")
        .select("id, co_parent_id")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setProfileId(data.id);
        setCoParentId(data.co_parent_id);
        
        // Fetch both parent profiles for dropdown
        const parentIds = [data.id];
        if (data.co_parent_id) parentIds.push(data.co_parent_id);
        
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", parentIds);
        
        if (profiles) {
          setParentProfiles(profiles.map(p => ({ 
            id: p.id, 
            full_name: p.full_name || "Parent" 
          })));
        }
      }
    };
    fetchProfile();
  }, [user?.id]);

  // Fetch activities with child names
  const fetchActivities = useCallback(async () => {
    if (!profileId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("child_activities")
        .select(`
          *,
          children:child_id (name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const activitiesWithNames: ChildActivity[] = (data || []).map((a) => ({
        id: a.id,
        child_id: a.child_id,
        child_name: a.children?.name || undefined,
        primary_parent_id: a.primary_parent_id,
        name: a.name,
        sport_type: a.sport_type,
        team_name: a.team_name,
        coach_name: a.coach_name,
        coach_phone: a.coach_phone,
        coach_email: a.coach_email,
        season_start: a.season_start,
        season_end: a.season_end,
        notes: a.notes,
        equipment_checklist: parseEquipmentChecklist(a.equipment_checklist),
        is_active: a.is_active,
        created_at: a.created_at,
        updated_at: a.updated_at,
      }));

      setActivities(activitiesWithNames);
    } catch (error) {
      handleError(error, { feature: 'Sports', action: 'fetchActivities' });
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  // Fetch upcoming events
  const fetchEvents = useCallback(async () => {
    if (!profileId) return;

    try {
      const today = new Date().toISOString().split("T")[0];
      
      // First get events
      const { data: eventsData, error: eventsError } = await supabase
        .from("activity_events")
        .select("*")
        .gte("event_date", today)
        .eq("is_cancelled", false)
        .order("event_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (eventsError) throw eventsError;

      if (!eventsData || eventsData.length === 0) {
        setEvents([]);
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

      // Get parent names for dropoff/pickup
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

      const eventsWithDetails: ActivityEvent[] = eventsData.map((e) => {
        const activity = activitiesMap.get(e.activity_id);
        return {
          id: e.id,
          activity_id: e.activity_id,
          activity_name: activity?.name,
          sport_type: activity?.sport_type,
          child_name: activity?.child_name,
          event_type: e.event_type as ActivityEvent["event_type"],
          title: e.title,
          event_date: e.event_date,
          start_time: e.start_time,
          end_time: e.end_time,
          location_name: e.location_name,
          location_address: e.location_address,
          venue_notes: e.venue_notes,
          dropoff_parent_id: e.dropoff_parent_id,
          dropoff_parent_name: e.dropoff_parent_id ? parentsMap.get(e.dropoff_parent_id) : null,
          pickup_parent_id: e.pickup_parent_id,
          pickup_parent_name: e.pickup_parent_id ? parentsMap.get(e.pickup_parent_id) : null,
          equipment_needed: parseEquipmentChecklist(e.equipment_needed),
          notes: e.notes,
          is_cancelled: e.is_cancelled,
          created_by: e.created_by,
          created_at: e.created_at,
          updated_at: e.updated_at,
        };
      });

      setEvents(eventsWithDetails);
    } catch (error) {
      handleError(error, { feature: 'Sports', action: 'fetchEvents' });
    }
  }, [profileId]);

  // Initial fetch
  useEffect(() => {
    if (profileId) {
      fetchActivities();
      fetchEvents();
    }
  }, [profileId, fetchActivities, fetchEvents]);

  // Create activity
  const createActivity = useCallback(async (input: CreateActivityInput): Promise<boolean> => {
    if (!profileId) return false;

    try {
      const { error } = await supabase.from("child_activities").insert({
        child_id: input.child_id,
        name: input.name,
        sport_type: input.sport_type,
        team_name: input.team_name || null,
        coach_name: input.coach_name || null,
        coach_phone: input.coach_phone || null,
        coach_email: input.coach_email || null,
        season_start: input.season_start || null,
        season_end: input.season_end || null,
        notes: input.notes || null,
        primary_parent_id: profileId,
        equipment_checklist: (input.equipment_checklist || []) as unknown as Json,
      });

      if (error) throw error;

      toast({ title: "Activity created", description: `${input.name} has been added` });
      await fetchActivities();
      return true;
    } catch (error) {
      const message = handleError(error, { feature: 'Sports', action: 'createActivity' });
      toast({ title: "Error", description: message, variant: "destructive" });
      return false;
    }
  }, [profileId, toast, fetchActivities]);

  // Update activity
  const updateActivity = useCallback(async (
    activityId: string, 
    updates: Partial<CreateActivityInput>
  ): Promise<boolean> => {
    try {
      const updateData: Record<string, unknown> = {};
      if (updates.child_id !== undefined) updateData.child_id = updates.child_id;
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.sport_type !== undefined) updateData.sport_type = updates.sport_type;
      if (updates.team_name !== undefined) updateData.team_name = updates.team_name;
      if (updates.coach_name !== undefined) updateData.coach_name = updates.coach_name;
      if (updates.coach_phone !== undefined) updateData.coach_phone = updates.coach_phone;
      if (updates.coach_email !== undefined) updateData.coach_email = updates.coach_email;
      if (updates.season_start !== undefined) updateData.season_start = updates.season_start;
      if (updates.season_end !== undefined) updateData.season_end = updates.season_end;
      if (updates.notes !== undefined) updateData.notes = updates.notes;
      if (updates.equipment_checklist !== undefined) {
        updateData.equipment_checklist = updates.equipment_checklist as unknown as Json;
      }

      const { error } = await supabase
        .from("child_activities")
        .update(updateData)
        .eq("id", activityId);

      if (error) throw error;

      toast({ title: "Activity updated" });
      await fetchActivities();
      return true;
    } catch (error) {
      const message = handleError(error, { feature: 'Sports', action: 'updateActivity' });
      toast({ title: "Error", description: message, variant: "destructive" });
      return false;
    }
  }, [toast, fetchActivities]);

  // Delete activity
  const deleteActivity = useCallback(async (activityId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("child_activities")
        .delete()
        .eq("id", activityId);

      if (error) throw error;

      toast({ title: "Activity deleted" });
      await fetchActivities();
      await fetchEvents();
      return true;
    } catch (error) {
      const message = handleError(error, { feature: 'Sports', action: 'deleteActivity' });
      toast({ title: "Error", description: message, variant: "destructive" });
      return false;
    }
  }, [toast, fetchActivities, fetchEvents]);

  // Create event
  const createEvent = useCallback(async (input: CreateEventInput): Promise<boolean> => {
    if (!profileId) return false;

    try {
      const { error } = await supabase.from("activity_events").insert({
        activity_id: input.activity_id,
        event_type: input.event_type,
        title: input.title,
        event_date: input.event_date,
        start_time: input.start_time,
        end_time: input.end_time || null,
        location_name: input.location_name || null,
        location_address: input.location_address || null,
        venue_notes: input.venue_notes || null,
        dropoff_parent_id: input.dropoff_parent_id || null,
        pickup_parent_id: input.pickup_parent_id || null,
        notes: input.notes || null,
        created_by: profileId,
        equipment_needed: (input.equipment_needed || []) as unknown as Json,
      });

      if (error) throw error;

      toast({ title: "Event created", description: `${input.title} has been scheduled` });
      await fetchEvents();
      return true;
    } catch (error) {
      const message = handleError(error, { feature: 'Sports', action: 'createEvent' });
      toast({ title: "Error", description: message, variant: "destructive" });
      return false;
    }
  }, [profileId, toast, fetchEvents]);

  // Update event
  const updateEvent = useCallback(async (
    eventId: string,
    updates: Partial<CreateEventInput>
  ): Promise<boolean> => {
    try {
      const updateData: Record<string, unknown> = {};
      if (updates.activity_id !== undefined) updateData.activity_id = updates.activity_id;
      if (updates.event_type !== undefined) updateData.event_type = updates.event_type;
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.event_date !== undefined) updateData.event_date = updates.event_date;
      if (updates.start_time !== undefined) updateData.start_time = updates.start_time;
      if (updates.end_time !== undefined) updateData.end_time = updates.end_time;
      if (updates.location_name !== undefined) updateData.location_name = updates.location_name;
      if (updates.location_address !== undefined) updateData.location_address = updates.location_address;
      if (updates.venue_notes !== undefined) updateData.venue_notes = updates.venue_notes;
      if (updates.dropoff_parent_id !== undefined) updateData.dropoff_parent_id = updates.dropoff_parent_id;
      if (updates.pickup_parent_id !== undefined) updateData.pickup_parent_id = updates.pickup_parent_id;
      if (updates.notes !== undefined) updateData.notes = updates.notes;
      if (updates.equipment_needed !== undefined) {
        updateData.equipment_needed = updates.equipment_needed as unknown as Json;
      }

      const { error } = await supabase
        .from("activity_events")
        .update(updateData)
        .eq("id", eventId);

      if (error) throw error;

      toast({ title: "Event updated" });
      await fetchEvents();
      return true;
    } catch (error) {
      const message = handleError(error, { feature: 'Sports', action: 'updateEvent' });
      toast({ title: "Error", description: message, variant: "destructive" });
      return false;
    }
  }, [toast, fetchEvents]);

  // Cancel event
  const cancelEvent = useCallback(async (eventId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("activity_events")
        .update({ is_cancelled: true })
        .eq("id", eventId);

      if (error) throw error;

      toast({ title: "Event cancelled" });
      await fetchEvents();
      return true;
    } catch (error) {
      const message = handleError(error, { feature: 'Sports', action: 'cancelEvent' });
      toast({ title: "Error", description: message, variant: "destructive" });
      return false;
    }
  }, [toast, fetchEvents]);

  // Delete event
  const deleteEvent = useCallback(async (eventId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("activity_events")
        .delete()
        .eq("id", eventId);

      if (error) throw error;

      toast({ title: "Event deleted" });
      await fetchEvents();
      return true;
    } catch (error) {
      console.error("Error deleting event:", error);
      toast({ title: "Error", description: "Failed to delete event", variant: "destructive" });
      return false;
    }
  }, [toast, fetchEvents]);

  return {
    activities,
    events,
    loading,
    profileId,
    coParentId,
    parentProfiles,
    createActivity,
    updateActivity,
    deleteActivity,
    createEvent,
    updateEvent,
    cancelEvent,
    deleteEvent,
    refetch: () => {
      fetchActivities();
      fetchEvents();
    },
  };
};
