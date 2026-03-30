import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "@/hooks/useNotifications";
import { useFamily } from "@/contexts/FamilyContext";
import type { Tables } from "@/integrations/supabase/types";

type CustodySchedule = Tables<"custody_schedules">;

export const useRealtimeSchedule = () => {
  const { toast } = useToast();
  const { sendNotification } = useNotifications();
  const { activeFamilyId, loading: familyLoading } = useFamily();
  const [schedules, setSchedules] = useState<CustodySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const requestVersionRef = useRef(0);

  useEffect(() => {
    requestVersionRef.current += 1;
    setSchedules([]);

    if (!familyLoading) {
      setLoading(Boolean(activeFamilyId));
    }
  }, [activeFamilyId, familyLoading]);

  const fetchSchedules = useCallback(async () => {
    const requestVersion = ++requestVersionRef.current;

    if (familyLoading) {
      return;
    }

    if (!activeFamilyId) {
      if (requestVersion === requestVersionRef.current) {
        setSchedules([]);
        setLoading(false);
      }
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("custody_schedules")
        .select("*")
        .eq("family_id", activeFamilyId)
        .order("start_date", { ascending: true });

      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      if (error) {
        throw error;
      }

      setSchedules(data || []);
    } catch (error) {
      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      console.error("Error fetching schedules:", error);
      toast({
        title: "Error",
        description: "Failed to load schedules",
        variant: "destructive",
      });
      setSchedules([]);
    } finally {
      if (requestVersion === requestVersionRef.current) {
        setLoading(false);
      }
    }
  }, [activeFamilyId, familyLoading, toast]);

  useEffect(() => {
    void fetchSchedules();
  }, [fetchSchedules]);

  useEffect(() => {
    if (familyLoading || !activeFamilyId) return;

    const channel = supabase
      .channel(`schedule-changes-${activeFamilyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "custody_schedules",
          filter: `family_id=eq.${activeFamilyId}`,
        },
        (payload) => {
          console.log("Schedule change:", payload);

          if (payload.eventType === "UPDATE") {
            setSchedules((prev) =>
              prev.map((schedule) =>
                schedule.id === payload.new.id ? (payload.new as CustodySchedule) : schedule,
              ),
            );
            void sendNotification(
              "schedule_changes",
              "Schedule Updated",
              "The custody schedule has been modified",
            );
            return;
          }

          if (payload.eventType === "DELETE") {
            setSchedules((prev) => prev.filter((schedule) => schedule.id !== payload.old.id));
            void sendNotification(
              "schedule_changes",
              "Schedule Removed",
              "A custody schedule has been removed",
            );
            return;
          }

          if (payload.eventType === "INSERT") {
            setSchedules((prev) => [...prev, payload.new as CustodySchedule]);
            void sendNotification(
              "schedule_changes",
              "New Schedule",
              "A new custody schedule has been created",
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeFamilyId, familyLoading, sendNotification]);

  return {
    schedules,
    loading,
    refetch: fetchSchedules,
  };
};
