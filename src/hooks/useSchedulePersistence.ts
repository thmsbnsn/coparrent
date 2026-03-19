import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { ScheduleConfig, HolidayConfig } from "@/components/calendar/CalendarWizard";
import type { Json } from "@/integrations/supabase/types";

// Extended type that includes our new columns (not yet in generated types)
interface DatabaseSchedule {
  id: string;
  parent_a_id: string;
  parent_b_id: string;
  pattern: string;
  custom_pattern?: number[] | null;
  starting_parent?: string | null;
  start_date: string;
  exchange_time: string | null;
  exchange_location: string | null;
  alternate_exchange_location?: string | null;
  holidays: Json | null;
  child_ids: string[] | null;
  created_at: string;
  updated_at: string;
}

export const useSchedulePersistence = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig | null>(null);
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userProfileId, setUserProfileId] = useState<string | null>(null);
  const [coParentId, setCoParentId] = useState<string | null>(null);

  // Fetch user's profile ID and co-parent ID
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("id, co_parent_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;

        if (profile) {
          setUserProfileId(profile.id);
          setCoParentId(profile.co_parent_id);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchProfile();
    }
  }, [user, authLoading]);

  // Load existing schedule
  const loadSchedule = useCallback(async () => {
    if (!userProfileId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("custody_schedules")
        .select("*")
        .or(`parent_a_id.eq.${userProfileId},parent_b_id.eq.${userProfileId}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const dbSchedule = data as unknown as DatabaseSchedule;
        setScheduleId(dbSchedule.id);
        
        // Parse holidays from JSON
        let parsedHolidays: HolidayConfig[] = [];
        if (dbSchedule.holidays) {
          parsedHolidays = Array.isArray(dbSchedule.holidays) 
            ? dbSchedule.holidays as unknown as HolidayConfig[]
            : [];
        }
        
        // Convert database format to ScheduleConfig
        const config: ScheduleConfig = {
          pattern: dbSchedule.pattern,
          customPattern: dbSchedule.custom_pattern || undefined,
          startDate: new Date(dbSchedule.start_date),
          startingParent: (dbSchedule.starting_parent as "A" | "B") || "A",
          exchangeTime: dbSchedule.exchange_time || "6:00 PM",
          exchangeLocation: dbSchedule.exchange_location || "",
          alternateLocation: dbSchedule.alternate_exchange_location || "",
          holidays: parsedHolidays,
        };
        
        setScheduleConfig(config);
      }
    } catch (error) {
      console.error("Error loading schedule:", error);
      toast({
        title: "Error",
        description: "Failed to load schedule",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [userProfileId, toast]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  // Set up realtime subscription
  useEffect(() => {
    if (!userProfileId) return;

    const channel = supabase
      .channel('schedule-persistence')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'custody_schedules'
        },
        (payload) => {
          const schedule = payload.new as DatabaseSchedule;
          const isRelevant = schedule?.parent_a_id === userProfileId || schedule?.parent_b_id === userProfileId;
          
          if (!isRelevant && payload.eventType !== 'DELETE') return;

          // Reload schedule on any change
          loadSchedule();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userProfileId, loadSchedule]);

  // Save schedule to database
  const saveSchedule = async (config: ScheduleConfig): Promise<boolean> => {
    if (!userProfileId) {
      toast({
        title: "Error",
        description: "You must be logged in to save a schedule",
        variant: "destructive",
      });
      return false;
    }

    setSaving(true);

    try {
      // Build data object with all fields including new columns
      const scheduleData = {
        parent_a_id: userProfileId,
        parent_b_id: coParentId || userProfileId,
        pattern: config.pattern,
        custom_pattern: config.customPattern || null,
        starting_parent: config.startingParent,
        start_date: config.startDate.toISOString().split('T')[0],
        exchange_time: config.exchangeTime || null,
        exchange_location: config.exchangeLocation || null,
        alternate_exchange_location: config.alternateLocation || null,
        holidays: config.holidays as unknown as Json,
      };

      if (scheduleId) {
        // Update existing schedule
        const { error } = await supabase
          .from("custody_schedules")
          .update(scheduleData)
          .eq("id", scheduleId);

        if (error) throw error;
      } else {
        // Create new schedule
        const { data, error } = await supabase
          .from("custody_schedules")
          .insert(scheduleData)
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setScheduleId(data.id);
        }
      }

      setScheduleConfig(config);
      toast({
        title: "Schedule Saved",
        description: "Your custody schedule has been saved and will sync with your co-parent.",
      });
      return true;
    } catch (error) {
      console.error("Error saving schedule:", error);
      toast({
        title: "Error",
        description: "Failed to save schedule. Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    scheduleConfig,
    scheduleId,
    loading,
    saving,
    saveSchedule,
    refetch: loadSchedule,
  };
};
