import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useFamily } from "@/contexts/FamilyContext";
import { fetchFamilyParentProfiles } from "@/lib/familyScope";
import type { ScheduleConfig, HolidayConfig } from "@/components/calendar/CalendarWizard";
import type { Json } from "@/integrations/supabase/types";

interface DatabaseSchedule {
  id: string;
  family_id: string | null;
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

const toScheduleConfig = (dbSchedule: DatabaseSchedule): ScheduleConfig => {
  const parsedHolidays: HolidayConfig[] = Array.isArray(dbSchedule.holidays)
    ? (dbSchedule.holidays as unknown as HolidayConfig[])
    : [];

  return {
    pattern: dbSchedule.pattern,
    customPattern: dbSchedule.custom_pattern || undefined,
    startDate: new Date(dbSchedule.start_date),
    startingParent: (dbSchedule.starting_parent as "A" | "B") || "A",
    exchangeTime: dbSchedule.exchange_time || "6:00 PM",
    exchangeLocation: dbSchedule.exchange_location || "",
    alternateLocation: dbSchedule.alternate_exchange_location || "",
    holidays: parsedHolidays,
  };
};

export const useSchedulePersistence = () => {
  const { toast } = useToast();
  const { activeFamilyId, profileId, loading: familyLoading, isParentInActiveFamily } = useFamily();
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig | null>(null);
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const requestVersionRef = useRef(0);

  const clearScheduleState = useCallback(() => {
    setScheduleConfig(null);
    setScheduleId(null);
  }, []);

  useEffect(() => {
    requestVersionRef.current += 1;
    clearScheduleState();

    if (!familyLoading) {
      setLoading(Boolean(activeFamilyId));
    }
  }, [activeFamilyId, familyLoading, clearScheduleState]);

  const loadSchedule = useCallback(async () => {
    const requestVersion = ++requestVersionRef.current;

    if (familyLoading) {
      return;
    }

    if (!activeFamilyId) {
      if (requestVersion === requestVersionRef.current) {
        clearScheduleState();
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
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      if (error) {
        throw error;
      }

      if (!data) {
        clearScheduleState();
        return;
      }

      const dbSchedule = data as unknown as DatabaseSchedule;
      setScheduleId(dbSchedule.id);
      setScheduleConfig(toScheduleConfig(dbSchedule));
    } catch (error) {
      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      clearScheduleState();
      console.error("Error loading schedule:", error);
      toast({
        title: "Error",
        description: "Failed to load schedule",
        variant: "destructive",
      });
    } finally {
      if (requestVersion === requestVersionRef.current) {
        setLoading(false);
      }
    }
  }, [activeFamilyId, clearScheduleState, familyLoading, toast]);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  useEffect(() => {
    if (familyLoading || !activeFamilyId) return;

    const channel = supabase
      .channel(`schedule-persistence-${activeFamilyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "custody_schedules",
          filter: `family_id=eq.${activeFamilyId}`,
        },
        () => {
          void loadSchedule();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeFamilyId, familyLoading, loadSchedule]);

  const saveSchedule = async (config: ScheduleConfig): Promise<boolean> => {
    if (!profileId || !activeFamilyId || !isParentInActiveFamily) {
      toast({
        title: "Error",
        description: "You must be an active parent or guardian in this family to save a schedule.",
        variant: "destructive",
      });
      return false;
    }

    setSaving(true);

    try {
      const familyParentProfiles = await fetchFamilyParentProfiles(activeFamilyId);
      const scheduleOwners = [
        profileId,
        ...familyParentProfiles
          .map((profile) => profile.profileId)
          .filter((candidate) => candidate && candidate !== profileId),
      ];

      const scheduleData = {
        family_id: activeFamilyId,
        parent_a_id: scheduleOwners[0],
        parent_b_id: scheduleOwners[1] ?? scheduleOwners[0],
        pattern: config.pattern,
        custom_pattern: config.customPattern || null,
        starting_parent: config.startingParent,
        start_date: config.startDate.toISOString().split("T")[0],
        exchange_time: config.exchangeTime || null,
        exchange_location: config.exchangeLocation || null,
        alternate_exchange_location: config.alternateLocation || null,
        holidays: config.holidays as unknown as Json,
      };

      if (scheduleId) {
        const { error } = await supabase
          .from("custody_schedules")
          .update(scheduleData)
          .eq("id", scheduleId)
          .eq("family_id", activeFamilyId);

        if (error) throw error;
      } else {
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
        description: "Your custody schedule has been saved for the active family.",
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
