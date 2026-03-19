import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "@/hooks/useNotifications";
import type { Tables } from "@/integrations/supabase/types";

type CustodySchedule = Tables<"custody_schedules">;

export const useRealtimeSchedule = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { sendNotification } = useNotifications();
  const [schedules, setSchedules] = useState<CustodySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfileId, setUserProfileId] = useState<string | null>(null);

  // Fetch user's profile ID
  useEffect(() => {
    const fetchProfileId = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profile) {
          setUserProfileId(profile.id);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchProfileId();
    }
  }, [user, authLoading]);

  // Fetch schedules
  const fetchSchedules = useCallback(async () => {
    if (!userProfileId) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("custody_schedules")
      .select("*")
      .or(`parent_a_id.eq.${userProfileId},parent_b_id.eq.${userProfileId}`)
      .order("start_date", { ascending: true });

    if (error) {
      console.error("Error fetching schedules:", error);
      toast({
        title: "Error",
        description: "Failed to load schedules",
        variant: "destructive",
      });
    } else {
      setSchedules(data || []);
    }
    setLoading(false);
  }, [userProfileId, toast]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // Set up realtime subscription
  useEffect(() => {
    if (!userProfileId) return;

    const channel = supabase
      .channel('schedule-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'custody_schedules'
        },
        (payload) => {
          console.log('Schedule change:', payload);
          
          const schedule = payload.new as CustodySchedule;
          const isRelevant = schedule?.parent_a_id === userProfileId || schedule?.parent_b_id === userProfileId;
          
          if (!isRelevant && payload.eventType !== 'DELETE') return;

          if (payload.eventType === 'UPDATE') {
            setSchedules(prev => prev.map(s => 
              s.id === payload.new.id ? payload.new as CustodySchedule : s
            ));
            sendNotification('schedule_changes', 'Schedule Updated', 'The custody schedule has been modified');
          } else if (payload.eventType === 'DELETE') {
            setSchedules(prev => prev.filter(s => s.id !== payload.old.id));
            sendNotification('schedule_changes', 'Schedule Removed', 'A custody schedule has been removed');
          } else if (payload.eventType === 'INSERT') {
            setSchedules(prev => [...prev, payload.new as CustodySchedule]);
            sendNotification('schedule_changes', 'New Schedule', 'A new custody schedule has been created');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userProfileId, sendNotification]);

  return {
    schedules,
    loading,
    refetch: fetchSchedules,
  };
};
