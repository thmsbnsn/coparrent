import { useCallback, useEffect, useMemo, useState } from "react";
import { useFamily } from "@/contexts/FamilyContext";
import { supabase } from "@/integrations/supabase/client";
import { normalizeFeatureAvailabilityError } from "@/lib/featureAvailabilityErrors";
import type {
  FamilyPresenceMember,
  FamilyPresenceOverviewRow,
} from "@/lib/familyPresence";

const mapPresenceRows = (rows: FamilyPresenceOverviewRow[] | null): FamilyPresenceMember[] =>
  ((rows ?? []) as FamilyPresenceOverviewRow[]).map((row) => ({
    avatarUrl: row.avatar_url,
    displayName: row.display_name,
    gameDisplayName: row.game_display_name,
    gameSlug: row.game_slug,
    lastSeenAt: row.last_seen_at,
    locationType: row.location_type,
    membershipId: row.membership_id,
    presenceStatus: row.presence_status,
    profileId: row.profile_id,
    relationshipLabel: row.relationship_label,
    role: row.role,
  }));

export const useFamilyPresence = () => {
  const maintenanceMessage =
    "Live family activity is still being enabled on this server. It will appear here after the update finishes.";
  const { activeFamilyId, loading: familyLoading } = useFamily();
  const [members, setMembers] = useState<FamilyPresenceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [scopeError, setScopeError] = useState<string | null>(null);

  const fetchPresence = useCallback(async () => {
    if (familyLoading) {
      return;
    }

    if (!activeFamilyId) {
      setMembers([]);
      setScopeError("Select an active family before loading family presence.");
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.rpc("get_family_presence_overview", {
      p_family_id: activeFamilyId,
    });

    if (error) {
      console.error("Error loading family presence:", error);
      setMembers([]);
      setScopeError(
        normalizeFeatureAvailabilityError(
          error.message,
          maintenanceMessage,
          ["get_family_presence_overview"],
        ),
      );
      setLoading(false);
      return;
    }

    setMembers(mapPresenceRows(data as FamilyPresenceOverviewRow[] | null));
    setScopeError(null);
    setLoading(false);
  }, [activeFamilyId, familyLoading]);

  useEffect(() => {
    void fetchPresence();
  }, [fetchPresence]);

  useEffect(() => {
    if (!activeFamilyId) {
      return;
    }

    const channel = supabase
      .channel(`family-presence-${activeFamilyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "family_presence",
          filter: `family_id=eq.${activeFamilyId}`,
        },
        () => {
          void fetchPresence();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "family_members",
          filter: `family_id=eq.${activeFamilyId}`,
        },
        () => {
          void fetchPresence();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeFamilyId, fetchPresence]);

  const activeCount = useMemo(
    () => members.filter((member) => member.presenceStatus === "active").length,
    [members],
  );

  return {
    activeCount,
    loading: loading || familyLoading,
    members,
    refresh: fetchPresence,
    scopeError,
  };
};
